import { validateProject, ValidationIssue } from '@nstep-core/schema/validationReport';
import { ProjectState } from '../../state/projectState';

function esc(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function issueIcon(issue: ValidationIssue): string {
  if (issue.severity === 'error') return '✖';
  if (issue.severity === 'warning') return '⚠';
  return 'ℹ';
}

function issueClass(issue: ValidationIssue): string {
  return `validation-issue validation-${issue.severity}`;
}

export function renderValidationPanel(container: HTMLElement) {
  const report = validateProject(ProjectState.project);
  const statusClass = report.ok ? 'validation-ok' : 'validation-bad';
  const statusText = report.ok
    ? `Ready: ${report.warningCount} warning${report.warningCount === 1 ? '' : 's'}`
    : `Blocked: ${report.errorCount} error${report.errorCount === 1 ? '' : 's'}`;

  container.innerHTML = `
    <div class="validation-panel ${statusClass}">
      <div class="validation-summary">
        <strong>${statusText}</strong>
        <span>${report.errorCount} errors · ${report.warningCount} warnings · ${report.infoCount} info</span>
      </div>
      ${report.issues.length === 0
        ? `<div class="validation-empty">No validation issues found.</div>`
        : `<div class="validation-list">
            ${report.issues.slice(0, 8).map(issue => `
              <div class="${issueClass(issue)}">
                <span class="validation-icon">${issueIcon(issue)}</span>
                <div>
                  <div class="validation-message">${esc(issue.message)}</div>
                  <div class="validation-meta">${esc(issue.area)}${issue.targetId ? ` · ${esc(issue.targetId)}` : ''}${issue.fixHint ? ` · ${esc(issue.fixHint)}` : ''}</div>
                </div>
              </div>
            `).join('')}
            ${report.issues.length > 8 ? `<div class="validation-more">+ ${report.issues.length - 8} more issues</div>` : ''}
          </div>`}
    </div>
  `;
}
