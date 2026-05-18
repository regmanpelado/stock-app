import React, { useState, useEffect, useCallback } from 'react';
import { exchangeKeysApi } from '../services/api.jsx';

const EXCHANGES = [
  {
    id:    'binance',
    name:  'Binance',
    color: '#F3BA2F',
    bg:    '#F3BA2F18',
    desc:  'El mayor exchange del mundo por volumen. Soporta miles de pares.',
    docsUrl: 'https://www.binance.com/es/support/faq/c-6',
    perms: 'Habilita "Lectura" y "Trading al contado". NO habilites "Retiradas".',
  },
  {
    id:    'kraken',
    name:  'Kraken',
    color: '#5741D9',
    bg:    '#5741D918',
    desc:  'Exchange regulado con excelentes pares EUR. Muy popular en Europa.',
    docsUrl: 'https://support.kraken.com/hc/es/articles/360000919966',
    perms: 'Permisos necesarios: "Query Funds" y "Create & Modify Orders".',
  },
  {
    id:    'coinbase',
    name:  'Coinbase',
    color: '#1652F0',
    bg:    '#1652F018',
    desc:  'Exchange estadounidense regulado. Ideal para pares USD.',
    docsUrl: 'https://help.coinbase.com/en/advanced-trade/other-topics/advanced-api',
    perms: 'Crea una API key con permisos "View" y "Trade". Sin permisos de transferencia.',
  },
  {
    id:    'gateio',
    name:  'Gate.io',
    color: '#E53935',
    bg:    '#E5393518',
    desc:  'Gran selección de altcoins. Pares USDT con alta liquidez.',
    docsUrl: 'https://www.gate.io/myaccount/apiv4keys',
    perms: 'Activa permisos de "Spot Trading" y "Read Account Info". Sin retiradas.',
  },
];

// ── Modal de configuración ──────────────────────────────────────────────────────

