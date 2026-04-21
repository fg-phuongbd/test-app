import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

/**
 * Prevents server-side rendering of chart (Recharts depends on browser APIs).
 */
function ClientOnly({ children, fallbackHeight = 300 }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? (
    children
  ) : (
    <div
      style={{
        height: fallbackHeight,
        background: "#f6f6f7",
        borderRadius: "6px",
      }}
    />
  );
}

/**
 * RevenueChart — line chart showing revenue trend over the last 12 months.
 * @param {{ data: Array<{ month: string, revenue: string, month_display?: string }> }} props
 */
export function RevenueChart({ data }) {
  const chartData = data.map((row) => ({
    label: row.month_display || row.month || "",
    revenue: parseFloat(row.revenue ?? 0),
  }));

  if (chartData.length === 0) {
    return (
      <div
        style={{
          height: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#8c9196",
          background: "#f6f6f7",
          borderRadius: "6px",
        }}
      >
        No revenue data available
      </div>
    );
  }

  return (
    <ClientOnly>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e1e3e5" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "#6d7175" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) =>
              v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
            }
            tick={{ fontSize: 12, fill: "#6d7175" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v) => [`$${Number(v).toLocaleString()}`, "Revenue"]}
            contentStyle={{
              border: "1px solid #e1e3e5",
              borderRadius: "6px",
              fontSize: "13px",
            }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#008060"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#008060" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ClientOnly>
  );
}
