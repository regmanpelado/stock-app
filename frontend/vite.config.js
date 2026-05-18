import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // El proxy solo aplica en desarrollo (vite serve).
  // En producción (vite build) las llamadas van directamente a VITE_API_URL.
  server: command === 'serve' ? {
    port: 3000,
    proxy: {
      '/exchanges':      'http://localhost:8000',
      '/markets':        'http://localhost:8000',
      '/portfolio':      'http://localhost:8000',
      '/orders':         'http://localhost:8000',
      '/signals/':       'http://localhost:8000',
      '/bots/':          'http://localhost:8000',
      '/predictions/':   'http://localhost:8000',
      '/subscriptions/': 'http://localhost:8000',
      '/admin/':         'http://localhost:8000',
      '/backtest/':      'http://localhost:8000',
      '/currency/':      'http://localhost:8000',
      '/news/':          'http://localhost:8000',
      '/health':         'http://localhost:8000',
    },
  } : {},
}));
