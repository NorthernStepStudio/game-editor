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
  
  console.log('renderControllerTimeline: activeAnimId =', SelectionState.activeAnimId, 'anim =', anim);
  
  if (!anim) {
    container.innerHTML = '<div class="panel-empty">No active animation</div>';
    return;
  }

  const displayTime = getPlaybackTimeForAnimation(anim);

  // Filter controllers
  let filtered = anim.controllers;
  if (activeFilter === 'selected') {
    filtered = anim.controllers.filter((c: any) => c.targetPartId === SelectionState.activePartId);
  } else if (activeFilter === 'moving') {
    filtered = anim.controllers.filter((c: any) => {
      return c.enabled && (
        c.params.amplitude !== 0 ||
        c.params.offset !== 0 ||
        c.params.min !== 0 ||
        c.params.max !== 0
      );
    });
  }

  container.innerHTML = `
    <!-- Top toolbar: Playback controls -->
    <div class="panel-toolbar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding:10px; border-bottom:1px solid var(--border);">
      <!-- Left: Active animation select & playback buttons -->
      <div style="display:flex; align-items:center; gap:8px;">
        <select id="select-active-anim" style="padding:4px 8px; font-size:0.75rem; background:var(--bg-surface); color:var(--text-main); border:1px solid var(--border); border-radius:4px;">
          ${project.animations.map((a: any) => `
            <option value="${a.id}" ${a.id === SelectionState.activeAnimId ? 'selected' : ''}>${a.name}</option>
          `).join('')}
        </select>
        
        <button id="btn-timeline-play" class="btn-icon" style="padding:4px 8px; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-surface); cursor:pointer; color:var(--text-main); border-radius:4px; min-width:30px;">
          ${PlaybackState.playing ? '⏸' : '▶'}
        </button>
        <button id="btn-timeline-stop" class="btn-icon" style="padding:4px 8px; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-surface); cursor:pointer; color:var(--text-main); border-radius:4px; min-width:30px;">⏹</button>
        
        <div id="timeline-time-readout" style="font-size:0.75rem; color:var(--text-muted); font-family:monospace; min-width:80px; margin-left:4px;">
          ${displayTime.toFixed(2)}s / ${(anim.duration || 1).toFixed(2)}s
        </div>
      </div>

      <!-- Middle: Speed & Loop -->
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="display:flex; align-items:center; gap:6px; font-size:0.75rem;">
          <label style="color:var(--text-muted);">Speed:</label>
          <input type="range" id="timeline-speed" min="0.1" max="3" step="0.1" value="${PlaybackState.speedMult}" style="width:70px; cursor:pointer;">
          <span style="font-family:monospace; min-width:24px; color:var(--text-muted);">${PlaybackState.speedMult.toFixed(1)}x</span>
        </div>
        
        <label style="display:flex; align-items:center; gap:4px; font-size:0.75rem; cursor:pointer; color:var(--text-muted);">
          <input type="checkbox" id="timeline-loop" ${anim.loop ? 'checked' : ''}> Loop
        </label>
      </div>

      <!-- Right: Filters -->
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size:0.75rem; color:var(--text-muted);">Filter:</span>
        <button id="filter-btn-all" class="btn-tab ${activeFilter === 'all' ? 'active' : ''}" style="padding:3px 8px; font-size:0.75rem; border:1px solid var(--border); border-radius:4px; background:${activeFilter === 'all' ? 'var(--primary)' : 'var(--bg-surface)'}; color:${activeFilter === 'all' ? '#fff' : 'var(--text-main)'}; cursor:pointer;">All</button>
        <button id="filter-btn-selected" class="btn-tab ${activeFilter === 'selected' ? 'active' : ''}" style="padding:3px 8px; font-size:0.75rem; border:1px solid var(--border); border-radius:4px; background:${activeFilter === 'selected' ? 'var(--primary)' : 'var(--bg-surface)'}; color:${activeFilter === 'selected' ? '#fff' : 'var(--text-main)'}; cursor:pointer;">Selected</button>
        <button id="filter-btn-moving" class="btn-tab ${activeFilter === 'moving' ? 'active' : ''}" style="padding:3px 8px; font-size:0.75rem; border:1px solid var(--border); border-radius:4px; background:${activeFilter === 'moving' ? 'var(--primary)' : 'var(--bg-surface)'}; color:${activeFilter === 'moving' ? '#fff' : 'var(--text-main)'}; cursor:pointer;">Moving</button>
      </div>
    </div>

    <!-- Actions toolbar: Add Controller, Apply Preset, Templates -->
    <div class="panel-toolbar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding:8px 10px; border-bottom:1px solid var(--border); background:rgba(0,0,0,0.15);">
      <div style="display:flex; align-items:center; gap:8px;">
        <button id="btn-add-ctrl" style="padding:4px 8px; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-surface); cursor:pointer; color:var(--text-main); border-radius:4px;">+ Add Controller</button>
        <div style="height:14px; width:1px; background:var(--border);"></div>
        
        <select id="select-preset-apply" style="padding:4px 8px; font-size:0.75rem; background:var(--bg-surface); color:var(--text-main); border:1px solid var(--border); border-radius:4px;">
          ${FORMULA_PRESETS.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
        <button id="btn-apply-preset" style="padding:4px 8px; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-surface); cursor:pointer; color:var(--text-main); border-radius:4px;">Apply Preset to Selected Part</button>
      </div>
      
      <div style="display:flex; align-items:center; gap:6px;">
        <button id="btn-template-walk" style="padding:4px 8px; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-surface); cursor:pointer; color:var(--text-main); border-radius:4px;">Apply Walk Template</button>
        <button id="btn-template-run" style="padding:4px 8px; font-size:0.75rem; border:1px solid var(--border); background:var(--bg-surface); cursor:pointer; color:var(--text-main); border-radius:4px;">Apply Run Template</button>
      </div>
    </div>

    <!-- Controller list -->
    <div class="controller-list" style="padding:10px; display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:10px; max-height:220px; overflow-y:auto;">
      ${filtered.map((c: any) => renderControllerCard(c)).join('')}
    </div>
  `;

  // Bind playback events
  const selectAnim = container.querySelector('#select-active-anim') as HTMLSelectElement;
  selectAnim.onchange = () => {
    SelectionState.activeAnimId = selectAnim.value;
    PlaybackState.time = 0;
    onUpdate();
  };

  const btnPlay = container.querySelector('#btn-timeline-play') as HTMLButtonElement;
  btnPlay.onclick = () => {
    PlaybackState.playing = !PlaybackState.playing;
    btnPlay.textContent = PlaybackState.playing ? '⏸' : '▶';
    onUpdate(false, true);
  };

  const btnStop = container.querySelector('#btn-timeline-stop') as HTMLButtonElement;
  btnStop.onclick = () => {
    PlaybackState.time = 0;
    PlaybackState.playing = false;
    onUpdate();
  };

  const speedRange = container.querySelector('#timeline-speed') as HTMLInputElement;
  speedRange.oninput = () => {
    PlaybackState.speedMult = +speedRange.value;
    const speedVal = speedRange.nextElementSibling as HTMLElement;
    if (speedVal) speedVal.textContent = PlaybackState.speedMult.toFixed(1) + 'x';
  };

  const loopChk = container.querySelector('#timeline-loop') as HTMLInputElement;
  loopChk.onchange = () => {
    anim.loop = loopChk.checked;
    DirtyState.markDirty();
    onUpdate(false, true);
  };

  // Bind filters
  container.querySelector('#filter-btn-all')!.addEventListener('click', () => {
    activeFilter = 'all';
    onUpdate();
  });
  container.querySelector('#filter-btn-selected')!.addEventListener('click', () => {
    activeFilter = 'selected';
    onUpdate();
  });
  container.querySelector('#filter-btn-moving')!.addEventListener('click', () => {
    activeFilter = 'moving';
    onUpdate();
  });

  // Bind creation buttons
  container.querySelector('#btn-add-ctrl')!.addEventListener('click', () => {
    if (!SelectionState.activePartId) {
      alert('Select a part first');
      return;
    }
    anim.controllers.push(createDefaultController(SelectionState.activePartId));
    DirtyState.markDirty();
    onUpdate();
  });

  container.querySelector('#btn-apply-preset')!.addEventListener('click', () => {
    const partId = SelectionState.activePartId;
    if (!partId) {
      alert('Select a part first');
      return;
    }
    const part = project.parts.find(p => p.id === partId);
    if (!part) return;

    const presetEl = container.querySelector('#select-preset-apply') as HTMLSelectElement;
    const presetId = presetEl.value;
    const targetProp = getDefaultPropertyForPreset(presetId);

    addControllerSafe(anim, partId, part.name, targetProp, presetId, {
      speed: 1.5,
      amplitude: targetProp === 'rotation' ? 15 : 8,
      phase: 0,
      offset: 0
    });

    onUpdate();
  });

  // Bind template buttons
  container.querySelector('#btn-template-walk')!.addEventListener('click', () => {
    applyLocomotionTemplate(anim, 'walk');
    onUpdate();
  });

  container.querySelector('#btn-template-run')!.addEventListener('click', () => {
    applyLocomotionTemplate(anim, 'run');
    onUpdate();
  });

  // Bind each controller card fields
  container.querySelectorAll('.controller-card').forEach(card => {
    const id = card.getAttribute('data-id')!;
    const ctrl = anim.controllers.find((c: any) => c.id === id)!;
    if (!ctrl) return;
    
    (card.querySelector('.btn-del-ctrl') as HTMLElement).onclick = () => {
      anim.controllers = anim.controllers.filter((c: any) => c.id !== id);
      DirtyState.markDirty();
      onUpdate();
    };

    (card.querySelector('.ctrl-enabled') as HTMLInputElement).onchange = (e) => {
      ctrl.enabled = (e.target as HTMLInputElement).checked;
      DirtyState.markDirty();
      onUpdate(true, true);
    };

    const targetPartSelect = card.querySelector('.ctrl-target-part') as HTMLSelectElement;
    targetPartSelect.onchange = () => {
      ctrl.targetPartId = targetPartSelect.value;
      DirtyState.markDirty();
      onUpdate(true, false);
    };

    const propertySelect = card.querySelector('.ctrl-property') as HTMLSelectElement;
    propertySelect.onchange = () => {
      ctrl.property = propertySelect.value as any;
      DirtyState.markDirty();
      onUpdate(true, false);
    };

    (card.querySelector('.ctrl-preset') as HTMLSelectElement).onchange = (e) => {
      ctrl.formulaPreset = (e.target as HTMLSelectElement).value;
      DirtyState.markDirty();
      onUpdate();
    };
    
    // Params
    const bindParam = (name: string, className: string) => {
      const el = card.querySelector('.' + className) as HTMLInputElement;
      el.oninput = () => {
        const val = parseFloat(el.value);
        if (isNaN(val)) return;
        (ctrl.params as any)[name] = val;
        DirtyState.markDirty();
        onUpdate(true, true);
      };
    };
    bindParam('speed', 'param-speed');
    bindParam('amplitude', 'param-amplitude');
    bindParam('phase', 'param-phase');
    bindParam('offset', 'param-offset');
    bindParam('min', 'param-min');
    bindParam('max', 'param-max');
  });
}

