import React, { useState, useEffect } from 'react';
import { subscriptionsApi } from '../services/api.jsx';

const STRIPE_PLANS = ['pro', 'pro_plus'];

const PLAN_COLOR = { free: 'var(--ts)', pro: '#38bdf8', pro_plus: '#a78bfa' };
const PLAN_EMOJI = { free: '🌱', pro: '⚡', pro_plus: '🚀' };

// Icono según el contenido del feature
function FeatureIcon({ text }) {
  const t = text.toLowerCase();
  if (t.includes('gratis') || t.includes('trial'))  return '🎁';
  if (t.includes('bot') && t.includes('ilimitado')) return '♾️';
  if (t.includes('bot'))                             return '🤖';
  if (t.includes('ia') || t.includes('predicc'))    return '🧠';
  if (t.includes('trading') && t.includes('real'))  return '💸';
  if (t.includes('tradingview'))                     return '📊';
  if (t.includes('noticias') || t.includes('feed')) return '📰';
  if (t.includes('backtest'))                        return '🔬';
  if (t.includes('señal'))                           return '📡';
  if (t.includes('portfolio') || t.includes('p&l')) return '💼';
  if (t.includes('alerta'))                          return '🔔';
  if (t.includes('soporte'))                         return '🛟';
  if (t.includes('anticipado') || t.includes('nuevo')) return '✨';
  if (t.includes('mercado'))                         return '🌐';
  return '✓';
}

// Tabla comparativa de características
const COMPARE_ROWS = [
  { label: 'Bots activos',             free: '1 sandbox',   pro: '5 real+sandbox',  pro_plus: 'Ilimitados' },
  { label: 'Trading real',             free: false,         pro: true,              pro_plus: true },
  { label: 'Exchanges',                free: '4 (lectura)', pro: '4',               pro_plus: '4' },
  { label: 'Señales técnicas',         free: true,          pro: true,              pro_plus: true },
  { label: 'Backtesting',              free: false,         pro: true,              pro_plus: true },
  { label: 'Predicciones IA',          free: false,         pro: false,             pro_plus: true },
  { label: 'Bot IA Dinámico',          free: false,         pro: false,             pro_plus: true },
  { label: 'TradingView',              free: false,         pro: '⚡ Básico',        pro_plus: '🚀 Avanzado' },
  { label: 'Feed noticias cripto',     free: true,          pro: true,              pro_plus: '+ Alertas IA' },
  { label: 'Prueba gratuita',          free: '—',           pro: '7 días',          pro_plus: '7 días' },
  { label: 'Soporte',                  free: 'Comunidad',   pro: 'Email',           pro_plus: 'Prioritario 24/7' },
];

function Cell({ val }) {
  if (val === true)  return <span style={{ color: '#4ade80', fontSize: '1rem' }}>✓</span>;
  if (val === false) return <span style={{ color: 'var(--bd)', fontSize: '0.9rem' }}>—</span>;
  return <span style={{ color: '#cbd5e1', fontSize: '0.82rem' }}>{val}</span>;
}

