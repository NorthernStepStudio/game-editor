import { ProjectState } from '../../state/projectState';
import { HistoryState } from '../../state/historyState';
import { SelectionState } from '../../state/selectionState';
import { PlaybackState, getPlaybackTimeForAnimation, startCrossfade } from '../../state/playbackState';
import { DirtyState } from '../../state/dirtyState';
import { FORMULA_PRESETS } from '@nstep-core/formulas/presets';
import { evaluateController } from '@nstep-core/runtime/evaluateController';
import { createDefaultController } from '@nstep-core/schema/defaults';
import { applyTemplate, addControllerSafe } from '../animationTemplates';
import { DopesheetPanel } from './DopesheetPanel';
import { CurveEditorPanel } from './CurveEditorPanel';

let activeFilter: 'all' | 'selected' | 'moving' = 'all';

// ── Persistent panel instances ───────────────────────────────────────────────
let _dopesheet:   DopesheetPanel   | null = null;
let _curveEditor: CurveEditorPanel | null = null;

// Group presets by category
const PRESET_GROUPS = FORMULA_PRESETS.reduce((acc, p) => {
  if (!acc[p.category]) acc[p.category] = [];
  acc[p.category].push(p);
  return acc;
}, {} as Record<string, typeof FORMULA_PRESETS>);

const CATEGORY_LABELS: Record<string, string> = {
  idle: 'Idle', locomotion: 'Locomotion', jump: 'Jump',
  hit: 'Hit', death: 'Death', physics: 'Physics', utility: 'Utility',
};

