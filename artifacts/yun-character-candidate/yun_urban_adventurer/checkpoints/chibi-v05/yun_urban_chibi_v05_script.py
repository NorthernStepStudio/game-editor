import bpy
import bmesh
import math
import random
from mathutils import Matrix, Vector, Euler

# ---------------------------------------------------------------
# Yun: Kenney-style mini character (v05). Bigger rounded head, chunkier body.
# Total height 0.672 m including the ponytail, feet at z=0, T-pose, faces -Y.
# The character's left side is +X. Everything is built at final size in metres.
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
M_EYE_HI = make_mat("Yun_Eye_Highlight", (1.0, 1.0, 1.0), 0.2)
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
SHOE_X = 0.065                       # 0.115 wide shoes -> outer width 0.245
LEG_X = 0.06                         # 0.09 thick legs -> outer width 0.21
AZ = 0.28                            # arm axis height
ARM_T = 0.07                         # arm thickness

HEAD_BOT = 0.33
HEAD_TOP = 0.60
HEAD_S = (0.30, 0.27, HEAD_TOP - HEAD_BOT)
HEAD_C = (0.0, 0.0, (HEAD_BOT + HEAD_TOP) * 0.5)   # z 0.465
HEAD_BEV = 0.07
HEAD_FRONT = -HEAD_S[1] * 0.5                       # -0.135
HEAD_SIDE = HEAD_S[0] * 0.5                         # 0.15
TOP_Z = 0.672

# =================================================================
# BODY
# =================================================================

# ---------------- chunky high-top sneakers (z 0 .. 0.095) ----------------
for side, sname in ((1, "Shoe_L"), (-1, "Shoe_R")):
    x = side * SHOE_X
    bm = bmesh.new()
    add_box(bm, (x, -0.015, 0.02), (0.115, 0.17, 0.04), 0.015, 3)               # thick rounded sole
    add_box(bm, (x, -0.01, 0.063), (0.105, 0.15, 0.064), 0.028, 0, segs=3)      # white upper ..0.095
    add_box(bm, (x, 0.008, 0.06), (0.109, 0.07, 0.04), 0.012, 1)                # black side panel
    add_box(bm, (x, 0.05, 0.078), (0.107, 0.045, 0.034), 0.012, 2)              # orange heel collar
    add_box(bm, (x, -0.045, 0.086), (0.055, 0.06, 0.018), 0.007, 1)             # black tongue / laces
    add_box(bm, (x, -0.08, 0.045), (0.08, 0.02, 0.02), 0.007, 2)                # orange toe stripe
    finalize(sname, bm, [M_SNEAK, M_BLACK, M_ORANGE, M_SOLE])

# ---------------- thick legs (z 0.085 .. 0.185, into shoe and shorts) ----------------
for side, lname in ((1, "Leg_L"), (-1, "Leg_R")):
    bm = bmesh.new()
    add_box(bm, (side * LEG_X, 0.0, 0.135), (0.09, 0.09, 0.10), 0.025)
    finalize(lname, bm, [M_LEGGING])

# ---------------- cargo shorts (0.225 wide) ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.185), (0.225, 0.165, 0.05), 0.018, 0)                 # waist z 0.16..0.21
for side in (1, -1):
    add_box(bm, (side * LEG_X, 0.0, 0.1525), (0.105, 0.155, 0.065), 0.02, 0)     # shorts legs 0.12..0.185
    add_box(bm, (side * LEG_X, 0.0, 0.128), (0.11, 0.16, 0.02), 0.007, 1)        # grey hem
    add_box(bm, (side * 0.115, 0.01, 0.155), (0.02, 0.055, 0.045), 0.006, 0)     # cargo pockets
finalize("Shorts", bm, [M_OLIVE, M_HEM])

# ---------------- belt ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.205), (0.232, 0.172, 0.014), 0.005, 0)                 # z 0.198..0.212
add_box(bm, (0.0, -0.087, 0.205), (0.03, 0.006, 0.018), 0.002, 1)               # buckle
finalize("Belt", bm, [M_CHAR, M_GOLD])

