import { CharacterPart } from '../../../../../packages/nstep-motion-core/src/schema/types';
import { AppState } from '../../state/appState';

export function drawPartOverlays(
  ctx: CanvasRenderingContext2D,
  part: CharacterPart,
  width: number,
  height: number,
  isSelected: boolean
) {
  // Selection / Bounds
  if (isSelected || AppState.showBounds) {
    ctx.strokeStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(0, 0, width, height);
  }

  // Pivot Point
  if (AppState.showPivots || isSelected) {
    ctx.fillStyle = isSelected ? '#ff0000' : 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(0, 0, isSelected ? 4 : 2, 0, Math.PI * 2);
    ctx.fill();
    if (isSelected) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Part Name
  if (AppState.showNames || isSelected) {
    ctx.fillStyle = 'white';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 2;
    ctx.fillText(part.name, 0, -10);
    ctx.shadowBlur = 0;
  }
}

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  parts: CharacterPart[],
  matrices: Map<string, DOMMatrix>
) {
  if (!AppState.showSkeleton) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = 'rgba(122, 162, 247, 0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  parts.forEach(p => {
    if (p.parentId) {
      const m1 = matrices.get(p.id);
      const m2 = matrices.get(p.parentId);
      if (m1 && m2) {
        ctx.beginPath();
        ctx.moveTo(m1.e, m1.f);
        ctx.lineTo(m2.e, m2.f);
        ctx.stroke();
      }
    }
  });
  ctx.restore();
}
