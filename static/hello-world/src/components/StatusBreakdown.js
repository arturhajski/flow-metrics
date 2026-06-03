import React from 'react';

const STATUS_COLORS = ['#378ADD', '#7F77DD', '#1D9E75', '#EF9F27', '#E24B4A', '#D4537E'];

export default function StatusBreakdown({ statusBreakdown }) {
  if (!statusBreakdown || statusBreakdown.length === 0) return null;

  const sorted = [...statusBreakdown].sort((a, b) => a.statusName.localeCompare(b.statusName));
  const total = sorted.reduce((sum, s) => sum + s.count, 0);

  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '16px 20px', border: '1px solid #f0f0f0' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', marginBottom: 14 }}>
        Status breakdown
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((s, i) => {
          const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
          const color = STATUS_COLORS[i % STATUS_COLORS.length];
          return (
            <div key={s.statusId}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{s.statusName}</span>
                <span style={{ fontSize: 12, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                  {s.count} <span style={{ color: '#9ca3af' }}>({pct}%)</span>
                </span>
              </div>
              <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`, background: color,
                  borderRadius: 4, transition: 'width 0.4s ease',
                  minWidth: s.count > 0 ? 4 : 0,
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
