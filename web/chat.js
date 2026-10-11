import { api, h, clear, store, toast } from './ui.js';

/**
 * Matterhorn chat: a floating window that stays open while you move around the app.
 * Drag it by its title bar, resize it from the corner, minimize it to a pill.
 * Asset questions come back as clickable results from the real library.
 */

const LOG_KEY = 'matterhorn.chat.log';
const UI_KEY = 'matterhorn.chat.ui';
const MAX_SAVED = 60;

let messages = [];
let ui = { open: false, minimized: false, left: null, top: null, width: null, height: null };

function load() {
  try {
    messages = JSON.parse(sessionStorage.getItem(LOG_KEY) ?? '[]');
    if (!Array.isArray(messages)) messages = [];
  } catch {
    messages = [];
  }
  try {
    ui = { ...ui, ...(JSON.parse(localStorage.getItem(UI_KEY) ?? '{}') ?? {}) };
  } catch {
    // Defaults are fine.
  }
}

function save() {
  try {
    sessionStorage.setItem(LOG_KEY, JSON.stringify(messages.slice(-MAX_SAVED)));
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    // Storage may be unavailable; the chat still works for this page.
  }
}

const $ = (id) => document.querySelector(id);

function apply() {
  const panel = $('#assistant');
  const pill = $('#chat-pill');
  panel.hidden = !ui.open || ui.minimized;
  pill.hidden = !ui.open || !ui.minimized;
  const unread = messages.length && messages.at(-1).role === 'assistant' && ui.minimized && ui.unread;
  pill.classList.toggle('unread', Boolean(unread));
  if (!narrow() && ui.left !== null && ui.top !== null) {
    panel.style.left = `${clamp(ui.left, 0, window.innerWidth - 120)}px`;
    panel.style.top = `${clamp(ui.top, 0, window.innerHeight - 60)}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  } else {
    panel.style.left = '';
    panel.style.top = '';
    panel.style.right = '';
    panel.style.bottom = '';
  }
  if (!narrow() && ui.width && ui.height) {
    panel.style.width = `${ui.width}px`;
    panel.style.height = `${ui.height}px`;
  }
}

function narrow() {
  return window.innerWidth < 760;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function openChat() {
  ui.open = true;
  ui.minimized = false;
  ui.unread = false;
  save();
  apply();
  $('#assistant-input')?.focus();
}

function renderLog() {
  const log = $('#assistant-log');
  $('#assistant-clear').hidden = !messages.length;
  clear(log, messages.length
    ? messages.map(renderMessage)
    : h('div', { class: 'msg' },
      h('p', {}, 'Ask about anything in Matterhorn. Try:'),
      h('div', { class: 'suggestions' },
        ['Show me all my assets', 'Show the sounds in Yun', 'What is building right now?', 'How do I add a new game?']
          .map((text) => h('button', { type: 'button', class: 'chip-btn', onclick: () => send(text) }, text)))));
  log.scrollTop = log.scrollHeight;
}

function renderMessage(message) {
  if (message.role === 'user') return h('div', { class: 'msg me' }, message.text);
  const node = h('div', { class: `msg${message.error ? ' error' : ''}` }, h('p', {}, message.text));
  if (message.assets?.shown?.length) {
    node.append(h('div', { class: 'chat-assets' }, message.assets.shown.map((a) => h('a', {
      class: 'chat-asset', href: `#assets/${encodeURIComponent(a.assetId)}`, title: a.source ? `${a.name} — ${a.source}` : a.name,
    },
    a.previewUrl ? h('img', { src: a.previewUrl, alt: '', loading: 'lazy' }) : h('span', { class: 'chat-asset-kind' }, kindLabel(a.type)),
    h('span', { class: 'chat-asset-name' }, a.name)))));
  }
  if (message.assets) {
    node.append(h('a', { class: 'btn small', href: message.assets.openHash },
      message.assets.total > (message.assets.shown?.length ?? 0) ? `Open all ${message.assets.total} in Assets` : 'Open in Assets'));
  }
  return node;
}

function kindLabel(type) {
  if (type?.startsWith('audio_')) return '♪';
  if (type === 'mesh_3d') return '3D';
  return 'IMG';
}

let busy = false;

async function send(text) {
  const input = $('#assistant-input');
  const message = (text ?? input.value).trim();
  if (busy) return;
  if (!message) {
    input.focus();
    toast('Type a message first.');
    return;
  }
  busy = true;
  $('#assistant-send').disabled = true;
  input.value = '';
  messages.push({ role: 'user', text: message });
  messages.push({ role: 'assistant', text: 'Thinking…', pending: true });
  renderLog();
  try {
    const history = messages.filter((m) => !m.pending && !m.error).slice(-12)
      .map((m) => ({ role: m.role, content: m.text }));
    const answer = await api('/api/assistant', { message, page: store.context, history });
    messages[messages.length - 1] = { role: 'assistant', text: answer.reply, ...(answer.assets ? { assets: answer.assets } : {}) };
    if (ui.minimized) ui.unread = true;
  } catch (error) {
    messages[messages.length - 1] = { role: 'assistant', text: `I couldn't answer: ${error?.message || error}. Your message is back in the box.`, error: true };
    input.value = message;
  } finally {
    busy = false;
    $('#assistant-send').disabled = false;
    save();
    renderLog();
    apply();
  }
}

function enableDrag(panel, handle) {
  let start;
  handle.addEventListener('pointerdown', (event) => {
    if (narrow() || event.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    start = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    handle.setPointerCapture?.(event.pointerId);
  });
  handle.addEventListener('pointermove', (event) => {
    if (!start) return;
    ui.left = clamp(start.left + event.clientX - start.x, 0, window.innerWidth - 120);
    ui.top = clamp(start.top + event.clientY - start.y, 0, window.innerHeight - 60);
    apply();
  });
  const end = () => {
    if (!start) return;
    start = undefined;
    save();
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  handle.addEventListener('dblclick', (event) => {
    if (event.target.closest('button')) return;
    ui.left = null;
    ui.top = null;
    ui.width = null;
    ui.height = null;
    panel.style.width = '';
    panel.style.height = '';
    save();
    apply();
  });
  // Remember the size after the user resizes from the corner.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (panel.hidden || narrow()) return;
      const rect = panel.getBoundingClientRect();
      if (Math.abs((ui.width ?? 0) - rect.width) > 4 || Math.abs((ui.height ?? 0) - rect.height) > 4) {
        ui.width = Math.round(rect.width);
        ui.height = Math.round(rect.height);
        save();
      }
    }).observe(panel);
  }
}

export function initChat() {
  load();
  const panel = $('#assistant');
  const context = $('#assistant-context');
  store.listeners.add((state) => { context.textContent = state.context; });
  context.textContent = store.context;

  $('#assistant-toggle').addEventListener('click', () => {
    if (ui.open && !ui.minimized) {
      ui.minimized = true;
      save();
      apply();
    } else {
      openChat();
    }
  });
  $('#assistant-close').addEventListener('click', () => { ui.open = false; save(); apply(); });
  $('#assistant-min').addEventListener('click', () => { ui.minimized = true; save(); apply(); });
  $('#chat-pill').addEventListener('click', openChat);
  $('#assistant-clear').addEventListener('click', () => { messages = []; save(); renderLog(); });
  $('#assistant-send').addEventListener('click', () => send());
  $('#assistant-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
    if (event.key === 'Escape') { ui.minimized = true; save(); apply(); }
  });
  enableDrag(panel, $('#chat-head'));
  window.addEventListener('resize', apply);
  renderLog();
  apply();
}
