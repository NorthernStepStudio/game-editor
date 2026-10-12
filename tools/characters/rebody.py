"""Rebuild the roster template's body to match the owner's sheets: a short neck, a narrower rounded torso (open
jacket over an inner shirt), smooth puffy sleeves with one cuff, round mitten hands, rounded shorts and legs.
The head, face, hair and shoes are kept. Every rebuilt part keeps its name and its material slots, so the
roster recipes (colour zones per part) keep working.

Usage: blender --background --factory-startup --python rebody.py -- <in.blend> <out.blend>
"""
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

SRC, OUT = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene

# world-space meshes, no parents
meshes = [o for o in scene.objects if o.type == "MESH"]
bpy.context.view_layer.update()
for o in meshes:
    world = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = world
for o in [o for o in scene.objects if o.type == "EMPTY"]:
    bpy.data.objects.remove(o, do_unlink=True)
for o in meshes:
    o.data.transform(o.matrix_world)
    o.matrix_world.identity()
objs = {o.name: o for o in scene.objects if o.type == "MESH"}


def bounds(o):
    pts = [v.co for v in o.data.vertices]
    return Vector(map(min, *pts)), Vector(map(max, *pts))


# ---------------------------------------------------------------- measurements from the template
head_lo, head_hi = bounds(objs["Head"])
torso_lo, torso_hi = bounds(objs["Torso"])
shoe_lo, shoe_hi = bounds(objs["Shoe_L"])
CX = 0.0
CY = (torso_lo.y + torso_hi.y) / 2
CHIN = head_lo.z + 0.004              # bottom of the head box
SHOE_TOP = shoe_hi.z
HEAD_W = head_hi.x - head_lo.x

# owner's sheets (Kai, Sol, Riko fronts), as fractions of the chin-to-sole distance L:
# neck 0.90-1.00 L, arm line 0.80 L, shoulders 0.90 L, jacket hem 0.54 L, shorts bottom 0.33 L.
L = CHIN
CHEST_W = 0.66 * HEAD_W               # ~0.75 of the face box: a rounded chest, narrower than the head
DEPTH = 0.50 * HEAD_W
SHOULDER_Z = 0.88 * L                 # a short neck shows between the jaw and the collar
ARM_Z = 0.80 * L
HEM_Z = 0.54 * L                      # jacket hem
SHORTS_BOT = 0.38 * L
WAIST_Z = HEM_Z + 0.01
HIP_Z = HEM_Z - 0.01
ARM_R = 0.045
HAND_X = 0.29                         # keep the arm span: a narrower chest means longer arms
print("REBODY|chin=%.3f|shoulder=%.3f|arm=%.3f|hem=%.3f|shorts_bottom=%.3f|shoe_top=%.3f|chest_w=%.3f" % (CHIN, SHOULDER_Z, ARM_Z, HEM_Z, SHORTS_BOT, SHOE_TOP, CHEST_W))


# ---------------------------------------------------------------- helpers
def replace(name, bm, smooth=True):
    """Swap an object's mesh for a new one, keeping its material slots."""
    old = objs.get(name)
    mats = list(old.data.materials) if old else []
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = smooth
    for m in mats:
        mesh.materials.append(m)
    if old:
        old.data = mesh
        return old
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    objs[name] = obj
    return obj


def set_slot(bm, faces, slot):
    for f in faces:
        f.material_index = slot


def new_rounded(centre, size, radius, segments=6, bm=None):
    bm = bm or bmesh.new()
    start = len(bm.verts)
    g = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=g["verts"])
    edges = list({e for v in g["verts"] for e in v.link_edges})
    bmesh.ops.bevel(bm, geom=edges + g["verts"], offset=min(radius, min(size) * 0.49), segments=segments, profile=0.5, affect="EDGES", clamp_overlap=True)
    bm.verts.ensure_lookup_table()
    moved = [v for v in bm.verts[start:]]
    bmesh.ops.translate(bm, vec=centre, verts=moved)
    bm.faces.ensure_lookup_table()
    return bm, [f for f in bm.faces if all(v.index >= start for v in f.verts)]


def tube(bm, a, b, ra, rb, ring=20, rows=10, cap=True):
    """Capsule-like tube from a to b with radius ra -> rb (rounded ends)."""
    start = len(bm.verts)
    axis = (b - a)
    length = axis.length
    d = axis.normalized()
    side = d.cross(Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))).normalized()
    up = side.cross(d).normalized()
    rings = []
    profile = []
    caps = 4 if cap else 0
    for i in range(caps):                                  # rounded start
        t = math.sin(math.pi / 2 * (i + 1) / (caps + 1))
        profile.append((-(1 - t) * ra * 0.9, ra * math.sqrt(max(0.0, 1 - (1 - t) ** 2))))
    for i in range(rows + 1):
        s = i / rows
        profile.append((s * length, ra + (rb - ra) * s))
    for i in range(caps):                                  # rounded end
        t = math.cos(math.pi / 2 * (i + 1) / (caps + 1))
        profile.append((length + (1 - t) * rb * 0.9, rb * math.sqrt(max(0.0, 1 - (1 - t) ** 2))))
    for x, r in profile:
        c = a + d * x
        rings.append([bm.verts.new(c + (side * math.cos(2 * math.pi * k / ring) + up * math.sin(2 * math.pi * k / ring)) * r) for k in range(ring)])
    faces = []
    for r1, r2 in zip(rings, rings[1:]):
        for k in range(ring):
            faces.append(bm.faces.new((r1[k], r1[(k + 1) % ring], r2[(k + 1) % ring], r2[k])))
    e1 = bm.verts.new(a - d * ra * 0.9)
    e2 = bm.verts.new(b + d * rb * 0.9)
    for k in range(ring):
        faces.append(bm.faces.new((e1, rings[0][(k + 1) % ring], rings[0][k])))
        faces.append(bm.faces.new((e2, rings[-1][k], rings[-1][(k + 1) % ring])))
    return faces


