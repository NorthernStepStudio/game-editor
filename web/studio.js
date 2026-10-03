import { api, el, notice, download } from './api.js';
let reviewed = null, source = null, activeId = null, runs = [];
const terminal = r => ['completed', 'failed', 'blocked', 'cancelled'].includes(r.status);
const FLOW_TITLES = ['Ask', 'Plan', 'Build · Specialists', 'Verify · Sentinel', 'Repair', 'Complete'];

function configureAutonomyLabels() {
  FLOW_TITLES.forEach((title, index) => {
    const node = document.querySelector('#step-node-' + (index + 1));
    const label = node?.querySelector('.step-title');
    if (label) label.textContent = title;
  });
}

function paintFlowStep(index, state, status, badge) {
  const node = document.querySelector('#step-node-' + index);
  if (!node) return;
  node.classList.remove('pending', 'active', 'completed');
  if (state) node.classList.add(state);
  const statusNode = node.querySelector('.step-status');
  const badgeNode = node.querySelector('.step-badge');
  if (statusNode) statusNode.textContent = status;
  if (badgeNode) {
    badgeNode.textContent = badge;
    badgeNode.classList.remove('success', 'progress');
    if (state === 'completed') badgeNode.classList.add('success');
    if (state === 'active') badgeNode.classList.add('progress');
  }
}

function renderAutonomyDraft(stage = 'ask') {
  configureAutonomyLabels();
  const active = stage === 'plan' ? 2 : 1;
  for (let i = 1; i <= 6; i++) {
    const state = i < active ? 'completed' : i === active ? 'active' : 'pending';
    const status = i === 1 ? (stage === 'plan' ? 'Goal captured' : 'Describe the result you want') :
      i === 2 ? (stage === 'plan' ? 'Review acceptance criteria and specialist handoff' : 'Waiting for a goal') :
      i === 3 ? 'Matterhorn routes work to Canvas, Forge, Flyrail, or local QA as required' :
      i === 4 ? 'Sentinel requires criterion-specific evidence' :
      i === 5 ? 'Bounded repair only when verification fails' : 'Matterhorn accepts only verified completion';
    paintFlowStep(i, state, status, state === 'completed' ? 'Done' : state === 'active' ? 'Active' : 'Pending');
  }
}

function updateAutonomyFlow(run) {
  configureAutonomyLabels();
  const statuses = run.tasks.map(task => task.status);
  const verifying = run.status === 'validating' || statuses.includes('validating');
  const needsRepair = run.status === 'failed' || run.status === 'blocked' || statuses.includes('failed') || statuses.includes('blocked');
  const completed = run.status === 'completed';
  let active = completed ? 6 : needsRepair ? 5 : verifying ? 4 : 3;

  paintFlowStep(1, 'completed', 'Goal captured', 'Done');
  paintFlowStep(2, 'completed', 'Reviewed plan and acceptance criteria', 'Done');
  const routed = run.plan.tasks.map(task => task.specialistId).filter((value, index, all) => all.indexOf(value) === index);
  paintFlowStep(3, active > 3 || completed ? 'completed' : 'active', `${routed.join(' → ') || 'specialists'} · ${statuses.join(', ') || run.status}`, active > 3 || completed ? 'Done' : 'Running');
  paintFlowStep(4, active > 4 || completed ? 'completed' : active === 4 ? 'active' : 'pending',
    completed ? 'Sentinel evidence gate passed' : verifying ? 'Checking deterministic evidence' : active > 4 ? 'Verification returned issues' : 'Waiting for execution evidence',
    completed ? 'Passed' : active === 4 ? 'Checking' : active > 4 ? 'Checked' : 'Pending');
  paintFlowStep(5, completed ? 'completed' : active === 5 ? 'active' : 'pending',
    completed ? 'No unresolved repair remains' : needsRepair ? (run.detail || 'Verification requires repair or review') : 'Only used when verification fails',
    completed ? 'Clear' : needsRepair ? 'Attention' : 'Pending');
  paintFlowStep(6, completed ? 'completed' : 'pending',
    completed ? 'Matterhorn accepted verified completion' : 'Waiting for verified acceptance',
    completed ? 'Complete' : 'Pending');
}