export default function Pricing() {
  const [planes, setPlanes]     = useState([]);
  const [usuario, setUsuario]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [changing, setChanging] = useState(null);
  const [msg, setMsg]           = useState(null);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    Promise.all([subscriptionsApi.getPlanes(), subscriptionsApi.getUsuario()])
      .then(([p, u]) => { setPlanes(p); setUsuario(u); })
      .finally(() => setLoading(false));
  }, []);

  const cambiar = async (planId) => {
    if (usuario?.plan === planId) return;
    setChanging(planId);
    try {
      if (STRIPE_PLANS.includes(planId)) {
        // Planes de pago → redirigir a Stripe Checkout
        const { checkout_url } = await subscriptionsApi.createCheckout(planId);
        window.location.href = checkout_url;
      } else {
        // Plan free → downgrade directo
        const u = await subscriptionsApi.cambiarPlan(planId);
        setUsuario(u);
        setMsg({ tipo: 'ok', texto: `✓ Plan cambiado a ${u.plan_detalle?.nombre || planId}` });
        setTimeout(() => setMsg(null), 4000);
      }
    } catch (e) {
      setMsg({ tipo: 'err', texto: e.response?.data?.detail || e.message });
      setTimeout(() => setMsg(null), 5000);
    } finally {
      setChanging(null);
    }
  };

  if (loading) return <p className="loading">Cargando planes...</p>;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ display: 'inline-block', padding: '0.3rem 1rem', borderRadius: 20,
          background: '#a78bfa22', color: '#a78bfa', fontSize: '0.8rem',
          fontWeight: 700, marginBottom: '1rem', border: '1px solid #a78bfa44' }}>
          PLANES Y PRECIOS
        </div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--th)' }}>
          Elige tu plan de trading
        </h1>
        <p style={{ color: 'var(--td)', fontSize: '1.05rem', maxWidth: 520, margin: '0 auto' }}>
          Desde señales gratuitas hasta IA predictiva avanzada. Sin permanencia, cancela cuando quieras.
        </p>
      </div>

      {/* Toast de estado */}
      {msg && (
        <div style={{ textAlign: 'center', marginBottom: '1.5rem', padding: '0.75rem 1.25rem',
          borderRadius: 8, background: msg.tipo === 'ok' ? '#14532d' : '#450a0a',
          color: msg.tipo === 'ok' ? '#4ade80' : '#f87171',
          border: `1px solid ${msg.tipo === 'ok' ? '#22c55e44' : '#f8717144'}`,
          fontWeight: 600, fontSize: '0.9rem' }}>
          {msg.texto}
        </div>
      )}

      {/* Usuario actual */}
      {usuario && (
        <div style={{ textAlign: 'center', marginBottom: '2rem', padding: '0.6rem 1rem',
          background: 'var(--su)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--td)',
          display: 'inline-block', width: '100%' }}>
          Conectado como <strong style={{ color: 'var(--tx)' }}>{usuario.email}</strong>
          {' · '}Plan actual:{' '}
          <strong style={{ color: PLAN_COLOR[usuario.plan] || 'var(--ts)' }}>
            {PLAN_EMOJI[usuario.plan]} {usuario.plan_detalle?.nombre}
          </strong>
        </div>
      )}

      {/* Cards de planes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        {planes.map(plan => {
          const color     = PLAN_COLOR[plan.id] || 'var(--ts)';
          const isCurrent = usuario?.plan === plan.id;
          const isPopular = plan.id === 'pro_plus';
          const hasTrial  = plan.trial_days > 0;

          return (
            <div key={plan.id} style={{
              background: isCurrent ? `${color}08` : 'var(--su)',
              borderRadius: 16, padding: '2rem',
              border: `2px solid ${isCurrent ? color : isPopular ? color + '55' : '#1e3a5f33'}`,
              position: 'relative', display: 'flex', flexDirection: 'column',
              boxShadow: isPopular ? `0 0 40px ${color}18` : 'none',
              transition: 'transform 0.2s',
            }}>

              {/* Badge superior */}
              {(isPopular || isCurrent) && (
                <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                  background: isCurrent ? color : 'linear-gradient(135deg, #a78bfa, #6366f1)',
                  color: 'var(--bg)', fontSize: '0.7rem', fontWeight: 800,
                  padding: '0.25rem 1rem', borderRadius: 20, whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                  {isCurrent ? '✓ TU PLAN ACTUAL' : '⭐ MÁS POPULAR'}
                </div>
              )}

              {/* Header del plan */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.75rem' }}>{PLAN_EMOJI[plan.id]}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.3rem', color }}>{plan.nombre}</div>
                    {hasTrial && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.5rem',
                        borderRadius: 10, background: '#14532d', color: '#4ade80',
                        border: '1px solid #22c55e44' }}>
                        🎁 {plan.trial_days} días gratis
                      </span>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--td)', lineHeight: 1.5, margin: 0 }}>
                  {plan.descripcion}
                </p>
              </div>

              {/* Precio */}
              <div style={{ marginBottom: '1.5rem', paddingBottom: '1.25rem',
                borderBottom: '1px solid #1e3a5f55' }}>
                {plan.precio_eur === 0 ? (
                  <div style={{ fontSize: '2.75rem', fontWeight: 800, color: 'var(--th)', lineHeight: 1 }}>
                    Gratis
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.25rem', lineHeight: 1 }}>
                    <span style={{ fontSize: '2.75rem', fontWeight: 800, color: 'var(--th)' }}>
                      €{plan.precio_eur}
                    </span>
                    <span style={{ color: 'var(--t2)', fontSize: '0.9rem', paddingBottom: '0.4rem' }}>/mes</span>
                  </div>
                )}
                {hasTrial && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--t2)', marginTop: '0.3rem' }}>
                    Prueba {plan.trial_days} días gratis · Sin tarjeta requerida
                  </div>
                )}
              </div>

              {/* Features */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.75rem', flex: 1 }}>
                {plan.features?.map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.6rem', padding: '0.35rem 0',
                    fontSize: '0.85rem', color: '#cbd5e1',
                    borderBottom: i < plan.features.length - 1 ? '1px solid #1e293b' : 'none' }}>
                    <span style={{ flexShrink: 0, fontSize: '0.9rem' }}><FeatureIcon text={f} /></span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                disabled={isCurrent || changing === plan.id}
                onClick={() => cambiar(plan.id)}
                style={{
                  width: '100%', padding: '0.85rem',
                  borderRadius: 8, border: `1.5px solid ${isCurrent ? color + '44' : color}`,
                  background: isCurrent ? 'transparent'
                    : isPopular ? `linear-gradient(135deg, ${color}, #6366f1)`
                    : color,
                  color: isCurrent ? color : 'var(--bg)',
                  fontWeight: 800, fontSize: '0.95rem',
                  cursor: isCurrent ? 'default' : 'pointer',
                  transition: 'opacity 0.2s',
                }}>
                {isCurrent ? '✓ Plan actual'
                  : changing === plan.id ? 'Activando...'
                  : hasTrial ? `Probar ${plan.nombre} gratis 7 días`
                  : plan.precio_eur === 0 ? 'Empezar gratis'
                  : `Activar ${plan.nombre}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Tabla comparativa */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <button onClick={() => setShowCompare(v => !v)}
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            color: 'var(--ts)', fontWeight: 600, fontSize: '0.9rem', padding: '0.25rem 0' }}>
          <span>📋 Comparativa completa de funcionalidades</span>
          <span>{showCompare ? '▲ Ocultar' : '▼ Ver todo'}</span>
        </button>

        {showCompare && (
          <div style={{ marginTop: '1.25rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', color: 'var(--t2)',
                    borderBottom: '1px solid #334155' }}>Funcionalidad</th>
                  {['free','pro','pro_plus'].map(id => (
                    <th key={id} style={{ textAlign: 'center', padding: '0.6rem 1rem',
                      color: PLAN_COLOR[id], borderBottom: '1px solid #334155',
                      fontWeight: 700 }}>
                      {PLAN_EMOJI[id]} {id === 'pro_plus' ? 'Pro+' : id.charAt(0).toUpperCase() + id.slice(1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#0f172a22' : 'transparent' }}>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--ts)' }}>{row.label}</td>
                    <td style={{ textAlign: 'center', padding: '0.6rem 1rem' }}><Cell val={row.free} /></td>
                    <td style={{ textAlign: 'center', padding: '0.6rem 1rem' }}><Cell val={row.pro} /></td>
                    <td style={{ textAlign: 'center', padding: '0.6rem 1rem' }}><Cell val={row.pro_plus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--su)',
        borderRadius: 12, border: '1px solid #334155' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--ts)', marginBottom: '0.5rem' }}>
          🔒 <strong style={{ color: 'var(--tx)' }}>Sin compromisos.</strong>
          {' '}Cancela en cualquier momento · Sin tarjeta para la prueba gratuita · Precios en EUR sin IVA
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--t2)' }}>
          En producción los pagos se procesarían via Stripe. Esta demo activa el plan inmediatamente.
        </div>
      </div>
    </div>
  );
}
