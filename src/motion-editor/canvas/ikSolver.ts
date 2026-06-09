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
 * FABRIK (Forward And Backward Reaching IK) solver for N-bone chains.
 *
 * @param joints  Array of N+1 joint positions [root, j1, …, jN-1, tip].
 *                joints[0] is pinned (the root) and joints[N] is the end-effector.
 * @param lengths Array of N bone lengths: lengths[i] is the distance from joints[i] to joints[i+1].
 * @param targetX Target world X for the end-effector (joints[N]).
 * @param targetY Target world Y for the end-effector (joints[N]).
 * @returns       New joint positions after FABRIK convergence.
 */
export function solveFABRIK(
  joints: Array<{x: number; y: number}>,
  lengths: number[],
  targetX: number,
  targetY: number,
  maxIter = 10,
  tolerance = 0.5,
  fixedIndices: ReadonlySet<number> = new Set()
): Array<{x: number; y: number}> {
  const n = joints.length;
  const pos = joints.map(j => ({x: j.x, y: j.y}));
  const root = {x: pos[0].x, y: pos[0].y};
  // Snapshot positions for FK-overridden joints so we can restore them each pass
  const fixed = new Map<number, {x: number; y: number}>();
  fixedIndices.forEach(i => { if (i > 0 && i < n - 1) fixed.set(i, {x: pos[i].x, y: pos[i].y}); });

  for (let iter = 0; iter < maxIter; iter++) {
    // ── Forward pass: move end to target, cascade backward ──────────────────
    pos[n - 1] = {x: targetX, y: targetY};
    for (let i = n - 2; i >= 0; i--) {
      if (fixed.has(i)) { pos[i] = {x: fixed.get(i)!.x, y: fixed.get(i)!.y}; continue; }
      const dx = pos[i].x - pos[i + 1].x;
      const dy = pos[i].y - pos[i + 1].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const r = lengths[i] / dist;
      pos[i] = {x: pos[i + 1].x + dx * r, y: pos[i + 1].y + dy * r};
    }
    // ── Backward pass: pin root, cascade forward ─────────────────────────────
    pos[0] = root;
    for (let i = 0; i < n - 1; i++) {
      if (fixed.has(i + 1)) { pos[i + 1] = {x: fixed.get(i + 1)!.x, y: fixed.get(i + 1)!.y}; continue; }
      const dx = pos[i + 1].x - pos[i].x;
      const dy = pos[i + 1].y - pos[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const r = lengths[i] / dist;
      pos[i + 1] = {x: pos[i].x + dx * r, y: pos[i].y + dy * r};
    }
    // ── Convergence check ─────────────────────────────────────────────────────
    const edx = pos[n - 1].x - targetX;
    const edy = pos[n - 1].y - targetY;
    if (Math.sqrt(edx * edx + edy * edy) < tolerance) break;
  }

  return pos;
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
