import bpy
import bmesh
import math
import random
from mathutils import Matrix, Vector, Euler

# ---------------------------------------------------------------
# Yun - Kenney-style mini character, proportions matched to Nati.
# Total height 0.672 m, feet at z=0, T-pose, faces -Y.
# Character's left side is +X.
# ---------------------------------------------------------------

def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def make_mat(name, rgb, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    col = (srgb_to_lin(rgb[0]), srgb_to_lin(rgb[1]), srgb_to_lin(rgb[2]), 1.0)
    m.diffuse_color = col
    m.roughness = rough
    m.metallic = metal
    nt = m.node_tree
    if nt is not None:
        bsdf = None
        out = None
        for n in nt.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                bsdf = n
            elif n.type == 'OUTPUT_MATERIAL':
                out = n
        if bsdf is None:
            bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
            if out is None:
                out = nt.nodes.new('ShaderNodeOutputMaterial')
            nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
        bsdf.inputs['Base Color'].default_value = col
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = metal
    return m


def mtx(c, s=(1.0, 1.0, 1.0), rot=(0.0, 0.0, 0.0)):
    return (Matrix.Translation(Vector(c))
            @ Euler(rot, 'XYZ').to_matrix().to_4x4()
            @ Matrix.Diagonal((s[0], s[1], s[2], 1.0)))


def tag_new_faces(bm, before, mi, smooth=True):
    for f in bm.faces:
        if f not in before:
            f.material_index = mi
            f.smooth = smooth


def add_box(bm, c, s, bev, mi=0, rot=(0.0, 0.0, 0.0), segs=2):
    before = set(bm.faces)
    res = bmesh.ops.create_cube(bm, size=1.0, matrix=mtx(c, s, rot))
    verts = list(res['verts'])
    if bev > 0.0:
        edges = list({e for v in verts for e in v.link_edges})
        bev = min(bev, min(s) * 0.48)
        bmesh.ops.bevel(bm, geom=verts + edges, offset=bev, offset_type='OFFSET',
                        segments=segs, profile=0.5, affect='EDGES', clamp_overlap=True)
    tag_new_faces(bm, before, mi, True)


def add_ell(bm, c, r, mi=0, rot=(0.0, 0.0, 0.0), u=12, v=8):
    before = set(bm.faces)
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=1.0, matrix=mtx(c, r, rot))
    tag_new_faces(bm, before, mi, True)


def add_torus(bm, c, R, r, mi=0, rot=(0.0, 0.0, 0.0), seg=16, rseg=8, a0=0.0, a1=2.0 * math.pi):
    M = mtx(c, (1.0, 1.0, 1.0), rot)
    full = abs((a1 - a0) - 2.0 * math.pi) < 1e-6
    n = seg if full else seg + 1
    rows = []
    for i in range(n):
        t = a0 + (a1 - a0) * i / seg
        ring = []
        for j in range(rseg):
            p = 2.0 * math.pi * j / rseg
            x = (R + r * math.cos(p)) * math.cos(t)
            y = (R + r * math.cos(p)) * math.sin(t)
            z = r * math.sin(p)
            ring.append(bm.verts.new(M @ Vector((x, y, z))))
        rows.append(ring)
    faces = []
    for i in range(seg):
        a = rows[i]
        b = rows[(i + 1) % n] if full else rows[i + 1]
        for j in range(rseg):
            faces.append(bm.faces.new((a[j], b[j], b[(j + 1) % rseg], a[(j + 1) % rseg])))
    if not full:
        faces.append(bm.faces.new(list(reversed(rows[0]))))
        faces.append(bm.faces.new(rows[-1]))
    for f in faces:
        f.material_index = mi
        f.smooth = True


def add_prism(bm, pts, y0, y1, mi=0):
    fv = [bm.verts.new((x, y0, z)) for x, z in pts]
    bv = [bm.verts.new((x, y1, z)) for x, z in pts]
    faces = [bm.faces.new(fv), bm.faces.new(list(reversed(bv)))]
    n = len(pts)
    for i in range(n):
        faces.append(bm.faces.new((fv[i], fv[(i + 1) % n], bv[(i + 1) % n], bv[i])))
    for f in faces:
        f.material_index = mi
        f.smooth = False


# ---------------- root ----------------
root = bpy.data.objects.new("Yun", None)
root.empty_display_type = 'PLAIN_AXES'
root.empty_display_size = 0.3
bpy.context.collection.objects.link(root)


def finalize(name, bm, mats):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name + "_Mesh")
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.parent = root
    return ob


