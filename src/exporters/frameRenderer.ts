import { CharacterProject } from '@nstep-core/schema/types';
import { evaluateController } from '@nstep-core/runtime/evaluateController';
import { imageCache } from '../motion-editor/canvas/imageCache';
import { drawShape } from '../motion-editor/canvas/shapeRenderer';
import { computeDeformedVertices, drawTexturedTriangle } from '../motion-editor/canvas/meshRenderer';
import { solve2BoneIK, solveFABRIK } from '../motion-editor/canvas/ikSolver';

export interface FrameRenderOptions {
  width: number;
  height: number;
  bgColor: string | null;
}

function computeTransforms(project: CharacterProject, anim: any, time: number): Map<string, any> {
  const tforms = new Map<string, any>();
  project.parts.forEach((p: any) => {
    tforms.set(p.id, {
      x:        p.baseX        ?? 0,
      y:        p.baseY        ?? 0,
      rotation: p.baseRotation ?? 0,
      scaleX:   p.baseScaleX   ?? 1,
      scaleY:   p.baseScaleY   ?? 1,
      opacity:  p.opacity      ?? 1,
      zIndex:   p.zIndex       ?? 0,
      color:    0,
    });
  });

  if (anim) {
    const dur = anim.duration || 1;
    anim.controllers.forEach((c: any) => {
      if (!c.enabled) return;
      const tform = tforms.get(c.targetPartId);
      if (!tform) return;
      const val  = evaluateController(c, time, dur);
      const base = tform[c.property] ?? 0;
      let tv = base + val;
      if (c.params.min !== c.params.max) {
        tv = Math.max(base + c.params.min, Math.min(base + c.params.max, tv));
      }
      tform[c.property] = tv;
    });
  }

  tforms.forEach(tf => {
    tf.zIndex = Math.round(tf.zIndex);
    tf.color  = Math.max(0, Math.min(1, tf.color));
  });

  return tforms;
}

function buildMatrices(
  tforms: Map<string, any>,
  partsMap: Map<string, any>,
  childrenMap: Map<string, string[]>,
  rootParts: string[],
  cx: number,
  cy: number,
  scale: number
): Map<string, DOMMatrix> {
  const matrices = new Map<string, DOMMatrix>();
  const rootMatrix = new DOMMatrix().translate(cx, cy).scale(scale, scale);

  const compute = (partId: string, parentMatrix: DOMMatrix) => {
    const part  = partsMap.get(partId);
    const tform = tforms.get(partId);
    if (!part || !tform) return;
    const effectiveParent = (part.inheritTransform === false) ? rootMatrix : parentMatrix;
    const m = DOMMatrix.fromMatrix(effectiveParent);
    m.translateSelf(tform.x, tform.y);
    m.rotateSelf(tform.rotation);
    m.scaleSelf(tform.scaleX, tform.scaleY);
    matrices.set(partId, m);
    (childrenMap.get(partId) || []).forEach(k => compute(k, m));
  };
  rootParts.forEach(r => compute(r, rootMatrix));
  return matrices;
}

