"""Hair & accessory toolkit for the Street Yun chibi roster.

Replaces a character's hair (and optionally accessories) with pieces built to fit its own head box, from a recipe.
Usage:
  blender --background --factory-startup --python dress_character.py -- <in.blend> <recipe.json> <out_dir> <base_name>

Recipe (JSON): {"remove": [object names or prefixes], "materials": {"Riko_Hair": "#8B4A2B", ...},
                "pieces": [{"type": "cap", ...}, {"type": "bangs", ...}, ...]}
Heights are given as t: 0 = bottom of the head box, 1 = top of the head box (negative = below the head,
e.g. -1.0 is one head-height below the chin). Widths are fractions of the head's half-width (w) or
half-depth (d). Every piece is a separate named object so rigging can assign it (Hair_*, Cap_*, ...).
Writes <base>.glb, <base>.blend, render_front/three_quarter/side/back.png and front_ortho.png.
"""
import json
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

SRC, RECIPE, OUT, BASE = sys.argv[sys.argv.index("--") + 1:][:4]
recipe = json.load(open(RECIPE, "r", encoding="utf-8"))
bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene

# ---------------------------------------------------------------- clean up: world-space meshes, no parents
for o in list(scene.objects):
    if o.type in {"CAMERA", "LIGHT"}:
        bpy.data.objects.remove(o, do_unlink=True)
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

for name in recipe.get("remove", []):
    for o in [o for o in scene.objects if o.type == "MESH" and (o.name == name or (name.endswith("*") and o.name.startswith(name[:-1])))]:
        bpy.data.objects.remove(o, do_unlink=True)


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


# ---------------------------------------------------------------- head measurements
head = bpy.data.objects["Head"]
hb = bmesh.new()
hb.from_mesh(head.data)
hb.verts.ensure_lookup_table()
box = set(max(islands(hb), key=len))
bmesh.ops.delete(hb, geom=[v for v in hb.verts if v not in box], context="VERTS")
hb.normal_update()
P = [v.co.copy() for v in hb.verts]
X0, X1 = min(p.x for p in P), max(p.x for p in P)
Y0, Y1 = min(p.y for p in P), max(p.y for p in P)
Z0, Z1 = min(p.z for p in P), max(p.z for p in P)
CX, CY = (X0 + X1) / 2, (Y0 + Y1) / 2
W, D, H = (X1 - X0) / 2, (Y1 - Y0) / 2, Z1 - Z0
C = Vector((CX, CY, Z0 + H * 0.5))
tree = BVHTree.FromBMesh(hb)
brow_z = max((v.co.z for v in bpy.data.objects["Eyebrows"].data.vertices), default=Z0 + H * 0.55) if "Eyebrows" in bpy.data.objects else Z0 + H * 0.55
eye_obj = bpy.data.objects.get("Eyes")
eyes = []
if eye_obj:
    for side in (1, -1):
        pts = [v.co for v in eye_obj.data.vertices if (v.co.x - CX) * side > 0]
        if pts:
            eyes.append(sum(pts, Vector()) / len(pts))


def z(t):
    return Z0 + t * H


def tz(zv):
    return (zv - Z0) / H


T_BROW = tz(brow_z)


def surface(direction, inflate=0.0):
    d = direction.normalized()
    hit = tree.ray_cast(C, d)
    p = hit[0] if hit[0] is not None else C + Vector((d.x * W, d.y * D, d.z * H / 2))
    n = hit[1] if hit[1] is not None else d
    return p + n * inflate, n


