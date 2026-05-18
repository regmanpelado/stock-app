import React, { useState } from 'react';
import { useFetch } from '../hooks/useExchange.jsx';
import { portfolioApi } from '../services/api.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { toEUR, fmtEUR } from '../utils/currency.js';

const EXCHANGES   = ['binance', 'coinbase', 'kraken', 'gateio'];
const BASE_QUOTES = new Set(['EUR','ZEUR','EURT','USD','USDT','BUSD','ZUSD','USDC','USDP','DAI']);

function resolveEUR(b, eurUsd) {
  if (b.value_eur != null) return b.value_eur;
  const cur = (b.currency || '').toUpperCase();
  if (['USD','USDT','BUSD','ZUSD','USDC'].includes(cur)) return toEUR(b.total, 'USD', eurUsd);
  if (['EUR','ZEUR','EURT'].includes(cur)) return b.total;
  return null;
}

// ── Modal de confirmación de venta ────────────────────────────────────────────
function ConfirmModal({ mode, items, sandbox, onConfirm, onCancel, loading }) {
  const isSandbox = sandbox;
  return (
    <div style={{ position:'fixed', inset:0, background:'#00000099', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ background:'var(--su)', border:'1px solid #334155', borderRadius:12,
        width:'100%', maxWidth:480, padding:'1.5rem' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <h2 style={{ fontSize:'1.05rem', fontWeight:700 }}>
            {mode === 'all' ? '¿Vender todos los assets?' : '¿Confirmar venta?'}
          </h2>
          <button onClick={onCancel} style={{ background:'none', border:'none', color:'var(--td)', cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
        </div>

        {/* Sandbox badge */}
        <div style={{ padding:'0.5rem 0.875rem', borderRadius:6, marginBottom:'1rem',
          background: isSandbox ? '#0c4a6e22' : '#450a0a22',
          border: `1px solid ${isSandbox ? '#0284c744' : '#f8717144'}` }}>
          <div style={{ fontWeight:600, fontSize:'0.85rem', color: isSandbox ? '#38bdf8' : '#f87171' }}>
            {isSandbox ? '🧪 MODO SANDBOX — Simulación, sin dinero real' : '⚡ MODO REAL — Se ejecutará en el exchange'}
          </div>
        </div>

        {/* Lista de assets a vender */}
        <div style={{ marginBottom:'1rem', maxHeight:220, overflowY:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
            <thead>
              <tr style={{ color:'var(--td)' }}>
                <th style={{ textAlign:'left', paddingBottom:6 }}>Asset</th>
                <th style={{ textAlign:'right', paddingBottom:6 }}>Cantidad</th>
                <th style={{ textAlign:'right', paddingBottom:6 }}>Valor est. (EUR)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} style={{ borderTop:'1px solid #334155' }}>
                  <td style={{ padding:'0.4rem 0', fontWeight:700 }}>{it.currency}</td>
                  <td style={{ textAlign:'right', color:'var(--ts)' }}>{it.amount?.toFixed(6)}</td>
                  <td style={{ textAlign:'right', color:'#4ade80', fontWeight:600 }}>
                    {it.value_eur != null ? fmtEUR(it.value_eur) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total estimado */}
        {items.length > 1 && (
          <div style={{ textAlign:'right', fontSize:'0.85rem', color:'var(--ts)', marginBottom:'1rem' }}>
            Total estimado:{' '}
            <strong style={{ color:'#4ade80' }}>
              {fmtEUR(items.reduce((s, it) => s + (it.value_eur || 0), 0))}
            </strong>
          </div>
        )}

        <div style={{ display:'flex', gap:'0.5rem' }}>
          <button className="btn" style={{ flex:1, background:'var(--su)', color:'var(--ts)', border:'1px solid #334155' }}
            onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className="btn" disabled={loading}
            onClick={onConfirm}
            style={{ flex:2, background: isSandbox ? '#0284c7' : '#dc2626', color:'white', fontWeight:700 }}>
            {loading ? 'Ejecutando...' : isSandbox ? '🧪 Simular venta' : '⚡ Confirmar venta real'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de resultado ────────────────────────────────────────────────────────
function ResultModal({ results, onClose }) {
  const vendidos = Array.isArray(results?.vendidos) ? results.vendidos
    : results ? [results] : [];
  return (
    <div style={{ position:'fixed', inset:0, background:'#00000099', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--su)', border:'1px solid #334155', borderRadius:12,
        width:'100%', maxWidth:460, padding:'1.5rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <h2 style={{ fontSize:'1.05rem', fontWeight:700 }}>Resultado de la venta</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--td)', cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
        </div>
        {vendidos.map((v, i) => (
          <div key={i} style={{ padding:'0.5rem 0.75rem', borderRadius:6, marginBottom:'0.4rem',
            background: v.error ? '#450a0a' : '#14532d22',
            border: `1px solid ${v.error ? '#f87171' : '#22c55e33'}` }}>
            {v.error
              ? <span style={{ color:'#f87171', fontSize:'0.82rem' }}>❌ {v.asset}: {v.error}</span>
              : <div style={{ fontSize:'0.82rem' }}>
                  <span style={{ fontWeight:700 }}>{v.asset ?? v.symbol}</span>
                  {' — '}{v.amount?.toFixed(6)} @ {v.price?.toFixed(4)}
                  {' → '}<strong style={{ color:'#4ade80' }}>{v.total?.toFixed(4)} {v.symbol?.split('/')[1]}</strong>
                  {v.sandbox && <span style={{ color:'#38bdf8', marginLeft:6, fontSize:'0.75rem' }}>SANDBOX</span>}
                </div>
            }
          </div>
        ))}
        {results?.message && <p style={{ color:'var(--td)', fontSize:'0.82rem', marginTop:'0.5rem' }}>{results.message}</p>}
        <button className="btn btn-primary" style={{ width:'100%', marginTop:'1rem' }} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Portfolio() {
  const [exchange, setExchange] = useState('binance');
  const { eurUsd } = useCurrency();
  const [sandbox, setSandbox] = useState(true);

  // Estados de los modales
  const [confirmModal, setConfirmModal] = useState(null); // {mode:'single'|'all', items:[]}
  const [resultModal,  setResultModal]  = useState(null);
  const [selling, setSelling] = useState(false);

  // Estado de venta parcial por fila
  const [sellAmounts, setSellAmounts] = useState({}); // {currency: amount}

  const { data: balance, loading, error, reload } = useFetch(
    () => portfolioApi.getBalance(exchange),
    [exchange]
  );

  const balances = Array.isArray(balance) ? balance : [];
  const sellableBalances = balances.filter(b => !BASE_QUOTES.has(b.currency.toUpperCase()) && b.free > 0);

  const totalEUR = balances.reduce((sum, b) => sum + (resolveEUR(b, eurUsd) ?? 0), 0);
  const hasAnyEurValue = balances.some(b => resolveEUR(b, eurUsd) != null);

  // Abre modal de confirmación para vender todo
  const handleSellAll = () => {
    const items = sellableBalances.map(b => ({
      currency: b.currency, amount: b.free,
      value_eur: resolveEUR(b, eurUsd),
    }));
    if (!items.length) return;
    setConfirmModal({ mode: 'all', items });
  };

  // Abre modal de confirmación para venta parcial
  const handleSellOne = (b) => {
    const amount = parseFloat(sellAmounts[b.currency] ?? b.free);
    if (!amount || amount <= 0) return;
    setConfirmModal({
      mode: 'single',
      items: [{ currency: b.currency, amount, value_eur: resolveEUR(b, eurUsd) != null
        ? (resolveEUR(b, eurUsd) / b.total) * amount : null }],
    });
  };

  // Ejecutar la venta tras confirmar
  const handleConfirm = async () => {
    if (!confirmModal) return;
    setSelling(true);
    try {
      let result;
      if (confirmModal.mode === 'all') {
        result = await portfolioApi.sellAll(exchange, sandbox);
      } else {
        const { currency, amount } = confirmModal.items[0];
        result = await portfolioApi.sellAsset(exchange, currency, amount, sandbox);
      }
      setConfirmModal(null);
      setResultModal(result);
      reload();
    } catch (e) {
      setConfirmModal(null);
      setResultModal({ vendidos: [{ error: e.response?.data?.detail || e.message }] });
    } finally {
      setSelling(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Portfolio</h1>

      {/* Controles principales */}
      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.5rem', alignItems:'center', flexWrap:'wrap' }}>
        <select className="form-select" style={{ width:'160px' }}
          value={exchange} onChange={e => { setExchange(e.target.value); setSellAmounts({}); }}>
          {EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </select>
        <button className="btn btn-primary" onClick={reload}>Actualizar</button>
        {!loading && hasAnyEurValue && (
          <span style={{ fontSize:'0.9rem', color:'var(--ts)' }}>
            Total: <strong style={{ color:'#4ade80' }}>{fmtEUR(totalEUR)}</strong>
          </span>
        )}

        {/* Toggle sandbox */}
        <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginLeft:'auto',
          cursor:'pointer', fontSize:'0.82rem',
          padding:'0.35rem 0.75rem', borderRadius:6,
          background: sandbox ? '#0c4a6e22' : '#450a0a22',
          border: `1px solid ${sandbox ? '#0284c744' : '#f8717144'}` }}>
          <input type="checkbox" checked={sandbox} onChange={e => setSandbox(e.target.checked)} />
          <span style={{ color: sandbox ? '#38bdf8' : '#f87171', fontWeight:600 }}>
            {sandbox ? '🧪 Sandbox' : '⚡ Real'}
          </span>
        </label>
      </div>

      {loading && <p className="loading">Cargando balance...</p>}
      {error   && <p className="error-msg">{error}</p>}

      {!loading && !error && (
        <>
          {/* Tabla de balances */}
          <div className="card" style={{ overflowX:'auto', marginBottom:'1.25rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Moneda</th>
                  <th>Disponible</th>
                  <th>En uso</th>
                  <th>Total</th>
                  <th>Valor (EUR)</th>
                  <th>Exchange</th>
                </tr>
              </thead>
              <tbody>
                {balances.map(b => (
                  <tr key={b.currency}>
                    <td style={{ fontWeight:700 }}>{b.currency}</td>
                    <td>{b.free?.toFixed(8)}</td>
                    <td>{b.used?.toFixed(8)}</td>
                    <td style={{ fontWeight:600 }}>{b.total?.toFixed(8)}</td>
                    <td style={{ color:'#4ade80', fontWeight:600 }}>
                      {resolveEUR(b, eurUsd) != null ? fmtEUR(resolveEUR(b, eurUsd)) : '—'}
                    </td>
                    <td className="text-muted" style={{ textTransform:'capitalize' }}>{b.exchange}</td>
                  </tr>
                ))}
                {balances.length === 0 && (
                  <tr><td colSpan="6" style={{ textAlign:'center', padding:'2rem', color:'var(--td)' }}>
                    Sin balance o API key no configurada
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Panel de gestión de posiciones */}
          {sellableBalances.length > 0 && (
            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                <div>
                  <div style={{ fontWeight:700, marginBottom:2 }}>Gestión de Posiciones</div>
                  <div style={{ fontSize:'0.75rem', color:'var(--td)' }}>
                    {sandbox ? 'Modo sandbox — las ventas son simuladas' : 'Modo real — las ventas se ejecutan en el exchange'}
                  </div>
                </div>
                <button className="btn btn-danger"
                  onClick={handleSellAll}
                  style={{ fontSize:'0.85rem' }}>
                  Vender todo {sandbox ? '(sandbox)' : '(real)'}
                </button>
              </div>

              <table className="table" style={{ fontSize:'0.82rem' }}>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Disponible</th>
                    <th>Valor EUR</th>
                    <th>Cantidad a vender</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {sellableBalances.map(b => {
                    const valEur  = resolveEUR(b, eurUsd);
                    const inputAmt = sellAmounts[b.currency] ?? '';
                    const maxAmt   = b.free;
                    return (
                      <tr key={b.currency}>
                        <td style={{ fontWeight:700 }}>{b.currency}</td>
                        <td style={{ color:'var(--ts)' }}>{b.free?.toFixed(8)}</td>
                        <td style={{ color:'#4ade80' }}>{valEur != null ? fmtEUR(valEur) : '—'}</td>
                        <td>
                          <div style={{ display:'flex', gap:'0.35rem', alignItems:'center' }}>
                            <input
                              type="number" step="any" min="0" max={maxAmt}
                              value={inputAmt}
                              placeholder={maxAmt?.toFixed(6)}
                              onChange={e => setSellAmounts(prev => ({ ...prev, [b.currency]: e.target.value }))}
                              className="form-input"
                              style={{ width:130, padding:'0.35rem 0.5rem', fontSize:'0.78rem' }}
                            />
                            <button
                              onClick={() => setSellAmounts(prev => ({ ...prev, [b.currency]: maxAmt }))}
                              className="btn"
                              style={{ fontSize:'0.7rem', padding:'0.3rem 0.5rem', background:'var(--bd)', color:'var(--ts)', border:'none' }}>
                              Máx
                            </button>
                          </div>
                        </td>
                        <td>
                          <button
                            className="btn btn-danger"
                            style={{ fontSize:'0.78rem', padding:'0.35rem 0.75rem' }}
                            onClick={() => handleSellOne(b)}
                            disabled={!parseFloat(inputAmt || maxAmt)}>
                            Vender
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modales */}
      {confirmModal && (
        <ConfirmModal
          mode={confirmModal.mode}
          items={confirmModal.items}
          sandbox={sandbox}
          loading={selling}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      {resultModal && (
        <ResultModal results={resultModal} onClose={() => setResultModal(null)} />
      )}
    </div>
  );
}
