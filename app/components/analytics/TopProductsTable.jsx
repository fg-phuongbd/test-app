/**
 * TopProductsTable — ranked table of products by revenue with month-over-month delta.
 * @param {{ products: Array<{ product_title: string, revenue: string, revenue_display?: string, delta: number|null }> }} props
 */
export function TopProductsTable({ products }) {
  if (!products || products.length === 0) {
    return (
      <p style={{ color: "#8c9196", textAlign: "center", padding: "24px 0" }}>
        No product data available for this period.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "14px",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "2px solid #e1e3e5" }}>
            <th
              style={{
                textAlign: "left",
                padding: "10px 8px",
                fontWeight: 600,
                color: "#202223",
              }}
            >
              #
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "10px 8px",
                fontWeight: 600,
                color: "#202223",
              }}
            >
              Product
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "10px 8px",
                fontWeight: 600,
                color: "#202223",
              }}
            >
              Revenue (This Month)
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "10px 8px",
                fontWeight: 600,
                color: "#202223",
              }}
            >
              vs Last Month
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => {
            const hasDelta = p.delta !== null && p.delta !== undefined;
            const isPositive = hasDelta && p.delta >= 0;
            return (
              <tr
                key={i}
                style={{
                  borderBottom: "1px solid #f1f2f3",
                  background: i % 2 === 0 ? "#fff" : "#fafafa",
                }}
              >
                <td
                  style={{ padding: "10px 8px", color: "#6d7175", width: 32 }}
                >
                  {i + 1}
                </td>
                <td style={{ padding: "10px 8px", color: "#202223" }}>
                  {p.product_title ?? "—"}
                </td>
                <td
                  style={{
                    padding: "10px 8px",
                    textAlign: "right",
                    color: "#202223",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {p.total_sales_display ||
                    `$${parseFloat(p.total_sales ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                </td>
                <td
                  style={{
                    padding: "10px 8px",
                    textAlign: "right",
                    fontWeight: 600,
                    color: hasDelta
                      ? isPositive
                        ? "#008060"
                        : "#d82c0d"
                      : "#8c9196",
                  }}
                >
                  {hasDelta
                    ? `${isPositive ? "+" : ""}${p.delta.toFixed(1)}%`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
