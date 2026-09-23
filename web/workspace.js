import { api, el, notice } from './api.js';

const $ = id => document.getElementById(id);

export function initWorkspace() {
  let projectId = '', file = null, review = null, transaction = null, generation = 0, busy = false;
  const changeSet = new Map();
  const query = params => new URLSearchParams({ projectId, ...params }).toString();
  const showError = error => notice(error);

  function controls() {
    $('workspace-editor').disabled = !file || busy;
    $('workspace-stage').disabled = !file || busy;
    $('workspace-add-change').disabled = !file || busy;
    $('workspace-stage-transaction').disabled = busy || changeSet.size < 2;
    for (const button of document.querySelectorAll('[data-assist]')) button.disabled = !file || busy;
    for (const button of document.querySelectorAll('[data-validation-id]')) button.disabled = busy;
    $('workspace-project').disabled = busy;
  }

  function renderChangeSet() {
    const container = $('workspace-change-set');
    container.replaceChildren();
    if (!changeSet.size) {
      container.append(el('p', 'No files in this change set yet.', 'muted'));
      controls();
      return;
    }
    for (const [path] of changeSet) {
      const row = el('div', undefined, 'workspace-actions');
      row.append(el('span', path));
      const remove = el('button', 'Remove', 'secondary');
      remove.type = 'button';
      remove.onclick = () => {
        changeSet.delete(path);
        renderChangeSet();
        if (file?.path === path) $('workspace-editor').value = file.content;
      };
      row.append(remove);
      container.append(row);
    }
    container.append(el('p', `${changeSet.size} reviewed file draft${changeSet.size === 1 ? '' : 's'} queued. Multi-file apply requires at least two files.`, 'muted'));
    controls();
  }

  function resetFile() {
    file = null;
    review = null;
    $('workspace-editor').value = '';
    $('workspace-file-title').textContent = 'Open a file';
    $('workspace-review').hidden = true;
    $('workspace-answer').hidden = true;
    controls();
  }

  window.addEventListener('workspace-projects', event => {
    const select = $('workspace-project');
    select.replaceChildren(new Option('Choose a project', ''));
    for (const project of event.detail) select.add(new Option(project.name, project.id));
  });

  async function openFile(path) {
    if (busy) return;
    const ticket = ++generation;
    const data = await api(`/api/workspace/file?${query({ path })}`);
    if (ticket !== generation) return;
    file = data;
    const staged = changeSet.get(data.path);
    if (staged && staged.version !== data.version) changeSet.delete(data.path);
    $('workspace-file-title').textContent = data.path;
    $('workspace-editor').value = changeSet.get(data.path)?.content ?? data.content;
    $('workspace-answer').hidden = true;
    renderChangeSet();
    controls();
  }

  function fileButton(path, label = path) {
    const button = el('button', label, 'file-button');
    button.onclick = () => openFile(path).catch(showError);
    return button;
  }

  async function browse() {
    if (!projectId) return;
    const ticket = ++generation;
    const data = await api(`/api/workspace/files?${query({})}`);
    if (ticket !== generation) return;
    $('workspace-files').replaceChildren(...data.files.map(path => fileButton(path)));
    $('workspace-scope').textContent = `${data.files.length} source files${data.truncated ? ' (listing limit reached)' : ''}. Hidden, generated, and credential paths are excluded.`;
  }

  async function loadReviews() {
    if (!projectId) return;
    const project = projectId;
    const data = await api(`/api/workspace/reviews?${query({})}`);
    if (project !== projectId) return;
    $('workspace-reviews').replaceChildren();
    for (const item of data.reviews) {
      const button = el('button', `${item.path} · ${item.status}`, 'file-button');
      button.onclick = async () => {
        if (busy) return;
        try {
          const result = await api(`/api/workspace/review?id=${encodeURIComponent(item.id)}`);
          if (result.projectId === projectId) showReview(result);
        } catch (error) { showError(error); }
      };
      $('workspace-reviews').append(button);
    }
    if (!data.reviews.length) $('workspace-reviews').append(el('p', 'No single-file proposals for this project yet.', 'muted'));
    if (data.unavailable) $('workspace-reviews').append(el('p', `${data.unavailable} review records could not be loaded. Check the server's review storage.`, 'muted'));
  }

  function showReview(value) {
    review = value;
    $('workspace-review').hidden = false;
    $('workspace-review-title').textContent = value.path;
    $('workspace-before').textContent = value.before;
    $('workspace-after').textContent = value.after;
    $('workspace-review-status').textContent = value.status;
    const actions = $('workspace-review-actions');
    actions.replaceChildren();
    for (const [action, label] of value.status === 'pending'
      ? [['apply', 'Approve and apply'], ['reject', 'Reject proposal']]
      : value.status === 'applied'
        ? [['restore', 'Restore original file']]
        : []) {
      const button = el('button', label);
      button.onclick = () => actReview(action).catch(showError);
      actions.append(button);
    }
  }

  async function actReview(action) {
    if (busy || !review) return;
    busy = true;
    generation++;
    controls();
    for (const button of $('workspace-review-actions').querySelectorAll('button')) button.disabled = true;
    try {
      const updated = await api(`/api/workspace/${action}`, { id: review.id });
      showReview(updated);
      await loadReviews();
      if (file?.path === updated.path && action !== 'reject') {
        const fresh = await api(`/api/workspace/file?${query({ path: updated.path })}`);
        file = fresh;
        changeSet.delete(updated.path);
        $('workspace-editor').value = fresh.content;
        renderChangeSet();
      }
    } finally {
      busy = false;
      controls();
      for (const button of $('workspace-review-actions').querySelectorAll('button')) button.disabled = false;
    }
  }

  async function loadTransactions() {
    if (!projectId) return;
    const project = projectId;
    const data = await api(`/api/workspace/transactions?${query({})}`);
    if (project !== projectId) return;
    const container = $('workspace-transactions');
    container.replaceChildren();
    for (const item of data.transactions) {
      const button = el('button', `${item.files.join(', ')} · ${item.status}`, 'file-button');
      button.onclick = async () => {
        if (busy) return;
        try {
          const result = await api(`/api/workspace/transaction?id=${encodeURIComponent(item.id)}`);
          if (result.projectId === projectId) showTransaction(result);
        } catch (error) { showError(error); }
      };
      container.append(button);
    }
    if (!data.transactions.length) container.append(el('p', 'No multi-file transactions yet.', 'muted'));
    if (data.unavailable) container.append(el('p', `${data.unavailable} transaction records could not be loaded.`, 'muted'));
  }

  function showTransaction(value) {
    transaction = value;
    const panel = $('workspace-transaction');
    panel.hidden = false;
    $('workspace-transaction-status').textContent = `${value.status}${value.detail ? ` — ${value.detail}` : ''}`;
    const files = $('workspace-transaction-files');
    files.replaceChildren();
    for (const item of value.files) {
      const block = el('div');
      block.append(el('h3', item.path));
      const grid = el('div', undefined, 'workspace-grid');
      const before = el('div');
      before.append(el('h3', 'Before'));
      before.append(el('pre', item.before));
      const after = el('div');
      after.append(el('h3', 'Proposed'));
      after.append(el('pre', item.after));
      grid.append(before, after);
      block.append(grid);
      files.append(block);
    }
    const actions = $('workspace-transaction-actions');
    actions.replaceChildren();
    const available = value.status === 'pending'
      ? [['apply', 'Approve and apply all'], ['reject', 'Reject change set']]
      : ['applied', 'conflict'].includes(value.status)
        ? [['rollback', 'Restore original files']]
        : [];
    for (const [action, label] of available) {
      const button = el('button', label);
      button.onclick = () => actTransaction(action).catch(showError);
      actions.append(button);
    }
  }

  async function actTransaction(action) {
    if (busy || !transaction) return;
    busy = true;
    generation++;
    controls();
    try {
      const updated = await api(`/api/workspace/transaction-${action}`, { id: transaction.id });
      showTransaction(updated);
      await loadTransactions();
      if (file && updated.files.some(item => item.path === file.path) && action !== 'reject') {
        const fresh = await api(`/api/workspace/file?${query({ path: file.path })}`);
        file = fresh;
        changeSet.delete(file.path);
        $('workspace-editor').value = fresh.content;
        renderChangeSet();
      }
    } finally {
      busy = false;
      controls();
    }
  }

  async function loadValidations() {
    if (!projectId) return;
    const project = projectId;
    const tasks = await api(`/api/workspace/validations?${query({})}`);
    if (project !== projectId) return;
    const container = $('workspace-validations');
    container.replaceChildren();
    if (!tasks.length) {
      container.append(el('p', 'No validation tasks are configured for this project.', 'muted'));
      controls();
      return;
    }
    for (const task of tasks) {
      const button = el('button', task.name);
      button.dataset.validationId = task.id;
      button.onclick = () => runValidation(task.id).catch(showError);
      container.append(button);
    }
    controls();
  }

  async function runValidation(id) {
    if (busy || !projectId) return;
    busy = true;
    controls();
    const output = $('workspace-validation-output');
    output.hidden = false;
    output.textContent = 'Running configured validation…';
    try {
      const result = await api('/api/workspace/validate', { projectId, id });
      output.textContent = `${result.name}: ${result.status} (exit ${result.exitCode ?? 'n/a'}, ${result.durationMs} ms)\n\nSTDOUT\n${result.stdout || '(empty)'}\n\nSTDERR\n${result.stderr || '(empty)'}${result.detail ? `\n\n${result.detail}` : ''}`;
    } finally {
      busy = false;
      controls();
    }
  }

  $('workspace-project').onchange = async () => {
    if (busy) return;
    projectId = $('workspace-project').value;
    generation++;
    changeSet.clear();
    renderChangeSet();
    resetFile();
    $('workspace-files').replaceChildren();
    $('workspace-reviews').replaceChildren();
    $('workspace-transactions').replaceChildren();
    $('workspace-validation-output').hidden = true;
    $('workspace-transaction').hidden = true;
    if (!projectId) return;
    try {
      await Promise.all([browse(), loadReviews(), loadTransactions(), loadValidations()]);
    } catch (error) { showError(error); }
  };

  $('workspace-refresh').onclick = () => browse().catch(showError);

  $('workspace-search-form').onsubmit = async event => {
    event.preventDefault();
    if (!projectId) return;
    const ticket = ++generation;
    try {
      const data = await api(`/api/workspace/search?${query({ q: $('workspace-query').value })}`);
      if (ticket !== generation) return;
      $('workspace-files').replaceChildren(...data.matches.map(match => fileButton(match.path, `${match.path}:${match.line} — ${match.text}`)));
      $('workspace-scope').textContent = `${data.matches.length} matches${data.truncated ? ' (limit reached)' : ''}; ${data.skipped} unreadable, sensitive, or oversized files skipped.`;
    } catch (error) { showError(error); }
  };

  $('workspace-stage').onclick = async () => {
    if (!file || busy) return;
    busy = true;
    generation++;
    controls();
    try {
      showReview(await api('/api/workspace/stage', {
        projectId,
        path: file.path,
        version: file.version,
        content: $('workspace-editor').value,
      }));
      changeSet.delete(file.path);
      renderChangeSet();
      await loadReviews();
    } catch (error) { showError(error); }
    finally { busy = false; controls(); }
  };

  $('workspace-add-change').onclick = () => {
    if (!file || busy) return;
    const content = $('workspace-editor').value;
    if (content === file.content) {
      showError(new Error('Edit this file before adding it to the multi-file change set.'));
      return;
    }
    changeSet.set(file.path, { path: file.path, version: file.version, content });
    renderChangeSet();
  };

  $('workspace-stage-transaction').onclick = async () => {
    if (busy || changeSet.size < 2) return;
    busy = true;
    generation++;
    controls();
    try {
      const value = await api('/api/workspace/transaction-stage', { projectId, files: [...changeSet.values()] });
      changeSet.clear();
      renderChangeSet();
      showTransaction(value);
      await loadTransactions();
    } catch (error) { showError(error); }
    finally { busy = false; controls(); }
  };

  for (const button of document.querySelectorAll('[data-assist]')) button.onclick = async () => {
    if (!file || busy) return;
    if ($('workspace-editor').value !== file.content) {
      showError(new Error('Review, add, apply, or discard your manual edits before asking for file assistance.'));
      return;
    }
    busy = true;
    generation++;
    controls();
    $('workspace-answer').hidden = false;
    $('workspace-answer').textContent = 'Matterhorn is working…';
    try {
      const answer = await api('/api/workspace/assist', {
        projectId,
        path: file.path,
        version: file.version,
        intent: button.dataset.assist,
        prompt: $('workspace-prompt').value,
        provider: $('provider').value,
      });
      $('workspace-answer').textContent = answer.response;
      if (answer.review) {
        showReview(answer.review);
        await loadReviews();
      } else if (['propose', 'diagnose'].includes(button.dataset.assist)) {
        $('workspace-answer').textContent += '\n\nNo concrete edit was returned. Nothing was changed.';
      }
    } catch (error) {
      $('workspace-answer').textContent = 'Assistance failed; no edit was applied.';
      showError(error);
    } finally {
      busy = false;
      controls();
    }
  };

  renderChangeSet();
  controls();
}
