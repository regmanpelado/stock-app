import React, { useState, useEffect, useCallback } from 'react';
import { botsApi } from '../services/api.jsx';
import BotCard from '../components/BotCard.jsx';
import CreateBotModal from '../components/CreateBotModal.jsx';

const TYPE_LABEL = { dca: 'DCA', grid: 'Grid', signal: 'Señal', ia_dynamic: 'IA Dinámico', market_making: 'Market Making', arbitrage: 'Arbitraje', scalping: 'Scalping', mean_reversion: 'Mean Reversion', momentum: 'Momentum', funding_arb: 'Funding Arb' };
const TYPE_COLOR = { dca: '#38bdf8', grid: '#a78bfa', signal: '#fb923c', ia_dynamic: '#34d399', market_making: '#f59e0b', arbitrage: '#e879f9', scalping: '#f43f5e', mean_reversion: '#06b6d4', momentum: '#84cc16', funding_arb: '#f97316' };

function Summary({ bots }) {
  const running  = bots.filter(b => b.status === 'running').length;
  const totalPnl = bots.reduce((s, b) => s + (b.pnl || 0), 0);
  const positivePnl = totalPnl >= 0;

  return (
    <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
      {[
        { label: 'Total bots',    value: bots.length,         color: 'var(--ts)' },
        { label: 'Activos',       value: running,             color: '#4ade80' },
        { label: 'Sandbox',       value: bots.filter(b => b.sandbox).length, color: '#38bdf8' },
        { label: 'P&L total',     value: `${positivePnl ? '+' : ''}${totalPnl.toFixed(4)}`, color: positivePnl ? '#4ade80' : '#f87171' },
      ].map(s => (
        <div key={s.label} className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--td)' }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Asesor IA ─────────────────────────────────────────────────────────────────

const SUGGESTED = [
  "Quiero acumular BTC a largo plazo con poco riesgo",
  "¿Qué bot va bien en mercados laterales?",
  "Quiero ganar rendimiento sin exposición al precio",
  "Soy principiante, ¿por dónde empiezo?",
];

function BotAdvisor() {
  const [open,     setOpen]    = useState(false);
  const [input,    setInput]   = useState('');
  const [response, setResp]    = useState('');
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState(null);

  const ask = async (msg) => {
    const q = (msg || input).trim();
    if (!q) return;
    setInput('');
    setLoading(true); setError(null); setResp('');
    try {
      const data = await botsApi.advisor(q);
      setResp(data.response);
    } catch (e) {
      setError(e.response?.data?.detail || 'Error al consultar el asesor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: open ? '#0c4a6e33' : 'var(--su)',
          border: `1px solid ${open ? '#0284c7' : '#334155'}`,
          borderRadius: 8, padding: '0.6rem 1rem',
          color: open ? '#38bdf8' : 'var(--ts)', cursor: 'pointer',
          fontSize: '0.88rem', fontWeight: 600, width: '100%', textAlign: 'left',
          transition: 'all 0.2s',
        }}
      >
        <span style={{ fontSize: '1.1rem' }}>🤖</span>
        Asesor IA — recomendaciones de configuración
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--td)' }}>
          {open ? '▲ Cerrar' : '▼ Abrir'}
        </span>
      </button>

      {open && (
        <div className="card" style={{ borderTop: '2px solid #0284c7', borderRadius: '0 0 10px 10px',
          borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: 0 }}>

          {/* Sugerencias */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--td)', marginBottom: '0.4rem', fontWeight: 600 }}>
              SUGERENCIAS
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {SUGGESTED.map(s => (
                <button key={s} onClick={() => ask(s)}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', borderRadius: 20,
                    background: '#0c4a6e22', border: '1px solid #0284c744',
                    color: '#38bdf8', cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              className="form-input"
              placeholder="Describe tu objetivo de trading o pregunta sobre configuración…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && ask()}
              style={{ flex: 1 }}
              disabled={loading}
            />
            <button className="btn btn-primary" onClick={() => ask()} disabled={loading || !input.trim()}
              style={{ whiteSpace: 'nowrap' }}>
              {loading ? '...' : 'Preguntar'}
            </button>
          </div>

          {/* Respuesta */}
          {loading && (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--td)', fontSize: '0.85rem' }}>
              🤖 Analizando la mejor configuración para ti…
            </div>
          )}
          {error && (
            <div style={{ padding: '0.75rem', background: '#450a0a22', borderRadius: 8,
              color: '#f87171', fontSize: '0.82rem' }}>{error}</div>
          )}
          {response && !loading && (
            <div style={{ padding: '1rem', background: '#0f172a', borderRadius: 8,
              border: '1px solid #1e293b', fontSize: '0.84rem', lineHeight: 1.7 }}>
              {response.split('\n').map((line, i) => (
                <div key={i} style={{
                  marginBottom: line === '' ? '0.5rem' : '0.1rem',
                  color: line.startsWith('⚠️') ? '#f59e0b' : 'var(--ts)',
                  fontStyle: line.startsWith('⚠️') ? 'italic' : 'normal',
                  fontSize: line.startsWith('⚠️') ? '0.78rem' : '0.84rem',
                }}>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default function Bots() {
  const [bots, setBots]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setModal]   = useState(false);
  const [filterType, setFilter] = useState('all');
  const [filterStatus, setFS]   = useState('all');

  const load = useCallback(async () => {
    try { setBots(await botsApi.list()); }
    catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  // Polling cada 5 s mientras hay bots activos
  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (bots.some(b => b.status === 'running')) load();
    }, 5000);
    return () => clearInterval(id);
  }, [load, bots.length]);

  const filtered = bots.filter(b => {
    const t = filterType   === 'all' || b.type   === filterType;
    const s = filterStatus === 'all' || b.status === filterStatus;
    return t && s;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Bots de Trading</h1>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Crear Bot</button>
      </div>

      {bots.length > 0 && <Summary bots={bots} />}

      <BotAdvisor />

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {['all', 'dca', 'grid', 'signal', 'ia_dynamic', 'market_making', 'arbitrage', 'scalping', 'mean_reversion', 'momentum', 'funding_arb'].map(t => (
          <button key={t} className="btn" onClick={() => setFilter(t)}
            style={{ fontSize: '0.8rem',
              background: filterType === t ? (TYPE_COLOR[t] || '#0284c7') : 'var(--su)',
              color: filterType === t ? '#0f172a' : 'var(--ts)', border: '1px solid #334155',
              fontWeight: filterType === t ? 700 : 400 }}>
            {t === 'all' ? 'Todos' : TYPE_LABEL[t]}
          </button>
        ))}
        <div style={{ width: 1, background: 'var(--bd)', margin: '0 0.25rem' }} />
        {['all', 'running', 'paused', 'stopped', 'error'].map(s => (
          <button key={s} className="btn" onClick={() => setFS(s)}
            style={{ fontSize: '0.8rem', background: filterStatus === s ? 'var(--bd)' : 'var(--su)',
              color: filterStatus === s ? 'var(--tx)' : 'var(--td)', border: '1px solid #334155' }}>
            {{ all: 'Todos', running: 'Activos', paused: 'Pausados', stopped: 'Detenidos', error: 'Error' }[s]}
          </button>
        ))}
        <button className="btn" style={{ marginLeft: 'auto', fontSize: '0.8rem', background: 'var(--su)', color: 'var(--ts)', border: '1px solid #334155' }}
          onClick={load}>↻ Actualizar</button>
      </div>

      {loading && <p className="loading">Cargando bots...</p>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤖</div>
          <div style={{ color: 'var(--td)', marginBottom: '1.5rem' }}>
            {bots.length === 0 ? 'No hay bots creados todavía.' : 'Ningún bot coincide con el filtro.'}
          </div>
          {bots.length === 0 && (
            <button className="btn btn-primary" onClick={() => setModal(true)}>Crear mi primer bot</button>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
        {filtered.map(bot => (
          <BotCard key={bot.id} bot={bot} onRefresh={load} />
        ))}
      </div>

      {/* Explicación de tipos */}
      {bots.length === 0 && !loading && (
        <div style={{ marginTop: '3rem' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--td)', marginBottom: '1rem' }}>TIPOS DE BOT DISPONIBLES</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {Object.entries(TYPE_LABEL).map(([type, title]) => (
              <div key={type} className="card" style={{ borderTop: `3px solid ${TYPE_COLOR[type]}` }}>
                <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: TYPE_COLOR[type] }}>{title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--td)', lineHeight: 1.5 }}>
                  {{ dca: 'Compra fija a intervalos regulares. Ideal para acumular a largo plazo.',
                     grid: 'Niveles de precio automáticos con 5 modos avanzados.',
                     signal: 'Señales técnicas RSI y MACD en cualquier timeframe.',
                     ia_dynamic: 'IA selecciona las mejores criptos cada hora.',
                     market_making: 'Captura el spread publicando bids y asks continuamente.',
                     arbitrage: 'Explota diferencias de precio entre dos exchanges.',
                     scalping: 'Trades rápidos con TP/SL ajustados en 5m.',
                     mean_reversion: 'Compra debilidad y vende cuando el precio regresa a la media.',
                     momentum: 'Monta tendencias alcistas con trailing stop dinámico.',
                     funding_arb: 'Long spot + short perpetuo. Cobra el funding rate cada 8 h sin exposición al precio.',
                  }[type]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <CreateBotModal
          onClose={() => setModal(false)}
          onCreated={(bot) => { setBots(prev => [bot, ...prev]); }}
        />
      )}
    </div>
  );
}
