import React from 'react';

function generateInsights(stats, statusBreakdown) {
  const insights = [];

  if (!stats) return insights;

  // 1. Average WIP comment
  if (stats.average > 0) {
    const comment = stats.average > 10
      ? 'High WIP can slow delivery. Consider limiting work in progress (Little\'s Law: more WIP = longer cycle times).'
      : stats.average > 5
      ? 'WIP is moderate. Keep an eye on bottlenecks to maintain flow.'
      : 'WIP is low — great for focus. Make sure the team isn\'t under-utilized.';
    insights.push({
      icon: '📊',
      text: `Average WIP is ${stats.average}. ${comment}`,
    });
  }

  // 2. Process stability
  const stabilityComments = {
    High: `Process stability is High (CV = ${stats.cv}). Work is flowing consistently — good predictability.`,
    Medium: `Process stability is Medium (CV = ${stats.cv}). Some variability in WIP. Look for recurring blockers.`,
    Low: `Process stability is Low (CV = ${stats.cv}). WIP fluctuates a lot. This makes delivery unpredictable.`,
  };
  insights.push({
    icon: stats.stabilityLabel === 'High' ? '✅' : stats.stabilityLabel === 'Medium' ? '⚡' : '⚠️',
    text: stabilityComments[stats.stabilityLabel],
  });

  // 3. Status with most issues
  if (statusBreakdown && statusBreakdown.length > 0) {
    const top = statusBreakdown[0];
    const total = statusBreakdown.reduce((sum, s) => sum + s.count, 0);
    const pct = total > 0 ? Math.round((top.count / total) * 100) : 0;
    if (pct > 50) {
      insights.push({
        icon: '🔍',
        text: `"${top.statusName}" holds ${pct}% of in-progress work (${top.count} issues). This may indicate a bottleneck.`,
      });
    } else {
      insights.push({
        icon: '🔍',
        text: `Work is spread across ${statusBreakdown.length} statuses. "${top.statusName}" has the most items (${top.count}).`,
      });
    }
  }

  return insights;
}

export default function InsightsPanel({ stats, statusBreakdown }) {
  const insights = generateInsights(stats, statusBreakdown);
  if (!insights.length) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', marginBottom: 10 }}>
        Insights
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {insights.map((insight, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            background: '#f9fafb', borderRadius: 8, padding: '10px 14px',
            border: '1px solid #f0f0f0', fontSize: 12, color: '#374151', lineHeight: 1.5,
          }}>
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{insight.icon}</span>
            <span>{insight.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
