import { PlaybackState } from '../state/playbackState';
import { SelectionState } from '../state/selectionState';
import { ProjectState } from '../state/projectState';
import { DirtyState } from '../state/dirtyState';
import { SaveManager } from '../persistence/saveManager';

export function setupKeyboardShortcuts(renderCb: () => void) {
  window.addEventListener('keydown', (e) => {
    // Prevent shortcuts when typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Ctrl+S: Save
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      SaveManager.saveProject(ProjectState.project);
    } 
    // Space: Play/Pause
    else if (e.key === ' ') {
      e.preventDefault();
      PlaybackState.playing = !PlaybackState.playing;
    } 
    // R: Reset Time
    else if (e.key.toLowerCase() === 'r') {
      PlaybackState.time = 0;
    } 
    // Delete: Remove Part
    else if (e.key === 'Delete') {
      if (SelectionState.activePartId) {
        if (confirm('Delete selected part?')) {
          ProjectState.project.parts = ProjectState.project.parts.filter((p: any) => p.id !== SelectionState.activePartId);
          SelectionState.activePartId = null;
          DirtyState.markDirty();
          renderCb();
        }
      }
    } 
    // Ctrl+D: Duplicate Part
    else if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      if (SelectionState.activePartId) {
        const p = ProjectState.project.parts.find((x: any) => x.id === SelectionState.activePartId);
        if (p) {
          const np = { ...p, id: 'p-' + Date.now(), name: p.name + ' Copy' };
          ProjectState.project.parts.push(np);
          SelectionState.activePartId = np.id;
          DirtyState.markDirty();
          renderCb();
        }
      }
    }
  });
}
