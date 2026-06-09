import { DirtyState } from '../../state/dirtyState';

// ── Preset definitions ────────────────────────────────────────────────────────
interface PresetDef {
  id:    string;
  label: string;
  cp1:   { x: number; y: number } | null;
  cp2:   { x: number; y: number } | null;
}

const PRESETS: PresetDef[] = [
  { id: 'flat',      label: 'Flat',        cp1: { x: 0.33, y: 0    }, cp2: { x: 0.67, y: 1    } },
  { id: 'linear',    label: 'Linear',      cp1: { x: 0.33, y: 0.33 }, cp2: { x: 0.67, y: 0.67 } },
  { id: 'easein',    label: 'Ease In',     cp1: { x: 0.42, y: 0    }, cp2: { x: 1,    y: 1    } },
  { id: 'easeout',   label: 'Ease Out',    cp1: { x: 0,    y: 0    }, cp2: { x: 0.58, y: 1    } },
  { id: 'easeinout', label: 'Ease In-Out', cp1: { x: 0.42, y: 0    }, cp2: { x: 0.58, y: 1    } },
  { id: 'spring',    label: 'Spring',      cp1: null,                  cp2: null                  },
  { id: 'step',      label: 'Step',        cp1: null,                  cp2: null                  },
];

// ── Canvas constants ──────────────────────────────────────────────────────────
const PAD      = 32;   // CSS px padding inside canvas
const H_CSS    = 170;  // canvas CSS height
const HANDLE_R = 6;    // handle circle radius in CSS px

// ── Spring curve helper (matches evaluateController) ─────────────────────────
function springY(t: number): number {
  return t + Math.sin(t * Math.PI * 3) * Math.exp(-t * 4) * 0.15;
}

// ── Get display control points for any easing mode ───────────────────────────
function displayCp(kf: any): { cp1: { x: number; y: number }; cp2: { x: number; y: number } } {
  if (kf.easing === 'bezier' && kf.tangentOut && kf.tangentIn) {
    return { cp1: kf.tangentOut, cp2: kf.tangentIn };
  }
  if (kf.easing === 'easeInOut') return { cp1: { x: 0.42, y: 0 }, cp2: { x: 0.58, y: 1 } };
  return { cp1: { x: 0.33, y: 0.33 }, cp2: { x: 0.67, y: 0.67 } }; // linear fallback
}

// ─────────────────────────────────────────────────────────────────────────────

export class CurveEditorPanel {
  public wrapper: HTMLDivElement;

  private canvas!: HTMLCanvasElement;
  private ctx!:    CanvasRenderingContext2D;
  private dpr:     number;
  private onUpdate: (skipInsp?: boolean, skipTl?: boolean) => void;

  private kf: any = null;

  private dragging: 'cp1' | 'cp2' | null = null;

  private _boundDown: (e: PointerEvent) => void;
  private _boundMove: (e: PointerEvent) => void;
  private _boundUp:   () => void;

  constructor(
    mountEl:  HTMLElement,
    onUpdate: (skipInsp?: boolean, skipTl?: boolean) => void,
  ) {
    this.onUpdate = onUpdate;
    this.dpr      = window.devicePixelRatio || 1;

    this.wrapper          = document.createElement('div');
    this.wrapper.className = 'curve-editor-wrapper';
    mountEl.appendChild(this.wrapper);

    this._buildDOM();

    this._boundDown = (e) => this._onPDown(e);
    this._boundMove = (e) => this._onPMove(e);
    this._boundUp   = ()  => this._onPUp();

    this.canvas.addEventListener('pointerdown', this._boundDown);
    window.addEventListener('pointermove', this._boundMove);
    window.addEventListener('pointerup',   this._boundUp);
  }

