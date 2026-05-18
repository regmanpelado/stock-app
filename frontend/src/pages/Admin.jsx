import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../services/api.jsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const PLAN_COLOR = { free: '#64748b', pro: '#38bdf8', pro_plus: '#a78bfa' };
const PLAN_LABEL = { free: 'Free', pro: 'Pro', pro_plus: 'Pro+' };
const PLAN_OPTIONS = ['free', 'pro', 'pro_plus'];

// ── Componentes pequeños ───────────────────────────────────────────────────────

function KPI({ label, value, sub, color = '#38bdf8' }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '0.82rem', color: 'var(--ts)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--td)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function PlanBadge({ plan }) {
  return (
    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 4,
      background: (PLAN_COLOR[plan] || '#64748b') + '22', color: PLAN_COLOR[plan] || '#64748b' }}>
      {PLAN_LABEL[plan] || plan}
    </span>
  );
}

function StatusBadge({ activo }) {
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: 4,
      background: activo ? '#14532d33' : '#450a0a33',
      color: activo ? '#4ade80' : '#f87171' }}>
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  );
}

// ── Tab: Dashboard ─────────────────────────────────────────────────────────────

// ── Stripe metrics panel ───────────────────────────────────────────────────────

function StripePanel() {
  const [stripe, setStripe] = useState(null);
  const [loading, setLoad]  = useState(true);

  useEffect(() => {
    adminApi.getStripeMetrics()
      .then(setStripe)
      .catch(() => setStripe({ configured: false }))
      .finally(() => setLoad(false));
  }, []);

  if (loading) return null;
  if (!stripe?.configured) return (
    <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid #f59e0b',
      fontSize: '0.82rem', color: 'var(--td)' }}>
      <strong style={{ color: '#f59e0b' }}>Stripe no configurado</strong> — Añade
      STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO y STRIPE_PRICE_PRO_PLUS
      en Railway para ver ingresos reales.
    </div>
  );
  if (stripe.error) return (
    <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid #ef4444',
      fontSize: '0.82rem', color: '#f87171' }}>
      Error Stripe: {stripe.error}
    </div>
  );

  return (
    <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid #635bff' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#635bff', marginBottom: '1rem',
        display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>💳</span> STRIPE — INGRESOS REALES
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '1rem',
        marginBottom: stripe.recent_payments?.length ? '1rem' : 0 }}>
        {[
          { label: 'MRR real',       value: `€${stripe.mrr?.toLocaleString('es-ES',{minimumFractionDigits:2})}`, color: '#4ade80' },
          { label: 'ARR estimado',   value: `€${stripe.arr?.toLocaleString('es-ES',{minimumFractionDigits:2})}`, color: '#38bdf8' },
          { label: 'Suscriptores',   value: stripe.subscribers, color: '#a78bfa' },
          { label: 'Pro activos',    value: stripe.pro_count, color: '#38bdf8' },
          { label: 'Pro+ activos',   value: stripe.pro_plus_count, color: '#a78bfa' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--td)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
      {stripe.recent_payments?.length > 0 && (
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--td)', fontWeight: 600,
            marginBottom: '0.5rem' }}>ÚLTIMOS PAGOS</div>
          {stripe.recent_payments.slice(0, 5).map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
              padding: '0.3rem 0', borderBottom: '1px solid #1e293b',
              fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--td)' }}>{p.email}</span>
              <span style={{ color: '#4ade80', fontWeight: 700 }}>
                €{p.amount?.toFixed(2)} · {new Date(p.date * 1000).toLocaleDateString('es-ES')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabDashboard({ data, onRefresh }) {
  const pieData = Object.entries(data.distribucion_planes).map(([k, v]) => ({
    name: PLAN_LABEL[k] || k, value: v, color: PLAN_COLOR[k] || '#64748b',
  }));

  return (
    <>
      <StripePanel />
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <KPI label="Usuarios totales"  value={data.usuarios_total}   color="#38bdf8" />
        <KPI label="Usuarios activos"  value={data.usuarios_activos} color="#4ade80" />
        <KPI label="Bots activos"      value={data.bots_activos} sub={`${data.bots_total} total`} color="#a78bfa" />
        <KPI label="Trades ejecutados" value={data.trades_total}     color="#fb923c" />
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div style={{ fontSize: '0.72rem', color: 'var(--td)', fontWeight: 600, marginBottom: '0.75rem' }}>INGRESOS MENSUALES (MRR)</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#4ade80' }}>€{data.ingresos_mes_eur.toLocaleString()}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--td)', marginTop: 4 }}>
            ARR estimado: <strong style={{ color: 'var(--ts)' }}>€{data.ingresos_arr_eur.toLocaleString()}</strong>
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: '0.72rem', color: 'var(--td)', fontWeight: 600, marginBottom: '0.75rem' }}>DISTRIBUCIÓN DE PLANES</div>
          {data.usuarios_total > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <PieChart width={120} height={120}>
                <Pie data={pieData} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value">
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
              <div style={{ flex: 1 }}>
                {pieData.map(e => (
                  <div key={e.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.82rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: e.color, display: 'inline-block' }} />
                      {e.name}
                    </span>
                    <span style={{ fontWeight: 700 }}>{e.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div style={{ color: 'var(--td)', fontSize: '0.85rem' }}>Sin usuarios aún</div>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--td)', fontWeight: 600, marginBottom: '1rem' }}>ACTIVIDAD SEMANAL</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.actividad_semanal} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" />
            <XAxis dataKey="dia" tick={{ fill: 'var(--td)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'var(--td)', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: 'var(--su)', border: '1px solid #334155', borderRadius: 6 }} />
            <Bar dataKey="bots_activos" name="Bots activos" fill="#38bdf8" radius={[3,3,0,0]} />
            <Bar dataKey="trades"       name="Trades"       fill="#a78bfa" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

// ── Tab: Usuarios ──────────────────────────────────────────────────────────────

function TabUsuarios({ onRefresh }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterPlan, setFP]   = useState('all');
  const [filterSt, setFS]     = useState('all');
  const [busy, setBusy]       = useState({});
  const [resetInfo, setRI]    = useState(null);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers(await adminApi.getUsers()); }
    catch (e) { setError(e.response?.data?.detail || e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (userId, fn) => {
    setBusy(b => ({ ...b, [userId]: true }));
    try { await fn(); await load(); } catch (e) { alert(e.response?.data?.detail || e.message); }
    finally { setBusy(b => ({ ...b, [userId]: false })); }
  };

  const filtered = users.filter(u => {
    const planOk = filterPlan === 'all' || u.plan === filterPlan;
    const stOk   = filterSt   === 'all' || (filterSt === 'active' ? u.activo : !u.activo);
    const srchOk = !search || u.email.toLowerCase().includes(search.toLowerCase())
                            || u.nombre.toLowerCase().includes(search.toLowerCase());
    return planOk && stOk && srchOk;
  });

  if (loading) return <p className="loading">Cargando usuarios...</p>;
  if (error)   return <p className="error-msg">{error}</p>;

  return (
    <>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', ...PLAN_OPTIONS].map(p => (
          <button key={p} className="btn" onClick={() => setFP(p)}
            style={{ fontSize: '0.78rem', border: '1px solid #334155',
              background: filterPlan === p ? (PLAN_COLOR[p] || '#0284c7') : 'var(--su)',
              color: filterPlan === p ? (p === 'all' ? 'white' : '#0f172a') : 'var(--ts)',
              fontWeight: filterPlan === p ? 700 : 400 }}>
            {p === 'all' ? 'Todos los planes' : PLAN_LABEL[p]}
          </button>
        ))}
        {['all','active','inactive'].map(s => (
          <button key={s} className="btn" onClick={() => setFS(s)}
            style={{ fontSize: '0.78rem', border: '1px solid #334155',
              background: filterSt === s ? 'var(--bd)' : 'var(--su)',
              color: filterSt === s ? 'var(--tx)' : 'var(--td)' }}>
            {{ all: 'Todos', active: 'Activos', inactive: 'Inactivos' }[s]}
          </button>
        ))}
        <input className="form-input" placeholder="Buscar por email o nombre…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 'auto', width: 220, fontSize: '0.82rem', padding: '0.35rem 0.7rem' }} />
        <button className="btn" onClick={load}
          style={{ fontSize: '0.78rem', background: 'var(--su)', color: 'var(--ts)', border: '1px solid #334155' }}>
          ↻
        </button>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--td)', marginBottom: '0.5rem' }}>
        {filtered.length} usuario{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Reset info banner */}
      {resetInfo && (
        <div style={{ padding: '0.75rem 1rem', background: '#0c4a6e33', border: '1px solid #0284c744',
          borderRadius: 8, marginBottom: '1rem', fontSize: '0.8rem', position: 'relative' }}>
          <button onClick={() => setRI(null)} style={{ position: 'absolute', top: 8, right: 10,
            background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>✕</button>
          <strong style={{ color: '#38bdf8' }}>Link de reset generado</strong>
          <div style={{ marginTop: '0.35rem', wordBreak: 'break-all', color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {resetInfo.reset_url}
          </div>
          <div style={{ marginTop: '0.3rem', color: '#64748b', fontSize: '0.72rem' }}>
            Token: {resetInfo.token} · Válido 24h
          </div>
        </div>
      )}

      {/* Tabla */}
      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ fontSize: '0.78rem', minWidth: 800 }}>
          <thead>
            <tr>
              <th>Usuario</th><th>Plan</th><th>Estado</th><th>Rol</th>
              <th>Registrado</th><th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--tx)' }}>{u.nombre}</div>
                  <div style={{ color: 'var(--td)', fontSize: '0.72rem' }}>{u.email}</div>
                  {u.email_verificado === false && (
                    <div style={{ color: '#f59e0b', fontSize: '0.68rem' }}>⚠ Email no verificado</div>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <PlanBadge plan={u.plan} />
                    <select
                      value={u.plan}
                      onChange={e => act(u.id, () => adminApi.updatePlan(u.id, e.target.value))}
                      disabled={busy[u.id]}
                      style={{ fontSize: '0.7rem', padding: '0.1rem 0.3rem', background: 'var(--su)',
                        border: '1px solid #334155', color: 'var(--ts)', borderRadius: 4, cursor: 'pointer' }}>
                      {PLAN_OPTIONS.map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
                    </select>
                  </div>
                </td>
                <td><StatusBadge activo={u.activo} /></td>
                <td>
                  {u.is_admin
                    ? <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f59e0b', padding: '0.15rem 0.4rem',
                        background: '#78350f33', borderRadius: 4 }}>ADMIN</span>
                    : <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Usuario</span>
                  }
                </td>
                <td style={{ color: 'var(--td)', fontSize: '0.72rem' }}>
                  {u.creado_en ? new Date(u.creado_en).toLocaleDateString('es-ES') : '—'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn" disabled={busy[u.id]}
                      onClick={() => act(u.id, () => adminApi.toggleStatus(u.id))}
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem',
                        background: u.activo ? '#78350f22' : '#14532d22',
                        color: u.activo ? '#f87171' : '#4ade80', border: `1px solid ${u.activo ? '#f8717133' : '#4ade8033'}` }}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button className="btn" disabled={busy[u.id]}
                      onClick={() => act(u.id, () => adminApi.toggleAdmin(u.id))}
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem',
                        background: '#78350f22', color: '#f59e0b', border: '1px solid #f59e0b33' }}>
                      {u.is_admin ? 'Quitar admin' : 'Hacer admin'}
                    </button>
                    <button className="btn" disabled={busy[u.id]}
                      onClick={async () => {
                        setBusy(b => ({ ...b, [u.id]: true }));
                        try {
                          const info = await adminApi.resetPassword(u.id);
                          setRI(info);
                        } catch (e) { alert(e.response?.data?.detail || e.message); }
                        finally { setBusy(b => ({ ...b, [u.id]: false })); }
                      }}
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem',
                        background: '#0c4a6e22', color: '#38bdf8', border: '1px solid #38bdf833' }}>
                      Reset pass
                    </button>
                    {!u.email_verificado && (
                      <button className="btn" disabled={busy[u.id]}
                        onClick={() => act(u.id, () => adminApi.verifyEmail(u.id))}
                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem',
                          background: '#14532d22', color: '#4ade80', border: '1px solid #4ade8033' }}>
                        Verificar email
                      </button>
                    )}
                    <button className="btn" disabled={busy[u.id]}
                      onClick={() => {
                        if (confirm(`¿Eliminar definitivamente a ${u.email}? Esta acción no se puede deshacer.`))
                          act(u.id, () => adminApi.deleteUser(u.id));
                      }}
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem',
                        background: '#450a0a22', color: '#f87171', border: '1px solid #f8717133' }}>
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--td)' }}>
          No hay usuarios que coincidan con los filtros.
        </div>
      )}
    </>
  );
}

