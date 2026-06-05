import { ProjectState } from '../../state/projectState';
import { SelectionState } from '../../state/selectionState';
import { PlaybackState, getPlaybackTimeForAnimation } from '../../state/playbackState';
import { DirtyState } from '../../state/dirtyState';
import { FORMULA_PRESETS } from '../../../../../packages/nstep-motion-core/src/formulas/presets';
import { createDefaultController } from '../../../../../packages/nstep-motion-core/src/schema/defaults';

let activeFilter: 'all' | 'selected' | 'moving' = 'all';

export function renderControllerTimeline(container: HTMLElement, onUpdate: (skipInspector?: boolean, skipTimeline?: boolean) => void) {
  const project = ProjectState.project;
  let anim = project.animations.find((a: any) => a.id === SelectionState.activeAnimId);
  if (!anim && project.animations.length > 0) {
    anim = project.animations[0];
    SelectionState.activeAnimId = anim.id;
  }

  if (!anim) {
    container.innerHTML = `<div class="panel-empty"><span class="panel-empty-icon">🎬</span>No animations. Create one to get started.</div>`;
    return;
  }

  const t = getPlaybackTimeForAnimation(anim);
  const dur = anim.duration || 1;
  const playing = PlaybackState.playing;

  let filtered = anim.controllers as any[];
  if (activeFilter === 'selected') {
    filtered = anim.controllers.filter((c: any) => c.targetPartId === SelectionState.activePartId);
  } else if (activeFilter === 'moving') {
    filtered = anim.controllers.filter((c: any) => c.enabled && (c.params.amplitude !== 0 || c.params.offset !== 0));
  }

  container.innerHTML = `
    <!-- Toolbar row 1: playback + animation selector -->
    <div class="timeline-toolbar">
      <!-- Animation tabs -->
      <div style="display:flex; gap:3px; flex-shrink:0;">
        ${project.animations.map((a: any) => `
          <button class="anim-tab ${a.id === SelectionState.activeAnimId ? 'active' : ''}" data-anim-id="${a.id}">${a.name}</button>
        `).join('')}
        <button id="btn-add-anim" class="icon-btn" title="Add animation">+</button>
      </div>

      <div style="width:1px; height:18px; background:var(--border); flex-shrink:0; margin:0 4px;"></div>

      <!-- Playback -->
      <button id="btn-tl-play" class="play-btn ${playing ? 'playing' : ''}" title="${playing ? 'Pause' : 'Play'} (Space)">
        ${playing ? '⏸' : '▶'}
      </button>
      <button id="btn-tl-stop" class="icon-btn" title="Stop & rewind">⏹</button>

      <div id="tl-time-display" class="tl-time-display">${t.toFixed(2)}s / ${dur.toFixed(2)}s</div>

      <!-- Speed -->
      <label style="display:flex; align-items:center; gap:5px; font-size:0.68rem; color:var(--text-muted); flex-shrink:0;">
        Speed
        <input type="range" id="tl-speed" min="0.1" max="3" step="0.1" value="${PlaybackState.speedMult}" style="width:60px; accent-color:var(--accent);">
        <span id="tl-speed-label" style="font-family:'JetBrains Mono',monospace; min-width:28px;">${PlaybackState.speedMult.toFixed(1)}x</span>
      </label>

      <label style="display:flex; align-items:center; gap:4px; font-size:0.68rem; color:var(--text-muted); cursor:pointer; flex-shrink:0;">
        <input type="checkbox" id="tl-loop" ${anim.loop ? 'checked' : ''} style="accent-color:var(--accent);"> Loop
      </label>

      <label style="display:flex; align-items:center; gap:4px; font-size:0.68rem; color:var(--text-muted); cursor:pointer; flex-shrink:0;">
        Duration
        <input type="number" id="tl-duration" value="${dur.toFixed(2)}" min="0.1" max="60" step="0.1"
          style="width:52px; padding:2px 4px; background:rgba(0,0,0,0.3); border:1px solid var(--border);
          color:var(--text-main); border-radius:4px; font-size:0.68rem; font-family:'JetBrains Mono',monospace;">
        s
      </label>

      <div class="timeline-toolbar-right">
        <!-- Filter -->
        <button class="filter-tab ${activeFilter === 'all'      ? 'active' : ''}" data-filter="all">All</button>
        <button class="filter-tab ${activeFilter === 'selected' ? 'active' : ''}" data-filter="selected">Selected</button>
        <button class="filter-tab ${activeFilter === 'moving'   ? 'active' : ''}" data-filter="moving">Active</button>
        <div style="width:1px; height:14px; background:var(--border); margin:0 4px;"></div>
        <!-- Add controller actions -->
        <button id="btn-add-ctrl">+ Controller</button>
        <select id="sel-preset" style="font-size:0.68rem; padding:3px 5px; background:var(--bg-surface-2); border:1px solid var(--border); color:var(--text-main); border-radius:var(--r-md); max-width:130px;">
          ${FORMULA_PRESETS.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
        <button id="btn-apply-preset">Apply to Part</button>
        <button id="btn-tmpl-walk" style="color:var(--accent-green);">🚶 Walk</button>
        <button id="btn-tmpl-run"  style="color:var(--accent-orange);">🏃 Run</button>
      </div>
    </div>

    <!-- Controller grid -->
    <div class="controller-grid">
      ${filtered.length > 0
        ? filtered.map((c: any) => renderCard(c)).join('')
        : `<div style="grid-column:1/-1; color:var(--text-muted); font-size:0.75rem; padding:12px; text-align:center;">
             No controllers yet — add one above or apply a preset.
           </div>`
      }
    </div>
  `;

  // ── Bindings ──────────────────────────────────────────────────────────────

  // Anim tabs
  container.querySelectorAll('.anim-tab[data-anim-id]').forEach(btn => {
    (btn as HTMLElement).onclick = () => {
      SelectionState.activeAnimId = (btn as HTMLElement).getAttribute('data-anim-id')!;
      PlaybackState.time = 0;
      onUpdate();
    };
  });

  // Add animation
  const btnAddAnim = container.querySelector('#btn-add-anim') as HTMLElement;
  if (btnAddAnim) btnAddAnim.onclick = () => {
    const name = prompt('Animation name:', 'New Anim') || 'New Anim';
    const id = 'anim-' + Date.now();
    project.animations.push({ id, name, duration: 1, loop: true, controllers: [] });
    SelectionState.activeAnimId = id;
    DirtyState.markDirty();
    onUpdate();
  };

  // Playback
  const btnPlay = container.querySelector('#btn-tl-play') as HTMLButtonElement;
  btnPlay.onclick = () => { PlaybackState.playing = !PlaybackState.playing; onUpdate(false, true); };

  const btnStop = container.querySelector('#btn-tl-stop') as HTMLButtonElement;
  btnStop.onclick = () => { PlaybackState.time = 0; PlaybackState.playing = false; onUpdate(); };

  const speedRange = container.querySelector('#tl-speed') as HTMLInputElement;
  const speedLabel = container.querySelector('#tl-speed-label') as HTMLElement;
  speedRange.oninput = () => {
    PlaybackState.speedMult = +speedRange.value;
    speedLabel.textContent = PlaybackState.speedMult.toFixed(1) + 'x';
  };

  const loopChk = container.querySelector('#tl-loop') as HTMLInputElement;
  loopChk.onchange = () => { anim.loop = loopChk.checked; DirtyState.markDirty(); onUpdate(false, true); };

  const durInput = container.querySelector('#tl-duration') as HTMLInputElement;
  durInput.onchange = () => {
    const v = parseFloat(durInput.value);
    if (!isNaN(v) && v > 0) { anim.duration = v; DirtyState.markDirty(); onUpdate(); }
  };

  // Filter tabs
  container.querySelectorAll('.filter-tab[data-filter]').forEach(btn => {
    (btn as HTMLElement).onclick = () => {
      activeFilter = (btn as HTMLElement).getAttribute('data-filter') as any;
      onUpdate();
    };
  });

  // Add controller
  const btnAddCtrl = container.querySelector('#btn-add-ctrl') as HTMLElement;
  btnAddCtrl.onclick = () => {
    if (!SelectionState.activePartId) { alert('Select a part first.'); return; }
    anim.controllers.push(createDefaultController(SelectionState.activePartId));
    DirtyState.markDirty();
    onUpdate();
  };

  // Apply preset
  const btnPreset = container.querySelector('#btn-apply-preset') as HTMLElement;
  const selPreset = container.querySelector('#sel-preset') as HTMLSelectElement;
  btnPreset.onclick = () => {
    const partId = SelectionState.activePartId;
    if (!partId) { alert('Select a part first.'); return; }
    const part = project.parts.find(p => p.id === partId);
    if (!part) return;
    const preset = FORMULA_PRESETS.find(p => p.id === selPreset.value)!;
    addControllerSafe(anim, partId, part.name, preset.defaultProperty, preset.id, {
      speed: preset.defaultSpeed,
      amplitude: preset.defaultAmplitude,
    });
    onUpdate();
  };

  // Walk/Run templates
  (container.querySelector('#btn-tmpl-walk') as HTMLElement).onclick = () => { applyLocomotionTemplate(anim, 'walk'); onUpdate(); };
  (container.querySelector('#btn-tmpl-run')  as HTMLElement).onclick = () => { applyLocomotionTemplate(anim, 'run');  onUpdate(); };

  // Controller cards
  container.querySelectorAll('.controller-card[data-id]').forEach(card => {
    const id   = card.getAttribute('data-id')!;
    const ctrl = anim.controllers.find((c: any) => c.id === id);
    if (!ctrl) return;

    // Delete
    (card.querySelector('.ctrl-del-btn') as HTMLElement).onclick = () => {
      anim.controllers = anim.controllers.filter((c: any) => c.id !== id);
      DirtyState.markDirty();
      onUpdate();
    };

    // Enabled
    (card.querySelector('.ctrl-enabled-chk') as HTMLInputElement).onchange = (e) => {
      ctrl.enabled = (e.target as HTMLInputElement).checked;
      DirtyState.markDirty();
      onUpdate(true, true);
    };

    // Part select
    const partSel = card.querySelector('.ctrl-part-select') as HTMLSelectElement;
    partSel.onchange = () => { ctrl.targetPartId = partSel.value; DirtyState.markDirty(); onUpdate(true, false); };

    // Property
    const propSel = card.querySelector('.ctrl-prop-select') as HTMLSelectElement;
    propSel.onchange = () => { ctrl.property = propSel.value as any; DirtyState.markDirty(); onUpdate(true, false); };

    // Preset
    const presetSel = card.querySelector('.ctrl-preset-select') as HTMLSelectElement;
    presetSel.onchange = () => { ctrl.formulaPreset = presetSel.value; DirtyState.markDirty(); onUpdate(); };

    // Params
    const bp = (cls: string, name: string) => {
      const el = card.querySelector('.' + cls) as HTMLInputElement;
      if (!el) return;
      el.oninput = () => {
        const v = parseFloat(el.value);
        if (!isNaN(v)) { (ctrl.params as any)[name] = v; DirtyState.markDirty(); onUpdate(true, true); }
      };
      // Wheel scrub
      el.addEventListener('wheel', (e) => {
        e.preventDefault();
        const step = +(el.step) || 1;
        el.value = (parseFloat(el.value) + (e.deltaY < 0 ? 1 : -1) * step * (e.shiftKey ? 10 : 1)).toString();
        el.dispatchEvent(new Event('input'));
      }, { passive: false });
    };
    bp('param-speed', 'speed');
    bp('param-amp',   'amplitude');
    bp('param-phase', 'phase');
    bp('param-offset','offset');
    bp('param-min',   'min');
    bp('param-max',   'max');
  });
}

