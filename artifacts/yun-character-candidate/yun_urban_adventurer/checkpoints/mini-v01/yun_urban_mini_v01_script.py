import bpy
import bmesh
import math
import random
from mathutils import Matrix, Vector, Euler

# ---------------------------------------------------------------
# Yun - Kenney-style mini character (total height 0.672 m, faces -Y)
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


def add_ell(bm, c, r, mi=0, rot=(0.0, 0.0, 0.0), u=10, v=7):
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

# ---------------- shoes (z 0 .. 0.09) ----------------
for side, sname in ((1, "Shoe_L"), (-1, "Shoe_R")):
    x = side * 0.052
    bm = bmesh.new()
    add_box(bm, (x, -0.012, 0.014), (0.10, 0.155, 0.028), 0.01, 3)            # thick sole
    add_box(bm, (x, -0.005, 0.053), (0.09, 0.14, 0.07), 0.025, 0, segs=3)     # white high-top upper
    add_box(bm, (x, 0.0, 0.05), (0.094, 0.06, 0.04), 0.012, 1)                # black side panel
    add_box(bm, (x, 0.05, 0.07), (0.092, 0.04, 0.04), 0.012, 2)               # orange heel collar
    add_box(bm, (x, -0.045, 0.08), (0.05, 0.05, 0.022), 0.008, 1)             # black tongue / laces
    finalize(sname, bm, [M_SNEAK, M_BLACK, M_ORANGE, M_SOLE])

# ---------------- legs (z 0.04 .. 0.18) ----------------
for side, lname in ((1, "Leg_L"), (-1, "Leg_R")):
    bm = bmesh.new()
    add_box(bm, (side * 0.052, 0.0, 0.11), (0.07, 0.075, 0.14), 0.02)
    finalize(lname, bm, [M_LEGGING])

# ---------------- cargo shorts ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.19), (0.205, 0.145, 0.05), 0.015, 0)                # waist
for side in (1, -1):
    add_box(bm, (side * 0.052, 0.0, 0.15), (0.096, 0.14, 0.07), 0.018, 0)    # shorts legs
    add_box(bm, (side * 0.052, 0.0, 0.12), (0.102, 0.146, 0.024), 0.008, 1)  # grey hem
    add_box(bm, (side * 0.103, 0.0, 0.155), (0.016, 0.06, 0.045), 0.006, 0)  # cargo pockets
finalize("Shorts", bm, [M_OLIVE, M_HEM])

# ---------------- torso core + neck (skin, midriff band) ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.26), (0.18, 0.12, 0.14), 0.02)
add_box(bm, (0.0, 0.0, 0.345), (0.08, 0.08, 0.04), 0.012)
finalize("Torso", bm, [M_SKIN])

# ---------------- black crop top ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.279), (0.19, 0.13, 0.082), 0.02)
add_box(bm, (0.0, -0.072, 0.29), (0.075, 0.026, 0.07), 0.01)   # visible in the open jacket front
finalize("CropTop", bm, [M_BLACK])

# ---------------- cropped puffy bomber jacket ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.306), (0.225, 0.16, 0.088), 0.025, 0, segs=3)
for side in (1, -1):
    add_box(bm, (side * 0.11, 0.0, 0.305), (0.08, 0.15, 0.088), 0.03, 1, segs=3)  # orange-yellow shoulders
add_prism(bm, [(-0.05, 0.335), (0.0, 0.282), (0.05, 0.335)], 0.068, 0.086, 2)      # back patch
finalize("Jacket", bm, [M_CREAM, M_OYEL, M_ORANGE])

# ---------------- collar (black, lined orange) ----------------
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.3375), (0.17, 0.168, 0.045), 0.015, 0)
for side in (1, -1):
    add_box(bm, (side * 0.03, -0.084, 0.305), (0.016, 0.012, 0.05), 0.004, 1,
            rot=(0.0, side * 0.35, 0.0))
finalize("Collar", bm, [M_BLACK, M_ORANGE])

