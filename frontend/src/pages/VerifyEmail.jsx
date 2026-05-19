import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token          = searchParams.get('token') || '';
  const [status, setStatus] = useState('loading'); // loading | success | error

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    authApi.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-header">
          <div className="auth-logo">Stock App</div>
          <h1 className="auth-title">
            {status === 'loading' && 'Verificando...'}
            {status === 'success' && 'Email verificado'}
            {status === 'error'   && 'Enlace inválido'}
          </h1>
        </div>

        {status === 'loading' && (
          <p className="loading">Verificando tu email, por favor espera...</p>
        )}

        {status === 'success' && (
          <>
            <p style={{ color: 'var(--ts)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Tu email ha sido verificado correctamente. Ya puedes iniciar sesión en tu cuenta.
            </p>
            <Link to="/login" className="btn btn-primary auth-btn" style={{ textAlign: 'center', textDecoration: 'none' }}>
              Iniciar sesión
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <p style={{ color: 'var(--ts)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              El enlace de verificación no es válido o ya ha sido utilizado.
            </p>
            <Link to="/register" className="btn btn-primary auth-btn" style={{ textAlign: 'center', textDecoration: 'none' }}>
              Registrarse de nuevo
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