// ── Tab: Audit Log ─────────────────────────────────────────────────────────────

const ACTION_META = {
  LOGIN_OK:         { label: 'Login OK',            color: '#4ade80' },
  LOGIN_FAIL:       { label: 'Login fallido',        color: '#f87171' },
  REGISTER:         { label: 'Registro',             color: '#38bdf8' },
  BOT_CREATED:      { label: 'Bot creado',           color: '#4ade80' },
  BOT_STARTED:      { label: 'Bot iniciado',         color: '#4ade80' },
  BOT_PAUSED:       { label: 'Bot pausado',          color: '#f59e0b' },
  BOT_STOPPED:      { label: 'Bot detenido',         color: '#f59e0b' },
  BOT_DELETED:      { label: 'Bot eliminado',        color: '#f87171' },
  TRADE_EXECUTED:   { label: 'Trade ejecutado',      color: '#a78bfa' },
  PLAN_CHANGED:     { label: 'Plan cambiado',        color: '#38bdf8' },
  USER_ACTIVATED:   { label: 'Usuario activado',     color: '#4ade80' },
  USER_DEACTIVATED: { label: 'Usuario desactivado',  color: '#f87171' },
  USER_DELETED:     { label: 'Usuario eliminado',    color: '#f87171' },
  ADMIN_PROMOTED:   { label: 'Admin promovido',      color: '#f59e0b' },
  ADMIN_REVOKED:    { label: 'Admin revocado',       color: '#f59e0b' },
  PASSWORD_RESET:   { label: 'Reset contraseña',     color: '#f59e0b' },
};

