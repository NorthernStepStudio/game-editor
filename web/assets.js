import { api, el } from './api.js';

let assets = [];
let providers = [];
let selectedAssetId = null;
let activeCategory = 'all';
let query = '';
let routingPreferences = null;
let providerSelectionTouched = false;

const categoryTypes = {
  characters: new Set(['pixel_sprite', 'sprite_sheet', 'animation', 'mesh_3d', 'rig']),
  environments: new Set(['tile', 'tileset', 'background', 'concept_art']),
  props: new Set(['texture', 'other']),
  ui: new Set(['ui_icon', 'ui_atlas']),
  '3d': new Set(['mesh_3d', 'material', 'rig']),
  audio: new Set(['audio_sfx', 'audio_music', 'audio_voice']),
};

function assetMatchesCategory(asset) {
  if (activeCategory === 'all') return true;
  if (activeCategory === 'characters' && (asset.type === 'rig' || asset.assetId?.includes('yun') || asset.assetId?.includes('character'))) return true;
  return categoryTypes[activeCategory]?.has(asset.type) ?? false;
}

function assetMatchesQuery(asset) {
  if (!query) return true;
  const haystack = [
    asset.assetId,
    asset.type,
    asset.operation,
    asset.generationProvider,
    ...(asset.sourceLicenseIds ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function previewNode(asset, large = false) {
  if (asset.previewUrl) {
    const img = document.createElement('img');
    img.className = large ? 'asset-preview-image large' : 'asset-preview-image';
    img.src = asset.previewUrl;
    img.alt = `Preview of ${asset.assetId}`;
    img.loading = 'lazy';
    return img;
  }
  return el(
    'div',
    asset.type.replaceAll('_', ' '),
    large ? 'asset-thumb asset-thumb-empty large' : 'asset-thumb asset-thumb-empty',
  );
}

function metadataRow(label, value) {
  const row = el('div', undefined, 'meta-item');
  row.append(el('span', label, 'lbl'), el('span', value, 'val'));
  return row;
}

function renderGallery() {
  const gallery = document.querySelector('#asset-gallery');
  if (!gallery) return;
  gallery.replaceChildren();

  const filtered = assets.filter(
    (asset) => assetMatchesCategory(asset) && assetMatchesQuery(asset),
  );

  if (!filtered.length) {
    gallery.append(
      el(
        'div',
        assets.length
          ? 'No assets match the current filter.'
          : 'No Foundry assets have been persisted yet.',
        'empty-state',
      ),
    );
    return;
  }

  for (const asset of filtered) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `asset-card${asset.assetId === selectedAssetId ? ' active' : ''}`;
    card.dataset.assetId = asset.assetId;
    card.append(previewNode(asset));

    const info = el('div', undefined, 'asset-card-info');
    info.append(
      el('strong', asset.assetId),
      el(
        'span',
        [asset.type, asset.generationProvider].filter(Boolean).join(' · '),
        'asset-type',
      ),
    );
    if (asset.operation) info.append(el('span', asset.operation, 'version-tag'));
    card.append(info);
    card.onclick = () => selectAsset(asset.assetId);
    gallery.append(card);
  }
}

function renderInspectorEmpty(message = 'Select an asset to inspect provenance and lineage.') {
  const inspector = document.querySelector('#asset-inspector');
  if (!inspector) return;
  inspector.hidden = true;
  inspector.replaceChildren(
    el('h3', 'Asset Inspector'),
    el('p', message, 'muted'),
  );
}

function renderLineage(lineage, selectedId) {
  const box = el('div', undefined, 'asset-lineage');
  box.append(el('h4', 'Lineage'));
  if (!lineage.length) {
    box.append(el('p', 'No lineage recorded.', 'muted-sm'));
    return box;
  }

  for (let index = 0; index < lineage.length; index += 1) {
    const asset = lineage[index];
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `lineage-row${asset.assetId === selectedId ? ' active' : ''}`;
    row.append(
      el('span', asset.assetId, 'lineage-id'),
      el('span', asset.operation ?? asset.type, 'lineage-operation'),
    );
    row.onclick = () => selectAsset(asset.assetId);
    box.append(row);
    if (index < lineage.length - 1) box.append(el('span', '↓', 'lineage-arrow'));
  }
  return box;
}

async function selectAsset(assetId) {
  selectedAssetId = assetId;
  renderGallery();
  const inspector = document.querySelector('#asset-inspector');
  if (!inspector) return;
  inspector.hidden = false;
  const loadingHeader = el('div', undefined, 'inspector-header');
  loadingHeader.append(el('h3', 'Asset Inspector'));
  const loadingClose = el('button', '×', 'icon-action');
  loadingClose.type = 'button';
  loadingClose.setAttribute('aria-label', 'Close asset inspector');
  loadingClose.onclick = () => { inspector.hidden = true; };
  loadingHeader.append(loadingClose);
  inspector.replaceChildren(
    loadingHeader,
    el('p', 'Loading asset lineage…', 'muted'),
  );

  try {
    const detail = await api(
      `/api/foundry/assets/${encodeURIComponent(assetId)}`,
    );
    const asset = detail.asset;
    inspector.replaceChildren();

    const header = el('div', undefined, 'inspector-header');
    const title = el('div');
    title.append(
      el('h3', asset.assetId),
      el('p', `${asset.type}${asset.operation ? ` · ${asset.operation}` : ''}`, 'muted-sm'),
    );
    const close = el('button', '×', 'icon-action');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close asset inspector');
    close.onclick = () => { inspector.hidden = true; };
    header.append(title, close);
    inspector.append(header);

    const preview = el('div', undefined, 'inspector-preview-box');
    preview.append(previewNode(asset, true));
    inspector.append(preview);

    const meta = el('div', undefined, 'inspector-meta-list');
    meta.append(
      metadataRow('Provider', asset.generationProvider ?? 'Not recorded'),
      metadataRow('Created', formatDate(asset.createdAt)),
      metadataRow(
        'Dimensions',
        asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'Not recorded',
      ),
      metadataRow(
        'License',
        asset.sourceLicenseIds?.length
          ? asset.sourceLicenseIds.join(', ')
          : 'Not recorded',
      ),
      metadataRow(
        'Cost',
        asset.cost
          ? `${asset.cost.amount} ${asset.cost.currency}`
          : 'No external cost recorded',
      ),
    );
    if (asset.model) meta.append(metadataRow('Model', asset.model));
    if (asset.contentHash) meta.append(metadataRow('Content hash', asset.contentHash));
    if (asset.parentAsset) meta.append(metadataRow('Parent', asset.parentAsset));
    if (asset.referenceAssets?.length) {
      meta.append(metadataRow('References', asset.referenceAssets.join(', ')));
    }

    // Only real rigs (and the Yun production characters) carry this rig/motion metadata.
    if (asset.type === 'rig' || asset.assetId.includes('yun')) {
      const motionSection = el('div', undefined, 'motion-studio-inspector-card surface');
      motionSection.style.marginTop = '12px';
      motionSection.style.padding = '10px';
      motionSection.style.border = '1px solid var(--line)';
      motionSection.style.borderRadius = '6px';
      
      const openMotionBtn = document.createElement('button');
      openMotionBtn.type = 'button';
      openMotionBtn.className = 'primary-action';
      openMotionBtn.style.marginTop = '8px';
      openMotionBtn.style.width = '100%';
      openMotionBtn.textContent = 'Open in Character Studio →';
      openMotionBtn.onclick = () => {
        location.hash = '#characters/motion';
      };

      motionSection.append(
        el('h4', 'Motion Studio Pipeline', 'eyebrow'),
        el('p', 'Auto-Rigging, Locomotion Clips & Godot Export', 'muted-sm'),
        metadataRow('Skeleton', 'Humanoid (18 bones)'),
        metadataRow('Weighting', 'Automatic Heat / Normalized'),
        metadataRow('Clips', 'idle, walk, run, sprint, turn'),
        metadataRow('Godot Engine', 'Godot 4.7.2 Ready'),
        openMotionBtn,
      );
      meta.append(motionSection);
    }

    inspector.append(meta);
    if (asset.files?.length) inspector.append(renderAssetFiles(asset));
    inspector.append(renderLineage(detail.lineage ?? [], asset.assetId));
  } catch (error) {
    renderInspectorEmpty(error?.message || 'Could not load this asset.');
  }
}

const RENDER_ORDER = ['render_front.png', 'render_three_quarter.png', 'render_side.png', 'render_back.png'];

function renderAssetFiles(asset) {
  const section = el('div', undefined, 'asset-files surface');
  const renders = asset.files
    .filter((file) => file.role === 'render')
    .sort((a, b) => RENDER_ORDER.indexOf(a.name) - RENDER_ORDER.indexOf(b.name));
  if (renders.length) {
    section.append(el('h4', 'Turnaround', 'eyebrow'));
    const grid = el('div', undefined, 'asset-turnaround');
    for (const file of renders) {
      const figure = el('figure');
      const img = document.createElement('img');
      img.src = file.url;
      img.alt = `${asset.assetId} ${file.name.replace('render_', '').replace('.png', '').replace('_', ' ')} view`;
      img.loading = 'lazy';
      figure.append(img, el('figcaption', file.name.replace('render_', '').replace('.png', '').replace('_', ' ')));
      grid.append(figure);
    }
    section.append(grid);
  }

  const downloads = asset.files.filter((file) => ['main', 'source', 'script'].includes(file.role) || file.name.endsWith('.glb'));
  if (downloads.length) {
    section.append(el('h4', 'Files', 'eyebrow'));
    const list = el('div', undefined, 'asset-downloads');
    for (const file of downloads) {
      const link = el('a', file.name, 'text-link');
      link.href = file.url;
      link.setAttribute('download', file.name);
      list.append(link);
    }
    section.append(list);
  }

  const actions = el('div', undefined, 'asset-actions');
  if (asset.files.some((file) => file.role === 'script')) {
    const iterate = el('button', 'Iterate on this asset', 'secondary-action');
    iterate.type = 'button';
    iterate.onclick = () => openIteration(asset);
    actions.append(iterate);
  }

  const gameProjects = foundryProjects.filter((project) => project.id !== 'library');
  if (gameProjects.length) {
    const target = document.createElement('select');
    target.setAttribute('aria-label', 'Game project to send this asset to');
    for (const project of gameProjects) target.add(new Option(project.name, project.id));
    const send = el('button', 'Send to game', 'primary-action');
    send.type = 'button';
    const result = el('p', '', 'muted-sm');
    send.onclick = async () => {
      send.disabled = true;
      result.textContent = 'Copying files…';
      try {
        const sent = await api(`/api/foundry/assets/${encodeURIComponent(asset.assetId)}/send`, { projectId: target.value });
        result.textContent = `Copied ${sent.files.length} file(s) to ${sent.folder} with a provenance record.`;
        result.className = 'success-text';
      } catch (error) {
        result.textContent = error?.message || 'Could not send this asset.';
        result.className = 'error-text';
      } finally {
        send.disabled = false;
      }
    };
    const row = el('div', undefined, 'asset-send-row');
    row.append(target, send);
    actions.append(row, result);
  }
  section.append(actions);
  return section;
}

function openIteration(asset) {
  const drawer = document.querySelector('#asset-generator');
  if (drawer) drawer.hidden = false;
  const provider = providers.find((candidate) => candidate.id === asset.generationProvider && candidate.available)
    ?? providers.find((candidate) => candidate.id.startsWith('blender-agent') && candidate.available);
  if (provider) {
    document.querySelector('#asset-provider').value = provider.id;
    providerSelectionTouched = true;
    updateGenerationControls();
  }
  const base = asset.assetId.replace(/_v\d+$/, '');
  const version = Number(/_v(\d+)$/.exec(asset.assetId)?.[1] ?? 1) + 1;
  let candidate = `${base}_v${version}`;
  for (let n = version; assets.some((existing) => existing.assetId === candidate); n++) candidate = `${base}_v${n + 1}`;
  document.querySelector('#asset-id').value = candidate;
  document.querySelector('#asset-parent').value = asset.assetId;
  const kind = document.querySelector('#asset-kind');
  if ([...kind.options].some((option) => option.value === asset.type)) kind.value = asset.type;
  const operation = document.querySelector('#asset-operation');
  if ([...operation.options].some((option) => option.value === 'edit')) operation.value = 'edit';
  const prompt = document.querySelector('#asset-prompt');
  prompt.value = '';
  prompt.placeholder = 'Describe the change, e.g. "make it taller and add rust to the metal"';
  prompt.focus();
  setGenerationStatus(`Iterating on ${asset.assetId}: the previous version is kept, this creates ${candidate}.`);
}

let foundryProjects = [];
let jobPollTimer;

async function loadFoundryProjects() {
  try {
    const response = await api('/api/foundry/projects');
    foundryProjects = Array.isArray(response.projects) ? response.projects : [];
  } catch {
    foundryProjects = [];
  }
  populateProjectOptions(foundryProjects);
  const select = document.querySelector('#asset-project');
  if (select && !select.value && foundryProjects.some((project) => project.id === 'library')) select.value = 'library';
}

function renderJobs(jobs) {
  const container = document.querySelector('#asset-jobs');
  if (!container) return;
  container.replaceChildren();
  if (!jobs.length) {
    container.append(el('p', 'No builds yet.', 'muted-sm'));
    return;
  }
  for (const job of jobs.slice(0, 12)) {
    const row = el('div', undefined, `asset-job ${job.status}`);
    const head = el('div', undefined, 'asset-job-head');
    head.append(el('strong', job.assetId), el('span', job.status, `status-pill ${job.status}`));
    row.append(head);
    const last = job.error ?? job.progress.at(-1)?.message ?? (job.status === 'queued' ? 'Waiting for the previous build to finish…' : '');
    if (last) row.append(el('p', last, job.status === 'failed' ? 'error-text' : 'muted-sm'));
    if (job.status === 'succeeded' && job.assetIds?.[0]) {
      const open = el('button', 'Open', 'text-link');
      open.type = 'button';
      open.onclick = () => selectAsset(job.assetIds[0]);
      row.append(open);
    }
    container.append(row);
  }
}

async function pollJobs() {
  clearTimeout(jobPollTimer);
  try {
    const { jobs } = await api('/api/foundry/jobs');
    const before = new Set(assets.map((asset) => asset.assetId));
    renderJobs(jobs);
    const finishedNew = jobs.some((job) => job.status === 'succeeded' && job.assetIds?.some((id) => !before.has(id)));
    if (finishedNew) await loadAssets();
    if (jobs.some((job) => job.status === 'queued' || job.status === 'running')) {
      jobPollTimer = setTimeout(pollJobs, 3000);
    }
  } catch {
    // Stop polling on failure; reopening the drawer or queuing a build resumes it.
  }
}

async function submitPack() {
  const provider = currentProvider();
  const packId = document.querySelector('#asset-id').value.trim();
  const style = document.querySelector('#asset-pack-style').value.trim();
  const items = document.querySelector('#asset-pack-items').value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const split = line.indexOf(':');
      return split > 0
        ? { name: line.slice(0, split).trim(), prompt: line.slice(split + 1).trim() }
        : { name: line, prompt: line };
    });
  if (!provider?.id.startsWith('blender-agent')) {
    setGenerationStatus('Packs are built by a Blender Agent provider. Choose one first.', 'error-text');
    return;
  }
  if (!packId || !style || !items.length) {
    setGenerationStatus('A pack needs a name (Asset ID), a style and at least one item.', 'error-text');
    return;
  }
  try {
    const { jobs } = await api('/api/foundry/packs', {
      projectId: document.querySelector('#asset-project').value,
      packId,
      style,
      items,
      kind: document.querySelector('#asset-kind').value,
      operation: 'generate',
      providerId: provider.id,
      allowNetwork: provider.requiresNetwork ? document.querySelector('#asset-allow-network').checked : false,
      requireCommercialUse: document.querySelector('#asset-commercial-only').checked,
    });
    setGenerationStatus(`Queued ${jobs.length} pack item(s). Progress is shown under Builds.`, 'success-text');
    pollJobs();
  } catch (error) {
    setGenerationStatus(error?.message || 'Could not queue the pack.', 'error-text');
  }
}

