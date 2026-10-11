// Small DOM helpers shared by every page. No framework: the page markup is built here.

export async function api(path, body, method) {
  const init = body === undefined && !method
    ? {}
    : { method: method ?? 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) };
  const response = await fetch(path, init);
  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

/** Quietly returns undefined instead of throwing: for optional status reads. */
export async function tryApi(path) {
  try {
    return await api(path);
  } catch {
    return undefined;
  }
}

/**
 * h('button', { class: 'btn', onclick: fn, disabled: true }, 'Label', child, [more])
 * Props: class, text, html is NOT supported (no innerHTML), on* handlers, aria-* / data-* / other attributes.
 */
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'value') node.value = value;
    else if (key === 'checked' || key === 'disabled' || key === 'hidden' || key === 'selected') node[key] = Boolean(value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(node, ...children) {
  node.replaceChildren();
  append(node, children);
  return node;
}

export function btn(label, onclick, variant = '', extra = {}) {
  return h('button', { type: 'button', class: `btn ${variant}`.trim(), onclick, ...extra }, label);
}

/** Runs an async action from a button: disables it meanwhile and reports errors as a toast. */
export function action(label, run, variant = '', extra = {}) {
  const button = btn(label, async () => {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await run(button);
    } catch (error) {
      toast(error?.message || String(error), 'error');
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  }, variant, extra);
  return button;
}

export function pills(options, current, onPick, label) {
  const group = h('div', { class: 'pills', role: 'radiogroup', 'aria-label': label });
  for (const option of options) {
    const active = option.id === current;
    group.append(h('button', {
      type: 'button',
      class: `pill${active ? ' active' : ''}`,
      role: 'radio',
      'aria-checked': active ? 'true' : 'false',
      disabled: option.disabled,
      title: option.title,
      onclick: () => onPick(option.id),
    }, option.label));
  }
  return group;
}

export function steps(labels, doneCount, activeTone = 'active') {
  return h('ol', { class: 'steps', 'aria-label': `Step ${Math.min(doneCount + 1, labels.length)} of ${labels.length}` },
    labels.map((label, index) => h('li', {
      class: index < doneCount ? 'done' : index === doneCount ? activeTone : '',
    }, h('span', { class: 'bar', 'aria-hidden': 'true' }), h('span', { class: 'step-label' }, label))));
}

export function empty(text, ...actions) {
  return h('div', { class: 'empty' }, h('p', {}, text), actions.length ? h('div', { class: 'row' }, actions) : null);
}

let toastTimer;
export function toast(message, tone = 'info') {
  const host = document.querySelector('#toast');
  if (!host) return;
  clearTimeout(toastTimer);
  clear(host, h('span', {}, message), btn('OK', () => { host.hidden = true; }, 'quiet small'));
  host.className = `toast ${tone}`;
  host.hidden = false;
  toastTimer = setTimeout(() => { host.hidden = true; }, tone === 'error' ? 12000 : 6000);
}

export function timeAgo(iso) {
  if (!iso) return '';
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export function slug(text, max = 40) {
  return (text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, max) || 'asset');
}

/** Page-level state shared between pages (current game, assistant context). */
export const store = {
  games: [],
  gameId: undefined,
  context: 'Studio',
  listeners: new Set(),
  set(patch) {
    Object.assign(this, patch);
    for (const listener of this.listeners) listener(this);
  },
};

/** Elapsed time as m:ss. */
export function elapsed(since) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