const ALL_ACTIONS = Object.keys(ACTION_META);

function ActionBadge({ action }) {
  const meta = ACTION_META[action] || { label: action, color: '#64748b' };
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem',
      borderRadius: 4, whiteSpace: 'nowrap',
      background: meta.color + '22', color: meta.color }}>
      {meta.label}
    </span>
  );
}

function DetailsSummary({ action, details }) {
  if (!details || Object.keys(details).length === 0) return <span style={{ color: 'var(--td)' }}>—</span>;
  if (action === 'TRADE_EXECUTED') {
    return (
      <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--ts)' }}>
        {details.side?.toUpperCase()} {details.amount} {details.symbol}
        {details.price ? ` @ $${Number(details.price).toLocaleString()}` : ''}
        {details.sandbox ? ' [sandbox]' : ' [real]'}
      </span>
    );
  }
  if (action === 'PLAN_CHANGED') {
    return (
      <span style={{ fontSize: '0.72rem', color: 'var(--ts)' }}>
        → <strong>{details.new_plan}</strong>
        {details.target_email ? ` (${details.target_email})` : ''}
      </span>
    );
  }
  if (action === 'LOGIN_FAIL') {
    const reasons = { wrong_password: 'contraseña incorrecta', user_not_found: 'usuario no encontrado',
                      email_not_verified: 'email no verificado', account_disabled: 'cuenta desactivada' };
    return <span style={{ fontSize: '0.72rem', color: '#f87171' }}>{reasons[details.reason] || details.reason}</span>;
  }
  if (['BOT_CREATED','BOT_STARTED','BOT_PAUSED','BOT_STOPPED','BOT_DELETED'].includes(action)) {
    return <span style={{ fontSize: '0.72rem', color: 'var(--ts)' }}>{details.name || details.bot_id}</span>;
  }
  if (['USER_ACTIVATED','USER_DEACTIVATED','USER_DELETED','ADMIN_PROMOTED','ADMIN_REVOKED','PASSWORD_RESET'].includes(action)) {
    return <span style={{ fontSize: '0.72rem', color: 'var(--ts)' }}>{details.target_email || details.target_user_id}</span>;
  }
  return <span style={{ fontSize: '0.72rem', color: 'var(--td)', fontFamily: 'monospace' }}>{JSON.stringify(details).slice(0, 60)}</span>;
}

