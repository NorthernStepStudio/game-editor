import { api, el, notice } from './api.js';
const history = [];
export function initChat() {
  document.querySelector('#chat-form').onsubmit = async event => {
    event.preventDefault(); const input = document.querySelector('#prompt'), button = document.querySelector('#send'), prompt = input.value.trim(); if (!prompt) return;
    button.disabled = true; const node = el('div', prompt, 'message'); document.querySelector('#messages').append(node);
    try {
      const answer = await api('/ask', { prompt, intent: 'ask', workspace: { name: 'Matterhorn Studio' }, history: history.slice(-12), _provider: document.querySelector('#provider').value });
      document.querySelector('#messages').append(el('div', answer.response, 'message')); history.push({ role: 'user', content: prompt }, { role: 'assistant', content: answer.response }); input.value = '';
    } catch(e) { node.append(el('p', 'Message failed. Your draft is preserved.', 'muted')); notice(e); } finally { button.disabled = false; }
  };
}
