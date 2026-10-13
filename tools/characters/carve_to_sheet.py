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

def align(rows):
    """Best mirror/slide of the sheet outline onto the model, judged on the given rows only."""
    pad = max(ny, cols)
    best = None
    m = model[rows]
    for mirrored in (False, True):
        sh = (sheet[:, ::-1] if mirrored else sheet)[rows]
        for shift in range(-pad, pad + 1):
            # sheet column j sits at model column j + shift
            lo_c, hi_c = max(0, shift), min(ny, cols + shift)
            if hi_c <= lo_c:
                continue
            inter = (m[:, lo_c:hi_c] & sh[:, lo_c - shift:hi_c - shift]).sum()
            iou = inter / max(m.sum() + sh.sum() - inter, 1)
            if best is None or iou > best[0]:
                best = (iou, mirrored, shift)
    return best


def outline(mirrored, shift):
    """The sheet outline at the model's place, grown by the margin."""
    s = sheet[:, ::-1] if mirrored else sheet
    allowed = np.zeros((RES, ny), dtype=bool)
    lo_c, hi_c = max(0, shift), min(ny, cols + shift)
    allowed[:, lo_c:hi_c] = s[:, lo_c - shift:hi_c - shift]
    for _ in range(max(1, int(round(MARGIN * RES)))):
        g = allowed.copy()
        g[1:] |= allowed[:-1]; g[:-1] |= allowed[1:]; g[:, 1:] |= allowed[:, :-1]; g[:, :-1] |= allowed[:, 1:]
        allowed = g
    return allowed


body = align(np.ones(RES, dtype=bool))
report.update(fit=round(float(body[0]), 3), mirrored=body[1], shift=int(body[2]))
allowed = outline(body[1], body[2])
# the head is lined up on its own (close to the body's slide), so a guessed part on it (a second cap brim) is judged
# against the head's own outline
head_rows = np.arange(RES) * step < 0.4 * height
best_head = None
for shift in range(body[2] - int(0.08 * RES), body[2] + int(0.08 * RES) + 1):
    sh = (sheet[:, ::-1] if body[1] else sheet)[head_rows]
    m = model[head_rows]
    lo_c, hi_c = max(0, shift), min(ny, cols + shift)
    if hi_c <= lo_c:
        continue
    inter = (m[:, lo_c:hi_c] & sh[:, lo_c - shift:hi_c - shift]).sum()
    iou = inter / max(m.sum() + sh.sum() - inter, 1)
    if best_head is None or iou > best_head[0]:
        best_head = (iou, shift)
head_allowed = outline(body[1], best_head[1])
report["headFit"] = round(float(best_head[0]), 3)
report["outsideBefore"] = round(float((model & ~allowed).sum() / max(model.sum(), 1)), 4)

# ---- push what sticks out back inside the outline (deleting would leave hollow shells and holes): only behind the
# body's middle and below the head, where the model's depth was guessed; the front came from the picture itself.
# Far-out parts are removed instead.
mid_y = (lo.y + hi.y) / 2
head_z = lo.z + 0.6 * height
inset = 0.01 * height
row_min = np.full(RES, -1)
row_max = np.full(RES, -1)
for r in range(RES):
    cols_ok = np.nonzero(allowed[r])[0]
    if len(cols_ok):
        row_min[r], row_max[r] = cols_ok.min(), cols_ok.max()
FAR = 0.04 * height  # beyond this, a part is invented outright (a tail, a strap) and is removed, not folded in
moved = 0
far = set()
LEG_LO, LEG_HI = lo.z + 0.05 * height, lo.z + 0.36 * height
head_max = np.full(RES, -1)
for r in range(RES):
    cols_ok = np.nonzero(head_allowed[r])[0]
    if len(cols_ok):
        head_max[r] = cols_ok.max()
for v in me.vertices:
    co = v.co
    r = min(RES - 1, max(0, int((hi.z - co.z) / step)))
    if co.z > head_z:
        # head: only remove parts far beyond its own outline (never fold: the head's shape is mostly right)
        if head_max[r] >= 0 and co.y > mid_y and co.y > lo.y + (head_max[r] + 1) * step + FAR:
            far.add(v.index)
        continue
    if row_max[r] < 0:
        continue
    back_limit = lo.y + (row_max[r] + 1) * step
    if co.y > mid_y and co.y > back_limit:
        # behind the legs, anything outside the outline is a guessed membrane (jacket hem stretched to the heels): remove
        if co.y > back_limit + FAR or LEG_LO < co.z < LEG_HI:
            far.add(v.index)
        co.y = max(mid_y, back_limit - inset)
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

