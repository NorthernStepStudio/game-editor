import { ProjectState } from '../state/projectState';
import { SelectionState } from '../state/selectionState';
import { SaveManager } from '../persistence/saveManager';
import { setupAutosave, triggerAutosave } from '../persistence/autosave';
import { DirtyState } from '../state/dirtyState';
import { setupKeyboardShortcuts } from '../input/keyboardShortcuts';
import { MotionCanvasRenderer } from '../motion-editor/canvas/MotionCanvasRenderer';
import { preloadAssets } from '../motion-editor/canvas/imageCache';
import { setupUI, renderUI, setRenderer } from '../motion-editor/motionEditorUi';
import { setupRouter, navigate } from './router';

import { setupCutterUI } from '../sprite-cutter/spriteCutterUi';
import { setupRiggingUI, renderRiggingUI, setRiggingActive } from '../rigging/riggingUi';
import { AppState } from '../state/appState';
import { MAIN_LAYOUT } from './layout';

export function bootApp() {
  console.log('NStep Code Motion Editor: Booting...');

  // 0. Inject Layout
  const appRoot = document.getElementById('app');
  if (appRoot) {
    appRoot.innerHTML = MAIN_LAYOUT;
  } else {
    console.error('NStep Error: Could not find #app root element');
    return;
  }

  // 1. Setup Persistence & Load Project
  setupAutosave();
  DirtyState.onChange = () => triggerAutosave();
  
  const lastId = SaveManager.getLastProjectId();
  if (lastId) {
    const saved = SaveManager.getProject(lastId);
    if (saved) {
      ProjectState.setProject(saved);
      if (saved.lastSelectedPartId) {
        SelectionState.activePartId = saved.lastSelectedPartId;
      }
      if (saved.lastSelectedAnimId) {
        SelectionState.activeAnimId = saved.lastSelectedAnimId;
      }
    }
  }

  preloadAssets(ProjectState.project);

  // 2. Setup Renderer
  const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
  const renderer = new MotionCanvasRenderer(canvas);
  renderer.rebuildTree(ProjectState.project);

  // 3. Setup UI
  setRenderer(renderer);
  const refreshRenderer = (skipInspector = false, skipTimeline = false) => {
    renderer.rebuildTree(ProjectState.project);
    renderUI(skipInspector, skipTimeline);
  };
  renderer.onUpdate = () => refreshRenderer();

  // Keep exactly one renderer loop driving shared global state at a time.
  const applyPageActivation = (page: string) => {
    renderer.setActive(page === 'editor');
    setRiggingActive(page === 'rigging');
  };

  setupUI(refreshRenderer);
  setupCutterUI((page) => {
    AppState.currentPage = page as any;
    navigate(page);
    applyPageActivation(page);
    refreshRenderer();
  });
  setupRiggingUI(
    () => {
      AppState.currentPage = 'editor';
      navigate('editor');
      applyPageActivation('editor');
      refreshRenderer();
    },
    () => refreshRenderer(),
  );
  setupKeyboardShortcuts(refreshRenderer);

  // 4. Setup Router
  setupRouter((page) => {
    navigate(page);
    applyPageActivation(page);
    if (page === 'rigging') renderRiggingUI();
    else refreshRenderer();
  });

  // Initial Render
  refreshRenderer();

  console.log('NStep Code Motion Editor: Boot Complete.');
}
