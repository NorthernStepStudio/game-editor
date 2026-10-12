"""Paint over a one-piece (image-to-3D) model's face from the front: map the face, or replace its mouth with the
roster's small curved smile, written straight into the colour texture so the model stays one rig-ready piece.

Usage: blender --background --factory-startup --python face_paint.py -- map       <in.glb> <out_dir>
       blender --background --factory-startup --python face_paint.py -- smile     <in.glb> <out.glb> <spec.json>
       blender --background --factory-startup --python face_paint.py -- autosmile <in.glb> <out.glb> <report.json>

map writes face_map.png (the model's colours seen from the front, 1 px = 0.5 mm, top row = highest z) and
face_map.json (the grid's origin and step, so pixels convert to model x, z).
smile reads spec.json: {"erase": [x0, z0, x1, z1] (model metres, the old mouth),
                        "center": [x, z], "width": w, "depth": d, "thickness": t, "color": [r, g, b] (0-1, sRGB)}
and paints: skin over "erase" (colour sampled just around it), then a smile curve that dips "depth" at its middle.
autosmile finds the two eyes on the face map itself and places the roster smile from them, in the proportions of
Yun's approved face (spec written to the report); if it cannot find a clear pair of eyes it changes nothing.
"""
import json
import math
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

args = sys.argv[sys.argv.index("--") + 1:]
MODE, SRC = args[0], args[1]
STEP = 0.0005

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
mesh = obj.data
bm = bmesh.new()
bm.from_mesh(mesh)
bmesh.ops.triangulate(bm, faces=bm.faces)
bm.to_mesh(mesh)
bm.free()
mesh.update()
uv = mesh.uv_layers.active.data
mat = obj.active_material
tex = next(n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and any(
    l.to_socket.name == "Base Color" for o in n.outputs for l in o.links))
img = tex.image
W, H = img.size
px = np.empty(W * H * 4, dtype=np.float32)
img.pixels.foreach_get(px)
px = px.reshape(H, W, 4)
verts = [v.co.copy() for v in mesh.vertices]
polys = [(tuple(p.vertices), tuple(p.loop_indices)) for p in mesh.polygons]
tree = BVHTree.FromPolygons(verts, [p[0] for p in polys])
lo = Vector(map(min, *verts))
hi = Vector(map(max, *verts))


def uv_at(face, point):
    (a, b, c), (la, lb, lc) = polys[face]
    ua, ub, uc = (Vector((uv[l].uv.x, uv[l].uv.y, 0)) for l in (la, lb, lc))
    return barycentric_transform(point, verts[a], verts[b], verts[c], ua, ub, uc)


def texel(u):
    return min(W - 1, max(0, int(u.x * W))), min(H - 1, max(0, int(u.y * H)))


def front_hit(x, z):
    hit = tree.ray_cast(Vector((x, lo.y - 1, z)), Vector((0, 1, 0)), 10)
    return hit if hit[0] is not None else None


def face_map_grid():
    """The model's colours seen from the front over the head (top row = highest z), with the grid's origin."""
    x0, x1 = lo.x * 0.6, hi.x * 0.6
    z0, z1 = lo.z + (hi.z - lo.z) * 0.45, hi.z
    cols, rows = int((x1 - x0) / STEP), int((z1 - z0) / STEP)
    grid = np.zeros((rows, cols, 4), dtype=np.float32)
    for r in range(rows):
        z = z1 - r * STEP
        for c in range(cols):
            hit = front_hit(x0 + c * STEP, z)
            if hit:
                tx, ty = texel(uv_at(hit[2], hit[0]))
                grid[r, c] = px[ty, tx]
    return grid, x0, z1


def grow(mask, within):
    out = mask.copy()
    while True:
        nxt = out.copy()
        nxt[1:] |= out[:-1]
        nxt[:-1] |= out[1:]
        nxt[:, 1:] |= out[:, :-1]
        nxt[:, :-1] |= out[:, 1:]
        nxt &= within
        if np.array_equal(nxt, out):
            return out
        out = nxt


