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

const CONSTRAINT_TYPES = ['none','lookAt','copyRotation','limitRotation'];

export function renderInspectorPanel(container: HTMLElement, onUpdate: (skipInspector?: boolean, skipTimeline?: boolean) => void) {
  const project = ProjectState.project;
  const part = project.parts.find((p: any) => p.id === SelectionState.activePartId);

  if (!part) {
    container.innerHTML = `<div class="panel-empty"><span class="panel-empty-icon">🎯</span>Select a part to inspect</div>`;
    return;
  }

  const locked = part.locked === true;
  const ik = (part as any).ikChain || {};
  const con = (part as any).constraint || {};
  const fa = (part as any).frameAnimation || {};
  const otherParts = project.parts.filter((p: any) => p.id !== part.id);

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
            ${otherParts.map((p: any) => `<option value="${p.id}" ${part.parentId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Transform -->
      <div class="inspector-section">
        <div class="inspector-section-title">Transform</div>
        <div class="form-row" style="margin-bottom:6px;">
          <div class="form-group"><label>X</label>
            <input type="number" id="pi-x" value="${(part.baseX ?? 0).toFixed(2)}" step="1" ${locked ? 'disabled' : ''}></div>
          <div class="form-group"><label>Y</label>
            <input type="number" id="pi-y" value="${(part.baseY ?? 0).toFixed(2)}" step="1" ${locked ? 'disabled' : ''}></div>
        </div>
        <div class="form-row" style="margin-bottom:6px;">
          <div class="form-group"><label>Rotation °</label>
            <input type="number" id="pi-rot" value="${(part.baseRotation ?? 0).toFixed(2)}" step="1" ${locked ? 'disabled' : ''}></div>
          <div class="form-group"><label>Z-Index</label>
            <input type="number" id="pi-z" value="${part.zIndex ?? 0}" step="1" ${locked ? 'disabled' : ''}></div>
        </div>
        <div class="form-row" style="margin-bottom:6px;">
          <div class="form-group"><label>Scale X</label>
            <input type="number" id="pi-sx" value="${(part.baseScaleX ?? 1).toFixed(3)}" step="0.05" ${locked ? 'disabled' : ''}></div>
          <div class="form-group"><label>Scale Y</label>
            <input type="number" id="pi-sy" value="${(part.baseScaleY ?? 1).toFixed(3)}" step="0.05" ${locked ? 'disabled' : ''}></div>
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
          <div class="form-group"><label>Mode</label>
            <select id="pi-mode" ${locked ? 'disabled' : ''}>
              <option value="shape" ${part.renderMode !== 'image' ? 'selected' : ''}>Shape</option>
              <option value="image" ${part.renderMode === 'image' ? 'selected' : ''}>Image Asset</option>
            </select>
          </div>
          ${part.renderMode !== 'image' ? `
          <div class="form-group"><label>Shape Type</label>
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

      <!-- Frame Animation (image mode only) -->
      ${part.renderMode === 'image' ? `
      <div class="inspector-section">
        <div class="inspector-section-title" style="display:flex; justify-content:space-between; align-items:center;">
          Frame Animation
          <label style="display:flex; align-items:center; gap:4px; font-size:0.68rem; color:var(--text-muted); cursor:pointer; font-weight:400;">
            <input type="checkbox" id="pi-fa-enabled" ${fa.frameCount > 0 ? 'checked' : ''}> Enable
          </label>
        </div>
        ${fa.frameCount > 0 ? `
        <div class="form-row" style="margin-bottom:5px;">
          <div class="form-group"><label>Frame Count</label>
            <input type="number" id="pi-fa-count"  value="${fa.frameCount ?? 4}"  min="1" step="1" ${locked ? 'disabled' : ''}></div>
          <div class="form-group"><label>FPS</label>
            <input type="number" id="pi-fa-fps"    value="${fa.fps ?? 12}"        min="1" step="1" ${locked ? 'disabled' : ''}></div>
        </div>
        <div class="form-row" style="margin-bottom:5px;">
          <div class="form-group"><label>Start Frame</label>
            <input type="number" id="pi-fa-start"  value="${fa.startFrame ?? 0}" min="0" step="1" ${locked ? 'disabled' : ''}></div>
          <div class="form-group"><label>Columns</label>
            <input type="number" id="pi-fa-cols"   value="${fa.columns ?? 4}"    min="1" step="1" ${locked ? 'disabled' : ''}></div>
        </div>
        <div class="form-row" style="margin-bottom:5px;">
          <div class="form-group"><label>Frame W</label>
            <input type="number" id="pi-fa-fw"     value="${fa.frameWidth ?? 64}"  min="1" step="1" ${locked ? 'disabled' : ''}></div>
          <div class="form-group"><label>Frame H</label>
            <input type="number" id="pi-fa-fh"     value="${fa.frameHeight ?? 64}" min="1" step="1" ${locked ? 'disabled' : ''}></div>
        </div>
        <button id="pi-fa-autoslice" style="width:100%; font-size:0.7rem; padding:4px 0;" ${locked ? 'disabled' : ''}>⚡ Auto-Slice from Grid…</button>
        ` : `<div style="font-size:0.68rem; color:var(--text-muted); padding:4px 0;">Enable to animate through sprite sheet frames.</div>`}
      </div>` : ''}

      <!-- IK Chain -->
      <div class="inspector-section">
        <div class="inspector-section-title" style="display:flex; justify-content:space-between; align-items:center;">
          IK Chain
          <label style="display:flex; align-items:center; gap:4px; font-size:0.68rem; color:var(--text-muted); cursor:pointer; font-weight:400;">
            <input type="checkbox" id="pi-ik-enabled" ${ik.targetPartId ? 'checked' : ''}> Enable
          </label>
        </div>
        ${ik.targetPartId ? `
        <div class="form-group" style="margin-bottom:5px;">
          <label>IK Target Part</label>
          <select id="pi-ik-target" ${locked ? 'disabled' : ''}>
            <option value="">— select target —</option>
            ${otherParts.map((p: any) => `<option value="${p.id}" ${ik.targetPartId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row" style="margin-bottom:5px;">
          <div class="form-group"><label>Chain Length</label>
            <input type="number" id="pi-ik-chain" value="${ik.chainLength ?? 2}" min="1" max="4" step="1" ${locked ? 'disabled' : ''}></div>
          <div class="form-group"><label>Bend Dir</label>
            <select id="pi-ik-bend" ${locked ? 'disabled' : ''}>
              <option value="1"  ${(ik.bendDirection ?? 1) === 1  ? 'selected' : ''}>Left</option>
              <option value="-1" ${(ik.bendDirection ?? 1) === -1 ? 'selected' : ''}>Right</option>
            </select>
          </div>
        </div>` : `<div style="font-size:0.68rem; color:var(--text-muted); padding:4px 0;">Enable to make this part the root of an IK chain.</div>`}
      </div>

      <!-- Constraint -->
      <div class="inspector-section">
        <div class="inspector-section-title">Constraint</div>
        <div class="form-group" style="margin-bottom:5px;">
          <label>Type</label>
          <select id="pi-con-type" ${locked ? 'disabled' : ''}>
            ${CONSTRAINT_TYPES.map(t => `<option value="${t}" ${(con.type || 'none') === t ? 'selected' : ''}>${t === 'none' ? '— none —' : t}</option>`).join('')}
          </select>
        </div>
        ${con.type && con.type !== 'none' ? `
        <div class="form-group" style="margin-bottom:5px;">
          <label>Target Part</label>
          <select id="pi-con-target" ${locked ? 'disabled' : ''}>
            <option value="">— select —</option>
            ${otherParts.map((p: any) => `<option value="${p.id}" ${con.targetPartId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select>
        </div>
        ${con.type === 'limitRotation' ? `
        <div class="form-row">
          <div class="form-group"><label>Min °</label>
            <input type="number" id="pi-con-min" value="${(con as any).min ?? -45}" step="1" ${locked ? 'disabled' : ''}></div>
          <div class="form-group"><label>Max °</label>
            <input type="number" id="pi-con-max" value="${(con as any).max ?? 45}" step="1" ${locked ? 'disabled' : ''}></div>
        </div>` : `
        <div class="form-row">
          <div class="form-group"><label>Influence</label>
            <input type="range" id="pi-con-influence" min="0" max="1" step="0.05" value="${con.influence ?? 1}" ${locked ? 'disabled' : ''}></div>
          <div class="form-group"><label>Offset °</label>
            <input type="number" id="pi-con-offset" value="${con.offset ?? 0}" step="1" ${locked ? 'disabled' : ''}></div>
        </div>`}` : ''}
      </div>

      <!-- Flags -->
      <div class="inspector-section">
        <div class="inspector-section-title">Flags</div>
        <div class="insp-flag-row">
          <label class="insp-flag"><input type="checkbox" id="pi-visible"  ${part.visible !== false ? 'checked' : ''}> Visible</label>
          <label class="insp-flag"><input type="checkbox" id="pi-locked"   ${part.locked ? 'checked' : ''}> Locked</label>
          <label class="insp-flag"><input type="checkbox" id="pi-inherit"  ${part.inheritTransform !== false ? 'checked' : ''}> Follow Parent</label>
          <label class="insp-flag"><input type="checkbox" id="pi-editkids" ${(part as any).editChildrenTogether !== false ? 'checked' : ''}> Edit w/ Children</label>
          <label class="insp-flag"><input type="checkbox" id="pi-flipx"    ${part.flipX ? 'checked' : ''}> Flip X</label>
          <label class="insp-flag"><input type="checkbox" id="pi-flipy"    ${part.flipY ? 'checked' : ''}> Flip Y</label>
        </div>
        <div class="insp-flag-row" style="margin-top:6px; padding-top:6px; border-top:1px solid var(--border);">
          <label class="insp-flag"><input type="checkbox" id="pi-debug"    ${SelectionState.showDebugBounds ? 'checked' : ''}> Debug Bounds</label>
          <label class="insp-flag"><input type="checkbox" id="pi-skeleton" ${AppState.showSkeleton ? 'checked' : ''}> Skeleton</label>
          <label class="insp-flag"><input type="checkbox" id="pi-names"    ${AppState.showNames ? 'checked' : ''}> Names</label>
          <label class="insp-flag"><input type="checkbox" id="pi-onion"    ${(AppState as any).showOnionSkin ? 'checked' : ''}> Onion Skin</label>
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

  // ── Bindings ──────────────────────────────────────────────────────────────
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
        el.value = (parseFloat(el.value) + (e.deltaY < 0 ? 1 : -1) * step * (e.shiftKey ? 10 : 1)).toString();
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

  // Parent
  const parentSel = container.querySelector('#pi-parent') as HTMLSelectElement;
  if (parentSel) parentSel.onchange = () => { part.parentId = parentSel.value || null; DirtyState.markDirty(); onUpdate(); };

  // Pivot edit
  const pivotBtn = container.querySelector('#pi-edit-pivot') as HTMLElement;
  if (pivotBtn) pivotBtn.onclick = () => { SelectionState.isEditingPivot = !SelectionState.isEditingPivot; onUpdate(true, false); };

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

  // Frame Animation
  const faEnable = container.querySelector('#pi-fa-enabled') as HTMLInputElement;
  if (faEnable) faEnable.onchange = () => {
    if (faEnable.checked) {
      (part as any).frameAnimation = { frameCount: 4, fps: 12, startFrame: 0, columns: 4, frameWidth: 64, frameHeight: 64 };
    } else {
      (part as any).frameAnimation = undefined;
    }
    DirtyState.markDirty(); onUpdate();
  };

  const bindFa = (id: string, key: string) => {
    const el = container.querySelector('#' + id) as HTMLInputElement;
    if (!el) return;
    el.oninput = () => {
      if (!(part as any).frameAnimation) return;
      (part as any).frameAnimation[key] = parseFloat(el.value);
      DirtyState.markDirty(); onUpdate(true, false);
    };
  };
  bindFa('pi-fa-count', 'frameCount');
  bindFa('pi-fa-fps',   'fps');
  bindFa('pi-fa-start', 'startFrame');
  bindFa('pi-fa-cols',  'columns');
  bindFa('pi-fa-fw',    'frameWidth');
  bindFa('pi-fa-fh',    'frameHeight');

  // IK
  const ikEnable = container.querySelector('#pi-ik-enabled') as HTMLInputElement;
  if (ikEnable) ikEnable.onchange = () => {
    if (ikEnable.checked) {
      (part as any).ikChain = { targetPartId: '', chainLength: 2, bendDirection: 1 };
    } else {
      (part as any).ikChain = undefined;
    }
    DirtyState.markDirty(); onUpdate();
  };

  const ikTarget = container.querySelector('#pi-ik-target') as HTMLSelectElement;
  if (ikTarget) ikTarget.onchange = () => {
    if (!(part as any).ikChain) return;
    (part as any).ikChain.targetPartId = ikTarget.value;
    DirtyState.markDirty(); onUpdate(true, false);
  };

  const ikChainLen = container.querySelector('#pi-ik-chain') as HTMLInputElement;
  if (ikChainLen) ikChainLen.oninput = () => {
    if (!(part as any).ikChain) return;
    (part as any).ikChain.chainLength = parseInt(ikChainLen.value) || 2;
    DirtyState.markDirty(); onUpdate(true, false);
  };

  const ikBend = container.querySelector('#pi-ik-bend') as HTMLSelectElement;
  if (ikBend) ikBend.onchange = () => {
    if (!(part as any).ikChain) return;
    (part as any).ikChain.bendDirection = parseFloat(ikBend.value);
    DirtyState.markDirty(); onUpdate(true, false);
  };

  // Constraint
  const conType = container.querySelector('#pi-con-type') as HTMLSelectElement;
  if (conType) conType.onchange = () => {
    const v = conType.value;
    if (v === 'none') {
      (part as any).constraint = undefined;
    } else {
      (part as any).constraint = Object.assign({ type: v, targetPartId: '', influence: 1, offset: 0 }, (part as any).constraint, { type: v });
    }
    DirtyState.markDirty(); onUpdate();
  };

  const conTarget = container.querySelector('#pi-con-target') as HTMLSelectElement;
  if (conTarget) conTarget.onchange = () => {
    if (!(part as any).constraint) return;
    (part as any).constraint.targetPartId = conTarget.value;
    DirtyState.markDirty(); onUpdate(true, false);
  };

  const conInfl = container.querySelector('#pi-con-influence') as HTMLInputElement;
  if (conInfl) conInfl.oninput = () => {
    if (!(part as any).constraint) return;
    (part as any).constraint.influence = parseFloat(conInfl.value);
    DirtyState.markDirty(); onUpdate(true, false);
  };

  const conOffset = container.querySelector('#pi-con-offset') as HTMLInputElement;
  if (conOffset) conOffset.oninput = () => {
    if (!(part as any).constraint) return;
    (part as any).constraint.offset = parseFloat(conOffset.value);
    DirtyState.markDirty(); onUpdate(true, false);
  };

  const conMin = container.querySelector('#pi-con-min') as HTMLInputElement;
  if (conMin) conMin.oninput = () => {
    if (!(part as any).constraint) return;
    (part as any).constraint.min = parseFloat(conMin.value);
    DirtyState.markDirty(); onUpdate(true, false);
  };

  const conMax = container.querySelector('#pi-con-max') as HTMLInputElement;
  if (conMax) conMax.oninput = () => {
    if (!(part as any).constraint) return;
    (part as any).constraint.max = parseFloat(conMax.value);
    DirtyState.markDirty(); onUpdate(true, false);
  };

  // Auto-slicer
  const autoSliceBtn = container.querySelector('#pi-fa-autoslice') as HTMLElement;
  if (autoSliceBtn) autoSliceBtn.onclick = () => {
    const asset = project.assets?.find((a: any) => a.id === part.imageAssetId);
    if (!asset) { alert('Attach an image asset first.'); return; }
    const input = prompt('Enter grid dimensions as "columns × rows"\n(e.g. "4x2" for 4 columns and 2 rows):', '4x1');
    if (!input) return;
    const parts = input.split(/[xX×,\s]+/);
    const cols = Math.max(1, parseInt(parts[0]) || 1);
    const rows = Math.max(1, parseInt(parts[1] || '1') || 1);
    const fw = Math.floor(asset.width  / cols);
    const fh = Math.floor(asset.height / rows);
    (part as any).frameAnimation = {
      frameCount: cols * rows,
      fps: (part as any).frameAnimation?.fps ?? 12,
      startFrame: 0,
      columns: cols,
      frameWidth: fw,
      frameHeight: fh,
    };
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
  chk('pi-onion',    v => { (AppState as any).showOnionSkin = v; });

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
      alert('No image asset attached.');
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
    if (part.origin) { part.origin.x -= result.bounds.x; part.origin.y -= result.bounds.y; }
    DirtyState.markDirty(); onUpdate();
  };
}
