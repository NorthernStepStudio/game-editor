import type { CharacterProject, CharacterAnimation } from '../schema/types.js';
import { evaluateController } from './evaluateController.js';

const BLEND_PROPS = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity', 'zIndex', 'color'] as const;

export function computeAnimTransforms(
  project: CharacterProject,
  anim: CharacterAnimation,
  time: number
): Map<string, Record<string, number>> {
  const tforms = new Map<string, Record<string, number>>();
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

  const dur = anim.duration || 1;
  (anim.controllers as any[]).forEach((c: any) => {
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

  tforms.forEach(tform => {
    tform.zIndex = Math.round(tform.zIndex);
    tform.color  = Math.max(0, Math.min(1, tform.color));
  });

  return tforms;
}

/**
 * Blend two animations by lerping every property channel.
 *
 * @param project  The character project (provides part base values)
 * @param animA    First animation (weight=0 → full A)
 * @param animB    Second animation (weight=1 → full B)
 * @param weight   Blend weight: 0 = full A, 1 = full B
 * @param timeA    Playback time in animation A
 * @param timeB    Playback time in animation B
 * @returns        Merged transform map for all parts
 */
export function blendAnimations(
  project: CharacterProject,
  animA: CharacterAnimation,
  animB: CharacterAnimation,
  weight: number,
  timeA: number,
  timeB: number
): Map<string, Record<string, number>> {
  const w = Math.max(0, Math.min(1, weight));
  const tA = computeAnimTransforms(project, animA, timeA);
  const tB = computeAnimTransforms(project, animB, timeB);

  const result = new Map<string, Record<string, number>>();
  for (const part of project.parts) {
    const a = tA.get(part.id);
    const b = tB.get(part.id);
    if (!a && !b) continue;
    if (!a) { result.set(part.id, { ...(b as Record<string, number>) }); continue; }
    if (!b) { result.set(part.id, { ...a }); continue; }
    const blended: Record<string, number> = {};
    for (const prop of BLEND_PROPS) {
      blended[prop] = a[prop] + (b[prop] - a[prop]) * w;
    }
    blended.zIndex = Math.round(blended.zIndex);
    blended.color  = Math.max(0, Math.min(1, blended.color));
    result.set(part.id, blended);
  }
  return result;
}
