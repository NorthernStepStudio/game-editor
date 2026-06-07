import { ProjectState } from '../state/projectState';
import { AppState } from '../state/appState';
import { DirtyState } from '../state/dirtyState';
import { MotionCanvasRenderer } from '../motion-editor/canvas/MotionCanvasRenderer';
import { renderPartsPanel } from '../motion-editor/panels/PartsPanel';
import { renderInspectorPanel } from '../motion-editor/panels/InspectorPanel';
import { SKELETON_PRESETS, installSkeleton, SkeletonPreset } from './skeletonPresets';

let rigRenderer: MotionCanvasRenderer | null = null;
let externalRefresh: () => void = () => {};

export function setupRiggingUI(onBack: () => void, onExternalChange: () => void) {
  externalRefresh = onExternalChange;
  const container = document.getElementById('rigging-page');
  if (!container) return;

  container.innerHTML = `
    <div class="rigging-layout">
      <header class="rigging-header">
        <div style="display:flex; gap:10px; align-items:center;">
          <button id="btn-rig-back">← Motion Editor</button>
          <span class="rigging-title">🦴 Rigging Workshop</span>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <span style="font-size:0.68rem; color:var(--text-muted);">Build the skeleton, then animate it in the editor.</span>
        </div>
      </header>

      <div class="rigging-main">
        <!-- Left: presets + hierarchy -->
        <aside class="panel rigging-left">
          <div class="panel-header">Skeleton Library</div>
          <div class="panel-content" id="rig-preset-list" style="padding:8px;"></div>
          <div class="right-panel-divider"></div>
          <div class="panel-header">
            Bone Hierarchy
            <span id="rig-parts-badge">0 bones</span>
          </div>
          <div class="panel-content" id="rig-parts-container" style="padding:6px; flex:1; overflow-y:auto;"></div>
        </aside>

        <!-- Center: canvas -->
        <main class="rigging-canvas-wrap">
          <canvas id="rig-canvas" width="800" height="600"></canvas>
          <div class="canvas-toolbar" id="rig-canvas-toolbar">
            <button id="rig-btn-names"  title="Show bone names">Names</button>
            <button id="rig-btn-fit"    title="Fit all bones in view">Fit</button>
            <button id="rig-btn-reset"  title="Reset view">Reset</button>
          </div>
          <div class="canvas-zoom-controls">
            <button id="rig-zoom-out" class="zoom-step-btn" title="Zoom out">−</button>
            <div class="canvas-zoom-badge" id="rig-zoom-badge">100%</div>
            <button id="rig-zoom-in"  class="zoom-step-btn" title="Zoom in">+</button>
          </div>
          <div class="rigging-hint">Drag bones to position them · click ⊕ in the hierarchy to add child bones</div>
        </main>

        <!-- Right: inspector -->
        <aside class="panel rigging-right">
          <div class="panel-header">Bone Properties</div>
          <div class="panel-content" id="rig-inspector-container" style="padding:8px;"></div>
        </aside>
      </div>
    </div>
  `;

  const canvas = document.getElementById('rig-canvas') as HTMLCanvasElement;
  rigRenderer = new MotionCanvasRenderer(canvas);
  rigRenderer.rebuildTree(ProjectState.project);
  rigRenderer.onUpdate = () => renderRiggingUI();
  // Idle until the rigging page is shown, so we never double-drive global state.
  rigRenderer.setActive(false);

  (container.querySelector('#btn-rig-back') as HTMLElement).onclick = onBack;

  // Canvas toolbar
  bindToolbar(container);

  renderRiggingUI();
}

function bindToolbar(container: HTMLElement) {
  const namesBtn = container.querySelector('#rig-btn-names') as HTMLElement;
  if (namesBtn) {
    namesBtn.classList.toggle('active', AppState.showNames);
    namesBtn.onclick = () => {
      AppState.showNames = !AppState.showNames;
      namesBtn.classList.toggle('active', AppState.showNames);
    };
  }
  const fitBtn = container.querySelector('#rig-btn-fit') as HTMLElement;
  if (fitBtn) fitBtn.onclick = () => { rigRenderer?.fit(); };
  const resetBtn = container.querySelector('#rig-btn-reset') as HTMLElement;
  if (resetBtn) resetBtn.onclick = () => { rigRenderer?.resetView(); };
  const zin = container.querySelector('#rig-zoom-in') as HTMLElement;
  if (zin) zin.onclick = () => { rigRenderer?.zoomIn(); updateZoomBadge(); };
  const zout = container.querySelector('#rig-zoom-out') as HTMLElement;
  if (zout) zout.onclick = () => { rigRenderer?.zoomOut(); updateZoomBadge(); };
}

function updateZoomBadge() {
  const badge = document.getElementById('rig-zoom-badge');
  if (badge && rigRenderer) badge.textContent = Math.round(rigRenderer.getZoom() * 100) + '%';
}

export function setRiggingActive(v: boolean) {
  rigRenderer?.setActive(v);
}

export function renderRiggingUI() {
  if (!rigRenderer) return;
  rigRenderer.rebuildTree(ProjectState.project);
  rigRenderer.resize();

  const onPanelUpdate = () => {
    rigRenderer!.rebuildTree(ProjectState.project);
    renderRiggingUI();
    externalRefresh();
  };

  const partsC = document.getElementById('rig-parts-container');
  if (partsC) renderPartsPanel(partsC, onPanelUpdate);

  const inspC = document.getElementById('rig-inspector-container');
  if (inspC) renderInspectorPanel(inspC, onPanelUpdate);

  const badge = document.getElementById('rig-parts-badge');
  if (badge) badge.textContent = `${ProjectState.project.parts.length} bones`;

  renderPresetList();
  updateZoomBadge();
}

function renderPresetList() {
  const host = document.getElementById('rig-preset-list');
  if (!host) return;
  host.innerHTML = SKELETON_PRESETS.map(p => `
    <div class="skeleton-card" data-id="${p.id}">
      <div class="skeleton-card-head">
        <span class="skeleton-card-icon">${p.icon}</span>
        <span class="skeleton-card-name">${p.name}</span>
        <span class="skeleton-card-count">${p.bones.length} bones</span>
      </div>
      <div class="skeleton-card-desc">${p.description}</div>
      <button class="skeleton-install-btn" data-id="${p.id}">Install</button>
    </div>
  `).join('');

  host.querySelectorAll('.skeleton-install-btn').forEach(btn => {
    (btn as HTMLElement).onclick = () => {
      const id = (btn as HTMLElement).getAttribute('data-id')!;
      const preset = SKELETON_PRESETS.find(p => p.id === id);
      if (preset) installPreset(preset);
    };
  });
}

function installPreset(preset: SkeletonPreset) {
  const hasParts = ProjectState.project.parts.length > 0;
  let replace = false;
  if (hasParts) {
    const choice = confirm(
      `Install "${preset.name}" skeleton?\n\n` +
      `OK = Replace the current rig (clears existing bones & animations)\n` +
      `Cancel = Add these bones alongside the existing rig`
    );
    replace = choice;
  }
  installSkeleton(preset, replace);
  DirtyState.markDirty();
  renderRiggingUI();
  externalRefresh();
}