function setGenerationStatus(text, className = 'muted-sm') {
  const status = document.querySelector('#asset-generate-status');
  if (!status) return;
  status.textContent = text;
  status.className = className;
}

function populateProjectOptions(projectList) {
  const select = document.querySelector('#asset-project');
  if (!select) return;
  const previous = select.value;
  select.replaceChildren(new Option('Choose a configured project', ''));
  for (const project of projectList) {
    select.add(new Option(project.name, project.id));
  }
  if (projectList.some((project) => project.id === previous)) {
    select.value = previous;
  } else if (projectList.length === 1) {
    select.value = projectList[0].id;
  }
}

function currentProvider() {
  const id = document.querySelector('#asset-provider')?.value;
  return providers.find((provider) => provider.id === id);
}

function preferredProviderId() {
  if (!routingPreferences) return undefined;
  if (routingPreferences.assets && routingPreferences.assets !== 'auto') {
    return routingPreferences.assets;
  }
  const available = providers.filter((provider) => provider.available);
  if (routingPreferences.localFirst) {
    return available.find((provider) => provider.local)?.id ?? available[0]?.id;
  }
  return available[0]?.id;
}

function providerBlockedByRouting(provider) {
  if (!provider || !routingPreferences) return undefined;
  if (provider.requiresNetwork && !routingPreferences.allowNetworkProviders) {
    return 'Network providers are disabled in Studio routing settings.';
  }
  if (provider.externalCost && !routingPreferences.allowExternalCostProviders) {
    return 'Paid providers are disabled in Studio routing settings.';
  }
  return undefined;
}