def find_eyes(grid):
    """Two dark, eye-sized blobs ringed by lighter skin, side by side: (left, right) as (cx, cy, top, bottom) px."""
    lum = grid[:, :, :3] @ np.array([0.3, 0.59, 0.11], dtype=np.float32)
    dark = (lum < 0.16) & (grid[:, :, 3] > 0)
    # brows and hair strands often touch the eyes: thin dark lines are removed first (an opening), eyes are far thicker
    opened = dark.copy()
    for _ in range(6):
        opened[1:-1, 1:-1] &= opened[:-2, 1:-1] & opened[2:, 1:-1] & opened[1:-1, :-2] & opened[1:-1, 2:]
    for _ in range(6):
        opened[1:] |= opened[:-1]; opened[:-1] |= opened[1:]; opened[:, 1:] |= opened[:, :-1]; opened[:, :-1] |= opened[:, 1:]
    dark = opened & dark
    blobs, rest = [], dark.copy()
    while rest.any() and len(blobs) < 400:
        seed = np.zeros_like(rest)
        seed.flat[int(np.argmax(rest))] = True
        blob = grow(seed, rest)
        rest &= ~blob
        area = int(blob.sum())
        if not 800 <= area <= 20000:  # eyes are 0.02-0.5 % of a head-sized grid; hair masses are far bigger
            continue
        ys, xs = np.nonzero(blob)
        h_, w_ = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
        if not 0.8 <= h_ / w_ <= 3.0:  # chibi eyes are round to tall ovals
            continue
        # most of the surroundings must be skin, not more hair: right around the eye, or (behind glasses) just
        # outside the frame
        grown = [blob.copy()]
        for _ in range(18):
            g = grown[-1].copy()
            g[1:] |= g[:-1]; g[:-1] |= g[1:]; g[:, 1:] |= g[:, :-1]; g[:, :-1] |= g[:, 1:]
            grown.append(g)
        near, far = grown[6] & ~blob, grown[18] & ~grown[12]
        if (lum[near] > 0.25).mean() < 0.5 and (lum[far] > 0.25).mean() < 0.6:
            continue
        blobs.append((xs.mean(), ys.mean(), ys.min(), ys.max(), area))
    best = None
    for i in range(len(blobs)):
        for j in range(len(blobs)):
            a, b = blobs[i], blobs[j]
            if a[0] >= b[0] or abs(a[1] - b[1]) > 0.35 * (a[3] - a[2]) or max(a[4], b[4]) > 1.7 * min(a[4], b[4]):
                continue
            if best is None or a[4] + b[4] > best[0][4] + best[1][4]:
                best = (a, b)
    return best


if MODE == "autosmile":
    OUT, REPORT_FILE = args[2], args[3]
    grid, gx0, gz1 = face_map_grid()
    eyes = find_eyes(grid)
    if not eyes:
        json.dump({"ok": False, "reason": "no clear pair of eyes on the face"}, open(REPORT_FILE, "w"))
        print("AUTOSMILE_SKIP")
        sys.exit(0)
    (lx, ly, lt, lb, _), (rx, ry, rt, rb, _) = eyes
    to_x = lambda c: gx0 + c * STEP
    to_z = lambda r: gz1 - r * STEP
    dist = (rx - lx) * STEP
    mid_x = to_x((lx + rx) / 2)
    eye_bottom = to_z((lb + rb) / 2)
    # Yun's approved face, measured in eye spacings: smile 0.33 wide, its ends 0.085 below the eyes' bottom
    spec = {
        "erase": [mid_x - 0.25 * dist, eye_bottom - 0.32 * dist, mid_x + 0.25 * dist, eye_bottom - 0.01 * dist],
        "center": [mid_x, eye_bottom - 0.085 * dist],
        "width": 0.33 * dist, "depth": 0.098 * dist, "thickness": 0.075 * dist, "color": [0.44, 0.12, 0.14],
    }
    json.dump({"ok": True, "eyes": {"spacing": round(dist, 4), "bottom": round(eye_bottom, 4), "middle": round(mid_x, 4)}, "spec": spec},
              open(REPORT_FILE, "w"), indent=1)
    MODE = "smile"
    args = [MODE, SRC, OUT, None]

