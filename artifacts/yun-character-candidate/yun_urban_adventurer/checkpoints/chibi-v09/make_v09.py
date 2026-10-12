"""Yun v09 from v07: wide jaw (width only), and the hair rebuilt as one curly crown like the owner's sheet.
Usage: blender --background --factory-startup --python yun_v09.py -- <v07.blend> <out_dir> <base>
"""
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

SRC, OUT, BASE = sys.argv[sys.argv.index("--") + 1:][:3]
TARGET_HEIGHT = 0.672
bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
objs = {o.name: o for o in scene.objects if o.type == "MESH"}


def world_pts(o):
    return [o.matrix_world @ v.co for v in o.data.vertices]


def islands(bm):
    seen, parts = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, island = [v], []
        seen.add(v.index)
        while stack:
            cur = stack.pop()
            island.append(cur)
            for e in cur.link_edges:
                other = e.other_vert(cur)
                if other.index not in seen:
                    seen.add(other.index)
                    stack.append(other)
        parts.append(island)
    return parts


# ---------------------------------------------------------------- 1. jaw: full width down to the chin (x only)
head = objs["Head"]
bm = bmesh.new()
bm.from_mesh(head.data)
bm.verts.ensure_lookup_table()
main = max(islands(bm), key=len)
mw, inv = head.matrix_world, head.matrix_world.inverted()
pts = [mw @ v.co for v in main]
z0, z1 = min(p.z for p in pts), max(p.z for p in pts)
cx = sum(p.x for p in pts) / len(pts)
cy = sum(p.y for p in pts) / len(pts)
hw = max(abs(p.x - cx) for p in pts)          # widest half-width (cheeks)
hd = max(abs(p.y - cy) for p in pts)
bands = 40
cur = []
for b in range(bands):
    sel = [p for p in pts if b / bands <= (p.z - z0) / (z1 - z0) <= (b + 1) / bands + 1e-6]
    cur.append(max((abs(p.x - cx) for p in sel), default=hw))
for v in main:
    p = mw @ v.co
    t = (p.z - z0) / (z1 - z0)
    if t >= 0.35:
        continue
    want = hw if t >= 0.07 else hw * (0.92 + 0.08 * t / 0.07)
    s = want / max(cur[min(int(t * bands), bands - 1)], 1e-6)
    if s > 1.0:
        p.x = cx + (p.x - cx) * s
        v.co = inv @ p
bm.to_mesh(head.data)
bm.free()

# hoops hang from the sides of the jaw
ear = objs.get("Earrings")
if ear:
    bm = bmesh.new()
    bm.from_mesh(ear.data)
    emw = ear.matrix_world
    for island in islands(bm):
        c = sum((emw @ v.co for v in island), Vector()) / len(island)
        side = 1 if c.x > 0 else -1
        inner = min(abs((emw @ v.co).x) for v in island)
        dx = side * max(0.0, hw + 0.004 - inner)
        for v in island:
            p = emw @ v.co
            p.x += dx
            v.co = emw.inverted() @ p
    bm.to_mesh(ear.data)
    bm.free()

# ---------------------------------------------------------------- 2. hair: one curly crown
old = objs["Hair_Curls"]
material = old.data.materials[0] if old.data.materials else None
brows = world_pts(objs["Eyebrows"])
brow_top = max(p.z for p in brows)
ears = [p for p in world_pts(head) if abs(p.x - cx) > hw * 0.85 and z0 + 0.05 < p.z < z0 + 0.2]
ear_top = max((p.z for p in ears), default=z0 + 0.13)
bpy.data.objects.remove(old, do_unlink=True)

centre = Vector((cx, cy, (z0 + z1) / 2 - 0.005))
# a low, wide crown of big curls (the owner's Yun), not a tall dome
rx, ry, rz = hw - 0.006, hd - 0.006, (z1 - z0) / 2 - 0.005
curl_r = 0.056
hairline_front = brow_top + 0.012
hairline_side = ear_top + 0.005
hairline_back = z0 + 0.06


def hairline(d):
    facing = -d.y / max(math.hypot(d.x, d.y), 1e-6)  # 1 = front, -1 = back
    if facing >= 0:
        return hairline_side + (hairline_front - hairline_side) * facing ** 1.5
    return hairline_side + (hairline_back - hairline_side) * (-facing)


from mathutils.bvhtree import BVHTree

# The head is a rounded box: the hair follows its real surface, not a sphere.
head_bm = bmesh.new()
head_bm.from_mesh(head.data)
head_bm.transform(head.matrix_world)
head_bm.verts.ensure_lookup_table()
box = max(islands(head_bm), key=len)
keep = set(box)
bmesh.ops.delete(head_bm, geom=[v for v in head_bm.verts if v not in keep], context="VERTS")
head_bm.normal_update()
tree = BVHTree.FromBMesh(head_bm)


def surface(d):
    hit = tree.ray_cast(centre, d)
    return hit[0] if hit[0] is not None else centre + d * max(rx, rz)