function labelFor(value) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function fillSelect(select, values) {
  const previous = select.value;
  select.replaceChildren();
  for (const value of [...new Set(values)].sort()) {
    select.add(new Option(labelFor(value), value));
  }
  if ([...select.options].some((option) => option.value === previous)) {
    select.value = previous;
  }
}

function updateGenerationControls() {
  const providerSelect = document.querySelector('#asset-provider');
  const kind = document.querySelector('#asset-kind');
  const operation = document.querySelector('#asset-operation');
  if (!providerSelect || !kind || !operation) return;
  const provider = currentProvider();
  const costPanel = document.querySelector('#asset-cost-panel');
  const network = document.querySelector('#asset-allow-network');
  const approval = document.querySelector('#asset-approve-cost');
  const maxCost = document.querySelector('#asset-max-cost');
  const currency = document.querySelector('#asset-cost-currency');
  const submit = document.querySelector('#asset-generate-submit');
  const summary = document.querySelector('#asset-provider-summary');
  const commercialOnly = document.querySelector('#asset-commercial-only');

  if (!provider) {
    fillSelect(kind, []);
    fillSelect(operation, []);
    costPanel.hidden = true;
    submit.disabled = true;
    summary.textContent = 'Choose a configured provider';
    setGenerationStatus('Choose a configured provider before generating.');
    return;
  }

  fillSelect(kind, provider.kinds ?? []);
  fillSelect(operation, provider.operations ?? []);

  const needsGuard = provider.requiresNetwork || provider.externalCost;
  costPanel.hidden = !needsGuard;
  network.closest('label').hidden = !provider.requiresNetwork;
  approval.closest('label').hidden = !provider.externalCost;

  if (!provider.requiresNetwork) network.checked = false;
  if (!provider.externalCost) approval.checked = false;

  if (provider.estimatedCost) {
    maxCost.value = String(provider.estimatedCost.amount);
    maxCost.min = String(provider.estimatedCost.amount);
    currency.textContent = provider.estimatedCost.currency;
  } else {
    maxCost.value = '';
    maxCost.min = '0.01';
    currency.textContent = 'budget units';
  }
  maxCost.closest('label').hidden = !provider.externalCost;

  if (routingPreferences?.requireCommercialUse) {
    commercialOnly.checked = true;
    commercialOnly.disabled = true;
    commercialOnly.title =
      'Commercial-use-only is enforced by Studio routing settings.';
  } else {
    commercialOnly.disabled = false;
    commercialOnly.title = '';
  }

  const blockedByCommercialPolicy =
    commercialOnly.checked && !provider.commercialUseAllowed;
  const routingBlock = providerBlockedByRouting(provider);

  network.disabled = Boolean(
    provider.requiresNetwork &&
      routingPreferences &&
      !routingPreferences.allowNetworkProviders,
  );
  approval.disabled = Boolean(
    provider.externalCost &&
      routingPreferences &&
      !routingPreferences.allowExternalCostProviders,
  );

  submit.disabled =
    !provider.available ||
    !provider.kinds?.length ||
    !provider.operations?.length ||
    blockedByCommercialPolicy ||
    Boolean(routingBlock);
  summary.textContent = provider.note;
  setGenerationStatus(
    routingBlock
      ? routingBlock
      : blockedByCommercialPolicy
        ? 'This provider is not approved for commercial-use output. Turn off the commercial-only requirement for prototype/review generation, or configure reviewed license metadata on the server.'
        : provider.externalCost && provider.estimatedCost
          ? `Estimated provider cost: ${provider.estimatedCost.amount} ${provider.estimatedCost.currency}. Per-request approval is still required.`
          : provider.note,
    routingBlock || blockedByCommercialPolicy ? 'error-text' : 'muted-sm',
  );
}

