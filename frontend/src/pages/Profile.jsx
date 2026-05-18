import React, { useState } from 'react';
import { authApi } from '../services/api.jsx';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg]         = useState(null);
  const [err, setErr]         = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (next !== confirm) {
      setErr('Las contraseñas nuevas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword(current, next);
      setMsg('Contraseña actualizada correctamente');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (ex) {
      setErr(ex.response?.data?.detail || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <h1 className="page-title">Mi perfil</h1>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--td)', fontWeight: 600, marginBottom: '0.75rem' }}>
          INFORMACIÓN DE CUENTA
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem' }}>
          <div><span style={{ color: 'var(--td)' }}>Nombre:</span> <strong>{user?.nombre}</strong></div>
          <div><span style={{ color: 'var(--td)' }}>Email:</span> <strong>{user?.email}</strong></div>
          <div><span style={{ color: 'var(--td)' }}>Plan:</span> <strong style={{ textTransform: 'capitalize' }}>{user?.plan}</strong></div>
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: '0.72rem', color: 'var(--td)', fontWeight: 600, marginBottom: '1rem' }}>
          CAMBIAR CONTRASEÑA
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--td)', display: 'block', marginBottom: 4 }}>
              Contraseña actual
            </label>
            <input
              type="password"
              className="input"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--td)', display: 'block', marginBottom: 4 }}>
              Nueva contraseña
            </label>
            <input
              type="password"
              className="input"
              value={next}
              onChange={e => setNext(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--td)', display: 'block', marginBottom: 4 }}>
              Confirmar nueva contraseña
            </label>
            <input
              type="password"
              className="input"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          {err && <div className="error-msg">{err}</div>}
          {msg && <div style={{ color: '#4ade80', fontSize: '0.85rem', padding: '0.5rem 0' }}>{msg}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
