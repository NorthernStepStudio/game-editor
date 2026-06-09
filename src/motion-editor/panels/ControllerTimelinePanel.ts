import { ProjectState } from '../../state/projectState';
import { HistoryState } from '../../state/historyState';
import { SelectionState } from '../../state/selectionState';
import { PlaybackState, getPlaybackTimeForAnimation } from '../../state/playbackState';
import { DirtyState } from '../../state/dirtyState';
import { FORMULA_PRESETS } from '@nstep-core/formulas/presets';
import { evaluateController } from '@nstep-core/runtime/evaluateController';
import { createDefaultController } from '@nstep-core/schema/defaults';
import { applyTemplate, addControllerSafe } from '../animationTemplates';
import { initKfDragListeners, wasKfDragActive, resetKfDragActive, setKfDrag } from '../keyframeDrag';

let activeFilter: 'all' | 'selected' | 'moving' = 'all';

// Group presets by category for the dropdown
const PRESET_GROUPS = FORMULA_PRESETS.reduce((acc, p) => {
  if (!acc[p.category]) acc[p.category] = [];
  acc[p.category].push(p);
  return acc;
}, {} as Record<string, typeof FORMULA_PRESETS>);

const CATEGORY_LABELS: Record<string, string> = {
  idle: 'Idle',
  locomotion: 'Locomotion',
  jump: 'Jump',
  hit: 'Hit',
  death: 'Death',
  physics: 'Physics',
  utility: 'Utility',
};

