import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  SHOPIFYQL_MUTATION,
  REVENUE_TREND_QUERY,
  TOP_PRODUCTS_QUERY,
  TOP_PRODUCTS_PREV_QUERY,
  MARKET_GROWTH_QUERY,
  MARKET_GROWTH_PREV_QUERY,
  CUSTOMER_RATIO_QUERY,
  parseTableData,
} from "../utils/shopifyql-queries";
import { MetricCard } from "../components/analytics/MetricCard";
import { RevenueChart } from "../components/analytics/RevenueChart";
import { TopProductsTable } from "../components/analytics/TopProductsTable";
import { MarketGrowthTable } from "../components/analytics/MarketGrowthTable";
import { CustomerInsightChart } from "../components/analytics/CustomerInsightChart";
import { InsightAlerts } from "../components/analytics/InsightAlerts";

/**
 * Compute month-over-month delta for each row by joining on a key field.
 * Returns rows from `currRows` enriched with a `delta` percent field.
 */
function computeDeltas(currRows, prevRows, keyField, valueField) {
  const prevMap = new Map(
    prevRows.map((r) => [r[keyField], parseFloat(r[valueField] ?? 0)]),
  );
  return currRows.map((row) => {
    const curr = parseFloat(row[valueField] ?? 0);
    const prev = prevMap.get(row[keyField]) ?? 0;
    const delta = prev > 0 ? ((curr - prev) / prev) * 100 : null;
    return { ...row, delta };
  });
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  /**
   * Executes a ShopifyQL query and returns parsed rows + columns.
   * Falls back to empty result on any error so the page always renders.
   */
  const callQL = async (query) => {
    try {
      const res = await admin.graphql(SHOPIFYQL_MUTATION, {
        variables: { query },
      });
      const json = await res.json();
      if (json.errors || json.data?.shopifyqlQuery?.parseErrors?.length) {
        return { rows: [], columns: [], raw: json };
      }
      return { ...parseTableData(json.data), raw: json };
    } catch (err) {
      return { rows: [], columns: [], raw: { error: err.message } };
    }
  };

  // Fetch all data + unread insights in parallel
  // NOTE: CUSTOMER_RATIO_QUERY requires Level 2 Protected Customer Data approval
  // from Shopify Partner Dashboard — handled separately so it doesn't block others.
  const [
    revenueResult,
    productsResult,
    productsPrevResult,
    marketsResult,
    marketsPrevResult,
    insights,
  ] = await Promise.all([
    callQL(REVENUE_TREND_QUERY),
    callQL(TOP_PRODUCTS_QUERY),
    callQL(TOP_PRODUCTS_PREV_QUERY),
    callQL(MARKET_GROWTH_QUERY),
    callQL(MARKET_GROWTH_PREV_QUERY),
    prisma.insightAlert.findMany({
      where: { shop: session.shop, isRead: false },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  // Customer ratio — may fail if Level 2 customer data access not yet approved
  const customerResult = await callQL(CUSTOMER_RATIO_QUERY);

  // Enrich products and markets with delta %
  const topProducts = computeDeltas(
    productsResult.rows,
    productsPrevResult.rows,
    "product_title",
    "total_sales",
  );
  const topMarkets = computeDeltas(
    marketsResult.rows,
    marketsPrevResult.rows,
    "billing_address_country",
    "total_sales",
  );

  // Calculate summary metrics
  const totalRevenueCurr = productsResult.rows.reduce(
    (sum, r) => sum + parseFloat(r.total_sales ?? 0),
    0,
  );
  const totalRevenuePrev = productsPrevResult.rows.reduce(
    (sum, r) => sum + parseFloat(r.total_sales ?? 0),
    0,
  );
  const revenueGrowth =
    totalRevenuePrev > 0
      ? ((totalRevenueCurr - totalRevenuePrev) / totalRevenuePrev) * 100
      : null;

  const totalCustomers = customerResult.rows.reduce(
    (sum, r) => sum + parseInt(r.customer_count ?? 0, 10),
    0,
  );
  const newCustomers =
    customerResult.rows.find((r) => r.customer_type === "new");
  const newCustomerCount = parseInt(newCustomers?.customer_count ?? 0, 10);
  const newCustomerRatio =
    totalCustomers > 0 ? (newCustomerCount / totalCustomers) * 100 : null;

  return {
    revenueTrend: revenueResult.rows,
    topProducts,
    topMarkets,
    customerRatio: customerResult.rows,
    customerError: customerResult.rows.length === 0 && customerResult.raw?.error
      ? "Customer data requires Level 2 Protected Customer Data approval in Shopify Partner Dashboard."
      : null,
    insights: insights.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
    })),
    rawJson: {
      revenue_trend: revenueResult.raw,
      top_products_current: productsResult.raw,
      top_products_previous: productsPrevResult.raw,
      market_growth_current: marketsResult.raw,
      market_growth_previous: marketsPrevResult.raw,
      customer_ratio: customerResult.raw,
    },
    metrics: {
      totalRevenueCurr,
      totalRevenuePrev,
      revenueGrowth,
      totalCustomers,
      newCustomerCount,
      newCustomerRatio,
    },
  };
};

function RawJsonSection({ rawJson }) {
  return (
    <s-section heading="Raw ShopifyQL JSON Responses">
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {Object.entries(rawJson).map(([key, data]) => (
          <details
            key={key}
            style={{
              border: "1px solid #e1e3e5",
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            <summary
              style={{
                padding: "10px 16px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "13px",
                background: "#f6f6f7",
                userSelect: "none",
                color: "#202223",
                listStyle: "none",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "11px", opacity: 0.5 }}>▶</span>
              {key}
            </summary>
            <pre
              style={{
                margin: 0,
                padding: "16px",
                fontSize: "12px",
                lineHeight: 1.6,
                overflowX: "auto",
                background: "#1a1a2e",
                color: "#a8ff78",
                maxHeight: "400px",
                overflowY: "auto",
              }}
            >
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        ))}
      </div>
    </s-section>
  );
}

export default function AnalyticsPage() {
  const {
    revenueTrend,
    topProducts,
    topMarkets,
    customerRatio,
    customerError,
    insights,
    rawJson,
    metrics,
  } = useLoaderData();

  const fmtCurrency = (v) =>
    `$${v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <s-page heading="Analytics & Insights">
      {/* Weekly AI insights */}
      {insights.length > 0 && (
        <s-section heading="Insights">
          <InsightAlerts insights={insights} />
        </s-section>
      )}

      {/* Summary KPI cards */}
      <s-section heading="This Month at a Glance">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
          }}
        >
          <MetricCard
            title="Total Revenue (This Month)"
            formatted={fmtCurrency(metrics.totalRevenueCurr)}
            delta={metrics.revenueGrowth}
          />
          <MetricCard
            title="Total Revenue (Last Month)"
            formatted={fmtCurrency(metrics.totalRevenuePrev)}
          />
          <MetricCard
            title="Total Customers (30 Days)"
            formatted={metrics.totalCustomers.toLocaleString()}
          />
          <MetricCard
            title="New Customer Rate"
            formatted={
              metrics.newCustomerRatio !== null
                ? `${metrics.newCustomerRatio.toFixed(1)}%`
                : "—"
            }
          />
        </div>
      </s-section>

      {/* 12-month revenue trend */}
      <s-section heading="Revenue Trend — Last 12 Months">
        <RevenueChart data={revenueTrend} />
      </s-section>

      {/* Products and Markets side by side */}
      <s-section heading="Top Products — This Month vs Last Month">
        <TopProductsTable products={topProducts} />
      </s-section>

      <s-section heading="Top Markets — This Month vs Last Month">
        <MarketGrowthTable markets={topMarkets} />
      </s-section>

      {/* Customer breakdown */}
      <s-section heading="Customer Overview — Last 30 Days">
        {customerError ? (
          <s-banner tone="warning">
            <s-text>{customerError}</s-text>
          </s-banner>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "32px",
              alignItems: "start",
            }}
          >
            <CustomerInsightChart data={customerRatio} />
            <div>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px",
                }}
              >
                <tbody>
                  {customerRatio.map((row, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: "1px solid #f1f2f3", padding: "8px 0" }}
                    >
                      <td style={{ padding: "12px 0", color: "#202223" }}>
                        {row.customer_type === "new"
                          ? "New Customers"
                          : "Returning Customers"}
                      </td>
                      <td
                        style={{
                          padding: "12px 0",
                          textAlign: "right",
                          fontWeight: 700,
                          color: "#202223",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {parseInt(row.customer_count ?? 0, 10).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {customerRatio.length === 0 && (
                    <tr>
                      <td
                        colSpan={2}
                        style={{ padding: "16px 0", color: "#8c9196" }}
                      >
                        No customer data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </s-section>

      {/* Insights footer — show even if empty */}
      {insights.length === 0 && (
        <s-section heading="Insights">
          <InsightAlerts insights={[]} />
        </s-section>
      )}

      {/* Raw ShopifyQL JSON debug section */}
      <RawJsonSection rawJson={rawJson} />
    </s-page>
  );
}
