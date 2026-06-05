import { ProjectState } from '../../state/projectState';
import { SelectionState } from '../../state/selectionState';
import { DirtyState } from '../../state/dirtyState';
import { createDefaultPart } from '../../../../../packages/nstep-motion-core/src/schema/defaults';

const RENDER_ICONS: Record<string, string> = {
  image: '🖼',
  shape: '⬡',
};

export function renderPartsPanel(container: HTMLElement, onUpdate: () => void) {
  const project = ProjectState.project;

  // Update count badge
  const badge = document.getElementById('parts-count-badge');
  if (badge) badge.textContent = `${project.parts.length} parts`;

  container.innerHTML = `
    <div class="tree-toolbar">
      <span class="tree-count">${project.parts.length} PARTS</span>
      <button id="btn-add-part" style="padding:3px 10px; font-size:0.7rem;">+ Add Part</button>
    </div>
    <div class="parts-tree" id="parts-tree-root" style="padding:4px 0;">
      ${renderPartTree(null, project.parts, SelectionState.activePartId)}
    </div>
  `;

  // Part selection
  container.querySelectorAll('.part-row').forEach(row => {
    (row as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      const id = (row as HTMLElement).getAttribute('data-id');
      SelectionState.activePartId = id;
      onUpdate();
    };
  });

  // Visibility toggle
  container.querySelectorAll('[data-action="vis"]').forEach(btn => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).getAttribute('data-id')!;
      const part = project.parts.find(p => p.id === id);
      if (part) { part.visible = part.visible === false ? true : false; DirtyState.markDirty(); onUpdate(); }
    };
  });

  // Lock toggle
  container.querySelectorAll('[data-action="lock"]').forEach(btn => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).getAttribute('data-id')!;
      const part = project.parts.find(p => p.id === id);
      if (part) { part.locked = !part.locked; DirtyState.markDirty(); onUpdate(); }
    };
  });

  // Delete
  container.querySelectorAll('[data-action="del"]').forEach(btn => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).getAttribute('data-id')!;
      const part = project.parts.find(p => p.id === id);
      if (part && confirm(`Delete "${part.name}"?`)) {
        deletePartSafe(id);
        onUpdate();
      }
    };
  });

  // Deselect on tree background click
  const tree = container.querySelector('#parts-tree-root') as HTMLElement;
  if (tree) {
    tree.onclick = (e) => {
      if (e.target === tree) { SelectionState.activePartId = null; onUpdate(); }
    };
  }

  // Add part
  const btnAdd = container.querySelector('#btn-add-part') as HTMLElement;
  btnAdd.onclick = () => {
    const id = 'p-' + Date.now();
    const newPart = createDefaultPart(id, 'Part');
    newPart.parentId = SelectionState.activePartId;
    project.parts.push(newPart);
    SelectionState.activePartId = id;
    DirtyState.markDirty();
    onUpdate();
  };
}

function deletePartSafe(partId: string) {
  const project = ProjectState.project;
  const partToDelete = project.parts.find(p => p.id === partId);
  if (!partToDelete) return;
  project.parts.forEach(p => { if (p.parentId === partId) p.parentId = partToDelete.parentId; });
  project.parts = project.parts.filter(p => p.id !== partId);
  if (SelectionState.activePartId === partId) SelectionState.activePartId = null;
  project.animations.forEach(anim => {
    anim.controllers = anim.controllers.filter((c: any) => c.targetPartId !== partId);
  });
  DirtyState.markDirty();
}

function renderPartTree(parentId: string | null, allParts: any[], activeId: string | null): string {
  const children = allParts.filter(p => p.parentId === parentId);
  if (children.length === 0) return '';
  return `
    <ul style="list-style:none; padding-left:${parentId ? '14px' : '0'}; margin:0;">
      ${children.map(p => {
        const isActive = p.id === activeId;
        const isHidden = p.visible === false;
        const icon = RENDER_ICONS[p.renderMode || 'shape'] || '⬡';
        return `
          <li class="part-node" style="opacity:${isHidden ? 0.4 : 1};">
            <div class="part-row ${isActive ? 'active' : ''}" data-id="${p.id}">
              <span class="part-row-icon">${icon}</span>
              <span class="part-row-name" title="${p.name}">${p.name}</span>
              <span class="part-row-z">z:${p.zIndex ?? 0}</span>
              <div class="part-row-actions">
                <button data-action="vis" data-id="${p.id}" title="Toggle visibility">${isHidden ? '🚫' : '👁'}</button>
                <button data-action="lock" data-id="${p.id}" title="Toggle lock">${p.locked ? '🔒' : '🔓'}</button>
                <button data-action="del" data-id="${p.id}" class="del-btn" title="Delete">✕</button>
              </div>
            </div>
            ${renderPartTree(p.id, allParts, activeId)}
          </li>
        `;
      }).join('')}
    </ul>
  `;
}