function presetSelect(selectedId: string, cls: string): string {
  return `<select class="${cls}" style="font-size:0.68rem; padding:3px 6px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:var(--text-main); border-radius:var(--r-sm); width:100%;">
    ${Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
      const presets = PRESET_GROUPS[cat];
      if (!presets?.length) return '';
      return `<optgroup label="${label}">${presets.map(p => `<option value="${p.id}" ${selectedId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}</optgroup>`;
    }).join('')}
  </select>`;
}

function addBlankAnimation(project: any) {
  const used = new Set(project.animations.map((a: any) => a.name));
  let n = project.animations.length + 1;
  let name = `New Anim ${n}`;
  while (used.has(name)) { n++; name = `New Anim ${n}`; }
  const id = `anim-${Date.now()}-${n}`;
  project.animations.push({ id, name, duration: 1.5, loop: true, controllers: [] });
  SelectionState.activeAnimId = id;
  PlaybackState.time = 0;
  PlaybackState.playing = false;
  DirtyState.markDirty();
}

// ── Main render ─────────────────────────────────────────────────────────────
export function renderControllerTimeline(
  container: HTMLElement,
  onUpdate: (skipInspector?: boolean, skipTimeline?: boolean) => void
) {
  const project = ProjectState.project;
  let anim = project.animations.find((a: any) => a.id === SelectionState.activeAnimId);
  if (!anim && project.animations.length > 0) {
    anim = project.animations[0];
    SelectionState.activeAnimId = anim.id;
  }

  if (!anim) {
    if (_dopesheet) { _dopesheet.destroy(); _dopesheet = null; }
    container.innerHTML = `
      <div class="panel-empty">
        <span class="panel-empty-icon">🎬</span>
        <span>No animations yet.</span>
        <button id="btn-add-anim" class="timeline-add-anim-btn">+ Anim</button>
      </div>`;
    (container.querySelector('#btn-add-anim') as HTMLElement).onclick = () => {
      addBlankAnimation(project); onUpdate();
    };
    return;
  }

  const t       = getPlaybackTimeForAnimation(anim);
  const dur     = anim.duration || 1;
  const playing = PlaybackState.playing;
  const fps     = PlaybackState.fps;
  const frame   = Math.round(t * fps);

  let filtered = anim.controllers as any[];
  if (activeFilter === 'selected') {
    filtered = filtered.filter((c: any) => c.targetPartId === SelectionState.activePartId);
  } else if (activeFilter === 'moving') {
    filtered = filtered.filter((c: any) => c.enabled && (c.params.amplitude !== 0 || c.params.offset !== 0));
  }

  container.innerHTML = `
    <div class="timeline-toolbar">
      <div style="display:flex; gap:3px; flex-shrink:0; flex-wrap:wrap; align-items:center;">
        ${project.animations.map((a: any) => `
          <span class="anim-tab-group ${a.id === SelectionState.activeAnimId ? 'active' : ''}">
            <button class="anim-tab" data-anim-id="${a.id}">${a.name}</button>
            <button class="anim-del-btn" data-del-anim-id="${a.id}" title="Delete">✕</button>
          </span>`).join('')}
        <button id="btn-add-anim" class="icon-btn timeline-add-anim-btn">+ Anim</button>
      </div>

      <div class="tl-sep"></div>

      <button id="btn-tl-prev" class="icon-btn" title="Previous frame (,)" style="font-size:0.72rem;">◀▌</button>
      <button id="btn-tl-play" class="play-btn ${playing ? 'playing' : ''}" title="Play/Pause (Space)">${playing ? '⏸' : '▶'}</button>
      <button id="btn-tl-next" class="icon-btn" title="Next frame (.)" style="font-size:0.72rem;">▐▶</button>
      <button id="btn-tl-stop" class="icon-btn" title="Stop &amp; rewind">⏹</button>

      <div id="tl-time-display" class="tl-time-display">${t.toFixed(2)}s / ${dur.toFixed(2)}s</div>
      <input type="number" id="tl-frame-input" class="tl-frame-display tl-frame-input"
        value="${frame}" min="0" max="${Math.round(dur * fps)}" step="1"
        title="Frame number (${fps}fps) — edit to jump">

      <label style="display:flex; align-items:center; gap:5px; font-size:0.68rem; color:var(--text-muted); flex-shrink:0;">
        Speed
        <input type="range" id="tl-speed" min="0.1" max="3" step="0.1" value="${PlaybackState.speedMult}" style="width:60px; accent-color:var(--accent);">
        <span id="tl-speed-label" style="font-family:'JetBrains Mono',monospace; min-width:28px;">${PlaybackState.speedMult.toFixed(1)}x</span>
      </label>

      <label style="display:flex; align-items:center; gap:4px; font-size:0.68rem; color:var(--text-muted); cursor:pointer; flex-shrink:0;">
        <input type="checkbox" id="tl-loop" ${anim.loop ? 'checked' : ''} style="accent-color:var(--accent);"> Loop
      </label>

      <label style="display:flex; align-items:center; gap:4px; font-size:0.68rem; color:var(--text-muted); cursor:pointer; flex-shrink:0;">
        Dur
        <input type="number" id="tl-duration" value="${dur.toFixed(2)}" min="0.1" max="60" step="0.1"
          style="width:52px; padding:2px 4px; background:rgba(0,0,0,0.3); border:1px solid var(--border);
          color:var(--text-main); border-radius:4px; font-size:0.68rem; font-family:'JetBrains Mono',monospace;">s
      </label>

      <label style="display:flex; align-items:center; gap:4px; font-size:0.68rem; color:var(--text-muted); cursor:pointer; flex-shrink:0;" title="Auto-crossfade duration when switching to this animation">
        Xfade
        <input type="number" id="tl-crossfade" value="${(anim.crossfadeDuration ?? 0).toFixed(2)}" min="0" max="10" step="0.05"
          style="width:44px; padding:2px 4px; background:rgba(0,0,0,0.3); border:1px solid var(--border);
          color:var(--text-main); border-radius:4px; font-size:0.68rem; font-family:'JetBrains Mono',monospace;">s
      </label>

      <div class="timeline-toolbar-right">
        <button class="filter-tab ${activeFilter==='all'?'active':''}" data-filter="all">All</button>
        <button class="filter-tab ${activeFilter==='selected'?'active':''}" data-filter="selected">Selected</button>
        <button class="filter-tab ${activeFilter==='moving'?'active':''}" data-filter="moving">Active</button>
        <div class="tl-sep"></div>
        <button id="btn-add-ctrl">+ Controller</button>
        ${presetSelect('sine', 'sel-global-preset')}
        <button id="btn-apply-preset">Apply to Part</button>
        <div class="tl-sep"></div>
        <span style="font-size:0.65rem; color:var(--text-muted); flex-shrink:0;">Templates:</span>
        <button id="btn-tmpl-idle"      class="tmpl-btn">😶 Idle</button>
        <button id="btn-tmpl-walk"      class="tmpl-btn" style="color:var(--accent-green);">🚶 Walk</button>
        <button id="btn-tmpl-walkfront" class="tmpl-btn" style="color:var(--accent-green);">🚶 Walk↑</button>
        <button id="btn-tmpl-run"       class="tmpl-btn" style="color:var(--accent-orange);">🏃 Run</button>
        <button id="btn-tmpl-runfront"  class="tmpl-btn" style="color:var(--accent-orange);">🏃 Run↑</button>
        <button id="btn-tmpl-jump"      class="tmpl-btn" style="color:var(--accent-2);">⬆ Jump</button>
        <button id="btn-tmpl-hit"       class="tmpl-btn" style="color:var(--warning);">💥 Hit</button>
        <button id="btn-tmpl-death"     class="tmpl-btn" style="color:var(--danger);">💀 Death</button>
      </div>
    </div>

    <div class="blend-panel">
      <div class="blend-panel-header">
        <span style="font-size:0.7rem; font-weight:600; color:var(--text-main);">⟷ Blend Configs</span>
        <button id="btn-add-blend" class="icon-btn" title="Add blend config" style="font-size:0.68rem; padding:2px 8px;">+ Blend</button>
      </div>
      ${(project.blendConfigs || []).length === 0
        ? `<span style="font-size:0.65rem; color:var(--text-muted); padding:4px 8px; display:block;">No blend configs — click + Blend to add one.</span>`
        : (project.blendConfigs || []).map((bc: any) => {
            const isActive = PlaybackState.activeBlend?.animAId === bc.animAId &&
                             PlaybackState.activeBlend?.animBId === bc.animBId;
            const w = bc.weight ?? 0.5;
            const animAName = (project.animations.find((a: any) => a.id === bc.animAId) as any)?.name ?? '?';
            const animBName = (project.animations.find((a: any) => a.id === bc.animBId) as any)?.name ?? '?';
            return `
            <div class="blend-row ${isActive ? 'blend-row-active' : ''}" data-blend-id="${bc.id}">
              <select class="blend-anim-a" style="font-size:0.65rem; padding:2px 4px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:var(--text-main); border-radius:3px; max-width:80px;">
                ${project.animations.map((a: any) => `<option value="${a.id}" ${a.id === bc.animAId ? 'selected' : ''}>${a.name}</option>`).join('')}
              </select>
              <span style="font-size:0.65rem; color:var(--text-muted);">↔</span>
              <select class="blend-anim-b" style="font-size:0.65rem; padding:2px 4px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:var(--text-main); border-radius:3px; max-width:80px;">
                ${project.animations.map((a: any) => `<option value="${a.id}" ${a.id === bc.animBId ? 'selected' : ''}>${a.name}</option>`).join('')}
              </select>
              <span style="font-size:0.62rem; color:var(--text-muted); flex-shrink:0;">${animAName.slice(0,6)}</span>
              <input type="range" class="blend-weight-range" min="0" max="1" step="0.01" value="${w.toFixed(2)}"
                style="width:80px; accent-color:var(--accent);" title="Blend weight (0=A, 1=B)">
              <span class="blend-weight-label" style="font-size:0.62rem; font-family:monospace; min-width:32px;">${w.toFixed(2)}</span>
              <span style="font-size:0.62rem; color:var(--text-muted); flex-shrink:0;">${animBName.slice(0,6)}</span>
              <button class="blend-preview-btn icon-btn" title="${isActive ? 'Stop preview' : 'Preview blend in canvas'}" style="font-size:0.62rem; padding:1px 6px;">${isActive ? '⏹' : '▶'}</button>
              <button class="blend-del-btn icon-btn" title="Delete blend config" style="font-size:0.62rem; color:var(--danger);">✕</button>
            </div>`;
          }).join('')
      }
    </div>

    <div class="ds-mount"></div>
    <div class="ds-hint">
      Double-click lane: add keyframe &nbsp;·&nbsp; Drag ◆: move &nbsp;·&nbsp; Right-click ◆: delete &nbsp;·&nbsp; Delete: remove selected &nbsp;·&nbsp; Shift-click / box-drag: multi-select
    </div>
    <div class="curve-editor-mount"></div>

    <div class="controller-grid">
      ${filtered.length > 0
        ? filtered.map((c: any) => renderCard(c, dur)).join('')
        : `<div style="grid-column:1/-1; color:var(--text-muted); font-size:0.75rem; padding:12px; text-align:center;">
             No controllers — add one above or apply a template.
           </div>`}
    </div>`;

  // ── Mount / reattach dopesheet ─────────────────────────────────────────────
  const dsMount = container.querySelector('.ds-mount') as HTMLElement;
  if (_dopesheet) {
    dsMount.appendChild(_dopesheet.wrapper);
    _dopesheet.setAnim(anim);
  } else {
    _dopesheet = new DopesheetPanel(dsMount, onUpdate);
    _dopesheet.setAnim(anim);
  }

  // ── Mount / update curve editor ────────────────────────────────────────────
  const ceMount = container.querySelector('.curve-editor-mount') as HTMLElement;
  {
    // Find the selected keyframe and its next neighbour
    let selectedKf:  any = null;
    let nextKf:      any = null;

    if (SelectionState.selectedKeyframeIds.size === 1) {
      const selId = [...SelectionState.selectedKeyframeIds][0];
      // Search all controllers for the selected kf
      for (const ctrl of anim.controllers as any[]) {
        if (!ctrl.keyframes) continue;
        const sorted = [...ctrl.keyframes].sort((a: any, b: any) => a.time - b.time);
        const idx    = sorted.findIndex((k: any) => k.id === selId);
        if (idx !== -1 && idx < sorted.length - 1) {
          selectedKf = sorted[idx];
          nextKf     = sorted[idx + 1];
          break;
        }
      }
    }

    if (selectedKf && nextKf) {
      if (!_curveEditor) {
        _curveEditor = new CurveEditorPanel(ceMount, onUpdate);
      } else if (!ceMount.contains(_curveEditor.wrapper)) {
        ceMount.appendChild(_curveEditor.wrapper);
      }
      _curveEditor.setKeyframes(selectedKf, nextKf);
    } else {
      // Hide: detach wrapper but keep the instance alive for next show
      if (_curveEditor && ceMount.contains(_curveEditor.wrapper)) {
        ceMount.removeChild(_curveEditor.wrapper);
      }
    }
  }

  // ── Bindings ───────────────────────────────────────────────────────────────

  container.querySelectorAll('.anim-tab[data-anim-id]').forEach(btn => {
    (btn as HTMLElement).onclick = () => {
      const id = (btn as HTMLElement).getAttribute('data-anim-id')!;
      if (id !== SelectionState.activeAnimId) {
        const newAnim = project.animations.find((a: any) => a.id === id) as any;
        const xfadeDur = newAnim?.crossfadeDuration ?? 0;
        if (xfadeDur > 0 && SelectionState.activeAnimId) {
          startCrossfade(SelectionState.activeAnimId, PlaybackState.time, xfadeDur);
          PlaybackState.time = 0;
        } else {
          PlaybackState.crossfade = null;
          PlaybackState.time = 0;
        }
        PlaybackState.activeBlend = null;
        SelectionState.activeAnimId = id;
        SelectionState.selectedKeyframeIds.clear();
        SelectionState.selectedLaneCtrlId = null;
        onUpdate();
      }
    };
    (btn as HTMLElement).ondblclick = () => {
      const id = (btn as HTMLElement).getAttribute('data-anim-id')!;
      const a  = project.animations.find((x: any) => x.id === id);
      if (!a) return;
      const nm = prompt('Rename animation:', a.name);
      if (nm?.trim()) { a.name = nm.trim(); DirtyState.markDirty(); onUpdate(); }
    };
  });

  container.querySelectorAll('.anim-del-btn[data-del-anim-id]').forEach(btn => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      if (project.animations.length <= 1) { alert('Cannot delete the last animation.'); return; }
      const delId = (btn as HTMLElement).getAttribute('data-del-anim-id')!;
      const da    = project.animations.find((x: any) => x.id === delId);
      if (!da || !confirm(`Delete "${da.name}"?`)) return;
      project.animations = project.animations.filter((x: any) => x.id !== delId);
      if (SelectionState.activeAnimId === delId)
        SelectionState.activeAnimId = project.animations[0]?.id ?? null;
      PlaybackState.time = 0;
      DirtyState.markDirty(); onUpdate();
    };
  });

  (container.querySelector('#btn-add-anim') as HTMLElement).onclick = () => {
    addBlankAnimation(project); onUpdate();
  };

  // ── Blend panel bindings ────────────────────────────────────────────────────

  (container.querySelector('#btn-add-blend') as HTMLElement).onclick = () => {
    if (project.animations.length < 2) { alert('Add at least two animations first.'); return; }
    if (!project.blendConfigs) project.blendConfigs = [];
    project.blendConfigs.push({
      id: 'blend-' + Math.random().toString(36).slice(2, 11),
      animAId: project.animations[0].id,
      animBId: project.animations[1].id,
      weight: 0.5,
    });
    DirtyState.markDirty(); onUpdate();
  };

  container.querySelectorAll('.blend-row[data-blend-id]').forEach(row => {
    const blendId = (row as HTMLElement).getAttribute('data-blend-id')!;
    const bc = (project.blendConfigs || []).find((b: any) => b.id === blendId) as any;
    if (!bc) return;

    (row.querySelector('.blend-anim-a') as HTMLSelectElement).onchange = (e) => {
      bc.animAId = (e.target as HTMLSelectElement).value;
      if (PlaybackState.activeBlend?.animAId === bc.animAId) {
        PlaybackState.activeBlend = { animAId: bc.animAId, animBId: bc.animBId, weight: bc.weight };
      }
      DirtyState.markDirty(); onUpdate();
    };

    (row.querySelector('.blend-anim-b') as HTMLSelectElement).onchange = (e) => {
      bc.animBId = (e.target as HTMLSelectElement).value;
      if (PlaybackState.activeBlend?.animBId === bc.animBId) {
        PlaybackState.activeBlend = { animAId: bc.animAId, animBId: bc.animBId, weight: bc.weight };
      }
      DirtyState.markDirty(); onUpdate();
    };

    const weightRange = row.querySelector('.blend-weight-range') as HTMLInputElement;
    const weightLabel = row.querySelector('.blend-weight-label') as HTMLElement;
    weightRange.oninput = () => {
      bc.weight = parseFloat(weightRange.value);
      weightLabel.textContent = bc.weight.toFixed(2);
      if (PlaybackState.activeBlend?.animAId === bc.animAId && PlaybackState.activeBlend?.animBId === bc.animBId) {
        PlaybackState.activeBlend.weight = bc.weight;
      }
      DirtyState.markDirty();
    };

    (row.querySelector('.blend-preview-btn') as HTMLElement).onclick = () => {
      const isActive = PlaybackState.activeBlend?.animAId === bc.animAId &&
                       PlaybackState.activeBlend?.animBId === bc.animBId;
      if (isActive) {
        PlaybackState.activeBlend = null;
      } else {
        PlaybackState.crossfade = null;
        PlaybackState.activeBlend = { animAId: bc.animAId, animBId: bc.animBId, weight: bc.weight };
      }
      onUpdate();
    };

    (row.querySelector('.blend-del-btn') as HTMLElement).onclick = () => {
      project.blendConfigs = (project.blendConfigs || []).filter((b: any) => b.id !== blendId);
      if (PlaybackState.activeBlend?.animAId === bc.animAId &&
          PlaybackState.activeBlend?.animBId === bc.animBId) {
        PlaybackState.activeBlend = null;
      }
      DirtyState.markDirty(); onUpdate();
    };
  });

  (container.querySelector('#btn-tl-play') as HTMLButtonElement).onclick = () => {
    PlaybackState.playing = !PlaybackState.playing; onUpdate(false, true);
  };
  (container.querySelector('#btn-tl-stop') as HTMLButtonElement).onclick = () => {
    PlaybackState.time = 0; PlaybackState.playing = false; onUpdate();
  };

  const frameDur = 1 / PlaybackState.fps;
  (container.querySelector('#btn-tl-prev') as HTMLButtonElement).onclick = () => {
    PlaybackState.time    = Math.max(0, PlaybackState.time - frameDur);
    PlaybackState.playing = false;
    onUpdate(true, true);
  };
  (container.querySelector('#btn-tl-next') as HTMLButtonElement).onclick = () => {
    PlaybackState.time    = Math.min(anim.duration, PlaybackState.time + frameDur);
    PlaybackState.playing = false;
    onUpdate(true, true);
  };

  const frameInput = container.querySelector('#tl-frame-input') as HTMLInputElement;
  frameInput.onchange = () => {
    const f = parseInt(frameInput.value, 10);
    if (!isNaN(f)) {
      PlaybackState.time    = Math.max(0, Math.min(anim.duration, f / PlaybackState.fps));
      PlaybackState.playing = false;
      onUpdate(true, true);
    }
  };
  frameInput.onkeydown = (e) => {
    if (e.key === 'Enter') { frameInput.blur(); e.preventDefault(); }
    // Prevent comma/period shortcuts from firing while editing frame number
    if (e.key === ',' || e.key === '.') e.stopPropagation();
  };

  const speedRange = container.querySelector('#tl-speed') as HTMLInputElement;
  const speedLabel = container.querySelector('#tl-speed-label') as HTMLElement;
  speedRange.oninput = () => {
    PlaybackState.speedMult = +speedRange.value;
    speedLabel.textContent  = PlaybackState.speedMult.toFixed(1) + 'x';
  };

  (container.querySelector('#tl-loop') as HTMLInputElement).onchange = (e) => {
    anim.loop = (e.target as HTMLInputElement).checked;
    DirtyState.markDirty(); onUpdate(false, true);
  };

  (container.querySelector('#tl-duration') as HTMLInputElement).onchange = (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v > 0) { anim.duration = v; DirtyState.markDirty(); onUpdate(); }
  };

  (container.querySelector('#tl-crossfade') as HTMLInputElement).onchange = (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v >= 0) {
      if (v === 0) delete (anim as any).crossfadeDuration;
      else anim.crossfadeDuration = v;
      DirtyState.markDirty();
    }
  };

  container.querySelectorAll('.filter-tab[data-filter]').forEach(btn => {
    (btn as HTMLElement).onclick = () => {
      activeFilter = (btn as HTMLElement).getAttribute('data-filter') as any; onUpdate();
    };
  });

  (container.querySelector('#btn-add-ctrl') as HTMLElement).onclick = () => {
    if (!SelectionState.activePartId) { alert('Select a part first.'); return; }
    anim.controllers.push(createDefaultController(SelectionState.activePartId));
    DirtyState.markDirty(); onUpdate();
  };

  const selGlobalPreset = container.querySelector('.sel-global-preset') as HTMLSelectElement;
  (container.querySelector('#btn-apply-preset') as HTMLElement).onclick = () => {
    const pid = SelectionState.activePartId;
    if (!pid) { alert('Select a part first.'); return; }
    const part = project.parts.find((p: any) => p.id === pid);
    if (!part) return;
    const preset = FORMULA_PRESETS.find(p => p.id === selGlobalPreset.value)!;
    addControllerSafe(anim, pid, part.name, preset.defaultProperty, preset.id,
      { speed: preset.defaultSpeed, amplitude: preset.defaultAmplitude });
    onUpdate();
  };

  const tmpl = (type: Parameters<typeof applyTemplate>[1]) => {
    HistoryState.push(); applyTemplate(anim, type, project, onUpdate);
  };
  (container.querySelector('#btn-tmpl-idle')      as HTMLElement).onclick = () => tmpl('idle');
  (container.querySelector('#btn-tmpl-walk')      as HTMLElement).onclick = () => tmpl('walk');
  (container.querySelector('#btn-tmpl-walkfront') as HTMLElement).onclick = () => tmpl('walkFront');
  (container.querySelector('#btn-tmpl-run')       as HTMLElement).onclick = () => tmpl('run');
  (container.querySelector('#btn-tmpl-runfront')  as HTMLElement).onclick = () => tmpl('runFront');
  (container.querySelector('#btn-tmpl-jump')      as HTMLElement).onclick = () => tmpl('jump');
  (container.querySelector('#btn-tmpl-hit')       as HTMLElement).onclick = () => tmpl('hit');
  (container.querySelector('#btn-tmpl-death')     as HTMLElement).onclick = () => tmpl('death');

  // ── Controller card bindings ────────────────────────────────────────────────
  container.querySelectorAll('.controller-card[data-id]').forEach(card => {
    const id   = card.getAttribute('data-id')!;
    const ctrl = anim.controllers.find((c: any) => c.id === id);
    if (!ctrl) return;

    (card.querySelector('.ctrl-del-btn') as HTMLElement).onclick = () => {
      anim.controllers = anim.controllers.filter((c: any) => c.id !== id);
      if (SelectionState.selectedLaneCtrlId === id) SelectionState.selectedLaneCtrlId = null;
      DirtyState.markDirty(); onUpdate();
    };

    (card.querySelector('.ctrl-enabled-chk') as HTMLInputElement).onchange = (e) => {
      ctrl.enabled = (e.target as HTMLInputElement).checked;
      DirtyState.markDirty(); onUpdate(true, true);
    };

    const modeBtn = card.querySelector('.ctrl-mode-btn') as HTMLElement;
    if (modeBtn) modeBtn.onclick = () => {
      ctrl.mode = ctrl.mode === 'keyframe' ? 'formula' : 'keyframe';
      if (ctrl.mode === 'keyframe' && (!ctrl.keyframes || ctrl.keyframes.length === 0)) {
        ctrl.keyframes = [0, 0.25, 0.5, 0.75, 1.0].map((f: number) => ({
          id:    'kf-' + Math.random().toString(36).slice(2, 11),
          time:  f * dur,
          value: evaluateController(ctrl, f * dur, dur),
          easing: 'easeInOut' as const,
        }));
      }
      DirtyState.markDirty(); onUpdate();
    };

    card.querySelectorAll('.ctrl-part-select').forEach((sel: Element) => {
      (sel as HTMLSelectElement).onchange = () => {
        ctrl.targetPartId = (sel as HTMLSelectElement).value;
        DirtyState.markDirty(); onUpdate(true, false);
      };
    });

    const propSel = card.querySelector('.ctrl-prop-select') as HTMLSelectElement;
    if (propSel) propSel.onchange = () => {
      ctrl.property = propSel.value as any; DirtyState.markDirty(); onUpdate(true, false);
    };

    const tintSwatch = card.querySelector('.ctrl-tint-swatch') as HTMLInputElement | null;
    if (tintSwatch) tintSwatch.oninput = () => {
      const part = ProjectState.project.parts.find((p: any) => p.id === ctrl.targetPartId) as any;
      if (part) { part.tintColor = tintSwatch.value; DirtyState.markDirty(); onUpdate(true, false); }
    };

    const presetSel = card.querySelector('.ctrl-preset-select') as HTMLSelectElement;
    if (presetSel) presetSel.onchange = () => {
      ctrl.formulaPreset = presetSel.value; DirtyState.markDirty(); onUpdate();
    };

    card.querySelectorAll('.kf-easing-sel').forEach(sel => {
      (sel as HTMLSelectElement).onchange = (e) => {
        const idx = parseInt((sel as HTMLElement).getAttribute('data-kf-idx') || '0');
        if (ctrl.keyframes?.[idx]) {
          ctrl.keyframes[idx].easing = (e.target as HTMLSelectElement).value as any;
          DirtyState.markDirty(); onUpdate(true, true);
        }
      };
    });

    card.querySelectorAll('.kf-value-input').forEach(el => {
      (el as HTMLInputElement).onchange = (e) => {
        const idx = parseInt((el as HTMLElement).getAttribute('data-kf-idx') || '0');
        if (ctrl.keyframes?.[idx]) {
          ctrl.keyframes[idx].value = parseFloat((e.target as HTMLInputElement).value);
          DirtyState.markDirty(); onUpdate(true, true);
        }
      };
    });

    const bp = (cls: string, name: string) => {
      const el = card.querySelector('.' + cls) as HTMLInputElement;
      if (!el) return;
      el.oninput = () => {
        const v = parseFloat(el.value);
        if (!isNaN(v)) { (ctrl.params as any)[name] = v; DirtyState.markDirty(); onUpdate(true, true); }
      };
      el.addEventListener('wheel', (e) => {
        e.preventDefault();
        el.value = (parseFloat(el.value) + (e.deltaY < 0 ? 1 : -1) * (+(el.step) || 1) * (e.shiftKey ? 10 : 1)).toString();
        el.dispatchEvent(new Event('input'));
      }, { passive: false });
    };
    bp('param-speed',  'speed');
    bp('param-amp',    'amplitude');
    bp('param-phase',  'phase');
    bp('param-offset', 'offset');
    bp('param-min',    'min');
    bp('param-max',    'max');

    // Clicking the card selects the lane in the dopesheet
    (card as HTMLElement).addEventListener('pointerdown', () => {
      SelectionState.selectedLaneCtrlId = ctrl.id;
    });
  });
}

// ── Controller card HTML ────────────────────────────────────────────────────
function renderCard(c: any, _dur: number): string {
  const parts      = ProjectState.project.parts;
  const isKf       = c.mode === 'keyframe';
  const kfCount    = (c.keyframes || []).length;

  return `
    <div class="controller-card ${!c.enabled ? 'disabled' : ''}" data-id="${c.id}">
      <div class="ctrl-header-row">
        <input type="checkbox" class="ctrl-enabled-chk" ${c.enabled ? 'checked' : ''} title="Enable/disable">
        <select class="ctrl-part-select" style="font-size:0.68rem; padding:2px 4px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:var(--text-main); border-radius:var(--r-sm); max-width:90px;">
          ${parts.map((p: any) => `<option value="${p.id}" ${c.targetPartId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
        <span style="color:var(--text-muted); font-size:0.68rem;">→</span>
        <select class="ctrl-prop-select" style="font-size:0.68rem; padding:2px 4px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:var(--text-main); border-radius:var(--r-sm);">
          ${['x','y','rotation','scaleX','scaleY','opacity','zIndex','color'].map(p => `<option value="${p}" ${c.property === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
        ${c.property === 'color' ? (() => {
          const targetPart = ProjectState.project.parts.find((p: any) => p.id === c.targetPartId) as any;
          return `<input type="color" class="ctrl-tint-swatch" value="${targetPart?.tintColor || '#ff0000'}" title="Tint target colour" style="width:24px; height:22px; padding:1px 2px; border:1px solid var(--border); border-radius:3px; cursor:pointer; background:none;">`;
        })() : ''}
        <button class="ctrl-mode-btn ${isKf ? 'active' : ''}" title="${isKf ? 'Switch to formula mode' : 'Switch to keyframe mode'}">${isKf ? `🔑 ${kfCount}kf` : '〜 Formula'}</button>
        <button class="ctrl-del-btn" title="Remove">✕</button>
      </div>

      ${isKf ? `
        ${kfCount > 0 ? `
        <div class="kf-table">
          <div class="kf-table-head"><span>Time</span><span>Value</span><span>Easing</span></div>
          ${(c.keyframes || []).slice(0, 6).map((kf: any, i: number) => `
            <div class="kf-table-row">
              <span style="font-family:monospace;">${kf.time.toFixed(2)}s</span>
              <input type="number" class="kf-value-input" data-kf-idx="${i}" value="${kf.value.toFixed(3)}" step="0.1"
                style="width:52px; padding:1px 3px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:var(--text-main); border-radius:3px; font-size:0.65rem;">
              <select class="kf-easing-sel" data-kf-idx="${i}"
                style="font-size:0.65rem; padding:1px 3px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:var(--text-main); border-radius:3px;">
                ${['linear','easeInOut','bezier','step','spring'].map(e => `<option ${kf.easing === e ? 'selected' : ''}>${e}</option>`).join('')}
              </select>
            </div>
          `).join('')}
          ${kfCount > 6 ? `<div style="font-size:0.6rem; color:var(--text-muted); text-align:center; padding:3px;">+${kfCount - 6} more</div>` : ''}
        </div>` : `
        <div style="font-size:0.62rem; color:var(--text-dim); padding:4px 0;">
          Double-click a lane in the dopesheet above to add keyframes.
        </div>`}
      ` : `
        ${presetSelect(c.formulaPreset, 'ctrl-preset-select')}
        <div class="ctrl-params-grid">
          ${pf('Speed',  'param-speed',  c.params.speed     ?? 1,   0.1)}
          ${pf('Amp',    'param-amp',    c.params.amplitude ?? 0,   1)}
          ${pf('Phase',  'param-phase',  c.params.phase     ?? 0,   0.1)}
          ${pf('Offset', 'param-offset', c.params.offset    ?? 0,   1)}
          ${pf('Min',    'param-min',    c.params.min       ?? 0,   1)}
          ${pf('Max',    'param-max',    c.params.max       ?? 0,   1)}
        </div>
      `}
    </div>`;
}

function pf(label: string, cls: string, val: number, step: number): string {
  return `<div class="ctrl-param-row"><label>${label}</label><input type="number" class="${cls}" value="${val}" step="${step}"></div>`;
}
