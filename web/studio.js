import { api, clearNotice, el, notice, download } from './api.js';

let reviewed = null;
let source = null;
let activeId = null;
let runs = [];
let homeAttentionRenderId = 0;

const terminal = run => ['completed', 'failed', 'blocked', 'cancelled'].includes(run.status);
const FLOW_TITLES = ['Plan', 'Build', 'Validate', 'Repair', 'Verified', 'Promote'];

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
  if (badgeNode) badgeNode.textContent = badge;
}

function renderAutonomyDraft(stage = 'goal') {
  configureAutonomyLabels();
  paintFlowStep(1, stage === 'plan' ? 'completed' : 'active',
    stage === 'plan' ? 'Plan generated and waiting for your review' : 'Describe the result you want',
    stage === 'plan' ? 'Ready' : 'Current');
  paintFlowStep(2, 'pending', 'Specialists start only after reviewed execution', 'Pending');
  paintFlowStep(3, 'pending', 'Sentinel checks criterion-specific evidence', 'Pending');
  paintFlowStep(4, 'pending', 'Used only when verification requires repair', 'Pending');
  paintFlowStep(5, 'pending', 'Matterhorn accepts only verified completion', 'Pending');
  paintFlowStep(6, 'pending', 'Human approval is separate from verification', 'Pending');
}

function updateAutonomyFlow(run) {
  configureAutonomyLabels();
  const statuses = run.tasks.map(task => task.status);
  const verifying = run.status === 'validating' || statuses.includes('validating');
  const needsRepair =
    run.status === 'failed' ||
    run.status === 'blocked' ||
    statuses.includes('failed') ||
    statuses.includes('blocked');
  const completed = run.status === 'completed';
  const cancellationRequested = run.status === 'cancel-requested';
  const cancelled = run.status === 'cancelled';

  paintFlowStep(1, 'completed', 'Reviewed plan and acceptance criteria', 'Done');
  paintFlowStep(
    2,
    completed || verifying || needsRepair ? 'completed' : cancellationRequested ? 'active' : cancelled ? 'pending' : 'active',
    completed ? 'Specialist execution complete' :
      verifying ? 'Execution produced evidence' :
        needsRepair ? 'Execution needs attention' :
          cancellationRequested ? 'Cancellation requested; waiting for remote confirmation' :
            cancelled ? 'Execution cancelled; no specialist work remains' :
              'Specialists are working',
    completed || verifying || needsRepair ? 'Done' : cancellationRequested ? 'Stopping' : cancelled ? 'Cancelled' : 'Running',
  );
  paintFlowStep(
    3,
    completed ? 'completed' : verifying ? 'active' : needsRepair ? 'completed' : 'pending',
    completed ? 'Sentinel evidence gate passed' : verifying ? 'Checking deterministic evidence' : needsRepair ? 'Validation identified issues' : cancelled ? 'Skipped after cancellation' : cancellationRequested ? 'Waiting for cancellation to settle' : 'Waiting for execution evidence',
    completed ? 'Passed' : verifying ? 'Checking' : needsRepair ? 'Checked' : cancelled ? 'Skipped' : 'Pending',
  );
  paintFlowStep(
    4,
    completed ? 'completed' : needsRepair ? 'active' : 'pending',
    completed ? 'No unresolved repair remains' : needsRepair ? (run.detail || 'Repair or human review is required') : cancelled ? 'No repair scheduled for a cancelled run' : 'Only used after failed verification',
    completed ? 'Clear' : needsRepair ? 'Attention' : cancelled ? 'Skipped' : 'Pending',
  );
  paintFlowStep(
    5,
    completed ? 'completed' : 'pending',
    completed ? 'Verified successfully' : cancelled ? 'Run cancelled before verification' : 'Waiting for acceptance',
    completed ? 'Verified' : cancelled ? 'Not verified' : 'Pending',
  );
  paintFlowStep(6, 'pending', completed ? 'Human promotion approval required' : cancelled ? 'Unavailable for a cancelled run' : 'Available after verified completion', cancelled ? 'Unavailable' : 'Pending');
}

function projectCard(project) {
  const card = el('div', undefined, 'project-chip');
  card.append(el('strong', project.name), el('span', project.id, 'subtle'));
  return card;
}

export async function loadProjects() {
  const projects = await api('/api/projects');
  const select = document.querySelector('#project');
  const list = document.querySelector('#project-list');
  select.replaceChildren(new Option('Choose a configured project', ''));
  list.replaceChildren();

  for (const project of projects) {
    select.add(new Option(project.name, project.id));
    list.append(projectCard(project));
  }
  if (projects.length === 1) select.value = projects[0].id;
  if (!projects.length) {
    list.append(el('p', 'No projects configured. Add MATTERHORN_PROJECTS to the server environment, then restart.', 'empty-state'));
  }

  document.querySelector('#review').disabled = !projects.length;
  window.dispatchEvent(new window.CustomEvent('workspace-projects', { detail: projects }));
}

