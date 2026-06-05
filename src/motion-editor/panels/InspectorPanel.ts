import { ProjectState } from '../../state/projectState';
import { SelectionState } from '../../state/selectionState';
import { DirtyState } from '../../state/dirtyState';
import { AppState } from '../../state/appState';
import { trimToAlphaBounds } from '../utils/assetUtils';
import { computeAllWorldMatrices, preserveDescendantWorldTransforms } from '../rigTransformUtils';

function esc(s: string): string {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const SHAPE_TYPES = [
  'roundedRect','rect','circle','ellipse','diamond','triangle',
  'sword','dagger','staff','line','bone','hammer','shield','cape','polygon','arrow','star'
];

export function renderInspectorPanel(container: HTMLElement, onUpdate: (skipInspector?: boolean, skipTimeline?: boolean) => void) {
  const project = ProjectState.project;
  const part = project.parts.find((p: any) => p.id === SelectionState.activePartId);

  if (!part) {
    container.innerHTML = `<div class="panel-empty"><span class="panel-empty-icon">🎯</span>Select a part to inspect</div>`;
    return;
  }

  const locked = part.locked === true;

  container.innerHTML = `
    <div class="inspector-form">

      <!-- Name + Parent -->
      <div class="inspector-section">
        <div class="form-group" style="margin-bottom:7px;">
          <label>Name</label>
          <input type="text" id="pi-name" value="${esc(part.name)}" ${locked ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label>Parent</label>
          <select id="pi-parent" ${locked ? 'disabled' : ''}>
            <option value="">— none (root) —</option>
            ${project.parts
              .filter((p: any) => p.id !== part.id)
              .map((p: any) => `<option value="${p.id}" ${part.parentId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`)
              .join('')}
          </select>
        </div>
      </div>

      <!-- Transform -->
      <div class="inspector-section">
        <div class="inspector-section-title">Transform</div>
        <div class="form-row" style="margin-bottom:6px;">
          <div class="form-group">
            <label>X</label>
            <input type="number" id="pi-x" value="${(part.baseX ?? 0).toFixed(2)}" step="1" ${locked ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label>Y</label>
            <input type="number" id="pi-y" value="${(part.baseY ?? 0).toFixed(2)}" step="1" ${locked ? 'disabled' : ''}>
          </div>
        </div>
        <div class="form-row" style="margin-bottom:6px;">
          <div class="form-group">
            <label>Rotation °</label>
            <input type="number" id="pi-rot" value="${(part.baseRotation ?? 0).toFixed(2)}" step="1" ${locked ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label>Z-Index</label>
            <input type="number" id="pi-z" value="${part.zIndex ?? 0}" step="1" ${locked ? 'disabled' : ''}>
          </div>
        </div>
        <div class="form-row" style="margin-bottom:6px;">
          <div class="form-group">
            <label>Scale X</label>
            <input type="number" id="pi-sx" value="${(part.baseScaleX ?? 1).toFixed(3)}" step="0.05" ${locked ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label>Scale Y</label>
            <input type="number" id="pi-sy" value="${(part.baseScaleY ?? 1).toFixed(3)}" step="0.05" ${locked ? 'disabled' : ''}>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:6px;">
          <label>Opacity</label>
          <input type="range" id="pi-opacity" min="0" max="1" step="0.05" value="${part.opacity ?? 1}" ${locked ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label>Pivot (Origin)</label>
          <div class="pivot-row">
            <input type="number" id="pi-ox" value="${(part.origin?.x ?? 0).toFixed(1)}" step="1" style="flex:1;" ${locked ? 'disabled' : ''}>
            <input type="number" id="pi-oy" value="${(part.origin?.y ?? 0).toFixed(1)}" step="1" style="flex:1;" ${locked ? 'disabled' : ''}>
            <button id="pi-edit-pivot" class="${SelectionState.isEditingPivot ? 'primary' : ''}" ${locked ? 'disabled' : ''}>✛ Edit</button>
          </div>
        </div>
      </div>

      <!-- Layer -->
      <div class="inspector-section">
        <div class="inspector-section-title">Layer Order</div>
        <div class="layer-btns">
          <button id="pi-back-all" ${locked ? 'disabled' : ''}>⇤ Back</button>
          <button id="pi-back-1"   ${locked ? 'disabled' : ''}>← Step</button>
          <button id="pi-fwd-1"    ${locked ? 'disabled' : ''}>→ Step</button>
          <button id="pi-fwd-all"  ${locked ? 'disabled' : ''}>Front ⇥</button>
        </div>
      </div>

      <!-- Render -->
      <div class="inspector-section">
        <div class="inspector-section-title">Render</div>
        <div class="form-row" style="margin-bottom:6px;">
          <div class="form-group">
            <label>Mode</label>
            <select id="pi-mode" ${locked ? 'disabled' : ''}>
              <option value="shape" ${part.renderMode !== 'image' ? 'selected' : ''}>Shape</option>
              <option value="image" ${part.renderMode === 'image' ? 'selected' : ''}>Image Asset</option>
            </select>
          </div>
          ${part.renderMode !== 'image' ? `
          <div class="form-group">
            <label>Shape Type</label>
            <select id="pi-shape-type" ${locked ? 'disabled' : ''}>
              ${SHAPE_TYPES.map(t => `<option value="${t}" ${(part.shapeType || 'roundedRect') === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>` : ''}
        </div>

        ${part.renderMode !== 'image' ? `
        <div class="form-group">
          <label>Fill Color</label>
          <input type="color" id="pi-color" value="${part.color || '#4c8ef5'}" ${locked ? 'disabled' : ''}>
        </div>` : `
        <div class="form-group">
          <label>Asset</label>
          <select id="pi-asset" ${locked ? 'disabled' : ''}>
            <option value="">— none —</option>
            ${(project.assets || []).map((a: any) => `<option value="${a.id}" ${part.imageAssetId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
          </select>
        </div>`}
      </div>

      <!-- Flags -->
      <div class="inspector-section">
        <div class="inspector-section-title">Flags</div>
        <div class="insp-flag-row">
          <label class="insp-flag"><input type="checkbox" id="pi-visible"   ${part.visible !== false ? 'checked' : ''}> Visible</label>
          <label class="insp-flag"><input type="checkbox" id="pi-locked"    ${part.locked ? 'checked' : ''}> Locked</label>
          <label class="insp-flag"><input type="checkbox" id="pi-inherit"   ${part.inheritTransform !== false ? 'checked' : ''}> Follow Parent</label>
          <label class="insp-flag"><input type="checkbox" id="pi-editkids"  ${(part as any).editChildrenTogether !== false ? 'checked' : ''}> Edit w/ Children</label>
          <label class="insp-flag"><input type="checkbox" id="pi-flipx"     ${part.flipX ? 'checked' : ''}> Flip X</label>
          <label class="insp-flag"><input type="checkbox" id="pi-flipy"     ${part.flipY ? 'checked' : ''}> Flip Y</label>
        </div>
        <div class="insp-flag-row" style="margin-top:6px; padding-top:6px; border-top:1px solid var(--border);">
          <label class="insp-flag"><input type="checkbox" id="pi-debug"    ${SelectionState.showDebugBounds ? 'checked' : ''}> Debug Bounds</label>
          <label class="insp-flag"><input type="checkbox" id="pi-skeleton" ${AppState.showSkeleton ? 'checked' : ''}> Skeleton</label>
          <label class="insp-flag"><input type="checkbox" id="pi-names"    ${AppState.showNames ? 'checked' : ''}> Names</label>
        </div>
      </div>

      <!-- Actions -->
      <div class="inspector-section">
        <div class="insp-action-row">
          <button id="pi-fit-asset" ${locked ? 'disabled' : ''}>Fit Asset</button>
          <button id="pi-trim-alpha" style="${part.renderMode === 'image' ? '' : 'display:none'}" ${locked ? 'disabled' : ''}>Trim Alpha</button>
          <button id="pi-delete" class="danger-btn">Delete Part</button>
        </div>
      </div>
    </div>
  `;

  // ── Bind ──────────────────────────────────────────────────────────────────
  const bind = (id: string, prop: string, isNum = true, obj?: any) => {
    const el = container.querySelector('#' + id) as HTMLInputElement;
    if (!el) return;

    const update = () => {
      const val = isNum ? parseFloat(el.value) : el.value;
      if (isNum && isNaN(val as number)) return;

      const oldMatrices = computeAllWorldMatrices(project.parts, 800, 600);
      if (obj) obj[prop] = val;
      else (part as any)[prop] = val;

      if ((part as any).editChildrenTogether === false && !obj &&
          ['baseX','baseY','baseRotation','baseScaleX','baseScaleY'].includes(prop)) {
        preserveDescendantWorldTransforms(part.id, project.parts, oldMatrices, 800, 600);
      }
      DirtyState.markDirty();
      onUpdate(true, false);
    };

    el.oninput = update;

    if (isNum && !locked) {
      el.addEventListener('wheel', (e) => {
        e.preventDefault();
        const step = +(el.step) || 1;
        const mult = e.shiftKey ? 10 : 1;
        el.value = (parseFloat(el.value) + (e.deltaY < 0 ? 1 : -1) * step * mult).toString();
        update();
      }, { passive: false });
    }
  };

  bind('pi-name', 'name', false);
  bind('pi-x', 'baseX');
  bind('pi-y', 'baseY');
  bind('pi-rot', 'baseRotation');
  bind('pi-z', 'zIndex');
  bind('pi-sx', 'baseScaleX');
  bind('pi-sy', 'baseScaleY');
  bind('pi-opacity', 'opacity');
  bind('pi-ox', 'x', true, part.origin);
  bind('pi-oy', 'y', true, part.origin);

  // Parent selector
  const parentSel = container.querySelector('#pi-parent') as HTMLSelectElement;
  if (parentSel) {
    parentSel.onchange = () => {
      part.parentId = parentSel.value || null;
      DirtyState.markDirty();
      onUpdate();
    };
  }

  // Pivot edit
  const pivotBtn = container.querySelector('#pi-edit-pivot') as HTMLElement;
  if (pivotBtn) {
    pivotBtn.onclick = () => {
      SelectionState.isEditingPivot = !SelectionState.isEditingPivot;
      onUpdate(true, false);
    };
  }

  // Layer buttons
  const getZs = () => project.parts.map((p: any) => Number(p.zIndex) || 0);
  const lbq = (id: string, fn: () => void) => {
    const b = container.querySelector('#' + id) as HTMLElement;
    if (b) b.onclick = () => { fn(); DirtyState.markDirty(); onUpdate(); };
  };
  lbq('pi-back-all', () => { const z = getZs(); part.zIndex = (z.length ? Math.min(...z) : 0) - 1; });
  lbq('pi-back-1',   () => { part.zIndex = (Number(part.zIndex) || 0) - 1; });
  lbq('pi-fwd-1',    () => { part.zIndex = (Number(part.zIndex) || 0) + 1; });
  lbq('pi-fwd-all',  () => { const z = getZs(); part.zIndex = (z.length ? Math.max(...z) : 0) + 1; });

  // Mode
  const modeSel = container.querySelector('#pi-mode') as HTMLSelectElement;
  if (modeSel) modeSel.onchange = () => { part.renderMode = modeSel.value as any; DirtyState.markDirty(); onUpdate(); };

  // Shape type
  const shapeSel = container.querySelector('#pi-shape-type') as HTMLSelectElement;
  if (shapeSel) shapeSel.onchange = () => { part.shapeType = shapeSel.value; DirtyState.markDirty(); onUpdate(true, false); };

  // Color
  const colorIn = container.querySelector('#pi-color') as HTMLInputElement;
  if (colorIn) colorIn.oninput = () => { part.color = colorIn.value; DirtyState.markDirty(); onUpdate(true, false); };

  // Asset
  const assetSel = container.querySelector('#pi-asset') as HTMLSelectElement;
  if (assetSel) assetSel.onchange = () => {
    if (assetSel.value) { part.imageAssetId = assetSel.value; part.renderMode = 'image'; }
    else { part.imageAssetId = undefined; part.renderMode = 'shape'; }
    DirtyState.markDirty();
    onUpdate();
  };

  // Checkbox flags
  const chk = (id: string, fn: (v: boolean) => void) => {
    const el = container.querySelector('#' + id) as HTMLInputElement;
    if (el) el.onchange = () => { fn(el.checked); DirtyState.markDirty(); onUpdate(); };
  };
  chk('pi-visible',  v => { part.visible = v; });
  chk('pi-locked',   v => { part.locked = v; });
  chk('pi-inherit',  v => { part.inheritTransform = v; });
  chk('pi-editkids', v => { (part as any).editChildrenTogether = v; });
  chk('pi-flipx',    v => { part.flipX = v; });
  chk('pi-flipy',    v => { part.flipY = v; });
  chk('pi-debug',    v => { SelectionState.showDebugBounds = v; onUpdate(true, false); });
  chk('pi-skeleton', v => { AppState.showSkeleton = v; });
  chk('pi-names',    v => { AppState.showNames = v; });

  // Delete
  const delBtn = container.querySelector('#pi-delete') as HTMLElement;
  if (delBtn) delBtn.onclick = () => {
    if (confirm(`Delete "${part.name}"? Children will be reparented.`)) {
      project.parts.forEach(p => { if (p.parentId === part.id) p.parentId = part.parentId; });
      project.parts = project.parts.filter(p => p.id !== part.id);
      project.animations.forEach(a => { a.controllers = a.controllers.filter((c: any) => c.targetPartId !== part.id); });
      SelectionState.activePartId = null;
      DirtyState.markDirty();
      onUpdate();
    }
  };

  // Fit asset
  const fitBtn = container.querySelector('#pi-fit-asset') as HTMLElement;
  if (fitBtn) fitBtn.onclick = () => {
    const asset = project.assets?.find((a: any) => a.id === part.imageAssetId);
    if (asset) {
      part.origin = { x: asset.width / 2, y: asset.height / 2 };
      part.baseScaleX = 1; part.baseScaleY = 1;
      DirtyState.markDirty(); onUpdate();
    } else {
      alert('No image asset attached. Assign an asset first.');
    }
  };

  // Trim alpha
  const trimBtn = container.querySelector('#pi-trim-alpha') as HTMLElement;
  if (trimBtn) trimBtn.onclick = async () => {
    const asset = project.assets?.find((a: any) => a.id === part.imageAssetId);
    if (!asset) return;
    const img = new Image(); img.src = asset.dataUrl;
    await new Promise(r => img.onload = r);
    const result = await trimToAlphaBounds(img);
    asset.dataUrl = result.dataUrl;
    asset.width   = result.bounds.width;
    asset.height  = result.bounds.height;
    if (part.origin) {
      part.origin.x -= result.bounds.x;
      part.origin.y -= result.bounds.y;
    }
    DirtyState.markDirty(); onUpdate();
  };
}