export async function loadProjects() {
  const projects = await api('/api/projects');
  const select = document.querySelector('#project'), list = document.querySelector('#project-list');
  select.replaceChildren(new Option('Choose a configured project', '')); list.replaceChildren();
  for (const project of projects) { select.add(new Option(project.name, project.id)); list.append(el('h2', project.name), el('p', project.id, 'muted')); }
  if (!projects.length) list.append(el('p', 'No projects configured. Add MATTERHORN_PROJECTS to the server environment, then restart.'));
  document.querySelector('#review').disabled = !projects.length;
  window.dispatchEvent(new window.CustomEvent('workspace-projects', { detail: projects }));
}
function renderRun(run) {
  updateAutonomyFlow(run);
  const container = document.querySelector('#active-run'); container.replaceChildren(el('h3', run.plan.goal), el('p', run.status, 'badge'));
  if (run.detail) container.append(el('p', run.detail, 'muted'));
  for (const task of run.tasks) {
    const node = el('div', undefined, 'task'); node.append(el('strong', task.id), el('p', task.status, 'badge'));
    if (task.detail) node.append(el('p', task.detail));
    if (task.result?.criterionResults && task.result.criterionResults.length > 0) {
      const criteriaBox = el('div', undefined, 'criterion-results');
      criteriaBox.append(el('h4', 'Sentinel · Acceptance Criteria Evidence'));
      for (const res of task.result.criterionResults) {
        const item = el('div', undefined, 'criterion-item');
        const label = res.description ?? res.criterion ?? res.criterionId ?? 'Criterion';
        const extra = (res.actual !== undefined || res.expected !== undefined) ? ` [expected: ${JSON.stringify(res.expected)}, actual: ${JSON.stringify(res.actual)}]` : '';
        item.append(el('span', `${label}${extra} · `), el('span', res.outcome, 'badge'));
        criteriaBox.append(item);
      }
      node.append(criteriaBox);
    }
    container.append(node);
  }
  if (!terminal(run)) { const cancel = el('button', 'Request cancellation', 'secondary'); cancel.disabled = run.status === 'cancel-requested'; cancel.onclick = async () => { cancel.disabled = true; try { renderRun(await api(`/api/studio/runs/${run.id}/cancel`, {})); } catch(e) { notice(e); cancel.disabled = false; } }; container.append(cancel); }
  const save = el('button', 'Download run evidence', 'secondary'); save.onclick = () => download(`matterhorn-${run.id}.json`, run); container.append(save);
  if (terminal(run)) { source?.close(); source = null; void refreshRuns().catch(notice); }
}
export async function refreshRuns() {
  runs = await api('/api/studio/runs');
  const list = document.querySelector('#runs'), evidence = document.querySelector('#evidence-list'); list.replaceChildren(); evidence.replaceChildren();
  if (!runs.length) { list.append(el('p', 'No Studio runs yet.', 'muted')); evidence.append(el('p', 'Evidence appears here after a Studio run. Run history is persisted on disk.')); }
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
  configureAutonomyLabels();
  renderAutonomyDraft('ask');
  const form = document.querySelector('#run-form');
  form.addEventListener('input', () => { reviewed = null; document.querySelector('#plan-review').hidden = true; renderAutonomyDraft('ask'); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); const button = document.querySelector('#review'); button.disabled = true;
    try {
      const payload = { projectId: document.querySelector('#project').value, goal: document.querySelector('#goal').value, criteria: document.querySelector('#criteria').value.split('\n').map(x => x.trim()).filter(Boolean) };
      const plan = await api('/api/studio/plan', payload); reviewed = payload;
      const planLines = plan.tasks.map((task, index) => {
        const dependencies = task.dependsOn?.length ? `\nDepends on: ${task.dependsOn.join(', ')}` : '';
        const disclosure = task.disclosure
          ? `\nPolicy: ${task.disclosure.providerId ? `provider=${task.disclosure.providerId}; ` : ''}${task.disclosure.networkMayBeRequired ? 'network may be required; ' : ''}${task.disclosure.externalCostMayBeIncurred ? 'external cost may be incurred; ' : ''}${task.disclosure.explicitApprovalRequired ? 'explicit approval required' : 'no extra approval required'}`
          : '';
        return `${index + 1}. [${task.specialistId}] ${task.title}${dependencies}${disclosure}\n${task.acceptanceCriteria.map(c => '• ' + c).join('\n')}`;
      });
      document.querySelector('#plan-text').textContent = `${plan.goal}\n\n${planLines.join('\n\n')}\n\nFinal acceptance:\n${plan.finalAcceptanceCriteria.map(c => '• ' + c).join('\n')}`;
      document.querySelector('#plan-review').hidden = false;
      renderAutonomyDraft('plan');
    } catch(e) { notice(e); } finally { button.disabled = false; }
  });
  document.querySelector('#start').onclick = async () => {
    if (!reviewed) return; const button = document.querySelector('#start'); button.disabled = true;
    try { const run = await api('/api/studio/runs', reviewed); reviewed = null; document.querySelector('#plan-review').hidden = true; await refreshRuns(); await watch(run.id); } catch(e) { notice(e); } finally { button.disabled = false; }
  };
  document.querySelector('#refresh-runs').onclick = () => refreshRuns().catch(notice);
  window.addEventListener('beforeunload', () => source?.close());
}
