import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const fmt = (v) => `€${v?.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function BacktestChart({ data, initialCapital }) {
  if (!data || data.length === 0) return null;

  // Mostrar solo ~60 puntos para no saturar el eje X
  const step = Math.max(1, Math.floor(data.length / 60));
  const reduced = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={reduced} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="fecha"
          tick={{ fill: '#64748b', fontSize: 10 }}
          interval="preserveStartEnd"
          tickFormatter={d => d.slice(5)}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={fmt}
          domain={['auto', 'auto']}
        />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
          labelStyle={{ color: '#94a3b8', fontSize: 11 }}
          formatter={(v, name) => [fmt(v), name === 'capital' ? 'Estrategia' : 'Buy & Hold']}
        />
        <Legend
          formatter={v => v === 'capital' ? 'Estrategia' : 'Buy & Hold'}
          wrapperStyle={{ fontSize: 12, color: '#94a3b8' }}
        />
        {initialCapital && (
          <ReferenceLine y={initialCapital} stroke="#334155" strokeDasharray="4 4" />
        )}
        <Line type="monotone" dataKey="capital"   stroke="#38bdf8" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="buy_hold"  stroke="#a78bfa" strokeWidth={2} dot={false} strokeDasharray="5 3" />
      </LineChart>
    </ResponsiveContainer>
  );
}
