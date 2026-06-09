import { AppState } from '../state/appState';

type AppPage = 'overview' | 'editor' | 'cutter' | 'rigging';

export function setupRouter(onNavigate: (page: AppPage) => void) {
  const btnOverview = document.getElementById('btn-nav-overview');
  const btnEditor = document.getElementById('btn-nav-editor');
  const btnCutter = document.getElementById('btn-nav-cutter');
  const btnRigging = document.getElementById('btn-nav-rigging');
  const btnOverviewOpenEditor = document.getElementById('btn-overview-open-editor');
  const btnOverviewOpenRigging = document.getElementById('btn-overview-open-rigging');

  const goTo = (page: AppPage) => {
    AppState.currentPage = page;
    onNavigate(page);
  };

  if (btnOverview) btnOverview.onclick = () => goTo('overview');
  if (btnEditor) btnEditor.onclick = () => goTo('editor');
  if (btnCutter) btnCutter.onclick = () => goTo('cutter');
  if (btnRigging) btnRigging.onclick = () => goTo('rigging');
  if (btnOverviewOpenEditor) btnOverviewOpenEditor.onclick = () => goTo('editor');
  if (btnOverviewOpenRigging) btnOverviewOpenRigging.onclick = () => goTo('rigging');
}

export function navigate(page: AppPage) {
  const overviewPage = document.getElementById('overview-page');
  const editorPage = document.getElementById('editor-page');
  const cutterPage = document.getElementById('cutter-page');
  const riggingPage = document.getElementById('rigging-page');

  const show = (el: HTMLElement | null, mode: string) => { if (el) el.style.display = mode; };

  show(overviewPage, page === 'overview' ? 'block' : 'none');
  show(editorPage, page === 'editor' ? 'grid' : 'none');
  show(cutterPage, page === 'cutter' ? 'block' : 'none');
  show(riggingPage, page === 'rigging' ? 'block' : 'none');

  // Keep nav highlight in sync with the active page.
  document.querySelectorAll('.main-nav .nav-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById(`btn-nav-${page}`);
  if (activeBtn) activeBtn.classList.add('active');
}
