import { api, el } from './api.js';

let assets = [];
let selectedAssetId = null;
let activeCategory = 'all';
let query = '';

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

function assetTitle(asset) {
  return asset.assetId;
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
  const placeholder = el(
    'div',
    asset.type.replaceAll('_', ' '),
    large ? 'asset-thumb asset-thumb-empty large' : 'asset-thumb asset-thumb-empty',
  );
  return placeholder;
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
      el('strong', assetTitle(asset)),
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
    if (asset.contentHash) {
      meta.append(metadataRow('Content hash', asset.contentHash));
    }
    if (asset.parentAsset) {
      meta.append(metadataRow('Parent', asset.parentAsset));
    }
    if (asset.referenceAssets?.length) {
      meta.append(metadataRow('References', asset.referenceAssets.join(', ')));
    }
    inspector.append(meta, renderLineage(detail.lineage ?? [], asset.assetId));
  } catch (error) {
    renderInspectorEmpty(error?.message || 'Could not load this asset.');
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

  const refresh = document.querySelector('#refresh-assets');
  if (refresh) {
    refresh.onclick = async () => {
      refresh.disabled = true;
      try {
        await loadAssets();
        if (selectedAssetId) await selectAsset(selectedAssetId);
      } finally {
        refresh.disabled = false;
      }
    };
  }

  renderGallery();
  renderInspectorEmpty();
}
