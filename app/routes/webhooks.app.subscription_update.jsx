/**
 * Webhook handler for APP_SUBSCRIPTIONS_UPDATE
 * This webhook is triggered when subscription status changes
 */
export const action = async ({ request }) => {
  try {
    const webhookData = await request.json();

    console.log("APP_SUBSCRIPTIONS_UPDATE webhook received:", {
      topic: request.headers.get("X-Shopify-Topic"),
      shop: request.headers.get("X-Shopify-Shop-Domain"),
      subscriptionId: webhookData.app_subscription?.admin_graphql_api_id,
      status: webhookData.app_subscription?.status,
    });

    // TODO: Update subscription status in database
    // Example webhook payload structure:
    // {
    //   app_subscription: {
    //     admin_graphql_api_id: "gid://shopify/AppSubscription/123",
    //     name: "Plan: STARTER",
    //     status: "ACTIVE" | "CANCELLED" | "EXPIRED",
    //     created_at: "2024-01-01T00:00:00Z",
    //     updated_at: "2024-01-01T00:00:00Z",
    //     current_period_end: "2024-02-01T00:00:00Z",
    //   }
    // }

    return { success: true };
  } catch (error) {
    console.error("Error processing APP_SUBSCRIPTIONS_UPDATE webhook:", error);
    return { error: error.message };
  }
};
