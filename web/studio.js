import { api, el, notice, download } from './api.js';

let reviewed = null;
let source = null;
let activeId = null;
let runs = [];

const terminal = run => ['completed', 'failed', 'blocked', 'cancelled'].includes(run.status);
const terminalTask = status => ['completed', 'failed', 'blocked', 'cancelled'].includes(status);

export async function loadProjects() {
  const projects = await api('/api/projects');
  const select = document.querySelector('#project');
  const list = document.querySelector('#project-list');
  select.replaceChildren(new Option('Choose a configured project', ''));
  list.replaceChildren();

  for (const project of projects) {
    select.add(new Option(project.name, project.id));
    list.append(el('h2', project.name), el('p', project.id, 'muted'));
  }
  if (projects.length === 1) select.value = projects[0].id;
  if (!projects.length) {
    list.append(el('p', 'No projects configured. Add MATTERHORN_PROJECTS to the server environment, then restart.'));
  }
  document.querySelector('#review').disabled = !projects.length;
  window.dispatchEvent(new window.CustomEvent('workspace-projects', { detail: projects }));
}

function taskView(run) {
  const runtimeById = new Map((run.tasks ?? []).map(task => [task.id, task]));
  return (run.plan?.tasks ?? []).map(planTask => ({
    ...planTask,
    runtime: runtimeById.get(planTask.id),
  }));
}

function stageFromTask(task) {
  if (!task) return { state: 'pending', status: 'Not routed', badge: '--' };
  const status = task.runtime?.status ?? task.status ?? 'planned';
  const detail = task.runtime?.detail ?? task.title;
  if (status === 'completed') return { state: 'completed', status: detail, badge: 'Passed' };
  if (['failed', 'blocked', 'cancelled'].includes(status)) {
    return { state: 'failed', status: detail, badge: status };
  }
  if (['running', 'validating'].includes(status)) {
    return { state: 'active', status: detail, badge: status };
  }
  return { state: 'pending', status: detail, badge: status };
}

function setCreateStage(index, stage) {
  const node = document.querySelector(`#step-node-${index}`);
  if (!node) return;
  node.classList.remove('completed', 'active', 'pending', 'failed');
  node.classList.add(stage.state);
  const status = node.querySelector('.step-status');
  const badge = node.querySelector('.step-badge');
  if (status) status.textContent = stage.status;
  if (badge) {
    badge.textContent = stage.badge;
    badge.className = 'step-badge';
    if (stage.state === 'completed') badge.classList.add('success');
    if (stage.state === 'active') badge.classList.add('progress');
  }
}

function setPipelineStage(index, stage) {
  const nodes = document.querySelectorAll('.pipeline-visual-full .p-step');
  const node = nodes[index - 1];
  if (!node) return;
  node.classList.remove('done', 'active', 'pending', 'failed');
  node.classList.add(
    stage.state === 'completed' ? 'done' :
    stage.state === 'active' ? 'active' :
    stage.state === 'failed' ? 'failed' : 'pending',
  );
  const badge = node.querySelector('.p-step-content span');
  const detail = node.querySelector('.p-step-content p');
  if (badge) {
    badge.textContent = stage.badge;
    badge.className =
      stage.state === 'completed' ? 'badge-green' :
      stage.state === 'active' ? 'badge-blue' :
      stage.state === 'failed' ? 'badge-red' : 'badge-muted';
  }
  if (detail) detail.textContent = stage.status;
}