function taskTitle(run, task) {
  return run.plan.tasks.find(candidate => candidate.id === task.id)?.title ?? task.id;
}

function taskSpecialist(run, task) {
  return run.plan.tasks.find(candidate => candidate.id === task.id)?.specialistId ?? 'specialist';
}

async function renderPromotionControls(run, container) {
  if (run.status !== 'completed') return;

  const box = el('div', undefined, 'task promotion-gate');
  const head = el('div', undefined, 'section-title-row');
  head.append(el('h3', 'Promotion'), el('span', 'Checking…', 'badge'));
  const detail = el('p', 'Checking approval…', 'muted');
  box.append(head, detail);
  container.append(box);

  const promotion = await api(`/api/studio/runs/${run.id}/promotion`);
  if (!box.isConnected) return;

  head.lastChild.textContent =
    promotion.state === 'approved' ? 'Approved' :
    promotion.state === 'stale' ? 'Stale' :
    'Approval required';
  detail.textContent = promotion.detail;

  if (promotion.state === 'approved') {
    paintFlowStep(6, 'completed', 'Human approved this exact verified snapshot', 'Approved');
    const revoke = el('button', 'Revoke promotion approval', 'secondary-action');
    revoke.onclick = async () => {
      revoke.disabled = true;
      try {
        await api(`/api/studio/runs/${run.id}/promotion/revoke`, {});
        renderRun(await api(`/api/studio/runs/${run.id}`));
      } catch (error) {
        notice(error);
        revoke.disabled = false;
      }
    };
    box.append(revoke);
    return;
  }

  paintFlowStep(6, 'active', promotion.state === 'stale' ? 'Approval must be renewed for the current snapshot' : 'Type APPROVE to authorize promotion', promotion.state === 'stale' ? 'Stale' : 'Approval');

  const confirmation = document.createElement('input');
  confirmation.type = 'text';
  confirmation.autocomplete = 'off';
  confirmation.spellcheck = false;
  confirmation.placeholder = 'Type APPROVE to confirm';
  confirmation.maxLength = 7;

  const approve = el('button', promotion.state === 'stale' ? 'Renew promotion approval' : 'Approve for promotion', 'primary-action');
  approve.disabled = true;
  confirmation.addEventListener('input', () => {
    approve.disabled = confirmation.value !== 'APPROVE';
  });
  approve.onclick = async () => {
    if (confirmation.value !== 'APPROVE') return;
    approve.disabled = true;
    confirmation.disabled = true;
    try {
      await api(`/api/studio/runs/${run.id}/promotion/approve`, { confirmation: confirmation.value });
      renderRun(await api(`/api/studio/runs/${run.id}`));
      await refreshRuns();
    } catch (error) {
      notice(error);
      confirmation.disabled = false;
      approve.disabled = confirmation.value !== 'APPROVE';
    }
  };

  box.append(confirmation, approve);
}

function renderRun(run) {
  updateAutonomyFlow(run);
  const container = document.querySelector('#active-run');
  container.replaceChildren();

  const header = el('div', undefined, 'active-run-header');
  const title = document.createElement('div');
  title.append(
    el('span', `#${run.id.slice(0, 8)}`, 'status-kicker'),
    el('h2', run.plan.goal),
  );
  header.append(title, el('span', run.status, 'badge'));
  container.append(header);

  if (run.detail) container.append(el('p', run.detail, 'muted'));

  const taskList = el('div', undefined, 'current-work-list');
  for (const task of run.tasks) {
    const node = el('div', undefined, 'task');
    const taskHead = el('div', undefined, 'section-title-row');
    const identity = document.createElement('div');
    identity.append(
      el('strong', taskTitle(run, task)),
      el('p', taskSpecialist(run, task), 'muted-sm'),
    );
    taskHead.append(identity, el('span', task.status, 'badge'));
    node.append(taskHead);

    if (task.detail) node.append(el('p', task.detail, 'muted'));

    if (task.result?.criterionResults?.length) {
      const criteriaBox = el('div', undefined, 'criterion-results');
      for (const result of task.result.criterionResults) {
        const item = el('div', undefined, 'criterion-item');
        const label = result.description ?? result.criterion ?? result.criterionId ?? 'Criterion';
        item.append(el('span', label), el('span', result.outcome, 'badge'));
        criteriaBox.append(item);
      }
      node.append(criteriaBox);
    }
    taskList.append(node);
  }
  container.append(taskList);

  const actions = el('div', undefined, 'button-row');
  if (!terminal(run)) {
    const cancel = el('button', 'Cancel run', 'secondary-action');
    cancel.disabled = run.status === 'cancel-requested';
    cancel.onclick = async () => {
      cancel.disabled = true;
      try {
        const updated = await api(`/api/studio/runs/${run.id}/cancel`, {});
        renderRun(updated);
        await refreshRuns();
      } catch (error) {
        notice(error);
        cancel.disabled = false;
      }
    };
    actions.append(cancel);
  }
  const save = el('button', 'Download evidence', 'secondary-action');
  save.onclick = () => download(`matterhorn-${run.id}.json`, run);
  actions.append(save);
  container.append(actions);

  void renderPromotionControls(run, container).catch(notice);

  if (terminal(run)) {
    source?.close();
    source = null;
  }
}

