import React, { useState } from 'react';
import { useFetch } from '../hooks/useExchange';
import { marketApi } from '../services/api';
import TradingViewWidget from '../components/TradingViewWidget';

const EXCHANGES  = ['binance', 'coinbase', 'kraken', 'gateio'];
const TIMEFRAMES = [{ label: '1H', value: '1h' }, { label: '4H', value: '4h' }, { label: '1D', value: '1d' }];

export default function Markets() {
  const [exchange,        setExchange]        = useState('binance');
  const [search,          setSearch]          = useState('');
  const [selectedSymbol,  setSelectedSymbol]  = useState('BTC/USDT');
  const [timeframe,       setTimeframe]       = useState('1h');

  const { data: tickers, loading, error, reload } = useFetch(
    () => marketApi.getTickers(exchange),
    [exchange]
  );

  const filtered = (Array.isArray(tickers) ? tickers : []).filter(t =>
    t.symbol?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="page-title">Mercados</h1>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <select className="form-select" style={{ width: '160px' }}
          value={exchange} onChange={e => setExchange(e.target.value)}>
          {EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </select>
        <input className="form-input" style={{ flex: 1, minWidth: '200px' }}
          placeholder="Buscar symbol (ej: BTC/USDT)..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary" onClick={reload}>Actualizar</button>
      </div>

      {/* TradingView chart */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.65rem 1rem', borderBottom: '1px solid #1e3a5f55' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
            <span style={{ color: 'var(--ts)' }}>Gráfico TradingView · </span>
            <span style={{ color: '#38bdf8' }}>{selectedSymbol}</span>
            <span style={{ color: 'var(--t2)', fontSize: '0.78rem' }}> · {exchange}</span>
            <span style={{ color: 'var(--bd)', fontSize: '0.75rem', marginLeft: '0.75rem' }}>
              ↓ Haz clic en un par para verlo aquí
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {TIMEFRAMES.map(tf => (
              <button key={tf.value} onClick={() => setTimeframe(tf.value)} className="btn"
                style={{
                  padding: '0.25rem 0.65rem', fontSize: '0.75rem', fontWeight: 700,
                  background: timeframe === tf.value ? '#38bdf8' : 'var(--su)',
                  color:      timeframe === tf.value ? 'var(--bg)' : 'var(--ts)',
                  border:     `1px solid ${timeframe === tf.value ? '#38bdf8' : 'var(--bd)'}`,
                }}>
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        <TradingViewWidget
          symbol={selectedSymbol} exchange={exchange} timeframe={timeframe} height={420} />
      </div>

      {/* Markets table */}
      {loading && <p className="loading">Cargando mercados...</p>}
      {error   && <p className="error-msg">{error}</p>}

      {!loading && !error && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Par</th>
                <th>Último</th>
                <th>Bid</th>
                <th>Ask</th>
                <th>24h High</th>
                <th>24h Low</th>
                <th>Volumen</th>
                <th>Cambio %</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(t => (
                <tr key={t.symbol} onClick={() => setSelectedSymbol(t.symbol)}
                  style={{
                    cursor: 'pointer',
                    background: selectedSymbol === t.symbol ? '#1e3a5f33' : undefined,
                  }}>
                  <td style={{ fontWeight: 600 }}>
                    {selectedSymbol === t.symbol && (
                      <span style={{ color: '#38bdf8', marginRight: 4, fontSize: '0.7rem' }}>▶</span>
                    )}
                    {t.symbol}
                  </td>
                  <td>${t.last?.toLocaleString()}</td>
                  <td>{t.bid?.toLocaleString()}</td>
                  <td>{t.ask?.toLocaleString()}</td>
                  <td>{t.high?.toLocaleString()}</td>
                  <td>{t.low?.toLocaleString()}</td>
                  <td>{t.baseVolume?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className={t.percentage >= 0 ? 'text-green' : 'text-red'}>
                    {t.percentage >= 0 ? '+' : ''}{t.percentage?.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
