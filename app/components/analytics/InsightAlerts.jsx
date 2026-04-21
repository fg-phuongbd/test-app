/**
 * InsightAlerts — renders a list of unread AI-generated insights/recommendations.
 * @param {{ insights: Array<{ id: string, title: string, description: string, severity: string, type: string }> }} props
 */
export function InsightAlerts({ insights }) {
  if (!insights || insights.length === 0) {
    return (
      <s-banner tone="info">
        <s-text>
          No new insights yet. Analytics are collected daily and insights are
          generated weekly by comparing month-over-month performance.
        </s-text>
      </s-banner>
    );
  }

  return (
    <s-stack direction="block" gap="base">
      {insights.map((insight) => {
        const tone =
          insight.severity === "warning"
            ? "warning"
            : insight.severity === "success"
              ? "success"
              : "info";

        return (
          <s-banner key={insight.id} tone={tone}>
            <s-stack direction="block" gap="tight">
              <strong style={{ fontSize: "14px", color: "#202223" }}>
                {insight.title}
              </strong>
              <s-text>{insight.description}</s-text>
            </s-stack>
          </s-banner>
        );
      })}
    </s-stack>
  );
}
