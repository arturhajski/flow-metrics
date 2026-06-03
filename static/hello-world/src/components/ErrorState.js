import React from 'react';

const MESSAGES = {
  permission: {
    title: 'Access denied',
    detail: 'You don\'t have permission to view this project\'s data.',
  },
  empty: {
    title: 'No issues found',
    detail: 'No in-progress issues found. Start working on some tasks!',
  },
  default: {
    title: 'Something went wrong',
    detail: 'Could not load WIP data. Please try again.',
  },
};

function classifyError(message = '') {
  const m = message.toLowerCase();
  if (m.includes('403') || m.includes('permission') || m.includes('unauthorized')) return 'permission';
  if (m.includes('no in-progress') || m.includes('empty')) return 'empty';
  return 'default';
}

export default function ErrorState({ message, onRetry }) {
  const kind = classifyError(message);
  const { title, detail } = MESSAGES[kind];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>
        {kind === 'permission' ? '🔒' : kind === 'empty' ? '📭' : '⚠️'}
      </div>
      <div style={{ fontSize: 16, fontWeight: 500, color: '#1a1a1a', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24, maxWidth: 320 }}>
        {detail}
      </div>
      {message && kind === 'default' && (
        <div style={{
          fontSize: 11, color: '#9ca3af', marginBottom: 20,
          fontFamily: 'monospace', background: '#f3f4f6',
          padding: '6px 12px', borderRadius: 4, maxWidth: 400,
        }}>
          {message}
        </div>
      )}
      {kind !== 'empty' && onRetry && (
        <button onClick={onRetry} style={{
          padding: '8px 20px', fontSize: 13, fontWeight: 500,
          background: '#378ADD', color: '#fff', border: 'none',
          borderRadius: 6, cursor: 'pointer',
        }}>
          Retry
        </button>
      )}
    </div>
  );
}
