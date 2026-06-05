import { createDefaultProject } from '../../../../packages/nstep-motion-core/src/schema/defaults';
import { normalizeProject } from '../../../../packages/nstep-motion-core/src/schema/validators';
import { SaveManager } from './saveManager';
import { ProjectState } from '../state/projectState';
import { DirtyState } from '../state/dirtyState';
import { preloadAssets } from '../motion-editor/canvas/imageCache';
import { SelectionState } from '../state/selectionState';

export function newProject(onUpdate: () => void): void {
  if (DirtyState.isDirty) {
    if (!confirm('You have unsaved changes. Discard and create a new project?')) {
      return;
    }
  }
  const defaultProj = createDefaultProject();
  ProjectState.setProject(defaultProj);
  DirtyState.markClean();
  
  // Clear selections
  SelectionState.activePartId = null;
  if (defaultProj.animations.length > 0) {
    SelectionState.activeAnimId = defaultProj.animations[0].id;
  } else {
    SelectionState.activeAnimId = null;
  }
  
  onUpdate();
}

export function loadProject(id: string, onUpdate: () => void): void {
  const p = SaveManager.getProject(id);
  if (!p) {
    alert('Failed to load project: not found.');
    return;
  }
  
  ProjectState.setProject(p);
  preloadAssets(p);
  DirtyState.markClean();
  
  // Restore selections
  if (p.lastSelectedPartId) {
    SelectionState.activePartId = p.lastSelectedPartId;
  } else {
    SelectionState.activePartId = null;
  }
  if (p.lastSelectedAnimId) {
    SelectionState.activeAnimId = p.lastSelectedAnimId;
  } else if (p.animations.length > 0) {
    SelectionState.activeAnimId = p.animations[0].id;
  } else {
    SelectionState.activeAnimId = null;
  }
  
  onUpdate();
}

export function saveProject(): void {
  SaveManager.saveProject(ProjectState.project);
  
  // Provide user feedback with a flash
  const status = document.getElementById('autosave-status');
  if (status) {
    status.textContent = 'Saved ✓';
    status.classList.remove('save-flash');
    void status.offsetWidth; // Trigger reflow to restart animation
    status.classList.add('save-flash');
    
    // Reset to "All changes saved" after the flash animation (approx 2s)
    setTimeout(() => {
      if (!DirtyState.isDirty && status.textContent === 'Saved ✓') {
        status.textContent = 'All changes saved';
        status.classList.remove('save-flash');
      }
    }, 2000);
  }
}

export async function importProject(file: File, onUpdate: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        const normalized = normalizeProject(parsed);
        
        // Ensure new ID or keep old one? Let's check: normally import project gets a new ID so it doesn't overwrite existing unless intended,
        // but let's keep the project ID so it updates if they modified it, or generate one if missing.
        if (!normalized.id) {
          normalized.id = 'proj-' + Date.now();
        }
        
        ProjectState.setProject(normalized);
        preloadAssets(normalized);
        DirtyState.markDirty(); // Mark dirty so it gets saved to local projects list
        
        // Restore selections
        if (normalized.lastSelectedPartId) {
          SelectionState.activePartId = normalized.lastSelectedPartId;
        } else {
          SelectionState.activePartId = null;
        }
        if (normalized.lastSelectedAnimId) {
          SelectionState.activeAnimId = normalized.lastSelectedAnimId;
        } else if (normalized.animations.length > 0) {
          SelectionState.activeAnimId = normalized.animations[0].id;
        } else {
          SelectionState.activeAnimId = null;
        }
        
        onUpdate();
        resolve();
      } catch (err) {
        alert('Failed to parse project file: ' + (err as Error).message);
        reject(err);
      }
    };
    reader.onerror = () => {
      alert('Error reading file.');
      reject(new Error('File read error'));
    };
    reader.readAsText(file);
  });
}