function renderCard(c: any): string {
  const parts = ProjectState.project.parts;
  const isDisabled = !c.enabled;
  return `
    <div class="controller-card ${isDisabled ? 'disabled' : ''}" data-id="${c.id}">
      <div class="ctrl-header-row">
        <input type="checkbox" class="ctrl-enabled-chk" ${c.enabled ? 'checked' : ''} title="Enable/disable">
        <select class="ctrl-part-select ctrl-prop-select" style="display:none"></select>
        <select class="ctrl-part-select">
          ${parts.map(p => `<option value="${p.id}" ${c.targetPartId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
        <span style="color:var(--text-muted);">→</span>
        <select class="ctrl-prop-select">
          ${['x','y','rotation','scaleX','scaleY','opacity'].map(p => `<option value="${p}" ${c.property === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
        <button class="ctrl-del-btn" title="Remove">✕</button>
      </div>
      <select class="ctrl-preset-select" style="font-size:0.68rem; padding:3px 6px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:var(--text-main); border-radius:var(--r-sm); width:100%;">
        ${FORMULA_PRESETS.map(p => `<option value="${p.id}" ${c.formulaPreset === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
      </select>
      <div class="ctrl-params-grid">
        ${paramField('Speed',  'param-speed',  c.params.speed  ?? 1,  0.1)}
        ${paramField('Amp',    'param-amp',    c.params.amplitude ?? 0, 1)}
        ${paramField('Phase',  'param-phase',  c.params.phase  ?? 0,  0.1)}
        ${paramField('Offset', 'param-offset', c.params.offset ?? 0,  1)}
        ${paramField('Min',    'param-min',    c.params.min    ?? 0,  1)}
        ${paramField('Max',    'param-max',    c.params.max    ?? 0,  1)}
      </div>
    </div>
  `;
}

function paramField(label: string, cls: string, val: number, step: number): string {
  return `
    <div class="ctrl-param-row">
      <label>${label}</label>
      <input type="number" class="${cls}" value="${val}" step="${step}">
    </div>
  `;
}

function addControllerSafe(
  anim: any,
  partId: string,
  partName: string,
  property: 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity',
  formulaPreset: string,
  params: Partial<{ speed: number; amplitude: number; phase: number; offset: number; min: number; max: number; }>
) {
  const existing = anim.controllers.find((c: any) => c.targetPartId === partId && c.property === property);
  if (existing && !confirm(`"${partName}" already has a ${property} controller. Add another?`)) return;

  anim.controllers.push({
    id: 'ctrl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    targetPartId: partId,
    property,
    formulaPreset,
    enabled: true,
    params: {
      speed:     params.speed     ?? 1,
      amplitude: params.amplitude ?? 10,
      phase:     params.phase     ?? 0,
      offset:    params.offset    ?? 0,
      min:       params.min       ?? 0,
      max:       params.max       ?? 0,
    },
  });
  DirtyState.markDirty();
}

function applyLocomotionTemplate(anim: any, type: 'walk' | 'run') {
  const parts = ProjectState.project.parts;
  const speed = type === 'walk' ? 2 : 2.5;

  const match = (n: string, ...terms: string[]) =>
    terms.some(t => n.toLowerCase().includes(t));

  const bodies  = parts.filter(p => match(p.name, 'body', 'torso', 'chest', 'hip', 'pelvis'));
  const heads   = parts.filter(p => match(p.name, 'head'));
  const legs    = parts.filter(p => match(p.name, 'leg', 'foot', 'thigh', 'shin', 'knee'));
  const arms    = parts.filter(p => match(p.name, 'arm', 'hand', 'elbow', 'shoulder'));
  const weapons = parts.filter(p => match(p.name, 'weapon', 'sword', 'staff', 'shield', 'bow'));
  const capes   = parts.filter(p => match(p.name, 'cape', 'cloak', 'cloth', 'tail'));

  if (bodies.length === 0 && legs.length === 0) {
    alert('No matching parts found. Name your parts with words like "body", "leg", "arm", "head", etc.');
    return;
  }

  const preset = type === 'walk' ? 'walkCycle' : 'runCycle';

  bodies.forEach(p => {
    addControllerSafe(anim, p.id, p.name, 'y',        preset, { speed, amplitude: type === 'walk' ? 3 : 5 });
    addControllerSafe(anim, p.id, p.name, 'rotation', type === 'walk' ? 'swayRotation' : 'runLean', { speed, amplitude: type === 'walk' ? 2 : 0, offset: type === 'run' ? 8 : 0 });
  });

  heads.forEach(p => {
    addControllerSafe(anim, p.id, p.name, 'rotation', 'swayRotation', { speed, amplitude: type === 'walk' ? 1.5 : 2.5, phase: 0.5 });
  });

  legs.forEach((p, i) => {
    const isRight = i % 2 === 1 || p.name.toLowerCase().includes('right') || p.name.toLowerCase().includes('_r');
    const amp = type === 'walk' ? 22 : 38;
    addControllerSafe(anim, p.id, p.name, 'rotation', preset, { speed, amplitude: isRight ? amp : -amp, phase: isRight ? Math.PI : 0 });
  });

  arms.forEach((p, i) => {
    const isLeft = i % 2 === 0 || p.name.toLowerCase().includes('left') || p.name.toLowerCase().includes('_l');
    const amp = type === 'walk' ? 18 : 28;
    addControllerSafe(anim, p.id, p.name, 'rotation', 'armSwing', { speed, amplitude: isLeft ? -amp : amp, phase: isLeft ? Math.PI : 0 });
  });

  weapons.forEach(p => {
    addControllerSafe(anim, p.id, p.name, 'rotation', preset, { speed, amplitude: type === 'walk' ? 5 : 10, phase: 0.5 });
  });

  capes.forEach(p => {
    addControllerSafe(anim, p.id, p.name, 'rotation', 'capeLag', { speed, amplitude: type === 'walk' ? 8 : 14, phase: 0.75 });
  });
}