function TabAuditLog() {
  const [rows,      setRows]    = useState([]);
  const [total,     setTotal]   = useState(0);
  const [loading,   setLoad]    = useState(true);
  const [error,     setError]   = useState(null);
  const [offset,    setOffset]  = useState(0);
  const LIMIT = 50;

  // Filtros
  const [fAction,   setFAction]   = useState('');
  const [fEmail,    setFEmail]    = useState('');
  const [fDateFrom, setFDateFrom] = useState('');
  const [fDateTo,   setFDateTo]   = useState('');

  const load = useCallback(async (off = offset) => {
    setLoad(true); setError(null);
    try {
      const params = { limit: LIMIT, offset: off };
      if (fAction)   params.action    = fAction;
      if (fDateFrom) params.date_from = fDateFrom;
      if (fDateTo)   params.date_to   = fDateTo;
      const res = await adminApi.getAuditLog(params);
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoad(false);
    }
  }, [fAction, fDateFrom, fDateTo, offset]);

  useEffect(() => { setOffset(0); }, [fAction, fDateFrom, fDateTo]);
  useEffect(() => { load(offset); }, [offset]); // eslint-disable-line

  const applyFilters = (e) => { e.preventDefault(); setOffset(0); load(0); };

  const filteredRows = fEmail
    ? rows.filter(r => r.user_email?.toLowerCase().includes(fEmail.toLowerCase()))
    : rows;

  return (
    <>
      {/* Filtros */}
      <form onSubmit={applyFilters}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--td)', marginBottom: '0.2rem' }}>Acción</div>
            <select value={fAction} onChange={e => setFAction(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', background: 'var(--su)',
                border: '1px solid #334155', color: 'var(--ts)', borderRadius: 6 }}>
              <option value=''>Todas las acciones</option>
              {ALL_ACTIONS.map(a => (
                <option key={a} value={a}>{ACTION_META[a].label}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--td)', marginBottom: '0.2rem' }}>Email (filtro local)</div>
            <input className="form-input" placeholder="usuario@email.com" value={fEmail}
              onChange={e => setFEmail(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', width: 200 }} />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--td)', marginBottom: '0.2rem' }}>Desde</div>
            <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', background: 'var(--su)',
                border: '1px solid #334155', color: 'var(--ts)', borderRadius: 6 }} />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--td)', marginBottom: '0.2rem' }}>Hasta</div>
            <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', background: 'var(--su)',
                border: '1px solid #334155', color: 'var(--ts)', borderRadius: 6 }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
            Filtrar
          </button>
          <button type="button" className="btn" onClick={() => { setFAction(''); setFEmail(''); setFDateFrom(''); setFDateTo(''); setOffset(0); load(0); }}
            style={{ fontSize: '0.8rem', background: 'var(--su)', color: 'var(--ts)', border: '1px solid #334155' }}>
            Limpiar
          </button>
          <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--td)', alignSelf: 'center' }}>
            {total.toLocaleString()} registro{total !== 1 ? 's' : ''} totales
          </div>
        </div>
      </form>

      {error && <p className="error-msg">{error}</p>}
      {loading ? (
        <p className="loading">Cargando audit log...</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ fontSize: '0.78rem', minWidth: 800 }}>
              <thead>
                <tr>
                  <th style={{ width: 150 }}>Fecha / Hora</th>
                  <th style={{ width: 130 }}>Acción</th>
                  <th>Usuario</th>
                  <th style={{ width: 130 }}>IP</th>
                  <th>Detalles</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--td)', padding: '2rem' }}>
                    Sin registros para estos filtros
                  </td></tr>
                ) : filteredRows.map(r => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--td)', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                      {r.created_at ? new Date(r.created_at).toLocaleString('es-ES', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                      }) : '—'}
                    </td>
                    <td><ActionBadge action={r.action} /></td>
                    <td>
                      {r.user_email
                        ? <span style={{ color: 'var(--ts)' }}>{r.user_email}</span>
                        : <span style={{ color: 'var(--td)' }}>—</span>
                      }
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--td)' }}>
                      {r.ip || '—'}
                    </td>
                    <td><DetailsSummary action={r.action} details={r.details} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {total > LIMIT && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center',
              gap: '1rem', marginTop: '1rem', fontSize: '0.82rem', color: 'var(--td)' }}>
              <button className="btn" disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                style={{ fontSize: '0.78rem' }}>← Anterior</button>
              <span>
                {offset + 1}–{Math.min(offset + LIMIT, total)} de {total.toLocaleString()}
              </span>
              <button className="btn" disabled={offset + LIMIT >= total}
                onClick={() => setOffset(offset + LIMIT)}
                style={{ fontSize: '0.78rem' }}>Siguiente →</button>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── 2FA Setup component ────────────────────────────────────────────────────────