# ---------------------------------------------------------------- materials & objects
def hex_rgba(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


MATS = {}
for name, colour in recipe.get("materials", {}).items():
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_rgba(colour)
    bsdf.inputs["Roughness"].default_value = 0.3 if "Lens" in name or "Metal" in name else 0.72
    if "Metal" in name:
        bsdf.inputs["Metallic"].default_value = 1.0
    MATS[name] = m


def new_object(name, bm, material):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    if material:
        mesh.materials.append(MATS.get(material) or bpy.data.materials.get(material))
    return obj


def rbox(bm, centre, size, radius, rot=Matrix.Identity(3), segments=3):
    """Rounded box: a cube with all edges bevelled."""
    geom = bmesh.ops.create_cube(bm, size=1.0)
    verts = geom["verts"]
    bmesh.ops.scale(bm, vec=size, verts=verts)
    edges = list({e for v in verts for e in v.link_edges})
    r = min(radius, min(size) * 0.49)
    res = bmesh.ops.bevel(bm, geom=edges + verts, offset=r, segments=segments, profile=0.5, affect="EDGES", clamp_overlap=True)
    all_verts = list({v for v in verts if v.is_valid} | {v for f in res.get("faces", []) for v in f.verts})
    bmesh.ops.transform(bm, matrix=Matrix.Translation(centre) @ rot.to_4x4(), verts=all_verts)
    return all_verts


def sphere(bm, centre, radius, scale=(1, 1, 1), segs=(16, 10)):
    g = bmesh.ops.create_uvsphere(bm, u_segments=segs[0], v_segments=segs[1], radius=radius)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(centre) @ Matrix.Diagonal((*scale, 1.0)), verts=g["verts"])
    return g["verts"]


def torus(bm, centre, major, minor, axis=Vector((0, 0, 1)), segs=24, ring=10, scale=(1, 1, 1)):
    verts = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        for j in range(ring):
            b = 2 * math.pi * j / ring
            p = Vector(((major + minor * math.cos(b)) * math.cos(a), (major + minor * math.cos(b)) * math.sin(a), minor * math.sin(b)))
            verts.append(bm.verts.new(p))
    for i in range(segs):
        for j in range(ring):
            a = verts[i * ring + j]
            b = verts[((i + 1) % segs) * ring + j]
            c = verts[((i + 1) % segs) * ring + (j + 1) % ring]
            d = verts[i * ring + (j + 1) % ring]
            bm.faces.new((a, b, c, d))
    rot = Vector((0, 0, 1)).rotation_difference(axis.normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(centre) @ rot @ Matrix.Diagonal((*scale, 1.0)), verts=verts)
    return verts


def cone(bm, base, tip, radius, segs=10):
    axis = tip - base
    g = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=radius, radius2=radius * 0.18, depth=axis.length)
    rot = Vector((0, 0, 1)).rotation_difference(axis.normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((base + tip) / 2) @ rot, verts=g["verts"])
    return g["verts"]


def hairline_fn(p):
    """z of the hairline for a direction: front (bangs/forehead), sides, back."""
    front, side, back = z(p.get("front", T_BROW + 0.04)), z(p.get("side", 0.45)), z(p.get("back", 0.15))

    def line(d):
        f = -d.y / max(math.hypot(d.x, d.y), 1e-6)
        return side + (front - side) * f ** p.get("front_power", 1.5) if f >= 0 else side + (back - side) * (-f)
    return line


def fib(n):
    g = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        zf = 1 - (i + 0.5) / n * 2
        r = math.sqrt(max(0.0, 1 - zf * zf))
        yield Vector((math.cos(i * g) * r, math.sin(i * g) * r, zf))


# ---------------------------------------------------------------- pieces
def piece_cap(p):
    """Hair (or hat) shell: the head surface pushed out, kept above a hairline."""
    bm = hb.copy()
    for v in bm.verts:
        v.co = v.co + v.normal * p.get("thick", 0.016)
        if p.get("lift_top"):
            v.co.z += p["lift_top"] * max(0.0, (v.co.z - z(0.6))) / H
    line = hairline_fn(p)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < line((v.co - C).normalized())], context="VERTS")
    return new_object(p.get("name", "Hair_Cap"), bm, p["material"])


def piece_clumps(p):
    """Soft rounded clumps (curls, fluffy tufts) on the head surface above a hairline."""
    bm = bmesh.new()
    line = hairline_fn(p)
    r = p.get("radius", 0.05)
    for d in fib(p.get("count", 90)):
        pos, n = surface(d)
        if pos.z < line(d) + p.get("margin", 0.0):
            continue
        if "max_t" in p and pos.z > z(p["max_t"]):
            continue  # hidden under a hat
        sphere(bm, pos + n * r * p.get("out", 0.2), r, scale=p.get("scale", (1, 1, 0.8)), segs=(12, 8))
    return new_object(p.get("name", "Hair_Clumps"), bm, p["material"])


