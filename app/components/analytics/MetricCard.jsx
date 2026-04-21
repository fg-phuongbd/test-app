/**
 * MetricCard — displays a single KPI with an optional month-over-month delta indicator.
 * @param {{ title: string, formatted: string, delta?: number|null }} props
 */
export function MetricCard({ title, formatted, delta }) {
  const hasDelta = delta !== null && delta !== undefined;
  const isPositive = hasDelta && delta >= 0;

  return (
    <div
      style={{
        padding: "16px 20px",
        border: "1px solid #e1e3e5",
        borderRadius: "8px",
        background: "#fff",
        minWidth: 0,
      }}
    >
      <p
        style={{
          margin: "0 0 4px",
          fontSize: "13px",
          color: "#6d7175",
          fontWeight: 500,
        }}
      >
        {title}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: "24px", fontWeight: 700, color: "#202223" }}>
          {formatted}
        </span>
        {hasDelta && (
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: isPositive ? "#008060" : "#d82c0d",
            }}
          >
            {isPositive ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
