import { CharacterProject, CharacterPart } from '../../../../../packages/nstep-motion-core/src/schema/types';
import { evaluateController } from '../../../../../packages/nstep-motion-core/src/runtime/evaluateController';
import { ProjectState } from '../../state/projectState';
import { SelectionState } from '../../state/selectionState';
import { PlaybackState, getPlaybackTimeForAnimation } from '../../state/playbackState';
import { DirtyState } from '../../state/dirtyState';
import { AppState } from '../../state/appState';
import { imageCache } from './imageCache';
import { drawShape } from './shapeRenderer';
import { drawPartOverlays, drawSkeleton } from './motionOverlays';

export class MotionCanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private lastTime: number = performance.now();

  partsMap = new Map<string, CharacterPart>();
  childrenMap = new Map<string, string[]>();
  rootParts: string[] = [];
  onUpdate?: () => void;
  private latestMatrices = new Map<string, DOMMatrix>();

  private zoom: number = 1.0;
  private panX: number = 0;
  private panY: number = 0;
  private isPanning: boolean = false;
  private startPanX: number = 0;
  private startPanY: number = 0;
  private startMouseX: number = 0;
  private startMouseY: number = 0;

  private isDraggingPart: boolean = false;
  private dragStartPartX: number = 0;
  private dragStartPartY: number = 0;
  private dragStartMouseX: number = 0;
  private dragStartMouseY: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.startLoop();
    this.setupInteraction();
    this.setupViewportGestures();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas() {
    const container = this.canvas.parentElement;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  getZoom() { return this.zoom; }

  resetView() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
  }

  rebuildTree(project: CharacterProject) {
    this.partsMap.clear();
    this.childrenMap.clear();
    this.rootParts = [];
    project.parts.forEach(p => {
      this.partsMap.set(p.id, p);
      if (!p.parentId) {
        this.rootParts.push(p.id);
      } else {
        if (!this.childrenMap.has(p.parentId)) this.childrenMap.set(p.parentId, []);
        this.childrenMap.get(p.parentId)!.push(p.id);
      }
    });
  }

  private startLoop() {
    const loop = (now: number) => {
      const dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      this.update(dt);
      this.render();
      this.updateZoomBadge();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private updateZoomBadge() {
    const badge = document.getElementById('zoom-badge');
    if (badge) badge.textContent = Math.round(this.zoom * 100) + '%';
  }

  private update(dt: number) {
    if (!PlaybackState.playing) return;
    const anim = ProjectState.project.animations.find((a: any) => a.id === SelectionState.activeAnimId);
    if (anim) {
      PlaybackState.time += dt * PlaybackState.speedMult;
      const dur = anim.duration || 1;
      if (anim.loop) {
        if (PlaybackState.time > dur) PlaybackState.time = PlaybackState.time % dur;
      } else if (PlaybackState.time > dur) {
        PlaybackState.time = dur;
        PlaybackState.playing = false;
      }
    }
  }

  private render() {
    const { ctx, canvas } = this;
    const project = ProjectState.project;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (AppState.showGrid) this.drawGrid();

    const currentTransforms = new Map<string, any>();
    project.parts.forEach((p: any) => {
      currentTransforms.set(p.id, {
        x: p.baseX ?? 0,
        y: p.baseY ?? 0,
        rotation: p.baseRotation ?? 0,
        scaleX: p.baseScaleX ?? 1,
        scaleY: p.baseScaleY ?? 1,
        opacity: p.opacity ?? 1,
      });
    });

    const anim = project.animations.find((a: any) => a.id === SelectionState.activeAnimId);
    if (anim) {
      const animDur = anim.duration || 1;
      const playbackTime = getPlaybackTimeForAnimation(anim);
      anim.controllers.forEach((c: any) => {
        if (!c.enabled) return;
        const tform = currentTransforms.get(c.targetPartId);
        if (!tform) return;
        const val = evaluateController(c, playbackTime, animDur);
        const p = c.params;
        let base = tform[c.property] ?? 0;
        let targetVal = base + val;
        if (p.min !== p.max) {
          targetVal = Math.max(base + p.min, Math.min(base + p.max, targetVal));
        }
        tform[c.property] = targetVal;
      });
    }

    const matrices = new Map<string, DOMMatrix>();
    const rootMatrix = new DOMMatrix()
      .translate(canvas.width / 2 + this.panX, canvas.height / 2 + this.panY)
      .scale(this.zoom, this.zoom);

    const computeMatrix = (partId: string, parentMatrix: DOMMatrix) => {
      const part = this.partsMap.get(partId);
      if (!part) return;
      const tform = currentTransforms.get(partId);
      const effectiveParent = (part.inheritTransform === false) ? rootMatrix : parentMatrix;
      const m = DOMMatrix.fromMatrix(effectiveParent);
      m.translateSelf(tform.x, tform.y);
      m.rotateSelf(tform.rotation);
      m.scaleSelf(tform.scaleX, tform.scaleY);
      matrices.set(partId, m);
      (this.childrenMap.get(partId) || []).forEach(k => computeMatrix(k, m));
    };
    this.rootParts.forEach(root => computeMatrix(root, rootMatrix));

    const sortedParts = [...project.parts].sort((a: any, b: any) =>
      (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0)
    );

    // 1. Draw parts
    sortedParts.forEach((part: any) => {
      if (part.visible === false) return;
      const m = matrices.get(part.id);
      if (!m) return;
      const asset = project.assets?.find((a: any) => a.id === part.imageAssetId);
      const tform = currentTransforms.get(part.id);

      ctx.save();
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
      ctx.imageSmoothingEnabled = project.renderQuality !== 'pixel';
      if (ctx.imageSmoothingEnabled) ctx.imageSmoothingQuality = 'high';

      const isSelected = part.id === SelectionState.activePartId;
      if (!isSelected) {
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;
      }

      const opacity = tform?.opacity ?? (part.opacity ?? 1);
      ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

      if (part.flipX || part.flipY) ctx.scale(part.flipX ? -1 : 1, part.flipY ? -1 : 1);

      let width = 40, height = 40;
      if (part.renderMode === 'image' && asset) {
        width  = part.sourceRect ? part.sourceRect.width  : asset.width;
        height = part.sourceRect ? part.sourceRect.height : asset.height;
      } else {
        width  = (part.origin?.x ?? 20) * 2 || 40;
        height = (part.origin?.y ?? 20) * 2 || 40;
      }

      ctx.translate(-(part.origin?.x ?? 0), -(part.origin?.y ?? 0));

      if (part.renderMode === 'image' && part.imageAssetId) {
        const img = imageCache.get(part.imageAssetId);
        if (img && img.complete && img.naturalWidth > 0) {
          if (part.sourceRect) {
            ctx.drawImage(img,
              part.sourceRect.x, part.sourceRect.y,
              part.sourceRect.width, part.sourceRect.height,
              0, 0, width, height
            );
          } else {
            ctx.drawImage(img, 0, 0, width, height);
          }
        } else {
          // Placeholder while image loads
          ctx.fillStyle = 'rgba(76,142,245,0.12)';
          ctx.strokeStyle = 'rgba(76,142,245,0.3)';
          ctx.lineWidth = 1;
          ctx.fillRect(0, 0, width, height);
          ctx.strokeRect(0, 0, width, height);
          ctx.fillStyle = 'rgba(76,142,245,0.5)';
          ctx.font = '10px Inter';
          ctx.textAlign = 'center';
          ctx.fillText('Loading…', width / 2, height / 2 + 4);
        }
      } else {
        ctx.fillStyle = part.color || '#4c8ef5';
        drawShape(ctx, part, width, height);
      }

      ctx.restore();
    });

    // 2. Skeleton overlay
    drawSkeleton(ctx, project.parts, matrices);

    // 3. Selection overlays
    sortedParts.forEach((part: any) => {
      if (part.visible === false) return;
      const m = matrices.get(part.id);
      if (!m) return;
      const isSelected = part.id === SelectionState.activePartId;
      if (!SelectionState.showDebugBounds && !isSelected) return;

      ctx.save();
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
      const asset = project.assets?.find((a: any) => a.id === part.imageAssetId);
      let w = 40, h = 40;
      if (part.renderMode === 'image' && asset) {
        w = part.sourceRect ? part.sourceRect.width  : asset.width;
        h = part.sourceRect ? part.sourceRect.height : asset.height;
      } else {
        w = (part.origin?.x ?? 20) * 2 || 40;
        h = (part.origin?.y ?? 20) * 2 || 40;
      }
      ctx.translate(-(part.origin?.x ?? 0), -(part.origin?.y ?? 0));
      drawPartOverlays(ctx, part, w, h, isSelected);
      ctx.restore();
    });

    this.latestMatrices = matrices;
    this.syncPlaybackReadout(anim);
  }

  private drawGrid() {
    const { ctx, canvas } = this;
    const gridSize = 40 * this.zoom;
    if (gridSize < 4) return;
    const offsetX = ((canvas.width / 2 + this.panX) % gridSize + gridSize) % gridSize;
    const offsetY = ((canvas.height / 2 + this.panY) % gridSize + gridSize) % gridSize;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;

    for (let x = offsetX - gridSize; x <= canvas.width + gridSize; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = offsetY - gridSize; y <= canvas.height + gridSize; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Center crosshair
    const cx = canvas.width / 2 + this.panX;
    const cy = canvas.height / 2 + this.panY;
    ctx.strokeStyle = 'rgba(76,142,245,0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height);
    ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Origin dot
    ctx.fillStyle = 'rgba(76,142,245,0.5)';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private syncPlaybackReadout(anim: any) {
    if (!anim) return;
    const dur = anim.duration || 1;
    const t = getPlaybackTimeForAnimation(anim);
    const readout = `${t.toFixed(2)}s / ${dur.toFixed(2)}s`;
    const el = document.getElementById('tl-time-display');
    if (el) el.textContent = readout;
  }

  private setupInteraction() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || this.isPanning) return;
      const { mx, my } = this.getMouse(e);
      const project = ProjectState.project;
      const activePart = project.parts.find((p: any) => p.id === SelectionState.activePartId);

      if (SelectionState.isEditingPivot && activePart && !activePart.locked) {
        const m = this.latestMatrices.get(activePart.id);
        if (m) {
          try {
            const inv = m.inverse();
            const lp = inv.transformPoint(new DOMPoint(mx, my));
            activePart.origin.x = (activePart.origin?.x ?? 0) + lp.x;
            activePart.origin.y = (activePart.origin?.y ?? 0) + lp.y;
            activePart.baseX = (activePart.baseX ?? 0) + lp.x;
            activePart.baseY = (activePart.baseY ?? 0) + lp.y;
            SelectionState.isEditingPivot = false;
            DirtyState.markDirty();
            if (this.onUpdate) this.onUpdate();
          } catch {}
        }
        return;
      }

      const picked = this.pickPart(mx, my);
      const prevId = SelectionState.activePartId;
      SelectionState.activePartId = picked ? picked.id : null;

      if (picked && !picked.locked) {
        this.isDraggingPart = true;
        this.dragStartPartX = picked.baseX ?? 0;
        this.dragStartPartY = picked.baseY ?? 0;
        this.dragStartMouseX = mx;
        this.dragStartMouseY = my;
        this.canvas.style.cursor = 'move';
      }

      if (picked?.id !== prevId && this.onUpdate) this.onUpdate();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDraggingPart) return;
      const part = ProjectState.project.parts.find((p: any) => p.id === SelectionState.activePartId);
      if (!part || part.locked) return;
      const { mx, my } = this.getMouse(e);
      const dx = (mx - this.dragStartMouseX) / this.zoom;
      const dy = (my - this.dragStartMouseY) / this.zoom;
      part.baseX = this.dragStartPartX + dx;
      part.baseY = this.dragStartPartY + dy;
      DirtyState.markDirty();
      if (this.onUpdate) this.onUpdate(true, false);
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.isDraggingPart) {
        this.isDraggingPart = false;
        this.canvas.style.cursor = '';
      }
    });
  }

  private getMouse(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { mx: e.clientX - r.left, my: e.clientY - r.top };
  }

  private pickPart(mx: number, my: number): CharacterPart | null {
    const project = ProjectState.project;
    const sorted = [...project.parts].sort(
      (a: any, b: any) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0)
    );
    for (const part of sorted) {
      if (part.visible === false || part.locked === true) continue;
      const m = this.latestMatrices.get(part.id);
      if (!m) continue;
      try {
        const inv = m.inverse();
        const lp = inv.transformPoint(new DOMPoint(mx, my));
        const lx = lp.x, ly = lp.y;
        const asset = project.assets?.find((a: any) => a.id === part.imageAssetId);
        let w = 40, h = 40;
        if (part.renderMode === 'image' && asset) {
          w = part.sourceRect ? part.sourceRect.width  : asset.width;
          h = part.sourceRect ? part.sourceRect.height : asset.height;
        } else {
          w = (part.origin?.x ?? 20) * 2 || 40;
          h = (part.origin?.y ?? 20) * 2 || 40;
        }
        const ox = part.origin?.x ?? 0;
        const oy = part.origin?.y ?? 0;
        if (lx >= -ox && lx <= -ox + w && ly >= -oy && ly <= -oy + h) return part;
      } catch {}
    }
    return null;
  }

  private setupViewportGestures() {
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = this.canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const delta = e.deltaY < 0 ? 1 : -1;
      const factor = e.ctrlKey ? 0.04 : 0.1;
      const nextZoom = Math.min(Math.max(0.05, this.zoom + delta * factor * this.zoom), 12);
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;
      this.panX = mx - cx - ((mx - cx - this.panX) / this.zoom) * nextZoom;
      this.panY = my - cy - ((my - cy - this.panY) / this.zoom) * nextZoom;
      this.zoom = nextZoom;
    }, { passive: false });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        this.isPanning = true;
        this.startPanX = this.panX;
        this.startPanY = this.panY;
        this.startMouseX = e.clientX;
        this.startMouseY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.panX = this.startPanX + (e.clientX - this.startMouseX);
        this.panY = this.startPanY + (e.clientY - this.startMouseY);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isPanning && (e.button === 1 || e.button === 2 || e.button === 0)) {
        this.isPanning = false;
        if (!this.isDraggingPart) this.canvas.style.cursor = '';
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); this.zoom = Math.min(12, this.zoom * 1.12); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); this.zoom = Math.max(0.05, this.zoom * 0.9); }
      else if (e.key === '0') { e.preventDefault(); this.resetView(); }
    });
  }
}
