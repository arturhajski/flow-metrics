import React from 'react';

function daysColor(days) {
  if (days >= 10) return '#A32D2D';
  if (days >= 6) return '#854F0B';
  return '#3B6D11';
}

export default function LongestSitting({ longestSitting, cloudId }) {
  if (!longestSitting || longestSitting.length === 0) return null;

  const baseUrl = cloudId
    ? `https://${cloudId}.atlassian.net/browse`
    : 'https://arturhajski.atlassian.net/browse';

  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '16px 20px', border: '1px solid #f0f0f0' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', marginBottom: 14 }}>
        Longest sitting
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {longestSitting.map(issue => (
          <div key={issue.key} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 0', borderBottom: '1px solid #f0f0f0',
          }}>
            {/* Issue key */}
            <a
              href={`${baseUrl}/${issue.key}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12, color: '#378ADD', fontWeight: 500, whiteSpace: 'nowrap', textDecoration: 'none', minWidth: 70 }}
            >
              {issue.key}
            </a>

            {/* Summary */}
            <span style={{
              fontSize: 12, color: '#374151', flex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {issue.summary}
            </span>

            {/* Status badge */}
            <span style={{
              fontSize: 11, color: '#6b7280', background: '#e5e7eb',
              padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
            }}>
              {issue.statusName}
            </span>

            {/* Days */}
            <span style={{
              fontSize: 12, fontWeight: 500, color: daysColor(issue.daysInProgress),
              whiteSpace: 'nowrap', minWidth: 48, textAlign: 'right',
            }}>
              {issue.daysInProgress}d
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
