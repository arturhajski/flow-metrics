import React from 'react';

const RANGES = [
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
];

export default function Header({ projectKey, lastSyncedAt, days, onDaysChange, issueTypes, issueTypeFilter, onIssueTypeFilterChange }) {
  const syncLabel = lastSyncedAt
    ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : null;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>WIP Analytics</span>
          {projectKey && (
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{projectKey}</span>
          )}
        </div>
        {syncLabel && (
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{syncLabel}</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Issue type filter */}
        {issueTypes && issueTypes.length > 0 && (
          <select
            value={issueTypeFilter}
            onChange={e => onIssueTypeFilterChange(e.target.value)}
            style={{
              fontSize: 12, padding: '5px 10px', borderRadius: 6,
              border: '1px solid #d1d5db', color: '#374151',
              background: '#fff', cursor: 'pointer',
            }}
          >
            <option value="all">All types</option>
            {issueTypes.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}

        {/* Date range segmented control */}
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3, gap: 2 }}>
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => onDaysChange(r.value)}
              style={{
                padding: '4px 12px', fontSize: 12, fontWeight: 500,
                borderRadius: 6, border: 'none', cursor: 'pointer',
                background: days === r.value ? '#fff' : 'transparent',
                color: days === r.value ? '#1a1a1a' : '#6b7280',
                boxShadow: days === r.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