function ConfigModal({ ex, onClose, onSaved }) {
  const [apiKey,    setApiKey]    = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [label,     setLabel]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [showKey,   setShowKey]   = useState(false);
  const [showSec,   setShowSec]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await exchangeKeysApi.upsert(ex.id, apiKey.trim(), apiSecret.trim(), label.trim());
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000099', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
        width: '100%', maxWidth: 480, padding: '1.5rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: ex.color, display: 'inline-block' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Configurar {ex.name}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        {/* Docs link */}
        <div style={{ padding: '0.6rem 0.75rem', background: ex.bg, border: `1px solid ${ex.color}33`,
          borderRadius: 6, fontSize: '0.78rem', marginBottom: '1rem' }}>
          <div style={{ color: ex.color, fontWeight: 600, marginBottom: '0.2rem' }}>Permisos recomendados</div>
          <div style={{ color: 'var(--td)' }}>{ex.perms}</div>
          <a href={ex.docsUrl} target="_blank" rel="noreferrer"
            style={{ color: ex.color, fontSize: '0.73rem', marginTop: '0.3rem', display: 'inline-block' }}>
            Ver documentación de {ex.name} →
          </a>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Label opcional */}
          <div className="form-group">
            <label className="form-label">Etiqueta (opcional)</label>
            <input className="form-input" placeholder="ej: Cuenta principal" value={label}
              onChange={e => setLabel(e.target.value)} />
          </div>

          {/* API Key */}
          <div className="form-group">
            <label className="form-label">API Key <span style={{ color: '#f87171' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <input className="form-input" required
                type={showKey ? 'text' : 'password'}
                placeholder="Pega tu API Key aquí"
                value={apiKey} onChange={e => setApiKey(e.target.value)}
                style={{ paddingRight: '2.5rem', fontFamily: 'monospace', fontSize: '0.82rem' }} />
              <button type="button" onClick={() => setShowKey(v => !v)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem' }}>
                {showKey ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* API Secret */}
          <div className="form-group">
            <label className="form-label">API Secret <span style={{ color: '#f87171' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <input className="form-input" required
                type={showSec ? 'text' : 'password'}
                placeholder="Pega tu API Secret aquí"
                value={apiSecret} onChange={e => setApiSecret(e.target.value)}
                style={{ paddingRight: '2.5rem', fontFamily: 'monospace', fontSize: '0.82rem' }} />
              <button type="button" onClick={() => setShowSec(v => !v)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem' }}>
                {showSec ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* Aviso de seguridad */}
          <div style={{ padding: '0.6rem 0.75rem', background: '#14532d22', border: '1px solid #4ade8033',
            borderRadius: 6, fontSize: '0.75rem', color: '#86efac', marginBottom: '1rem' }}>
            🔒 Tus claves se almacenan cifradas con AES-256. Nunca las compartimos ni las usamos fuera de tu cuenta.
          </div>

          {error && <p className="error-msg" style={{ marginBottom: '0.75rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn"
              style={{ background: 'var(--su)', color: '#94a3b8', border: '1px solid #334155' }}
              onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar claves'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tarjeta de exchange ─────────────────────────────────────────────────────────

function ExchangeCard({ ex, connected, onConfigure, onDelete, onTest }) {
  const [testing, setTesting]   = useState(false);
  const [testMsg, setTestMsg]   = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleTest = async () => {
    setTesting(true); setTestMsg(null);
    try {
      const res = await onTest();
      setTestMsg(res);
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar las claves de ${ex.name}? Los bots en modo real dejarán de funcionar.`)) return;
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  };

  return (
    <div className="card" style={{ borderLeft: `4px solid ${ex.color}` }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: ex.bg,
            border: `1px solid ${ex.color}44`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 800, color: ex.color, fontSize: '0.85rem' }}>
            {ex.name[0]}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{ex.name}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--td)' }}>{ex.desc}</div>
          </div>
        </div>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 4,
          background: connected ? (connected.source === 'env' ? '#1e3a5f33' : '#14532d33') : '#1e293b',
          color: connected ? (connected.source === 'env' ? '#60a5fa' : '#4ade80') : '#64748b',
          border: `1px solid ${connected ? (connected.source === 'env' ? '#60a5fa44' : '#4ade8044') : '#334155'}` }}>
          {connected ? (connected.source === 'env' ? '● Global' : '● Conectado') : '○ Sin configurar'}
        </span>
      </div>

      {/* Clave enmascarada */}
      {connected && (
        <div style={{ padding: '0.5rem 0.75rem', background: '#0f172a', borderRadius: 6,
          border: '1px solid #334155', fontSize: '0.75rem', fontFamily: 'monospace',
          color: '#94a3b8', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
          {connected.api_key_masked}
        </div>
      )}

      {/* Resultado del test */}
      {testMsg && (
        <div style={{ padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.78rem',
          marginBottom: '0.75rem',
          background: testMsg.ok ? '#14532d22' : '#450a0a22',
          border: `1px solid ${testMsg.ok ? '#4ade8044' : '#f8717144'}`,
          color: testMsg.ok ? '#86efac' : '#fca5a5' }}>
          {testMsg.ok ? '✓ ' : '✗ '}{testMsg.ok ? testMsg.message : testMsg.error}
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" style={{ flex: 1, fontSize: '0.8rem' }}
          onClick={onConfigure}>
          {connected ? '✏ Editar claves' : '+ Configurar'}
        </button>
        {connected && (
          <>
            <button className="btn" disabled={testing}
              onClick={handleTest}
              style={{ fontSize: '0.8rem', background: ex.bg, color: ex.color,
                border: `1px solid ${ex.color}44` }}>
              {testing ? '...' : '⚡ Probar'}
            </button>
            <button className="btn" disabled={deleting}
              onClick={handleDelete}
              style={{ fontSize: '0.8rem', background: '#450a0a22', color: '#f87171',
                border: '1px solid #f8717133' }}>
              🗑
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────────

export default function ExchangeKeys() {
  const [keys,     setKeys]   = useState([]);
  const [loading,  setLoad]   = useState(true);
  const [modal,    setModal]  = useState(null); // exchange obj o null

  const load = useCallback(async () => {
    setLoad(true);
    try { setKeys(await exchangeKeysApi.list()); }
    catch { /* silencioso si no hay sesión */ }
    finally { setLoad(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const connectedMap = Object.fromEntries(keys.map(k => [k.exchange, k]));

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 className="page-title" style={{ margin: '0 0 0.35rem' }}>Mis Exchanges</h1>
        <p style={{ color: 'var(--td)', fontSize: '0.88rem', margin: 0 }}>
          Conecta tus exchanges para operar en modo real. Tus claves se almacenan cifradas con AES-256 y nunca se exponen.
        </p>
      </div>

      {/* Aviso de seguridad */}
      <div style={{ padding: '0.875rem 1rem', background: '#0c4a6e22', border: '1px solid #0284c744',
        borderRadius: 8, marginBottom: '1.5rem', fontSize: '0.82rem', color: '#94a3b8' }}>
        <strong style={{ color: '#38bdf8' }}>Importante — Permisos recomendados:</strong>
        {' '}Crea siempre claves de API con los <strong>mínimos permisos necesarios</strong>.
        Habilita únicamente <strong>Lectura</strong> y <strong>Trading</strong>.
        <span style={{ color: '#f87171' }}> Nunca habilites permisos de retirada.</span>
        {' '}Si alguien accede a tus claves, no podrá mover fondos fuera del exchange.
      </div>

      {loading ? (
        <p className="loading">Cargando configuración...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {EXCHANGES.map(ex => (
            <ExchangeCard
              key={ex.id}
              ex={ex}
              connected={connectedMap[ex.id] || null}
              onConfigure={() => setModal(ex)}
              onDelete={async () => {
                await exchangeKeysApi.delete(ex.id);
                await load();
              }}
              onTest={() => exchangeKeysApi.test(ex.id)}
            />
          ))}
        </div>
      )}

      {/* Nota al pie */}
      <div style={{ marginTop: '2rem', padding: '1rem 1.25rem', background: 'var(--su)',
        borderRadius: 8, border: '1px solid #334155', fontSize: '0.78rem',
        color: 'var(--td)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--tx)' }}>¿Para qué se usan tus claves?</strong>
        {' '}Cuando creas un bot y desactivas el modo sandbox, el bot ejecutará órdenes reales
        usando tus claves. En modo sandbox las claves no se usan — las operaciones son simuladas.
        Puedes eliminar tus claves en cualquier momento desde esta página.
      </div>

      {/* Modal */}
      {modal && (
        <ConfigModal
          ex={modal}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
