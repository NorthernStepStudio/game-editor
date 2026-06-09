import { ProjectState } from '../../state/projectState';
import { PlaybackState, getPlaybackTimeForAnimation } from '../../state/playbackState';
import { SelectionState } from '../../state/selectionState';
import { DirtyState } from '../../state/dirtyState';
import { evaluateController } from '@nstep-core/runtime/evaluateController';

// ── Stable keyframe ID generator ──────────────────────────────────────────────
function genKfId(): string {
  return 'kf-' + Math.random().toString(36).slice(2, 11);
}

// ── Layout constants (CSS pixels) ─────────────────────────────────────────────
const RULER_H      = 22;
const ROW_H        = 28;
const EVENTS_ROW_H = ROW_H;
const LABEL_W      = 148;
const D_SIZE       = 5;
const FLAG_W       = 8;
const FLAG_H       = 12;

// ── Property colours ──────────────────────────────────────────────────────────
const PROP_COLOR: Record<string, string> = {
  x:        '#4ade80',
  y:        '#60a5fa',
  rotation: '#f472b6',
  scaleX:   '#fb923c',
  scaleY:   '#fb923c',
  opacity:  '#c084fc',
};

type DragMode = 'playhead' | 'kf' | 'box' | 'event' | null;

interface KfHit {
  ctrlIdx: number;
  kfIdx:   number;
  kfRef:   any;
  ctrl:    any;
}

// ── DopesheetPanel ─────────────────────────────────────────────────────────────
export class DopesheetPanel {
  public wrapper: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx:    CanvasRenderingContext2D;
  private dpr:    number;
  private onUpdate: (skipInsp?: boolean, skipTl?: boolean) => void;

  private anim:        any    = null;
  private dur:         number = 1;
  private currentTime: number = 0;
  private _lastTime:   number = -1;
  private _rafId:      number = 0;
  private _needsDraw:  boolean = false;

  // Drag state
  private dragMode:         DragMode = null;
  private dragKf:           KfHit | null = null;
  private dragKfOrigTime:   number = 0;
  // id → { kfRef, origTime } for all selected keyframes at drag start (bulk move)
  private dragSelOrigTimes: Map<string, { kfRef: any; origTime: number }> = new Map();
  private boxStartCss:      { x: number; y: number } | null = null;
  private boxCurCss:        { x: number; y: number } | null = null;

  // Event track state
  private selectedEventId:    string | null = null;
  private dragEventRef:       any | null = null;
  private _popupEl:           HTMLElement | null = null;

  // Bound handlers (kept for proper removal)
  private _onPDown: (e: PointerEvent) => void;
  private _onPMove: (e: PointerEvent) => void;
  private _onPUp:   (e: PointerEvent) => void;
  private _onKDown: (e: KeyboardEvent) => void;
  private _onCtxMenu: (e: MouseEvent) => void;

