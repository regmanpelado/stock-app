import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { CurrencyProvider } from './context/CurrencyContext.jsx';

// Registro del Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <CurrencyProvider>
      <App />
    </CurrencyProvider>
  </React.StrictMode>
);
