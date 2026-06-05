import { AppState } from '../state/appState';

export function setupRouter(onNavigate: (page: string) => void) {
  const btnEditor = document.getElementById('btn-nav-editor');
  const btnCutter = document.getElementById('btn-nav-cutter');

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
}

export function navigate(page: string) {
  const editorPage = document.getElementById('editor-page');
  const cutterPage = document.getElementById('cutter-page');

  if (page === 'editor') {
    if (editorPage) editorPage.style.display = 'grid';
    if (cutterPage) cutterPage.style.display = 'none';
  } else if (page === 'cutter') {
    if (editorPage) editorPage.style.display = 'none';
    if (cutterPage) cutterPage.style.display = 'block';
  }
}
