import React, { useState, useCallback } from 'react';
import { useFetch } from '../hooks/useExchange.jsx';
import { signalsApi, predictionsApi } from '../services/api.jsx';
import SignalBadge from '../components/SignalBadge.jsx';
import AlertBanner from '../components/AlertBanner.jsx';
import IndicatorGauge from '../components/IndicatorGauge.jsx';
import PredictionCard from '../components/PredictionCard.jsx';

const EXCHANGES = ['binance', 'coinbase', 'kraken', 'gateio'];
const TIMEFRAMES = ['15m', '1h', '4h', '1d'];
const SIGNAL_FILTERS = ['all', 'buy', 'sell', 'neutral'];

function ScreenerRow({ row, onSelect, selected }) {
  const isSelected = selected?.symbol === row.symbol && selected?.exchange === row.exchange;
  return (
    <tr
      onClick={() => onSelect(row)}
      style={{ cursor: 'pointer', background: isSelected ? '#0f2d44' : undefined }}
    >
      <td style={{ fontWeight: 600 }}>{row.symbol}</td>
      <td style={{ textTransform: 'capitalize', color: 'var(--td)', fontSize: '0.8rem' }}>{row.exchange}</td>
      <td>${row.price?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? '—'}</td>
      <td><SignalBadge signal={row.signal} size="sm" /></td>
      <td>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <SignalBadge signal={row.indicators?.rsi?.signal ?? 'neutral'} size="sm" />
          <span style={{ color: 'var(--td)', fontSize: '0.75rem', alignSelf: 'center' }}>
            {row.indicators?.rsi?.value != null ? row.indicators.rsi.value.toFixed(1) : '—'}
          </span>
        </div>
      </td>
      <td><SignalBadge signal={row.indicators?.macd?.signal ?? 'neutral'} size="sm" /></td>
      <td><SignalBadge signal={row.indicators?.bollinger?.signal ?? 'neutral'} size="sm" /></td>
      <td style={{ color: 'var(--td)', fontSize: '0.75rem' }}>
        {row.alerts?.length > 0 ? `${row.alerts.length} alerta${row.alerts.length > 1 ? 's' : ''}` : '—'}
      </td>
    </tr>
  );
}

function DetailPanel({ row, onClose }) {
  if (!row) return null;
  return (
    <div className="card" style={{ position: 'sticky', top: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{row.symbol}</div>
          <div style={{ color: 'var(--td)', fontSize: '0.8rem', textTransform: 'capitalize' }}>{row.exchange}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <SignalBadge signal={row.signal} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--td)', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
      </div>

      <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
        ${row.price?.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? '—'}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--td)', marginBottom: '0.5rem', fontWeight: 600 }}>INDICADORES</div>
        <IndicatorGauge indicators={row.indicators} />
      </div>

      {row.indicators?.bollinger && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg)', borderRadius: 6 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--td)', marginBottom: '0.4rem', fontWeight: 600 }}>BANDAS DE BOLLINGER</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#f87171' }}>Superior</div>
              <div style={{ fontWeight: 600 }}>{row.indicators.bollinger.upper?.toFixed(2) ?? '—'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--ts)' }}>Media</div>
              <div style={{ fontWeight: 600 }}>{row.indicators.bollinger.middle?.toFixed(2) ?? '—'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#4ade80' }}>Inferior</div>
              <div style={{ fontWeight: 600 }}>{row.indicators.bollinger.lower?.toFixed(2) ?? '—'}</div>
            </div>
          </div>
        </div>
      )}

      {row.alerts?.length > 0 && (
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--td)', marginBottom: '0.5rem', fontWeight: 600 }}>ALERTAS ACTIVAS</div>
          <AlertBanner alerts={row.alerts} />
        </div>
      )}
    </div>
  );
}