function TwoFASection() {
  const [status,       setStatus]      = useState(null);   // {totp_enabled, backup_codes_left}
  const [loading,      setLoad]        = useState(true);
  const [view,         setView]        = useState('idle'); // idle|setup|enable|disable|regen
  const [setupData,    setSetupData]   = useState(null);   // {secret, totp_uri}
  const [qrUrl,        setQrUrl]       = useState('');
  const [code,         setCode]        = useState('');
  const [backupCodes,  setBackupCodes] = useState(null);   // [str] — visible only once
  const [error,        setError]       = useState(null);
  const [busy,         setBusy]        = useState(false);

  const loadStatus = async () => {
    setLoad(true);
    try { setStatus(await adminApi.get2faStatus()); }
    catch { /* silencioso */ }
    finally { setLoad(false); }
  };

  useEffect(() => { loadStatus(); }, []);

  // Genera QR cuando llegan los datos de setup
  useEffect(() => {
    if (!setupData?.totp_uri) return;
    import('qrcode').then(QRCode => {
      QRCode.toDataURL(setupData.totp_uri, { width: 220, margin: 2, color: { dark: '#0f172a', light: '#f8fafc' } })
        .then(setQrUrl).catch(() => {});
    });
  }, [setupData]);

  const startSetup = async () => {
    setError(null); setBusy(true);
    try {
      const data = await adminApi.get2faSetup();
      setSetupData(data);
      setView('setup');
    } catch (e) { setError(e.response?.data?.detail || e.message); }
    finally { setBusy(false); }
  };

  const confirmEnable = async (e) => {
    e.preventDefault(); setError(null); setBusy(true);
    try {
      const res = await adminApi.enable2fa(code);
      setBackupCodes(res.backup_codes);
      setView('backup_shown');
      setCode('');
      await loadStatus();
    } catch (e) { setError(e.response?.data?.detail || e.message); }
    finally { setBusy(false); }
  };

  const confirmDisable = async (e) => {
    e.preventDefault(); setError(null); setBusy(true);
    try {
      await adminApi.disable2fa(code);
      setView('idle'); setCode('');
      await loadStatus();
    } catch (e) { setError(e.response?.data?.detail || e.message); }
    finally { setBusy(false); }
  };

  const confirmRegen = async (e) => {
    e.preventDefault(); setError(null); setBusy(true);
    try {
      const res = await adminApi.regenerateBackupCodes(code);
      setBackupCodes(res.backup_codes);
      setView('backup_shown');
      setCode('');
      await loadStatus();
    } catch (e) { setError(e.response?.data?.detail || e.message); }
    finally { setBusy(false); }
  };

  const resetView = () => { setView('idle'); setCode(''); setError(null); setSetupData(null); setQrUrl(''); };

  if (loading) return <div className="card" style={{ marginBottom: '1.5rem' }}><p className="loading">Cargando estado 2FA...</p></div>;

  return (
    <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid #a78bfa' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>🔐 Autenticación de dos factores (2FA)</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--td)', marginTop: 2 }}>
            Protege tu cuenta de admin con Google Authenticator o compatible.
          </div>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 4,
          background: status?.totp_enabled ? '#14532d33' : '#1e293b',
          color: status?.totp_enabled ? '#4ade80' : '#64748b',
          border: `1px solid ${status?.totp_enabled ? '#4ade8044' : '#334155'}` }}>
          {status?.totp_enabled ? '● Activo' : '○ Inactivo'}
        </span>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: '0.75rem' }}>{error}</div>}

      {/* ── Idle: botones de acción ── */}
      {view === 'idle' && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {!status?.totp_enabled ? (
            <button className="btn btn-primary" style={{ fontSize: '0.82rem' }}
              onClick={startSetup} disabled={busy}>
              {busy ? 'Cargando...' : '+ Activar 2FA'}
            </button>
          ) : (
            <>
              <div style={{ fontSize: '0.8rem', color: 'var(--td)', alignSelf: 'center' }}>
                Códigos de respaldo restantes: <strong style={{ color: 'var(--ts)' }}>{status.backup_codes_left}</strong>
              </div>
              <button className="btn" style={{ fontSize: '0.8rem', marginLeft: 'auto',
                background: '#1e3a5f22', color: '#60a5fa', border: '1px solid #60a5fa33' }}
                onClick={() => { setView('regen'); setError(null); }}>
                ↻ Regenerar códigos
              </button>
              <button className="btn" style={{ fontSize: '0.8rem',
                background: '#450a0a22', color: '#f87171', border: '1px solid #f8717133' }}
                onClick={() => { setView('disable'); setError(null); }}>
                Desactivar 2FA
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Setup: muestra QR ── */}
      {view === 'setup' && setupData && (
        <div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              {qrUrl
                ? <img src={qrUrl} alt="QR 2FA" width={200} height={200}
                    style={{ borderRadius: 8, border: '4px solid #f8fafc' }} />
                : <div style={{ width: 200, height: 200, background: '#334155', borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--td)', fontSize: '0.8rem' }}>Generando QR...</div>
              }
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--td)', marginBottom: '0.5rem' }}>
                1. Abre <strong style={{ color: 'var(--ts)' }}>Google Authenticator</strong> (o Authy, Bitwarden, etc.)
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--td)', marginBottom: '0.5rem' }}>
                2. Escanea el código QR o introduce la clave manual:
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.82rem', letterSpacing: '0.1em',
                padding: '0.5rem 0.75rem', background: '#0f172a', borderRadius: 6,
                border: '1px solid #334155', color: '#a78bfa', wordBreak: 'break-all',
                marginBottom: '0.75rem' }}>
                {setupData.secret}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--td)', marginBottom: '1rem' }}>
                3. Introduce el código de 6 dígitos que aparece en la app:
              </div>
              <form onSubmit={confirmEnable} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <input className="form-input" placeholder="000000" value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6} inputMode="numeric" autoComplete="one-time-code"
                    style={{ fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: '0.3em',
                      textAlign: 'center' }} required />
                </div>
                <button type="submit" className="btn btn-primary" disabled={busy || code.length < 6}
                  style={{ whiteSpace: 'nowrap' }}>
                  {busy ? '...' : 'Activar 2FA'}
                </button>
              </form>
            </div>
          </div>
          <button className="btn" style={{ fontSize: '0.78rem', color: 'var(--td)' }}
            onClick={resetView}>Cancelar</button>
        </div>
      )}

      {/* ── Backup codes mostrados (solo tras activar o regenerar) ── */}
      {view === 'backup_shown' && backupCodes && (
        <div>
          <div style={{ padding: '0.75rem 1rem', background: '#78350f22', border: '1px solid #f59e0b44',
            borderRadius: 8, marginBottom: '1rem', fontSize: '0.82rem', color: '#fbbf24' }}>
            ⚠ <strong>Guarda estos códigos ahora.</strong> No volverán a mostrarse.
            Úsalos si pierdes acceso a tu app de autenticación.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem',
            marginBottom: '1rem' }}>
            {backupCodes.map((c, i) => (
              <div key={i} style={{ fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 700,
                padding: '0.4rem 0.6rem', background: '#0f172a', border: '1px solid #334155',
                borderRadius: 6, textAlign: 'center', color: '#e2e8f0', letterSpacing: '0.08em' }}>
                {c}
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ fontSize: '0.82rem' }}
            onClick={() => { setView('idle'); setBackupCodes(null); }}>
            He guardado los códigos ✓
          </button>
        </div>
      )}

      {/* ── Desactivar 2FA ── */}
      {view === 'disable' && (
        <form onSubmit={confirmDisable}>
          <div style={{ fontSize: '0.82rem', color: 'var(--td)', marginBottom: '0.75rem' }}>
            Introduce tu código TOTP actual para desactivar el 2FA:
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <input className="form-input" placeholder="000000 o código de respaldo" value={code}
              onChange={e => setCode(e.target.value.replace(/\s/g, '').slice(0, 10))}
              maxLength={10} inputMode="numeric" style={{ maxWidth: 240 }} required />
            <button type="submit" className="btn" disabled={busy}
              style={{ background: '#450a0a22', color: '#f87171', border: '1px solid #f8717133' }}>
              {busy ? '...' : 'Desactivar'}
            </button>
            <button type="button" className="btn" onClick={resetView}
              style={{ color: 'var(--td)' }}>Cancelar</button>
          </div>
        </form>
      )}

      {/* ── Regenerar códigos de respaldo ── */}
      {view === 'regen' && (
        <form onSubmit={confirmRegen}>
          <div style={{ fontSize: '0.82rem', color: 'var(--td)', marginBottom: '0.75rem' }}>
            Introduce tu código TOTP actual para regenerar los códigos de respaldo:
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <input className="form-input" placeholder="000000" value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6} inputMode="numeric" style={{ maxWidth: 200 }} required />
            <button type="submit" className="btn btn-primary" disabled={busy || code.length < 6}>
              {busy ? '...' : 'Regenerar'}
            </button>
            <button type="button" className="btn" onClick={resetView}
              style={{ color: 'var(--td)' }}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Tab: Seguridad ─────────────────────────────────────────────────────────────

const SECURITY_CHECKS = [
  { id: 'cors',        label: 'CORS con orígenes explícitos',         status: 'ok',  detail: 'allow_origins usa lista explícita de dominios permitidos' },
  { id: 'headers',     label: 'Security headers HTTP',                status: 'ok',  detail: 'X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, Permissions-Policy' },
  { id: 'jwt',         label: 'JWT con iat + jti + is_admin',         status: 'ok',  detail: 'Tokens incluyen issued-at, JWT ID único y flag de admin' },
  { id: 'bcrypt',      label: 'bcrypt rounds=12 para contraseñas',    status: 'ok',  detail: 'Factor de coste alto, resistente a fuerza bruta' },
  { id: 'portfolio',   label: 'Endpoints Portfolio autenticados',      status: 'ok',  detail: 'Todos los endpoints de portfolio requieren JWT válido' },
  { id: 'admin_auth',  label: 'Panel Admin protegido con rol admin',   status: 'ok',  detail: 'Todos los endpoints /admin/* requieren Depends(get_admin_user) con verificación en BD' },
  { id: 'password',    label: 'Política de contraseñas fuerte',        status: 'ok',  detail: 'Mínimo 8 chars, mayúscula, minúscula, número y carácter especial' },
  { id: 'validation',  label: 'Handler 422 con CORS headers',         status: 'ok',  detail: 'RequestValidationError siempre devuelve Access-Control-Allow-Origin' },
  { id: 'pii',         label: 'PII no expuesta en logs de error',     status: 'ok',  detail: 'Mensajes de error genéricos en producción, sin stack traces' },
  { id: 'sql',         label: 'Protección SQL injection',             status: 'ok',  detail: 'SQLAlchemy ORM con queries parametrizadas, sin SQL raw' },
  { id: 'xss',         label: 'Protección XSS (frontend)',            status: 'ok',  detail: 'React JSX escapa automáticamente todos los valores, X-XSS-Protection header activo' },
  { id: 'rate_limit',  label: 'Rate limiting en endpoints críticos',  status: 'ok',   detail: 'slowapi: 5 intentos/15 min por IP en /auth/login y /auth/register, 429 con CORS headers' },
  { id: 'token_rev',   label: 'Revocación de tokens JWT',             status: 'warn', detail: 'JWTs no son revocables en tiempo real. Mitigado con expiración de 7 días y jti claim' },
  { id: 'audit_log',   label: 'Audit log de acciones importantes',    status: 'ok',   detail: 'Registra logins, bots, trades, cambios de plan y acciones admin con IP, usuario y detalles' },
  { id: '2fa',         label: 'Autenticación de dos factores (2FA)',  status: 'ok',   detail: 'TOTP (Google Authenticator) activable por admin en el panel → Seguridad. Ventana ±90 s, códigos de respaldo de un solo uso.' },
];

function SecurityRow({ check }) {
  const icons = { ok: '✓', warn: '⚠', info: 'ℹ' };
  const colors = { ok: '#4ade80', warn: '#f59e0b', info: '#38bdf8' };
  return (
    <tr>
      <td style={{ width: 32, textAlign: 'center', color: colors[check.status], fontWeight: 700, fontSize: '0.9rem' }}>
        {icons[check.status]}
      </td>
      <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{check.label}</td>
      <td style={{ fontSize: '0.76rem', color: 'var(--td)', lineHeight: 1.5 }}>{check.detail}</td>
    </tr>
  );
}

function TabSeguridad() {
  return (
    <>
      <TwoFASection />
      <TabSeguridadChecklist />
    </>
  );
}

function TabSeguridadChecklist() {
  const ok   = SECURITY_CHECKS.filter(c => c.status === 'ok').length;
  const warn = SECURITY_CHECKS.filter(c => c.status === 'warn').length;
  const info = SECURITY_CHECKS.filter(c => c.status === 'info').length;
  const score = Math.round((ok / SECURITY_CHECKS.length) * 100);

  return (
    <>
      {/* Score */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ textAlign: 'center', borderLeft: '3px solid #4ade80' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: score >= 80 ? '#4ade80' : '#f59e0b' }}>{score}%</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ts)' }}>Puntuación de seguridad</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderLeft: '3px solid #4ade80' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#4ade80' }}>{ok}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ts)' }}>Controles activos</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderLeft: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b' }}>{warn}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ts)' }}>Mejoras recomendadas</div>
        </div>
        <div className="card" style={{ textAlign: 'center', borderLeft: '3px solid #38bdf8' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8' }}>{info}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ts)' }}>Funciones opcionales</div>
        </div>
      </div>

      {/* Checklist */}
      <div className="card">
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--td)', marginBottom: '1rem' }}>
          CHECKLIST DE SEGURIDAD
        </div>
        <table className="table" style={{ fontSize: '0.8rem' }}>
          <thead>
            <tr><th style={{ width: 32 }} /><th>Control</th><th>Descripción</th></tr>
          </thead>
          <tbody>
            {SECURITY_CHECKS.map(c => <SecurityRow key={c.id} check={c} />)}
          </tbody>
        </table>
      </div>

      {/* Info extra */}
      <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.5rem' }}>PRÓXIMAS MEJORAS RECOMENDADAS</div>
          {['Caducidad de sesiones inactivas (sliding window)',
            'Geolocalización IP con base de datos GeoIP2',
          ].map((item, i) => (
            <div key={i} style={{ fontSize: '0.78rem', color: 'var(--td)', marginBottom: '0.3rem' }}>⚠ {item}</div>
          ))}
        </div>
        <div className="card" style={{ borderLeft: '3px solid #4ade80' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4ade80', marginBottom: '0.5rem' }}>CONTROLES ACTIVOS</div>
          {['bcrypt rounds=12 (resistente a GPUs)', 'JWT con expiración 7 días + jti único',
            'HSTS 2 años + includeSubDomains + preload',
            'X-Frame-Options: DENY (anti-clickjacking)',
            'X-Content-Type-Options: nosniff (anti-MIME sniffing)',
            'Política de contraseñas: 8+ chars, mayus, minus, número, especial',
            'Admin verificado en BD en cada request (no solo JWT)',
            'Alertas email: >3 fallos de login / IP nueva detectada',
          ].map((item, i) => (
            <div key={i} style={{ fontSize: '0.78rem', color: 'var(--td)', marginBottom: '0.3rem' }}>✓ {item}</div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Main Admin ─────────────────────────────────────────────────────────────────

export default function Admin() {
  const [tab, setTab]       = useState('dashboard');
  const [data, setData]     = useState(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState(null);

  const loadMetricas = useCallback(() => {
    setLoad(true);
    adminApi.getMetricas()
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(e.response?.data?.detail || e.message))
      .finally(() => setLoad(false));
  }, []);

  useEffect(() => {
    loadMetricas();
    const id = setInterval(loadMetricas, 30_000); // auto-refresh cada 30 s
    return () => clearInterval(id);
  }, [loadMetricas]);

  const TABS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'users',     label: 'Usuarios' },
    { id: 'auditlog',  label: 'Audit Log' },
    { id: 'security',  label: 'Seguridad' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Panel de Administración</h1>
          <p style={{ color: 'var(--td)', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>
            Gestión completa de usuarios, suscripciones y seguridad
          </p>
        </div>
        <button className="btn"
          style={{ fontSize: '0.8rem', background: 'var(--su)', color: 'var(--ts)', border: '1px solid #334155' }}
          onClick={loadMetricas}>
          ↻ Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem',
        borderBottom: '1px solid #334155', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: tab === t.id ? 700 : 400,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.id ? 'var(--tx)' : 'var(--td)',
              borderBottom: `2px solid ${tab === t.id ? '#0284c7' : 'transparent'}`,
              marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Error de acceso */}
      {error && (
        <div style={{ padding: '1rem', background: '#450a0a33', border: '1px solid #f87171',
          borderRadius: 8, marginBottom: '1rem', color: '#f87171', fontSize: '0.85rem' }}>
          {error.includes('administrador') || error.includes('403')
            ? '🔒 Acceso denegado. Solo los administradores pueden ver este panel.'
            : error}
        </div>
      )}

      {/* Contenido */}
      {tab === 'dashboard' && (
        loading
          ? <p className="loading">Cargando métricas...</p>
          : data
            ? <TabDashboard data={data} onRefresh={loadMetricas} />
            : !error && <p className="error-msg">No se pudieron cargar las métricas</p>
      )}
      {tab === 'users'    && <TabUsuarios onRefresh={loadMetricas} />}
      {tab === 'auditlog' && <TabAuditLog />}
      {tab === 'security' && <TabSeguridad />}
    </div>
  );
}