# ---------------- torso core (skin, midriff) + neck ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.255), (0.22, 0.15, 0.13), 0.03)                        # z 0.19..0.32
add_box(bm, (0.0, 0.0, 0.315), (0.10, 0.09, 0.05), 0.012)                       # neck 0.29..0.34
finalize("Torso", bm, [M_SKIN])

# ---------------- black crop top ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.255), (0.228, 0.158, 0.05), 0.02)                      # z 0.23..0.28
add_box(bm, (0.0, -0.087, 0.29), (0.065, 0.012, 0.05), 0.005)                   # in jacket opening
finalize("CropTop", bm, [M_BLACK])

# ---------------- cropped puffy bomber jacket (0.24 x 0.17) ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.2825), (0.24, 0.17, 0.075), 0.03, 0, segs=3)          # z 0.245..0.32
for side in (1, -1):
    # puffy shoulders hold the arm roots (x 0.06..0.12, z 0.2325..0.3275)
    add_box(bm, (side * 0.09, 0.0, 0.28), (0.06, 0.176, 0.095), 0.028, 1, segs=3)
add_prism(bm, [(-0.05, 0.31), (0.0, 0.255), (0.05, 0.31)], 0.083, 0.094, 2)     # back patch
finalize("Jacket", bm, [M_CREAM, M_OYEL, M_ORANGE])

# ---------------- collar (black, lined orange) ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.322), (0.18, 0.18, 0.035), 0.014, 0)                  # z 0.3045..0.3395
for side in (1, -1):
    add_box(bm, (side * 0.035, -0.089, 0.30), (0.018, 0.012, 0.05), 0.004, 1,
            rot=(0.0, side * 0.35, 0.0))
finalize("Collar", bm, [M_BLACK, M_ORANGE])

# ---------------- hip strap (left, on the shorts side) ----------------
bm = bmesh.new()
add_box(bm, (0.116, -0.04, 0.165), (0.012, 0.022, 0.075), 0.004, 0, rot=(0.0, 0.08, 0.0))
finalize("Hip_Strap", bm, [M_ORANGE])

# ---------------- crossbody bag (right hip) ----------------
bm = bmesh.new()
add_box(bm, (-0.13, -0.045, 0.17), (0.045, 0.10, 0.065), 0.014, 0)             # x -0.1525..-0.1075
add_box(bm, (-0.131, -0.045, 0.195), (0.05, 0.105, 0.025), 0.008, 1)            # flap
finalize("Bag", bm, [M_BLACK, M_CHAR])

p0 = Vector((-0.12, -0.088, 0.20))       # inside the bag top
p1 = Vector((0.10, -0.088, 0.31))        # at the left shoulder, on the jacket front
d = p1 - p0
strap_len = d.length + 0.012
strap_ang = math.atan2(d.z, d.x)
mid = (p0 + p1) * 0.5
bm = bmesh.new()
add_box(bm, (mid.x, mid.y, mid.z), (strap_len, 0.012, 0.018), 0.004, 0, rot=(0.0, -strap_ang, 0.0))
finalize("Bag_Strap", bm, [M_BLACK])

# =================================================================
# ARMS: x 0.11 .. 0.29, axis z 0.28, ~0.07 thick
# =================================================================
for side, aname in ((1, "Arm_L"), (-1, "Arm_R")):
    bm = bmesh.new()
    add_box(bm, (side * 0.145, 0.0, AZ), (0.07, ARM_T, ARM_T), 0.024, 0, segs=3)      # upper 0.11..0.18
    add_box(bm, (side * 0.182, 0.0, AZ), (0.014, 0.076, 0.076), 0.006, 1)             # black band
    add_box(bm, (side * 0.2025, 0.0, AZ), (0.033, 0.066, 0.066), 0.02, 2, segs=3)     # cream lower
    add_box(bm, (side * 0.226, 0.0, AZ), (0.018, 0.074, 0.074), 0.008, 1)             # black cuff
    finalize(aname, bm, [M_OYEL, M_BLACK, M_CREAM])