  constructor(
    mountEl: HTMLElement,
    onUpdate: (skipInsp?: boolean, skipTl?: boolean) => void
  ) {
    this.onUpdate = onUpdate;
    this.dpr = window.devicePixelRatio || 1;

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'ds-wrapper';
    mountEl.appendChild(this.wrapper);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ds-canvas';
    this.wrapper.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('DopesheetPanel: failed to get 2D context');
    this.ctx = ctx;

    // Bind handlers once
    this._onPDown   = (e) => this.onPointerDown(e);
    this._onPMove   = (e) => this.onPointerMove(e);
    this._onPUp     = (e) => this.onPointerUp(e);
    this._onKDown   = (e) => this.onKeyDown(e);
    this._onCtxMenu = (e) => this.onContextMenu(e);

    this.canvas.addEventListener('pointerdown', this._onPDown);
    this.canvas.addEventListener('contextmenu', this._onCtxMenu);
    window.addEventListener('pointermove', this._onPMove);
    window.addEventListener('pointerup',   this._onPUp);
    window.addEventListener('keydown',     this._onKDown);

    this._startLoop();
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  setAnim(anim: any) {
    this.anim = anim;
    this.dur  = anim?.duration ?? 1;
    this._needsDraw = true;
    this._resize();
  }

  destroy() {
    cancelAnimationFrame(this._rafId);
    this.canvas.removeEventListener('pointerdown', this._onPDown);
    this.canvas.removeEventListener('contextmenu', this._onCtxMenu);
    window.removeEventListener('pointermove', this._onPMove);
    window.removeEventListener('pointerup',   this._onPUp);
    window.removeEventListener('keydown',     this._onKDown);
    this._removePopup();
  }

  // ── RAF loop ─────────────────────────────────────────────────────────────────

  private _startLoop() {
    const loop = () => {
      if (this.anim) {
        const t = getPlaybackTimeForAnimation(this.anim);
        if (t !== this._lastTime || this._needsDraw || this.dragMode) {
          this._lastTime   = t;
          this.currentTime = t;
          this._resize();
          this.draw();
          this._needsDraw = false;
        }
      }
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  // ── Sizing ────────────────────────────────────────────────────────────────────

  private _resize() {
    const ctrls = this._ctrls();
    const cssW  = this.wrapper.clientWidth  || 600;
    const cssH  = RULER_H + EVENTS_ROW_H + Math.max(1, ctrls.length) * ROW_H;

    const pxW = Math.round(cssW * this.dpr);
    const pxH = Math.round(cssH * this.dpr);

    if (this.canvas.width !== pxW || this.canvas.height !== pxH) {
      this.canvas.width  = pxW;
      this.canvas.height = pxH;
      this.canvas.style.width  = cssW + 'px';
      this.canvas.style.height = cssH + 'px';
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private _ctrls(): any[] {
    return this.anim?.controllers ?? [];
  }

  private _cssFromEvent(e: PointerEvent | MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private _timeToX(t: number): number {
    const cw = (this.canvas.width / this.dpr) - LABEL_W;
    return LABEL_W + (t / this.dur) * cw;
  }

  private _xToTime(cssX: number): number {
    const cw = (this.canvas.width / this.dpr) - LABEL_W;
    if (cw <= 0) return 0;
    return Math.max(0, Math.min(this.dur, ((cssX - LABEL_W) / cw) * this.dur));
  }

  private _rowTopCss(i: number): number {
    return RULER_H + EVENTS_ROW_H + i * ROW_H;
  }

  private _eventsRowTopCss(): number {
    return RULER_H;
  }

  private _isEventsRow(cssY: number): boolean {
    return cssY >= RULER_H && cssY < RULER_H + EVENTS_ROW_H;
  }

  private _selIds(): Set<string> {
    return (SelectionState as any).selectedKeyframeIds as Set<string>;
  }

  /** Find a keyframe by its stable ID; returns null if not found. */
  private _findKfById(id: string): { kfRef: any; ctrl: any; ctrlIdx: number; kfIdx: number } | null {
    const ctrls = this._ctrls();
    for (let ci = 0; ci < ctrls.length; ci++) {
      const kfs: any[] = ctrls[ci].keyframes ?? [];
      for (let ki = 0; ki < kfs.length; ki++) {
        if (kfs[ki].id === id) return { kfRef: kfs[ki], ctrl: ctrls[ci], ctrlIdx: ci, kfIdx: ki };
      }
    }
    return null;
  }

  private _tickInterval(pxPerSec: number): number {
    for (const iv of [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10]) {
      if (pxPerSec * iv >= 6) return iv;
    }
    return 10;
  }

  // ── Drawing ───────────────────────────────────────────────────────────────────

  draw() {
    const ctx   = this.ctx;
    const dpr   = this.dpr;
    const W     = this.canvas.width;
    const H     = this.canvas.height;
    const LWpx  = LABEL_W * dpr;
    const RHpx  = RULER_H * dpr;
    const cPxW  = W - LWpx;
    const ctrls = this._ctrls();

    ctx.clearRect(0, 0, W, H);

    // ── Label column bg ──
    ctx.fillStyle = '#0d0d13';
    ctx.fillRect(0, 0, LWpx, H);

    // ── Ruler bg ──
    ctx.fillStyle = '#111117';
    ctx.fillRect(LWpx, 0, cPxW, RHpx);

    // ── Ruler ticks + labels ──
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    const pxPerSec = cPxW / this.dur;
    const tickIv   = this._tickInterval(pxPerSec / dpr);
    const majorIv  = tickIv * 5;

    let tick = 0;
    while (tick <= this.dur + tickIv * 0.4) {
      const cx      = LWpx + (tick / this.dur) * cPxW;
      const isMajor = Math.round(tick / tickIv) % 5 === 0;
      const tickH   = (isMajor ? 9 : 4) * dpr;

      ctx.fillStyle = isMajor ? '#3a3a50' : '#1e1e2e';
      ctx.fillRect(cx - 0.5, RHpx - tickH, 1, tickH);

      if (isMajor) {
        ctx.fillStyle = '#5a5a7a';
        ctx.font = `${9 * dpr}px JetBrains Mono, monospace`;
        const lbl = tick < 0.01 ? '0'
          : tick >= 1 ? tick.toFixed(1) + 's'
          : tick.toFixed(2) + 's';
        ctx.fillText(lbl, cx, RHpx * 0.48);
      }

      tick = +(tick + tickIv).toFixed(10);
    }

    // ── Events row ──
    const evRowTopPx = this._eventsRowTopCss() * dpr;
    const evRowHPx   = EVENTS_ROW_H * dpr;
    const events: any[] = this.anim?.events ?? [];

    ctx.fillStyle = '#0e0e18';
    ctx.fillRect(LWpx, evRowTopPx, cPxW, evRowHPx);
    // Bottom border
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(LWpx, evRowTopPx + evRowHPx - 1, cPxW, 1);

    // Gridlines at major ticks
    ctx.fillStyle = '#191926';
    let evGt = 0;
    const evMajorIv = this._tickInterval(pxPerSec / dpr) * 5;
    while (evGt <= this.dur + evMajorIv * 0.4) {
      const cx2 = LWpx + (evGt / this.dur) * cPxW;
      ctx.fillRect(cx2 - 0.5, evRowTopPx, 1, evRowHPx);
      evGt = +(evGt + evMajorIv).toFixed(10);
    }

    // "Events" label
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.font         = `${9 * dpr}px Inter, sans-serif`;
    ctx.fillStyle    = '#6060a0';
    ctx.fillText('Events', 5 * dpr, evRowTopPx + evRowHPx / 2);

    // Draw event flag markers
    events.forEach((ev: any) => {
      const cxPx = LWpx + (ev.time / this.dur) * cPxW;
      const sel  = ev.id === this.selectedEventId;
      this._drawFlag(cxPx, evRowTopPx + evRowHPx * 0.85 * dpr, ev.name, sel);
    });

    // ── Lane rows ──
    const parts = ProjectState.project.parts;

    const ctrlAreaTopPx = (RULER_H + EVENTS_ROW_H) * dpr;
    ctrls.forEach((c: any, i: number) => {
      const rowTopPx = ctrlAreaTopPx + i * ROW_H * dpr;
      const rowHPx   = ROW_H * dpr;

      // Row background
      ctx.fillStyle = i % 2 === 0 ? '#13131b' : '#101018';
      ctx.fillRect(LWpx, rowTopPx, cPxW, rowHPx);

      // Bottom border
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(LWpx, rowTopPx + rowHPx - 1, cPxW, 1);

      // Vertical gridlines at major ticks
      ctx.fillStyle = '#191926';
      let gt = 0;
      while (gt <= this.dur + majorIv * 0.4) {
        const cx = LWpx + (gt / this.dur) * cPxW;
        ctx.fillRect(cx - 0.5, rowTopPx, 1, rowHPx);
        gt = +(gt + majorIv).toFixed(10);
      }

      // Selected lane highlight
      const selectedId = (SelectionState as any).selectedLaneCtrlId;
      if (selectedId === c.id) {
        ctx.fillStyle = 'rgba(76,142,245,0.07)';
        ctx.fillRect(0, rowTopPx, W, rowHPx);
        ctx.fillStyle = 'rgba(76,142,245,0.25)';
        ctx.fillRect(0, rowTopPx, LWpx, rowHPx);
      }

      // Formula mode indicator
      if (c.mode !== 'keyframe') {
        ctx.font      = `italic ${10 * dpr}px Inter, sans-serif`;
        ctx.fillStyle = '#2c2c40';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('~ formula', LWpx + cPxW / 2, rowTopPx + rowHPx / 2);
      }

      // ── Lane labels ──
      const midYpx = rowTopPx + rowHPx / 2;
      const partName = parts.find((p: any) => p.id === c.targetPartId)?.name ?? c.targetPartId;
      const shortName = partName.length > 14 ? partName.slice(0, 13) + '…' : partName;

      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.font         = `${9.5 * dpr}px Inter, sans-serif`;
      ctx.fillStyle    = c.enabled !== false ? '#c0c0cc' : '#444';
      ctx.fillText(shortName, 5 * dpr, midYpx - 5 * dpr);

      ctx.font      = `${8.5 * dpr}px Inter, sans-serif`;
      ctx.fillStyle = c.enabled !== false ? (PROP_COLOR[c.property] ?? '#aaa') : '#333';
      ctx.fillText(c.property, 5 * dpr, midYpx + 5.5 * dpr);
    });

    // ── Keyframe diamonds ──
    const selIds = this._selIds();
    ctrls.forEach((c: any, i: number) => {
      if (c.mode !== 'keyframe') return;
      const kfs: any[] = c.keyframes ?? [];
      const cyCss = this._rowTopCss(i) + ROW_H / 2;
      const cyPx  = cyCss * dpr;

      kfs.forEach((kf: any) => {
        const cxPx  = LWpx + (kf.time / this.dur) * cPxW;
        const sel   = selIds.has(kf.id);
        this._drawDiamond(cxPx, cyPx, D_SIZE * dpr, sel, c.enabled !== false);
      });
    });

    // ── Playhead line ──
    const pxPos = LWpx + (Math.max(0, Math.min(this.dur, this.currentTime)) / this.dur) * cPxW;
    ctx.fillStyle = 'rgba(255,55,55,0.92)';
    ctx.fillRect(pxPos - dpr, 0, 2 * dpr, H);

    // Playhead head triangle
    ctx.fillStyle = '#ff3737';
    ctx.beginPath();
    ctx.moveTo(pxPos - 5.5 * dpr, 0);
    ctx.lineTo(pxPos + 5.5 * dpr, 0);
    ctx.lineTo(pxPos, 10 * dpr);
    ctx.closePath();
    ctx.fill();

    // ── Selection box ──
    if (this.dragMode === 'box' && this.boxStartCss && this.boxCurCss) {
      const x1 = Math.min(this.boxStartCss.x, this.boxCurCss.x) * dpr;
      const y1 = Math.min(this.boxStartCss.y, this.boxCurCss.y) * dpr;
      const bw = Math.abs(this.boxCurCss.x - this.boxStartCss.x) * dpr;
      const bh = Math.abs(this.boxCurCss.y - this.boxStartCss.y) * dpr;

      ctx.strokeStyle = 'rgba(124,106,247,0.9)';
      ctx.lineWidth   = 1 * dpr;
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.strokeRect(x1, y1, bw, bh);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(124,106,247,0.1)';
      ctx.fillRect(x1, y1, bw, bh);
    }

    // ── Label/content separator ──
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(LWpx - 1, 0, 1, H);

    // ── Ruler bottom border ──
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(LWpx, RHpx - 1, cPxW, 1);
  }

  private _drawDiamond(cx: number, cy: number, size: number, selected: boolean, enabled: boolean) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size, cy);
    ctx.closePath();
    if (selected) {
      ctx.fillStyle   = '#ffffff';
      ctx.strokeStyle = '#7c6af7';
      ctx.lineWidth   = 1.5 * this.dpr;
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = enabled ? '#7c6af7' : '#383850';
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Flag drawing ──────────────────────────────────────────────────────────────

  private _drawFlag(cxPx: number, basePx: number, label: string, selected: boolean) {
    const ctx  = this.ctx;
    const dpr  = this.dpr;
    const fw   = FLAG_W * dpr;
    const fh   = FLAG_H * dpr;
    const stem = fh * 0.55;

    ctx.save();
    // Stem
    ctx.strokeStyle = selected ? '#ffe082' : '#a0a0d0';
    ctx.lineWidth   = 1.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(cxPx, basePx);
    ctx.lineTo(cxPx, basePx - stem - fh * 0.45);
    ctx.stroke();

    // Flag rectangle
    ctx.fillStyle = selected ? '#ffe082' : '#7c6af7';
    ctx.beginPath();
    ctx.moveTo(cxPx,      basePx - stem - fh * 0.45);
    ctx.lineTo(cxPx + fw, basePx - stem - fh * 0.45 + fh * 0.22);
    ctx.lineTo(cxPx,      basePx - stem - fh * 0.45 + fh * 0.44);
    ctx.closePath();
    ctx.fill();

    // Label
    ctx.font         = `${7.5 * dpr}px Inter, sans-serif`;
    ctx.fillStyle    = selected ? '#ffe082' : '#b0b0e0';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'bottom';
    const short = label.length > 10 ? label.slice(0, 9) + '…' : label;
    ctx.fillText(short, cxPx + fw + 1.5 * dpr, basePx - stem + 1 * dpr);

    ctx.restore();
  }

  // ── Hit testing ───────────────────────────────────────────────────────────────

  private _hitEvent(cssX: number, cssY: number): any | null {
    if (!this._isEventsRow(cssY)) return null;
    const events: any[] = this.anim?.events ?? [];
    const hitZone = FLAG_W + 4;
    for (const ev of events) {
      const ex = this._timeToX(ev.time);
      if (Math.abs(cssX - ex) <= hitZone) return ev;
    }
    return null;
  }

  private _hitKf(cssX: number, cssY: number): KfHit | null {
    const ctrls   = this._ctrls();
    const hitZone = D_SIZE + 4;
    for (let i = 0; i < ctrls.length; i++) {
      const c = ctrls[i];
      if (c.mode !== 'keyframe') continue;
      const kfs: any[] = c.keyframes ?? [];
      const cy = this._rowTopCss(i) + ROW_H / 2;
      if (Math.abs(cssY - cy) > hitZone) continue;
      for (let ki = 0; ki < kfs.length; ki++) {
        const kx = this._timeToX(kfs[ki].time);
        if (Math.abs(cssX - kx) <= hitZone) {
          return { ctrlIdx: i, kfIdx: ki, kfRef: kfs[ki], ctrl: c };
        }
      }
    }
    return null;
  }

  private _rowAt(cssY: number): number {
    if (cssY < RULER_H) return -1;
    if (cssY < RULER_H + EVENTS_ROW_H) return -2;
    return Math.floor((cssY - RULER_H - EVENTS_ROW_H) / ROW_H);
  }

  // ── Pointer events ────────────────────────────────────────────────────────────

  private onPointerDown(e: PointerEvent) {
    const { x, y } = this._cssFromEvent(e);

    // ── Ruler click → playhead scrub ──
    if (y <= RULER_H && x >= LABEL_W) {
      this.dragMode = 'playhead';
      this.canvas.setPointerCapture(e.pointerId);
      PlaybackState.playing = false;
      PlaybackState.time    = this._xToTime(x);
      this.onUpdate(true, true);
      return;
    }

    // ── Events row ──
    if (this._isEventsRow(y) && x >= LABEL_W) {
      this._removePopup();
      const hitEv = this._hitEvent(x, y);

      if (hitEv) {
        // Double-click on marker → open popup editor
        if (e.detail === 2) {
          this.selectedEventId = hitEv.id;
          this._needsDraw      = true;
          this._showEventPopup(hitEv, x, y);
          return;
        }
        // Single click → select + start drag
        this.selectedEventId  = hitEv.id;
        this.dragMode         = 'event';
        this.dragEventRef     = hitEv;
        this.canvas.setPointerCapture(e.pointerId);
        this._needsDraw = true;
        return;
      }

      // No hit — single click on empty area → add event
      if (e.detail !== 2 && this.anim) {
        const evTime = +(this._xToTime(x)).toFixed(3);
        if (!this.anim.events) this.anim.events = [];
        const newEv: any = {
          id:   'ev-' + Math.random().toString(36).slice(2, 11),
          time: evTime,
          name: 'event',
        };
        this.anim.events.push(newEv);
        this.anim.events.sort((a: any, b: any) => a.time - b.time);
        this.selectedEventId = newEv.id;
        DirtyState.markDirty();
        this._needsDraw = true;
        this._showEventPopup(newEv, x, y);
        this.onUpdate(false, false);
      }
      return;
    }

    // ── Label column click → lane select only ──
    if (x < LABEL_W) {
      const row    = this._rowAt(y);
      const ctrls  = this._ctrls();
      if (row >= 0 && row < ctrls.length) {
        (SelectionState as any).selectedLaneCtrlId = ctrls[row].id;
        this._needsDraw = true;
      }
      return;
    }

    // ── Hit-test keyframes ──
    const hit = this._hitKf(x, y);
    if (hit) {
      const kfId   = hit.kfRef.id as string;
      const selSet = this._selIds();
      if (e.shiftKey) {
        if (selSet.has(kfId)) selSet.delete(kfId);
        else selSet.add(kfId);
      } else if (!selSet.has(kfId)) {
        selSet.clear();
        selSet.add(kfId);
      }
      this.dragMode       = 'kf';
      this.dragKf         = hit;
      this.dragKfOrigTime = hit.kfRef.time;
      // Snapshot original times of ALL selected kfs by stable ID
      this.dragSelOrigTimes.clear();
      this._selIds().forEach(id => {
        const found = this._findKfById(id);
        if (found) this.dragSelOrigTimes.set(id, { kfRef: found.kfRef, origTime: found.kfRef.time });
      });
      // Ensure the dragged kf is in the map even if not yet in selection
      this.dragSelOrigTimes.set(kfId, { kfRef: hit.kfRef, origTime: hit.kfRef.time });
      this.canvas.setPointerCapture(e.pointerId);
      (SelectionState as any).selectedLaneCtrlId = hit.ctrl.id;
      this._needsDraw = true;
      return;
    }

    // ── Double-click on lane → add keyframe ──
    if (e.detail === 2) {
      const row    = this._rowAt(y);
      const ctrls  = this._ctrls();
      if (row >= 0 && row < ctrls.length) {
        const c = ctrls[row];
        if (c.mode !== 'keyframe') {
          c.mode = 'keyframe';
          if (!c.keyframes || c.keyframes.length === 0) {
            c.keyframes = [0, 0.25, 0.5, 0.75, 1.0].map((f: number) => ({
              id:    genKfId(),
              time:  +(f * this.dur).toFixed(3),
              value: +evaluateController(c, f * this.dur, this.dur).toFixed(3),
              easing: 'easeInOut' as const,
            }));
          }
        }
        if (!c.keyframes) c.keyframes = [];
        const kfTime   = +(this._xToTime(x)).toFixed(3);
        const existing = c.keyframes.findIndex((k: any) => Math.abs(k.time - kfTime) < 0.02);
        if (existing < 0) {
          c.keyframes.push({
            id:    genKfId(),
            time:  kfTime,
            value: +evaluateController(c, kfTime, this.dur).toFixed(3),
            easing: 'easeInOut' as const,
          });
          c.keyframes.sort((a: any, b: any) => a.time - b.time);
          DirtyState.markDirty();
          this.onUpdate();
        }
      }
      return;
    }

    // ── Box-select start ──
    this.dragMode    = 'box';
    this.boxStartCss = { x, y };
    this.boxCurCss   = { x, y };
    if (!e.shiftKey) this._selIds().clear();
    this.canvas.setPointerCapture(e.pointerId);
    this._needsDraw = true;
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.dragMode) return;
    const { x, y } = this._cssFromEvent(e);

    if (this.dragMode === 'playhead') {
      PlaybackState.time = this._xToTime(x);
      this.onUpdate(true, true);
      return;
    }

    if (this.dragMode === 'event' && this.dragEventRef) {
      this.dragEventRef.time = +(Math.max(0, Math.min(this.dur, this._xToTime(x)))).toFixed(3);
      if (this.anim?.events) this.anim.events.sort((a: any, b: any) => a.time - b.time);
      DirtyState.markDirty();
      this._needsDraw = true;
      this.onUpdate(false, false);
      return;
    }

    if (this.dragMode === 'kf' && this.dragKf) {
      const rawTime       = this._xToTime(x);
      const delta         = rawTime - this.dragKfOrigTime;
      const affectedCtrls = new Set<any>();
      const ctrls         = this._ctrls();

      // Apply delta to ALL selected keyframes using snapshotted original times (by stable ID)
      this.dragSelOrigTimes.forEach(({ kfRef, origTime }) => {
        kfRef.time = +(Math.max(0, Math.min(this.dur, origTime + delta))).toFixed(3);
        for (const c of ctrls) {
          if (c.keyframes?.includes(kfRef)) { affectedCtrls.add(c); break; }
        }
      });
      // Re-sort affected controllers (IDs remain stable through sort)
      affectedCtrls.forEach(c => c.keyframes.sort((a: any, b: any) => a.time - b.time));

      DirtyState.markDirty();
      this.onUpdate(true, true);
      return;
    }

    if (this.dragMode === 'box') {
      this.boxCurCss  = { x, y };
      this._needsDraw = true;
      return;
    }
  }

  private onPointerUp(_e: PointerEvent) {
    if (this.dragMode === 'box') {
      this._finalizeBox();
    } else if (this.dragMode === 'kf') {
      // IDs are stable through sort — no rebuild needed
      this.dragSelOrigTimes.clear();
      this.onUpdate(true, false);
    } else if (this.dragMode === 'event') {
      this.dragEventRef = null;
      DirtyState.markDirty();
      this.onUpdate(false, false);
    }

    this.dragMode    = null;
    this.dragKf      = null;
    this.boxStartCss = null;
    this.boxCurCss   = null;
    this._needsDraw  = true;
  }

  private _finalizeBox() {
    if (!this.boxStartCss || !this.boxCurCss) return;
    const x1 = Math.min(this.boxStartCss.x, this.boxCurCss.x);
    const x2 = Math.max(this.boxStartCss.x, this.boxCurCss.x);
    const y1 = Math.min(this.boxStartCss.y, this.boxCurCss.y);
    const y2 = Math.max(this.boxStartCss.y, this.boxCurCss.y);

    const ctrls  = this._ctrls();
    const selSet = this._selIds();
    ctrls.forEach((c: any, i: number) => {
      if (c.mode !== 'keyframe') return;
      const cy = this._rowTopCss(i) + ROW_H / 2;
      if (cy < y1 || cy > y2) return;
      const kfs: any[] = c.keyframes ?? [];
      kfs.forEach((kf: any) => {
        const kx = this._timeToX(kf.time);
        if (kx >= x1 && kx <= x2) selSet.add(kf.id);
      });
    });
    this._needsDraw = true;
  }

  private onContextMenu(e: MouseEvent) {
    e.preventDefault();
    const { x, y } = this._cssFromEvent(e);

    // Right-click on event marker → delete it
    const hitEv = this._hitEvent(x, y);
    if (hitEv && this.anim?.events) {
      this._removePopup();
      this.anim.events = this.anim.events.filter((ev: any) => ev.id !== hitEv.id);
      if (this.selectedEventId === hitEv.id) this.selectedEventId = null;
      DirtyState.markDirty();
      this.onUpdate();
      return;
    }

    const hit = this._hitKf(x, y);
    if (hit && hit.ctrl.keyframes) {
      const deletedId = hit.kfRef.id as string;
      hit.ctrl.keyframes.splice(hit.kfIdx, 1);
      // Remove deleted kf from selection (IDs are stable — no reindexing needed)
      this._selIds().delete(deletedId);
      DirtyState.markDirty();
      this.onUpdate();
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    // Delete selected event
    if (this.selectedEventId && this.anim?.events) {
      this._removePopup();
      this.anim.events = this.anim.events.filter((ev: any) => ev.id !== this.selectedEventId);
      this.selectedEventId = null;
      DirtyState.markDirty();
      this._needsDraw = true;
      this.onUpdate();
      return;
    }

    const selIds = this._selIds();
    if (selIds.size === 0) return;

    // Delete all keyframes whose ID is in the selection set
    const ctrls = this._ctrls();
    ctrls.forEach((c: any) => {
      if (!c?.keyframes) return;
      c.keyframes = c.keyframes.filter((kf: any) => !selIds.has(kf.id));
    });

    selIds.clear();
    DirtyState.markDirty();
    this.onUpdate();
  }

  // ── Event popup ───────────────────────────────────────────────────────────────

  private _showEventPopup(ev: any, cssX: number, cssY: number) {
    this._removePopup();

    const popup = document.createElement('div');
    popup.className = 'ds-event-popup';
    popup.style.cssText = `
      position: absolute;
      left: ${Math.max(4, cssX - 10)}px;
      top: ${cssY + 8}px;
      background: #1a1a28;
      border: 1px solid #3a3a5a;
      border-radius: 6px;
      padding: 8px 10px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 190px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
      font-size: 0.72rem;
      color: #c0c0cc;
    `;

    const fieldRow = (label: string, inputEl: HTMLElement) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:6px;';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      lbl.style.cssText = 'min-width:44px; color:#7070a0; font-size:0.68rem;';
      row.appendChild(lbl);
      row.appendChild(inputEl);
      return row;
    };

    const inputStyle = 'flex:1; padding:2px 5px; background:rgba(0,0,0,0.35); border:1px solid #3a3a5a; color:#c0c0e8; border-radius:4px; font-size:0.7rem;';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = ev.name;
    nameInput.placeholder = 'event name';
    nameInput.style.cssText = inputStyle;

    const strInput = document.createElement('input');
    strInput.type = 'text';
    strInput.value = ev.stringValue ?? '';
    strInput.placeholder = 'string (optional)';
    strInput.style.cssText = inputStyle;

    const intInput = document.createElement('input');
    intInput.type = 'number';
    intInput.value = ev.intValue ?? '';
    intInput.placeholder = 'int (optional)';
    intInput.style.cssText = inputStyle + ' width:70px;';

    const floatInput = document.createElement('input');
    floatInput.type = 'number';
    floatInput.value = ev.floatValue ?? '';
    floatInput.placeholder = 'float (optional)';
    floatInput.style.cssText = inputStyle + ' width:70px;';

    const commitChanges = () => {
      ev.name = nameInput.value.trim() || 'event';
      if (strInput.value.trim()) ev.stringValue = strInput.value;
      else delete ev.stringValue;
      const iv = parseInt(intInput.value, 10);
      if (!isNaN(iv)) ev.intValue = iv; else delete ev.intValue;
      const fv = parseFloat(floatInput.value);
      if (!isNaN(fv)) ev.floatValue = fv; else delete ev.floatValue;
      DirtyState.markDirty();
      this._needsDraw = true;
      this.onUpdate(false, false);
    };

    const closeRow = document.createElement('div');
    closeRow.style.cssText = 'display:flex; justify-content:flex-end; margin-top:2px;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Done';
    closeBtn.style.cssText = 'padding:2px 10px; background:rgba(124,106,247,0.2); border:1px solid rgba(124,106,247,0.5); color:#a090ef; border-radius:4px; cursor:pointer; font-size:0.68rem;';
    closeBtn.onclick = () => { commitChanges(); this._removePopup(); };
    closeRow.appendChild(closeBtn);

    [nameInput, strInput, intInput, floatInput].forEach(inp => {
      inp.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { commitChanges(); this._removePopup(); }
        if (e.key === 'Escape') this._removePopup();
      };
      inp.onchange = commitChanges;
    });

    popup.appendChild(fieldRow('Name', nameInput));
    popup.appendChild(fieldRow('String', strInput));
    popup.appendChild(fieldRow('Int', intInput));
    popup.appendChild(fieldRow('Float', floatInput));
    popup.appendChild(closeRow);

    this.wrapper.style.position = 'relative';
    this.wrapper.appendChild(popup);
    this._popupEl = popup;
    nameInput.focus();
    nameInput.select();
  }

  private _removePopup() {
    if (this._popupEl) {
      this._popupEl.remove();
      this._popupEl = null;
    }
  }
}