function presetSelect(selectedId: string, cls: string): string {
  return `<select class="${cls}" style="font-size:0.68rem; padding:3px 6px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:var(--text-main); border-radius:var(--r-sm); width:100%;">
    ${Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
      const presets = PRESET_GROUPS[cat];
      if (!presets || presets.length === 0) return '';
      return `<optgroup label="${label}">${presets.map(p => `<option value="${p.id}" ${selectedId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}</optgroup>`;
    }).join('')}
  </select>`;
}

function addBlankAnimation(project: any) {
  const usedNames = new Set(project.animations.map((a: any) => a.name));
  let suffix = project.animations.length + 1;
  let name = `New Anim ${suffix}`;

  while (usedNames.has(name)) {
    suffix += 1;
    name = `New Anim ${suffix}`;
  }

  const id = `anim-${Date.now()}-${project.animations.length + 1}`;
  project.animations.push({ id, name, duration: 1.5, loop: true, controllers: [] });
  SelectionState.activeAnimId = id;
  PlaybackState.time = 0;
  PlaybackState.playing = false;
  DirtyState.markDirty();
}

export function renderControllerTimeline(container: HTMLElement, onUpdate: (skipInspector?: boolean, skipTimeline?: boolean) => void) {
  initKfDragListeners();
  const project = ProjectState.project;
  let anim = project.animations.find((a: any) => a.id === SelectionState.activeAnimId);
  if (!anim && project.animations.length > 0) {
    anim = project.animations[0];
    SelectionState.activeAnimId = anim.id;
  }

  if (!anim) {
    container.innerHTML = `
      <div class="panel-empty">
        <span class="panel-empty-icon">🎬</span>
        <span>No animations yet.</span>
        <button id="btn-add-anim" class="timeline-add-anim-btn" title="Add animation">+ Anim</button>
      </div>
    `;
    const btnAddAnim = container.querySelector('#btn-add-anim') as HTMLElement;
    if (btnAddAnim) btnAddAnim.onclick = () => { addBlankAnimation(project); onUpdate(); };
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
    <div class="timeline-toolbar">
      <!-- Anim tabs -->
      <div style="display:flex; gap:3px; flex-shrink:0; flex-wrap:wrap; align-items:center;">
        ${project.animations.map((a: any) => `
          <span class="anim-tab-group ${a.id === SelectionState.activeAnimId ? 'active' : ''}">
            <button class="anim-tab" data-anim-id="${a.id}">${a.name}</button><button class="anim-del-btn" data-del-anim-id="${a.id}" title="Delete animation">✕</button>
          </span>
        `).join('')}
        <button id="btn-add-anim" class="icon-btn timeline-add-anim-btn" title="Add animation">+ Anim</button>
      </div>

      <div style="width:1px; height:18px; background:var(--border); flex-shrink:0; margin:0 4px;"></div>

      <!-- Playback -->
      <button id="btn-tl-play" class="play-btn ${playing ? 'playing' : ''}" title="Play/Pause (Space)">
        ${playing ? '⏸' : '▶'}
      </button>
      <button id="btn-tl-stop" class="icon-btn" title="Stop & rewind">⏹</button>

      <div id="tl-time-display" class="tl-time-display">${t.toFixed(2)}s / ${dur.toFixed(2)}s</div>

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
        <button class="filter-tab ${activeFilter === 'all'      ? 'active' : ''}" data-filter="all">All</button>
        <button class="filter-tab ${activeFilter === 'selected' ? 'active' : ''}" data-filter="selected">Selected</button>
        <button class="filter-tab ${activeFilter === 'moving'   ? 'active' : ''}" data-filter="moving">Active</button>
        <div style="width:1px; height:14px; background:var(--border); margin:0 4px;"></div>
        <button id="btn-add-ctrl">+ Controller</button>
        ${presetSelect('sine', 'sel-global-preset')}
        <button id="btn-apply-preset">Apply to Part</button>
        <div style="width:1px; height:14px; background:var(--border); margin:0 3px;"></div>
        <!-- Template buttons -->
        <span style="font-size:0.65rem; color:var(--text-muted); flex-shrink:0;">Templates:</span>
        <button id="btn-tmpl-idle"       class="tmpl-btn" title="Apply Idle template">😶 Idle</button>
        <button id="btn-tmpl-walk"       class="tmpl-btn" title="Apply Walk template (side-view)" style="color:var(--accent-green);">🚶 Walk</button>
        <button id="btn-tmpl-walkfront"  class="tmpl-btn" title="Apply Walk template (front-facing)" style="color:var(--accent-green);">🚶 Walk↑</button>
        <button id="btn-tmpl-run"        class="tmpl-btn" title="Apply Run template (side-view)"  style="color:var(--accent-orange);">🏃 Run</button>
        <button id="btn-tmpl-runfront"   class="tmpl-btn" title="Apply Run template (front-facing)"  style="color:var(--accent-orange);">🏃 Run↑</button>
        <button id="btn-tmpl-jump"       class="tmpl-btn" title="Create Jump animation" style="color:var(--accent-2);">⬆ Jump</button>
        <button id="btn-tmpl-hit"        class="tmpl-btn" title="Create Hit animation"  style="color:var(--warning);">💥 Hit</button>
        <button id="btn-tmpl-death"      class="tmpl-btn" title="Create Death animation" style="color:var(--danger);">💀 Death</button>
      </div>
    </div>

    <!-- Controller grid -->
    <div class="controller-grid">
      ${filtered.length > 0
        ? filtered.map((c: any) => renderCard(c, dur)).join('')
        : `<div style="grid-column:1/-1; color:var(--text-muted); font-size:0.75rem; padding:12px; text-align:center;">
             No controllers yet — add one above or apply a preset/template.
           </div>`
      }
    </div>
  `;

  // ── Bindings ──────────────────────────────────────────────────────────────

  container.querySelectorAll('.anim-tab[data-anim-id]').forEach(btn => {
    (btn as HTMLElement).onclick = () => {
      const clickedId = (btn as HTMLElement).getAttribute('data-anim-id')!;
      if (clickedId !== SelectionState.activeAnimId) {
        SelectionState.activeAnimId = clickedId;
        PlaybackState.time = 0;
        onUpdate();
      }
    };
    (btn as HTMLElement).ondblclick = () => {
      const clickedId = (btn as HTMLElement).getAttribute('data-anim-id')!;
      const target = project.animations.find((a: any) => a.id === clickedId);
      if (!target) return;
      const newName = prompt('Rename animation:', target.name);
      if (newName !== null && newName.trim()) { target.name = newName.trim(); DirtyState.markDirty(); onUpdate(); }
    };
  });

  container.querySelectorAll('.anim-del-btn[data-del-anim-id]').forEach(btn => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      if (project.animations.length <= 1) { alert('Cannot delete the last animation.'); return; }
      const delId = (btn as HTMLElement).getAttribute('data-del-anim-id')!;
      const delAnim = project.animations.find((a: any) => a.id === delId);
      if (!delAnim) return;
      if (!confirm(`Delete animation "${delAnim.name}"?`)) return;
      project.animations = project.animations.filter((a: any) => a.id !== delId);
      if (SelectionState.activeAnimId === delId) {
        SelectionState.activeAnimId = project.animations[0]?.id ?? null;
      }
      PlaybackState.time = 0;
      DirtyState.markDirty();
      onUpdate();
    };
  });

  const btnAddAnim = container.querySelector('#btn-add-anim') as HTMLElement;
  if (btnAddAnim) btnAddAnim.onclick = () => {
    addBlankAnimation(project);
    onUpdate();
  };

  (container.querySelector('#btn-tl-play') as HTMLButtonElement).onclick = () => { PlaybackState.playing = !PlaybackState.playing; onUpdate(false, true); };
  (container.querySelector('#btn-tl-stop') as HTMLButtonElement).onclick = () => { PlaybackState.time = 0; PlaybackState.playing = false; onUpdate(); };

  const speedRange = container.querySelector('#tl-speed') as HTMLInputElement;
  const speedLabel = container.querySelector('#tl-speed-label') as HTMLElement;
  speedRange.oninput = () => { PlaybackState.speedMult = +speedRange.value; speedLabel.textContent = PlaybackState.speedMult.toFixed(1) + 'x'; };

  (container.querySelector('#tl-loop') as HTMLInputElement).onchange = (e) => { anim.loop = (e.target as HTMLInputElement).checked; DirtyState.markDirty(); onUpdate(false, true); };

  (container.querySelector('#tl-duration') as HTMLInputElement).onchange = (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v > 0) { anim.duration = v; DirtyState.markDirty(); onUpdate(); }
  };

  container.querySelectorAll('.filter-tab[data-filter]').forEach(btn => {
    (btn as HTMLElement).onclick = () => { activeFilter = (btn as HTMLElement).getAttribute('data-filter') as any; onUpdate(); };
  });

  (container.querySelector('#btn-add-ctrl') as HTMLElement).onclick = () => {
    if (!SelectionState.activePartId) { alert('Select a part first.'); return; }
    anim.controllers.push(createDefaultController(SelectionState.activePartId));
    DirtyState.markDirty(); onUpdate();
  };

  const selGlobalPreset = container.querySelector('.sel-global-preset') as HTMLSelectElement;
  (container.querySelector('#btn-apply-preset') as HTMLElement).onclick = () => {
    const partId = SelectionState.activePartId;
    if (!partId) { alert('Select a part first.'); return; }
    const part = project.parts.find(p => p.id === partId);
    if (!part) return;
    const preset = FORMULA_PRESETS.find(p => p.id === selGlobalPreset.value)!;
    addControllerSafe(anim, partId, part.name, preset.defaultProperty, preset.id, { speed: preset.defaultSpeed, amplitude: preset.defaultAmplitude });
    onUpdate();
  };

  // Template buttons — push history before overwriting animation keyframes
  const tmpl = (type: Parameters<typeof applyTemplate>[1]) => {
    HistoryState.push();
    applyTemplate(anim, type, project, onUpdate);
  };
  (container.querySelector('#btn-tmpl-idle')      as HTMLElement).onclick = () => tmpl('idle');
  (container.querySelector('#btn-tmpl-walk')      as HTMLElement).onclick = () => tmpl('walk');
  (container.querySelector('#btn-tmpl-walkfront') as HTMLElement).onclick = () => tmpl('walkFront');
  (container.querySelector('#btn-tmpl-run')       as HTMLElement).onclick = () => tmpl('run');
  (container.querySelector('#btn-tmpl-runfront')  as HTMLElement).onclick = () => tmpl('runFront');
  (container.querySelector('#btn-tmpl-jump')      as HTMLElement).onclick = () => tmpl('jump');
  (container.querySelector('#btn-tmpl-hit')       as HTMLElement).onclick = () => tmpl('hit');
  (container.querySelector('#btn-tmpl-death')     as HTMLElement).onclick = () => tmpl('death');

  // Controller cards
  container.querySelectorAll('.controller-card[data-id]').forEach(card => {
    const id   = card.getAttribute('data-id')!;
    const ctrl = anim.controllers.find((c: any) => c.id === id);
    if (!ctrl) return;

    (card.querySelector('.ctrl-del-btn') as HTMLElement).onclick = () => {
      anim.controllers = anim.controllers.filter((c: any) => c.id !== id);
      DirtyState.markDirty(); onUpdate();
    };

    (card.querySelector('.ctrl-enabled-chk') as HTMLInputElement).onchange = (e) => {
      ctrl.enabled = (e.target as HTMLInputElement).checked;
      DirtyState.markDirty(); onUpdate(true, true);
    };

    // Mode toggle
    const modeBtn = card.querySelector('.ctrl-mode-btn') as HTMLElement;
    if (modeBtn) modeBtn.onclick = () => {
      ctrl.mode = ctrl.mode === 'keyframe' ? 'formula' : 'keyframe';
      if (ctrl.mode === 'keyframe' && (!ctrl.keyframes || ctrl.keyframes.length === 0)) {
        // Pre-populate keyframes from formula at evenly-spaced times
        ctrl.keyframes = [0, 0.25, 0.5, 0.75, 1.0].map(f => ({
          time: f * dur,
          value: evaluateController(ctrl, f * dur, dur),
          easing: 'easeInOut' as const,
        }));
      }
      DirtyState.markDirty(); onUpdate();
    };

    // Part select (first one)
    const partSels = card.querySelectorAll('.ctrl-part-select') as NodeListOf<HTMLSelectElement>;
    partSels.forEach(partSel => {
      partSel.onchange = () => { ctrl.targetPartId = partSel.value; DirtyState.markDirty(); onUpdate(true, false); };
    });

    // Property
    const propSel = card.querySelector('.ctrl-prop-select') as HTMLSelectElement;
    if (propSel) propSel.onchange = () => { ctrl.property = propSel.value as any; DirtyState.markDirty(); onUpdate(true, false); };

    // Preset
    const presetSel = card.querySelector('.ctrl-preset-select') as HTMLSelectElement;
    if (presetSel) presetSel.onchange = () => { ctrl.formulaPreset = presetSel.value; DirtyState.markDirty(); onUpdate(); };

    // Easing select for keyframes
    card.querySelectorAll('.kf-easing-sel').forEach(sel => {
      (sel as HTMLSelectElement).onchange = (e) => {
        const idx = parseInt((sel as HTMLElement).getAttribute('data-kf-idx') || '0');
        if (ctrl.keyframes && ctrl.keyframes[idx]) {
          ctrl.keyframes[idx].easing = (e.target as HTMLSelectElement).value as any;
          DirtyState.markDirty(); onUpdate(true, true);
        }
      };
    });

    // Keyframe strip click = add keyframe
    const strip = card.querySelector('.kf-strip') as HTMLElement;
    if (strip) {
      strip.addEventListener('click', (e) => {
        // Suppress click that follows a drag
        if (wasKfDragActive()) { resetKfDragActive(); return; }
        const rect = strip.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width;
        const kfTime = Math.max(0, Math.min(dur, relX * dur));
        const kfVal = evaluateController(ctrl, kfTime, dur);
        if (!ctrl.keyframes) ctrl.keyframes = [];
        // Don't duplicate at exact same time
        const existing = ctrl.keyframes.findIndex((k: any) => Math.abs(k.time - kfTime) < 0.01);
        if (existing >= 0) {
          ctrl.keyframes[existing].value = kfVal;
        } else {
          ctrl.keyframes.push({ time: kfTime, value: +kfVal.toFixed(3), easing: 'easeInOut' });
          ctrl.keyframes.sort((a: any, b: any) => a.time - b.time);
        }
        DirtyState.markDirty(); onUpdate();
      });

      // Keyframe diamond interactions: right-click = delete, pointerdown = drag
      strip.querySelectorAll('.kf-diamond').forEach((diamond, di) => {
        diamond.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const kfTime = parseFloat((diamond as HTMLElement).getAttribute('data-kf-time') || '0');
          if (ctrl.keyframes) {
            ctrl.keyframes = ctrl.keyframes.filter((k: any) => Math.abs(k.time - kfTime) > 0.001);
            DirtyState.markDirty(); onUpdate();
          }
        });

        (diamond as HTMLElement).addEventListener('pointerdown', (e: PointerEvent) => {
          e.stopPropagation();
          e.preventDefault();
          if (!ctrl.keyframes || !ctrl.keyframes[di]) return;
          const kfRef = ctrl.keyframes[di];
          setKfDrag({ ctrl, kfRef, dur, stripEl: strip, onUpdate });
          (e.target as Element).setPointerCapture(e.pointerId);
        });
      });
    }

    // Params
    const bp = (cls: string, name: string) => {
      const el = card.querySelector('.' + cls) as HTMLInputElement;
      if (!el) return;
      el.oninput = () => { const v = parseFloat(el.value); if (!isNaN(v)) { (ctrl.params as any)[name] = v; DirtyState.markDirty(); onUpdate(true, true); } };
      el.addEventListener('wheel', (e) => {
        e.preventDefault();
        el.value = (parseFloat(el.value) + (e.deltaY < 0 ? 1 : -1) * (+(el.step) || 1) * (e.shiftKey ? 10 : 1)).toString();
        el.dispatchEvent(new Event('input'));
      }, { passive: false });
    };
    bp('param-speed', 'speed');
    bp('param-amp',   'amplitude');
    bp('param-phase', 'phase');
    bp('param-offset','offset');
    bp('param-min',   'min');
    bp('param-max',   'max');

    // Keyframe value inputs
    card.querySelectorAll('.kf-value-input').forEach(el => {
      (el as HTMLInputElement).onchange = (e) => {
        const idx = parseInt((el as HTMLElement).getAttribute('data-kf-idx') || '0');
        if (ctrl.keyframes && ctrl.keyframes[idx]) {
          ctrl.keyframes[idx].value = parseFloat((e.target as HTMLInputElement).value);
          DirtyState.markDirty(); onUpdate(true, true);
        }
      };
    });
  });
}

