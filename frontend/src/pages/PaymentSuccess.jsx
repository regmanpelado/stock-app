import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

export default function PaymentSuccess() {
  const navigate              = useNavigate();
  const [params]              = useSearchParams();
  const { token, login, user } = useAuth();
  const [countdown, setCountdown] = useState(8);
  const [planName, setPlanName]   = useState('Pro');

  // Si el usuario está logueado, refresca su perfil para mostrar el nuevo plan
  useEffect(() => {
    if (!token) return;
    authApi.me().then(updatedUser => {
      login(token, updatedUser);
      setPlanName(updatedUser.plan === 'pro_plus' ? 'Pro+' : 'Pro');
    }).catch(() => {});
  }, [token]);

  // Countdown: si está logueado va al dashboard, si no al login
  useEffect(() => {
    if (countdown <= 0) {
      navigate(token ? '/' : '/login');
      return;
    }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown, navigate, token]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '2rem',
      background: 'var(--bg, #0f172a)',
    }}>
      <div style={{
        maxWidth: 460, width: '100%', textAlign: 'center',
        background: 'var(--su, #1e293b)', border: '1px solid #334155',
        borderRadius: 12, borderTop: '4px solid #4ade80',
        padding: '2.5rem 2rem',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4ade80', margin: '0 0 0.75rem' }}>
          Pago completado
        </h1>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Tu suscripción <strong style={{ color: '#e2e8f0' }}>{planName}</strong> está activa.
          El plan se actualizará en tu cuenta en unos segundos.
        </p>

        {!token && (
          <div style={{ padding: '0.875rem 1rem', background: '#0c4a6e22',
            border: '1px solid #0284c744', borderRadius: 8, marginBottom: '1.5rem',
            fontSize: '0.82rem', color: '#94a3b8' }}>
            Inicia sesión para ver tu nuevo plan activo.
          </div>
        )}

        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
          Redirigiendo en <strong style={{ color: '#e2e8f0' }}>{countdown}</strong> s…
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {token
            ? <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate('/')}>
                Ir al dashboard
              </button>
            : <Link to="/login" className="btn btn-primary" style={{ flex: 1, textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                Iniciar sesión
              </Link>
          }
        </div>
      </div>
    </div>
  );
}
