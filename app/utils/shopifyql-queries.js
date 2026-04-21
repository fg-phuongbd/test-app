/**
 * ShopifyQL Query definitions and utilities for the Analytics dashboard.
 * Requires the `read_reports` scope (API 2025-10+).
 *
 * Response shape (ShopifyqlQueryResponse):
 *   { tableData: { columns: [{name, displayName, dataType}], rows: [{ col: value, ... }] }, parseErrors: [] }
 */

// Named SHOPIFYQL_MUTATION for backwards-compat with import sites — it is actually a query.
export const SHOPIFYQL_MUTATION = `#graphql
  query ShopifyQLQuery($query: String!) {
    shopifyqlQuery(query: $query) {
      tableData {
        columns {
          name
          displayName
          dataType
        }
        rows
      }
      parseErrors
    }
  }
`;

// Revenue trend — last 12 months grouped by month
export const REVENUE_TREND_QUERY =
  "FROM sales SHOW total_sales TIMESERIES month SINCE -12m ORDER BY month";

// Top 10 products by revenue — current month
export const TOP_PRODUCTS_QUERY =
  "FROM sales SHOW total_sales BY product_title SINCE -1m ORDER BY total_sales DESC LIMIT 10";

// Top 10 products by revenue — previous month (for delta comparison)
export const TOP_PRODUCTS_PREV_QUERY =
  "FROM sales SHOW total_sales BY product_title SINCE -2m UNTIL -1m ORDER BY total_sales DESC LIMIT 10";

// Top 10 markets by revenue — current month
export const MARKET_GROWTH_QUERY =
  "FROM sales SHOW total_sales BY billing_address_country SINCE -1m ORDER BY total_sales DESC LIMIT 10";

// Top 10 markets by revenue — previous month (for delta comparison)
export const MARKET_GROWTH_PREV_QUERY =
  "FROM sales SHOW total_sales BY billing_address_country SINCE -2m UNTIL -1m ORDER BY total_sales DESC LIMIT 10";

// New vs returning customer counts — last 30 days
export const CUSTOMER_RATIO_QUERY =
  "FROM customers SHOW customer_count BY customer_type SINCE -30d";

/**
 * Parse a ShopifyQL table response into an array of row objects.
 * In API 2025-10, `rows` is already an array of plain objects keyed by column name.
 *
 * @param {object} shopifyqlData - The `data` field from the GraphQL response
 * @returns {{ rows: object[], columns: object[] }}
 */
export function parseTableData(shopifyqlData) {
  const tableData = shopifyqlData?.shopifyqlQuery?.tableData;
  if (!tableData) return { rows: [], columns: [] };

  const { rows = [], columns = [] } = tableData;
  return { rows, columns };
}
