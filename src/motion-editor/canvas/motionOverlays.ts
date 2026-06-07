import { CharacterPart } from '../../../../../packages/nstep-motion-core/src/schema/types';
import { AppState } from '../../state/appState';

export function drawPartOverlays(
  ctx: CanvasRenderingContext2D,
  part: CharacterPart,
  width: number,
  height: number,
  isSelected: boolean
) {
  if (isSelected) {
    // Selection box
    ctx.strokeStyle = 'rgba(76,142,245,0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.strokeRect(-0.5, -0.5, width + 1, height + 1);

    // Corner handles
    const hs = 5;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(76,142,245,1)';
    ctx.lineWidth = 1;
    const corners = [[0,0],[width,0],[0,height],[width,height]];
    corners.forEach(([cx, cy]) => {
      ctx.fillRect(cx - hs/2, cy - hs/2, hs, hs);
      ctx.strokeRect(cx - hs/2, cy - hs/2, hs, hs);
    });
  } else if (AppState.showBounds) {
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(0, 0, width, height);
    ctx.setLineDash([]);
  }

  // Pivot point
  if (AppState.showPivots || isSelected) {
    const pr = isSelected ? 5 : 3;
    // Cross
    ctx.strokeStyle = isSelected ? 'rgba(76,142,245,0.9)' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-pr - 2, 0); ctx.lineTo(pr + 2, 0);
    ctx.moveTo(0, -pr - 2); ctx.lineTo(0, pr + 2);
    ctx.stroke();
    // Circle
    ctx.fillStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.6)';
    ctx.strokeStyle = isSelected ? 'rgba(76,142,245,1)' : 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Part name
  if (AppState.showNames || isSelected) {
    ctx.save();
    ctx.font = '600 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = isSelected ? 'rgba(76,142,245,1)' : 'rgba(255,255,255,0.7)';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 3;
    ctx.fillText(part.name, width / 2, -8);
    ctx.shadowBlur = 0;
    ctx.restore();
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

  parts.forEach(p => {
    if (!p.parentId) return;
    const m1 = matrices.get(p.id);
    const m2 = matrices.get(p.parentId);
    if (!m1 || !m2) return;

    // Bone line
    ctx.strokeStyle = 'rgba(62,207,142,0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(m2.e, m2.f);
    ctx.lineTo(m1.e, m1.f);
    ctx.stroke();

    // Bone tip dot
    ctx.fillStyle = 'rgba(62,207,142,0.5)';
    ctx.beginPath();
    ctx.arc(m1.e, m1.f, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Root dots
  parts.filter(p => !p.parentId).forEach(p => {
    const m = matrices.get(p.id);
    if (!m) return;
    ctx.fillStyle = 'rgba(76,142,245,0.6)';
    ctx.beginPath();
    ctx.arc(m.e, m.f, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}
