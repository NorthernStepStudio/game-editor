import './editor.css';
import { renderPartsPanel } from './panels/PartsPanel';
import { renderInspectorPanel } from './panels/InspectorPanel';
import { renderControllerTimeline } from './panels/ControllerTimelinePanel';
import { renderAssetsPanel } from './panels/AssetsPanel';
import { renderSkinsPanel } from './panels/SkinsPanel';
import { ProjectState } from '../state/projectState';
import { SelectionState } from '../state/selectionState';
import { getPlaybackTimeForAnimation } from '../state/playbackState';
import { DirtyState } from '../state/dirtyState';
import { ClipboardState } from '../state/clipboardState';
import { copyPoseToClipboard, pastePose, mirrorPose } from './poseActions';
import { HERO_RIGS, DOOMED_RIGS } from './samples';
import { SaveManager } from '../persistence/saveManager';
import { exportJSON, exportGodot, exportCanvasRuntime } from '../exporters/exportActions';
import { preloadAssets } from './canvas/imageCache';
import { newProject, loadProject, saveProject, importProject } from '../persistence/projectActions';
import { setupCanvasToolbar, refreshGizmoButtons } from './canvasToolbar';
import { setupLocomotionControls } from './locomotionControls';

let _onUpdate: (skipInspector?: boolean, skipTimeline?: boolean) => void = () => {};
let _renderer: any = null;

export function setRenderer(r: any) { _renderer = r; }

