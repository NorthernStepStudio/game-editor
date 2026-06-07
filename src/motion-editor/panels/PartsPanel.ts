import { ProjectState } from '../../state/projectState';
import { SelectionState } from '../../state/selectionState';
import { DirtyState } from '../../state/dirtyState';
import { createDefaultPart } from '../../../../../packages/nstep-motion-core/src/schema/defaults';

const RENDER_ICONS: Record<string, string> = {
  image: '🖼',
  shape: '⬡',
};

let dragSourceId: string | null = null;

export function renderPartsPanel(container: HTMLElement, onUpdate: () => void) {
  const project = ProjectState.project;

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

  // Add child bone (extends a limb chain from the clicked part)
  container.querySelectorAll('[data-action="addchild"]').forEach(btn => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      const parentId = (btn as HTMLElement).getAttribute('data-id')!;
      addChildBone(parentId);
      onUpdate();
    };
  });

  // ── Drag-to-reparent ───────────────────────────────────────────────────
  container.querySelectorAll('.part-row[data-id]').forEach(row => {
    const el = row as HTMLElement;
    const id = el.getAttribute('data-id')!;

    el.draggable = true;

    el.addEventListener('dragstart', (e) => {
      dragSourceId = id;
      el.classList.add('drag-source');
      e.dataTransfer?.setData('text/plain', id);
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('drag-source');
      container.querySelectorAll('.drag-over').forEach(n => n.classList.remove('drag-over'));
      dragSourceId = null;
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (dragSourceId && dragSourceId !== id) {
        // Prevent parenting a part to its own descendant
        if (!isDescendant(dragSourceId, id, project.parts)) {
          el.classList.add('drag-over');
        }
      }
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-over');
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      if (!dragSourceId || dragSourceId === id) return;
      if (isDescendant(dragSourceId, id, project.parts)) return;
      const srcPart = project.parts.find(p => p.id === dragSourceId);
      if (srcPart) {
        srcPart.parentId = id;
        DirtyState.markDirty();
        onUpdate();
      }
    });
  });

  // Drop onto root (to make a part a root node)
  const treeRoot = container.querySelector('#parts-tree-root') as HTMLElement;
  if (treeRoot) {
    treeRoot.addEventListener('dragover', (e) => {
      if ((e.target as HTMLElement).closest('.part-row')) return;
      e.preventDefault();
      treeRoot.classList.add('drag-over-root');
    });
    treeRoot.addEventListener('dragleave', () => {
      treeRoot.classList.remove('drag-over-root');
    });
    treeRoot.addEventListener('drop', (e) => {
      if ((e.target as HTMLElement).closest('.part-row')) return;
      e.preventDefault();
      treeRoot.classList.remove('drag-over-root');
      if (!dragSourceId) return;
      const srcPart = project.parts.find(p => p.id === dragSourceId);
      if (srcPart) {
        srcPart.parentId = null;
        DirtyState.markDirty();
        onUpdate();
      }
    });

    // Deselect on empty click
    treeRoot.onclick = (e) => {
      if (e.target === treeRoot) { SelectionState.activePartId = null; onUpdate(); }
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

function addChildBone(parentId: string) {
  const project = ProjectState.project;
  const parent = project.parts.find(p => p.id === parentId);
  if (!parent) return;
  const id = 'p-' + Date.now();
  const bone = createDefaultPart(id, `${parent.name} Bone`);
  bone.parentId = parentId;
  // Extend the new bone downward from the parent so it reads as a limb segment.
  bone.baseX = 0;
  bone.baseY = 30;
  bone.shapeType = 'bone';
  // Pivot at the top of the bone (the joint) so it rotates from where it connects.
  bone.origin = { x: 20, y: 5 };
  bone.zIndex = (Number(parent.zIndex) || 0) + 1;
  bone.color = parent.color;
  project.parts.push(bone);
  SelectionState.activePartId = id;
  DirtyState.markDirty();
}

function isDescendant(ancestorId: string, partId: string, parts: any[]): boolean {
  let current = parts.find(p => p.id === partId);
  while (current) {
    if (current.parentId === ancestorId) return true;
    current = parts.find(p => p.id === current.parentId);
  }
  return false;
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
        const hasIK = !!p.ikChain?.targetPartId;
        const hasCon = !!p.constraint?.type && p.constraint.type !== 'none';
        const hasFa = !!p.frameAnimation?.frameCount;
        const icon = RENDER_ICONS[p.renderMode || 'shape'] || '⬡';
        return `
          <li class="part-node" style="opacity:${isHidden ? 0.4 : 1};">
            <div class="part-row ${isActive ? 'active' : ''}" data-id="${p.id}" title="Drag to reparent">
              <span class="part-row-icon">${icon}</span>
              <span class="part-row-name" title="${p.name}">${p.name}</span>
              ${hasIK  ? '<span style="color:var(--accent-orange);font-size:0.6rem;" title="IK Chain">IK</span>'  : ''}
              ${hasCon ? '<span style="color:var(--accent-2);font-size:0.6rem;" title="Constraint">⛓</span>'      : ''}
              ${hasFa  ? '<span style="color:var(--accent-green);font-size:0.6rem;" title="Frame Anim">🎞</span>'  : ''}
              <span class="part-row-z">z:${p.zIndex ?? 0}</span>
              <div class="part-row-actions">
                <button data-action="addchild" data-id="${p.id}" title="Add child bone">⊕</button>
                <button data-action="vis"  data-id="${p.id}" title="Toggle visibility">${isHidden ? '🚫' : '👁'}</button>
                <button data-action="lock" data-id="${p.id}" title="Toggle lock">${p.locked ? '🔒' : '🔓'}</button>
                <button data-action="del"  data-id="${p.id}" class="del-btn" title="Delete">✕</button>
              </div>
            </div>
            ${renderPartTree(p.id, allParts, activeId)}
          </li>
        `;
      }).join('')}
    </ul>
  `;
}
