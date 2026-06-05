import { CharacterProject, CharacterPart } from '../../../../../packages/nstep-motion-core/src/schema/types';
import { evaluateController } from '../../../../../packages/nstep-motion-core/src/runtime/evaluateController';
import { ProjectState } from '../../state/projectState';
import { SelectionState } from '../../state/selectionState';
import { PlaybackState, getPlaybackTimeForAnimation } from '../../state/playbackState';
import { DirtyState } from '../../state/dirtyState';
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

  // Viewport Zoom & Pan
  private zoom: number = 1.0;
  private panX: number = 0;
  private panY: number = 0;
  private isPanning: boolean = false;
  private startPanX: number = 0;
  private startPanY: number = 0;
  private startMouseX: number = 0;
  private startMouseY: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.startLoop();
    this.setupInteraction();
    this.setupViewportGestures();
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
      this.syncPlaybackReadout();
      this.render();
      
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private update(dt: number) {
    if (!PlaybackState.playing) return;
    
    const anim = ProjectState.project.animations.find((a: any) => a.id === SelectionState.activeAnimId);
    if (anim) {
      PlaybackState.time += dt * PlaybackState.speedMult;
      const dur = anim.duration || 1;
      if (anim.loop) {
        // Continuous loop
      } else if (PlaybackState.time > dur) {
        PlaybackState.time = dur;
      }
    }
  }

  private render() {
    const { ctx, canvas } = this;
    const project = ProjectState.project;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const currentTransforms = new Map();
    project.parts.forEach((p: any) => {
      currentTransforms.set(p.id, { 
        x: p.baseX, 
        y: p.baseY, 
        rotation: p.baseRotation, 
        scaleX: p.baseScaleX, 
        scaleY: p.baseScaleY 
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
        
        let targetVal = tform[c.property] + val;
        if (p.min !== p.max) {
          targetVal = Math.max(tform[c.property] + p.min, Math.min(tform[c.property] + p.max, targetVal));
        }
        tform[c.property] = targetVal;
        
        // Update debug UI if present
        const dbg = document.getElementById('debug-val-' + c.id);
        if (dbg) dbg.textContent = val.toFixed(2);
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
      
      // If inheritTransform is false, ignore parent matrix and treat it as a root part (relative to canvas center)
      const effectiveParentMatrix = (part.inheritTransform === false) ? rootMatrix : parentMatrix;
      
      const m = DOMMatrix.fromMatrix(effectiveParentMatrix);
      m.translateSelf(tform.x, tform.y);
      m.rotateSelf(tform.rotation);
      m.scaleSelf(tform.scaleX, tform.scaleY);
      matrices.set(partId, m);
      const kids = this.childrenMap.get(partId) || [];
      kids.forEach(k => computeMatrix(k, m));
    };

    this.rootParts.forEach(root => computeMatrix(root, rootMatrix));

    // 1. Draw character parts
    const sortedParts = [...project.parts].sort((a: any, b: any) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0));
    sortedParts.forEach((part: any) => {
      if (part.visible === false) return; // Skip rendering hidden parts
      const m = matrices.get(part.id);
      if (!m) return;
      
      const asset = project.assets?.find((a: any) => a.id === part.imageAssetId);
      
      ctx.save();
      ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
      
      // Quality settings
      ctx.imageSmoothingEnabled = project.renderQuality !== 'pixel';
      if (ctx.imageSmoothingEnabled) ctx.imageSmoothingQuality = 'high';
      
      // Professional Polish: Shadow
      const isSelected = part.id === SelectionState.activePartId;
      if (!isSelected) {
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 6;
      }
      
      if (part.opacity !== undefined) ctx.globalAlpha = part.opacity;
      if (part.flipX || part.flipY) ctx.scale(part.flipX ? -1 : 1, part.flipY ? -1 : 1);
      
      let width = 40;
      let height = 40;
      
      if (part.renderMode === 'image' && asset) {
        width = part.sourceRect ? part.sourceRect.width : asset.width;
        height = part.sourceRect ? part.sourceRect.height : asset.height;
      } else if (part.renderMode === 'shape') {
        width = part.origin.x * 2 || 40;
        height = part.origin.y * 2 || 40;
      }

      ctx.translate(-part.origin.x, -part.origin.y);
      
      if (part.renderMode === 'image' && part.imageAssetId) {
         const img = imageCache.get(part.imageAssetId);
         if (img && img.complete) {
            if (part.sourceRect) {
              ctx.drawImage(
                img, 
                part.sourceRect.x, part.sourceRect.y, 
                part.sourceRect.width, part.sourceRect.height,
                0, 0, width, height
              );
            } else {
              ctx.drawImage(img, 0, 0, width, height);
            }
         } else {
           ctx.fillStyle = 'rgba(255, 0, 255, 0.2)';
           ctx.fillRect(0, 0, width, height);
         }
      } else {
         ctx.fillStyle = part.color || '#444';
         drawShape(ctx, part, width, height);
      }
      
      ctx.restore();
    });

    // 2. Draw selection boxes, pivots, and names as an overlay on top of all parts
    sortedParts.forEach((part: any) => {
      if (part.visible === false) return; // Skip overlays for hidden parts
      const m = matrices.get(part.id);
      if (!m) return;

      const isSelected = part.id === SelectionState.activePartId;
      if (SelectionState.showDebugBounds || isSelected) {
        ctx.save();
        ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
        
        let width = 40;
        let height = 40;
        const asset = project.assets?.find((a: any) => a.id === part.imageAssetId);
        if (part.renderMode === 'image' && asset) {
          width = part.sourceRect ? part.sourceRect.width : asset.width;
          height = part.sourceRect ? part.sourceRect.height : asset.height;
        } else if (part.renderMode === 'shape') {
          width = part.origin.x * 2 || 40;
          height = part.origin.y * 2 || 40;
        }

        ctx.translate(-part.origin.x, -part.origin.y);
        drawPartOverlays(ctx, part, width, height, isSelected);
        ctx.restore();
      }
    });

    // 3. Draw skeleton overlay on top of everything
    drawSkeleton(ctx, project.parts, matrices);

    this.latestMatrices = matrices;
  }

  private syncPlaybackReadout() {
    const anim = ProjectState.project.animations.find((a: any) => a.id === SelectionState.activeAnimId);
    if (!anim) return;

    const duration = anim.duration || 1;
    const readout = `${getPlaybackTimeForAnimation(anim).toFixed(2)}s / ${duration.toFixed(2)}s`;
    const bottomBadge = document.getElementById('time-display');
    const toolbarBadge = document.getElementById('timeline-time-readout');

    if (bottomBadge) bottomBadge.textContent = readout;
    if (toolbarBadge) toolbarBadge.textContent = readout;
  }

  private setupInteraction() {
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const project = ProjectState.project;
      
      const activePart = project.parts.find((p: any) => p.id === SelectionState.activePartId);
      
      if (SelectionState.isEditingPivot && activePart && !activePart.locked) {
        const m = this.latestMatrices.get(activePart.id);
        if (m) {
          try {
            const inv = m.inverse();
            const localPoint = inv.transformPoint(new DOMPoint(mouseX, mouseY));
            
            // Set new origin in texture space
            activePart.origin.x = activePart.origin.x + localPoint.x;
            activePart.origin.y = activePart.origin.y + localPoint.y;
            
            // Shift baseX/baseY to compensate so graphic stays in place
            activePart.baseX += localPoint.x;
            activePart.baseY += localPoint.y;
            
            // Exit pivot editing mode
            SelectionState.isEditingPivot = false;
            
            DirtyState.markDirty();
            if (this.onUpdate) this.onUpdate();
          } catch (err) {
            console.error('Failed to update pivot:', err);
          }
        }
      } else {
        const picked = this.pickPart(mouseX, mouseY);
        SelectionState.activePartId = picked ? picked.id : null;
        if (this.onUpdate) this.onUpdate();
      }
    });
  }

  private pickPart(mouseX: number, mouseY: number): CharacterPart | null {
    const project = ProjectState.project;
    // Iterate parts in reverse order of zIndex (front-to-back) so top-most is selected first
    const sortedParts = [...project.parts].sort((a: any, b: any) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0));
    
    for (const part of sortedParts) {
      if (part.visible === false) continue; // Hidden parts cannot be picked
      if (part.locked === true) continue;   // Locked parts cannot be picked by default
      
      const m = this.latestMatrices.get(part.id);
      if (!m) continue;
      
      try {
        const inv = m.inverse();
        const localPoint = inv.transformPoint(new DOMPoint(mouseX, mouseY));
        const lx = localPoint.x;
        const ly = localPoint.y;
        
        let width = 40;
        let height = 40;
        const asset = project.assets?.find((a: any) => a.id === part.imageAssetId);
        if (part.renderMode === 'image' && asset) {
          width = part.sourceRect ? part.sourceRect.width : asset.width;
          height = part.sourceRect ? part.sourceRect.height : asset.height;
        } else if (part.renderMode === 'shape') {
          width = part.origin.x * 2 || 40;
          height = part.origin.y * 2 || 40;
        }
        
        const minX = -part.origin.x;
        const maxX = -part.origin.x + width;
        const minY = -part.origin.y;
        const maxY = -part.origin.y + height;
        
        if (lx >= minX && lx <= maxX && ly >= minY && ly <= maxY) {
          return part;
        }
      } catch (err) {
        // Suppress or log errors for singular/uninvertible matrices
      }
    }
    
    return null;
  }

  private setupViewportGestures() {
    // Zoom via Scroll Wheel
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomIntensity = 0.05;
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const delta = e.deltaY < 0 ? 1 : -1;
      const nextZoom = Math.min(Math.max(0.1, this.zoom + delta * zoomIntensity), 8.0);
      
      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;
      
      // Zoom centered on cursor
      this.panX = mouseX - cx - ((mouseX - cx - this.panX) / this.zoom) * nextZoom;
      this.panY = mouseY - cy - ((mouseY - cy - this.panY) / this.zoom) * nextZoom;
      this.zoom = nextZoom;
    });

    // Pan via Middle Click (1), Right Click (2) or Ctrl+Left click
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.button === 2 || (e.button === 0 && e.ctrlKey)) {
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
        const dx = e.clientX - this.startMouseX;
        const dy = e.clientY - this.startMouseY;
        this.panX = this.startPanX + dx;
        this.panY = this.startPanY + dy;
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.canvas.style.cursor = 'default';
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Zoom via Keyboard (+ / - / 0 to reset)
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        this.zoom = Math.min(8.0, this.zoom + 0.1);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        this.zoom = Math.max(0.1, this.zoom - 0.1);
      } else if (e.key.toLowerCase() === '0') {
        e.preventDefault();
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
      }
    });
  }
}
