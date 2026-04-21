import { useState, useRef, useCallback, useEffect } from "react";
import { useFetcher, useLoaderData, useRouteError } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import crypto from "crypto";
import { authenticate } from "../shopify.server";
import { TranslationFieldEditor } from "../components/TranslationFieldEditor";

// Fields to show in the editor (in order)
const PRODUCT_FIELDS = ["title", "body_html", "meta_title", "meta_description"];

// ── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query ShopLocales {
      shopLocales {
        locale
        primary
        published
      }
    }`
  );
  const { data } = await response.json();

  // Generate a short-lived HMAC token for the storefront proxy iframe
  const ts = Date.now().toString();
  const proxyToken = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET || "")
    .update(`${session.shop}:${ts}`)
    .digest("hex");

  return {
    locales: data.shopLocales,
    shopDomain: session.shop,
    proxyToken,
    proxyTs: ts,
  };
};

// ── Error boundary ───────────────────────────────────────────────────────────

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => boundary.headers(headersArgs);

// ── Component ────────────────────────────────────────────────────────────────

export default function VisualEditor() {
  const { locales, shopDomain, proxyToken, proxyTs } = useLoaderData();
  const shopify = useAppBridge();

  // State
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedLocale, setSelectedLocale] = useState(() => {
    const secondary = locales.find((l) => !l.primary);
    return secondary ? secondary.locale : locales[0]?.locale || "en";
  });
  const [editedValues, setEditedValues] = useState({});
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);

  const iframeRef = useRef(null);

  const translationFetcher = useFetcher();
  const saveFetcher = useFetcher();

  // ── Derived values ─────────────────────────────────────────────────────────

  const primaryLocale = locales.find((l) => l.primary)?.locale || "en";

  const localeOptions = locales.map((l) => ({
    label: `${l.locale.toUpperCase()}${l.primary ? " (primary)" : ""}`,
    value: l.locale,
  }));

  const resource = translationFetcher.data?.resource;
  const isLoadingTranslations = translationFetcher.state === "loading";

  // Build lookup maps from fetcher data
  const originalMap = {};
  const translationMap = {};
  if (resource) {
    for (const item of resource.translatableContent) {
      originalMap[item.key] = item.value;
    }
    for (const item of resource.translations) {
      translationMap[item.key] = item.value;
    }
  }

  // Merge server translations with local edits
  const getTranslatedValue = (key) =>
    key in editedValues ? editedValues[key] : (translationMap[key] ?? "");

  // ── Proxy URL ──────────────────────────────────────────────────────────────

  const buildProxyUrl = useCallback(
    (product, locale) => {
      if (!product) return null;
      // Priority: published URL → preview URL → handle-based fallback
      const productUrl =
        product.onlineStoreUrl ||
        product.onlineStorePreviewUrl ||
        `https://${shopDomain}/products/${product.handle}`;
      return `/storefront-proxy?url=${encodeURIComponent(productUrl)}&shop=${encodeURIComponent(shopDomain)}&token=${proxyToken}&ts=${proxyTs}&locale=${locale}`;
    },
    [shopDomain, proxyToken, proxyTs]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handlePickProduct = async () => {
    const picked = await shopify.resourcePicker({
      type: "product",
      action: "select",
      selectionIds: selectedProduct ? [{ id: selectedProduct.id }] : [],
    });
    if (!picked || picked.length === 0) return;

    const product = picked[0];
    setSelectedProduct(product);
    setEditedValues({});

    // Load translations for this product + locale
    translationFetcher.load(
      `/api/translatable-resource?resourceId=${encodeURIComponent(product.id)}&locale=${selectedLocale}`
    );
  };

  const handleLocaleChange = (locale) => {
    setSelectedLocale(locale);
    setEditedValues({});

    if (selectedProduct) {
      translationFetcher.load(
        `/api/translatable-resource?resourceId=${encodeURIComponent(selectedProduct.id)}&locale=${locale}`
      );
      // Reload iframe with new locale
      if (iframeRef.current) {
        iframeRef.current.src = buildProxyUrl(selectedProduct, locale);
      }
    }
  };

  const handleFieldChange = (key, value) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!selectedProduct || !resource) return;

    // Build translations array with digest from translatable content
    const digestMap = {};
    for (const item of resource.translatableContent) {
      digestMap[item.key] = item.digest;
    }

    const translationsToSave = PRODUCT_FIELDS.filter(
      (key) => key in editedValues && editedValues[key] !== ""
    ).map((key) => ({
      key,
      value: editedValues[key],
      digest: digestMap[key],
    }));

    if (translationsToSave.length === 0) {
      setToastMessage("No changes to save.");
      setToastError(false);
      setToastActive(true);
      return;
    }

    saveFetcher.submit(
      JSON.stringify({
        resourceId: selectedProduct.id,
        locale: selectedLocale,
        translations: translationsToSave,
      }),
      {
        method: "POST",
        action: "/api/translations",
        encType: "application/json",
      }
    );
  };

  // React to save result
  const prevSaveState = useRef(null);
  if (
    saveFetcher.state === "idle" &&
    saveFetcher.data &&
    prevSaveState.current !== saveFetcher.data
  ) {
    prevSaveState.current = saveFetcher.data;
    if (saveFetcher.data.success) {
      setToastMessage("Translations saved!");
      setToastError(false);
      setToastActive(true);
      setEditedValues({});
      // Reload iframe to reflect new translations
      if (iframeRef.current) {
        iframeRef.current.src = buildProxyUrl(selectedProduct, selectedLocale);
      }
    } else {
      const errMsg =
        saveFetcher.data.errors?.[0]?.message ||
        saveFetcher.data.error ||
        "Save failed.";
      setToastMessage(errMsg);
      setToastError(true);
      setToastActive(true);
    }
  }

  const isSaving = saveFetcher.state !== "idle";
  const hasEdits = Object.keys(editedValues).length > 0;
  const proxyUrl = buildProxyUrl(selectedProduct, selectedLocale);

  // Show toast via App Bridge
  useEffect(() => {
    if (!toastActive) return;
    if (toastError) {
      shopify.toast.show(toastMessage, { isError: true });
    } else {
      shopify.toast.show(toastMessage);
    }
    setToastActive(false);
  }, [toastActive, toastMessage, toastError, shopify]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const secondaryLocaleOptions = localeOptions.filter((o) => o.value !== primaryLocale);

  return (
    <s-page heading="Visual Translation Editor">
      {/* Toolbar card */}
      <s-section>
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
          {/* Language selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "160px" }}>
            <label style={{ fontSize: "13px", fontWeight: 500, color: "#616161" }}>
              Translate to
            </label>
            <select
              value={selectedLocale}
              onChange={(e) => handleLocaleChange(e.target.value)}
              disabled={secondaryLocaleOptions.length === 0}
              style={{
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #c9cccf",
                fontSize: "14px",
                background: "#fff",
              }}
            >
              {secondaryLocaleOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Product picker */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <s-button onClick={handlePickProduct}>
              {selectedProduct ? "Change product" : "Pick a product"}
            </s-button>
            {selectedProduct && (
              <span style={{ fontSize: "14px", fontWeight: 600 }}>
                {selectedProduct.title}{" "}
                <span
                  style={{
                    fontSize: "12px",
                    background: "#e3f1ff",
                    color: "#0062bc",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontWeight: 500,
                  }}
                >
                  {selectedLocale.toUpperCase()}
                </span>
              </span>
            )}
          </div>

          {/* Save button */}
          {selectedProduct && resource && (
            <s-button
              variant="primary"
              onClick={handleSave}
              disabled={!hasEdits || isSaving ? "" : undefined}
            >
              {isSaving ? "Saving…" : "Save translations"}
            </s-button>
          )}
        </div>
      </s-section>

      {/* Split layout */}
      {selectedProduct ? (
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "flex-start",
            height: "calc(100vh - 260px)",
            minHeight: "500px",
            padding: "0 16px 16px",
          }}
        >
          {/* Left: Storefront iframe */}
          <div
            style={{
              flex: "0 0 60%",
              height: "100%",
              borderRadius: "10px",
              overflow: "hidden",
              border: "1px solid #e1e3e5",
              background: "#fff",
            }}
          >
            {proxyUrl ? (
              <iframe
                ref={iframeRef}
                src={proxyUrl}
                title="Storefront preview"
                style={{ width: "100%", height: "100%", border: "none" }}
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#8c9196",
                  fontSize: "14px",
                }}
              >
                No storefront URL available for this product.
              </div>
            )}
          </div>

          {/* Right: Translation form */}
          <div
            style={{
              flex: 1,
              height: "100%",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div
              style={{
                background: "#fff",
                border: "1px solid #e1e3e5",
                borderRadius: "10px",
                padding: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <span style={{ fontSize: "16px", fontWeight: 600 }}>Translations</span>
                <span style={{ fontSize: "13px", color: "#8c9196" }}>
                  {primaryLocale.toUpperCase()} → {selectedLocale.toUpperCase()}
                </span>
              </div>

              {isLoadingTranslations ? (
                <div style={{ color: "#8c9196", fontSize: "14px", padding: "24px 0", textAlign: "center" }}>
                  Loading translations…
                </div>
              ) : resource ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {PRODUCT_FIELDS.filter((key) => key in originalMap).map((key, index) => (
                    <div key={key}>
                      {index > 0 && (
                        <hr style={{ border: "none", borderTop: "1px solid #e1e3e5", margin: "0 0 24px" }} />
                      )}
                      <TranslationFieldEditor
                        fieldKey={key}
                        originalValue={originalMap[key]}
                        translatedValue={getTranslatedValue(key)}
                        onChange={(val) => handleFieldChange(key, val)}
                      />
                    </div>
                  ))}
                  <s-button
                    variant="primary"
                    onClick={handleSave}
                    disabled={!hasEdits || isSaving ? "" : undefined}
                  >
                    {isSaving ? "Saving…" : "Save translations"}
                  </s-button>
                </div>
              ) : (
                <s-banner tone="warning">
                  Could not load translatable content. Make sure this product exists and you have the correct permissions.
                </s-banner>
              )}
            </div>
          </div>
        </div>
      ) : (
        <s-section>
          <div style={{ padding: "32px", textAlign: "center", color: "#8c9196" }}>
            <s-text>Click &quot;Pick a product&quot; above to start editing translations.</s-text>
          </div>
        </s-section>
      )}
    </s-page>
  );
}