  private _buildDOM() {
    // Title row
    const titleRow = document.createElement('div');
    titleRow.className = 'curve-editor-title';
    titleRow.innerHTML = '<span>Curve Editor</span>';
    this.wrapper.appendChild(titleRow);

    // Preset strip
    const strip = document.createElement('div');
    strip.className = 'curve-presets';
    strip.innerHTML = PRESETS.map(p =>
      `<button class="curve-preset-btn" data-pid="${p.id}">${p.label}</button>`
    ).join('');
    this.wrapper.appendChild(strip);

    strip.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-pid]') as HTMLElement | null;
      if (btn) this._applyPreset(btn.getAttribute('data-pid')!);
    });

    // Canvas
    this.canvas          = document.createElement('canvas');
    this.canvas.className = 'curve-editor-canvas';
    this.wrapper.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('CurveEditorPanel: no 2d context');
    this.ctx = ctx;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setKeyframes(kf: any, nextKf: any | null) {  // eslint-disable-line @typescript-eslint/no-unused-vars
    this.kf     = kf;
    void nextKf; // stored for future multi-kf work; not used in single-kf editor
    this._resize();
    this.draw();
    this._syncPresetBtns();
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._boundDown);
    window.removeEventListener('pointermove', this._boundMove);
    window.removeEventListener('pointerup',   this._boundUp);
    this.wrapper.remove();
  }

  // ── Coordinate transforms ──────────────────────────────────────────────────

  private _cssW(): number { return this.canvas.width / this.dpr; }

  private _toCx(nx: number): number { return (PAD + nx * (this._cssW() - 2 * PAD)) * this.dpr; }
  private _toCy(ny: number): number { return (PAD + (1 - ny) * (H_CSS - 2 * PAD)) * this.dpr; }

  private _toNx(cssX: number): number { return (cssX - PAD) / (this._cssW() - 2 * PAD); }
  private _toNy(cssY: number): number { return 1 - (cssY - PAD) / (H_CSS - 2 * PAD); }

  // ── Resize ─────────────────────────────────────────────────────────────────

  private _resize() {
    const w             = (this.wrapper.clientWidth || 320);
    this.canvas.width   = Math.round(w * this.dpr);
    this.canvas.height  = Math.round(H_CSS * this.dpr);
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = H_CSS + 'px';
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  draw() {
    if (!this.kf) return;
    const { ctx, dpr } = this;
    const W = this.canvas.width, H = this.canvas.height;
    const cssW = this._cssW();

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#08080f';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth   = 1;
    for (let i = 0; i <= 4; i++) {
      const cx = this._toCx(i / 4);
      const cy = this._toCy(i / 4);
      ctx.beginPath(); ctx.moveTo(cx, PAD * dpr); ctx.lineTo(cx, (H_CSS - PAD) * dpr); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD * dpr, cy); ctx.lineTo((cssW - PAD) * dpr, cy); ctx.stroke();
    }

    // Linear diagonal reference
    ctx.strokeStyle  = 'rgba(255,255,255,0.1)';
    ctx.lineWidth    = 1;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.moveTo(this._toCx(0), this._toCy(0));
    ctx.lineTo(this._toCx(1), this._toCy(1));
    ctx.stroke();
    ctx.setLineDash([]);

    const easing    = this.kf.easing as string;
    const isBezier  = easing === 'bezier';
    const isSpecial = easing === 'spring' || easing === 'step';
    const { cp1, cp2 } = displayCp(this.kf);

    // Guide lines to handles (show for all except spring/step)
    if (!isSpecial) {
      ctx.lineWidth   = 1 * dpr;
      ctx.setLineDash([3 * dpr, 3 * dpr]);

      ctx.strokeStyle = isBezier ? 'rgba(124,106,247,0.55)' : 'rgba(124,106,247,0.25)';
      ctx.beginPath();
      ctx.moveTo(this._toCx(0),     this._toCy(0));
      ctx.lineTo(this._toCx(cp1.x), this._toCy(cp1.y));
      ctx.stroke();

      ctx.strokeStyle = isBezier ? 'rgba(62,207,142,0.55)' : 'rgba(62,207,142,0.25)';
      ctx.beginPath();
      ctx.moveTo(this._toCx(1),     this._toCy(1));
      ctx.lineTo(this._toCx(cp2.x), this._toCy(cp2.y));
      ctx.stroke();

      ctx.setLineDash([]);
    }

    // Curve
    ctx.strokeStyle = '#4c8ef5';
    ctx.lineWidth   = 2.5 * dpr;
    ctx.beginPath();

    if (easing === 'step') {
      ctx.moveTo(this._toCx(0),       this._toCy(0));
      ctx.lineTo(this._toCx(0.9999),  this._toCy(0));
      ctx.lineTo(this._toCx(0.9999),  this._toCy(1));
      ctx.lineTo(this._toCx(1),       this._toCy(1));
    } else if (easing === 'spring') {
      ctx.moveTo(this._toCx(0), this._toCy(0));
      const STEPS = 80;
      for (let i = 1; i <= STEPS; i++) {
        const tx = i / STEPS;
        const ty = Math.max(-0.2, Math.min(1.25, springY(tx)));
        ctx.lineTo(this._toCx(tx), this._toCy(ty));
      }
    } else {
      ctx.moveTo(this._toCx(0), this._toCy(0));
      ctx.bezierCurveTo(
        this._toCx(cp1.x), this._toCy(cp1.y),
        this._toCx(cp2.x), this._toCy(cp2.y),
        this._toCx(1),     this._toCy(1),
      );
    }
    ctx.stroke();

    // Endpoints
    ctx.fillStyle   = '#ffffff';
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth   = 1 * dpr;
    for (const [nx, ny] of [[0, 0], [1, 1]] as [number, number][]) {
      ctx.beginPath();
      ctx.arc(this._toCx(nx), this._toCy(ny), 4 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Handles (non-special easing only)
    if (!isSpecial) {
      const alpha = isBezier ? 1 : 0.4;

      ctx.globalAlpha = alpha;

      // cp1
      ctx.fillStyle   = this.dragging === 'cp1' ? '#ffffff' : '#7c6af7';
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth   = 1.5 * dpr;
      ctx.beginPath();
      ctx.arc(this._toCx(cp1.x), this._toCy(cp1.y), HANDLE_R * dpr, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      // cp2
      ctx.fillStyle = this.dragging === 'cp2' ? '#ffffff' : '#3ecf8e';
      ctx.beginPath();
      ctx.arc(this._toCx(cp2.x), this._toCy(cp2.y), HANDLE_R * dpr, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      ctx.globalAlpha = 1;

      // Legend labels
      if (isBezier) {
        ctx.fillStyle    = 'rgba(124,106,247,0.8)';
        ctx.font         = `${9 * dpr}px Inter, sans-serif`;
        ctx.textBaseline = 'bottom';
        ctx.textAlign    = 'left';
        ctx.fillText('cp1', this._toCx(cp1.x) / dpr * dpr + 7 * dpr, this._toCy(cp1.y) / dpr * dpr - 4 * dpr);
        ctx.fillStyle = 'rgba(62,207,142,0.8)';
        ctx.fillText('cp2', this._toCx(cp2.x) / dpr * dpr + 7 * dpr, this._toCy(cp2.y) / dpr * dpr - 4 * dpr);
      }
    }

    // Axis labels
    ctx.fillStyle    = 'rgba(255,255,255,0.25)';
    ctx.font         = `${9 * dpr}px Inter, sans-serif`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Value ▲', PAD * dpr, (PAD - 14) * dpr);
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Time ▶', (cssW - PAD) * dpr, (H_CSS - 4) * dpr);
  }

  // ── Pointer interaction ────────────────────────────────────────────────────

  private _hitHandle(cssX: number, cssY: number): 'cp1' | 'cp2' | null {
    if (!this.kf) return null;
    const easing = this.kf.easing as string;
    if (easing === 'spring' || easing === 'step') return null;

    const { cp1, cp2 } = displayCp(this.kf);
    const r = (HANDLE_R + 6);

    if (Math.hypot(cssX - (PAD + cp1.x * (this._cssW() - 2 * PAD)),
                   cssY - (PAD + (1 - cp1.y) * (H_CSS - 2 * PAD))) <= r) return 'cp1';

    if (Math.hypot(cssX - (PAD + cp2.x * (this._cssW() - 2 * PAD)),
                   cssY - (PAD + (1 - cp2.y) * (H_CSS - 2 * PAD))) <= r) return 'cp2';

    return null;
  }

  private _cssPos(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private _onPDown(e: PointerEvent) {
    if (!this.kf) return;
    const { x, y } = this._cssPos(e);
    const hit = this._hitHandle(x, y);
    if (!hit) return;

    // Promote to bezier mode if dragging a non-bezier handle
    if (this.kf.easing !== 'bezier') {
      const { cp1, cp2 } = displayCp(this.kf);
      this.kf.tangentOut = { ...cp1 };
      this.kf.tangentIn  = { ...cp2 };
      this.kf.easing     = 'bezier';
    }

    this.dragging = hit;
    this.canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  private _onPMove(e: PointerEvent) {
    if (!this.dragging || !this.kf) return;
    const { x, y } = this._cssPos(e);
    const nx = Math.max(0, Math.min(1, this._toNx(x)));
    const ny = +this._toNy(y).toFixed(4);

    if (this.dragging === 'cp1') {
      this.kf.tangentOut = { x: nx, y: ny };
    } else {
      this.kf.tangentIn = { x: nx, y: ny };
    }
    DirtyState.markDirty();
    this.draw();
    this._syncPresetBtns();
    this.onUpdate(true, true);
  }

  private _onPUp() {
    if (!this.dragging) return;
    this.dragging = null;
    this.draw();
    this.onUpdate(true, false);
  }

  // ── Presets ────────────────────────────────────────────────────────────────

  private _applyPreset(id: string) {
    if (!this.kf) return;

    if (id === 'spring') {
      this.kf.easing = 'spring';
    } else if (id === 'step') {
      this.kf.easing = 'step';
    } else {
      const p = PRESETS.find(pr => pr.id === id);
      if (!p || !p.cp1 || !p.cp2) return;
      this.kf.easing     = 'bezier';
      this.kf.tangentOut = { ...p.cp1 };
      this.kf.tangentIn  = { ...p.cp2 };
    }

    DirtyState.markDirty();
    this.draw();
    this._syncPresetBtns();
    this.onUpdate(true, true);
  }

  private _syncPresetBtns() {
    this.wrapper.querySelectorAll<HTMLButtonElement>('.curve-preset-btn').forEach(btn => {
      const pid    = btn.getAttribute('data-pid')!;
      let   active = false;
      if (this.kf) {
        if (pid === 'spring') active = this.kf.easing === 'spring';
        else if (pid === 'step') active = this.kf.easing === 'step';
      }
      btn.classList.toggle('active', active);
    });
  }
}
