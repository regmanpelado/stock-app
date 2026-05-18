import React from 'react';
import { useFetch } from '../hooks/useExchange';
import { exchangeApi } from '../services/api';

export default function ExchangeStatus() {
  const { data, loading, error } = useFetch(() => exchangeApi.getAllStatus());

  if (loading) return <p className="loading">Verificando exchanges...</p>;
  if (error) return <p className="error-msg">{error}</p>;

  return (
    <div className="grid-4">
      {data?.map((item) => (
        <div key={item.exchange} className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`status-dot ${item.connected ? 'ok' : 'err'}`} />
          <div>
            <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{item.exchange}</div>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
              {item.connected ? 'Conectado' : item.error || 'Error'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
