import { useEffect } from "react";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  // Check for plan and status from Managed Pricing welcome link
  const url = new URL(request.url);
  const plan = url.searchParams.get("plan");
  const status = url.searchParams.get("status");

  let welcomeMessage = null;
  if (status === "approved" && plan) {
    welcomeMessage = `Successfully subscribed to ${plan} plan!`;
  } else if (status === "declined") {
    welcomeMessage = "Subscription was declined.";
  }

  // Check current subscription status
  const response = await admin.graphql(
    `#graphql
      query {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            lineItems {
              id
              plan {
                pricingDetails {
                  ... on AppRecurringPricing {
                    __typename
                    price {
                      amount
                      currencyCode
                    }
                    interval
                  }
                }
              }
            }
          }
        }
      }`,
  );

  const data = await response.json();
  const activeSubscriptions =
    data.data?.currentAppInstallation?.activeSubscriptions || [];

  return {
    shop: session.shop,
    hasActiveSubscription: activeSubscriptions.length > 0,
    subscriptions: activeSubscriptions,
    welcomeMessage,
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;
  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyReactRouterTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );
  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson.data.productCreate.product,
    variant: variantResponseJson.data.productVariantsBulkUpdate.productVariants,
  };
};

export default function Index() {
  const { hasActiveSubscription, subscriptions, welcomeMessage } =
    useLoaderData();
  const [searchParams] = useSearchParams();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  // Show welcome message from Managed Pricing
  useEffect(() => {
    if (welcomeMessage) {
      shopify.toast.show(welcomeMessage);
    }
  }, [welcomeMessage, shopify]);

  // Show toast messages based on URL params
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const info = searchParams.get("info");

    if (success === "subscription_activated") {
      shopify.toast.show("Subscription activated successfully!");
    } else if (error === "subscription_declined") {
      shopify.toast.show("Subscription was declined", { isError: true });
    } else if (error) {
      shopify.toast.show(`Error: ${error}`, { isError: true });
    } else if (info === "subscription_pending") {
      shopify.toast.show("Subscription is pending approval");
    }
  }, [searchParams, shopify]);

  useEffect(() => {
    if (fetcher.data?.product?.id) {
      shopify.toast.show("Product created");
    }
  }, [fetcher.data?.product?.id, shopify]);
  const generateProduct = () => fetcher.submit({}, { method: "POST" });

  return (
    <s-page heading="Shopify app template">
      <s-button slot="primary-action" onClick={generateProduct}>
        Generate a product
      </s-button>

      {/* Subscription Status Banner */}
      {!hasActiveSubscription && (
        <s-banner tone="warning">
          <s-stack direction="block" gap="base">
            <s-text>
              You don&apos;t have an active subscription. Please subscribe to
              use all features.
            </s-text>
            <s-link href="/app/subscription">Choose a plan</s-link>
          </s-stack>
        </s-banner>
      )}

      {hasActiveSubscription && subscriptions.length > 0 && (
        <s-banner tone="success">
          <s-stack direction="block" gap="base">
            <s-text>
              Active subscription: {subscriptions[0].name} (
              {subscriptions[0].status})
            </s-text>
            <s-link href="/app/subscription">Manage subscription</s-link>
          </s-stack>
        </s-banner>
      )}

      <s-section heading="Congrats on creating a new Shopify app 🎉">
        <s-paragraph>
          This embedded app template uses{" "}
          <s-link
            href="https://shopify.dev/docs/apps/tools/app-bridge"
            target="_blank"
          >
            App Bridge
          </s-link>{" "}
          interface examples like an{" "}
          <s-link href="/app/additional">additional page in the app nav</s-link>
          , as well as an{" "}
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql"
            target="_blank"
          >
            Admin GraphQL
          </s-link>{" "}
          mutation demo, to provide a starting point for app development.
        </s-paragraph>
      </s-section>
      <s-section heading="Get started with products">
        <s-paragraph>
          Generate a product with GraphQL and get the JSON output for that
          product. Learn more about the{" "}
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate"
            target="_blank"
          >
            productCreate
          </s-link>{" "}
          mutation in our API references.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button
            onClick={generateProduct}
            {...(isLoading ? { loading: true } : {})}
          >
            Generate a product
          </s-button>
          {fetcher.data?.product && (
            <s-button
              onClick={() => {
                shopify.intents.invoke?.("edit:shopify/Product", {
                  value: fetcher.data?.product?.id,
                });
              }}
              target="_blank"
              variant="tertiary"
            >
              Edit product
            </s-button>
          )}
        </s-stack>
        {fetcher.data?.product && (
          <s-section heading="productCreate mutation">
            <s-stack direction="block" gap="base">
              <s-box
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <pre style={{ margin: 0 }}>
                  <code>{JSON.stringify(fetcher.data.product, null, 2)}</code>
                </pre>
              </s-box>

              <s-heading>productVariantsBulkUpdate mutation</s-heading>
              <s-box
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <pre style={{ margin: 0 }}>
                  <code>{JSON.stringify(fetcher.data.variant, null, 2)}</code>
                </pre>
              </s-box>
            </s-stack>
          </s-section>
        )}
      </s-section>

      <s-section slot="aside" heading="App template specs">
        <s-paragraph>
          <s-text>Framework: </s-text>
          <s-link href="https://reactrouter.com/" target="_blank">
            React Router
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Interface: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/app-home/using-polaris-components"
            target="_blank"
          >
            Polaris web components
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>API: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql"
            target="_blank"
          >
            GraphQL
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Database: </s-text>
          <s-link href="https://www.prisma.io/" target="_blank">
            Prisma
          </s-link>
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Next steps">
        <s-unordered-list>
          <s-list-item>
            Build an{" "}
            <s-link
              href="https://shopify.dev/docs/apps/getting-started/build-app-example"
              target="_blank"
            >
              example app
            </s-link>
          </s-list-item>
          <s-list-item>
            Explore Shopify&apos;s API with{" "}
            <s-link
              href="https://shopify.dev/docs/apps/tools/graphiql-admin-api"
              target="_blank"
            >
              GraphiQL
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
