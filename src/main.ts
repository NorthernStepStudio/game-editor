// Centralized unregistration of any active service workers to prevent cross-project cached bundles on localhost:5173
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) {
          console.log('Stale service worker cleared successfully.');
        }
      });
    }
  });
}

import { bootApp } from './app/boot';

// Entry point for the NStep Code Motion Editor
window.addEventListener('DOMContentLoaded', () => {
  try {
    bootApp();
  } catch (err) {
    console.error('Failed to boot NStep Code Motion Editor:', err);
    document.body.innerHTML = `<div style="padding:20px; color:white; background:#1a1b26;">
      <h2>Critical Boot Error</h2>
      <pre>${err instanceof Error ? err.stack : String(err)}</pre>
    </div>`;
  }
});