def piece_spikes(p):
    """Pointed clumps: cones on the surface, leaning out and up (front ones down over the forehead)."""
    bm = bmesh.new()
    line = hairline_fn(p)
    for d in fib(p.get("count", 60)):
        pos, n = surface(d, inflate=0.006)
        if pos.z < line(d):
            continue
        front = -d.y / max(math.hypot(d.x, d.y), 1e-6)
        lean = Vector((0, 0, 1)) * p.get("up", 0.35)
        if front > 0.5 and pos.z < z(p.get("bang_t", 0.92)):
            lean = Vector((0, -0.2, -1)) * 0.9  # bangs fall down over the forehead
        direction = (n + lean).normalized()
        length = p.get("length", 0.09) * (0.75 + 0.5 * ((d.x * 7.3 + d.y * 3.1) % 1))
        sphere(bm, pos, p.get("radius", 0.04) * 0.9, segs=(10, 6))
        cone(bm, pos - direction * 0.01, pos + direction * length, p.get("radius", 0.04))
    return new_object(p.get("name", "Hair_Spikes"), bm, p["material"])


def piece_bangs(p):
    """Bangs: rounded strands across the forehead, ending at t_bottom (blunt) or slanting (swept)."""
    bm = bmesh.new()
    n = p.get("strands", 7)
    top, bottom = z(p.get("t_top", 0.95)), z(p.get("t_bottom", T_BROW + 0.02))
    span = p.get("span", 0.95) * W
    thick = p.get("thick", 0.035)
    slant = p.get("sweep", 0.0)  # >0: longer on the left (character's right), slanted
    for i in range(n):
        f = (i + 0.5) / n
        x = CX - span + 2 * span * f
        b = bottom + slant * H * (f - 0.5)
        hit = tree.ray_cast(Vector((x, CY, (top + b) / 2)), Vector((0, -1, 0)))
        y = (hit[0].y if hit[0] is not None else Y0) - thick * 0.35
        width = 2 * span / n * p.get("overlap", 1.35)
        if p.get("style") == "pointed":
            # tapered strands hanging from the hairline, tips at slightly different lengths
            tip = b - 0.012 * ((i * 0.618) % 1) * 2
            pts = [Vector((x + (f - 0.5) * 0.03 * s, y - 0.004 * s, top + (tip - top) * s)) for s in (k / 8 for k in range(9))]
            radii = [width * 0.5 * ((1 - s) ** 0.8 * (1 - p.get("tip", 0.0)) + p.get("tip", 0.0)) + 0.004 for s in (k / 8 for k in range(9))]
            sweep(bm, pts, radii, ring=10, flat=thick / max(width, 1e-6))
            continue
        rot = Matrix.Rotation(slant * 0.6, 3, "Y")
        rbox(bm, Vector((x, y, (top + b) / 2)), Vector((width, thick, top - b)), radius=min(width, thick) * 0.48, rot=rot)
    return new_object(p.get("name", "Hair_Bangs"), bm, p["material"])


def piece_locks(p):
    """Side locks beside the cheeks (pairs), from the temples down to t_bottom."""
    bm = bmesh.new()
    top, bottom = z(p.get("t_top", 0.85)), z(p.get("t_bottom", 0.05))
    width, thick = p.get("width", 0.07), p.get("thick", 0.045)
    y = CY + p.get("y", -0.55) * D
    flare = p.get("flare", 0.01)
    for side in (1, -1):
        x = CX + side * (W + thick * 0.35)
        rot = Matrix.Rotation(side * flare * 4, 3, "Y")
        rbox(bm, Vector((x + side * flare, y, (top + bottom) / 2)), Vector((thick, width, top - bottom)), radius=thick * 0.48, rot=rot)
    return new_object(p.get("name", "Hair_Locks"), bm, p["material"])