# ---- shoes: their length front-to-back was guessed (the front view shows only width and height). At each height of the
# shoes, the model's shoe length is scaled evenly toward its own middle to the sheet's shoe length (never longer).
SHOE_Z = lo.z + 0.11 * height
rows_of = lambda z: min(RES - 1, max(0, int((hi.z - z) / step)))
shoe_k = {}
sheet_s = sheet[:, ::-1] if body[1] else sheet
for r in range(rows_of(SHOE_Z), RES):
    m_cols = np.nonzero(model[r])[0]
    s_cols = np.nonzero(sheet_s[r])[0]
    if len(m_cols) > 2 and len(s_cols) > 2:
        shoe_k[r] = (float(s_cols.max() - s_cols.min() + 1) * (1 + MARGIN) / float(m_cols.max() - m_cols.min() + 1),
                     lo.y + (m_cols.min() + m_cols.max() + 1) / 2 * step)
if shoe_k:
    ks = sorted(min(1.0, k) for k, _ in shoe_k.values())
    # one factor for the whole shoe (the median), so its shape is kept; never crushed below 60 %
    k_shoe = max(0.6, ks[len(ks) // 2])
    centre = float(np.median([c for _, c in shoe_k.values()]))
    for v in me.vertices:
        if v.co.z < SHOE_Z + 0.04 * height:
            # full shrink at the sole, fading out over the ankle so the leg is untouched
            t = min(1.0, max(0.0, (SHOE_Z + 0.04 * height - v.co.z) / (0.04 * height)))
            k = 1.0 - (1.0 - k_shoe) * t
            v.co.y = centre + (v.co.y - centre) * k
    report["shoeScale"] = round(k_shoe, 3)

# ---- body depth: between the ankles and the head, at each height the model's depth (front edge to back edge) is
# compressed toward its front edge to the sheet's depth there (never deepened, never below 60 %), smoothed over the
# height so the body keeps flowing. The front stays where the picture put it.
BODY_LO, BODY_HI = SHOE_Z + 0.04 * height, lo.z + 0.6 * height
ratio = np.full(RES, np.nan)
front = np.full(RES, np.nan)
for r in range(RES):
    m_cols = np.nonzero(model[r])[0]
    s_cols = np.nonzero(sheet_s[r])[0]
    if len(m_cols) > 2 and len(s_cols) > 2:
        ratio[r] = (s_cols.max() - s_cols.min() + 1) * (1 + MARGIN) / (m_cols.max() - m_cols.min() + 1)
        front[r] = lo.y + m_cols.min() * step
valid = ~np.isnan(ratio)
if valid.sum() > 10:
    idx = np.arange(RES)
    ratio = np.interp(idx, idx[valid], ratio[valid])
    front = np.interp(idx, idx[valid], front[valid])
    win = max(3, int(0.03 * RES))
    smooth_k = np.array([np.median(ratio[max(0, r - win):r + win + 1]) for r in range(RES)])
    smooth_k = np.convolve(np.pad(smooth_k, win, mode="edge"), np.ones(2 * win + 1) / (2 * win + 1), mode="valid")
    smooth_f = np.convolve(np.pad(front, win, mode="edge"), np.ones(2 * win + 1) / (2 * win + 1), mode="valid")
    smooth_k = np.clip(smooth_k, 0.6, 1.0)
    fade = 0.04 * height
    for v in me.vertices:
        z = v.co.z
        if z < BODY_LO - fade or z > BODY_HI + fade:
            continue
        w = min(1.0, (z - (BODY_LO - fade)) / fade, ((BODY_HI + fade) - z) / fade)
        r = rows_of(z)
        k = 1.0 - (1.0 - smooth_k[r]) * max(0.0, w)
        f = smooth_f[r]
        if v.co.y > f:
            v.co.y = f + (v.co.y - f) * k
    report["depthScale"] = [round(float(smooth_k[rows_of(BODY_HI)]), 2), round(float(np.median(smooth_k[rows_of(BODY_HI):rows_of(BODY_LO)])), 2), round(float(smooth_k[rows_of(BODY_LO)]), 2)]

obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True)
json.dump(report, open(REPORT_PATH, "w"), indent=1)
print("CARVED", json.dumps(report))
