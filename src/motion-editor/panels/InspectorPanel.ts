import { ProjectState } from '../../state/projectState';
import { SelectionState } from '../../state/selectionState';
import { DirtyState } from '../../state/dirtyState';
import { AppState } from '../../state/appState';
import { trimToAlphaBounds } from '../utils/assetUtils';
import { computeAllWorldMatrices, preserveDescendantWorldTransforms } from '../rigTransformUtils';

function sanitizeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

export function renderInspectorPanel(container: HTMLElement, onUpdate: (skipInspector?: boolean, skipTimeline?: boolean) => void) {
  const part = ProjectState.project.parts.find((p: any) => p.id === SelectionState.activePartId);
  
  if (!part) {
    container.innerHTML = '<div class="panel-empty">Select a part to inspect</div>';
    return;
  }

  const isLocked = part.locked === true;

  container.innerHTML = `
    <div class="inspector-form">
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="part-name" value="${sanitizeHtml(part.name)}">
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>X</label>
          <input type="number" id="part-x" value="${part.baseX ?? 0}" ${isLocked ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label>Y</label>
          <input type="number" id="part-y" value="${part.baseY ?? 0}" ${isLocked ? 'disabled' : ''}>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Rot</label>
          <input type="number" id="part-rot" value="${part.baseRotation ?? 0}" ${isLocked ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label>Z</label>
          <input type="number" id="part-z" value="${part.zIndex ?? 0}" ${isLocked ? 'disabled' : ''}>
        </div>
      </div>

      <div class="form-group">
        <label>Pivot (Origin)</label>
        <div class="pivot-controls">
          <input type="number" id="part-ox" value="${part.origin?.x ?? 0}" style="width:60px" ${isLocked ? 'disabled' : ''}>
          <input type="number" id="part-oy" value="${part.origin?.y ?? 0}" style="width:60px" ${isLocked ? 'disabled' : ''}>
          <button id="btn-edit-pivot" class="${SelectionState.isEditingPivot ? 'active' : ''}" ${isLocked ? 'disabled' : ''}>🖱 Edit</button>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Scale X</label>
          <input type="number" id="part-sx" value="${part.baseScaleX ?? 1}" step="0.1" ${isLocked ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label>Scale Y</label>
          <input type="number" id="part-sy" value="${part.baseScaleY ?? 1}" step="0.1" ${isLocked ? 'disabled' : ''}>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Opacity</label>
          <input type="range" id="part-opacity" min="0" max="1" step="0.1" value="${part.opacity ?? 1}" ${isLocked ? 'disabled' : ''}>
        </div>
      </div>

      <div class="form-group">
        <div class="checkbox-row" style="display: flex; gap: 8px; flex-wrap: wrap;">
          <label><input type="checkbox" id="part-flipx" ${part.flipX ? 'checked' : ''} ${isLocked ? 'disabled' : ''}> Flip X</label>
          <label><input type="checkbox" id="part-flipy" ${part.flipY ? 'checked' : ''} ${isLocked ? 'disabled' : ''}> Flip Y</label>
          <label title="Show pivot and bounds"><input type="checkbox" id="chk-debug-bounds" ${SelectionState.showDebugBounds ? 'checked' : ''} ${isLocked ? 'disabled' : ''}> Debug</label>
          <label title="Show skeleton connection lines"><input type="checkbox" id="chk-show-skeleton" ${AppState.showSkeleton ? 'checked' : ''} ${isLocked ? 'disabled' : ''}> Skeleton</label>
          <label title="Show part names"><input type="checkbox" id="chk-show-names" ${AppState.showNames ? 'checked' : ''} ${isLocked ? 'disabled' : ''}> Names</label>
        </div>
      </div>

      <div class="form-group" style="border-top: 1px solid var(--border); padding-top: 8px; margin-top: 8px;">
        <div class="checkbox-row" style="display: flex; gap: 8px; flex-wrap: wrap; flex-direction: column;">
          <label title="Toggle visibility on canvas"><input type="checkbox" id="chk-part-visible" ${part.visible !== false ? 'checked' : ''}> Visible</label>
          <label title="Locked parts cannot be edited"><input type="checkbox" id="chk-part-locked" ${part.locked ? 'checked' : ''}> Locked</label>
          <label title="Follow parent transform"><input type="checkbox" id="chk-part-inherit" ${part.inheritTransform !== false ? 'checked' : ''}> Follow parent transform</label>
          <label title="Move descendants with this part during editing"><input type="checkbox" id="chk-part-editchildren" ${part.editChildrenTogether !== false ? 'checked' : ''}> Edit with children</label>
        </div>
      </div>

      <div class="form-group" style="margin-top: 8px; border-top: 1px solid var(--border); padding-top: 8px;">
        <label>Layer Order (Z-Index: ${part.zIndex ?? 0})</label>
        <div style="display:flex; gap:4px;">
          <button id="btn-layer-send-back" style="flex:1; font-size:0.7rem; padding:4px;" ${isLocked ? 'disabled' : ''}>Send Back</button>
          <button id="btn-layer-back" style="flex:1; font-size:0.7rem; padding:4px;" ${isLocked ? 'disabled' : ''}>Back</button>
          <button id="btn-layer-forward" style="flex:1; font-size:0.7rem; padding:4px;" ${isLocked ? 'disabled' : ''}>Forward</button>
          <button id="btn-layer-bring-front" style="flex:1; font-size:0.7rem; padding:4px;" ${isLocked ? 'disabled' : ''}>Bring Front</button>
        </div>
      </div>

      <div class="inspector-actions" style="margin-top: 10px; display: flex; gap: 8px;">
        <button id="btn-fit-native" ${isLocked ? 'disabled' : ''} style="flex: 1;">Fit Asset</button>
        <button id="btn-trim-alpha" style="flex: 1; ${part.renderMode === 'image' ? '' : 'display:none'}" ${isLocked ? 'disabled' : ''}>Trim Padding</button>
        <button id="btn-delete-part" class="danger" style="flex: 1; background:#ff5555; color:white; border:none; border-radius:4px; cursor:pointer; padding:6px 12px; font-weight:600;">Delete</button>
      </div>

      <div class="form-group">
        <label>Render Mode</label>
        <select id="part-mode" ${isLocked ? 'disabled' : ''}>
          <option value="shape" ${part.renderMode === 'shape' ? 'selected' : ''}>Shape</option>
          <option value="image" ${part.renderMode === 'image' ? 'selected' : ''}>Image Asset</option>
        </select>
      </div>

      ${part.renderMode === 'shape' ? `
        <div class="form-group">
          <label>Color</label>
          <input type="color" id="part-color" value="${part.color || '#ffffff'}" ${isLocked ? 'disabled' : ''}>
        </div>
      ` : `
        <div class="form-group">
          <label>Asset</label>
          <select id="part-asset" ${isLocked ? 'disabled' : ''}>
            <option value="">— none —</option>
            ${(ProjectState.project.assets || []).map((a: any) => `
              <option value="${a.id}" ${part.imageAssetId === a.id ? 'selected' : ''}>${sanitizeHtml(a.name)}</option>
            `).join('')}
          </select>
        </div>
      `}
    </div>
  `;

  // Helper to retrieve z-index range
  const getZIndices = () => ProjectState.project.parts.map((p: any) => Number(p.zIndex) || 0);

  // Bindings
  const bindInput = (id: string, prop: string, isNum = true, isSubProp = false, subPropObj?: any) => {
    const el = container.querySelector('#' + id) as HTMLInputElement;
    if (!el) return;
    if (isLocked && id !== 'part-name') {
      el.disabled = true;
    }

    const updateVal = () => {
      let val: any;
      if (isNum) {
        val = parseFloat(el.value);
        if (isNaN(val)) return;
      } else {
        val = el.value;
      }

      // If we are editing coordinates/rotation on the selected part, and editChildrenTogether is false,
      // cache descendant world matrices before applying the changes
      const oldWorldMatrices = computeAllWorldMatrices(ProjectState.project.parts, 800, 600);

      if (isSubProp && subPropObj) {
        subPropObj[prop] = val;
      } else {
        (part as any)[prop] = val;
      }

      if (part.editChildrenTogether === false && !isSubProp && (prop === 'baseX' || prop === 'baseY' || prop === 'baseRotation' || prop === 'baseScaleX' || prop === 'baseScaleY')) {
        preserveDescendantWorldTransforms(part.id, ProjectState.project.parts, oldWorldMatrices, 800, 600);
      }

      DirtyState.markDirty();
      onUpdate(true, false); // Skip inspector re-rendering so focus is maintained
    };

    el.oninput = updateVal;

    // Wheel Scrubbing Support
    if (isNum && !isLocked) {
      el.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        const step = +(el.step) || 1;
        const multiplier = e.shiftKey ? 10 : 1;
        el.value = (parseFloat(el.value) + delta * step * multiplier).toString();
        updateVal();
      });
    }
  };

  bindInput('part-name', 'name', false);
  bindInput('part-x', 'baseX');
  bindInput('part-y', 'baseY');
  bindInput('part-rot', 'baseRotation');
  bindInput('part-z', 'zIndex');
  bindInput('part-sx', 'baseScaleX');
  bindInput('part-sy', 'baseScaleY');
  bindInput('part-opacity', 'opacity');
  
  bindInput('part-ox', 'x', true, true, part.origin);
  bindInput('part-oy', 'y', true, true, part.origin);

  (container.querySelector('#btn-edit-pivot') as HTMLElement).onclick = () => {
    SelectionState.isEditingPivot = !SelectionState.isEditingPivot;
    onUpdate(true, false);
  };

  container.querySelector('#part-flipx')?.addEventListener('change', (e) => {
    part.flipX = (e.target as HTMLInputElement).checked;
    DirtyState.markDirty();
    onUpdate(true, false);
  });
  container.querySelector('#part-flipy')?.addEventListener('change', (e) => {
    part.flipY = (e.target as HTMLInputElement).checked;
    DirtyState.markDirty();
    onUpdate(true, false);
  });

  container.querySelector('#chk-debug-bounds')?.addEventListener('change', (e) => {
    SelectionState.showDebugBounds = (e.target as HTMLInputElement).checked;
    onUpdate(true, false);
  });

  container.querySelector('#chk-show-skeleton')?.addEventListener('change', (e) => {
    AppState.showSkeleton = (e.target as HTMLInputElement).checked;
    onUpdate(true, false);
  });

  container.querySelector('#chk-show-names')?.addEventListener('change', (e) => {
    AppState.showNames = (e.target as HTMLInputElement).checked;
    onUpdate(true, false);
  });

  // Vis/Lock/Inherit/EditChildren checkboxes
  container.querySelector('#chk-part-visible')?.addEventListener('change', (e) => {
    part.visible = (e.target as HTMLInputElement).checked;
    DirtyState.markDirty();
    onUpdate(); // Re-render whole panel to update state elsewhere
  });

  container.querySelector('#chk-part-locked')?.addEventListener('change', (e) => {
    part.locked = (e.target as HTMLInputElement).checked;
    DirtyState.markDirty();
    onUpdate(); // Re-render to disable input fields
  });

  container.querySelector('#chk-part-inherit')?.addEventListener('change', (e) => {
    part.inheritTransform = (e.target as HTMLInputElement).checked;
    DirtyState.markDirty();
    onUpdate();
  });

  container.querySelector('#chk-part-editchildren')?.addEventListener('change', (e) => {
    part.editChildrenTogether = (e.target as HTMLInputElement).checked;
    DirtyState.markDirty();
    onUpdate();
  });

  // Layer Order click handlers
  const btnSendBack = container.querySelector('#btn-layer-send-back') as HTMLButtonElement;
  if (btnSendBack) {
    btnSendBack.onclick = () => {
      const zIndices = getZIndices();
      const minZ = zIndices.length > 0 ? Math.min(...zIndices) : 0;
      part.zIndex = minZ - 1;
      DirtyState.markDirty();
      onUpdate();
    };
  }

  const btnBack = container.querySelector('#btn-layer-back') as HTMLButtonElement;
  if (btnBack) {
    btnBack.onclick = () => {
      part.zIndex = (Number(part.zIndex) || 0) - 1;
      DirtyState.markDirty();
      onUpdate();
    };
  }

  const btnForward = container.querySelector('#btn-layer-forward') as HTMLButtonElement;
  if (btnForward) {
    btnForward.onclick = () => {
      part.zIndex = (Number(part.zIndex) || 0) + 1;
      DirtyState.markDirty();
      onUpdate();
    };
  }

  const btnBringFront = container.querySelector('#btn-layer-bring-front') as HTMLButtonElement;
  if (btnBringFront) {
    btnBringFront.onclick = () => {
      const zIndices = getZIndices();
      const maxZ = zIndices.length > 0 ? Math.max(...zIndices) : 0;
      part.zIndex = maxZ + 1;
      DirtyState.markDirty();
      onUpdate();
    };
  }

  const btnDeletePart = container.querySelector('#btn-delete-part') as HTMLButtonElement;
  if (btnDeletePart) {
    btnDeletePart.onclick = () => {
      if (confirm(`Are you sure you want to delete "${part.name}"? Active child parts will be reparented to its parent.`)) {
        const project = ProjectState.project;
        project.parts.forEach(p => {
          if (p.parentId === part.id) {
            p.parentId = part.parentId;
          }
        });
        project.parts = project.parts.filter(p => p.id !== part.id);
        SelectionState.activePartId = null;
        project.animations.forEach(anim => {
          anim.controllers = anim.controllers.filter((c: any) => c.targetPartId !== part.id);
        });
        DirtyState.markDirty();
        onUpdate();
      }
    };
  }

  (container.querySelector('#btn-fit-native') as HTMLElement).onclick = () => {
    const asset = ProjectState.project.assets?.find((a: any) => a.id === part.imageAssetId);
    if (asset) {
      part.origin.x = asset.width / 2;
      part.origin.y = asset.height / 2;
      part.baseScaleX = 1;
      part.baseScaleY = 1;
      DirtyState.markDirty();
      onUpdate();
    }
  };

  const btnTrim = container.querySelector('#btn-trim-alpha') as HTMLButtonElement;
  if (btnTrim) {
    btnTrim.onclick = async () => {
      const asset = ProjectState.project.assets?.find((a: any) => a.id === part.imageAssetId);
      if (!asset) return;
      
      const img = new Image();
      img.src = asset.dataUrl;
      await new Promise(r => img.onload = r);
      
      const result = await trimToAlphaBounds(img);
      
      // Update Asset
      asset.dataUrl = result.dataUrl;
      asset.width = result.bounds.width;
      asset.height = result.bounds.height;
      
      // Adjust Part
      part.origin.x -= result.bounds.x;
      part.origin.y -= result.bounds.y;
      
      DirtyState.markDirty();
      onUpdate();
    };
  }

  (container.querySelector('#part-mode') as HTMLSelectElement).onchange = (e) => {
    part.renderMode = (e.target as HTMLSelectElement).value as any;
    DirtyState.markDirty();
    onUpdate(); // Re-render the whole inspector to change shape/image options
  };

  const colorIn = container.querySelector('#part-color') as HTMLInputElement;
  if (colorIn) {
    colorIn.oninput = () => {
      part.color = colorIn.value;
      DirtyState.markDirty();
      onUpdate(true, false);
    };
  }

  const assetIn = container.querySelector('#part-asset') as HTMLSelectElement;
  if (assetIn) {
    assetIn.onchange = () => {
      const val = assetIn.value;
      if (val === '') {
        part.imageAssetId = undefined;
        part.renderMode = 'shape';
      } else {
        part.imageAssetId = val;
        part.renderMode = 'image';
      }
      DirtyState.markDirty();
      onUpdate(); // Re-render inspector to update image options
    };
  }
}
