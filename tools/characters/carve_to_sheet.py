"""Cut away what an image-to-3D model invented in depth: tails, double shoes, things on the back. The model was built
from the front view only, so its depth (front-to-back) is guessed; the character sheet's side view shows the true
profile. The model's side silhouette is lined up with the sheet's side cutout (scaled by height, feet on the floor,
slid sideways and mirrored to fit best); behind the body and below the head, every point beyond that outline (plus a
small margin) is pushed just inside it, so invented parts fold into the body instead of leaving holes.
Usage: blender --background --factory-startup --python carve_to_sheet.py -- <in.glb> <side_cutout.png> <out.glb> <report.json> [margin=0.02]
side_cutout.png: the sheet's side view with a transparent background (Matterhorn's "prepare" cutout).
"""
import json
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index("--") + 1:]
SRC, SIDE, OUT, REPORT_PATH = args[:4]
MARGIN = float(args[4]) if len(args) > 4 else 0.02
report = {}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
me = obj.data
verts = [v.co.copy() for v in me.vertices]
lo, hi = Vector(map(min, *verts)), Vector(map(max, *verts))
height = hi.z - lo.z

# ---- the model's side silhouette (y across, z up), cast along x
RES = 300
step = height / RES
tree = BVHTree.FromPolygons(verts, [p.vertices[:] for p in me.polygons])
ny = int((hi.y - lo.y) / step) + 1
model = np.zeros((RES, ny), dtype=bool)
for r in range(RES):
    z = hi.z - (r + 0.5) * step
    for c in range(ny):
        y = lo.y + (c + 0.5) * step
        model[r, c] = tree.ray_cast(Vector((lo.x - 1, y, z)), Vector((1, 0, 0)), 10)[0] is not None

# ---- the sheet's side silhouette, scaled to the same pixels per metre
img = bpy.data.images.load(SIDE)
w, h = img.size
px = np.empty(w * h * 4, dtype=np.float32)
img.pixels.foreach_get(px)
alpha = px.reshape(h, w, 4)[::-1, :, 3] > 0.5
ys, xs = np.nonzero(alpha)
alpha = alpha[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
scale = alpha.shape[0] / RES
cols = max(1, int(round(alpha.shape[1] / scale)))
ri = np.minimum((np.arange(RES) * scale).astype(int), alpha.shape[0] - 1)
ci = np.minimum((np.arange(cols) * scale).astype(int), alpha.shape[1] - 1)
sheet = alpha[ri][:, ci]

# ---- line them up: mirror or not, slide sideways; judged on the whole body
pad = max(ny, cols)
best = None
for mirrored in (False, True):
    s = sheet[:, ::-1] if mirrored else sheet
    for shift in range(-pad, pad + 1):
        # sheet column j sits at model column j + shift
        lo_c, hi_c = max(0, shift), min(ny, cols + shift)
        if hi_c <= lo_c:
            continue
        a = model[:, lo_c:hi_c]
        b = s[:, lo_c - shift:hi_c - shift]
        inter = (a & b).sum()
        union = model.sum() + s.sum() - inter
        iou = inter / max(union, 1)
        if best is None or iou > best[0]:
            best = (iou, mirrored, shift)
iou, mirrored, shift = best
s = sheet[:, ::-1] if mirrored else sheet
report.update(fit=round(float(iou), 3), mirrored=mirrored, shift=int(shift))

# allowed area: the sheet outline grown by the margin
allowed = np.zeros((RES, ny), dtype=bool)
lo_c, hi_c = max(0, shift), min(ny, cols + shift)
allowed[:, lo_c:hi_c] = s[:, lo_c - shift:hi_c - shift]
grow = max(1, int(round(MARGIN * RES)))
for _ in range(grow):
    g = allowed.copy()
    g[1:] |= allowed[:-1]; g[:-1] |= allowed[1:]; g[:, 1:] |= allowed[:, :-1]; g[:, :-1] |= allowed[:, 1:]
    allowed = g
report["outsideBefore"] = round(float((model & ~allowed).sum() / max(model.sum(), 1)), 4)

# ---- push what sticks out back inside the outline (deleting would leave hollow shells and holes): only behind the
# body's middle and below the head, where the model's depth was guessed; the front came from the picture itself
mid_y = (lo.y + hi.y) / 2
head_z = lo.z + 0.6 * height
inset = 0.01 * height
row_max = np.full(RES, -1)
for r in range(RES):
    cols_ok = np.nonzero(allowed[r])[0]
    if len(cols_ok):
        row_max[r] = cols_ok.max()
FAR = 0.04 * height  # beyond this, a part is invented outright (a tail, a strap) and is removed, not folded in
moved = 0
far = set()
for v in me.vertices:
    co = v.co
    if co.z > head_z or co.y <= mid_y:
        continue
    r = min(RES - 1, max(0, int((hi.z - co.z) / step)))
    if row_max[r] < 0:
        continue
    limit = lo.y + (row_max[r] + 1) * step
    if co.y > limit:
        if co.y > limit + FAR:
            far.add(v.index)
        co.y = max(mid_y, limit - inset)
        moved += 1
report["verticesMoved"] = moved
import bmesh
bm = bmesh.new()
bm.from_mesh(me)
bm.verts.ensure_lookup_table()
doomed = [f for f in bm.faces if all(v.index in far for v in f.verts)]
bmesh.ops.delete(bm, geom=doomed, context="FACES")
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
bm.to_mesh(me)
bm.free()
report["facesRemoved"] = len(doomed)
me.update()
obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True)
json.dump(report, open(REPORT_PATH, "w"), indent=1)
print("CARVED", json.dumps(report))
