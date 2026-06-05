import { renderPartsPanel } from './panels/PartsPanel';
import { renderInspectorPanel } from './panels/InspectorPanel';
import { renderControllerTimeline } from './panels/ControllerTimelinePanel';
import { renderAssetsPanel } from './panels/AssetsPanel';
import { ProjectState } from '../state/projectState';
import { SelectionState } from '../state/selectionState';
import { getPlaybackTimeForAnimation } from '../state/playbackState';
import { DirtyState } from '../state/dirtyState';
import { HERO_RIGS, DOOMED_RIGS } from './samples';
import { SaveManager } from '../persistence/saveManager';
import { exportJSON, exportGodot, exportCanvasRuntime } from '../exporters/exportActions';
import { preloadAssets } from './canvas/imageCache';
import { newProject, loadProject, saveProject, importProject } from '../persistence/projectActions';

let _onUpdate: (skipInspector?: boolean, skipTimeline?: boolean) => void = () => {};

export function setupUI(onUpdate: (skipInspector?: boolean, skipTimeline?: boolean) => void) {
  _onUpdate = onUpdate;
  
  // 1. Setup Global Header Bindings
  document.getElementById('btn-proj-new')!.onclick = () => {
    newProject(_onUpdate);
  };
  document.getElementById('btn-proj-save')!.onclick = () => {
    saveProject();
  };
  
  document.getElementById('btn-export-json')!.onclick = exportJSON;
  document.getElementById('btn-export-gd')!.onclick = exportGodot;
  document.getElementById('btn-export-canvas')!.onclick = exportCanvasRuntime;

  // Sync Project Name inline edit in header
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
    nameEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        nameEl.blur();
      }
    };
  }

  const dlgLoad = document.getElementById('dlg-load') as HTMLDialogElement;
  const loadList = document.getElementById('load-list')!;
  
  document.getElementById('btn-load-json')!.onclick = () => {
    const projects = SaveManager.getIndex();
    if (projects.length === 0) {
      loadList.innerHTML = '<div class="panel-empty">No saved projects found.</div>';
    } else {
      loadList.innerHTML = projects.map((p: any) => `
        <div class="item-list" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-surface); border:1px solid var(--border); border-radius:4px;">
          <div>
            <div style="font-weight:600; color:var(--text-main);">${p.name}</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">${new Date(p.updatedAt).toLocaleString()}</div>
          </div>
          <div style="display:flex; gap:5px;">
            <button class="btn-load-item" data-id="${p.id}">Load</button>
            <button class="btn-del-item danger" data-id="${p.id}" style="color:var(--danger); border:1px solid transparent; background:none; font-size:1.1rem; cursor:pointer;">×</button>
          </div>
        </div>
      `).join('');
      
      loadList.querySelectorAll('.btn-load-item').forEach(btn => {
        (btn as HTMLElement).onclick = () => {
          const id = (btn as HTMLElement).getAttribute('data-id')!;
          loadProject(id, _onUpdate);
          dlgLoad.close();
        };
      });

      loadList.querySelectorAll('.btn-del-item').forEach(btn => {
        (btn as HTMLElement).onclick = () => {
          const id = (btn as HTMLElement).getAttribute('data-id')!;
          if (confirm('Delete this project?')) {
            SaveManager.deleteProject(id);
            document.getElementById('btn-load-json')!.click(); // Refresh list
          }
        };
      });
    }

    // Append Import button to load dialog
    const importContainer = document.createElement('div');
    importContainer.style.borderTop = '1px solid var(--border)';
    importContainer.style.marginTop = '15px';
    importContainer.style.paddingTop = '15px';

    const importBtn = document.createElement('button');
    importBtn.textContent = 'Import JSON Project File';
    importBtn.style.width = '100%';
    importBtn.style.padding = '8px';
    importBtn.onclick = async () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          try {
            await importProject(file, _onUpdate);
            dlgLoad.close();
          } catch (err) {
            console.error(err);
          }
        }
      };
      input.click();
    };
    importContainer.appendChild(importBtn);
    loadList.appendChild(importContainer);

    dlgLoad.showModal();
  };

  document.getElementById('btn-close-load')!.onclick = () => dlgLoad.close();

  // 2. Samples Selectors
  const heroSelect = document.getElementById('hero-select') as HTMLSelectElement;
  if (heroSelect) {
    heroSelect.onchange = () => {
      const id = heroSelect.value;
      if (id && HERO_RIGS[id as keyof typeof HERO_RIGS]) {
        ProjectState.setProject(HERO_RIGS[id as keyof typeof HERO_RIGS]);
        preloadAssets(ProjectState.project);
        _onUpdate();
      }
      heroSelect.value = '';
    };
  }

  const sampleSelect = document.getElementById('sample-select') as HTMLSelectElement;
  if (sampleSelect) {
    sampleSelect.onchange = () => {
      const id = sampleSelect.value;
      if (id && DOOMED_RIGS[id as keyof typeof DOOMED_RIGS]) {
        ProjectState.setProject(DOOMED_RIGS[id as keyof typeof DOOMED_RIGS]);
        preloadAssets(ProjectState.project);
        _onUpdate();
      }
      sampleSelect.value = '';
    };
  }
}

export function renderUI(skipInspector = false, skipTimeline = false) {
  const project = ProjectState.project;
  if (project.animations.length > 0) {
    const exists = project.animations.some((a: any) => a.id === SelectionState.activeAnimId);
    if (!exists) {
      SelectionState.activeAnimId = project.animations[0].id;
    }
  }

  const partsContainer = document.getElementById('parts-list-container')!;
  const inspectorContainer = document.getElementById('inspector-container')!;
  const controllerContainer = document.getElementById('controller-list-container')!;

  renderPartsPanel(partsContainer, _onUpdate);
  if (!skipInspector) {
    renderInspectorPanel(inspectorContainer, _onUpdate);
  }
  if (!skipTimeline) {
    renderControllerTimeline(controllerContainer, _onUpdate);
  }
  
  // Render Assets
  const assetsContainer = document.getElementById('assets-list-container');
  if (assetsContainer) {
    renderAssetsPanel(assetsContainer, _onUpdate);
  }

  // Update UI stats
  const timeDisplay = document.getElementById('time-display');
  if (timeDisplay) {
    const anim = ProjectState.project.animations.find((a: any) => a.id === SelectionState.activeAnimId);
    const dur = anim?.duration || 1;
    timeDisplay.textContent = `${getPlaybackTimeForAnimation(anim).toFixed(2)}s / ${dur.toFixed(2)}s`;
  }

  // Sync Project Name inline edit in header on render
  const nameEl = document.getElementById('project-name');
  if (nameEl && nameEl.textContent !== ProjectState.project.name) {
    nameEl.textContent = ProjectState.project.name;
  }
}
