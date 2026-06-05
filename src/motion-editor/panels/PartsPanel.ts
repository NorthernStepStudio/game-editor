import { ProjectState } from '../../state/projectState';
import { SelectionState } from '../../state/selectionState';
import { DirtyState } from '../../state/dirtyState';
import { createDefaultPart } from '../../../../../packages/nstep-motion-core/src/schema/defaults';

export function renderPartsPanel(container: HTMLElement, onUpdate: () => void) {
  const project = ProjectState.project;
  
  container.innerHTML = `
    <div class="panel-toolbar" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border);">
      <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Tree (${project.parts.length})</span>
      <button id="btn-add-part" style="padding:2px 8px; font-size:0.75rem;">+ Add Part</button>
    </div>
    <div class="parts-tree">
      ${renderPartTree(null, project.parts, SelectionState.activePartId)}
    </div>
  `;

  // Bindings
  container.querySelectorAll('.part-item').forEach(item => {
    (item as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      SelectionState.activePartId = (item as HTMLElement).getAttribute('data-id');
      onUpdate();
    };
  });

  // Bind Tree Action Buttons
  container.querySelectorAll('.btn-tree-visible').forEach(btn => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id')!;
      const part = project.parts.find((p: any) => p.id === id);
      if (part) {
        part.visible = part.visible === false ? true : false;
        DirtyState.markDirty();
        onUpdate();
      }
    };
  });

  container.querySelectorAll('.btn-tree-lock').forEach(btn => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id')!;
      const part = project.parts.find((p: any) => p.id === id);
      if (part) {
        part.locked = !part.locked;
        DirtyState.markDirty();
        onUpdate();
      }
    };
  });

  container.querySelectorAll('.btn-tree-inherit').forEach(btn => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id')!;
      const part = project.parts.find((p: any) => p.id === id);
      if (part && part.parentId) {
        part.inheritTransform = part.inheritTransform === false ? true : false;
        DirtyState.markDirty();
        onUpdate();
      }
    };
  });

  container.querySelectorAll('.btn-tree-delete').forEach(btn => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id')!;
      const part = project.parts.find((p: any) => p.id === id);
      if (part) {
        if (confirm(`Delete "${part.name}"? Child parts will be reparented to its parent.`)) {
          deletePartSafe(id);
          onUpdate();
        }
      }
    };
  });

  const treeWrapper = container.querySelector('.parts-tree') as HTMLElement;
  if (treeWrapper) {
    treeWrapper.onclick = (e) => {
      if (e.target === treeWrapper) {
        SelectionState.activePartId = null;
        onUpdate();
      }
    };
  }

  const btnAdd = container.querySelector('#btn-add-part') as HTMLElement;
  btnAdd.onclick = () => {
    const id = 'p-' + Date.now();
    const newPart = createDefaultPart(id, 'New Part');
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
  
  // Reparent immediate children to the deleted part's parent
  project.parts.forEach(p => {
    if (p.parentId === partId) {
      p.parentId = partToDelete.parentId;
    }
  });
  
  // Remove the part
  project.parts = project.parts.filter(p => p.id !== partId);
  
  // Clear selection if it was active
  if (SelectionState.activePartId === partId) {
    SelectionState.activePartId = null;
  }
  
  // Remove any animations controller targeting this part
  project.animations.forEach(anim => {
    anim.controllers = anim.controllers.filter((c: any) => c.targetPartId !== partId);
  });
  
  DirtyState.markDirty();
}

function renderPartTree(parentId: string | null, allParts: any[], activeId: string | null): string {
  const children = allParts.filter(p => p.parentId === parentId);
  if (children.length === 0) return '';

  return `
    <ul>
      ${children.map(p => `
        <li class="part-node" style="${p.visible === false ? 'opacity: 0.45;' : ''}">
          <div class="part-item ${p.id === activeId ? 'active' : ''}" data-id="${p.id}" style="display:flex; align-items:center; justify-content:space-between; width:100%; padding: 4px 8px; gap:8px;">
            <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
              <span class="part-icon" style="margin-right:2px;">${p.renderMode === 'image' ? '🖼' : '📦'}</span>
              <span class="part-name" style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${p.name}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
              <button class="btn-tree-visible" data-id="${p.id}" title="Toggle Visibility" style="background:none; border:none; padding:2px; font-size:0.75rem; cursor:pointer; color:inherit;">
                ${p.visible !== false ? '👁️' : '🕶️'}
              </button>
              <button class="btn-tree-lock" data-id="${p.id}" title="Toggle Lock" style="background:none; border:none; padding:2px; font-size:0.75rem; cursor:pointer; color:inherit;">
                ${p.locked ? '🔒' : '🔓'}
              </button>
              <button class="btn-tree-inherit" data-id="${p.id}" title="Toggle Follow Parent" style="background:none; border:none; padding:2px; font-size:0.75rem; cursor:pointer; color:inherit; opacity: ${p.parentId ? '1' : '0.25'}" ${p.parentId ? '' : 'disabled'}>
                ${p.inheritTransform !== false ? '🔗' : '📤'}
              </button>
              <button class="btn-tree-delete" data-id="${p.id}" title="Delete Part" style="background:none; border:none; padding:2px; font-size:0.75rem; cursor:pointer; color:#ff5555;">
                ❌
              </button>
              <span style="font-size:0.7rem; color:var(--text-muted); font-family:monospace; min-width:20px; text-align:right;">z:${p.zIndex ?? 0}</span>
            </div>
          </div>
          ${renderPartTree(p.id, allParts, activeId)}
        </li>
      `).join('')}
    </ul>
  `;
}