def piece_curtain(p):
    """Long hair falling at the back (and optionally in front of the shoulders), as wavy rounded strands."""
    bm = bmesh.new()
    top, bottom = z(p.get("t_top", 0.7)), z(p.get("t_bottom", -1.2))
    n = p.get("strands", 7)
    span = p.get("span", 1.05) * W
    thick = p.get("thick", 0.06)
    for i in range(n):
        f = (i + 0.5) / n
        x = CX - span + 2 * span * f
        length = (top - bottom) * (0.9 + 0.12 * math.sin(i * 1.7))
        y = Y1 + thick * 0.3 - 0.01
        rbox(bm, Vector((x, y, top - length / 2)), Vector((2 * span / n * 1.3, thick, length)), radius=thick * 0.48)
    if p.get("front"):
        for side in (1, -1):
            for k in range(2):
                x = CX + side * (W * 0.92 - k * 0.045)
                fb = z(p["front"].get("t_bottom", -0.9))
                y = Y0 + D * p["front"].get("y", 0.55)
                rbox(bm, Vector((x, y, (z(0.75) + fb) / 2)), Vector((0.055, 0.06, z(0.75) - fb)), radius=0.026)
    return new_object(p.get("name", "Hair_Long"), bm, p["material"])


def piece_ponytail(p):
    """Ponytail tied at the top-back: a curving chain of soft blobs, plus the tie."""
    bm = bmesh.new()
    base = Vector((CX, CY + p.get("y", 0.75) * D, z(p.get("t", 1.02))))
    pts, r0 = [], p.get("radius", 0.055)
    up, back, drop = p.get("up", 0.06), p.get("back", 0.16), p.get("drop", 0.32)
    k = p.get("blobs", 12)
    for i in range(k + 1):
        s = i / k
        pt = base + Vector((p.get("sway", 0.0) * s, back * s, up * math.sin(s * math.pi * 0.9) - drop * s * s))
        r = r0 * (1.0 - 0.55 * s) + 0.012
        sphere(bm, pt, r, scale=(1.0, 0.9, 1.0), segs=(12, 8))
    obj = new_object(p.get("name", "Hair_Ponytail"), bm, p["material"])
    if p.get("tie"):
        tb = bmesh.new()
        torus(tb, base + Vector((0, 0.01, -0.005)), r0 * 0.75, 0.018, axis=Vector((0, 0.6, 1)))
        new_object(p.get("tie_name", "Hair_Tie"), tb, p["tie"])
    return obj


def sweep(bm, points, radii, ring=18, flat=1.0):
    """Smooth tube along a path of points with a radius per point (rounded at the free end)."""
    rings = []
    for i, (pt, r) in enumerate(zip(points, radii)):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        side = tangent.cross(Vector((0, 0, 1)) if abs(tangent.z) < 0.9 else Vector((1, 0, 0))).normalized()
        up = side.cross(tangent).normalized()
        rings.append([bm.verts.new(pt + (side * math.cos(2 * math.pi * k / ring) + up * flat * math.sin(2 * math.pi * k / ring)) * r) for k in range(ring)])
    for a, b in zip(rings, rings[1:]):
        for k in range(ring):
            bm.faces.new((a[k], a[(k + 1) % ring], b[(k + 1) % ring], b[k]))
    start = bm.verts.new(points[0])
    end = bm.verts.new(points[-1] + (points[-1] - points[-2]).normalized() * radii[-1] * 0.8)
    for k in range(ring):
        bm.faces.new((start, rings[0][(k + 1) % ring], rings[0][k]))
        bm.faces.new((end, rings[-1][k], rings[-1][(k + 1) % ring]))