function renderControllerCard(c: any): string {
  return `
    <div class="controller-card" data-id="${c.id}" style="border: 1px solid var(--border); border-radius: 6px; padding: 10px; background: var(--bg-surface); display: flex; flex-direction: column; gap: 8px;">
      <div class="ctrl-header" style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
        <div style="display: flex; align-items: center; gap: 4px; overflow: hidden; width: 100%;">
          <input type="checkbox" class="ctrl-enabled" ${c.enabled ? 'checked' : ''} style="cursor:pointer;">
          <select class="ctrl-target-part" style="font-size: 0.75rem; padding: 2px; background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border); border-radius: 4px; max-width: 100px;">
            ${ProjectState.project.parts.map(p => `<option value="${p.id}" ${c.targetPartId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
          <span style="color:var(--text-muted);">:</span>
          <select class="ctrl-property" style="font-size: 0.75rem; padding: 2px; background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border); border-radius: 4px;">
            ${['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'].map(p => `<option value="${p}" ${c.property === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <button class="btn-del-ctrl" style="background: none; border: none; font-size: 1.1rem; cursor: pointer; color: var(--text-muted); line-height: 1; padding: 0 4px;">×</button>
      </div>
      
      <div class="ctrl-body" style="display: flex; flex-direction: column; gap: 6px;">
        <select class="ctrl-preset" style="padding: 4px; font-size: 0.75rem; background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border); border-radius: 4px; width: 100%;">
          ${FORMULA_PRESETS.map(f => `<option value="${f.id}" ${c.formulaPreset === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
        </select>
        <div class="ctrl-params" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <div class="param-row" style="display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 0.7rem;">
            <label style="color:var(--text-muted);">Speed</label>
            <input type="number" class="param-speed" value="${c.params.speed ?? 1}" step="0.1" style="width: 50px; padding: 2px; background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border); border-radius: 4px; text-align: right;">
          </div>
          <div class="param-row" style="display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 0.7rem;">
            <label style="color:var(--text-muted);">Amp</label>
            <input type="number" class="param-amplitude" value="${c.params.amplitude ?? 0}" step="1" style="width: 50px; padding: 2px; background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border); border-radius: 4px; text-align: right;">
          </div>
          <div class="param-row" style="display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 0.7rem;">
            <label style="color:var(--text-muted);">Phase</label>
            <input type="number" class="param-phase" value="${c.params.phase ?? 0}" step="0.1" style="width: 50px; padding: 2px; background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border); border-radius: 4px; text-align: right;">
          </div>
          <div class="param-row" style="display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 0.7rem;">
            <label style="color:var(--text-muted);">Offset</label>
            <input type="number" class="param-offset" value="${c.params.offset ?? 0}" step="1" style="width: 50px; padding: 2px; background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border); border-radius: 4px; text-align: right;">
          </div>
          <div class="param-row" style="display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 0.7rem;">
            <label style="color:var(--text-muted);">Min</label>
            <input type="number" class="param-min" value="${c.params.min ?? 0}" step="1" style="width: 50px; padding: 2px; background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border); border-radius: 4px; text-align: right;">
          </div>
          <div class="param-row" style="display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 0.7rem;">
            <label style="color:var(--text-muted);">Max</label>
            <input type="number" class="param-max" value="${c.params.max ?? 0}" step="1" style="width: 50px; padding: 2px; background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border); border-radius: 4px; text-align: right;">
          </div>
        </div>
      </div>
    </div>
  `;
}

function getDefaultPropertyForPreset(presetId: string): 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity' {
  switch (presetId) {
    case 'breathingY':
    case 'bobPosition':
    case 'hoverFloat':
      return 'y';
    case 'swayRotation':
    case 'walkCycle':
    case 'runCycle':
    case 'weaponSwing':
    case 'capeLag':
    case 'staffSway':
    case 'deathFall':
    case 'runLean':
    case 'legCycle':
      return 'rotation';
    case 'squashStretch':
    case 'blinkScale':
      return 'scaleY';
    case 'recoil':
    case 'impactShake':
    case 'shieldBrace':
      return 'x';
    default:
      return 'y';
  }
}

function addControllerSafe(
  anim: any,
  partId: string,
  partName: string,
  property: 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity',
  formulaPreset: string,
  params: Partial<any>
) {
  const existing = anim.controllers.find((c: any) => c.targetPartId === partId && c.property === property);
  if (existing) {
    if (!confirm(`A controller for "${partName}" : ${property} already exists. Do you want to duplicate it?`)) {
      return;
    }
  }
  
  anim.controllers.push({
    id: 'ctrl-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    targetPartId: partId,
    property,
    formulaPreset,
    enabled: true,
    params: {
      speed: params.speed ?? 1,
      amplitude: params.amplitude ?? 10,
      phase: params.phase ?? 0,
      offset: params.offset ?? 0,
      min: params.min ?? 0,
      max: params.max ?? 0
    }
  });
  DirtyState.markDirty();
}

function isSecondaryLimb(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes('right') || n.includes(' r') || n.endsWith('_r') || n.includes('back')) {
    return true;
  }
  if (n.includes('left') || n.includes(' l') || n.endsWith('_l') || n.includes('front')) {
    return false;
  }
  return false;
}

function applyLocomotionTemplate(anim: any, type: 'walk' | 'run') {
  const parts = ProjectState.project.parts;
  
  const bodyParts = parts.filter(p => {
    const n = p.name.toLowerCase();
    return n.includes('body') || n.includes('torso') || n.includes('chest') || n.includes('hip');
  });
  
  const headParts = parts.filter(p => p.name.toLowerCase().includes('head'));
  const legParts = parts.filter(p => p.name.toLowerCase().includes('leg') || p.name.toLowerCase().includes('foot'));
  const armParts = parts.filter(p => p.name.toLowerCase().includes('arm') || p.name.toLowerCase().includes('hand'));
  const weaponParts = parts.filter(p => {
    const n = p.name.toLowerCase();
    return n.includes('weapon') || n.includes('sword') || n.includes('staff') || n.includes('shield');
  });
  const capeParts = parts.filter(p => p.name.toLowerCase().includes('cape') || p.name.toLowerCase().includes('cloak'));

  if (bodyParts.length === 0 && legParts.length === 0) {
    alert("No matching leg/body parts found.");
    return;
  }

  const speed = type === 'walk' ? 2 : 2.5;

  // 1. Apply to body parts
  bodyParts.forEach(part => {
    if (type === 'walk') {
      addControllerSafe(anim, part.id, part.name, 'y', 'walkCycle', { speed, amplitude: 4 });
      addControllerSafe(anim, part.id, part.name, 'rotation', 'swayRotation', { speed, amplitude: 2, phase: 0.25 });
    } else {
      addControllerSafe(anim, part.id, part.name, 'y', 'runCycle', { speed, amplitude: 6 });
      addControllerSafe(anim, part.id, part.name, 'rotation', 'runLean', { speed: 0, amplitude: 0, offset: 8 });
    }
  });

  // 2. Apply to head parts
  headParts.forEach(part => {
    addControllerSafe(anim, part.id, part.name, 'rotation', 'swayRotation', { speed, amplitude: type === 'walk' ? 1.5 : 2, phase: 0.5 });
  });

  // 3. Apply to leg parts
  legParts.forEach((part, i) => {
    const isSec = isSecondaryLimb(part.name) || (i % 2 === 1);
    const amp = type === 'walk' ? 20 : 35;
    addControllerSafe(anim, part.id, part.name, 'rotation', type === 'walk' ? 'walkCycle' : 'runCycle', {
      speed,
      amplitude: isSec ? -amp : amp,
      phase: isSec ? 3.14 : 0
    });
  });

  // 4. Apply to arm parts
  armParts.forEach((part, i) => {
    const isSec = isSecondaryLimb(part.name) || (i % 2 === 1);
    const amp = type === 'walk' ? 15 : 25;
    addControllerSafe(anim, part.id, part.name, 'rotation', type === 'walk' ? 'walkCycle' : 'runCycle', {
      speed,
      amplitude: isSec ? amp : -amp,
      phase: isSec ? 0 : 3.14
    });
  });

  // 5. Apply to weapon parts
  weaponParts.forEach(part => {
    addControllerSafe(anim, part.id, part.name, 'rotation', type === 'walk' ? 'walkCycle' : 'runCycle', {
      speed,
      amplitude: type === 'walk' ? 5 : 10,
      phase: 0.5
    });
  });

  // 6. Apply to cape parts
  capeParts.forEach(part => {
    addControllerSafe(anim, part.id, part.name, 'rotation', 'capeLag', {
      speed,
      amplitude: type === 'walk' ? 8 : 12,
      phase: 0.75
    });
  });
}
