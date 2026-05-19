import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // 2FA state
  const [step, setStep]         = useState('credentials'); // 'credentials' | 'totp'
  const [totpToken, setTotpToken] = useState('');
  const [totpCode, setTotpCode]   = useState('');
  const totpInputRef              = useRef(null);

  const { login }   = useAuth();
  const navigate    = useNavigate();

  useEffect(() => {
    if (step === 'totp') totpInputRef.current?.focus();
  }, [step]);

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await authApi.login(email, password);
      if (data.requires_2fa) {
        setTotpToken(data.totp_token);
        setStep('totp');
      } else {
        login(data.access_token, data.user);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleTotp = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await authApi.verify2fa(totpToken, totpCode);
      login(data.access_token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Código incorrecto');
      setTotpCode('');
      totpInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-header">
          <div className="auth-logo">Stock App</div>
          <h1 className="auth-title">
            {step === 'credentials' ? 'Iniciar sesión' : 'Verificación 2FA'}
          </h1>
          {step === 'totp' && (
            <p style={{ fontSize: '0.83rem', color: 'var(--td)', margin: '0.35rem 0 0' }}>
              Introduce el código de 6 dígitos de tu app de autenticación.
            </p>
          )}
        </div>

        {error && <div className="error-msg" style={{ marginBottom: '1rem' }}>{error}</div>}

        {step === 'credentials' ? (
          <form onSubmit={handleCredentials}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input type="password" className="form-input" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
              {loading ? 'Cargando...' : 'Iniciar sesión'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleTotp}>
            {/* Icono de escudo */}
            <div style={{ textAlign: 'center', fontSize: '2.5rem', margin: '0.5rem 0 1.25rem' }}>
              🔐
            </div>
            <div className="form-group">
              <label className="form-label">Código de autenticación</label>
              <input
                ref={totpInputRef}
                className="form-input"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                style={{ fontSize: '1.5rem', letterSpacing: '0.3em', textAlign: 'center',
                  fontFamily: 'monospace' }}
                required
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--td)', marginTop: '0.4rem' }}>
                También puedes introducir uno de tus <strong>códigos de respaldo</strong> de 8 caracteres.
              </div>
            </div>
            <button type="submit" className="btn btn-primary auth-btn"
              disabled={loading || totpCode.length < 6}>
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
            <button type="button" className="btn auth-btn"
              style={{ marginTop: '0.5rem', background: 'var(--su)', color: 'var(--td)',
                border: '1px solid #334155' }}
              onClick={() => { setStep('credentials'); setError(''); setTotpCode(''); }}>
              ← Volver al login
            </button>
          </form>
        )}

        {step === 'credentials' && (
          <>
            <div className="auth-links">
              <Link to="/forgot-password" className="auth-link">¿Olvidaste tu contraseña?</Link>
            </div>
            <div className="auth-footer">
              ¿No tienes cuenta? <Link to="/register" className="auth-link">Regístrate gratis</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