function applyIK(
  project: CharacterProject,
  tforms: Map<string, any>,
  matrices: Map<string, DOMMatrix>,
  partsMap: Map<string, any>,
  childrenMap: Map<string, string[]>
) {
  project.parts.forEach((part: any) => {
    const ik = part.ikChain;
    if (!ik?.targetPartId || part.fkOverride) return;

    const chainLength = ik.chainLength ?? 2;
    const targetMat   = matrices.get(ik.targetPartId);
    if (!targetMat) return;
    const targetWorldX = ik.pin && ik.pinnedWorldX !== undefined ? ik.pinnedWorldX : targetMat.e;
    const targetWorldY = ik.pin && ik.pinnedWorldY !== undefined ? ik.pinnedWorldY : targetMat.f;

    const rootMat = matrices.get(part.id);
    if (!rootMat) return;

    const chainParts: string[] = [part.id];
    let cur = part.id;
    for (let i = 0; i < chainLength - 1; i++) {
      const ch = childrenMap.get(cur) || [];
      if (ch.length === 0) break;
      cur = ch[0];
      chainParts.push(cur);
    }

    if (chainLength <= 2) {
      const midId   = chainParts[1] ?? null;
      const midPart = midId ? partsMap.get(midId) : null;
      const bone1   = midPart ? Math.sqrt((midPart.baseX ?? 0) ** 2 + (midPart.baseY ?? 0) ** 2) || 40 : 40;
      let bone2     = bone1;
      if (midId) {
        const gc = childrenMap.get(midId) || [];
        if (gc.length > 0) {
          const gcp = partsMap.get(gc[0]);
          if (gcp) bone2 = Math.sqrt((gcp.baseX ?? 0) ** 2 + (gcp.baseY ?? 0) ** 2) || bone1;
        }
      }
      const result = solve2BoneIK(rootMat.e, rootMat.f, bone1, bone2, targetWorldX, targetWorldY, ik.bendDirection ?? 1);
      const tf = tforms.get(part.id);
      if (tf) tf.rotation = result.bone1AngleDeg;
      if (midId && !partsMap.get(midId)?.fkOverride) {
        const mt = tforms.get(midId);
        if (mt) mt.rotation = result.bone2AngleDeg;
      }
      return;
    }

    const N = chainParts.length;
    const joints = chainParts.map(pid => {
      const m = matrices.get(pid);
      return m ? { x: m.e, y: m.f } : { x: 0, y: 0 };
    });
    joints.push({ x: targetWorldX, y: targetWorldY });

    const lengths: number[] = [];
    for (let i = 0; i < N; i++) {
      if (i < N - 1) {
        const np = partsMap.get(chainParts[i + 1]);
        lengths.push(np ? Math.sqrt((np.baseX ?? 0) ** 2 + (np.baseY ?? 0) ** 2) || 40 : 40);
      } else {
        const gc = childrenMap.get(chainParts[N - 1]) || [];
        let ll = lengths.length > 0 ? lengths[0] : 40;
        if (gc.length > 0) {
          const gcp = partsMap.get(gc[0]);
          if (gcp) ll = Math.sqrt((gcp.baseX ?? 0) ** 2 + (gcp.baseY ?? 0) ** 2) || ll;
        }
        lengths.push(ll);
      }
    }

    const fixedJoints = new Set<number>();
    for (let i = 1; i < N; i++) {
      if (partsMap.get(chainParts[i])?.fkOverride) fixedJoints.add(i);
    }

    const newPos = solveFABRIK(joints, lengths, targetWorldX, targetWorldY, 10, 0.5, fixedJoints);

    for (let i = 0; i < N; i++) {
      const pid = chainParts[i];
      if (partsMap.get(pid)?.fkOverride) continue;
      const tf = tforms.get(pid);
      if (!tf) continue;
      const waDeg = Math.atan2(newPos[i + 1].y - newPos[i].y, newPos[i + 1].x - newPos[i].x) * (180 / Math.PI);
      if (i === 0) {
        const parentId  = partsMap.get(pid)?.parentId;
        const parentMat = parentId ? matrices.get(parentId) : null;
        const parentDeg = parentMat ? Math.atan2(parentMat.b, parentMat.a) * (180 / Math.PI) : 0;
        tf.rotation = waDeg - parentDeg;
      } else {
        const prevDeg = Math.atan2(newPos[i].y - newPos[i - 1].y, newPos[i].x - newPos[i - 1].x) * (180 / Math.PI);
        tf.rotation = waDeg - prevDeg;
      }
    }
  });
}

