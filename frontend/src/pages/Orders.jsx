import React, { useState } from 'react';
import { orderApi } from '../services/api';

const EXCHANGES = ['binance', 'coinbase', 'kraken', 'gateio'];

const initialForm = {
  exchange: 'binance',
  symbol: 'BTC/USDT',
  side: 'buy',
  order_type: 'market',
  amount: '',
  price: '',
};

export default function Orders() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        price: form.order_type === 'limit' ? parseFloat(form.price) : undefined,
      };
      const res = await orderApi.placeOrder(payload);
      setResult(res);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Ordenes</h1>
      <div className="grid-2">
        <div className="card">
          <h2 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--ts)' }}>Nueva Orden</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Exchange</label>
              <select className="form-select" name="exchange" value={form.exchange} onChange={handleChange}>
                {EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Par (Symbol)</label>
              <input className="form-input" name="symbol" value={form.symbol} onChange={handleChange} placeholder="BTC/USDT" required />
            </div>
            <div className="form-group">
              <label className="form-label">Lado</label>
              <select className="form-select" name="side" value={form.side} onChange={handleChange}>
                <option value="buy">Comprar</option>
                <option value="sell">Vender</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de Orden</label>
              <select className="form-select" name="order_type" value={form.order_type} onChange={handleChange}>
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cantidad</label>
              <input className="form-input" name="amount" type="number" step="any" value={form.amount} onChange={handleChange} placeholder="0.001" required />
            </div>
            {form.order_type === 'limit' && (
              <div className="form-group">
                <label className="form-label">Precio</label>
                <input className="form-input" name="price" type="number" step="any" value={form.price} onChange={handleChange} placeholder="65000" required />
              </div>
            )}
            <button
              type="submit"
              className={`btn ${form.side === 'buy' ? 'btn-success' : 'btn-danger'}`}
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? 'Enviando...' : `${form.side === 'buy' ? 'Comprar' : 'Vender'} ${form.symbol}`}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--ts)' }}>Resultado</h2>
          {error && <p className="error-msg">{error}</p>}
          {result && (
            <div style={{ fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid #334155' }}>
                <span className="text-muted">ID</span>
                <span style={{ fontFamily: 'monospace' }}>{result.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid #334155' }}>
                <span className="text-muted">Estado</span>
                <span style={{ textTransform: 'uppercase' }}>{result.status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid #334155' }}>
                <span className="text-muted">Simbolo</span>
                <span>{result.symbol}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid #334155' }}>
                <span className="text-muted">Lado</span>
                <span className={result.side === 'buy' ? 'text-green' : 'text-red'}>{result.side?.toUpperCase()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0' }}>
                <span className="text-muted">Precio</span>
                <span>{result.price ? `$${result.price}` : 'Market'}</span>
              </div>
            </div>
          )}
          {!result && !error && (
            <p style={{ color: 'var(--td)', fontSize: '0.875rem' }}>El resultado de tu orden aparecera aqui.</p>
          )}
        </div>
      </div>
    </div>
  );
}
