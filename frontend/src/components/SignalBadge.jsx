import React from 'react';

const CONFIG = {
  buy:     { label: 'COMPRA',  bg: '#14532d', color: '#4ade80', dot: '#22c55e' },
  sell:    { label: 'VENTA',   bg: '#450a0a', color: '#f87171', dot: '#ef4444' },
  neutral: { label: 'NEUTRO', bg: '#1e293b', color: '#94a3b8', dot: '#64748b' },
  error:   { label: 'ERROR',  bg: '#1c1917', color: '#78716c', dot: '#57534e' },
};

export default function SignalBadge({ signal, size = 'md' }) {
  const cfg = CONFIG[signal] || CONFIG.neutral;
  const pad = size === 'sm' ? '0.15rem 0.5rem' : '0.25rem 0.75rem';
  const fs  = size === 'sm' ? '0.7rem' : '0.75rem';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      padding: pad, borderRadius: '4px',
      background: cfg.bg, color: cfg.color,
      fontSize: fs, fontWeight: 700, letterSpacing: '0.05em',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}