# ---------------- chunky mitten hands (fingerless gloves) ----------------
for side, hname in ((1, "Hand_L"), (-1, "Hand_R")):
    bm = bmesh.new()
    add_box(bm, (side * 0.251, 0.0, AZ), (0.038, 0.072, 0.072), 0.018, 0, segs=3)     # glove 0.232..0.27
    add_box(bm, (side * 0.268, 0.0, AZ), (0.014, 0.075, 0.075), 0.006, 2)             # orange knuckles
    add_box(bm, (side * 0.278, 0.0, AZ - 0.002), (0.024, 0.064, 0.062), 0.01, 1)      # fingers ..0.29
    add_box(bm, (side * 0.255, -0.04, AZ + 0.008), (0.026, 0.024, 0.032), 0.008, 0)   # thumb
    finalize(hname, bm, [M_BLACK, M_SKIN, M_ORANGE])

# =================================================================
# HEAD: rounded cube 0.30 x 0.27 x 0.27, z 0.33 .. 0.60
# =================================================================
EAR_X = HEAD_SIDE + 0.003            # 0.153
EAR_Y = 0.005
EAR_Z = 0.42
EAR_R = (0.016, 0.02, 0.028)

bm = bmesh.new()
add_box(bm, HEAD_C, HEAD_S, HEAD_BEV, 0, segs=4)
for side in (1, -1):
    add_ell(bm, (side * EAR_X, EAR_Y, EAR_Z), EAR_R, 0)
finalize("Head", bm, [M_SKIN])

# ---------------- face (lower half of the head) ----------------
EYE_X = 0.065
EYE_Z = 0.43
EYE_R = (0.025, 0.012, 0.0325)       # 0.05 wide, 0.065 tall
bm = bmesh.new()
for side in (1, -1):
    add_ell(bm, (side * EYE_X, HEAD_FRONT + 0.003, EYE_Z), EYE_R, 0, u=16, v=10)
    add_ell(bm, (side * EYE_X + 0.011, HEAD_FRONT - 0.005, EYE_Z + 0.017),
            (0.008, 0.004, 0.01), 1, u=10, v=6)                                         # highlight
finalize("Eyes", bm, [M_EYE, M_EYE_HI])

bm = bmesh.new()
for side in (1, -1):
    add_box(bm, (side * EYE_X, HEAD_FRONT - 0.001, 0.475), (0.038, 0.01, 0.01), 0.0035, 0,
            rot=(0.0, side * -0.12, 0.0))
finalize("Eyebrows", bm, [M_HAIR])

# smile arc spans z ~0.379..0.388, seated on the slightly curved lower face
bm = bmesh.new()
add_torus(bm, (0.0, HEAD_FRONT + 0.004, 0.395), 0.016, 0.004, 0, rot=(math.pi / 2.0, 0.0, 0.0),
          seg=10, rseg=6, a0=math.radians(205.0), a1=math.radians(335.0))
finalize("Mouth", bm, [M_MOUTH])

bm = bmesh.new()
for side in (1, -1):
    add_ell(bm, (side * 0.095, HEAD_FRONT + 0.005, 0.40), (0.015, 0.006, 0.01), 0,
            rot=(0.0, 0.0, side * 0.2))
finalize("Cheeks", bm, [M_BLUSH])

# ---------------- gold hoop earrings (hang from the ear lobes) ----------------
HOOP_R = 0.016
HOOP_r = 0.004
hoop_z = EAR_Z - EAR_R[2] - HOOP_R + 0.003          # ring top tucks into the lobe
bm = bmesh.new()
for side in (1, -1):
    add_torus(bm, (side * (HEAD_SIDE + 0.005), EAR_Y, hoop_z), HOOP_R, HOOP_r, 0,
              rot=(0.0, math.pi / 2.0, 0.0), seg=14, rseg=6)
finalize("Earrings", bm, [M_GOLD])