def piece_tufts(p):
    """Chunky pointed tufts that swoop outward: up/back on top, down at the sides, down over the forehead."""
    bm = bmesh.new()
    line = hairline_fn(p)
    count, length, r0 = p.get("count", 40), p.get("length", 0.1), p.get("radius", 0.055)
    shell = p.get("shell", 0.0)
    lift = p.get("lift_top", 0.0)
    for i, d in enumerate(fib(count)):
        pos, n = surface(d, inflate=shell)
        pos = pos + Vector((0, 0, lift * max(0.0, (pos.z - z(0.6))) / (H * 0.4)))
        if pos.z < line(d):
            continue
        front = -d.y / max(math.hypot(d.x, d.y), 1e-6)
        if front > 0.55 and pos.z < z(p.get("bang_t", 0.95)):
            direction = Vector((d.x * 0.6, -0.35, -1.0)).normalized()  # bangs fall over the forehead
            bend = Vector((0, -0.01, -0.02))
        elif d.z > 0.55:
            direction = (n + Vector((0, p.get("lean_back", 0.25), p.get("up", 0.6)))).normalized()  # top: up and back
            bend = Vector((0, 0.02, -0.025))
        else:
            direction = (n + Vector((0, 0.1, -p.get("down", 0.8)))).normalized()  # sides/back: out and down
            bend = Vector((0, 0.0, -0.02))
        jitter = 0.8 + 0.4 * ((i * 0.618) % 1)
        L = length * jitter
        steps = 10
        pts = [pos - n * 0.012 + direction * L * (s / steps) + bend * (s / steps) ** 2 for s in range(steps + 1)]
        tip = p.get("tip", 0.0)  # 0 = pointed, ~0.5 = soft rounded swoop
        radii = [r0 * jitter * ((1 - s / steps) ** 0.85 * (1 - tip) + tip) + 0.003 for s in range(steps + 1)]
        sweep(bm, pts, radii, ring=12, flat=p.get("flat", 0.65))
    return new_object(p.get("name", "Hair_Tufts"), bm, p["material"])


def piece_neckphones(p):
    """Headphones resting around the neck: cups on the collar under the chin, a smooth band behind the neck."""
    cups = bmesh.new()
    rims = bmesh.new()
    zc = z(p.get("t", -0.12))
    xs = W * p.get("x", 0.8)
    yc = Y0 + p.get("y", 0.05)
    for side in (1, -1):
        centre = Vector((CX + side * xs, yc, zc))
        g = bmesh.ops.create_cone(cups, cap_ends=True, segments=24, radius1=p.get("cup", 0.058), radius2=p.get("cup", 0.058), depth=0.045)
        axis = Vector((side * 1.0, -0.35, 0.0)).normalized()
        rot = Vector((0, 0, 1)).rotation_difference(axis).to_matrix().to_4x4()
        bmesh.ops.transform(cups, matrix=Matrix.Translation(centre) @ rot, verts=g["verts"])
        torus(rims, centre + axis * 0.024, p.get("cup", 0.058) * 0.82, 0.014, axis=axis, segs=28, ring=8)
    new_object(p.get("cup_name", "Neckwear_Cups"), cups, p["cups"])
    new_object(p.get("rim_name", "Neckwear_Rims"), rims, p["band"])
    band = bmesh.new()
    pts, radii = [], []
    for i in range(25):
        a = math.pi * i / 24
        pts.append(Vector((CX + math.cos(a) * xs, yc + math.sin(a) * (CY + D * 0.7 - yc), zc + 0.01 * math.sin(a))))
        radii.append(0.014)
    sweep(band, pts, radii, ring=10)
    return new_object(p.get("name", "Neckwear_Band"), band, p["band"])


def piece_tail(p):
    """Smooth ponytail: tied at the top-back, sweeps up and back, then falls behind the head."""
    bm = bmesh.new()
    base = Vector((CX + p.get("x", 0.0) * W, CY + p.get("y", 0.6) * D, z(p.get("t", 1.0))))
    r0 = p.get("radius", 0.06)
    up, back, drop, sway = p.get("up", 0.08), p.get("back", 0.18), p.get("drop", 0.45), p.get("sway", 0.0)
    k = 28
    pts, radii = [], []
    for i in range(k + 1):
        s = i / k
        pts.append(base + Vector((sway * s * s, back * math.sin(s * math.pi * 0.55), up * math.sin(s * math.pi * 0.8) - drop * s ** 1.8)))
        radii.append(r0 * (0.7 + 0.55 * math.sin(math.pi * min(1.0, s * 1.25))) * (1 - 0.6 * s) + 0.006)
    sweep(bm, pts, radii)
    obj = new_object(p.get("name", "Hair_Ponytail"), bm, p["material"])
    if p.get("tie"):
        tb = bmesh.new()
        axis = (pts[1] - pts[0]).normalized()
        torus(tb, base + axis * 0.006, r0 * 0.78, 0.02, axis=axis, segs=28, ring=10)
        new_object(p.get("tie_name", "Hair_Tie"), tb, p["tie"])
    return obj


