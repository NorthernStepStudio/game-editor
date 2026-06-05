import { CharacterPart } from '../../../../packages/nstep-motion-core/src/schema/types';

export function getChildrenMap(parts: CharacterPart[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  parts.forEach(p => {
    if (p.parentId) {
      if (!map.has(p.parentId)) map.set(p.parentId, []);
      map.get(p.parentId)!.push(p.id);
    }
  });
  return map;
}

export function getDescendantPartIds(parts: CharacterPart[], partId: string): string[] {
  const childrenMap = getChildrenMap(parts);
  const descendants: string[] = [];
  
  const recurse = (id: string) => {
    const kids = childrenMap.get(id) || [];
    kids.forEach(k => {
      descendants.push(k);
      recurse(k);
    });
  };
  
  recurse(partId);
  return descendants;
}

export function computeAllWorldMatrices(parts: CharacterPart[], canvasWidth: number, canvasHeight: number): Map<string, DOMMatrix> {
  const partsMap = new Map<string, CharacterPart>();
  const childrenMap = getChildrenMap(parts);
  const rootParts: string[] = [];

  parts.forEach(p => {
    partsMap.set(p.id, p);
    if (!p.parentId) {
      rootParts.push(p.id);
    }
  });

  const matrices = new Map<string, DOMMatrix>();
  const rootMatrix = new DOMMatrix().translate(canvasWidth / 2, canvasHeight / 2);

  const compute = (partId: string, parentMatrix: DOMMatrix) => {
    const part = partsMap.get(partId);
    if (!part) return;

    // If inheritTransform is false, it behaves like a root part (relative to rootMatrix)
    const effectiveParentMatrix = (part.inheritTransform === false) ? rootMatrix : parentMatrix;

    const m = DOMMatrix.fromMatrix(effectiveParentMatrix);
    m.translateSelf(part.baseX ?? 0, part.baseY ?? 0);
    m.rotateSelf(part.baseRotation ?? 0);
    m.scaleSelf(part.baseScaleX ?? 1, part.baseScaleY ?? 1);
    
    matrices.set(partId, m);

    const kids = childrenMap.get(partId) || [];
    kids.forEach(k => compute(k, m));
  };

  rootParts.forEach(root => compute(root, rootMatrix));
  return matrices;
}

export function decomposeMatrix2D(m: DOMMatrix): { x: number; y: number; rotation: number; scaleX: number; scaleY: number } {
  const a = m.a;
  const b = m.b;
  const c = m.c;
  const d = m.d;
  const e = m.e;
  const f = m.f;

  const scaleX = Math.sqrt(a * a + b * b);
  const scaleY = Math.sqrt(c * c + d * d);
  
  // Rotation in degrees
  const rotation = Math.atan2(b, a) * 180 / Math.PI;

  return {
    x: e,
    y: f,
    rotation: rotation,
    scaleX: scaleX,
    scaleY: scaleY
  };
}

export function preserveDescendantWorldTransforms(
  selectedPartId: string,
  parts: CharacterPart[],
  oldWorldMatrices: Map<string, DOMMatrix>,
  canvasWidth: number,
  canvasHeight: number
) {
  const descendants = getDescendantPartIds(parts, selectedPartId);
  if (descendants.length === 0) return;

  // We iterate descendants in tree-topological order (returned by getDescendantPartIds)
  // because each parent must be adjusted before we adjust its children.
  descendants.forEach(childId => {
    const child = parts.find(p => p.id === childId);
    if (!child) return;

    // If the child ignores parent transforms, it already maintains its position
    if (child.inheritTransform === false) {
      return;
    }

    // Get the current (partially updated) world matrix of the child's parent
    const newWorldMatrices = computeAllWorldMatrices(parts, canvasWidth, canvasHeight);
    const parentWorldMatrix = child.parentId ? newWorldMatrices.get(child.parentId) : null;
    const oldWorldMatrix = oldWorldMatrices.get(childId);

    if (oldWorldMatrix && parentWorldMatrix) {
      try {
        // newLocalMatrix = parentWorldMatrix.inverse() * oldWorldMatrix
        const newLocalMatrix = parentWorldMatrix.inverse().multiply(oldWorldMatrix);
        const decomposed = decomposeMatrix2D(newLocalMatrix);

        child.baseX = parseFloat(decomposed.x.toFixed(4));
        child.baseY = parseFloat(decomposed.y.toFixed(4));
        child.baseRotation = parseFloat(decomposed.rotation.toFixed(4));
        child.baseScaleX = parseFloat(decomposed.scaleX.toFixed(4));
        child.baseScaleY = parseFloat(decomposed.scaleY.toFixed(4));
      } catch (err) {
        console.error('Matrix inverse failed for compensation on ' + childId, err);
      }
    }
  });
}

export function sortPartsByZIndex(parts: CharacterPart[]): CharacterPart[] {
  return [...parts].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}