# ---------------- arms (T-pose at z 0.30) ----------------
AZ = 0.30
for side, aname in ((1, "Arm_L"), (-1, "Arm_R")):
    bm = bmesh.new()
    add_box(bm, (side * 0.15, 0.0, AZ), (0.12, 0.085, 0.085), 0.028, 0, segs=3)   # upper sleeve
    add_box(bm, (side * 0.205, 0.0, AZ), (0.022, 0.092, 0.092), 0.008, 1)         # elbow band
    add_box(bm, (side * 0.25, 0.0, AZ), (0.08, 0.08, 0.08), 0.025, 2, segs=3)     # forearm sleeve
    add_box(bm, (side * 0.302, 0.0, AZ), (0.036, 0.088, 0.088), 0.012, 1)         # cuff
    finalize(aname, bm, [M_OYEL, M_BLACK, M_CREAM])

# ---------------- hands (fingerless gloves, mitten style) ----------------
for side, hname in ((1, "Hand_L"), (-1, "Hand_R")):
    bm = bmesh.new()
    add_box(bm, (side * 0.335, 0.0, AZ), (0.045, 0.075, 0.08), 0.016, 0)               # glove
    add_box(bm, (side * 0.34, 0.0, AZ + 0.039), (0.03, 0.055, 0.012), 0.004, 2)        # orange accent
    add_box(bm, (side * 0.365, 0.0, AZ - 0.003), (0.04, 0.065, 0.065), 0.016, 1)       # fingers
    add_box(bm, (side * 0.335, -0.042, AZ + 0.005), (0.028, 0.026, 0.03), 0.009, 1)    # thumb
    finalize(hname, bm, [M_BLACK, M_SKIN, M_ORANGE])

# ---------------- hip strap (left) ----------------
bm = bmesh.new()
add_box(bm, (0.106, -0.01, 0.165), (0.014, 0.022, 0.09), 0.005, 0, rot=(0.0, 0.08, 0.0))
finalize("Hip_Strap", bm, [M_ORANGE])

# ---------------- crossbody bag (right hip) ----------------
bm = bmesh.new()
add_box(bm, (-0.118, -0.03, 0.185), (0.05, 0.10, 0.07), 0.015, 0)
add_box(bm, (-0.12, -0.03, 0.208), (0.056, 0.104, 0.03), 0.01, 1)
finalize("Bag", bm, [M_BLACK, M_CHAR])

p0 = Vector((-0.105, -0.082, 0.215))
p1 = Vector((0.085, -0.082, 0.345))
d = p1 - p0
strap_len = d.length + 0.012
strap_ang = math.atan2(d.z, d.x)
mid = (p0 + p1) * 0.5
bm = bmesh.new()
add_box(bm, (mid.x, mid.y, mid.z), (strap_len, 0.012, 0.016), 0.004, 0, rot=(0.0, -strap_ang, 0.0))
finalize("Bag_Strap", bm, [M_BLACK])

# ---------------- head (skin) + ears ----------------
HEAD_FRONT = -0.14
bm = bmesh.new()
add_box(bm, (0.0, 0.0, 0.494), (0.29, 0.28, 0.302), 0.05, 0, segs=3)   # z 0.343 .. 0.645
for side in (1, -1):
    add_ell(bm, (side * 0.145, -0.035, 0.46), (0.022, 0.028, 0.038), 0)
finalize("Head", bm, [M_SKIN])

# ---------------- face ----------------
bm = bmesh.new()
for side in (1, -1):
    add_ell(bm, (side * 0.055, HEAD_FRONT, 0.465), (0.017, 0.012, 0.027), 0, u=12, v=8)
finalize("Eyes", bm, [M_EYE])

bm = bmesh.new()
for side in (1, -1):
    add_box(bm, (side * 0.058, HEAD_FRONT - 0.001, 0.51), (0.04, 0.012, 0.011), 0.004, 0,
            rot=(0.0, side * -0.17, 0.0))
finalize("Eyebrows", bm, [M_HAIR])