def torus_ring(bm, centre, major, minor, axis, scale=(1, 1, 1), segs=32, ring=12):
    verts = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        for j in range(ring):
            t = 2 * math.pi * j / ring
            verts.append(bm.verts.new(Vector(((major + minor * math.cos(t)) * math.cos(a), (major + minor * math.cos(t)) * math.sin(a), minor * math.sin(t)))))
    faces = []
    for i in range(segs):
        for j in range(ring):
            faces.append(bm.faces.new((verts[i * ring + j], verts[((i + 1) % segs) * ring + j], verts[((i + 1) % segs) * ring + (j + 1) % ring], verts[i * ring + (j + 1) % ring])))
    rot = Vector((0, 0, 1)).rotation_difference(axis.normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(centre) @ rot @ Matrix.Diagonal((*scale, 1.0)), verts=verts)
    return faces


# ---------------------------------------------------------------- neck (skin) — new part, uses the head's skin
bm = bmesh.new()
tube(bm, Vector((CX, CY + 0.005, SHOULDER_Z - 0.01)), Vector((CX, CY + 0.005, CHIN + 0.03)), 0.05, 0.05, ring=24, rows=4, cap=False)
neck = replace("Neck", bm)
if not neck.data.materials:
    neck.data.materials.append(objs["Head"].data.materials[0])

# ---------------------------------------------------------------- torso = inner shirt body (rounded barrel)
torso_h = SHOULDER_Z - (HEM_Z - 0.02)
bm, _ = new_rounded(Vector((CX, CY, HEM_Z - 0.02 + torso_h / 2)), Vector((CHEST_W * 0.92, DEPTH * 0.92, torso_h)), 0.05)
replace("Torso", bm)

# ---------------------------------------------------------------- jacket: open front, rounded, a bit wider at the hem
bm = bmesh.new()
jh = SHOULDER_Z + 0.012 - HEM_Z
bm, body = new_rounded(Vector((CX, CY, HEM_Z + jh / 2)), Vector((CHEST_W, DEPTH, jh)), 0.065, bm=bm)
# open front: remove the centre strip of the front so the shirt shows
front_y = CY - DEPTH / 2
open_w = CHEST_W * 0.2
bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(abs(v.co.x - CX) < open_w and v.co.y < front_y + 0.02 for v in f.verts)], context="FACES")
for f in bm.faces:
    f.material_index = 0
# flare the hem slightly
for v in bm.verts:
    t = max(0.0, (SHOULDER_Z - v.co.z) / jh)
    v.co.x = CX + (v.co.x - CX) * (1 + 0.08 * t)
# trim (slot 2): a band along the hem
hem = torus_ring(bm, Vector((CX, CY, HEM_Z + 0.006)), 1.0, 0.012, Vector((0, 0, 1)), scale=(CHEST_W * 0.55, DEPTH * 0.55, 1.0))
set_slot(bm, hem, 2)
replace("Jacket", bm)

# inner shirt front panel (CropTop): fills the jacket opening
bm, _ = new_rounded(Vector((CX, front_y + 0.012, (HEM_Z + SHOULDER_Z) / 2)), Vector((open_w * 2.2, 0.03, SHOULDER_Z - HEM_Z)), 0.012)
replace("CropTop", bm)

# collar / hood ring around the neck base: slot 0 outside, slot 1 lining
bm = bmesh.new()
outer = torus_ring(bm, Vector((CX, CY + 0.005, SHOULDER_Z - 0.002)), 0.064, 0.018, Vector((0, -0.25, 1)), scale=(1.15, 1.0, 1.0))
set_slot(bm, outer, 0)
replace("Collar", bm)