bm = bmesh.new()
# a solid cap: the head surface pushed out a little, kept only above the hairline
head_bm.verts.ensure_lookup_table()
cap_src = head_bm.copy()
for v in cap_src.verts:
    v.co = v.co + v.normal * 0.010
cap_src.verts.ensure_lookup_table()
bmesh.ops.delete(cap_src, geom=[v for v in cap_src.verts if v.co.z < hairline((v.co - centre).normalized()) + 0.008], context="VERTS")
cap_mesh = bpy.data.meshes.new("tmp_cap")
cap_src.to_mesh(cap_mesh)
cap_src.free()
bm.from_mesh(cap_mesh)
bpy.data.meshes.remove(cap_mesh)

count = 0
n = 140
golden = math.pi * (3 - math.sqrt(5))
for i in range(n):
    zf = 1 - (i + 0.5) / n * 2
    r = math.sqrt(1 - zf * zf)
    a = i * golden
    d = Vector((math.cos(a) * r, math.sin(a) * r, zf))
    p = surface(d)
    if p.z - curl_r * 0.3 < hairline(d):
        continue
    facing = -d.y / max(math.hypot(d.x, d.y), 1e-6)
    radius = curl_r * (0.8 if facing > 0.7 and d.z < 0.6 else 1.0)
    geom = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=radius)
    squash = Matrix.Diagonal((1.0, 1.0, 0.8, 1.0))
    bmesh.ops.transform(bm, matrix=Matrix.Translation(p + d * radius * 0.15) @ squash, verts=geom["verts"])
    count += 1
head_bm.free()
mesh = bpy.data.meshes.new("Hair_Curls")
bm.to_mesh(mesh)
bm.free()
for poly in mesh.polygons:
    poly.use_smooth = True
hair = bpy.data.objects.new("Hair_Curls", mesh)
scene.collection.objects.link(hair)
if material:
    mesh.materials.append(material)
crown = world_pts(hair)
crown_top = max(p.z for p in crown)

# ponytail + scrunchie: sit on the top-back of the new crown
tail = [objs[n] for n in ("Hair_Ponytail", "Scrunchie") if n in objs]
if tail:
    base = min(p.z for o in tail for p in world_pts(o))
    back_top = max(p.z for p in crown if p.y > cy + 0.02)
    # a small bun: shrink it and seat it half inside the crown at the top-back
    tail_pts = [p for o in tail for p in world_pts(o)]
    tc = sum(tail_pts, Vector()) / len(tail_pts)
    shrink = Matrix.Translation(Vector((tc.x, tc.y, base))) @ Matrix.Diagonal((0.65, 0.65, 0.65, 1.0)) @ Matrix.Translation(-Vector((tc.x, tc.y, base)))
    lift = Matrix.Translation((0, 0, back_top - curl_r * 0.45 - base))
    for o in tail:
        o.data.transform(o.matrix_world.inverted() @ lift @ shrink @ o.matrix_world)

# ---------------------------------------------------------------- 3. fit back to the game height
everything = [o for o in scene.objects if o.type == "MESH"]
allp = [p for o in everything for p in world_pts(o)]
lo = Vector(map(min, *allp)); hi = Vector(map(max, *allp))
fit = TARGET_HEIGHT / (hi.z - lo.z)
for o in everything:
    o.data.transform(o.matrix_world.inverted() @ Matrix.Diagonal((fit, fit, fit, 1.0)) @ o.matrix_world)
allp = [p for o in everything for p in world_pts(o)]
lo = Vector(map(min, *allp)); hi = Vector(map(max, *allp))
print("V09|curls=%d|brow_top=%.3f|ear_top=%.3f|crown_top=%.3f|fit=%.3f|size=(%.3f, %.3f, %.3f)" % (count, brow_top, ear_top, crown_top, fit, *(hi - lo)))

for o in everything:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=f"{OUT}/{BASE}.glb", export_format="GLB", use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=f"{OUT}/{BASE}.blend", copy=True)

engines = [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
scene.render.engine = next((e for e in engines if "EEVEE" in e), "BLENDER_WORKBENCH")
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = 768
cam = next((o for o in scene.objects if o.type == "CAMERA"), None)
if cam is None:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    scene.collection.objects.link(cam)
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(50), math.radians(8), math.radians(-25))
    scene.collection.objects.link(sun)
scene.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = max(hi.x - lo.x, hi.z - lo.z) * 1.15
focus = Vector((0, 0, (lo.z + hi.z) / 2))
for label, az, el in (("front", 0, 8), ("three_quarter", 35, 18), ("side", 90, 8), ("back", 180, 8)):
    a, e = math.radians(az), math.radians(el)
    cam.location = focus + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * 4
    cam.rotation_euler = (focus - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = f"{OUT}/render_{label}.png"
    bpy.ops.render.render(write_still=True)
print("V09_OK")