if MODE == "map":
    out = args[2]
    # the head: the top 55 % of the model, the middle 60 % of its width
    x0, x1 = lo.x * 0.6, hi.x * 0.6
    z0, z1 = lo.z + (hi.z - lo.z) * 0.45, hi.z
    cols, rows = int((x1 - x0) / STEP), int((z1 - z0) / STEP)
    face_map = np.zeros((rows, cols, 4), dtype=np.float32)
    for r in range(rows):
        z = z1 - r * STEP
        for c in range(cols):
            hit = front_hit(x0 + c * STEP, z)
            if hit:
                tx, ty = texel(uv_at(hit[2], hit[0]))
                face_map[r, c] = px[ty, tx]
    out_img = bpy.data.images.new("FaceMap", cols, rows, alpha=True)
    out_img.pixels.foreach_set(face_map[::-1].ravel())
    out_img.filepath_raw = out + "/face_map.png"
    out_img.file_format = "PNG"
    out_img.save()
    json.dump({"x0": x0, "zTop": z1, "step": STEP, "cols": cols, "rows": rows,
               "size": [round(c, 4) for c in (hi - lo)]}, open(out + "/face_map.json", "w"), indent=1)
    print("MAP_OK", cols, rows)
    sys.exit(0)

# ------------------------------------------------------------------ smile
OUT = args[2]
spec = spec if MODE == "smile" and args[3] is None else json.load(open(args[3]))
ex0, ez0, ex1, ez1 = spec["erase"]
cx, cz = spec["center"]
half_w, depth, thick = spec["width"] / 2, spec["depth"], spec["thickness"]
ink = np.array(list(spec["color"]) + [1.0], dtype=np.float32)


def smile_distance(x, z):
    """Distance from (x, z) to the smile: a shallow U, z = cz - depth * (1 - (x/half)^2), with round ends."""
    best = 1e9
    for i in range(41):
        t = -1 + i / 20
        sx, sz = cx + t * half_w, cz - depth * (1 - t * t)
        best = min(best, math.hypot(x - sx, z - sz))
    return best


# skin colour: the median texel just outside the erase box
ring = []
pad = 0.004
for i in range(60):
    for (x, z) in ((ex0 - pad + (ex1 - ex0 + 2 * pad) * i / 59, ez0 - pad), (ex0 - pad + (ex1 - ex0 + 2 * pad) * i / 59, ez1 + pad),
                   (ex0 - pad, ez0 - pad + (ez1 - ez0 + 2 * pad) * i / 59), (ex1 + pad, ez0 - pad + (ez1 - ez0 + 2 * pad) * i / 59)):
        hit = front_hit(x, z)
        if hit:
            tx, ty = texel(uv_at(hit[2], hit[0]))
            ring.append(px[ty, tx])
skin = np.median(np.array(ring), axis=0)
skin[3] = 1.0
print("SKIN", [round(float(c), 3) for c in skin])

# paint every texel of the front-facing triangles under the mouth area, in texture space (no gaps)
reach = max(ex1 - ex0, ez1 - ez0, spec["width"]) + 0.01
front_faces = set()
for i in range(int(reach * 2 / STEP)):
    for j in range(int(reach * 2 / STEP)):
        hit = front_hit(cx - reach + i * STEP, cz - reach + j * STEP)
        if hit:
            front_faces.add(hit[2])
painted = 0
for face in front_faces:
    (a, b, c), (la, lb, lc) = polys[face]
    uvs = [Vector((uv[l].uv.x * W, uv[l].uv.y * H, 0)) for l in (la, lb, lc)]
    bx0, by0 = int(min(u.x for u in uvs)), int(min(u.y for u in uvs))
    bx1, by1 = int(max(u.x for u in uvs)) + 1, int(max(u.y for u in uvs)) + 1
    for ty in range(max(0, by0), min(H, by1 + 1)):
        for tx in range(max(0, bx0), min(W, bx1 + 1)):
            p = Vector((tx + 0.5, ty + 0.5, 0))
            # inside the UV triangle?
            d = [((uvs[(k + 1) % 3] - uvs[k]).cross(p - uvs[k])).z for k in range(3)]
            if not (all(v >= -0.5 for v in d) or all(v <= 0.5 for v in d)):
                continue
            pos = barycentric_transform(p, uvs[0], uvs[1], uvs[2], verts[a], verts[b], verts[c])
            colour = None
            if ex0 <= pos.x <= ex1 and ez0 <= pos.z <= ez1:
                colour = skin
            dist = smile_distance(pos.x, pos.z)
            if dist < thick / 2 + 0.0004:
                cover = min(1.0, max(0.0, (thick / 2 + 0.0004 - dist) / 0.0008))  # soft edge
                base = colour if colour is not None else px[ty, tx]
                colour = base * (1 - cover) + ink * cover
            if colour is not None:
                px[ty, tx] = colour
                painted += 1
img.pixels.foreach_set(px.ravel())
img.update()
img.pack()
obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True)
print("SMILE_OK texels=%d faces=%d" % (painted, len(front_faces)))
