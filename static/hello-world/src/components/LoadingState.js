import React from 'react';

const pulse = `
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;

function Skeleton({ width = '100%', height = 16, borderRadius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius,
      background: '#e5e7eb',
      animation: 'pulse 1.5s ease-in-out infinite',
      ...style,
    }} />
  );
}

export default function LoadingState() {
  return (
    <>
      <style>{pulse}</style>
      <div style={{ padding: '16px 0' }}>
        {/* Header skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Skeleton width={160} height={22} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Skeleton width={40} height={28} borderRadius={6} />
            <Skeleton width={40} height={28} borderRadius={6} />
            <Skeleton width={40} height={28} borderRadius={6} />
          </div>
        </div>

        {/* KPI cards skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ background: '#f9fafb', borderRadius: 8, padding: '14px 16px' }}>
              <Skeleton width={80} height={12} style={{ marginBottom: 10 }} />
              <Skeleton width={50} height={26} style={{ marginBottom: 6 }} />
              <Skeleton width={60} height={11} />
            </div>
          ))}
        </div>

        {/* Chart skeleton */}
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <Skeleton width={120} height={14} style={{ marginBottom: 16 }} />
          <Skeleton width="100%" height={200} borderRadius={6} />
        </div>

        {/* Bottom row skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16 }}>
            <Skeleton width={100} height={14} style={{ marginBottom: 14 }} />
            {[0, 1, 2].map(i => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Skeleton width={80} height={11} />
                  <Skeleton width={20} height={11} />
                </div>
                <Skeleton width="100%" height={8} borderRadius={4} />
              </div>
            ))}
          </div>
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16 }}>
            <Skeleton width={120} height={14} style={{ marginBottom: 14 }} />
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center' }}>
                <Skeleton width={60} height={12} />
                <Skeleton width={140} height={12} />
                <Skeleton width={30} height={12} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