function runRow(run, compact = false) {
  const row = el('div', undefined, compact ? 'run home-run-row' : 'run');
  const button = el('button', run.plan.goal);
  button.onclick = () => {
    location.hash = '#runs';
    watch(run.id).catch(notice);
  };
  row.append(button, el('span', run.status, 'badge'));
  return row;
}

function validationState(run) {
  if (run.status === 'completed') return 'passed';
  if (['failed', 'blocked', 'cancelled'].includes(run.status)) return 'attention';
  return 'all';
}

function validationCard(run) {
  const card = el('div', undefined, 'task validation-card');
  card.dataset.validationState = validationState(run);

  let passed = 0;
  let failed = 0;
  let unknown = 0;
  for (const task of run.tasks) {
    for (const criterion of task.result?.criterionResults ?? []) {
      if (criterion.outcome === 'passed') passed++;
      else if (criterion.outcome === 'failed') failed++;
      else unknown++;
    }
  }

  const head = el('div', undefined, 'section-title-row');
  const identity = document.createElement('div');
  identity.append(el('h3', run.plan.goal), el('p', `Run ${run.id.slice(0, 8)} · ${run.status}`, 'muted-sm'));
  const summary = el('div', undefined, 'validation-counts');
  summary.append(
    el('span', `✓ ${passed} passed`, 'validation-pass'),
    el('span', `! ${unknown} pending`, 'validation-warn'),
    el('span', `× ${failed} failed`, 'validation-fail'),
  );
  head.append(identity, summary);
  card.append(head);

  const details = document.createElement('details');
  details.append(el('summary', 'View evidence'));
  for (const task of run.tasks) {
    const block = el('div', undefined, 'validation-detail');
    block.append(el('strong', taskTitle(run, task)), el('span', task.status, 'badge'));
    for (const criterion of task.result?.criterionResults ?? []) {
      block.append(el('p', `${criterion.description ?? criterion.criterion ?? criterion.criterionId}: ${criterion.outcome}`, 'muted-sm'));
    }
    details.append(block);
  }
  const save = el('button', 'Download evidence', 'secondary-action');
  save.onclick = async () => {
    try {
      download(`matterhorn-evidence-${run.id}.json`, await api(`/api/studio/runs/${run.id}/evidence`));
    } catch (error) {
      notice(error);
    }
  };
  details.append(save);
  card.append(details);
  return card;
}

async function renderHomeAttention() {
  const container = document.querySelector('#home-attention');
  const renderId = ++homeAttentionRenderId;
  const fragment = document.createDocumentFragment();

  const attentionRuns = runs.filter(run => ['failed', 'blocked', 'cancel-requested'].includes(run.status));
  for (const run of attentionRuns.slice(0, 4)) {
    const row = el('a', `${run.plan.goal} · ${run.status}`, run.status === 'failed' || run.status === 'blocked' ? 'attention-row danger' : 'attention-row warning');
    row.href = '#runs';
    row.onclick = () => watch(run.id).catch(notice);
    fragment.append(row);
  }

  const completed = runs.filter(run => run.status === 'completed').slice(-3);
  for (const run of completed) {
    try {
      const promotion = await api(`/api/studio/runs/${run.id}/promotion`);
      if (promotion.state !== 'approved') {
        const row = el('a', `${run.plan.goal} · promotion ${promotion.state === 'stale' ? 'stale' : 'approval required'}`, 'attention-row warning');
        row.href = '#runs';
        row.onclick = () => watch(run.id).catch(notice);
        fragment.append(row);
      }
    } catch {
      // Promotion visibility must not prevent the dashboard from rendering.
    }
  }

  if (!fragment.childNodes.length) {
    fragment.append(el('div', 'Nothing needs you right now.', 'attention-row neutral'));
  }
  if (renderId !== homeAttentionRenderId) return;
  container.replaceChildren(fragment);
}