# =================================================================
# HAIR: curly volume over top, sides and back, z 0.40 .. 0.645
# silhouette ~0.42 wide at z 0.40..0.55, ~0.36 wide at z 0.60
# =================================================================
rnd = random.Random(7)
bm = bmesh.new()
# cap over the skull, z 0.565..0.635
add_box(bm, (0.0, 0.005, 0.60), (0.33, 0.30, 0.07), 0.034, 0, segs=3)
# fill blocks behind the ears
for side in (1, -1):
    add_box(bm, (side * 0.15, 0.085, 0.49), (0.05, 0.09, 0.14), 0.015, 0)
# back block, z 0.46..0.61
add_box(bm, (0.0, 0.14, 0.535), (0.28, 0.04, 0.15), 0.015, 0)

# top curls, rounded top at 0.645
TOP_R = (0.06, 0.06, 0.035)
for x, y in ((-0.09, -0.07), (0.0, -0.07), (0.09, -0.07),
             (-0.09, 0.02), (0.0, 0.02), (0.09, 0.02),
             (-0.09, 0.10), (0.0, 0.10), (0.09, 0.10)):
    add_ell(bm, (x + rnd.uniform(-0.004, 0.004), y + rnd.uniform(-0.003, 0.003), 0.61), TOP_R, 0)

# upper side curls carry the width (~0.36-0.37) at z 0.60
for side in (1, -1):
    for y in (-0.06, 0.03, 0.11):
        add_ell(bm, (side * 0.145, y, 0.595), (0.04, 0.05, 0.04), 0)

# fringe: 4 curls over the forehead, bottoms at z 0.50
for x, z in ((-0.09, 0.535), (-0.03, 0.538), (0.03, 0.538), (0.09, 0.535)):
    add_ell(bm, (x, HEAD_FRONT + 0.005, z), (0.042, 0.03, 0.035), 0)

# side curls framing the face (x 0.125..0.215 -> 0.43 wide), down to z ~0.40;
# the front and back columns leave a gap for the ear and hoop
SIDE_R = (0.045, 0.045, 0.045)
for side in (1, -1):
    sx = side * 0.17
    for y, z in ((-0.075, 0.545), (-0.075, 0.495), (-0.075, 0.445),
                 (0.075, 0.545), (0.075, 0.495), (0.075, 0.445),
                 (0.005, 0.53)):
        add_ell(bm, (sx, y + rnd.uniform(-0.003, 0.003), z), SIDE_R, 0)

# back curls (back reaches y ~0.20), down to z 0.46
for x, z in ((-0.10, 0.565), (0.0, 0.565), (0.10, 0.565),
             (-0.10, 0.505), (0.0, 0.505), (0.10, 0.505)):
    add_ell(bm, (x + rnd.uniform(-0.004, 0.004), 0.15, z), (0.065, 0.05, 0.045), 0)
finalize("Hair_Curls", bm, [M_HAIR])

# ---------------- scrunchie + high ponytail at the top-back ----------------
PONY_Y = 0.10
PONY_Z = 0.632
bm = bmesh.new()
add_torus(bm, (0.0, PONY_Y, PONY_Z), 0.028, 0.011, 0, rot=(-0.6, 0.0, 0.0), seg=16, rseg=8)
finalize("Scrunchie", bm, [M_ORANGE])

PUFF_R = (0.05, 0.045, 0.032)
bm = bmesh.new()
pony = [((0.0, PONY_Y, PONY_Z), (0.024, 0.024, 0.024)),                  # stem through the scrunchie
        ((0.0, PONY_Y + 0.03, TOP_Z - PUFF_R[2]), PUFF_R),               # main puff, top = 0.672
        ((-0.035, PONY_Y + 0.035, 0.63), (0.03, 0.03, 0.028)),
        ((0.035, PONY_Y + 0.035, 0.63), (0.03, 0.03, 0.028)),
        ((0.0, PONY_Y + 0.07, 0.625), (0.032, 0.032, 0.03)),
        ((0.01, PONY_Y + 0.05, 0.65), (0.028, 0.028, 0.02))]
for c, r in pony:
    add_ell(bm, c, r, 0)
finalize("Hair_Ponytail", bm, [M_HAIR])

bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
bpy.context.view_layer.objects.active = root
