import { renderValidationPanel } from '../panels/ValidationPanel';

const PANEL_ID = 'validation-container';
let lastSignature = '';

function getProjectSignature(): string {
  const projectName = document.getElementById('project-name')?.textContent || '';
  const partCount = document.getElementById('parts-count-badge')?.textContent || '';
  const assetCount = document.getElementById('asset-count-badge')?.textContent || '';
  const skinCount = document.getElementById('skin-count-badge')?.textContent || '';
  const timelineTime = document.getElementById('tl-time-display')?.textContent || '';
  return `${projectName}|${partCount}|${assetCount}|${skinCount}|${timelineTime}`;
}

function ensurePanel(): HTMLElement | null {
  const rightPanel = document.querySelector('.right-panel-inner');
  if (!rightPanel) return null;

  let container = document.getElementById(PANEL_ID);
  if (container) return container;

  const divider = document.createElement('div');
  divider.className = 'right-panel-divider validation-divider';

  const header = document.createElement('div');
  header.className = 'panel-header validation-header';
  header.innerHTML = '<span>Project Health</span><span id="validation-health-badge">Validation</span>';

  container = document.createElement('div');
  container.id = PANEL_ID;
  container.className = 'validation-container';

  rightPanel.appendChild(divider);
  rightPanel.appendChild(header);
  rightPanel.appendChild(container);
  return container;
}

function refreshValidationPanel(force = false) {
  const container = ensurePanel();
  if (!container) return;

  const signature = getProjectSignature();
  if (!force && signature === lastSignature) return;

  renderValidationPanel(container);
  lastSignature = signature;
}

export function registerValidationPanel() {
  const boot = () => refreshValidationPanel(true);
  window.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('focus', () => refreshValidationPanel(true));
  window.setInterval(() => refreshValidationPanel(), 1200);
}

registerValidationPanel();