def piece_buns(p):
    bm = bmesh.new()
    r = p.get("radius", 0.06)
    for side in (1, -1):
        pos = Vector((CX + side * p.get("x", 0.6) * W, CY + p.get("y", 0.1) * D, z(p.get("t", 1.0))))
        sphere(bm, pos, r, segs=(16, 10))
    obj = new_object(p.get("name", "Hair_Buns"), bm, p["material"])
    if p.get("tie"):
        tb = bmesh.new()
        for side in (1, -1):
            centre = Vector((CX + side * p.get("x", 0.6) * W, CY + p.get("y", 0.1) * D, z(p.get("t", 1.0))))
            axis = (centre - C).normalized()
            torus(tb, centre - axis * r * 0.4, r * 0.95, 0.024, axis=axis)
        new_object(p.get("tie_name", "Hair_Ties"), tb, p["tie"])
    return obj


def piece_star(p):
    bm = bmesh.new()
    pos = Vector((CX + p.get("x", 0.6) * W, Y0 + p.get("y", 0.0), z(p.get("t", 0.85))))
    r1, r2 = p.get("radius", 0.03), p.get("radius", 0.03) * 0.45
    ring = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        r = r1 if i % 2 == 0 else r2
        ring.append(Vector((pos.x + r * math.cos(a), pos.y, pos.z + r * math.sin(a))))
    front = [bm.verts.new(v + Vector((0, -0.006, 0))) for v in ring]
    back = [bm.verts.new(v + Vector((0, 0.008, 0))) for v in ring]
    cf, cb = bm.verts.new(pos + Vector((0, -0.01, 0))), bm.verts.new(pos + Vector((0, 0.008, 0)))
    for i in range(10):
        j = (i + 1) % 10
        bm.faces.new((cf, front[i], front[j]))
        bm.faces.new((cb, back[j], back[i]))
        bm.faces.new((front[i], back[i], back[j], front[j]))
    return new_object(p.get("name", "Hair_Clip"), bm, p["material"])


def piece_glasses(p):
    bm = bmesh.new()
    y = Y0 - 0.012
    for e in eyes:
        torus(bm, Vector((e.x, y, e.z)), p.get("radius", 0.038), 0.006, axis=Vector((0, 1, 0)), segs=28, ring=8)
    if len(eyes) == 2:
        mid = (eyes[0] + eyes[1]) / 2
        rbox(bm, Vector((mid.x, y, mid.z + 0.01)), Vector((abs(eyes[0].x - eyes[1].x) - 2 * p.get("radius", 0.038), 0.008, 0.008)), 0.003)
        for e in eyes:
            side = 1 if e.x > CX else -1
            arm_x = CX + side * (W + 0.004)
            rbox(bm, Vector((arm_x, (y + CY) / 2, e.z + 0.01)), Vector((0.008, abs(CY - y), 0.008)), 0.003)
    return new_object(p.get("name", "Glasses"), bm, p["material"])


def piece_goggles(p):
    bm = bmesh.new()
    zz = z(p.get("t", 0.82))
    out = p.get("out", 0.02)
    torus(bm, Vector((CX, CY, zz)), 1.0, 0.02, scale=(W + out, D + out, 1.0), segs=40, ring=8)
    obj = new_object(p.get("name", "Goggles_Strap"), bm, p["strap"])
    fb = bmesh.new()
    lb = bmesh.new()
    for side in (1, -1):
        x = CX + side * W * 0.42
        hit = tree.ray_cast(Vector((x, CY, zz + 0.02)), Vector((0, -1, 0)))
        y = (hit[0].y if hit[0] is not None else Y0) - out - 0.012
        torus(fb, Vector((x, y, zz + 0.02)), 0.05, 0.016, axis=Vector((0, 1, 0.25)), segs=28, ring=8)
        sphere(lb, Vector((x, y - 0.004, zz + 0.02)), 0.048, scale=(1, 0.45, 1))
    new_object(p.get("frame_name", "Goggles"), fb, p["frame"])
    new_object(p.get("lens_name", "Goggles_Lens"), lb, p["lens"])
    return obj