function renderPipeline(run) {
  const liveDot = document.querySelector('#pipeline-live-dot');
  if (liveDot) liveDot.classList.toggle('pulse', Boolean(run && !terminal(run)));
  for (const connector of document.querySelectorAll('.pipeline-stepper .step-connector')) {
    connector.classList.remove('active');
  }

  if (!run) {
    const empty = [
      { state: 'pending', status: 'No active run', badge: '--' },
      { state: 'pending', status: 'Not routed', badge: '--' },
      { state: 'pending', status: 'Not routed', badge: '--' },
      { state: 'pending', status: 'Not routed', badge: '--' },
      { state: 'pending', status: 'Not routed', badge: '--' },
      { state: 'pending', status: 'Pending', badge: '--' },
    ];
    empty.forEach((stage, i) => {
      setCreateStage(i + 1, stage);
      setPipelineStage(i + 1, stage);
    });
    renderCurrentTask(null);
    return;
  }

  const tasks = taskView(run);
  const foundry = tasks.find(task => task.specialistId === 'foundry');
  const blender = tasks.find(task => task.specialistId === 'blender-engine');
  const flyrail = tasks.find(task => task.specialistId === 'flyrail');
  const qa = tasks.find(task => task.domain === 'qa');

  const complete =
    run.status === 'completed'
      ? { state: 'completed', status: 'Acceptance evidence passed', badge: 'Done' }
      : ['failed', 'blocked', 'cancelled'].includes(run.status)
        ? { state: 'failed', status: run.detail || run.status, badge: run.status }
        : { state: 'pending', status: 'Waiting for completion', badge: run.status };

  const stages = [
    { state: 'completed', status: 'Plan reviewed', badge: 'Done' },
    stageFromTask(foundry),
    stageFromTask(blender),
    stageFromTask(flyrail),
    stageFromTask(qa),
    complete,
  ];
  stages.forEach((stage, i) => {
    setCreateStage(i + 1, stage);
    setPipelineStage(i + 1, stage);
  });
  const connectors = document.querySelectorAll('.pipeline-stepper .step-connector');
  stages.slice(0, -1).forEach((stage, index) => {
    if (stage.state === 'completed' || stage.state === 'active') {
      connectors[index]?.classList.add('active');
    }
  });

  const current = tasks.find(task => task.runtime && !terminalTask(task.runtime.status))
    ?? [...tasks].reverse().find(task => task.runtime)
    ?? null;
  renderCurrentTask(current, run);
}

function renderCurrentTask(task, run) {
  const current = document.querySelector('#pipeline-current-task');
  const results = document.querySelector('#pipeline-results');
  const taskList = document.querySelector('#pipeline-tasks');
  if (!current || !results || !taskList) return;

  current.replaceChildren(el('h3', 'Current Task'));
  results.replaceChildren(el('h3', 'Generated Results'));
  taskList.replaceChildren();

  if (!run || !task) {
    current.append(el('p', 'No active pipeline. Select or start a Studio run.', 'muted'));
    results.append(el('p', 'Evidence-backed artifacts and previews will appear here when available.', 'muted'));
    taskList.append(el('p', 'No active pipeline. Start a studio run to see specialist task flow.', 'muted'));
    return;
  }

  current.append(
    el('p', task.title, 'task-title'),
    el('p', `${task.specialistId} · ${task.domain} · ${task.runtime?.status ?? task.status}`, 'task-meta'),
  );
  if (task.runtime?.detail) current.append(el('p', task.runtime.detail, 'muted'));

  for (const entry of collectResultItems(task.runtime?.result)) {
    results.append(renderResultItem(entry));
  }
  if (results.children.length === 1) {
    results.append(el('p', 'This task has not produced persisted artifacts or evidence yet.', 'muted'));
  }

  for (const item of taskView(run)) {
    const row = el('div', undefined, 'task');
    row.append(
      el('strong', item.title),
      el('p', `${item.specialistId} · ${item.runtime?.status ?? item.status}`, 'badge'),
    );
    if (item.runtime?.detail) row.append(el('p', item.runtime.detail, 'muted'));
    taskList.append(row);
  }
}

function collectResultItems(result) {
  if (!result) return [];
  const items = [];
  for (const artifact of result.artifacts ?? []) {
    items.push({
      kind: artifact.kind || 'artifact',
      label: artifact.label || artifact.kind || 'Artifact',
      uri: artifact.uri,
      outcome: 'produced',
    });
  }
  for (const evidence of result.evidence ?? []) {
    items.push({
      kind: evidence.kind || 'evidence',
      label: evidence.summary || evidence.kind || 'Evidence',
      uri: evidence.uri,
      outcome: evidence.outcome || 'unknown',
    });
  }
  return items;
}

function renderResultItem(item) {
  const card = el('div', undefined, 'result-item');
  card.append(el('strong', item.label), el('span', `${item.kind} · ${item.outcome}`, 'badge'));
  if (item.uri) card.append(el('code', item.uri, 'result-uri'));
  return card;
}