export default function Signals() {
  const [exchange, setExchange] = useState('binance');
  const [timeframe, setTimeframe] = useState('1h');
  const [signalFilter, setSignalFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const fetchScreener = useCallback(
    () => signalsApi.getScreener(exchange, timeframe),
    [exchange, timeframe]
  );
  const { data: screener, loading, error, reload } = useFetch(fetchScreener, [exchange, timeframe]);

  const fetchAlerts = useCallback(() => signalsApi.getAllAlerts(timeframe), [timeframe]);
  const { data: globalAlerts } = useFetch(fetchAlerts, [timeframe]);

  const fetchPreds = useCallback(() => predictionsApi.getBTC(timeframe), [timeframe]);
  const { data: btcPreds, loading: predsLoading } = useFetch(fetchPreds, [timeframe]);

  const rows = Array.isArray(screener) ? screener : [];
  const filtered = rows.filter(r => {
    const matchSignal = signalFilter === 'all' || r.signal === signalFilter;
    const matchSearch = r.symbol.toLowerCase().includes(search.toLowerCase());
    return matchSignal && matchSearch;
  });

  const buyCount  = rows.filter(r => r.signal === 'buy').length;
  const sellCount = rows.filter(r => r.signal === 'sell').length;
  const neutCount = rows.filter(r => r.signal === 'neutral').length;

  return (
    <div>
      <h1 className="page-title">Señales Técnicas</h1>

      {/* ── Predicciones IA ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.875rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem',
            borderRadius: 4, background: '#a78bfa22', color: '#a78bfa', border: '1px solid #a78bfa44' }}>
            IA PRO+
          </span>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--tx)' }}>
            Predicciones BTC — Modelo GBR (LSTM-style)
          </span>
          {predsLoading && <span style={{ fontSize: '0.75rem', color: 'var(--td)' }}>calculando...</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {predsLoading
            ? [1, 2, 3].map(i => <PredictionCard key={i} loading />)
            : Array.isArray(btcPreds)
              ? btcPreds.map((p, i) => <PredictionCard key={i} pred={p} />)
              : null}
        </div>
      </div>

      {/* Alertas globales */}
      {globalAlerts?.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600, marginBottom: '0.5rem' }}>
            ALERTAS ACTIVAS ({globalAlerts.length})
          </div>
          <AlertBanner alerts={globalAlerts.slice(0, 6)} />
        </div>
      )}

      {/* Controles */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-select" style={{ width: 140 }} value={exchange} onChange={e => { setExchange(e.target.value); setSelected(null); }}>
          {EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </select>
        <select className="form-select" style={{ width: 90 }} value={timeframe} onChange={e => setTimeframe(e.target.value)}>
          {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
        </select>
        <input
          className="form-input"
          style={{ flex: 1, minWidth: 160 }}
          placeholder="Buscar par..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {SIGNAL_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setSignalFilter(f)}
              className="btn"
              style={{
                background: signalFilter === f ? '#0284c7' : 'var(--su)',
                color: signalFilter === f ? 'white' : 'var(--ts)',
                border: '1px solid #334155',
                padding: '0.4rem 0.85rem',
                fontSize: '0.8rem',
                textTransform: 'capitalize',
              }}
            >
              {f === 'all' ? 'Todos' : f === 'buy' ? 'Compra' : f === 'sell' ? 'Venta' : 'Neutro'}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={reload}>Actualizar</button>
      </div>

      {/* Resumen de señales */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Compra', count: buyCount,  color: '#4ade80', bg: '#14532d' },
            { label: 'Venta',  count: sellCount, color: '#f87171', bg: '#450a0a' },
            { label: 'Neutro', count: neutCount, color: 'var(--ts)', bg: 'var(--su)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ flex: 1, textAlign: 'center', background: s.bg, border: `1px solid ${s.color}33`, cursor: 'pointer' }}
              onClick={() => setSignalFilter(signalFilter === s.label.toLowerCase() ? 'all' : s.label.toLowerCase())}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: '0.75rem', color: s.color }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <p className="loading">Calculando señales...</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: '1rem', alignItems: 'start' }}>
          {/* Screener table */}
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Par</th>
                  <th>Exchange</th>
                  <th>Precio</th>
                  <th>Señal</th>
                  <th>RSI</th>
                  <th>MACD</th>
                  <th>Bollinger</th>
                  <th>Alertas</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--td)' }}>Sin resultados</td></tr>
                ) : (
                  filtered.map(row => (
                    <ScreenerRow
                      key={`${row.exchange}-${row.symbol}`}
                      row={row}
                      onSelect={r => setSelected(prev => prev?.symbol === r.symbol && prev?.exchange === r.exchange ? null : r)}
                      selected={selected}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Panel de detalle */}
          {selected && <DetailPanel row={selected} onClose={() => setSelected(null)} />}
        </div>
      )}
    </div>
  );
}
