import { api, el, notice, download } from './api.js';
let reviewed = null, source = null, activeId = null, runs = [];
const terminal = r => ['completed', 'failed', 'blocked', 'cancelled'].includes(r.status);
export async function loadProjects() {
  const projects = await api('/api/projects');
  const select = document.querySelector('#project'), list = document.querySelector('#project-list');
  select.replaceChildren(new Option('Choose a configured project', '')); list.replaceChildren();
  for (const project of projects) { select.add(new Option(project.name, project.id)); list.append(el('h2', project.name), el('p', project.id, 'muted')); }
  if (!projects.length) list.append(el('p', 'No projects configured. Add MATTERHORN_PROJECTS to the server environment, then restart.'));
  document.querySelector('#review').disabled = !projects.length;
}
function renderRun(run) {
  const container = document.querySelector('#active-run'); container.replaceChildren(el('h3', run.plan.goal), el('p', run.status, 'badge'));
  if (run.detail) container.append(el('p', run.detail, 'muted'));
  for (const task of run.tasks) { const node = el('div', undefined, 'task'); node.append(el('strong', task.id), el('p', task.status, 'badge')); if (task.detail) node.append(el('p', task.detail)); container.append(node); }
  if (!terminal(run)) { const cancel = el('button', 'Request cancellation', 'secondary'); cancel.disabled = run.status === 'cancel-requested'; cancel.onclick = async () => { cancel.disabled = true; try { renderRun(await api(`/api/studio/runs/${run.id}/cancel`, {})); } catch(e) { notice(e); cancel.disabled = false; } }; container.append(cancel); }
  const save = el('button', 'Download run evidence', 'secondary'); save.onclick = () => download(`matterhorn-${run.id}.json`, run); container.append(save);
  if (terminal(run)) { source?.close(); source = null; void refreshRuns().catch(notice); }
}
export async function refreshRuns() {
  runs = await api('/api/studio/runs');
  const list = document.querySelector('#runs'), evidence = document.querySelector('#evidence-list'); list.replaceChildren(); evidence.replaceChildren();
  if (!runs.length) { list.append(el('p', 'No runs in this server session.', 'muted')); evidence.append(el('p', 'Evidence appears here after a Studio run. History clears on restart.')); }
  for (const run of [...runs].reverse()) {
    const row = el('div', undefined, 'run'), button = el('button', run.plan.goal); button.onclick = () => watch(run.id).catch(notice); row.append(button, el('span', run.status, 'badge')); list.append(row);
    const card = el('div', undefined, 'task'); card.append(el('h3', run.plan.goal), el('p', run.status, 'badge'));
    const save = el('button', 'Download evidence', 'secondary'); save.onclick = async () => { try { download(`matterhorn-evidence-${run.id}.json`, await api(`/api/studio/runs/${run.id}/evidence`)); } catch(e) { notice(e); } };
    card.append(save, el('pre', JSON.stringify(run.tasks.map(t => ({ task: t.id, detail: t.detail, result: t.result })), null, 2))); evidence.append(card);
  }
}
async function watch(id) {
  activeId = id; source?.close(); source = null;
  const run = await api(`/api/studio/runs/${id}`); renderRun(run);
  if (!terminal(run)) {
    source = new EventSource(`/api/studio/runs/${id}/events`);
    source.onmessage = event => { const data = JSON.parse(event.data); if (data.run.id === activeId) renderRun(data.run); };
    source.onerror = () => { document.querySelector('#connection').textContent = 'Live stream reconnecting…'; };
    source.onopen = () => { document.querySelector('#connection').textContent = 'Connected · live updates'; };
  }
}
export function initStudio() {
  const form = document.querySelector('#run-form');
  form.addEventListener('input', () => { reviewed = null; document.querySelector('#plan-review').hidden = true; });
  form.addEventListener('submit', async event => {
    event.preventDefault(); const button = document.querySelector('#review'); button.disabled = true;
    try {
      const payload = { projectId: document.querySelector('#project').value, goal: document.querySelector('#goal').value, criteria: document.querySelector('#criteria').value.split('\n').map(x => x.trim()).filter(Boolean) };
      const plan = await api('/api/studio/plan', payload); reviewed = payload;
      document.querySelector('#plan-text').textContent = `${plan.goal}\n\n${plan.tasks.map(t => `${t.title}\n${t.acceptanceCriteria.map(c => '• ' + c).join('\n')}`).join('\n\n')}`;
      document.querySelector('#plan-review').hidden = false;
    } catch(e) { notice(e); } finally { button.disabled = false; }
  });
  document.querySelector('#start').onclick = async () => {
    if (!reviewed) return; const button = document.querySelector('#start'); button.disabled = true;
    try { const run = await api('/api/studio/runs', reviewed); reviewed = null; document.querySelector('#plan-review').hidden = true; await refreshRuns(); await watch(run.id); } catch(e) { notice(e); } finally { button.disabled = false; }
  };
  document.querySelector('#refresh-runs').onclick = () => refreshRuns().catch(notice);
  window.addEventListener('beforeunload', () => source?.close());
}