function renderSettingsProviders() {
  const container = document.querySelector('#settings-foundry-providers');
  if (!container) return;
  container.replaceChildren();

  if (!providers.length) {
    container.append(el('p', 'No Foundry providers reported by the server.', 'muted-sm'));
    return;
  }

  for (const provider of providers) {
    const row = el('div', undefined, 'provider-status-row');
    const identity = el('div', undefined, 'provider-status-identity');
    identity.append(
      el('strong', provider.name),
      el('span', provider.note, 'muted-sm'),
    );

    const badges = el('div', undefined, 'provider-status-badges');
    badges.append(
      el(
        'span',
        provider.available ? 'Available' : 'Setup required',
        `badge-availability ${provider.available ? 'available' : 'planned'}`,
      ),
      el('span', provider.local ? 'Local' : 'Network', 'spec-tag'),
      el('span', provider.externalCost ? 'Paid' : 'No external cost', 'spec-tag'),
    );
    if (provider.model) {
      badges.append(el('span', provider.model, 'spec-tag'));
    }
    if (provider.estimatedCost) {
      badges.append(
        el(
          'span',
          `~${provider.estimatedCost.amount} ${provider.estimatedCost.currency}/request`,
          'spec-tag',
        ),
      );
    }
    row.append(identity, badges);
    container.append(row);
  }
}

