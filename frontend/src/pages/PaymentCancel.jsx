import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PaymentCancel() {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100vh - 60px)', padding: '2rem',
    }}>
      <div className="card" style={{
        maxWidth: 420, width: '100%', textAlign: 'center',
        borderTop: '4px solid #f59e0b', padding: '2.5rem 2rem',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>↩️</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.75rem' }}>
          Pago cancelado
        </h1>
        <p style={{ color: 'var(--td)', lineHeight: 1.6, marginBottom: '1.75rem' }}>
          No se ha realizado ningún cargo. Puedes activar tu plan cuando quieras.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/pricing')}>
            Ver planes
          </button>
          <button className="btn" onClick={() => navigate('/')}
            style={{ background: 'var(--su)', color: 'var(--ts)', border: '1px solid var(--bd)' }}>
            Ir al dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
