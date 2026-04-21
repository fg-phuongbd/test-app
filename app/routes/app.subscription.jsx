import { useEffect } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * Loader: Get shop info and app handle for plan selection URL
 */
export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);

  // Query app info to get correct handle
  const response = await admin.graphql(`
    query {
      currentAppInstallation {
        app {
          handle
          apiKey
        }
      }
    }
  `);

  const data = await response.json();
  const appInfo = data.data?.currentAppInstallation?.app;
  const appHandle = appInfo?.handle || "demo-app";
  const apiKey = appInfo?.apiKey;

  // Get shop name without .myshopify.com
  const shopName = session.shop.replace(".myshopify.com", "");

  // Construct Shopify managed pricing URL
  // Try with app handle first, fallback to API key if needed
  const pricingUrl = `https://admin.shopify.com/store/${shopName}/charges/${appHandle}/pricing_plans`;

  console.log("Plan selection URL:", pricingUrl);
  console.log("App handle:", appHandle);
  console.log("API key:", apiKey);

  return { pricingUrl, appHandle, apiKey, shopName };
};

/**
 * Subscription component - Redirects to Shopify Managed Pricing page
 */
export default function Subscription() {
  const { pricingUrl } = useLoaderData();

  useEffect(() => {
    // Use window.open with _top to break out of iframe
    // This opens Shopify's plan selection page in the parent window
    window.open(pricingUrl, "_top");
  }, [pricingUrl]);

  return (
    <s-page heading="Redirecting to plan selection...">
      <s-section>
        <s-stack direction="block" gap="base" alignment="center">
          <s-spinner size="large" />
          <s-text>Redirecting you to choose your subscription plan...</s-text>
        </s-stack>
      </s-section>
    </s-page>
  );
}
