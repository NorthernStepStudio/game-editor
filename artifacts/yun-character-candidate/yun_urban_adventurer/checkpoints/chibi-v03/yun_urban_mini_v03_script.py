import bpy
import bmesh
import math
import random
from mathutils import Matrix, Vector, Euler

# ---------------------------------------------------------------
# Yun - Kenney-style mini character, proportions matched to the roster.
# Feet at z=0, neck/chin at z=0.345, hair top ~0.645, T-pose, faces -Y.
# Smaller head (0.33 x 0.27 x 0.26), hair-hugging curls, stubby arms (span ~0.60).
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
HEAD_S = (0.33, 0.27, 0.26)                     # smaller head
HEAD_BOTTOM = 0.345
HEAD_C = (0.0, 0.0, HEAD_BOTTOM + HEAD_S[2] * 0.5)   # z 0.345 .. 0.605
HEAD_TOP = HEAD_BOTTOM + HEAD_S[2]              # 0.605
HEAD_FRONT = -HEAD_S[1] * 0.5                   # -0.135
HEAD_BACK = HEAD_S[1] * 0.5                     # 0.135
HEAD_SIDE = HEAD_S[0] * 0.5                     # 0.165
HEAD_BEV = 0.065
HZ = HEAD_C[2]                                  # 0.475
TOP_Z = 0.645                                   # hair top (~0.04 over the head)
AZ = 0.305                                      # arm axis height

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

# ---------------- stubby arms (T-pose), sleeve x 0.13 .. 0.25 ----------------
for side, aname in ((1, "Arm_L"), (-1, "Arm_R")):
    bm = bmesh.new()
    add_box(bm, (side * 0.161, 0.0, AZ), (0.062, 0.088, 0.088), 0.03, 0, segs=3)   # upper 0.13..0.192
    add_box(bm, (side * 0.192, 0.0, AZ), (0.016, 0.094, 0.094), 0.007, 1)          # black band 0.184..0.20
    add_box(bm, (side * 0.217, 0.0, AZ), (0.04, 0.084, 0.084), 0.019, 2, segs=3)   # cream lower 0.197..0.237
    add_box(bm, (side * 0.242, 0.0, AZ), (0.02, 0.092, 0.092), 0.008, 1)           # black cuff 0.232..0.252
    finalize(aname, bm, [M_OYEL, M_BLACK, M_CREAM])

# ---------------- chunky mitten hands (fingerless gloves), x 0.248 .. 0.30 ----------------
for side, hname in ((1, "Hand_L"), (-1, "Hand_R")):
    bm = bmesh.new()
    add_box(bm, (side * 0.264, 0.0, AZ), (0.032, 0.09, 0.09), 0.015, 0, segs=3)    # glove 0.248..0.28
    add_box(bm, (side * 0.2775, 0.0, AZ), (0.015, 0.094, 0.094), 0.006, 2)         # orange knuckles 0.27..0.285
    add_box(bm, (side * 0.29, 0.0, AZ - 0.002), (0.02, 0.082, 0.078), 0.009, 1)    # fingers 0.28..0.30
    add_box(bm, (side * 0.266, -0.05, AZ + 0.01), (0.03, 0.03, 0.04), 0.01, 0)     # thumb
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

# ---------------- rounded head + ears (smaller) ----------------
EAR_C = (HEAD_SIDE + 0.004, -0.04, HZ - 0.03)    # (0.169, -0.04, 0.445)
EAR_R = (0.024, 0.028, 0.04)
bm = bmesh.new()
add_box(bm, HEAD_C, HEAD_S, HEAD_BEV, 0, segs=3)
for side in (1, -1):
    add_ell(bm, (side * EAR_C[0], EAR_C[1], EAR_C[2]), EAR_R, 0)
finalize("Head", bm, [M_SKIN])

# ---------------- face (scaled to the smaller head) ----------------
bm = bmesh.new()
for side in (1, -1):
    add_ell(bm, (side * 0.064, HEAD_FRONT, HZ - 0.009), (0.02, 0.012, 0.029), 0, u=12, v=8)
finalize("Eyes", bm, [M_EYE])

bm = bmesh.new()
for side in (1, -1):
    add_box(bm, (side * 0.066, HEAD_FRONT - 0.001, HZ + 0.042), (0.048, 0.012, 0.012), 0.004, 0,
            rot=(0.0, side * -0.12, 0.0))
finalize("Eyebrows", bm, [M_HAIR])

