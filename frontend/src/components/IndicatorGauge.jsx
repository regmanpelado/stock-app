import React from 'react';

function GaugeBar({ value, min, max, low, high, label, format }) {
  if (value == null) return null;
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const inLow  = value <= low;
  const inHigh = value >= high;
  const color  = inLow ? '#4ade80' : inHigh ? '#f87171' : '#94a3b8';
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
        <span style={{ color: '#94a3b8' }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{format(value)}</span>
      </div>
      <div style={{ height: 6, background: '#334155', borderRadius: 3, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
        <div style={{ position: 'absolute', left: `${((low - min) / (max - min)) * 100}%`, top: -2, height: 10, width: 2, background: '#4ade8066' }} />
        <div style={{ position: 'absolute', left: `${((high - min) / (max - min)) * 100}%`, top: -2, height: 10, width: 2, background: '#f8717166' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#475569', marginTop: '0.2rem' }}>
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

export default function IndicatorGauge({ indicators }) {
  if (!indicators) return null;
  const { rsi, macd, bollinger } = indicators;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {rsi && <GaugeBar value={rsi.value} min={0} max={100} low={30} high={70} label="RSI (14)" format={v => v.toFixed(1)} />}
      {macd && (
        <div style={{ fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span style={{ color: '#94a3b8' }}>MACD</span>
            <span style={{ color: macd.histogram > 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>
              {macd.histogram != null ? (macd.histogram > 0 ? '+' : '') + macd.histogram.toFixed(4) : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', color: '#64748b', fontSize: '0.7rem' }}>
            <span>MACD: {macd.macd?.toFixed(4) ?? '—'}</span>
            <span>Señal: {macd.signal_line?.toFixed(4) ?? '—'}</span>
          </div>
        </div>
      )}
      {bollinger && bollinger.pct_b != null && (
        <GaugeBar value={bollinger.pct_b} min={0} max={100} low={0} high={100} label="Bollinger %B" format={v => v.toFixed(1) + '%'} />
      )}
    </div>
  );
}