bm = bmesh.new()
add_torus(bm, (0.0, HEAD_FRONT, 0.432), 0.022, 0.0045, 0, rot=(math.pi / 2.0, 0.0, 0.0),
          seg=8, rseg=6, a0=math.radians(205.0), a1=math.radians(335.0))
finalize("Mouth", bm, [M_MOUTH])

bm = bmesh.new()
for side in (1, -1):
    add_ell(bm, (side * 0.088, HEAD_FRONT + 0.001, 0.428), (0.02, 0.006, 0.012), 0)
finalize("Cheeks", bm, [M_BLUSH])

# ---------------- gold hoop earrings ----------------
bm = bmesh.new()
for side in (1, -1):
    add_torus(bm, (side * 0.15, -0.035, 0.408), 0.017, 0.0045, 0,
              rot=(0.0, math.pi / 2.0, 0.0), seg=12, rseg=6)
finalize("Earrings", bm, [M_GOLD])

# ---------------- hair: curly volume ----------------
rnd = random.Random(7)
bm = bmesh.new()
add_box(bm, (0.0, 0.015, 0.6), (0.305, 0.29, 0.144), 0.05, 0, segs=3)        # cap, top at 0.672
for side in (1, -1):
    add_box(bm, (side * 0.145, 0.085, 0.52), (0.04, 0.16, 0.24), 0.018, 0)    # side blocks
add_box(bm, (0.0, 0.15, 0.5), (0.30, 0.05, 0.28), 0.02, 0)                   # back block

top_curls = [(-0.09, -0.07), (0.0, -0.08), (0.09, -0.07),
             (-0.10, 0.03), (0.0, 0.03), (0.10, 0.03),
             (-0.09, 0.12), (0.09, 0.12)]
for x, y in top_curls:
    add_ell(bm, (x + rnd.uniform(-0.006, 0.006), y + rnd.uniform(-0.006, 0.006), 0.632),
            (0.045, 0.045, 0.04), 0, u=12, v=8)

for x in (-0.095, -0.032, 0.032, 0.095):                                      # forehead curls
    add_ell(bm, (x, -0.132, 0.588 - abs(x) * 0.15), (0.038, 0.03, 0.036), 0)

for side in (1, -1):                                                          # side curls
    for y, z in ((0.03, 0.6), (0.11, 0.6), (0.06, 0.52), (0.14, 0.52), (0.10, 0.44)):
        add_ell(bm, (side * 0.152, y + rnd.uniform(-0.005, 0.005), z), (0.032, 0.042, 0.042), 0)

for x, z in ((-0.1, 0.6), (0.0, 0.6), (0.1, 0.6), (-0.1, 0.5), (0.0, 0.5), (0.1, 0.5),
             (-0.07, 0.40), (0.07, 0.40)):                                    # back curls
    add_ell(bm, (x + rnd.uniform(-0.005, 0.005), 0.168, z), (0.048, 0.034, 0.046), 0)
finalize("Hair_Curls", bm, [M_HAIR])

# ---------------- scrunchie + high ponytail ----------------
bm = bmesh.new()
add_torus(bm, (0.0, 0.185, 0.632), 0.03, 0.013, 0, rot=(-math.pi / 4.0, 0.0, 0.0), seg=16, rseg=8)
finalize("Scrunchie", bm, [M_ORANGE])

bm = bmesh.new()
pony = [((0.0, 0.205, 0.642), (0.03, 0.03, 0.03)),
        ((0.0, 0.235, 0.62), (0.045, 0.042, 0.045)),
        ((0.0, 0.262, 0.575), (0.05, 0.045, 0.05)),
        ((0.0, 0.272, 0.52), (0.046, 0.042, 0.046)),
        ((0.0, 0.265, 0.47), (0.038, 0.036, 0.04)),
        ((0.035, 0.255, 0.55), (0.032, 0.032, 0.034)),
        ((-0.035, 0.255, 0.55), (0.032, 0.032, 0.034))]
for c, r in pony:
    add_ell(bm, c, r, 0, u=12, v=8)
finalize("Hair_Ponytail", bm, [M_HAIR])

bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
bpy.context.view_layer.objects.active = root