# ---------------- materials ----------------
M_SKIN = make_mat("Yun_Skin", (0.63, 0.42, 0.28), 0.55)
M_HAIR = make_mat("Yun_Hair_DarkBrown", (0.17, 0.10, 0.07), 0.8)
M_EYE = make_mat("Yun_Eye_Dark", (0.07, 0.05, 0.05), 0.3)
M_MOUTH = make_mat("Yun_Mouth", (0.35, 0.12, 0.10), 0.5)
M_BLUSH = make_mat("Yun_Blush", (0.80, 0.46, 0.38), 0.6)
M_GOLD = make_mat("Yun_Gold", (1.0, 0.76, 0.30), 0.3, 1.0)
M_CREAM = make_mat("Yun_Jacket_Cream", (0.95, 0.91, 0.82), 0.7)
M_OYEL = make_mat("Yun_Jacket_OrangeYellow", (1.0, 0.66, 0.15), 0.6)
M_ORANGE = make_mat("Yun_Orange", (0.96, 0.45, 0.10), 0.6)
M_BLACK = make_mat("Yun_Black", (0.06, 0.06, 0.07), 0.6)
M_CHAR = make_mat("Yun_Charcoal", (0.16, 0.16, 0.17), 0.6)
M_OLIVE = make_mat("Yun_Shorts_Olive", (0.47, 0.45, 0.27), 0.75)
M_HEM = make_mat("Yun_Shorts_Hem_Grey", (0.78, 0.78, 0.75), 0.7)
M_LEGGING = make_mat("Yun_Leggings_Black", (0.08, 0.08, 0.09), 0.75)
M_SNEAK = make_mat("Yun_Sneaker_White", (0.96, 0.96, 0.95), 0.55)
M_SOLE = make_mat("Yun_Sneaker_Sole", (0.86, 0.85, 0.82), 0.7)

# ---------------- key dimensions ----------------
LEG_X = 0.065
# torso: z 0.17 .. 0.35, ~0.26 wide, ~0.18 deep
HEAD_C = (0.0, 0.0, 0.495)
HEAD_S = (0.44, 0.33, 0.30)          # z 0.345 .. 0.645
HEAD_FRONT = -HEAD_S[1] * 0.5        # -0.165
HEAD_SIDE = HEAD_S[0] * 0.5          # 0.22
TOP_Z = 0.672
AZ = 0.305                           # arm axis height

# ---------------- chunky high-top sneakers (z 0 .. 0.10) ----------------
for side, sname in ((1, "Shoe_L"), (-1, "Shoe_R")):
    x = side * LEG_X
    bm = bmesh.new()
    add_box(bm, (x, -0.015, 0.0175), (0.115, 0.17, 0.035), 0.012, 3)            # thick sole
    add_box(bm, (x, -0.008, 0.065), (0.105, 0.155, 0.07), 0.03, 0, segs=3)      # white upper
    add_box(bm, (x, 0.005, 0.06), (0.109, 0.07, 0.045), 0.014, 1)               # black side panel
    add_box(bm, (x, 0.058, 0.08), (0.107, 0.045, 0.04), 0.014, 2)               # orange heel collar
    add_box(bm, (x, -0.05, 0.095), (0.06, 0.06, 0.02), 0.008, 1)                # black tongue / laces
    add_box(bm, (x, -0.085, 0.04), (0.08, 0.03, 0.02), 0.008, 2)                # orange toe stripe
    finalize(sname, bm, [M_SNEAK, M_BLACK, M_ORANGE, M_SOLE])

# ---------------- short thick legs (z 0.08 .. 0.20) ----------------
for side, lname in ((1, "Leg_L"), (-1, "Leg_R")):
    bm = bmesh.new()
    add_box(bm, (side * LEG_X, 0.0, 0.14), (0.085, 0.09, 0.12), 0.025)
    finalize(lname, bm, [M_LEGGING])

# ---------------- cargo shorts ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.19), (0.27, 0.19, 0.05), 0.018, 0)                     # waist 0.165..0.215
for side in (1, -1):
    add_box(bm, (side * LEG_X, 0.0, 0.165), (0.125, 0.17, 0.07), 0.022, 0)       # shorts legs
    add_box(bm, (side * LEG_X, 0.0, 0.135), (0.13, 0.176, 0.022), 0.008, 1)      # grey hem
    add_box(bm, (side * 0.135, 0.01, 0.165), (0.02, 0.06, 0.05), 0.007, 0)       # cargo pockets
finalize("Shorts", bm, [M_OLIVE, M_HEM])

# ---------------- torso core + neck (skin, midriff) ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.26), (0.25, 0.17, 0.18), 0.03)                         # z 0.17..0.35
add_box(bm, (0.0, 0.0, 0.35), (0.12, 0.11, 0.04), 0.012)                        # neck into head
finalize("Torso", bm, [M_SKIN])