function applyConstraints(
  project: CharacterProject,
  tforms: Map<string, any>,
  matrices: Map<string, DOMMatrix>
) {
  project.parts.forEach((part: any) => {
    const con = part.constraint;
    if (!con?.targetPartId) return;
    const targetMat = matrices.get(con.targetPartId);
    const selfMat   = matrices.get(part.id);
    if (!targetMat || !selfMat) return;
    const influence = con.influence ?? 1;
    const tform = tforms.get(part.id);
    if (!tform) return;
    if (con.type === 'lookAt') {
      const angle = Math.atan2(targetMat.f - selfMat.f, targetMat.e - selfMat.e) * (180 / Math.PI) + (con.offset ?? 0);
      tform.rotation = tform.rotation + (angle - tform.rotation) * influence;
    } else if (con.type === 'copyRotation') {
      const ta = Math.atan2(targetMat.b, targetMat.a) * (180 / Math.PI) + (con.offset ?? 0);
      tform.rotation = tform.rotation + (ta - tform.rotation) * influence;
    } else if (con.type === 'limitRotation') {
      const min = (con as any).min ?? (con.offset ?? -45);
      const max = (con as any).max ?? (con.influence ?? 45);
      tform.rotation = Math.max(min, Math.min(max, tform.rotation));
    }
  });
}