function renderOutput(run) {
  const createPreview = document.querySelector('#create-output-preview');
  const outputPreview = document.querySelector('#output-preview');
  const status = document.querySelector('#create-output-status');
  if (!createPreview || !outputPreview || !status) return;

  createPreview.replaceChildren();
  outputPreview.replaceChildren();

  const items = run
    ? taskView(run).flatMap(task => collectResultItems(task.runtime?.result))
    : [];

  if (!run) {
    status.textContent = 'No live output yet';
    createPreview.append(el('div', 'Start or select a Studio run to see evidence-backed output here.', 'empty-state'));
    outputPreview.append(el('div', 'No active output. Run a Studio task to see evidence-backed results here.', 'empty-state'));
    return;
  }

  status.textContent = items.length
    ? `${items.length} persisted output/evidence item${items.length === 1 ? '' : 's'}`
    : `Run ${run.status} · waiting for persisted output`;

  if (!items.length) {
    createPreview.append(el('div', 'The run is active, but no persisted output is available yet.', 'empty-state'));
    outputPreview.append(el('div', 'No persisted output is available for this run yet.', 'empty-state'));
    return;
  }

  for (const item of items.slice(0, 8)) createPreview.append(renderResultItem(item));
  for (const item of items) outputPreview.append(renderResultItem(item));
}

function renderProject(run) {
  const status = document.querySelector('#project-run-status');
  const name = document.querySelector('#project-run-name');
  const type = document.querySelector('#project-run-type');
  const engine = document.querySelector('#project-run-engine');
  const style = document.querySelector('#project-run-style');
  const started = document.querySelector('#project-run-started');
  if (!status || !name || !type || !engine || !style || !started) return;

  if (!run) {
    status.textContent = 'No active run';
    status.className = 'badge-status';
    name.textContent = '—';
    type.textContent = '—';
    engine.textContent = '—';
    style.textContent = '—';
    started.textContent = '—';
    return;
  }

  const domains = [...new Set(run.plan.tasks.map(task => task.domain))];
  const specialists = [...new Set(run.plan.tasks.map(task => task.specialistId))];
  status.textContent = run.status;
  status.className = `badge-status ${terminal(run) ? run.status : 'in-progress'}`;
  name.textContent = run.plan.goal;
  type.textContent = domains.join(', ') || 'Studio run';
  engine.textContent =
    specialists.includes('flyrail') ? 'Godot (Flyrail)' :
    specialists.includes('blender-engine') ? 'Blender Engine' :
    specialists.join(', ') || 'Matterhorn';
  style.textContent = 'From run specification';
  started.textContent = run.createdAt ? new Date(run.createdAt).toLocaleString() : '—';
}

function renderSpecialistActivity(run) {
  const activity = document.querySelector('#specialist-activity');
  const preview = document.querySelector('#specialist-preview');
  if (!activity || !preview) return;
  activity.replaceChildren();

  if (!run) {
    activity.append(el('p', 'No live specialist activity yet. Start a Studio run to populate this feed.', 'muted'));
    preview.textContent = 'No live game preview yet.';
    return;
  }

  for (const item of taskView(run)) {
    const row = el('div', undefined, 'act-row');
    row.append(
      el('span', item.runtime?.startedAt ? new Date(item.runtime.startedAt).toLocaleTimeString() : '—', 'time'),
      el(
        'span',
        item.specialistId,
        `badge-spec ${
          item.specialistId === 'matterhorn'
            ? 'matterhorn'
            : item.specialistId === 'flyrail'
              ? 'flyrail'
              : item.specialistId === 'blender-engine'
                ? 'blender'
                : 'foundry'
        }`,
      ),
      el('span', `${item.title} · ${item.runtime?.status ?? item.status}`),
    );
    activity.append(row);
  }

  const screenshots = taskView(run)
    .flatMap(task => collectResultItems(task.runtime?.result))
    .filter(item => item.kind === 'screenshot' || item.kind === 'render');
  preview.textContent = screenshots.length
    ? `${screenshots.length} screenshot/render evidence item${screenshots.length === 1 ? '' : 's'} available. Artifact serving is not connected to the browser yet.`
    : 'No browser-accessible game preview has been produced yet.';
}

function renderStudioSurface(run) {
  renderPipeline(run);
  renderOutput(run);
  renderProject(run);
  renderSpecialistActivity(run);
}

