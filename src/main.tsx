import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Active runtime build tag
const RUNTIME_BUILD_KEY = 'usba_active_runtime_build';

// Automatic live build version check & cache-buster so every user gets new updates in real time without manual refreshing
async function checkAndApplyLiveUpdatesRealtime() {
  try {
    // 1. Unregister any obsolete service workers to prevent cache trapping
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      } catch {
        // Safe to ignore in restricted sandboxes
      }
    }

    // 2. Identify the currently executing script bundle
    const currentScript = Array.from(document.querySelectorAll('script[src]'))
      .map((s) => s.getAttribute('src') || '')
      .find((src) => src.includes('assets/index-'));

    const currentAssetName = currentScript ? currentScript.split('/').pop()?.split('?')[0] : null;

    // 3. Clean up any stale query parameters (like ?v=index-D9haaPYW.js) from the URL bar cleanly
    const currentSearch = window.location.search;
    if (currentSearch && (currentSearch.includes('?v=') || currentSearch.includes('&v=') || currentSearch.includes('_upd='))) {
      const cleanUrl = window.location.pathname + window.location.hash;
      try {
        window.history.replaceState(null, '', cleanUrl);
      } catch {
        // Ignore if restricted
      }
    }

    const baseUrl = window.location.pathname.endsWith('/')
      ? window.location.pathname
      : window.location.pathname.replace(/\/[^/]*$/, '/');

    const timestamp = Date.now();
    let hasNewUpdate = false;
    let targetParam = `_t=${timestamp}`;

    // 4. Check version.json for newly published builds
    try {
      const vRes = await fetch(`${baseUrl}version.json?_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
      if (vRes.ok) {
        const vData = await vRes.json();
        const serverVersion = String(vData?.version || vData?.buildTime || '');
        const savedVersion = sessionStorage.getItem(RUNTIME_BUILD_KEY);

        if (!savedVersion) {
          sessionStorage.setItem(RUNTIME_BUILD_KEY, serverVersion);
        } else if (serverVersion && savedVersion !== serverVersion) {
          sessionStorage.setItem(RUNTIME_BUILD_KEY, serverVersion);
          hasNewUpdate = true;
          targetParam = `_v=${encodeURIComponent(serverVersion)}&_t=${timestamp}`;
        }
      }
    } catch {
      // Fallback to checking index.html script hash
    }

    // 5. Check index.html for updated bundle hashes if version.json didn't trigger
    if (!hasNewUpdate && currentAssetName) {
      try {
        const res = await fetch(`${baseUrl}index.html?_t=${timestamp}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        });
        if (res.ok) {
          const html = await res.text();
          const match = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/);
          if (match && match[1] && match[1] !== currentAssetName) {
            hasNewUpdate = true;
            targetParam = `_hash=${match[1]}&_t=${timestamp}`;
          }
        }
      } catch {
        // Ignore network hiccups
      }
    }

    // 6. If a new update is detected, clear all browser caches and hot-reload to the latest live version
    if (hasNewUpdate) {
      if ('caches' in window) {
        try {
          const keys = await window.caches.keys();
          for (const key of keys) {
            await window.caches.delete(key);
          }
        } catch {
          // Ignore
        }
      }
      const targetUrl = `${window.location.pathname}?${targetParam}${window.location.hash}`;
      window.location.replace(targetUrl);
    }
  } catch {
    // Ignore offline or dev-server check errors
  }
}

// Run immediately on boot
checkAndApplyLiveUpdatesRealtime();

// Background real-time check every 12 seconds so users get updates live without needing manual page refresh
setInterval(checkAndApplyLiveUpdatesRealtime, 12000);

// Also check immediately when tab regains focus or visibility
window.addEventListener('focus', checkAndApplyLiveUpdatesRealtime);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkAndApplyLiveUpdatesRealtime();
  }
});
window.addEventListener('online', checkAndApplyLiveUpdatesRealtime);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
