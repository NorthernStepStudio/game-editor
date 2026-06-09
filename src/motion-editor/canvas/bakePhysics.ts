import type { CharacterProject } from '@nstep-core/schema/types';
import { evaluateController } from '@nstep-core/runtime/evaluateController';
import { SpringBoneSimulator } from './SpringBoneSimulator';

const BAKE_FPS = 60;
const BAKE_DT  = 1 / BAKE_FPS;

function buildBakeMatrices(
  project: CharacterProject,
  tforms: Map<string, any>,
): Map<string, DOMMatrix> {
  const childrenMap = new Map<string, string[]>();
  const rootParts: string[] = [];
  project.parts.forEach((p: any) => {
    if (!p.parentId) rootParts.push(p.id);
    else {
      if (!childrenMap.has(p.parentId)) childrenMap.set(p.parentId, []);
      childrenMap.get(p.parentId)!.push(p.id);
    }
  });

  const matrices = new Map<string, DOMMatrix>();
  const root = new DOMMatrix();

  const compute = (partId: string, parent: DOMMatrix) => {
    const part = project.parts.find((p: any) => p.id === partId) as any;
    const tf = tforms.get(partId);
    if (!part || !tf) return;
    const effectiveParent = (part.inheritTransform === false) ? root : parent;
    const m = DOMMatrix.fromMatrix(effectiveParent);
    m.translateSelf(tf.x, tf.y);
    m.rotateSelf(tf.rotation);
    m.scaleSelf(tf.scaleX, tf.scaleY);
    matrices.set(partId, m);
    (childrenMap.get(partId) || []).forEach((k: string) => compute(k, m));
  };
  rootParts.forEach(r => compute(r, root));
  return matrices;
}

function computeBakeTforms(
  project: CharacterProject,
  anim: any,
  time: number,
): Map<string, any> {
  const tforms = new Map<string, any>();
  project.parts.forEach((p: any) => {
    tforms.set(p.id, {
      x: p.baseX ?? 0,
      y: p.baseY ?? 0,
      rotation: p.baseRotation ?? 0,
      scaleX: p.baseScaleX ?? 1,
      scaleY: p.baseScaleY ?? 1,
      opacity: p.opacity ?? 1,
      zIndex: p.zIndex ?? 0,
      color: 0,
    });
  });
  if (anim) {
    const dur = anim.duration || 1;
    (anim.controllers || []).forEach((c: any) => {
      if (!c.enabled) return;
      const tf = tforms.get(c.targetPartId);
      if (!tf) return;
      tf[c.property] = (tf[c.property] ?? 0) + evaluateController(c, time, dur);
    });
  }
  return tforms;
}

/**
 * Simulate spring physics for a single bone across the full animation duration and
 * return an array of {time, value} pairs where value is the absolute local rotation.
 * The caller is responsible for writing these as keyframes.
 */
export function bakePhysics(
  project: CharacterProject,
  animId: string,
  partId: string,
): { time: number; value: number }[] {
  const anim = project.animations.find((a: any) => a.id === animId);
  const part = project.parts.find((p: any) => p.id === partId) as any;
  if (!anim || !part || !part.physics) return [];

  const dur = anim.duration || 1;
  const frames = Math.ceil(dur / BAKE_DT) + 1;
  const sim = new SpringBoneSimulator();
  const result: { time: number; value: number }[] = [];

  for (let i = 0; i < frames; i++) {
    const t = Math.min(i * BAKE_DT, dur);
    const tforms = computeBakeTforms(project, anim, t);
    const matrices = buildBakeMatrices(project, tforms);

    const mat = matrices.get(partId);
    if (!mat) continue;

    const parentMat = part.parentId ? matrices.get(part.parentId) : null;
    const parentX = parentMat ? parentMat.e : 0;
    const parentY = parentMat ? parentMat.f : 0;
    const parentAngle = parentMat
      ? Math.atan2(parentMat.b, parentMat.a) * (180 / Math.PI)
      : 0;

    const boneLength = Math.sqrt((part.baseX ?? 0) ** 2 + (part.baseY ?? 0) ** 2) || 40;

    const localRot = sim.update(
      partId,
      boneLength,
      part.physics,
      parentX,
      parentY,
      parentAngle,
      mat.e,
      mat.f,
      BAKE_DT,
    );

    result.push({ time: t, value: localRot });
  }

  return result;
}
