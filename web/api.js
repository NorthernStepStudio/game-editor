export async function api(path, body, options = {}) {
  const method = options.method ?? (body === undefined ? 'GET' : 'POST');
  const init = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(path, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
export function el(tag, text, className) {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}
export function notice(error) { const node = document.querySelector('#notice'); node.textContent = error?.message || String(error); node.hidden = false; }
export function clearNotice() { const node = document.querySelector('#notice'); node.textContent = ''; node.hidden = true; }
export function download(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = el('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
