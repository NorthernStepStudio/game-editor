import { CharacterPart } from '../../../../../packages/nstep-motion-core/src/schema/types';

export function drawShape(ctx: CanvasRenderingContext2D, part: CharacterPart, width: number, height: number) {
  const st = part.shapeType || 'roundedRect';
  ctx.beginPath();
  
  if (st === 'rect') {
    ctx.rect(0, 0, width, height);
  } else if (st === 'roundedRect') {
    ctx.roundRect(0, 0, width, height, 8);
  } else if (st === 'circle' || st === 'ellipse') {
    ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  } else if (st === 'sword' || st === 'dagger') {
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width, height * 0.2);
    ctx.lineTo(width * 0.6, height);
    ctx.lineTo(width * 0.4, height);
    ctx.lineTo(0, height * 0.2);
    ctx.closePath();
  } else if (st === 'staff' || st === 'line') {
    ctx.roundRect(width * 0.4, 0, width * 0.2, height, 4);
  } else if (st === 'hammer') {
    ctx.roundRect(width * 0.4, height * 0.2, width * 0.2, height * 0.8, 2);
    ctx.roundRect(0, 0, width, height * 0.2, 4);
  } else if (st === 'shield') {
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.quadraticCurveTo(width, height, width / 2, height);
    ctx.quadraticCurveTo(0, height, 0, 0);
  } else if (st === 'cape' || st === 'polygon') {
    ctx.moveTo(width * 0.2, 0);
    ctx.lineTo(width * 0.8, 0);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
  } else {
    ctx.roundRect(0, 0, width, height, 8);
  }
  
  ctx.fill();
}
