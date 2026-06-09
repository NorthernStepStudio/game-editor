import { CharacterPart } from '../../../../../packages/nstep-motion-core/src/schema/types';
import { ProjectState } from '../../state/projectState';
import { SelectionState } from '../../state/selectionState';
import { DirtyState } from '../../state/dirtyState';
import { HistoryState } from '../../state/historyState';
import { computeAllWorldMatrices, preserveDescendantWorldTransforms } from '../rigTransformUtils';
import { MotionCanvasRenderer } from './MotionCanvasRenderer';

type RendererWithPrivateState = {
  canvas: HTMLCanvasElement;
  zoom: number;
  isPanning: boolean;
  isDraggingPart: boolean;
  dragBoneOnly: boolean;
  dragStartPartX: number;
  dragStartPartY: number;
  dragStartMouseX: number;
  dragStartMouseY: number;
  dragStartWorldMatrices: Map<string, DOMMatrix>;
  latestMatrices: Map<string, DOMMatrix>;
  onUpdate?: () => void;
  getMouse: (e: MouseEvent) => { mx: number; my: number };
};

type HitGroups = {
  anchorHits: CharacterPart[];
  bodyHits: CharacterPart[];
};

const ANCHOR_R = 22;

function hasChildren(partId: string, parts: CharacterPart[]) {
  return parts.some(part => part.parentId === partId);
}

function getDepth(part: CharacterPart, parts: CharacterPart[]) {
  let depth = 0;
  let current: CharacterPart | undefined = part;
  while (current?.parentId) {
    const parent = parts.find(candidate => candidate.id === current?.parentId);
    if (!parent) break;
    depth += 1;
    current = parent;
  }
  return depth;
}

function pointHitsPartBody(renderer: RendererWithPrivateState, part: CharacterPart, mx: number, my: number) {
  const matrix = renderer.latestMatrices.get(part.id);
  if (!matrix) return false;

  try {
    const localPoint = matrix.inverse().transformPoint(new DOMPoint(mx, my));
    const asset = ProjectState.project.assets?.find(candidate => candidate.id === part.imageAssetId);
    let width = 40;
    let height = 40;

    if (part.renderMode === 'image' && asset) {
      width = part.sourceRect ? part.sourceRect.width : asset.width;
      height = part.sourceRect ? part.sourceRect.height : asset.height;
    } else {
      width = (part.origin?.x ?? 20) * 2 || 40;
      height = (part.origin?.y ?? 20) * 2 || 40;
    }

    const originX = part.origin?.x ?? 0;
    const originY = part.origin?.y ?? 0;
    return (
      localPoint.x >= -originX &&
      localPoint.x <= -originX + width &&
      localPoint.y >= -originY &&
      localPoint.y <= -originY + height
    );
  } catch {
    return false;
  }
}

function getHits(renderer: RendererWithPrivateState, mx: number, my: number): HitGroups {
  const parts = ProjectState.project.parts;
  const sorted = [...parts].sort((a, b) => (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0));
  const anchorHits: CharacterPart[] = [];
  const bodyHits: CharacterPart[] = [];

  for (const part of sorted) {
    if (part.visible === false || part.locked === true) continue;
    const matrix = renderer.latestMatrices.get(part.id);
    if (!matrix) continue;

    const dx = mx - matrix.e;
    const dy = my - matrix.f;
    if (dx * dx + dy * dy <= ANCHOR_R * ANCHOR_R) {
      anchorHits.push(part);
    }

    if (pointHitsPartBody(renderer, part, mx, my)) {
      bodyHits.push(part);
    }
  }

  return { anchorHits, bodyHits };
}

function chooseBodyHit(bodyHits: CharacterPart[]): CharacterPart | null {
  if (bodyHits.length === 0) return null;

  const parts = ProjectState.project.parts;
  const movableParents = bodyHits
    .filter(part => part.parentId === null || hasChildren(part.id, parts))
    .sort((a, b) => {
      const depthDelta = getDepth(a, parts) - getDepth(b, parts);
      if (depthDelta !== 0) return depthDelta;
      return (Number(b.zIndex) || 0) - (Number(a.zIndex) || 0);
    });

  return movableParents[0] ?? bodyHits[0];
}