bm = bmesh.new()
add_torus(bm, (0.0, HEAD_FRONT, HZ - 0.037), 0.026, 0.0055, 0, rot=(math.pi / 2.0, 0.0, 0.0),
          seg=10, rseg=6, a0=math.radians(205.0), a1=math.radians(335.0))
finalize("Mouth", bm, [M_MOUTH])

bm = bmesh.new()
for side in (1, -1):
    add_ell(bm, (side * 0.09, HEAD_FRONT + 0.001, HZ - 0.046), (0.019, 0.006, 0.013), 0)
finalize("Cheeks", bm, [M_BLUSH])

# ---------------- gold hoop earrings (hanging from the ear lobes) ----------------
bm = bmesh.new()
for side in (1, -1):
    add_torus(bm, (side * (EAR_C[0] + 0.011), EAR_C[1], EAR_C[2] - 0.045), 0.02, 0.005, 0,
              rot=(0.0, math.pi / 2.0, 0.0), seg=14, rseg=6)
finalize("Earrings", bm, [M_GOLD])

# ---------------- hair: curly mass hugging the head (max width ~0.42) ----------------
rnd = random.Random(7)
bm = bmesh.new()
add_box(bm, (0.0, 0.02, 0.565), (0.35, 0.29, 0.09), 0.035, 0, segs=3)          # cap z 0.52..0.61
for side in (1, -1):
    add_box(bm, (side * 0.175, 0.07, 0.50), (0.03, 0.14, 0.16), 0.012, 0)       # side blocks
add_box(bm, (0.0, 0.14, 0.49), (0.32, 0.03, 0.22), 0.012, 0)                   # back block

# top curls (tops land exactly at TOP_Z, ~0.04 above the head)
TOP_R = (0.06, 0.055, 0.045)
for x, y in ((-0.09, -0.065), (0.0, -0.065), (0.09, -0.065),
             (-0.09, 0.025), (0.0, 0.025), (0.09, 0.025),
             (-0.075, 0.10), (0.075, 0.10)):
    add_ell(bm, (x + rnd.uniform(-0.004, 0.004), y + rnd.uniform(-0.004, 0.004), TOP_Z - TOP_R[2]),
            TOP_R, 0)

# fringe: 4 curls over the forehead (above the brows)
for x, z in ((-0.105, 0.574), (-0.035, 0.58), (0.035, 0.58), (0.105, 0.574)):
    add_ell(bm, (x, HEAD_FRONT + 0.007, z), (0.045, 0.028, 0.038), 0)

# side curls (behind the ears, reaching x = +-0.21)
for side in (1, -1):
    for y, z in ((0.0, 0.555), (0.085, 0.56), (0.03, 0.495), (0.11, 0.49), (0.08, 0.425)):
        add_ell(bm, (side * 0.18, y + rnd.uniform(-0.003, 0.003), z), (0.03, 0.045, 0.045), 0)

# back curls
for x, z in ((-0.10, 0.57), (0.0, 0.57), (0.10, 0.57),
             (-0.10, 0.49), (0.0, 0.49), (0.10, 0.49),
             (-0.06, 0.415), (0.06, 0.415)):
    add_ell(bm, (x + rnd.uniform(-0.004, 0.004), 0.15, z), (0.055, 0.025, 0.05), 0)
finalize("Hair_Curls", bm, [M_HAIR])

# ---------------- scrunchie + high ponytail (top-back) ----------------
SC = Vector((0.0, 0.18, 0.59))
bm = bmesh.new()
add_torus(bm, tuple(SC), 0.032, 0.013, 0, rot=(-math.pi / 4.0, 0.0, 0.0), seg=16, rseg=8)
finalize("Scrunchie", bm, [M_ORANGE])

bm = bmesh.new()
pony = [((0.0, 0.028, 0.008), (0.036, 0.032, 0.032)),
        ((0.0, 0.06, -0.024), (0.052, 0.048, 0.048)),
        ((-0.04, 0.052, -0.06), (0.044, 0.044, 0.044)),
        ((0.04, 0.052, -0.06), (0.044, 0.044, 0.044)),
        ((0.0, 0.076, -0.084), (0.048, 0.044, 0.048)),
        ((0.0, 0.068, -0.14), (0.04, 0.038, 0.04)),
        ((0.0, 0.056, -0.18), (0.032, 0.032, 0.032))]
for off, r in pony:
    add_ell(bm, tuple(SC + Vector(off)), r, 0)
finalize("Hair_Ponytail", bm, [M_HAIR])

bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
bpy.context.view_layer.objects.active = root
