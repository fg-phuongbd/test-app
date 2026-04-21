import cron from "node-cron";
import prisma from "../db.server.js";
import {
  SHOPIFYQL_MUTATION,
  REVENUE_TREND_QUERY,
  TOP_PRODUCTS_QUERY,
  TOP_PRODUCTS_PREV_QUERY,
  MARKET_GROWTH_QUERY,
  MARKET_GROWTH_PREV_QUERY,
  CUSTOMER_RATIO_QUERY,
  parseTableData,
} from "../utils/shopifyql-queries.js";

const SHOPIFY_API_VERSION = "2025-10";

/**
 * Execute a ShopifyQL query via raw fetch using an offline access token.
 * Used by cron jobs where there is no active HTTP request context.
 */
async function callShopifyQL(shop, accessToken, query) {
  const res = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: SHOPIFYQL_MUTATION,
        variables: { query },
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for shop ${shop}`);
  }

  const json = await res.json();
  return parseTableData(json.data);
}

async function saveSnapshot(shop, type, data) {
  await prisma.analyticsSnapshot.create({
    data: {
      id: crypto.randomUUID(),
      shop,
      type,
      data: JSON.stringify(data),
    },
  });
}

/**
 * Daily job (00:00): collect analytics snapshots for all installed shops.
 * Uses offline sessions stored in the DB so no user action is required.
 */
export async function runDailyAnalytics() {
  console.log("[AnalyticsCron] Running daily analytics collection...");

  const sessions = await prisma.session.findMany({
    where: { isOnline: false },
    select: { shop: true, accessToken: true },
  });

  // Deduplicate by shop — keep the first offline token found
  const uniqueShops = new Map();
  for (const s of sessions) {
    if (!uniqueShops.has(s.shop)) {
      uniqueShops.set(s.shop, s.accessToken);
    }
  }

  for (const [shop, accessToken] of uniqueShops) {
    try {
      const [revenueData, productsData, marketData, customerData] =
        await Promise.all([
          callShopifyQL(shop, accessToken, REVENUE_TREND_QUERY),
          callShopifyQL(shop, accessToken, TOP_PRODUCTS_QUERY),
          callShopifyQL(shop, accessToken, MARKET_GROWTH_QUERY),
          callShopifyQL(shop, accessToken, CUSTOMER_RATIO_QUERY),
        ]);

      await Promise.all([
        saveSnapshot(shop, "revenue_trend", revenueData),
        saveSnapshot(shop, "top_products", productsData),
        saveSnapshot(shop, "market_growth", marketData),
        saveSnapshot(shop, "customer_ratio", customerData),
      ]);

      console.log(`[AnalyticsCron] Saved snapshots for ${shop}`);
    } catch (err) {
      console.error(`[AnalyticsCron] Error collecting for ${shop}:`, err.message);
    }
  }
}

/**
 * Weekly job (Sunday 01:00): generate insights by comparing current vs previous month.
 * Writes InsightAlert rows for significant changes (±20% products, +15% markets).
 */
export async function runWeeklyInsights() {
  console.log("[AnalyticsCron] Running weekly insights generation...");

  const sessions = await prisma.session.findMany({
    where: { isOnline: false },
    select: { shop: true, accessToken: true },
  });

  const uniqueShops = new Map();
  for (const s of sessions) {
    if (!uniqueShops.has(s.shop)) {
      uniqueShops.set(s.shop, s.accessToken);
    }
  }

  for (const [shop, accessToken] of uniqueShops) {
    try {
      const [currProducts, prevProducts, currMarkets, prevMarkets] =
        await Promise.all([
          callShopifyQL(shop, accessToken, TOP_PRODUCTS_QUERY),
          callShopifyQL(shop, accessToken, TOP_PRODUCTS_PREV_QUERY),
          callShopifyQL(shop, accessToken, MARKET_GROWTH_QUERY),
          callShopifyQL(shop, accessToken, MARKET_GROWTH_PREV_QUERY),
        ]);

      const prevProductMap = new Map(
        prevProducts.rows.map((r) => [
          r.product_title,
          parseFloat(r.total_sales ?? 0),
        ]),
      );
      const prevMarketMap = new Map(
        prevMarkets.rows.map((r) => [r.billing_address_country, parseFloat(r.total_sales ?? 0)]),
      );

      const insights = [];

      // Product growth / decline alerts (threshold: ±20%)
      for (const row of currProducts.rows) {
        const curr = parseFloat(row.total_sales ?? 0);
        const prev = prevProductMap.get(row.product_title) ?? 0;
        if (prev > 0 && curr > 0) {
          const delta = ((curr - prev) / prev) * 100;
          if (delta >= 20) {
            insights.push({
              shop,
              type: "top_product",
              title: `${row.product_title} up ${delta.toFixed(0)}%`,
              description: `Revenue rose from $${prev.toFixed(2)} to $${curr.toFixed(2)} month-over-month.`,
              severity: "success",
              data: JSON.stringify({
                product: row.product_title,
                delta,
                curr,
                prev,
              }),
            });
          } else if (delta <= -20) {
            insights.push({
              shop,
              type: "top_product",
              title: `${row.product_title} down ${Math.abs(delta).toFixed(0)}%`,
              description: `Revenue fell from $${prev.toFixed(2)} to $${curr.toFixed(2)} month-over-month.`,
              severity: "warning",
              data: JSON.stringify({
                product: row.product_title,
                delta,
                curr,
                prev,
              }),
            });
          }
        }
      }

      // Market growth alerts (threshold: +15%)
      for (const row of currMarkets.rows) {
        const curr = parseFloat(row.total_sales ?? 0);
        const prev = prevMarketMap.get(row.billing_address_country) ?? 0;
        if (prev > 0 && curr > 0) {
          const delta = ((curr - prev) / prev) * 100;
          if (delta >= 15) {
            insights.push({
              shop,
              type: "market_growth",
              title: `${row.billing_address_country} growing +${delta.toFixed(0)}%`,
              description: `Market revenue rose from $${prev.toFixed(2)} to $${curr.toFixed(2)}.`,
              severity: "success",
              data: JSON.stringify({ country: row.billing_address_country, delta, curr, prev }),
            });
          }
        }
      }

      if (insights.length > 0) {
        await prisma.insightAlert.createMany({
          data: insights.map((i) => ({ id: crypto.randomUUID(), ...i })),
        });
        console.log(
          `[AnalyticsCron] Created ${insights.length} insights for ${shop}`,
        );
      } else {
        console.log(`[AnalyticsCron] No new insights for ${shop}`);
      }
    } catch (err) {
      console.error(
        `[AnalyticsCron] Insights error for ${shop}:`,
        err.message,
      );
    }
  }
}

// Guard against re-initialization on Vite HMR reloads in development
if (!global.__analyticsCronInitialized) {
  global.__analyticsCronInitialized = true;

  // Run every day at midnight
  cron.schedule("0 0 * * *", runDailyAnalytics);

  // Run every Sunday at 01:00 to generate weekly insights
  cron.schedule("0 1 * * 0", runWeeklyInsights);

  console.log("[AnalyticsCron] Analytics cron jobs scheduled");
}