function renderProviderOptions() {
  const select = document.querySelector('#asset-provider');
  if (!select) return;
  const previous = select.value;
  select.replaceChildren(new Option('Choose provider', ''));

  for (const provider of providers) {
    const option = new Option(
      `${provider.name}${provider.available ? '' : ' — setup required'}`,
      provider.id,
    );
    option.disabled = !provider.available;
    select.add(option);
  }

  if (
    providerSelectionTouched &&
    providers.some((provider) => provider.id === previous && provider.available)
  ) {
    select.value = previous;
  } else {
    const preferred = preferredProviderId();
    if (
      preferred &&
      providers.some((provider) => provider.id === preferred && provider.available)
    ) {
      select.value = preferred;
    } else {
      const available = providers.filter((provider) => provider.available);
      if (available.length === 1) select.value = available[0].id;
    }
  }
  updateGenerationControls();
}

export async function loadAssetProviders() {
  const response = await api('/api/foundry/providers');
  providers = Array.isArray(response.providers) ? response.providers : [];
  renderProviderOptions();
  renderSettingsProviders();
  return providers;
}

async function generateAsset(event) {
  event.preventDefault();
  const provider = currentProvider();
  const submit = document.querySelector('#asset-generate-submit');
  if (!provider) {
    setGenerationStatus('Choose a configured provider.', 'error-text');
    return;
  }

  const widthValue = document.querySelector('#asset-width').value;
  const heightValue = document.querySelector('#asset-height').value;
  if ((widthValue && !heightValue) || (!widthValue && heightValue)) {
    setGenerationStatus('Width and height must be provided together.', 'error-text');
    return;
  }

  const routingBlock = providerBlockedByRouting(provider);
  if (routingBlock) {
    setGenerationStatus(routingBlock, 'error-text');
    return;
  }
  if (provider.requiresNetwork && !document.querySelector('#asset-allow-network').checked) {
    setGenerationStatus('Approve network access for this provider first.', 'error-text');
    return;
  }
  if (provider.externalCost && !document.querySelector('#asset-approve-cost').checked) {
    setGenerationStatus('Approve the external provider cost first.', 'error-text');
    return;
  }

  const referenceAssets = document
    .querySelector('#asset-references')
    .value.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const payload = {
    projectId: document.querySelector('#asset-project').value,
    assetId: document.querySelector('#asset-id').value.trim(),
    kind: document.querySelector('#asset-kind').value,
    operation: document.querySelector('#asset-operation').value,
    prompt: document.querySelector('#asset-prompt').value.trim() || undefined,
    parentAsset: document.querySelector('#asset-parent').value.trim() || undefined,
    referenceAssets,
    providerId: provider.id,
    allowNetwork: provider.requiresNetwork
      ? document.querySelector('#asset-allow-network').checked
      : false,
    approveExternalCost: provider.externalCost
      ? document.querySelector('#asset-approve-cost').checked
      : false,
    requireCommercialUse: document.querySelector('#asset-commercial-only').checked,
    ...(widthValue && heightValue
      ? { width: Number(widthValue), height: Number(heightValue) }
      : {}),
    ...(provider.externalCost
      ? {
          maxCost: {
            currency:
              provider.estimatedCost?.currency ??
              document.querySelector('#asset-cost-currency').textContent,
            amount: Number(document.querySelector('#asset-max-cost').value),
          },
        }
      : {}),
  };

  if (provider.id.startsWith('blender-agent')) {
    // Blender Agent builds take minutes: queue them and follow progress under Builds.
    try {
      await api('/api/foundry/jobs', payload);
      setGenerationStatus(`Queued ${payload.assetId}. ${provider.name} is building it; progress is shown under Builds.`, 'success-text');
      document.querySelector('#asset-allow-network').checked = false;
      pollJobs();
    } catch (error) {
      setGenerationStatus(error?.message || 'Could not queue this build.', 'error-text');
    }
    return;
  }

  submit.disabled = true;
  setGenerationStatus(`Generating ${payload.assetId} with ${provider.name}…`);
  try {
    const result = await api('/api/foundry/generate', payload);
    await loadAssets();
    const generated = result.assets?.[0];
    if (generated?.assetId) await selectAsset(generated.assetId);
    setGenerationStatus(
      result.cost
        ? `Generated successfully · ${result.cost.amount} ${result.cost.currency}`
        : 'Generated successfully and added to the catalog.',
      'success-text',
    );
    document.querySelector('#asset-approve-cost').checked = false;
    document.querySelector('#asset-allow-network').checked = false;
  } catch (error) {
    setGenerationStatus(error?.message || 'Asset generation failed.', 'error-text');
  } finally {
    submit.disabled = false;
  }
}

