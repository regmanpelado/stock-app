import { useState, useEffect } from 'react';

const STORAGE_KEY = 'pwa-install-dismissed';

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible,        setVisible]        = useState(false);

  useEffect(() => {
    // No mostrar si el usuario ya lo descartó antes
    if (localStorage.getItem(STORAGE_KEY)) return;

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled',        onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled',        onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.85rem 1.25rem',
      background: 'linear-gradient(135deg, #1e293b, #0f172a)',
      borderTop: '1px solid #334155',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      flexWrap: 'wrap',
    }}>
      {/* Icono */}
      <img src="/icons/icon.svg" alt="" width={36} height={36}
        style={{ borderRadius: 8, flexShrink: 0 }} />

      {/* Texto */}
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#e2e8f0' }}>
          Instala Stock App
        </div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
          Accede más rápido desde tu pantalla de inicio
        </div>
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button
          onClick={install}
          style={{
            padding: '0.45rem 1.1rem', borderRadius: 8, border: 'none',
            background: '#38bdf8', color: '#0f172a',
            fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
          }}>
          Instalar
        </button>
        <button
          onClick={dismiss}
          style={{
            padding: '0.45rem 0.75rem', borderRadius: 8,
            background: 'transparent', border: '1px solid #334155',
            color: '#64748b', fontSize: '0.82rem', cursor: 'pointer',
          }}>
          Ahora no
        </button>
      </div>
    </div>
  );
}