function renderRun(run) {
  const container = document.querySelector('#active-run');
  container.replaceChildren(el('h3', run.plan.goal), el('p', run.status, 'badge'));
  if (run.detail) container.append(el('p', run.detail, 'muted'));

  for (const task of run.tasks) {
    const node = el('div', undefined, 'task');
    node.append(el('strong', task.id), el('p', task.status, 'badge'));
    if (task.detail) node.append(el('p', task.detail));
    if (task.result?.criterionResults?.length) {
      const criteriaBox = el('div', undefined, 'criterion-results');
      criteriaBox.append(el('h4', 'Acceptance Criteria Evidence'));
      for (const res of task.result.criterionResults) {
        const item = el('div', undefined, 'criterion-item');
        const label = res.description ?? res.criterion ?? res.criterionId ?? 'Criterion';
        const extra =
          res.actual !== undefined || res.expected !== undefined
            ? ` [expected: ${JSON.stringify(res.expected)}, actual: ${JSON.stringify(res.actual)}]`
            : '';
        item.append(el('span', `${label}${extra} · `), el('span', res.outcome, 'badge'));
        criteriaBox.append(item);
      }
      node.append(criteriaBox);
    }
    container.append(node);
  }

  if (!terminal(run)) {
    const cancel = el('button', 'Request cancellation', 'secondary');
    cancel.disabled = run.status === 'cancel-requested';
    cancel.onclick = async () => {
      cancel.disabled = true;
      try {
        renderRun(await api(`/api/studio/runs/${run.id}/cancel`, {}));
      } catch (error) {
        notice(error);
        cancel.disabled = false;
      }
    };
    container.append(cancel);
  }

  const save = el('button', 'Download run evidence', 'secondary');
  save.onclick = () => download(`matterhorn-${run.id}.json`, run);
  container.append(save);

  renderStudioSurface(run);

  if (terminal(run)) {
    source?.close();
    source = null;
    void refreshRuns().catch(notice);
  }
}

export async function refreshRuns() {
  runs = await api('/api/studio/runs');
  const list = document.querySelector('#runs');
  const evidence = document.querySelector('#evidence-list');
  list.replaceChildren();
  evidence.replaceChildren();

  if (!runs.length) {
    list.append(el('p', 'No runs in this server session.', 'muted'));
    evidence.append(el('p', 'Evidence appears here after a Studio run.'));
    renderStudioSurface(null);
    return;
  }

  for (const run of [...runs].reverse()) {
    const row = el('div', undefined, 'run');
    const button = el('button', run.plan.goal);
    button.onclick = () => watch(run.id).catch(notice);
    row.append(button, el('span', run.status, 'badge'));
    list.append(row);

    const card = el('div', undefined, 'task');
    card.append(el('h3', run.plan.goal), el('p', run.status, 'badge'));
    const save = el('button', 'Download evidence', 'secondary');
    save.onclick = async () => {
      try {
        download(
          `matterhorn-evidence-${run.id}.json`,
          await api(`/api/studio/runs/${run.id}/evidence`),
        );
      } catch (error) {
        notice(error);
      }
    };
    card.append(
      save,
      el(
        'pre',
        JSON.stringify(
          run.tasks.map(task => ({
            task: task.id,
            detail: task.detail,
            result: task.result,
          })),
          null,
          2,
        ),
      ),
    );
    evidence.append(card);
  }

  const selected = activeId ? runs.find(run => run.id === activeId) : runs[runs.length - 1];
  renderStudioSurface(selected ?? runs[runs.length - 1]);
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
      if (data.run.id === activeId) renderRun(data.run);
    };
    source.onerror = () => {
      document.querySelector('#connection').textContent = 'Live stream reconnecting…';
    };
    source.onopen = () => {
      document.querySelector('#connection').textContent = 'Connected · live updates';
    };
  }
}

export function initStudio() {
  const form = document.querySelector('#run-form');
  renderStudioSurface(null);

  const advanced = document.querySelector('#btn-advanced-toggle');
  if (advanced) {
    advanced.onclick = () => {
      const panel = document.querySelector('#advanced-options');
      panel.hidden = !panel.hidden;
      advanced.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
    };
  }

  form.addEventListener('input', () => {
    reviewed = null;
    document.querySelector('#plan-review').hidden = true;
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.querySelector('#review');
    button.disabled = true;
    try {
      const payload = {
        projectId: document.querySelector('#project').value,
        goal: document.querySelector('#goal').value,
        criteria: document
          .querySelector('#criteria')
          .value.split('\n')
          .map(value => value.trim())
          .filter(Boolean),
      };
      const plan = await api('/api/studio/plan', payload);
      reviewed = payload;
      document.querySelector('#plan-text').textContent =
        `${plan.goal}\n\n${plan.tasks
          .map(task => `${task.title}\n${task.acceptanceCriteria.map(item => '• ' + item).join('\n')}`)
          .join('\n\n')}`;
      document.querySelector('#plan-review').hidden = false;
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
