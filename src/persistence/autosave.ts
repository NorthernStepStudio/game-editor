import { SaveManager } from './saveManager';
import { DirtyState } from '../state/dirtyState';
import { ProjectState } from '../state/projectState';

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function triggerAutosave() {
  if (!DirtyState.isDirty) return;
  
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    SaveManager.saveProject(ProjectState.project);
  }, 2000); // 2 second delay for autosave
}

export function setupAutosave() {
  // Check for unsaved changes before closing
  window.addEventListener('beforeunload', (e) => {
    if (DirtyState.isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // 30s interval fallback autosave
  setInterval(() => {
    if (DirtyState.isDirty) {
      console.log('Running 30s fallback autosave');
      SaveManager.saveProject(ProjectState.project);
    }
  }, 30000);
}
