import { Vertex2D, PartMesh } from '@nstep-core/schema/types';

function circumcircle(
  a: Vertex2D, b: Vertex2D, c: Vertex2D
): { cx: number; cy: number; r2: number } | null {
  const ax = b.x - a.x, ay = b.y - a.y;
  const bx = c.x - a.x, by = c.y - a.y;
  const D = 2 * (ax * by - ay * bx);
  if (Math.abs(D) < 1e-10) return null;
  const ux = (by * (ax * ax + ay * ay) - ay * (bx * bx + by * by)) / D;
  const uy = (ax * (bx * bx + by * by) - bx * (ax * ax + ay * ay)) / D;
  return { cx: a.x + ux, cy: a.y + uy, r2: ux * ux + uy * uy };
}

export function delaunayTriangulate(pts: Vertex2D[]): number[][] {
  const n = pts.length;
  if (n < 3) return [];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach(p => {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  });

  const dx = maxX - minX, dy = maxY - minY;
  const d = Math.max(dx, dy) * 3 + 1;
  const mx = (minX + maxX) / 2, my = (minY + maxY) / 2;

  const all: Vertex2D[] = [
    ...pts,
    { x: mx,     y: my - d * 1.5 },
    { x: mx - d, y: my + d },
    { x: mx + d, y: my + d },
  ];
  const si = n, sj = n + 1, sk = n + 2;

  let tris: [number, number, number][] = [[si, sj, sk]];

  for (let pi = 0; pi < n; pi++) {
    const p = all[pi];
    const bad: [number, number, number][] = [];
    const good: [number, number, number][] = [];

    for (const t of tris) {
      const cc = circumcircle(all[t[0]], all[t[1]], all[t[2]]);
      if (!cc) { good.push(t); continue; }
      const ddx = p.x - cc.cx, ddy = p.y - cc.cy;
      if (ddx * ddx + ddy * ddy <= cc.r2 + 1e-10) bad.push(t);
      else good.push(t);
    }

    const edges = new Map<string, [number, number]>();
    for (const t of bad) {
      const sides: [number, number][] = [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]];
      for (const [a, b] of sides) {
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        if (edges.has(key)) edges.delete(key);
        else edges.set(key, [a, b]);
      }
    }

    tris = good;
    for (const [a, b] of edges.values()) tris.push([a, b, pi]);
  }

  return tris
    .filter(t => t[0] < n && t[1] < n && t[2] < n)
    .map(t => [t[0], t[1], t[2]]);
}

export function createDefaultMesh(width: number, height: number): PartMesh {
  const w = Math.max(width, 1), h = Math.max(height, 1);
  const vertices: Vertex2D[] = [
    { x: 0,     y: 0 },
    { x: w,     y: 0 },
    { x: w,     y: h },
    { x: 0,     y: h },
    { x: w / 2, y: h / 2 },
  ];
  const triangles = delaunayTriangulate(vertices);
  const boneWeights: Record<string, number>[] = vertices.map(() => ({}));
  return { vertices, triangles, boneWeights };
}
