import { PartMesh, Vertex2D } from '@nstep-core/schema/types';

export function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  srcRect: { x: number; y: number; width: number; height: number } | null,
  dispW: number,
  dispH: number,
  srcPts: [number, number, number, number, number, number],
  dstPts: [number, number, number, number, number, number],
  opacity: number
) {
  const [x0, y0, x1, y1, x2, y2] = srcPts;
  const [dx0, dy0, dx1, dy1, dx2, dy2] = dstPts;

  const det = (x0 - x2) * (y1 - y2) - (x1 - x2) * (y0 - y2);
  if (Math.abs(det) < 0.01) return;

  const a  = ((dx0 - dx2) * (y1 - y2) - (dx1 - dx2) * (y0 - y2)) / det;
  const b  = ((dx1 - dx2) * (x0 - x2) - (dx0 - dx2) * (x1 - x2)) / det;
  const c  = dx0 - a * x0 - b * y0;
  const d  = ((dy0 - dy2) * (y1 - y2) - (dy1 - dy2) * (y0 - y2)) / det;
  const e  = ((dy1 - dy2) * (x0 - x2) - (dy0 - dy2) * (x1 - x2)) / det;
  const f  = dy0 - d * x0 - e * y0;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.beginPath();
  ctx.moveTo(dx0, dy0);
  ctx.lineTo(dx1, dy1);
  ctx.lineTo(dx2, dy2);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, d, b, e, c, f);
  if (srcRect) {
    ctx.drawImage(img, srcRect.x, srcRect.y, srcRect.width, srcRect.height, 0, 0, dispW, dispH);
  } else {
    ctx.drawImage(img, 0, 0, dispW, dispH);
  }
  ctx.restore();
}

export function computeDeformedVertices(
  mesh: PartMesh,
  part: any,
  matrices: Map<string, DOMMatrix>,
  restMatrices: Map<string, DOMMatrix>
): DOMPoint[] {
  const ox = part.origin?.x ?? 0;
  const oy = part.origin?.y ?? 0;
  const partCurr = matrices.get(part.id);
  const partRest = restMatrices.get(part.id);

  return mesh.vertices.map((v: Vertex2D, vi: number) => {
    if (!partCurr) return new DOMPoint(v.x - ox, v.y - oy);

    const bw = mesh.boneWeights[vi] ?? {};
    const entries = Object.entries(bw).filter(([, w]) => (w as number) > 0);

    if (entries.length === 0 || !partRest) {
      return partCurr.transformPoint(new DOMPoint(v.x - ox, v.y - oy));
    }

    const restWorld = partRest.transformPoint(new DOMPoint(v.x - ox, v.y - oy));
    let totalW = 0, defX = 0, defY = 0;

    for (const [boneId, w] of entries) {
      const boneCurr = matrices.get(boneId);
      const boneRest = restMatrices.get(boneId);
      if (!boneCurr || !boneRest) continue;
      try {
        const boneRestInv = boneRest.inverse();
        const inBone = boneRestInv.transformPoint(restWorld);
        const deformed = boneCurr.transformPoint(inBone);
        defX += (w as number) * deformed.x;
        defY += (w as number) * deformed.y;
        totalW += w as number;
      } catch { /* singular matrix — skip */ }
    }

    if (totalW <= 0) return partCurr.transformPoint(new DOMPoint(v.x - ox, v.y - oy));
    return new DOMPoint(defX / totalW, defY / totalW);
  });
}

export function drawMeshEditOverlay(
  ctx: CanvasRenderingContext2D,
  mesh: PartMesh,
  matrices: Map<string, DOMMatrix>,
  part: any,
  selectedVertIdx: number,
  weightMode: boolean,
  weightBoneId: string | null
) {
  const m = matrices.get(part.id);
  if (!m) return;
  const ox = part.origin?.x ?? 0;
  const oy = part.origin?.y ?? 0;

  const worldPts = mesh.vertices.map((v: Vertex2D) =>
    m.transformPoint(new DOMPoint(v.x - ox, v.y - oy))
  );

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  ctx.strokeStyle = weightMode ? 'rgba(180, 140, 255, 0.45)' : 'rgba(80, 220, 120, 0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  for (const tri of mesh.triangles) {
    if (tri.length < 3) continue;
    const p0 = worldPts[tri[0]], p1 = worldPts[tri[1]], p2 = worldPts[tri[2]];
    if (!p0 || !p1 || !p2) continue;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);

  mesh.vertices.forEach((_v: Vertex2D, vi: number) => {
    const wp = worldPts[vi];
    if (!wp) return;
    const isSel = vi === selectedVertIdx;

    let weight = 0;
    if (weightMode && weightBoneId) {
      weight = (mesh.boneWeights[vi] ?? {})[weightBoneId] ?? 0;
    }

    ctx.beginPath();
    ctx.arc(wp.x, wp.y, isSel ? 7 : 5, 0, Math.PI * 2);

    if (weightMode) {
      const r = Math.round(weight * 255);
      const b = Math.round((1 - weight) * 200);
      ctx.fillStyle = `rgba(${r}, 60, ${b}, 0.9)`;
    } else {
      ctx.fillStyle = isSel ? '#ffd700' : 'rgba(80, 220, 120, 0.9)';
    }
    ctx.fill();
    ctx.strokeStyle = isSel ? '#ffffff' : 'rgba(0,0,0,0.6)';
    ctx.lineWidth = isSel ? 2 : 1;
    ctx.stroke();

    if (weightMode && weightBoneId && weight > 0.01) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(weight.toFixed(2), wp.x, wp.y - 9);
    }
  });

  ctx.restore();
}
