import React from 'react';

function KPICard({ label, value, sub, subColor }) {
  return (
    <div style={{
      background: '#f9fafb', borderRadius: 8, padding: '14px 16px',
      border: '1px solid #f0f0f0',
    }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 500, color: '#1a1a1a', lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: subColor || '#6b7280' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default function KPICards({ stats, series, days }) {
  if (!stats || !series) return null;

  // WIP today = last value in series
  const todayCount = series.length > 0 ? series[series.length - 1].count : 0;

  // Delta vs average of previous period
  const prevPeriodValues = series.slice(0, Math.max(1, Math.floor(series.length / 2))).map(s => s.count);
  const prevAvg = prevPeriodValues.length
    ? prevPeriodValues.reduce((a, b) => a + b, 0) / prevPeriodValues.length
    : 0;
  const delta = todayCount - Math.round(prevAvg);
  const deltaLabel = delta === 0 ? '—' : delta > 0 ? `↑ ${delta} vs prev period` : `↓ ${Math.abs(delta)} vs prev period`;
  const deltaColor = delta > 0 ? '#E24B4A' : delta < 0 ? '#639922' : '#6b7280';

  const stabilityColors = { High: '#639922', Medium: '#EF9F27', Low: '#E24B4A' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
      <KPICard
        label="WIP today"
        value={todayCount}
        sub={deltaLabel}
        subColor={deltaColor}
      />
      <KPICard
        label={`Avg WIP (${days}d)`}
        value={stats.average}
        sub="arithmetic mean"
      />
      <KPICard
        label="P90 WIP"
        value={stats.p90}
        sub="10% of days exceeded this"
      />
      <KPICard
        label="Process stability"
        value={stats.stabilityLabel}
        sub={`CV = ${stats.cv}`}
        subColor={stabilityColors[stats.stabilityLabel]}
      />
    </div>
  );
}
