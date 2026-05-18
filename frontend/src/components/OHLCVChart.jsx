import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function OHLCVChart({ data }) {
  const formatted = data?.map(c => ({
    time: new Date(c.timestamp).toLocaleTimeString(),
    close: c.close,
    volume: c.volume,
  })) || [];

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={formatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
          labelStyle={{ color: '#94a3b8' }}
        />
        <Area type="monotone" dataKey="close" stroke="#0284c7" fill="url(#colorClose)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