# ---------------- black crop top ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.275), (0.258, 0.178, 0.07), 0.025)                     # z 0.24..0.31
add_box(bm, (0.0, -0.104, 0.305), (0.08, 0.02, 0.07), 0.008)                    # in jacket opening
finalize("CropTop", bm, [M_BLACK])

# ---------------- cropped puffy bomber jacket ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.305), (0.29, 0.21, 0.09), 0.035, 0, segs=3)            # z 0.26..0.35
for side in (1, -1):
    add_box(bm, (side * 0.125, 0.0, 0.305), (0.07, 0.2, 0.094), 0.035, 1, segs=3)  # shoulders
add_prism(bm, [(-0.06, 0.34), (0.0, 0.275), (0.06, 0.34)], 0.092, 0.114, 2)       # back patch
finalize("Jacket", bm, [M_CREAM, M_OYEL, M_ORANGE])

# ---------------- collar (black, lined orange) ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.34), (0.21, 0.215, 0.045), 0.016, 0)
for side in (1, -1):
    add_box(bm, (side * 0.04, -0.106, 0.31), (0.02, 0.014, 0.06), 0.005, 1,
            rot=(0.0, side * 0.35, 0.0))
finalize("Collar", bm, [M_BLACK, M_ORANGE])

# ---------------- stubby arms (T-pose), sleeves to the wrist ----------------
for side, aname in ((1, "Arm_L"), (-1, "Arm_R")):
    bm = bmesh.new()
    add_box(bm, (side * 0.175, 0.0, AZ), (0.09, 0.088, 0.088), 0.03, 0, segs=3)    # upper 0.13..0.22
    add_box(bm, (side * 0.225, 0.0, AZ), (0.02, 0.094, 0.094), 0.008, 1)          # black band
    add_box(bm, (side * 0.258, 0.0, AZ), (0.05, 0.084, 0.084), 0.026, 2, segs=3)  # cream lower
    add_box(bm, (side * 0.29, 0.0, AZ), (0.024, 0.092, 0.092), 0.01, 1)           # black cuff
    finalize(aname, bm, [M_OYEL, M_BLACK, M_CREAM])

# ---------------- chunky mitten hands (fingerless gloves) ----------------
for side, hname in ((1, "Hand_L"), (-1, "Hand_R")):
    bm = bmesh.new()
    add_box(bm, (side * 0.3275, 0.0, AZ), (0.065, 0.09, 0.09), 0.022, 0, segs=3)   # glove 0.295..0.36
    add_box(bm, (side * 0.354, 0.0, AZ), (0.018, 0.094, 0.094), 0.008, 2)          # orange knuckles
    add_box(bm, (side * 0.37, 0.0, AZ - 0.002), (0.03, 0.082, 0.078), 0.012, 1)    # fingers 0.355..0.385
    add_box(bm, (side * 0.333, -0.05, AZ + 0.01), (0.035, 0.03, 0.04), 0.01, 0)    # thumb
    finalize(hname, bm, [M_BLACK, M_SKIN, M_ORANGE])

# ---------------- hip strap (left) ----------------
bm = bmesh.new()
add_box(bm, (0.137, -0.045, 0.175), (0.014, 0.025, 0.09), 0.005, 0, rot=(0.0, 0.08, 0.0))
finalize("Hip_Strap", bm, [M_ORANGE])

# ---------------- crossbody bag (right hip) ----------------
bm = bmesh.new()
add_box(bm, (-0.155, -0.05, 0.195), (0.05, 0.115, 0.075), 0.016, 0)
add_box(bm, (-0.157, -0.05, 0.222), (0.056, 0.12, 0.03), 0.01, 1)
finalize("Bag", bm, [M_BLACK, M_CHAR])

p0 = Vector((-0.145, -0.11, 0.23))
p1 = Vector((0.11, -0.11, 0.35))
d = p1 - p0
strap_len = d.length + 0.012
strap_ang = math.atan2(d.z, d.x)
mid = (p0 + p1) * 0.5
bm = bmesh.new()
add_box(bm, (mid.x, mid.y, mid.z), (strap_len, 0.014, 0.018), 0.004, 0, rot=(0.0, -strap_ang, 0.0))
finalize("Bag_Strap", bm, [M_BLACK])

# ---------------- big rounded head + ears ----------------
bm = bmesh.new()
add_box(bm, HEAD_C, HEAD_S, 0.08, 0, segs=3)
for side in (1, -1):
    add_ell(bm, (side * (HEAD_SIDE + 0.005), -0.05, 0.46), (0.03, 0.035, 0.05), 0)
finalize("Head", bm, [M_SKIN])

# ---------------- face (scaled up) ----------------
bm = bmesh.new()
for side in (1, -1):
    add_ell(bm, (side * 0.085, HEAD_FRONT, 0.485), (0.025, 0.015, 0.036), 0, u=12, v=8)