export function setupUI(onUpdate: (skipInspector?: boolean, skipTimeline?: boolean) => void) {
  _onUpdate = onUpdate;

  // Project actions
  document.getElementById('btn-proj-new')!.onclick   = () => newProject(_onUpdate);
  document.getElementById('btn-proj-save')!.onclick  = () => saveProject();
  document.getElementById('btn-export-json')!.onclick    = exportJSON;
  document.getElementById('btn-export-gd')!.onclick      = exportGodot;
  document.getElementById('btn-export-canvas')!.onclick  = exportCanvasRuntime;

  // Project name inline edit
  const nameEl = document.getElementById('project-name');
  if (nameEl) {
    nameEl.textContent = ProjectState.project.name;
    nameEl.onblur = () => {
      const val = nameEl.textContent?.trim() || 'New Project';
      if (ProjectState.project.name !== val) {
        ProjectState.project.name = val;
        DirtyState.markDirty();
        _onUpdate();
      }
    };
    nameEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); } };
  }

  // Load dialog
  const dlgLoad  = document.getElementById('dlg-load') as HTMLDialogElement;
  const loadList = document.getElementById('load-list')!;

  document.getElementById('btn-load-json')!.onclick = () => {
    const projects = SaveManager.getIndex();
    if (projects.length === 0) {
      loadList.innerHTML = '<div class="panel-empty">No saved projects found.</div>';
    } else {
      loadList.innerHTML = projects.map((p: any) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--r-md);">
          <div>
            <div style="font-weight:600; color:var(--text-bright); font-size:0.82rem;">${p.name}</div>
            <div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px;">${new Date(p.updatedAt).toLocaleString()}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn-load-item primary" data-id="${p.id}">Load</button>
            <button class="btn-del-item danger-btn" data-id="${p.id}">Delete</button>
          </div>
        </div>
      `).join('');

      loadList.querySelectorAll('.btn-load-item').forEach(btn => {
        (btn as HTMLElement).onclick = () => {
          loadProject((btn as HTMLElement).getAttribute('data-id')!, _onUpdate);
          dlgLoad.close();
        };
      });
      loadList.querySelectorAll('.btn-del-item').forEach(btn => {
        (btn as HTMLElement).onclick = () => {
          if (confirm('Delete this project?')) {
            SaveManager.deleteProject((btn as HTMLElement).getAttribute('data-id')!);
            document.getElementById('btn-load-json')!.click();
          }
        };
      });
    }

    // Import button
    const importSection = document.createElement('div');
    importSection.style.cssText = 'border-top:1px solid var(--border); margin-top:10px; padding-top:10px;';
    const importBtn = document.createElement('button');
    importBtn.textContent = '📁 Import JSON Project File';
    importBtn.style.width = '100%';
    importBtn.onclick = async () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          try { await importProject(file, _onUpdate); dlgLoad.close(); }
          catch (err) { console.error(err); alert('Failed to import project.'); }
        }
      };
      input.click();
    };
    importSection.appendChild(importBtn);
    loadList.appendChild(importSection);

    dlgLoad.showModal();
  };

  document.getElementById('btn-close-load')!.onclick = () => dlgLoad.close();

  // Samples
  const heroSelect = document.getElementById('hero-select') as HTMLSelectElement;
  heroSelect?.addEventListener('change', () => {
    const id = heroSelect.value;
    if (id && HERO_RIGS[id as keyof typeof HERO_RIGS]) {
      ProjectState.setProject(HERO_RIGS[id as keyof typeof HERO_RIGS]);
      preloadAssets(ProjectState.project);
      _onUpdate();
    }
    heroSelect.value = '';
  });

  const sampleSelect = document.getElementById('sample-select') as HTMLSelectElement;
  sampleSelect?.addEventListener('change', () => {
    const id = sampleSelect.value;
    if (id && DOOMED_RIGS[id as keyof typeof DOOMED_RIGS]) {
      ProjectState.setProject(DOOMED_RIGS[id as keyof typeof DOOMED_RIGS]);
      preloadAssets(ProjectState.project);
      _onUpdate();
    }
    sampleSelect.value = '';
  });

  // ── Canvas toolbar & locomotion (extracted modules) ──────────────────────
  setupCanvasToolbar(_renderer, _onUpdate);
  setupLocomotionControls(_renderer);

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === ' ') {
      e.preventDefault();
      document.getElementById('btn-tl-play')?.click();
    }
    if (e.key === ',') {
      e.preventDefault();
      document.getElementById('btn-tl-prev')?.click();
    }
    if (e.key === '.') {
      e.preventDefault();
      document.getElementById('btn-tl-next')?.click();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Let the dopesheet own Delete when it has selected keyframes
      if ((SelectionState as any).selectedKeyframeIds?.size > 0) return;
      // Only if canvas is focused (no text input active)
      if (document.activeElement === document.body && SelectionState.activePartId) {
        const part = ProjectState.project.parts.find(p => p.id === SelectionState.activePartId);
        if (part && !part.locked && confirm(`Delete "${part.name}"?`)) {
          ProjectState.project.parts.forEach(p => { if (p.parentId === part.id) p.parentId = part.parentId; });
          ProjectState.project.parts = ProjectState.project.parts.filter(p => p.id !== part.id);
          ProjectState.project.animations.forEach(a => {
            a.controllers = a.controllers.filter((c: any) => c.targetPartId !== part.id);
          });
          SelectionState.activePartId = null;
          DirtyState.markDirty();
          _onUpdate();
        }
      }
    }
    if (e.key === 'Escape') {
      SelectionState.isEditingPivot = false;
      _onUpdate(true, false);
    }
    if (!e.ctrlKey && !e.altKey) {
      if (e.key === 'w' || e.key === 'W') { SelectionState.gizmoMode = 'move';   refreshGizmoButtons(); }
      if (e.key === 'e' || e.key === 'E') { SelectionState.gizmoMode = 'rotate'; refreshGizmoButtons(); }
      if (e.key === 'r' || e.key === 'R') { SelectionState.gizmoMode = 'scale';  refreshGizmoButtons(); }
    }
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveProject(); }

    // ── Pose copy / paste shortcuts ──────────────────────────────────────────
    if (e.ctrlKey && e.key === 'c') {
      const animId = SelectionState.activeAnimId;
      if (!animId) return;
      const anim = ProjectState.project.animations.find((a: any) => a.id === animId);
      if (!anim) return;
      e.preventDefault();
      copyPoseToClipboard(animId, getPlaybackTimeForAnimation(anim));
      _onUpdate(false, true);
    }
    if (e.ctrlKey && e.key === 'v') {
      if (!ClipboardState.copiedPose) return;
      const animId = SelectionState.activeAnimId;
      if (!animId) return;
      const anim = ProjectState.project.animations.find((a: any) => a.id === animId);
      if (!anim) return;
      e.preventDefault();
      const pose = e.shiftKey
        ? mirrorPose(ClipboardState.copiedPose, ProjectState.project.parts as any[])
        : ClipboardState.copiedPose;
      pastePose(animId, getPlaybackTimeForAnimation(anim), pose);
      _onUpdate();
    }
  });
}

export function renderUI(skipInspector = false, skipTimeline = false) {
  const project = ProjectState.project;

  // Keep active anim valid
  if (project.animations.length > 0) {
    const exists = project.animations.some((a: any) => a.id === SelectionState.activeAnimId);
    if (!exists) SelectionState.activeAnimId = project.animations[0].id;
  }

  // Rebuild renderer tree
  if (_renderer) _renderer.rebuildTree(project);

  const partsEl      = document.getElementById('parts-list-container')!;
  const inspectorEl  = document.getElementById('inspector-container')!;
  const controllerEl = document.getElementById('controller-list-container')!;
  const assetsEl     = document.getElementById('assets-list-container');

  renderPartsPanel(partsEl, _onUpdate);
  if (!skipInspector) renderInspectorPanel(inspectorEl, _onUpdate);
  if (!skipTimeline)  renderControllerTimeline(controllerEl, _onUpdate);
  if (assetsEl)       renderAssetsPanel(assetsEl, _onUpdate);
  const skinsEl = document.getElementById('skins-list-container');
  if (skinsEl)        renderSkinsPanel(skinsEl, _onUpdate);

  // Time display (canvas renderer also updates #tl-time-display via render loop)
  const anim = project.animations.find((a: any) => a.id === SelectionState.activeAnimId);
  const durEl = document.getElementById('tl-time-display');
  if (durEl && anim) {
    durEl.textContent = `${getPlaybackTimeForAnimation(anim).toFixed(2)}s / ${(anim.duration || 1).toFixed(2)}s`;
  }

  // Sync project name
  const nameEl = document.getElementById('project-name');
  if (nameEl && nameEl.textContent !== project.name) nameEl.textContent = project.name;
}
