import { api, clearNotice, notice } from './api.js';

let current = null;

function setValue(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.value = value;
}

function setChecked(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.checked = Boolean(value);
}

function render(preferences) {
  current = preferences;
  setValue('#routing-game', preferences.game);
  setValue('#routing-3d', preferences.threeD);
  setValue('#routing-assets', preferences.assets);
  setChecked('#routing-local-first', preferences.localFirst);
  setChecked('#routing-commercial-only', preferences.requireCommercialUse);
  setChecked('#routing-network', preferences.allowNetworkProviders);
  setChecked('#routing-external-cost', preferences.allowExternalCostProviders);

  const status = document.querySelector('#routing-status');
  if (status) {
    const updated = preferences.updatedAt && !preferences.updatedAt.startsWith('1970-')
      ? new Date(preferences.updatedAt).toLocaleString()
      : 'defaults';
    status.textContent = `Active routing profile · last saved: ${updated}`;
    status.className = 'muted-sm';
  }

  window.dispatchEvent(
    new window.CustomEvent('studio-routing-preferences', {
      detail: structuredClone(preferences),
    }),
  );
}

function payloadFromForm() {
  return {
    game: document.querySelector('#routing-game').value,
    threeD: document.querySelector('#routing-3d').value,
    assets: document.querySelector('#routing-assets').value,
    localFirst: document.querySelector('#routing-local-first').checked,
    requireCommercialUse: document.querySelector('#routing-commercial-only').checked,
    allowNetworkProviders: document.querySelector('#routing-network').checked,
    allowExternalCostProviders: document.querySelector('#routing-external-cost').checked,
  };
}

export async function loadRoutingPreferences() {
  const preferences = await api('/api/studio/routing');
  render(preferences);
  return preferences;
}

export function getRoutingPreferences() {
  return current ? structuredClone(current) : null;
}

export function initRoutingPreferences() {
  const form = document.querySelector('#routing-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const save = document.querySelector('#routing-save');
    const status = document.querySelector('#routing-status');
    save.disabled = true;
    if (status) {
      status.textContent = 'Saving routing profile…';
      status.className = 'muted-sm';
    }

    try {
      const preferences = await api(
        '/api/studio/routing',
        payloadFromForm(),
        { method: 'PUT' },
      );
      render(preferences);
      clearNotice();
    } catch (error) {
      if (status) {
        status.textContent = error?.message || 'Could not save routing profile.';
        status.className = 'error-text';
      }
      notice(error);
    } finally {
      save.disabled = false;
    }
  });
}
