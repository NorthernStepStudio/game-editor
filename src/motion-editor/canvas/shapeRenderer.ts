import { CharacterPart } from '../../../../../packages/nstep-motion-core/src/schema/types';

export function drawShape(ctx: CanvasRenderingContext2D, part: CharacterPart, width: number, height: number) {
  const st = part.shapeType || 'roundedRect';
  ctx.beginPath();

  switch (st) {
    case 'rect':
      ctx.rect(0, 0, width, height);
      break;

    case 'roundedRect':
      ctx.roundRect(0, 0, width, height, Math.min(8, width * 0.2, height * 0.2));
      break;

    case 'circle':
    case 'ellipse':
      ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      break;

    case 'diamond': {
      const cx = width / 2, cy = height / 2;
      ctx.moveTo(cx, 0); ctx.lineTo(width, cy);
      ctx.lineTo(cx, height); ctx.lineTo(0, cy);
      ctx.closePath();
      break;
    }

    case 'triangle': {
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      break;
    }

    case 'sword':
    case 'dagger':
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width * 0.7, height * 0.15);
      ctx.lineTo(width * 0.55, height * 0.85);
      ctx.lineTo(width * 0.45, height * 0.85);
      ctx.lineTo(width * 0.3, height * 0.15);
      ctx.closePath();
      break;

    case 'staff':
    case 'line':
    case 'bone':
      ctx.roundRect(width * 0.38, 0, width * 0.24, height, 3);
      break;

    case 'hammer':
      ctx.roundRect(width * 0.38, height * 0.25, width * 0.24, height * 0.75, 2);
      ctx.rect(0, 0, width, height * 0.28);
      break;

    case 'shield':
      ctx.moveTo(0, 0);
      ctx.lineTo(width, 0);
      ctx.quadraticCurveTo(width, height * 0.7, width / 2, height);
      ctx.quadraticCurveTo(0, height * 0.7, 0, 0);
      ctx.closePath();
      break;

    case 'cape':
    case 'polygon':
      ctx.moveTo(width * 0.15, 0);
      ctx.lineTo(width * 0.85, 0);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      break;

    case 'arrow':
      ctx.moveTo(0, height * 0.35);
      ctx.lineTo(width * 0.6, height * 0.35);
      ctx.lineTo(width * 0.6, 0);
      ctx.lineTo(width, height * 0.5);
      ctx.lineTo(width * 0.6, height);
      ctx.lineTo(width * 0.6, height * 0.65);
      ctx.lineTo(0, height * 0.65);
      ctx.closePath();
      break;

    case 'star': {
      const cx = width / 2, cy = height / 2;
      const r1 = Math.min(width, height) / 2;
      const r2 = r1 * 0.45;
      const pts = 5;
      for (let i = 0; i < pts * 2; i++) {
        const r = i % 2 === 0 ? r1 : r2;
        const a = (Math.PI / pts) * i - Math.PI / 2;
        if (i === 0) ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
        else ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      ctx.closePath();
      break;
    }

    default:
      ctx.roundRect(0, 0, width, height, 6);
  }

  ctx.fill();
}