function renderHome() {
  const active = document.querySelector('#home-active');
  const recent = document.querySelector('#home-runs');
  active.replaceChildren();
  recent.replaceChildren();

  const activeRun = [...runs].reverse().find(run => !terminal(run));
  if (activeRun) active.append(runRow(activeRun, true));
  else active.append(el('p', 'No active work right now.', 'empty-state'));

  const recentRuns = [...runs].reverse().slice(0, 5);
  if (recentRuns.length) {
    for (const run of recentRuns) recent.append(runRow(run, true));
  } else {
    recent.append(el('p', 'No Studio runs yet.', 'empty-state'));
  }

  void renderHomeAttention();
}

export async function refreshRuns() {
  runs = await api('/api/studio/runs');

  const list = document.querySelector('#runs');
  const evidence = document.querySelector('#evidence-list');
  list.replaceChildren();
  evidence.replaceChildren();

  if (!runs.length) {
    list.append(el('p', 'No Studio runs yet.', 'empty-state'));
    evidence.append(el('p', 'Evidence appears here after a Studio run.', 'empty-state'));
  }

  for (const run of [...runs].reverse()) {
    list.append(runRow(run));
    evidence.append(validationCard(run));
  }

  renderHome();

  if (!activeId) {
    const candidate = [...runs].reverse().find(run => !terminal(run)) ?? [...runs].reverse()[0];
    if (candidate) {
      activeId = candidate.id;
      renderRun(candidate);
    } else {
      renderAutonomyDraft('goal');
    }
  }
}

async function watch(id) {
  activeId = id;
  source?.close();
  source = null;

  const run = await api(`/api/studio/runs/${id}`);
  renderRun(run);

  if (!terminal(run)) {
    source = new EventSource(`/api/studio/runs/${id}/events`);
    source.onmessage = event => {
      const data = JSON.parse(event.data);
      if (data.run.id === activeId) {
        renderRun(data.run);
        const index = runs.findIndex(candidate => candidate.id === data.run.id);
        if (index >= 0) runs[index] = data.run;
        renderHome();
      }
    };
    source.onerror = () => {
      document.querySelector('#connection').textContent = 'Live stream reconnecting…';
    };
    source.onopen = () => {
      document.querySelector('#connection').textContent = 'System Ready';
      document.querySelector('#connection').classList.add('connected');
    };
  }
}

export function initStudio() {
  configureAutonomyLabels();
  renderAutonomyDraft('goal');

  const form = document.querySelector('#run-form');
  form.addEventListener('input', () => {
    reviewed = null;
    document.querySelector('#plan-review').hidden = true;
    renderAutonomyDraft('goal');
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.querySelector('#review');
    button.disabled = true;

    try {
      const payload = {
        projectId: document.querySelector('#project').value,
        goal: document.querySelector('#goal').value,
        criteria: document.querySelector('#criteria').value.split('\n').map(value => value.trim()).filter(Boolean),
        allowDirty: document.querySelector('#allow-dirty-project')?.checked === true,
      };

      const plan = await api('/api/studio/plan', payload);
      reviewed = payload;

      const planLines = plan.tasks.map((task, index) => {
        const dependencies = task.dependsOn?.length ? `\nDepends on: ${task.dependsOn.join(', ')}` : '';
        const disclosure = task.disclosure
          ? `\nPolicy: ${task.disclosure.providerId ? `provider=${task.disclosure.providerId}; ` : ''}${task.disclosure.networkMayBeRequired ? 'network may be required; ' : ''}${task.disclosure.externalCostMayBeIncurred ? 'external cost may be incurred; ' : ''}${task.disclosure.explicitApprovalRequired ? 'explicit approval required' : 'no extra approval required'}`
          : '';
        return `${index + 1}. [${task.specialistId}] ${task.title}${dependencies}${disclosure}\n${task.acceptanceCriteria.map(criterion => '• ' + criterion).join('\n')}`;
      });

      document.querySelector('#plan-text').textContent =
        `${plan.goal}\n\n${planLines.join('\n\n')}\n\nFinal acceptance:\n${plan.finalAcceptanceCriteria.map(criterion => '• ' + criterion).join('\n')}`;
      document.querySelector('#plan-review').hidden = false;
      renderAutonomyDraft('plan');
      clearNotice();
    } catch (error) {
      notice(error);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('#start').onclick = async () => {
    if (!reviewed) return;
    const button = document.querySelector('#start');
    button.disabled = true;

    try {
      const run = await api('/api/studio/runs', reviewed);
      reviewed = null;
      document.querySelector('#plan-review').hidden = true;
      location.hash = '#runs';
      await refreshRuns();
      await watch(run.id);
    } catch (error) {
      notice(error);
    } finally {
      button.disabled = false;
    }
  };

  document.querySelector('#refresh-runs').onclick = () => refreshRuns().catch(notice);
  window.addEventListener('beforeunload', () => source?.close());
}
