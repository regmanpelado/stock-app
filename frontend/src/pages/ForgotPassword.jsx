import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al enviar el email');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card card">
          <div className="auth-header">
            <div className="auth-logo">Crypto App</div>
            <h1 className="auth-title">Email enviado</h1>
          </div>
          <p style={{ color: 'var(--ts)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Si el email está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
          </p>
          <Link to="/login" className="btn btn-primary auth-btn" style={{ textAlign: 'center', textDecoration: 'none' }}>
            Volver al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-header">
          <div className="auth-logo">Crypto App</div>
          <h1 className="auth-title">Recuperar contraseña</h1>
        </div>
        <p style={{ color: 'var(--ts)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
        </p>

        {error && <div className="error-msg" style={{ marginBottom: '1rem' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/login" className="auth-link">Volver al login</Link>
        </div>
      </div>
    </div>
  );
}