export function renderFrameToCanvas(
  project: CharacterProject,
  animId: string,
  time: number,
  opts: FrameRenderOptions
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width  = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext('2d')!;

  if (opts.bgColor) {
    ctx.fillStyle = opts.bgColor;
    ctx.fillRect(0, 0, opts.width, opts.height);
  }

  const anim = (project.animations as any[]).find(a => a.id === animId);
  const dur  = (anim?.duration || 1);
  const clampedTime = anim?.loop ? ((time % dur) + dur) % dur : Math.max(0, Math.min(dur, time));

  const partsMap    = new Map<string, any>();
  const childrenMap = new Map<string, string[]>();
  const rootParts:  string[] = [];

  project.parts.forEach((p: any) => {
    partsMap.set(p.id, p);
    if (!p.parentId) {
      rootParts.push(p.id);
    } else {
      if (!childrenMap.has(p.parentId)) childrenMap.set(p.parentId, []);
      childrenMap.get(p.parentId)!.push(p.id);
    }
  });

  const scale = 1;
  const cx    = opts.width  / 2;
  const cy    = opts.height / 2;

  let tforms  = computeTransforms(project, anim, clampedTime);
  let matrices = buildMatrices(tforms, partsMap, childrenMap, rootParts, cx, cy, scale);

  applyIK(project, tforms, matrices, partsMap, childrenMap);
  applyConstraints(project, tforms, matrices);
  matrices = buildMatrices(tforms, partsMap, childrenMap, rootParts, cx, cy, scale);

  const hasMesh = project.parts.some((p: any) => (p as any).mesh?.vertices?.length >= 3);
  let restMatrices: Map<string, DOMMatrix> | null = null;
  if (hasMesh) {
    const rTforms = new Map<string, any>();
    project.parts.forEach((p: any) => {
      rTforms.set(p.id, {
        x: p.baseX ?? 0, y: p.baseY ?? 0,
        rotation: p.baseRotation ?? 0,
        scaleX: p.baseScaleX ?? 1, scaleY: p.baseScaleY ?? 1,
        opacity: 1, zIndex: p.zIndex ?? 0, color: 0,
      });
    });
    restMatrices = buildMatrices(rTforms, partsMap, childrenMap, rootParts, cx, cy, scale);
  }

  const sortedParts = [...project.parts].sort((a: any, b: any) =>
    (tforms.get(a.id)?.zIndex ?? 0) - (tforms.get(b.id)?.zIndex ?? 0)
  );

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  sortedParts.forEach((part: any) => {
    if (part.visible === false) return;
    const m = matrices.get(part.id);
    if (!m) return;

    const activeSkin         = (project as any).skins?.find((s: any) => s.id === (project as any).activeSkinId);
    const skinSlot           = activeSkin?.slots?.[part.id];
    const effectiveAssetId   = skinSlot?.imageAssetId ?? part.imageAssetId;
    const effectiveColor     = skinSlot?.color        ?? part.color;
    const effectiveSourceRect = skinSlot?.sourceRect  ?? part.sourceRect;
    const asset = project.assets?.find((a: any) => a.id === effectiveAssetId);
    const tform = tforms.get(part.id);
    const opacity = Math.max(0, Math.min(1, tform?.opacity ?? (part.opacity ?? 1)));
    const activeSrc = effectiveSourceRect;

    let width = 40, height = 40;
    if (part.renderMode === 'image' && asset) {
      width  = activeSrc ? activeSrc.width  : asset.width;
      height = activeSrc ? activeSrc.height : asset.height;
    } else {
      width  = (part.origin?.x ?? 20) * 2 || 40;
      height = (part.origin?.y ?? 20) * 2 || 40;
    }

    const partMesh = (part as any).mesh;
    if (partMesh?.vertices?.length >= 3 && partMesh.triangles?.length > 0
        && part.renderMode === 'image' && effectiveAssetId && restMatrices) {
      const img = imageCache.get(effectiveAssetId);
      if (img && img.complete && img.naturalWidth > 0) {
        const deformedPts = computeDeformedVertices(partMesh, part, matrices, restMatrices);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (const tri of partMesh.triangles) {
          if (tri.length < 3) continue;
          const v0 = partMesh.vertices[tri[0]], v1 = partMesh.vertices[tri[1]], v2 = partMesh.vertices[tri[2]];
          const d0 = deformedPts[tri[0]], d1 = deformedPts[tri[1]], d2 = deformedPts[tri[2]];
          if (!v0 || !v1 || !v2 || !d0 || !d1 || !d2) continue;
          drawTexturedTriangle(ctx, img, activeSrc, width, height,
            [v0.x, v0.y, v1.x, v1.y, v2.x, v2.y],
            [d0.x, d0.y, d1.x, d1.y, d2.x, d2.y], opacity);
        }
        ctx.restore();
        return;
      }
    }

    ctx.save();
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.globalAlpha = opacity;
    if (part.flipX || part.flipY) ctx.scale(part.flipX ? -1 : 1, part.flipY ? -1 : 1);
    ctx.translate(-(part.origin?.x ?? 0), -(part.origin?.y ?? 0));

    if (part.renderMode === 'image' && effectiveAssetId) {
      const img = imageCache.get(effectiveAssetId);
      if (img && img.complete && img.naturalWidth > 0) {
        // Resolve dynamic frame-animation source rect (matches MotionCanvasRenderer behaviour)
        let drawSrc = activeSrc;
        const fa = part.frameAnimation;
        if (fa?.frames?.length > 0) {
          const faDur    = fa.duration   || 1;
          const faFps    = fa.fps        || 12;
          const faCycle  = fa.loop !== false ? ((clampedTime % faDur) + faDur) % faDur : Math.max(0, Math.min(faDur, clampedTime));
          const frameIdx = Math.min(Math.floor(faCycle * faFps), fa.frames.length - 1);
          const frame    = fa.frames[frameIdx];
          if (frame) drawSrc = frame;
        }

        if (drawSrc) {
          ctx.drawImage(img, drawSrc.x, drawSrc.y, drawSrc.width, drawSrc.height, 0, 0, width, height);
        } else {
          ctx.drawImage(img, 0, 0, width, height);
        }

        // Tint / color influence overlay (matches MotionCanvasRenderer composite)
        const colorInfluence = part.colorInfluence ?? 0;
        if (colorInfluence > 0 && effectiveColor && effectiveColor !== 'none') {
          ctx.save();
          ctx.globalAlpha    = opacity * colorInfluence;
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle      = effectiveColor;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
      }
    } else {
      ctx.fillStyle = effectiveColor || '#4c8ef5';
      drawShape(ctx, part, width, height);
    }

    ctx.restore();
  });

  return canvas;
}