function renderCard(c: any, dur: number): string {
  const parts = ProjectState.project.parts;
  const isKeyframe = c.mode === 'keyframe';
  const kfCount = (c.keyframes || []).length;
  const t = getPlaybackTimeForAnimation(ProjectState.project.animations.find((a: any) => a.id === SelectionState.activeAnimId));

  return `
    <div class="controller-card ${!c.enabled ? 'disabled' : ''}" data-id="${c.id}">
      <div class="ctrl-header-row">
        <input type="checkbox" class="ctrl-enabled-chk" ${c.enabled ? 'checked' : ''} title="Enable/disable">
        <select class="ctrl-part-select" style="font-size:0.68rem; padding:2px 4px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:var(--text-main); border-radius:var(--r-sm); max-width:90px;">
          ${parts.map(p => `<option value="${p.id}" ${c.targetPartId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
        <span style="color:var(--text-muted); font-size:0.68rem;">→</span>
        <select class="ctrl-prop-select" style="font-size:0.68rem; padding:2px 4px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:var(--text-main); border-radius:var(--r-sm);">
          ${['x','y','rotation','scaleX','scaleY','opacity'].map(p => `<option value="${p}" ${c.property === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
        <button class="ctrl-mode-btn ${isKeyframe ? 'active' : ''}" title="${isKeyframe ? 'Switch to formula mode' : 'Switch to keyframe mode'}" style="font-size:0.6rem; padding:2px 6px; border-radius:10px; margin-left:auto;">${isKeyframe ? `🔑 ${kfCount}kf` : '〜 Formula'}</button>
        <button class="ctrl-del-btn" title="Remove">✕</button>
      </div>

      ${isKeyframe ? `
        <!-- Keyframe mode -->
        <div style="font-size:0.65rem; color:var(--text-muted); margin-bottom:3px;">Keyframes (click strip to add, right-click diamond to delete):</div>
        <div class="kf-strip" title="Click to add keyframe at that time">
          <div class="kf-playhead" style="left:${Math.max(0,Math.min(100,(t/dur*100))).toFixed(1)}%"></div>
          ${(c.keyframes || []).map((kf: any) => `
            <div class="kf-diamond" data-kf-time="${kf.time}" style="left:${(kf.time/dur*100).toFixed(1)}%" title="t=${kf.time.toFixed(2)}s v=${kf.value.toFixed(2)}"></div>
          `).join('')}
        </div>
        ${(c.keyframes || []).length > 0 ? `
        <div class="kf-table">
          <div class="kf-table-head"><span>Time</span><span>Value</span><span>Easing</span></div>
          ${(c.keyframes || []).slice(0,6).map((kf: any, i: number) => `
            <div class="kf-table-row">
              <span style="font-family:monospace;">${kf.time.toFixed(2)}s</span>
              <input type="number" class="kf-value-input" data-kf-idx="${i}" value="${kf.value.toFixed(3)}" step="0.1"
                style="width:52px; padding:1px 3px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:var(--text-main); border-radius:3px; font-size:0.65rem;">
              <select class="kf-easing-sel" data-kf-idx="${i}"
                style="font-size:0.65rem; padding:1px 3px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:var(--text-main); border-radius:3px;">
                ${['linear','easeInOut','step','spring'].map(e => `<option ${kf.easing===e?'selected':''}>${e}</option>`).join('')}
              </select>
            </div>
          `).join('')}
          ${(c.keyframes || []).length > 6 ? `<div style="font-size:0.6rem; color:var(--text-muted); text-align:center;">+${(c.keyframes||[]).length-6} more</div>` : ''}
        </div>` : ''}
      ` : `
        <!-- Formula mode -->
        ${presetSelect(c.formulaPreset, 'ctrl-preset-select')}
        <div class="ctrl-params-grid">
          ${paramField('Speed',  'param-speed',  c.params.speed      ?? 1,   0.1)}
          ${paramField('Amp',    'param-amp',    c.params.amplitude  ?? 0,   1)}
          ${paramField('Phase',  'param-phase',  c.params.phase      ?? 0,   0.1)}
          ${paramField('Offset', 'param-offset', c.params.offset     ?? 0,   1)}
          ${paramField('Min',    'param-min',    c.params.min        ?? 0,   1)}
          ${paramField('Max',    'param-max',    c.params.max        ?? 0,   1)}
        </div>
      `}
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