export async function loadAssets() {
  const response = await api('/api/foundry/assets');
  assets = Array.isArray(response.assets) ? response.assets : [];

  if (selectedAssetId && !assets.some((asset) => asset.assetId === selectedAssetId)) {
    selectedAssetId = null;
    renderInspectorEmpty();
  }

  renderGallery();
  return assets;
}

export function initAssets() {
  // Foundry projects include the built-in Asset Library, so assets never require a game.
  window.addEventListener('workspace-projects', () => { loadFoundryProjects(); });
  loadFoundryProjects();
  window.addEventListener('studio-routing-preferences', (event) => {
    routingPreferences = event.detail ?? null;
    providerSelectionTouched = false;
    const commercialOnly = document.querySelector('#asset-commercial-only');
    if (commercialOnly && routingPreferences) {
      commercialOnly.checked = Boolean(routingPreferences.requireCommercialUse);
    }
    renderProviderOptions();
  });

  const search = document.querySelector('#asset-search');
  if (search) {
    search.addEventListener('input', () => {
      query = search.value.trim().toLowerCase();
      renderGallery();
    });
  }

  for (const button of document.querySelectorAll('[data-asset-category]')) {
    button.onclick = () => {
      activeCategory = button.dataset.assetCategory;
      for (const peer of document.querySelectorAll('[data-asset-category]')) {
        peer.classList.toggle('active', peer === button);
      }
      renderGallery();
    };
  }

  const provider = document.querySelector('#asset-provider');
  if (provider) {
    provider.onchange = () => {
      providerSelectionTouched = true;
      updateGenerationControls();
    };
  }
  const commercialOnly = document.querySelector('#asset-commercial-only');
  if (commercialOnly) commercialOnly.onchange = updateGenerationControls;

  const form = document.querySelector('#asset-generate-form');
  if (form) form.addEventListener('submit', generateAsset);

  const refresh = document.querySelector('#refresh-assets');
  if (refresh) {
    refresh.onclick = async () => {
      refresh.disabled = true;
      try {
        await Promise.all([loadAssets(), loadAssetProviders()]);
        if (selectedAssetId) await selectAsset(selectedAssetId);
      } finally {
        refresh.disabled = false;
      }
    };
  }

  const packSubmit = document.querySelector('#asset-pack-submit');
  if (packSubmit) packSubmit.onclick = submitPack;
  const opener = document.querySelector('#open-asset-generator');
  if (opener) opener.addEventListener('click', () => { pollJobs(); });

  renderGallery();
  renderInspectorEmpty();
  updateGenerationControls();
}
