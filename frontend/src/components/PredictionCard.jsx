import React from 'react';

const TREND_CFG = {
  alcista:    { color: '#4ade80', bg: '#14532d', icon: '↑', label: 'Alcista' },
  bajista:    { color: '#f87171', bg: '#450a0a', icon: '↓', label: 'Bajista' },
  lateral:    { color: '#f59e0b', bg: '#78350f', icon: '→', label: 'Lateral' },
  desconocido:{ color: '#64748b', bg: '#1e293b', icon: '?', label: 'Sin datos' },
};

function ConfidenceBar({ value }) {
  const color = value >= 70 ? '#4ade80' : value >= 45 ? '#f59e0b' : '#f87171';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 3 }}>
        <span style={{ color: '#64748b' }}>Confianza del modelo</span>
        <span style={{ color, fontWeight: 700 }}>{value?.toFixed(1)}%</span>
      </div>
      <div style={{ height: 5, background: '#334155', borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

function HorizonRow({ label, data, current }) {
  if (!data) return null;
  const diff = data.price - current;
  const pos  = diff >= 0;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.35rem 0', borderBottom: '1px solid #1e293b' }}>
      <span style={{ color: '#64748b', fontSize: '0.78rem', width: 36 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>${data.price?.toLocaleString()}</span>
      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: pos ? '#4ade80' : '#f87171' }}>
        {pos ? '+' : ''}{data.return_pct?.toFixed(3)}%
      </span>
    </div>
  );
}

export default function PredictionCard({ pred, loading }) {
  if (loading) return (
    <div className="card" style={{ minHeight: 180 }}>
      <div className="loading" style={{ paddingTop: '2rem' }}>Calculando predicción IA...</div>
    </div>
  );
  if (!pred || pred.error) return (
    <div className="card">
      <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
        {pred?.error || 'Sin datos de predicción'}
      </div>
    </div>
  );

  const tr = TREND_CFG[pred.tendencia] || TREND_CFG.desconocido;
  const h  = pred.horizontes || {};

  return (
    <div className="card" style={{ borderTop: `3px solid ${tr.color}` }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{pred.symbol}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'capitalize' }}>
            {pred.exchange} · {pred.timeframe}
          </div>
        </div>
        <span style={{ padding: '0.2rem 0.65rem', borderRadius: 6,
          background: tr.bg, color: tr.color, fontWeight: 700, fontSize: '0.8rem' }}>
          {tr.icon} {tr.label}
        </span>
      </div>

      {/* Precio actual */}
      <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>
        ${pred.precio_actual?.toLocaleString()}
      </div>

      {/* Confianza */}
      <div style={{ marginBottom: '0.875rem' }}>
        <ConfidenceBar value={pred.confianza} />
      </div>

      {/* Horizontes */}
      <div style={{ marginBottom: '0.875rem' }}>
        <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, marginBottom: '0.35rem' }}>
          PREDICCIONES
        </div>
        <HorizonRow label="1h"  data={h['1h']}  current={pred.precio_actual} />
        <HorizonRow label="4h"  data={h['4h']}  current={pred.precio_actual} />
        <HorizonRow label="8h"  data={h['8h']}  current={pred.precio_actual} />
        <HorizonRow label="24h" data={h['24h']} current={pred.precio_actual} />
      </div>

      {/* Soporte / Resistencia */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.875rem' }}>
        <div style={{ flex: 1, padding: '0.4rem 0.6rem', background: '#14532d22',
          border: '1px solid #22c55e33', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: '#4ade80' }}>SOPORTE</div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>${pred.soporte?.toLocaleString()}</div>
        </div>
        <div style={{ flex: 1, padding: '0.4rem 0.6rem', background: '#450a0a22',
          border: '1px solid #ef444433', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: '#f87171' }}>RESISTENCIA</div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>${pred.resistencia?.toLocaleString()}</div>
        </div>
      </div>

      {/* Top features */}
      {pred.features_top?.length > 0 && (
        <div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, marginBottom: '0.35rem' }}>
            FACTORES DETERMINANTES
          </div>
          {pred.features_top.map(f => (
            <div key={f.nombre} style={{ display: 'flex', justifyContent: 'space-between',
              fontSize: '0.75rem', padding: '0.2rem 0' }}>
              <span style={{ color: '#94a3b8' }}>{f.nombre}</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>{f.importancia}%</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '0.6rem', fontSize: '0.65rem', color: '#475569' }}>
        Modelo: {pred.modelo} · R²: {pred.r2_score}
      </div>
    </div>
  );
}
