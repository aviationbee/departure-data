import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Automatic live build version check & cache-buster so every user gets new updates immediately
async function checkAndReloadIfNewVersionAvailable() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    const currentScript = Array.from(document.querySelectorAll('script[src]'))
      .map((s) => s.getAttribute('src') || '')
      .find((src) => src.includes('assets/index-'));
    if (!currentScript) return;

    const currentAssetName = currentScript.split('/').pop()?.split('?')[0];
    if (!currentAssetName) return;

    const baseUrl = window.location.pathname.endsWith('/')
      ? window.location.pathname
      : window.location.pathname.replace(/\/[^/]*$/, '/');
    const res = await fetch(`${baseUrl}index.html?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (!res.ok) return;
    const html = await res.text();
    const match = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/);
    if (match && match[1] && match[1] !== currentAssetName) {
      const reloadKey = `usba_reloaded_${match[1]}`;
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.replace(`${baseUrl}?v=${match[1]}`);
      }
    }
  } catch {
    // Ignore offline or dev-server check errors
  }
}

checkAndReloadIfNewVersionAvailable();
window.addEventListener('focus', checkAndReloadIfNewVersionAvailable);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkAndReloadIfNewVersionAvailable();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

