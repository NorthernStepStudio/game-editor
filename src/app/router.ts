import { AppState } from '../state/appState';

export function setupRouter(onNavigate: (page: string) => void) {
  const btnEditor = document.getElementById('btn-nav-editor');
  const btnCutter = document.getElementById('btn-nav-cutter');
  const btnRigging = document.getElementById('btn-nav-rigging');

  if (btnEditor) {
    btnEditor.onclick = () => {
      AppState.currentPage = 'editor';
      onNavigate('editor');
    };
  }

  if (btnCutter) {
    btnCutter.onclick = () => {
      AppState.currentPage = 'cutter';
      onNavigate('cutter');
    };
  }

  if (btnRigging) {
    btnRigging.onclick = () => {
      AppState.currentPage = 'rigging';
      onNavigate('rigging');
    };
  }
}

export function navigate(page: string) {
  const editorPage = document.getElementById('editor-page');
  const cutterPage = document.getElementById('cutter-page');
  const riggingPage = document.getElementById('rigging-page');

  const show = (el: HTMLElement | null, mode: string) => { if (el) el.style.display = mode; };

  show(editorPage, page === 'editor' ? 'grid' : 'none');
  show(cutterPage, page === 'cutter' ? 'block' : 'none');
  show(riggingPage, page === 'rigging' ? 'block' : 'none');

  // Keep nav highlight in sync with the active page.
  document.querySelectorAll('.main-nav .nav-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById(`btn-nav-${page}`);
  if (activeBtn) activeBtn.classList.add('active');
}
