import React, { useRef, useEffect } from 'react';
import {
  Chart,
  LineElement, PointElement, LineController,
  CategoryScale, LinearScale,
  Filler, Tooltip,
} from 'chart.js';

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip);

const colors = {
  blue: '#378ADD',
  blueFill: 'rgba(55,138,221,0.08)',
  green: '#639922',
  gridLine: 'rgba(128,128,128,0.12)',
  textSecondary: '#6b7280',
};

export default function DailyWIPChart({ series, stats }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!series || !canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const labels = series.map(s => {
      const [, mm, dd] = s.date.split('-');
      return `${dd}/${mm}`;
    });
    const values = series.map(s => s.count);
    const avgLine = series.map(() => stats?.average ?? 0);
    const autoSkip = series.length > 14;

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'WIP',
            data: values,
            borderColor: colors.blue,
            backgroundColor: colors.blueFill,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#fff',
            pointBorderColor: colors.blue,
            pointBorderWidth: 2,
            borderWidth: 2,
          },
          {
            label: 'Average',
            data: avgLine,
            borderColor: colors.green,
            borderDash: [5, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            tension: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#fff',
            titleColor: '#1a1a1a',
            bodyColor: '#6b7280',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: colors.gridLine },
            ticks: {
              color: colors.textSecondary,
              font: { size: 11 },
              autoSkip,
              maxTicksLimit: 10,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: colors.gridLine },
            ticks: {
              color: colors.textSecondary,
              font: { size: 11 },
              stepSize: 1,
              precision: 0,
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [series, stats]);

  const trendIcon = stats?.trend === 'up' ? '↑' : stats?.trend === 'down' ? '↓' : '→';
  const trendColor = stats?.trend === 'up' ? '#E24B4A' : stats?.trend === 'down' ? '#639922' : '#6b7280';

  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '16px 20px', marginBottom: 24, border: '1px solid #f0f0f0' }}>
      {/* Custom legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>Daily WIP</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b7280' }}>
            <span style={{ display: 'inline-block', width: 12, height: 2, background: colors.blue, borderRadius: 1 }} />
            WIP
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b7280' }}>
            <span style={{ display: 'inline-block', width: 12, height: 1, background: colors.green, borderRadius: 1, borderTop: `1px dashed ${colors.green}` }} />
            Average
          </span>
          {stats?.trendDelta !== 0 && (
            <span style={{ fontSize: 11, color: trendColor, fontWeight: 500 }}>
              {trendIcon} {Math.abs(stats.trendDelta)} vs first half
            </span>
          )}
        </div>
      </div>

      <div style={{ height: 200, position: 'relative' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
