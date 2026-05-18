import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const INACTIVE_MS = 30 * 60 * 1000;  // 30 min sin actividad → cerrar sesión
const WARN_MS     =  5 * 60 * 1000;  // aviso 5 min antes

function jwtExpiry(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64)).exp * 1000;
  } catch { return null; }
}

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function SessionManager() {
  const { token, logout, refreshToken } = useAuth();
  const navigate        = useNavigate();
  const lastActivity    = useRef(Date.now());
  const refreshing      = useRef(false);
  const [timeLeft, setTimeLeft] = useState(null);

  // Actualiza lastActivity con cualquier interacción del usuario
  useEffect(() => {
    const bump = () => { lastActivity.current = Date.now(); };
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart', 'pointerdown'];
    events.forEach(e => window.addEventListener(e, bump, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, bump));
  }, []);

  const doLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  // Tick cada segundo: comprueba inactividad y refresca el JWT si hace falta
  useEffect(() => {
    if (!token) { setTimeLeft(null); return; }
    lastActivity.current = Date.now(); // reinicia el reloj al montar / cambiar token

    const tick = async () => {
      const now      = Date.now();
      const inactive = now - lastActivity.current;
      const left     = INACTIVE_MS - inactive;

      if (left <= 0) { doLogout(); return; }

      setTimeLeft(left);

      // Auto-refresca el JWT si expira pronto y el usuario está activo (< 2 min inactivo)
      const expiry = jwtExpiry(token);
      const jwtLeft = expiry ? expiry - now : Infinity;
      if (jwtLeft < WARN_MS && inactive < 2 * 60 * 1000 && !refreshing.current) {
        refreshing.current = true;
        try { await refreshToken(); }
        catch { doLogout(); }
        finally { refreshing.current = false; }
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [token, doLogout, refreshToken]);

  const continueSession = async () => {
    lastActivity.current = Date.now();
    try { await refreshToken(); }
    catch { doLogout(); }
  };

  // Solo muestra el banner cuando quedan menos de 5 minutos
  if (!token || !timeLeft || timeLeft > WARN_MS) return null;

  const urgent = timeLeft < 60_000; // rojo al quedar < 1 min

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '1rem', flexWrap: 'wrap',
      padding: '0.65rem 1.25rem',
      background: urgent ? '#7f1d1d' : '#78350f',
      borderBottom: `2px solid ${urgent ? '#ef4444' : '#f59e0b'}`,
      fontSize: '0.85rem', color: urgent ? '#fca5a5' : '#fde68a',
      boxShadow: '0 2px 12px #0008',
    }}>
      <span>
        {urgent ? '🚨' : '⏱'}{' '}
        <strong>Sesión por expirar</strong>{' '}
        — Sin actividad. Cierre automático en{' '}
        <strong style={{ fontFamily: 'monospace', fontSize: '0.95rem' }}>
          {fmt(timeLeft)}
        </strong>
      </span>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={continueSession}
          style={{
            padding: '0.3rem 0.9rem', borderRadius: 6, border: 'none',
            background: urgent ? '#ef4444' : '#f59e0b',
            color: '#0f172a', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem',
          }}>
          Continuar sesión
        </button>
        <button
          onClick={doLogout}
          style={{
            padding: '0.3rem 0.9rem', borderRadius: 6,
            background: 'transparent', cursor: 'pointer', fontSize: '0.82rem',
            border: `1px solid ${urgent ? '#ef444466' : '#f59e0b66'}`,
            color: urgent ? '#fca5a5' : '#fde68a',
          }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
