import React, { useState } from 'react';
import ExchangeStatus from '../components/ExchangeStatus';
import TickerCard from '../components/TickerCard';
import TradingViewWidget from '../components/TradingViewWidget';
import { useFetch } from '../hooks/useExchange';
import { marketApi } from '../services/api';

const TOP_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT'];
const TIMEFRAMES  = [{ label: '1H', value: '1h' }, { label: '4H', value: '4h' }, { label: '1D', value: '1d' }];

export default function Dashboard() {
  const [exchange,    setExchange]    = useState('binance');
  const [chartSymbol, setChartSymbol] = useState('BTC/USDT');
  const [timeframe,   setTimeframe]   = useState('1h');

  const { data: tickers, loading: tickersLoading } = useFetch(
    () => marketApi.getTickers(exchange, TOP_SYMBOLS),
    [exchange]
  );

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', color: 'var(--ts)', marginBottom: '1rem' }}>Estado de Exchanges</h2>
        <ExchangeStatus />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--ts)' }}>Precios en Tiempo Real</h2>
          <select className="form-select" style={{ width: 'auto' }}
            value={exchange} onChange={e => setExchange(e.target.value)}>
            {['binance', 'coinbase', 'kraken', 'gateio'].map(ex => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>
        </div>
        {tickersLoading ? (
          <p className="loading">Cargando precios...</p>
        ) : (
          <div className="grid-4">
            {(Array.isArray(tickers) ? tickers : []).slice(0, 8).map(t => (
              <div key={t.symbol} onClick={() => setChartSymbol(t.symbol)}
                style={{
                  cursor: 'pointer',
                  outline: t.symbol === chartSymbol ? '2px solid #38bdf8' : 'none',
                  borderRadius: 8,
                }}>
                <TickerCard ticker={t} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--ts)' }}>
            Gráfico TradingView:{' '}
            <span style={{ color: '#38bdf8' }}>{chartSymbol}</span>
            <span style={{ color: 'var(--td)', fontSize: '0.85rem' }}> · {exchange}</span>
          </h2>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {TIMEFRAMES.map(tf => (
              <button key={tf.value} onClick={() => setTimeframe(tf.value)} className="btn"
                style={{
                  padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 700,
                  background: timeframe === tf.value ? '#38bdf8' : 'var(--su)',
                  color:      timeframe === tf.value ? 'var(--bg)' : 'var(--ts)',
                  border:     `1px solid ${timeframe === tf.value ? '#38bdf8' : 'var(--bd)'}`,
                }}>
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <TradingViewWidget symbol={chartSymbol} exchange={exchange} timeframe={timeframe} height={500} />
        </div>
      </section>
    </div>
  );
}