function choosePartForDrag(renderer: RendererWithPrivateState, mx: number, my: number): CharacterPart | null {
  const project = ProjectState.project;
  const activePart = project.parts.find(part => part.id === SelectionState.activePartId);
  const activeUnlocked = activePart && !activePart.locked ? activePart : undefined;
  const { anchorHits, bodyHits } = getHits(renderer, mx, my);

  if (activeUnlocked) {
    const activeMatrix = renderer.latestMatrices.get(activeUnlocked.id);
    const activeAnchorHit = activeMatrix
      ? (mx - activeMatrix.e) ** 2 + (my - activeMatrix.f) ** 2 <= ANCHOR_R * ANCHOR_R
      : false;
    const activeBodyHit = bodyHits.some(part => part.id === activeUnlocked.id);

    // Critical fix: once a parent/root bone is selected, dragging anywhere on its
    // own image/body moves that parent. Child anchors no longer steal the drag.
    if (activeAnchorHit || activeBodyHit) {
      return activeUnlocked;
    }

    const differentAnchor = anchorHits.find(part => part.id !== activeUnlocked.id);
    if (differentAnchor) return differentAnchor;
  }

  return anchorHits[0] ?? chooseBodyHit(bodyHits);
}

(MotionCanvasRenderer.prototype as any).setupInteraction = function setupInteractionPatch(this: RendererWithPrivateState) {
  this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 0 || this.isPanning) return;
    const { mx, my } = this.getMouse(e);
    const project = ProjectState.project;
    const activePart = project.parts.find(part => part.id === SelectionState.activePartId);

    if (SelectionState.isEditingPivot && activePart && !activePart.locked) {
      const matrix = this.latestMatrices.get(activePart.id);
      if (matrix) {
        try {
          const localPoint = matrix.inverse().transformPoint(new DOMPoint(mx, my));
          activePart.origin.x = (activePart.origin?.x ?? 0) + localPoint.x;
          activePart.origin.y = (activePart.origin?.y ?? 0) + localPoint.y;
          activePart.baseX = (activePart.baseX ?? 0) + localPoint.x;
          activePart.baseY = (activePart.baseY ?? 0) + localPoint.y;
          SelectionState.isEditingPivot = false;
          DirtyState.markDirty();
          this.onUpdate?.();
        } catch {}
      }
      return;
    }

    const picked = choosePartForDrag(this, mx, my);
    const previousId = SelectionState.activePartId;
    SelectionState.activePartId = picked ? picked.id : null;

    if (picked && !picked.locked) {
      HistoryState.push();
      this.isDraggingPart = true;
      this.dragBoneOnly = e.shiftKey;
      this.dragStartPartX = picked.baseX ?? 0;
      this.dragStartPartY = picked.baseY ?? 0;
      this.dragStartMouseX = mx;
      this.dragStartMouseY = my;

      if (this.dragBoneOnly) {
        this.dragStartWorldMatrices = computeAllWorldMatrices(
          ProjectState.project.parts,
          this.canvas.width,
          this.canvas.height,
        );
      }

      this.canvas.style.cursor = this.dragBoneOnly ? 'crosshair' : 'move';
    }

    if (picked?.id !== previousId) this.onUpdate?.();
  });

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!this.isDraggingPart) return;
    const project = ProjectState.project;
    const part = project.parts.find(candidate => candidate.id === SelectionState.activePartId);
    if (!part || part.locked) return;

    const { mx, my } = this.getMouse(e);
    const dx = (mx - this.dragStartMouseX) / this.zoom;
    const dy = (my - this.dragStartMouseY) / this.zoom;
    part.baseX = this.dragStartPartX + dx;
    part.baseY = this.dragStartPartY + dy;

    if (this.dragBoneOnly && this.dragStartWorldMatrices.size > 0) {
      preserveDescendantWorldTransforms(
        part.id,
        project.parts,
        this.dragStartWorldMatrices,
        this.canvas.width,
        this.canvas.height,
      );
    }

    DirtyState.markDirty();
    if (this.onUpdate) (this.onUpdate as any)(true, false);
  });

  window.addEventListener('mouseup', (e: MouseEvent) => {
    if (e.button === 0 && this.isDraggingPart) {
      this.isDraggingPart = false;
      this.canvas.style.cursor = '';
    }
  });
};