def piece_headphones(p):
    """On the head (band over the top, cups over the ears), or around the neck (on: "neck")."""
    bm = bmesh.new()
    on_neck = p.get("on") == "neck"
    cup_z = z(0.33) if not on_neck else z(-0.08)
    cup_x = W + 0.035
    cups = bmesh.new()
    for side in (1, -1):
        centre = Vector((CX + side * cup_x, CY + (0.0 if not on_neck else -0.25 * D), cup_z))
        g = bmesh.ops.create_cone(cups, cap_ends=True, segments=24, radius1=p.get("cup", 0.07), radius2=p.get("cup", 0.07), depth=0.05)
        bmesh.ops.transform(cups, matrix=Matrix.Translation(centre) @ Matrix.Rotation(math.pi / 2, 4, "Y"), verts=g["verts"])
        torus(bm, centre + Vector((side * 0.026, 0, 0)), p.get("cup", 0.07) * 0.85, 0.016, axis=Vector((1, 0, 0)), segs=28, ring=8)
    new_object(p.get("cup_name", "Headphones_Cups" if not on_neck else "Neckwear_Cups"), cups, p["cups"])
    if not on_neck:
        # band over the top of the head
        for i in range(21):
            a = math.pi * i / 20
            pt = Vector((CX + math.cos(a) * cup_x, CY, cup_z + math.sin(a) * (Z1 + 0.05 - cup_z)))
            sphere(bm, pt, 0.02, segs=(8, 6))
        if p.get("cat_ears"):
            for side in (1, -1):
                base = Vector((CX + side * W * 0.62, CY, Z1 + 0.035))
                cone(bm, base, base + Vector((side * 0.02, 0, 0.11)), 0.06, segs=4)
    else:
        for i in range(15):
            a = math.pi * i / 14
            pt = Vector((CX + math.cos(a) * cup_x, CY + D * 0.4 + math.sin(a) * 0.05, cup_z))
            sphere(bm, pt, 0.018, segs=(8, 6))
    return new_object(p.get("name", "Headphones" if not on_neck else "Neckwear_Band"), bm, p["band"])


def piece_hat(p):
    """Beanie or backwards cap: a shell over the head, plus a folded cuff (beanie) or a brim (cap)."""
    cut = z(p.get("t_bottom", T_BROW + 0.06))
    if p.get("shape") == "dome":
        # a rounded crown: an ellipsoid that covers the head box, cut at the brim line
        bm = bmesh.new()
        g = bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=1.0)
        top = Z1 + p.get("thick", 0.03) + p.get("lift", 0.02)
        rz = (top - cut) / (1 - p.get("cut_frac", -0.35))
        centre_z = top - rz
        bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector((CX, CY + p.get("y", 0.0), centre_z))) @ Matrix.Diagonal((W * p.get("wide", 1.18), D * p.get("deep", 1.22), rz, 1.0)), verts=g["verts"])
    else:
        bm = hb.copy()
        lift = p.get("lift", 0.04)
        for v in bm.verts:
            v.co = v.co + v.normal * p.get("thick", 0.03)
            v.co.z += lift * max(0.0, (v.co.z - z(0.55))) / (H * 0.45)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < cut], context="VERTS")
    obj = new_object(p.get("name", "Hat"), bm, p["material"])
    if p.get("kind") == "beanie":
        cb = bmesh.new()
        torus(cb, Vector((CX, CY, cut + 0.03)), 1.0, 0.035, scale=(W + 0.035, D + 0.035, 1.0), segs=40, ring=10)
        new_object(p.get("cuff_name", "Hat_Cuff"), cb, p["material"])
        if p.get("patch"):
            pb = bmesh.new()
            rbox(pb, Vector((CX, Y0 - 0.07, cut + 0.035)), Vector((0.07, 0.012, 0.045)), 0.006)
            new_object("Hat_Patch", pb, p["patch"])
    if p.get("kind") == "cap_backwards":
        bb = bmesh.new()
        rbox(bb, Vector((CX, Y1 + 0.09, cut + 0.02)), Vector((W * 1.3, 0.16, 0.025)), 0.012, rot=Matrix.Rotation(-0.25, 3, "X"))
        new_object("Cap_Brim", bb, p["material"])
        sb = bmesh.new()
        rbox(sb, Vector((CX, Y0 - 0.01, cut + 0.03)), Vector((W * 0.7, 0.015, 0.05)), 0.008)
        new_object("Cap_Strap", sb, p.get("strap", p["material"]))
    return obj