# ---------------------------------------------------------------- arms: smooth puffy sleeves, one cuff, round mitten hands
for side, suffix in ((1, "L"), (-1, "R")):
    shoulder = Vector((CX + side * (CHEST_W / 2 - 0.02), CY, ARM_Z))
    elbow = Vector((CX + side * (CHEST_W / 2 + 0.07), CY, ARM_Z))
    wrist = Vector((CX + side * (HAND_X - 0.05), CY, ARM_Z))
    bm = bmesh.new()
    upper = tube(bm, shoulder, elbow, ARM_R * 0.95, ARM_R * 1.05, rows=6)
    set_slot(bm, upper, 0)
    lower = tube(bm, elbow - Vector((side * 0.01, 0, 0)), wrist, ARM_R * 1.08, ARM_R * 1.12, rows=6)
    set_slot(bm, lower, 2)
    cuff = torus_ring(bm, wrist - Vector((side * 0.004, 0, 0)), ARM_R * 0.95, 0.016, Vector((1, 0, 0)))
    set_slot(bm, cuff, 1)
    replace(f"Arm_{suffix}", bm)
    # hand: a round mitten (skin, slot 1) with a wrist band (glove, slot 0) and a small accent (slot 2)
    bm = bmesh.new()
    g = bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=14, radius=1.0)
    centre = Vector((CX + side * (HAND_X - 0.008), CY - 0.004, ARM_Z))
    bmesh.ops.transform(bm, matrix=Matrix.Translation(centre) @ Matrix.Diagonal((0.04, 0.045, 0.046, 1.0)), verts=g["verts"])
    for f in bm.faces:
        f.material_index = 1
    band = torus_ring(bm, centre - Vector((side * 0.03, 0, 0)), 0.036, 0.012, Vector((1, 0, 0)))
    set_slot(bm, band, 0)
    dot = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=0.009)
    bmesh.ops.translate(bm, vec=centre - Vector((side * 0.03, 0.04, 0)), verts=dot["verts"])
    set_slot(bm, list({f for v in dot["verts"] for f in v.link_faces}), 2)
    replace(f"Hand_{suffix}", bm)

# ---------------------------------------------------------------- shorts and legs
bm = bmesh.new()
sh_top, sh_bot = HEM_Z + 0.015, SHORTS_BOT
bm, _ = new_rounded(Vector((CX, CY, (sh_top + sh_bot) / 2)), Vector((CHEST_W * 1.02, DEPTH * 0.98, sh_top - sh_bot)), 0.04, bm=bm)
for f in bm.faces:
    f.material_index = 0
for side in (1, -1):
    hem_faces = torus_ring(bm, Vector((CX + side * CHEST_W * 0.25, CY, sh_bot + 0.004)), 0.042, 0.01, Vector((0, 0, 1)))
    set_slot(bm, hem_faces, 1)
replace("Shorts", bm)
for side, suffix in ((1, "L"), (-1, "R")):
    bm = bmesh.new()
    x = CX + side * CHEST_W * 0.25
    tube(bm, Vector((x, CY, SHOE_TOP - 0.01)), Vector((x, CY, sh_bot + 0.015)), 0.034, 0.036, rows=4)
    replace(f"Leg_{suffix}", bm)

# ---------------------------------------------------------------- belt, bag strap and bag on the new body
bm = bmesh.new()
belt = torus_ring(bm, Vector((CX, CY, HEM_Z - 0.004)), 1.0, 0.009, Vector((0, 0, 1)), scale=(CHEST_W * 0.53, DEPTH * 0.53, 1.0))
set_slot(bm, belt, 0)
buckle = bmesh.ops.create_cube(bm, size=1.0)
bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector((CX, CY - DEPTH * 0.53 - 0.004, HEM_Z - 0.004))) @ Matrix.Diagonal((0.026, 0.008, 0.02, 1.0)), verts=buckle["verts"])
set_slot(bm, list({f for v in buckle["verts"] for f in v.link_faces}), 1)
replace("Belt", bm)

bm = bmesh.new()
start = Vector((CX + CHEST_W * 0.32, front_y - 0.022, SHOULDER_Z - 0.005))
end = Vector((CX - CHEST_W * 0.5, front_y - 0.02, HEM_Z + 0.01))
pts = [start + (end - start) * (i / 12) + Vector((0, -0.006 * math.sin(math.pi * i / 12), 0)) for i in range(13)]
for a, b in zip(pts, pts[1:]):
    tube(bm, a, b, 0.008, 0.008, ring=8, rows=1, cap=False)
replace("Bag_Strap", bm)

bm = bmesh.new()
bag_c = Vector((CX - CHEST_W * 0.58, front_y + 0.01, HEM_Z - 0.012))
bm, faces = new_rounded(bag_c, Vector((0.05, 0.075, 0.06)), 0.014, bm=bm)
for f in faces:
    f.material_index = 0
bm2_start = len(bm.faces)
bm, flap = new_rounded(bag_c + Vector((-0.004, -0.02, 0.016)), Vector((0.044, 0.04, 0.03)), 0.008, bm=bm)
for f in flap:
    f.material_index = 1
replace("Bag", bm)

for name in ("Hip_Strap",):
    if name in objs and name in bpy.data.objects:
        pass  # Yun-only, removed by recipes

bpy.ops.wm.save_as_mainfile(filepath=OUT)
pts = [o.matrix_world @ v.co for o in scene.objects if o.type == "MESH" for v in o.data.vertices]
lo, hi = Vector(map(min, *pts)), Vector(map(max, *pts))
print("REBODY_OK|size=(%.3f, %.3f, %.3f)" % (*(hi - lo),))
