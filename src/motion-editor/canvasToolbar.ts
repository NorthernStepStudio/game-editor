import { AppState } from '../state/appState';

export function setupCanvasToolbar(
  renderer: any,
  onUpdate: (skipInspector?: boolean, skipTimeline?: boolean) => void
) {
  const btnGrid  = document.getElementById('btn-toggle-grid');
  const btnBones = document.getElementById('btn-toggle-skeleton');
  const btnNames = document.getElementById('btn-toggle-names');
  const btnReset = document.getElementById('btn-reset-view');

  if (btnGrid) {
    btnGrid.classList.toggle('active', AppState.showGrid);
    btnGrid.onclick = () => {
      AppState.showGrid = !AppState.showGrid;
      btnGrid.classList.toggle('active', AppState.showGrid);
    };
  }

  if (btnBones) {
    btnBones.classList.toggle('active', AppState.showSkeleton);
    btnBones.onclick = () => {
      AppState.showSkeleton = !AppState.showSkeleton;
      btnBones.classList.toggle('active', AppState.showSkeleton);
      onUpdate(true, false);
    };
  }

  if (btnNames) {
    btnNames.classList.toggle('active', AppState.showNames);
    btnNames.onclick = () => {
      AppState.showNames = !AppState.showNames;
      btnNames.classList.toggle('active', AppState.showNames);
      onUpdate(true, false);
    };
  }

  if (btnReset) {
    btnReset.onclick = () => { if (renderer) renderer.resetView(); };
  }

  const btnZoomIn  = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  if (btnZoomIn)  btnZoomIn.onclick  = () => { if (renderer) renderer.zoomIn(); };
  if (btnZoomOut) btnZoomOut.onclick = () => { if (renderer) renderer.zoomOut(); };

  const btnOnion = document.getElementById('btn-toggle-onion');
  if (btnOnion) {
    btnOnion.classList.toggle('active', !!(AppState as any).showOnionSkin);
    btnOnion.onclick = () => {
      (AppState as any).showOnionSkin = !(AppState as any).showOnionSkin;
      btnOnion.classList.toggle('active', !!(AppState as any).showOnionSkin);
    };
  }

  const btnFit = document.getElementById('btn-fit-all');
  if (btnFit) {
    btnFit.onclick = () => { if (renderer) (renderer as any).fitAll(); };
  }
}
