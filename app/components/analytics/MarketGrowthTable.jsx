/**
 * MarketGrowthTable — ranked table of markets/countries by revenue with delta.
 * @param {{ markets: Array<{ country: string, revenue: string, revenue_display?: string, delta: number|null }> }} props
 */
export function MarketGrowthTable({ markets }) {
  if (!markets || markets.length === 0) {
    return (
      <p style={{ color: "#8c9196", textAlign: "center", padding: "24px 0" }}>
        No market data available for this period.
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
              Country / Market
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
          {markets.map((m, i) => {
            const hasDelta = m.delta !== null && m.delta !== undefined;
            const isPositive = hasDelta && m.delta >= 0;
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
                  {m.billing_address_country || "Unknown"}
                </td>
                <td
                  style={{
                    padding: "10px 8px",
                    textAlign: "right",
                    color: "#202223",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {m.total_sales_display ||
                    `$${parseFloat(m.total_sales ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
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
                    ? `${isPositive ? "+" : ""}${m.delta.toFixed(1)}%`
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
