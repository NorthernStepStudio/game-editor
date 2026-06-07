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
import { solve2BoneIK } from './ikSolver';

export class MotionCanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private lastTime: number = performance.now();

  partsMap = new Map<string, CharacterPart>();
  childrenMap = new Map<string, string[]>();
  rootParts: string[] = [];
  onUpdate?: () => void;
  private latestMatrices = new Map<string, DOMMatrix>();

  private active: boolean = true;
  private zoom: number = 1.0;
  private panX: number = 0;
  private panY: number = 0;
  private isPanning: boolean = false;

  // ── Locomotion preview ────────────────────────────────────────────────────
  private locomotionDir: 'none' | 'left' | 'right' | 'up' | 'down' = 'none';
  private locomotionOffsetX: number = 0;
  private locomotionOffsetY: number = 0;
  private locomotionSpeed: number = 80;
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

  zoomIn()  { this.zoom = Math.min(12,   this.zoom * 1.2); }
  zoomOut() { this.zoom = Math.max(0.05, this.zoom / 1.2); }

  setLocomotion(dir: 'none' | 'left' | 'right' | 'up' | 'down', speed: number = 80) {
    this.locomotionDir   = dir;
    this.locomotionSpeed = speed;
    if (dir === 'none') { this.locomotionOffsetX = 0; this.locomotionOffsetY = 0; }
  }
  getLocomotionDir() { return this.locomotionDir; }

  resetView() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
  }

  /** Public wrappers so other pages (e.g. the rigging workshop) can drive the view. */
  fit() { this.fitAll(); }
  resize() { this.resizeCanvas(); }

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
      // Only the renderer bound to the visible page advances shared playback
      // state, renders, and writes the (shared) zoom badge. Inactive instances
      // (e.g. the rigging-page renderer while the editor is visible) idle so
      // they never double-drive global state.
      if (this.active) {
        this.advance(dt);
        this.render();
        this.updateZoomBadge();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Activate/deactivate this renderer's update loop. */
  setActive(v: boolean) {
    this.active = v;
    if (v) this.lastTime = performance.now();
  }

  private updateZoomBadge() {
    const badge = document.getElementById('zoom-badge');
    if (badge) badge.textContent = Math.round(this.zoom * 100) + '%';
  }

  private advance(dt: number) {
    if (PlaybackState.playing) {
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

    // Locomotion preview — runs independently of playback
    if (this.locomotionDir !== 'none') {
      const sp = this.locomotionSpeed;
      if (this.locomotionDir === 'right') this.locomotionOffsetX += sp * dt;
      if (this.locomotionDir === 'left')  this.locomotionOffsetX -= sp * dt;
      if (this.locomotionDir === 'down')  this.locomotionOffsetY += sp * dt;
      if (this.locomotionDir === 'up')    this.locomotionOffsetY -= sp * dt;
      // Wrap around canvas edges so character re-enters from the opposite side
      const halfW = this.canvas.width  / 2 + 200;
      const halfH = this.canvas.height / 2 + 200;
      if (this.locomotionOffsetX >  halfW) this.locomotionOffsetX = -halfW;
      if (this.locomotionOffsetX < -halfW) this.locomotionOffsetX =  halfW;
      if (this.locomotionOffsetY >  halfH) this.locomotionOffsetY = -halfH;
      if (this.locomotionOffsetY < -halfH) this.locomotionOffsetY =  halfH;
    }
  }

  // ── Transform computation ─────────────────────────────────────────────────

  private computeTransformsAtTime(
    project: CharacterProject,
    anim: any,
    time: number
  ): Map<string, any> {
    const tforms = new Map<string, any>();
    project.parts.forEach((p: any) => {
      tforms.set(p.id, {
        x:        p.baseX       ?? 0,
        y:        p.baseY       ?? 0,
        rotation: p.baseRotation ?? 0,
        scaleX:   p.baseScaleX  ?? 1,
        scaleY:   p.baseScaleY  ?? 1,
        opacity:  p.opacity     ?? 1,
      });
    });

    if (anim) {
      const dur = anim.duration || 1;
      anim.controllers.forEach((c: any) => {
        if (!c.enabled) return;
        const tform = tforms.get(c.targetPartId);
        if (!tform) return;
        const val = evaluateController(c, time, dur);
        const base = tform[c.property] ?? 0;
        let targetVal = base + val;
        if (c.params.min !== c.params.max) {
          targetVal = Math.max(base + c.params.min, Math.min(base + c.params.max, targetVal));
        }
        tform[c.property] = targetVal;
      });
    }

    return tforms;
  }

  private buildMatrices(tforms: Map<string, any>): Map<string, DOMMatrix> {
    const matrices = new Map<string, DOMMatrix>();
    // Flip character horizontally when moving left
    const flipX = this.locomotionDir === 'left' ? -this.zoom : this.zoom;
    const rootMatrix = new DOMMatrix()
      .translate(this.canvas.width / 2 + this.panX + this.locomotionOffsetX,
                 this.canvas.height / 2 + this.panY + this.locomotionOffsetY)
      .scale(flipX, this.zoom);

    const compute = (partId: string, parentMatrix: DOMMatrix) => {
      const part = this.partsMap.get(partId);
      if (!part) return;
      const tform = tforms.get(partId);
      if (!tform) return;
      const effectiveParent = (part.inheritTransform === false) ? rootMatrix : parentMatrix;
      const m = DOMMatrix.fromMatrix(effectiveParent);
      m.translateSelf(tform.x, tform.y);
      m.rotateSelf(tform.rotation);
      m.scaleSelf(tform.scaleX, tform.scaleY);
      matrices.set(partId, m);
      (this.childrenMap.get(partId) || []).forEach(k => compute(k, m));
    };
    this.rootParts.forEach(root => compute(root, rootMatrix));
    return matrices;
  }

  // ── IK solving ────────────────────────────────────────────────────────────

  private applyIK(
    project: CharacterProject,
    tforms: Map<string, any>,
    matrices: Map<string, DOMMatrix>
  ) {
    project.parts.forEach((part: any) => {
      if (!part.ikChain?.targetPartId) return;
      const targetMat = matrices.get(part.ikChain.targetPartId);
      if (!targetMat) return;

      const targetWorldX = targetMat.e;
      const targetWorldY = targetMat.f;

      // Find this part's world matrix
      const rootMat = matrices.get(part.id);
      if (!rootMat) return;

      // Find first child (mid bone)
      const children = this.childrenMap.get(part.id) || [];
      if (children.length === 0) return;
      const midId = children[0];
      const midPart = this.partsMap.get(midId);
      if (!midPart) return;

      // Estimate bone lengths from base positions
      const bone1 = Math.sqrt(
        ((midPart.baseX ?? 0) ** 2) + ((midPart.baseY ?? 0) ** 2)
      ) || 40;

      // Find grandchild (end bone) to estimate bone2 length
      const grandChildren = this.childrenMap.get(midId) || [];
      let bone2 = bone1;
      if (grandChildren.length > 0) {
        const endPart = this.partsMap.get(grandChildren[0]);
        if (endPart) {
          bone2 = Math.sqrt(
            ((endPart.baseX ?? 0) ** 2) + ((endPart.baseY ?? 0) ** 2)
          ) || bone1;
        }
      }

      const rootWorldX = rootMat.e;
      const rootWorldY = rootMat.f;
      const bendDir = part.ikChain.bendDirection ?? 1;

      const result = solve2BoneIK(rootWorldX, rootWorldY, bone1, bone2, targetWorldX, targetWorldY, bendDir);

      // Convert world angle to local rotation for root
      const tform = tforms.get(part.id);
      if (tform) tform.rotation = result.bone1AngleDeg;

      const midTform = tforms.get(midId);
      if (midTform) midTform.rotation = result.bone2AngleDeg;
    });
  }

  // ── Constraint solving ────────────────────────────────────────────────────

  private applyConstraints(
    project: CharacterProject,
    tforms: Map<string, any>,
    matrices: Map<string, DOMMatrix>
  ) {
    project.parts.forEach((part: any) => {
      const con = part.constraint;
      if (!con || !con.targetPartId) return;
      const targetMat = matrices.get(con.targetPartId);
      const selfMat   = matrices.get(part.id);
      if (!targetMat || !selfMat) return;

      const influence = con.influence ?? 1;
      const tform = tforms.get(part.id);
      if (!tform) return;

      if (con.type === 'lookAt') {
        const dx = targetMat.e - selfMat.e;
        const dy = targetMat.f - selfMat.f;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI) + (con.offset ?? 0);
        tform.rotation = tform.rotation + (angle - tform.rotation) * influence;
      }
      else if (con.type === 'copyRotation') {
        // Decompose target's world rotation
        const targetAngle = Math.atan2(targetMat.b, targetMat.a) * (180 / Math.PI);
        const targetRot = targetAngle + (con.offset ?? 0);
        tform.rotation = tform.rotation + (targetRot - tform.rotation) * influence;
      }
      else if (con.type === 'limitRotation') {
        const min = (con as any).min ?? (con.offset ?? -45);
        const max = (con as any).max ?? (con.influence ?? 45);
        tform.rotation = Math.max(min, Math.min(max, tform.rotation));
      }
    });
  }

  // ── Frame animation ───────────────────────────────────────────────────────

  private getFrameSourceRect(part: any, time: number): { x: number; y: number; width: number; height: number } | null {
    const fa = part.frameAnimation;
    if (!fa || !fa.frameCount || !fa.fps || !fa.frameWidth || !fa.frameHeight) return null;
    const frame = Math.floor(time * fa.fps + (fa.startFrame ?? 0)) % fa.frameCount;
    const cols = fa.columns || 1;
    const col = frame % cols;
    const row = Math.floor(frame / cols);
    return {
      x: col * fa.frameWidth,
      y: row * fa.frameHeight,
      width: fa.frameWidth,
      height: fa.frameHeight,
    };
  }

  // ── Onion skins ───────────────────────────────────────────────────────────

  private renderOnionSkin(
    project: CharacterProject,
    anim: any,
    time: number,
    tint: string,
    alpha: number
  ) {
    const dur = anim.duration || 1;
    const clampedTime = anim.loop ? ((time % dur) + dur) % dur : Math.max(0, Math.min(dur, time));
    const tforms = this.computeTransformsAtTime(project, anim, clampedTime);
    const matrices = this.buildMatrices(tforms);

    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'source-over';

    const sortedParts = [...project.parts].sort((a: any, b: any) =>
      (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0)
    );

    sortedParts.forEach((part: any) => {
      if (part.visible === false) return;
      const m = matrices.get(part.id);
      if (!m) return;
      const asset = project.assets?.find((a: any) => a.id === part.imageAssetId);
      const tform = tforms.get(part.id);

      let width = 40, height = 40;
      if (part.renderMode === 'image' && asset) {
        const fa = this.getFrameSourceRect(part, clampedTime);
        width  = (fa || part.sourceRect || asset).width  || asset.width;
        height = (fa || part.sourceRect || asset).height || asset.height;
      } else {
        width  = (part.origin?.x ?? 20) * 2 || 40;
        height = (part.origin?.y ?? 20) * 2 || 40;
      }

      ctx.save();
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
      ctx.globalAlpha = (tform?.opacity ?? 1) * alpha;

      ctx.translate(-(part.origin?.x ?? 0), -(part.origin?.y ?? 0));

      if (part.renderMode === 'image' && part.imageAssetId) {
        const img = imageCache.get(part.imageAssetId);
        if (img && img.complete && img.naturalWidth > 0) {
          const fa = this.getFrameSourceRect(part, clampedTime);
          const src = fa || part.sourceRect;
          // Tint the onion skin
          ctx.fillStyle = tint;
          ctx.fillRect(0, 0, width, height);
          ctx.globalCompositeOperation = 'multiply';
          if (src) {
            ctx.drawImage(img, src.x, src.y, src.width, src.height, 0, 0, width, height);
          } else {
            ctx.drawImage(img, 0, 0, width, height);
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      } else {
        ctx.fillStyle = tint;
        drawShape(ctx, part, width, height);
      }
      ctx.restore();
    });

    ctx.restore();
  }

  // ── Main render ───────────────────────────────────────────────────────────

  private render() {
    const { ctx, canvas } = this;
    const project = ProjectState.project;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (AppState.showGrid) this.drawGrid();

    const anim = project.animations.find((a: any) => a.id === SelectionState.activeAnimId);
    const playbackTime = anim ? getPlaybackTimeForAnimation(anim) : 0;

    // Onion skins (before main frame)
    if ((AppState as any).showOnionSkin && anim) {
      const step = 1 / 24;
      this.renderOnionSkin(project, anim, playbackTime - step * 2, 'rgba(0,120,255,0.5)', 0.15);
      this.renderOnionSkin(project, anim, playbackTime - step,     'rgba(0,120,255,0.5)', 0.25);
      this.renderOnionSkin(project, anim, playbackTime + step,     'rgba(255,50,50,0.5)', 0.15);
    }

    // Main frame
    const tforms = this.computeTransformsAtTime(project, anim, playbackTime);

    // First matrix pass
    let matrices = this.buildMatrices(tforms);

    // IK solving (uses first-pass matrices to get target world pos)
    this.applyIK(project, tforms, matrices);

    // Constraint solving
    this.applyConstraints(project, tforms, matrices);

    // Rebuild matrices after IK + constraints
    matrices = this.buildMatrices(tforms);

    const sortedParts = [...project.parts].sort((a: any, b: any) =>
      (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0)
    );

    // Draw parts
    sortedParts.forEach((part: any) => {
      if (part.visible === false) return;
      const m = matrices.get(part.id);
      if (!m) return;
      const asset = project.assets?.find((a: any) => a.id === part.imageAssetId);
      const tform = tforms.get(part.id);

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

      // Frame animation: compute dynamic sourceRect
      const dynamicSrc = (part.renderMode === 'image' && part.frameAnimation)
        ? this.getFrameSourceRect(part, playbackTime)
        : null;
      const activeSrc = dynamicSrc || part.sourceRect;

      let width = 40, height = 40;
      if (part.renderMode === 'image' && asset) {
        width  = activeSrc ? activeSrc.width  : asset.width;
        height = activeSrc ? activeSrc.height : asset.height;
      } else {
        width  = (part.origin?.x ?? 20) * 2 || 40;
        height = (part.origin?.y ?? 20) * 2 || 40;
      }

      ctx.translate(-(part.origin?.x ?? 0), -(part.origin?.y ?? 0));

      if (part.renderMode === 'image' && part.imageAssetId) {
        const img = imageCache.get(part.imageAssetId);
        if (img && img.complete && img.naturalWidth > 0) {
          if (activeSrc) {
            ctx.drawImage(img, activeSrc.x, activeSrc.y, activeSrc.width, activeSrc.height, 0, 0, width, height);
          } else {
            ctx.drawImage(img, 0, 0, width, height);
          }
        } else {
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

    // Draw IK target indicators
    this.drawIKIndicators(project, matrices);

    // Draw skeleton overlay
    drawSkeleton(ctx, project.parts, matrices);

    // Draw selection overlays
    sortedParts.forEach((part: any) => {
      if (part.visible === false) return;
      const m = matrices.get(part.id);
      if (!m) return;
      const isSelected = part.id === SelectionState.activePartId;
      if (!SelectionState.showDebugBounds && !isSelected) return;

      ctx.save();
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
      const asset = project.assets?.find((a: any) => a.id === part.imageAssetId);
      const dynamicSrc = (part.renderMode === 'image' && part.frameAnimation)
        ? this.getFrameSourceRect(part, playbackTime)
        : null;
      const activeSrc = dynamicSrc || part.sourceRect;
      let w = 40, h = 40;
      if (part.renderMode === 'image' && asset) {
        w = activeSrc ? activeSrc.width  : asset.width;
        h = activeSrc ? activeSrc.height : asset.height;
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

  private drawIKIndicators(project: CharacterProject, matrices: Map<string, DOMMatrix>) {
    const { ctx } = this;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    project.parts.forEach((part: any) => {
      if (!part.ikChain?.targetPartId) return;
      const targetMat = matrices.get(part.ikChain.targetPartId);
      if (!targetMat) return;
      // Draw IK target as a diamond
      const tx = targetMat.e;
      const ty = targetMat.f;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = 'rgba(255, 160, 0, 0.85)';
      ctx.fillStyle   = 'rgba(255, 160, 0, 0.15)';
      ctx.lineWidth = 1.5;
      const s = 7;
      ctx.fillRect(-s/2, -s/2, s, s);
      ctx.strokeRect(-s/2, -s/2, s, s);
      ctx.restore();

      // Draw line from root to target
      const rootMat = matrices.get(part.id);
      if (rootMat) {
        ctx.strokeStyle = 'rgba(255, 160, 0, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(rootMat.e, rootMat.f);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    ctx.restore();
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
    const el = document.getElementById('tl-time-display');
    if (el) el.textContent = `${t.toFixed(2)}s / ${dur.toFixed(2)}s`;
  }

  // ── Interaction ───────────────────────────────────────────────────────────

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
      if (this.onUpdate) (this.onUpdate as any)(true, false);
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

    // IK target indicators: check orange diamond hit area first
    for (const part of project.parts) {
      const ik = (part as any).ikChain;
      if (!ik?.targetPartId) continue;
      const targetMat = this.latestMatrices.get(ik.targetPartId);
      if (!targetMat) continue;
      const dx = mx - targetMat.e;
      const dy = my - targetMat.f;
      if (Math.sqrt(dx * dx + dy * dy) <= 14) {
        const targetPart = project.parts.find((p: any) => p.id === ik.targetPartId);
        if (targetPart && !targetPart.locked) return targetPart;
      }
    }

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
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); this.fitAll(); }
    });
  }

  private fitAll() {
    // Fit all parts in view
    const project = ProjectState.project;
    if (project.parts.length === 0) { this.resetView(); return; }
    const matrices = this.latestMatrices;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    project.parts.forEach((p: any) => {
      const m = matrices.get(p.id);
      if (m) {
        minX = Math.min(minX, m.e);
        maxX = Math.max(maxX, m.e);
        minY = Math.min(minY, m.f);
        maxY = Math.max(maxY, m.f);
      }
    });
    if (!isFinite(minX)) { this.resetView(); return; }
    const pw = this.canvas.width, ph = this.canvas.height;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    this.panX += pw / 2 - cx;
    this.panY += ph / 2 - cy;
  }
}
