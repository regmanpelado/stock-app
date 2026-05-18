import React from 'react';

const TYPE_STYLE = {
  danger:  { border: '#ef4444', bg: '#450a0a22', icon: '🔴' },
  warning: { border: '#f59e0b', bg: '#78350f22', icon: '🟡' },
  buy:     { border: '#22c55e', bg: '#14532d22', icon: '🟢' },
  sell:    { border: '#f87171', bg: '#45090922', icon: '🔻' },
  info:    { border: '#38bdf8', bg: '#0c4a6e22', icon: '🔵' },
};

export default function AlertBanner({ alerts }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {alerts.map((a, i) => {
        const s = TYPE_STYLE[a.type] || TYPE_STYLE.info;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.5rem 0.875rem',
            borderLeft: `3px solid ${s.border}`,
            background: s.bg,
            borderRadius: '0 6px 6px 0',
            fontSize: '0.82rem', color: '#e2e8f0',
          }}>
            <span style={{ flexShrink: 0 }}>{s.icon}</span>
            {a.message}
          </div>
        );
      })}
    </div>
  );
}
