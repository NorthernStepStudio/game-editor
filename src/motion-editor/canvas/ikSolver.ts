/**
 * Analytical 2-bone IK solver.
 *
 * Given:
 *  - root position (world space)
 *  - bone1 length, bone2 length
 *  - target position (world space)
 *  - bendDirection (+1 = left-of-chain, -1 = right-of-chain)
 *
 * Returns angles (degrees) for bone1 and bone2 in local space.
 */
export interface IKResult {
  bone1AngleDeg: number;
  bone2AngleDeg: number;
  reachable: boolean;
}

export function solve2BoneIK(
  rootX: number,
  rootY: number,
  bone1Length: number,
  bone2Length: number,
  targetX: number,
  targetY: number,
  bendDir: number = 1
): IKResult {
  const dx = targetX - rootX;
  const dy = targetY - rootY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const maxReach = bone1Length + bone2Length;
  const minReach = Math.abs(bone1Length - bone2Length);

  // Clamp to reachable range
  const clampedDist = Math.max(minReach + 0.001, Math.min(maxReach - 0.001, dist));
  const reachable   = dist <= maxReach && dist >= minReach;

  // Angle from root to target
  const targetAngle = Math.atan2(dy, dx);

  // Law of cosines to find knee angle
  const cosAngle1 = (bone1Length * bone1Length + clampedDist * clampedDist - bone2Length * bone2Length)
    / (2 * bone1Length * clampedDist);
  const cosAngle2 = (bone1Length * bone1Length + bone2Length * bone2Length - clampedDist * clampedDist)
    / (2 * bone1Length * bone2Length);

  const a1 = Math.acos(Math.max(-1, Math.min(1, cosAngle1)));
  const a2 = Math.acos(Math.max(-1, Math.min(1, cosAngle2)));

  const bone1Angle = targetAngle - bendDir * a1;
  const bone2Angle = Math.PI - bendDir * a2;

  return {
    bone1AngleDeg: bone1Angle * (180 / Math.PI),
    bone2AngleDeg: bone2Angle * (180 / Math.PI),
    reachable,
  };
}

/**
 * Given a chain of part IDs (root → mid → end), world matrices, and a target position,
 * returns the corrected local rotations for root and mid bones.
 */
export function resolveIKChain(
  rootPartId: string,
  midPartId: string,
  targetX: number,
  targetY: number,
  partsMap: Map<string, any>,
  matrices: Map<string, DOMMatrix>,
  bendDir: number = 1
): { rootRot: number; midRot: number } | null {
  const rootPart = partsMap.get(rootPartId);
  const midPart  = partsMap.get(midPartId);
  if (!rootPart || !midPart) return null;

  const rootMat = matrices.get(rootPartId);
  if (!rootMat) return null;

  // Estimate bone lengths from base positions
  const bone1Len = Math.sqrt(
    (midPart.baseX - rootPart.baseX) ** 2 +
    (midPart.baseY - rootPart.baseY) ** 2
  ) || 40;

  // For 2-bone, we assume bone2 length equals bone1 length as fallback
  const bone2Len = bone1Len;

  const rootWorldX = rootMat.e;
  const rootWorldY = rootMat.f;

  const result = solve2BoneIK(rootWorldX, rootWorldY, bone1Len, bone2Len, targetX, targetY, bendDir);

  return {
    rootRot: result.bone1AngleDeg,
    midRot:  result.bone2AngleDeg,
  };
}
