import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const TYPE_COLORS = {
  new: "#008060",
  returning: "#5c6ac4",
};

const TYPE_LABELS = {
  new: "New Customers",
  returning: "Returning Customers",
};

/**
 * Prevents server-side rendering of chart (Recharts depends on browser APIs).
 */
function ClientOnly({ children, fallbackHeight = 260 }) {
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
 * CustomerInsightChart — donut chart showing new vs returning customer split.
 * @param {{ data: Array<{ customer_type: string, count: string }> }} props
 */
export function CustomerInsightChart({ data }) {
  const chartData = (data || [])
    .map((row) => ({
      name: TYPE_LABELS[row.customer_type] || row.customer_type,
      value: parseInt(row.customer_count ?? 0, 10),
      type: row.customer_type,
    }))
    .filter((d) => d.value > 0);

  if (chartData.length === 0) {
    return (
      <div
        style={{
          height: 260,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#8c9196",
          background: "#f6f6f7",
          borderRadius: "6px",
        }}
      >
        No customer data available
      </div>
    );
  }

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <ClientOnly>
      <div>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={95}
              dataKey="value"
              paddingAngle={3}
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={TYPE_COLORS[entry.type] || "#8884d8"}
                  stroke="none"
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => [
                `${v.toLocaleString()} (${((v / total) * 100).toFixed(1)}%)`,
                "",
              ]}
              contentStyle={{
                border: "1px solid #e1e3e5",
                borderRadius: "6px",
                fontSize: "13px",
              }}
            />
            <Legend
              iconType="circle"
              iconSize={10}
              formatter={(value) => (
                <span style={{ fontSize: "13px", color: "#202223" }}>
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ClientOnly>
  );
}