PIECES = {"cap": piece_cap, "clumps": piece_clumps, "spikes": piece_spikes, "bangs": piece_bangs, "locks": piece_locks,
          "curtain": piece_curtain, "ponytail": piece_ponytail, "tail": piece_tail, "tufts": piece_tufts, "neckphones": piece_neckphones, "buns": piece_buns, "star": piece_star,
          "glasses": piece_glasses, "goggles": piece_goggles, "headphones": piece_headphones, "hat": piece_hat}

for piece in recipe.get("pieces", []):
    PIECES[piece["type"]](piece)
hb.free()

# per-object material zones (e.g. a varsity jacket: red body, white sleeves)
for name, slots in recipe.get("slots", {}).items():
    o = bpy.data.objects.get(name)
    if not o:
        continue
    for i, mat in enumerate(slots):
        if i < len(o.data.materials) and mat:
            o.data.materials[i] = MATS.get(mat) or bpy.data.materials.get(mat)

# eyebrow colour etc.
for name, mat in recipe.get("recolor", {}).items():
    o = bpy.data.objects.get(name)
    if o and o.data.materials:
        o.data.materials[0] = MATS.get(mat) or bpy.data.materials.get(mat)

# ---------------------------------------------------------------- export + renders
objs = [o for o in scene.objects if o.type == "MESH"]
pts = [v.co for o in objs for v in o.data.vertices]
lo, hi = Vector(map(min, *pts)), Vector(map(max, *pts))
print("DRESSED|objects=%d|size=(%.3f, %.3f, %.3f)|head_w=%.3f|brow_t=%.2f" % (len(objs), *(hi - lo), 2 * W, T_BROW))
bpy.ops.object.select_all(action="DESELECT")
for o in objs:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=f"{OUT}/{BASE}.glb", export_format="GLB", use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=f"{OUT}/{BASE}.blend", copy=True)

engines = [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
scene.render.engine = next((e for e in engines if "EEVEE" in e), "BLENDER_WORKBENCH")
scene.render.film_transparent = True
world = bpy.data.worlds.new("W")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.42, 0.45, 0.5, 1)
scene.world = world
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), math.radians(8), math.radians(-25))
scene.collection.objects.link(sun)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.type = "ORTHO"
scene.render.resolution_x = scene.render.resolution_y = 640
cam.data.ortho_scale = max(hi.x - lo.x, hi.z - lo.z) * 1.15
focus = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2))
for label, az, el in (("front", 0, 8), ("three_quarter", 35, 18), ("side", 90, 8), ("back", 180, 8)):
    a, e = math.radians(az), math.radians(el)
    cam.location = focus + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * 4
    cam.rotation_euler = (focus - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = f"{OUT}/render_{label}.png"
    bpy.ops.render.render(write_still=True)
# fixed-scale front view for measuring against the sheet (600 px = 1 m, ground at the bottom)
cam.data.ortho_scale = 1.0
cam.location = Vector((0, -5, 0.5))
cam.rotation_euler = (math.radians(90), 0, 0)
scene.render.resolution_x = scene.render.resolution_y = 600
scene.render.filepath = f"{OUT}/front_ortho.png"
bpy.ops.render.render(write_still=True)
print("DRESS_OK")
