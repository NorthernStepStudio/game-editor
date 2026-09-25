import { api, el } from './api.js';

let assets = [];
let providers = [];
let selectedAssetId = null;
let activeCategory = 'all';
let query = '';
let routingPreferences = null;
let providerSelectionTouched = false;

const categoryTypes = {
  characters: new Set(['pixel_sprite', 'sprite_sheet', 'animation']),
  environments: new Set(['tile', 'tileset', 'background', 'concept_art']),
  props: new Set(['texture', 'other']),
  ui: new Set(['ui_icon', 'ui_atlas']),
  '3d': new Set(['mesh_3d', 'material', 'rig']),
  audio: new Set(['audio_sfx', 'audio_music', 'audio_voice']),
};

function assetMatchesCategory(asset) {
  if (activeCategory === 'all') return true;
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
  inspector.replaceChildren(
    el('h3', 'Asset Inspector'),
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
    header.append(title);
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
    inspector.append(meta, renderLineage(detail.lineage ?? [], asset.assetId));
  } catch (error) {
    renderInspectorEmpty(error?.message || 'Could not load this asset.');
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
  const provider = currentProvider();
  const kind = document.querySelector('#asset-kind');
  const operation = document.querySelector('#asset-operation');
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
  window.addEventListener('workspace-projects', (event) => {
    populateProjectOptions(Array.isArray(event.detail) ? event.detail : []);
  });
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

  renderGallery();
  renderInspectorEmpty();
  updateGenerationControls();
}