finalize("Eyes", bm, [M_EYE])

bm = bmesh.new()
for side in (1, -1):
    add_box(bm, (side * 0.088, HEAD_FRONT - 0.001, 0.543), (0.06, 0.014, 0.014), 0.005, 0,
            rot=(0.0, side * -0.12, 0.0))
finalize("Eyebrows", bm, [M_HAIR])

bm = bmesh.new()
add_torus(bm, (0.0, HEAD_FRONT, 0.448), 0.032, 0.0065, 0, rot=(math.pi / 2.0, 0.0, 0.0),
          seg=10, rseg=6, a0=math.radians(205.0), a1=math.radians(335.0))
finalize("Mouth", bm, [M_MOUTH])

bm = bmesh.new()
for side in (1, -1):
    add_ell(bm, (side * 0.12, HEAD_FRONT + 0.001, 0.44), (0.025, 0.007, 0.016), 0)
finalize("Cheeks", bm, [M_BLUSH])

# ---------------- gold hoop earrings ----------------
bm = bmesh.new()
for side in (1, -1):
    add_torus(bm, (side * 0.24, -0.05, 0.405), 0.024, 0.006, 0,
              rot=(0.0, math.pi / 2.0, 0.0), seg=14, rseg=6)
finalize("Earrings", bm, [M_GOLD])

# ---------------- hair: big chunky curly mass ----------------
rnd = random.Random(7)
bm = bmesh.new()
add_box(bm, (0.0, 0.0275, 0.60), (0.47, 0.355, 0.12), 0.05, 0, segs=3)        # cap z 0.54..0.66
for side in (1, -1):
    add_box(bm, (side * 0.225, 0.09, 0.50), (0.05, 0.22, 0.24), 0.02, 0)        # side blocks
add_box(bm, (0.0, 0.18, 0.49), (0.44, 0.04, 0.29), 0.018, 0)                   # back block

# top curls (tops land exactly at TOP_Z)
TOP_R = (0.085, 0.075, 0.072)
for x, y in ((-0.13, -0.07), (0.0, -0.07), (0.13, -0.07),
             (-0.13, 0.04), (0.0, 0.04), (0.13, 0.04),
             (-0.11, 0.13), (0.11, 0.13)):
    add_ell(bm, (x + rnd.uniform(-0.006, 0.006), y + rnd.uniform(-0.005, 0.005), TOP_Z - TOP_R[2]),
            TOP_R, 0)

# fringe: 4 big curls over the forehead
for x, z in ((-0.135, 0.605), (-0.045, 0.615), (0.045, 0.615), (0.135, 0.605)):
    add_ell(bm, (x, -0.14, z), (0.058, 0.035, 0.05), 0)

# side curls (behind the ears, reaching x = +-0.29)
for side in (1, -1):
    for y, z in ((0.0, 0.585), (0.10, 0.59), (0.05, 0.505), (0.14, 0.50), (0.11, 0.425)):
        add_ell(bm, (side * 0.24, y + rnd.uniform(-0.004, 0.004), z), (0.05, 0.058, 0.06), 0)

# back curls
for x, z in ((-0.14, 0.58), (0.0, 0.58), (0.14, 0.58),
             (-0.14, 0.48), (0.0, 0.48), (0.14, 0.48),
             (-0.08, 0.40), (0.08, 0.40)):
    add_ell(bm, (x + rnd.uniform(-0.005, 0.005), 0.17, z), (0.075, 0.035, 0.065), 0)
finalize("Hair_Curls", bm, [M_HAIR])

# ---------------- scrunchie + high ponytail (top-back) ----------------
bm = bmesh.new()
add_torus(bm, (0.0, 0.215, 0.615), 0.04, 0.016, 0, rot=(-math.pi / 4.0, 0.0, 0.0), seg=16, rseg=8)
finalize("Scrunchie", bm, [M_ORANGE])

bm = bmesh.new()
pony = [((0.0, 0.25, 0.625), (0.045, 0.04, 0.04)),
        ((0.0, 0.29, 0.585), (0.065, 0.06, 0.06)),
        ((-0.05, 0.28, 0.54), (0.055, 0.055, 0.055)),
        ((0.05, 0.28, 0.54), (0.055, 0.055, 0.055)),
        ((0.0, 0.31, 0.51), (0.06, 0.055, 0.06)),
        ((0.0, 0.30, 0.44), (0.05, 0.048, 0.05)),
        ((0.0, 0.285, 0.39), (0.04, 0.04, 0.04))]
for c, r in pony:
    add_ell(bm, c, r, 0)
finalize("Hair_Ponytail", bm, [M_HAIR])

bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
bpy.context.view_layer.objects.active = root
