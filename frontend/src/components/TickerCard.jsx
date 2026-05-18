import React from 'react';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { fmtPrice, quoteOf } from '../utils/currency.js';

export default function TickerCard({ ticker }) {
  const { eurUsd } = useCurrency();
  const pct   = ticker.percentage ?? 0;
  const isUp  = pct >= 0;
  const quote = quoteOf(ticker.symbol);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{ticker.symbol}</span>
        <span className={`badge ${isUp ? 'badge-up' : 'badge-down'}`}>
          {isUp ? '+' : ''}{pct?.toFixed(2)}%
        </span>
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>
        {fmtPrice(ticker.last, quote, eurUsd)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }} className="text-muted">
        <span>Vol: {ticker.volume?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        <span style={{ textTransform: 'capitalize' }}>{ticker.exchange}</span>
      </div>
    </div>
  );
}
