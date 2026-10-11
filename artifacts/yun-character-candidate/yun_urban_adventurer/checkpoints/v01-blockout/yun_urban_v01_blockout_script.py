import bpy
import bmesh
import math
import random
from mathutils import Vector, Matrix, Quaternion

random.seed(11)
ZUP = Vector((0.0, 0.0, 1.0))
HAIR_TOP = 1.60

# ---------------------------------------------------------------- materials
def make_mat(name, rgb, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    if nt is not None:
        bsdf = None
        for nd in nt.nodes:
            if nd.type == 'BSDF_PRINCIPLED':
                bsdf = nd
        if bsdf is None:
            bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
            out = None
            for nd in nt.nodes:
                if nd.type == 'OUTPUT_MATERIAL':
                    out = nd
            if out is None:
                out = nt.nodes.new("ShaderNodeOutputMaterial")
            nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
        bsdf.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1.0)
    m.roughness = rough
    m.metallic = metal
    return m

M_SKIN = make_mat("MAT_Skin", (0.42, 0.20, 0.10), 0.5)
M_EYE = make_mat("MAT_Eye_DarkBrown", (0.045, 0.02, 0.01), 0.3)
M_HILITE = make_mat("MAT_Eye_Highlight", (0.95, 0.95, 0.95), 0.2)
M_MOUTH = make_mat("MAT_Mouth", (0.20, 0.04, 0.035), 0.5)
M_HAIR = make_mat("MAT_Hair_DarkBrown", (0.04, 0.02, 0.01), 0.55)
M_ORANGE = make_mat("MAT_Orange", (0.95, 0.28, 0.02), 0.5)
M_ORYEL = make_mat("MAT_Orange_Yellow", (1.0, 0.50, 0.03), 0.55)
M_CREAM = make_mat("MAT_Jacket_Cream", (0.86, 0.80, 0.66), 0.65)
M_BLACK = make_mat("MAT_Black_Fabric", (0.018, 0.018, 0.02), 0.7)
M_LEGG = make_mat("MAT_Leggings_Black", (0.012, 0.012, 0.014), 0.45)
M_SHEER = make_mat("MAT_Leggings_Sheer", (0.07, 0.06, 0.06), 0.35)
M_KHAKI = make_mat("MAT_Shorts_OliveKhaki", (0.20, 0.20, 0.08), 0.8)
M_GREY = make_mat("MAT_Trim_LightGrey", (0.55, 0.55, 0.53), 0.7)
M_BELT = make_mat("MAT_Belt_Dark", (0.03, 0.025, 0.02), 0.5)
M_METAL = make_mat("MAT_Buckle_Metal", (0.6, 0.6, 0.62), 0.3, 1.0)
M_GOLD = make_mat("MAT_Gold", (1.0, 0.72, 0.30), 0.25, 1.0)
M_SNEAK = make_mat("MAT_Sneaker_White", (0.90, 0.90, 0.88), 0.5)
M_BAG = make_mat("MAT_Bag_Black", (0.02, 0.02, 0.022), 0.45)

# ---------------------------------------------------------------- root
ROOT = bpy.data.objects.new("YUN", None)
ROOT.empty_display_type = 'PLAIN_AXES'
bpy.context.collection.objects.link(ROOT)

# ---------------------------------------------------------------- helpers
def align(d):
    d = Vector(d)
    if d.z < 0.0:
        d = -d
    return ZUP.rotation_difference(d.normalized())


class Part:
    def __init__(self, name, mats):
        self.name = name
        self.mats = mats
        self.bm = bmesh.new()

    def _tag(self, verts, mi, smooth=True):
        fs = set()
        for v in verts:
            for f in v.link_faces:
                fs.add(f)
        for f in fs:
            f.material_index = mi
            f.smooth = smooth

    def sphere(self, loc, radii, rot=None, mi=0, seg=16, rings=10):
        q = rot if rot is not None else Quaternion()
        M = Matrix.LocRotScale(Vector(loc), q, Vector(radii))
        r = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=rings, radius=1.0, matrix=M)
        self._tag(r['verts'], mi)

    def cyl(self, p1, p2, r1, r2, mi=0, seg=12):
        p1 = Vector(p1)
        p2 = Vector(p2)
        if p2.z < p1.z:
            p1, p2 = p2, p1
            r1, r2 = r2, r1
        d = p2 - p1
        L = d.length
        q = ZUP.rotation_difference(d.normalized())
        M = Matrix.LocRotScale((p1 + p2) * 0.5, q, Vector((1.0, 1.0, 1.0)))
        r = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg,
                                  radius1=r1, radius2=r2, depth=L, matrix=M)
        self._tag(r['verts'], mi)

    def box(self, loc, size, mi=0, rot=None, bevel=0.0):
        q = rot if rot is not None else Quaternion()
        M = Matrix.LocRotScale(Vector(loc), q, Vector(size))
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=M)
        verts = list(r['verts'])
        self._tag(verts, mi, smooth=False)
        if bevel > 0.0:
            edges = list(set(e for v in verts for e in v.link_edges))
            try:
                res = bmesh.ops.bevel(self.bm, geom=verts + edges, offset=bevel, segments=2,
                                      profile=0.5, affect='EDGES')
                for f in res.get('faces', []):
                    f.material_index = mi
                    f.smooth = True
            except Exception:
                pass

    def loft(self, rings, mi=0, segs=20, gap=0.0, caps=True):
        full = gap <= 0.0
        if full:
            angs = [2.0 * math.pi * i / segs for i in range(segs)]
        else:
            angs = [gap + (2.0 * math.pi - 2.0 * gap) * i / segs for i in range(segs + 1)]
        rows = []
        for (zf, zb, rx, ry, cy) in rings:
            row = []
            for a in angs:
                k = (1.0 - math.cos(a)) * 0.5
                row.append(self.bm.verts.new((rx * math.sin(a), cy - ry * math.cos(a), zf + (zb - zf) * k)))
            rows.append(row)
        n = len(angs)
        faces = []
        for j in range(len(rows) - 1):
            r0, r1 = rows[j], rows[j + 1]
            rng = range(n) if full else range(n - 1)
            for i in rng:
                i2 = (i + 1) % n
                faces.append(self.bm.faces.new((r0[i], r0[i2], r1[i2], r1[i])))
        if full and caps:
            faces.append(self.bm.faces.new(list(reversed(rows[0]))))
            faces.append(self.bm.faces.new(rows[-1]))
        for f in faces:
            f.material_index = mi
            f.smooth = True

    def torus(self, center, axis, R, r, mi=0, seg=16, sides=8):
        q = ZUP.rotation_difference(Vector(axis).normalized())
        c = Vector(center)
        grid = []
        for i in range(seg):
            u = 2.0 * math.pi * i / seg
            row = []
            for j in range(sides):
                v = 2.0 * math.pi * j / sides
                p = Vector(((R + r * math.cos(v)) * math.cos(u),
                            (R + r * math.cos(v)) * math.sin(u),
                            r * math.sin(v)))
                row.append(self.bm.verts.new(c + q @ p))
            grid.append(row)
        for i in range(seg):
            for j in range(sides):
                f = self.bm.faces.new((grid[i][j], grid[(i + 1) % seg][j],
                                       grid[(i + 1) % seg][(j + 1) % sides], grid[i][(j + 1) % sides]))
                f.material_index = mi
                f.smooth = True

    def finish(self):
        bm = self.bm
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        me = bpy.data.meshes.new(self.name + "_Mesh")
        bm.to_mesh(me)
        bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.collection.objects.link(ob)
        ob.parent = ROOT
        return ob


def solidify(ob, t):
    mod = ob.modifiers.new("Solidify", 'SOLIDIFY')
    mod.thickness = t
    mod.offset = 0.0
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)


def ring(z, rx, ry, cy=0.0, zb=None):
    return (z, z if zb is None else zb, rx, ry, cy)


def ell_front(c, rad, x, z):
    u = (x - c[0]) / rad[0]
    w = (z - c[2]) / rad[2]
    s = max(0.0, 1.0 - u * u - w * w)
    y = c[1] - rad[1] * math.sqrt(s)
    n = Vector(((x - c[0]) / rad[0] ** 2, (y - c[1]) / rad[1] ** 2, (z - c[2]) / rad[2] ** 2)).normalized()
    return Vector((x, y, z)), n


def face_quat(n):
    return Vector((0.0, -1.0, 0.0)).rotation_difference(n)


def hair_sphere(part, c, r, mi=0, seg=12, rings=8):
    c = Vector(c)
    if c.z + r > HAIR_TOP:
        c.z = HAIR_TOP - r
    part.sphere(c, (r, r, r), mi=mi, seg=seg, rings=rings)


def thigh_pt(side, z):
    H = Vector((0.09 * side, 0.0, 0.78))
    K = Vector((0.10 * side, -0.005, 0.445))
    t = (H.z - z) / (H.z - K.z)
    return H.lerp(K, t), 0.074 + (0.048 - 0.074) * t


# ---------------------------------------------------------------- body torso / neck
torso = Part("Body_Torso", [M_SKIN])
torso.loft([
    ring(0.80, 0.11, 0.075),
    ring(0.86, 0.13, 0.085),
    ring(0.95, 0.115, 0.075),
    ring(1.00, 0.105, 0.07),
    ring(1.08, 0.115, 0.078),
    ring(1.15, 0.13, 0.085),
    ring(1.22, 0.14, 0.082),
    ring(1.255, 0.112, 0.07),
    ring(1.275, 0.07, 0.05),
    ring(1.285, 0.04, 0.035),
], segs=20)
torso.finish()

neck = Part("Neck", [M_SKIN])
neck.cyl((0.0, 0.005, 1.25), (0.0, 0.0, 1.375), 0.036, 0.033, seg=14)
neck.finish()

# ---------------------------------------------------------------- head
SKULL_C = Vector((0.0, 0.0, 1.46))
SKULL_R = (0.095, 0.105, 0.105)
JAW_C = Vector((0.0, -0.022, 1.395))
JAW_R = (0.078, 0.075, 0.07)

head = Part("Head", [M_SKIN])
head.sphere(SKULL_C, SKULL_R, seg=20, rings=14)
head.sphere(JAW_C, JAW_R, seg=18, rings=12)
head.sphere((0.0, -0.05, 1.325), (0.028, 0.025, 0.022), seg=12, rings=8)        # pointed chin
head.sphere((0.0, -0.095, 1.415), (0.009, 0.012, 0.011), seg=10, rings=6)       # nose
for s in (1, -1):
    head.sphere((0.093 * s, 0.005, 1.43), (0.014, 0.024, 0.032), seg=10, rings=8)  # ears
head.finish()

eyes = Part("Face_Eyes", [M_EYE, M_HILITE, M_HAIR])
for s in (1, -1):
    p, n = ell_front(SKULL_C, SKULL_R, 0.04 * s, 1.44)
    q = face_quat(n)
    eyes.sphere(p - n * 0.006, (0.024, 0.012, 0.032), rot=q, mi=0, seg=16, rings=8)
    ax = q @ Vector((1.0, 0.0, 0.0))
    az = q @ Vector((0.0, 0.0, 1.0))
    eyes.sphere(p + n * 0.004 + az * 0.012 + ax * (0.006 * s), (0.006, 0.004, 0.007), rot=q, mi=1, seg=8, rings=6)
    # brows
    pb, nb = ell_front(SKULL_C, SKULL_R, 0.042 * s, 1.484)
    qb = face_quat(nb) @ Quaternion(Vector((0.0, 1.0, 0.0)), 0.15 * s)
    eyes.sphere(pb - nb * 0.001, (0.02, 0.006, 0.0045), rot=qb, mi=2, seg=10, rings=6)
eyes.finish()

mouth = Part("Face_Mouth", [M_MOUTH])
for xi in (-0.016, -0.008, 0.0, 0.008, 0.016):
    zz = 1.366 + 0.005 * (xi / 0.016) ** 2
    p, n = ell_front(JAW_C, JAW_R, xi, zz)
    mouth.sphere(p - n * 0.001, (0.0048, 0.0048, 0.0042), mi=0, seg=8, rings=6)
mouth.finish()

for s, sfx in ((1, "L"), (-1, "R")):
    ring_obj = Part("Earring_" + sfx, [M_GOLD])
    ring_obj.torus((0.096 * s, 0.008, 1.39), (1.0, 0.0, 0.0), 0.013, 0.0022, seg=16, sides=6)
    ring_obj.finish()

# ---------------------------------------------------------------- hair
hb = Part("Hair_Base", [M_HAIR])
hb.sphere((0.0, 0.03, 1.49), (0.102, 0.105, 0.098), seg=20, rings=12)
hb.finish()

curls = Part("Hair_Curls", [M_HAIR])
HC = Vector((0.0, 0.02, 1.485))
HR = (0.10, 0.11, 0.10)
nr = 8
for i in range(nr):
    t = 2.05 * i / (nr - 1)
    cnt = max(1, int(round(15 * math.sin(t))))
    off = random.random() * math.pi
    for k in range(cnt):
        ph = off + 2.0 * math.pi * k / cnt
        d = Vector((math.sin(t) * math.sin(ph), math.sin(t) * math.cos(ph), math.cos(t)))
        if d.y < -0.25 and d.z < 0.6:
            continue  # face
        if abs(d.x) > 0.6 and d.z < 0.2 and d.y < 0.45:
            continue  # keep ears visible
        c = HC + Vector((d.x * HR[0], d.y * HR[1], d.z * HR[2]))
        hair_sphere(curls, c, random.uniform(0.034, 0.044))
curls.finish()

bangs = Part("Hair_Bangs", [M_HAIR])
for i in range(7):
    x = -0.072 + i * 0.024
    z = 1.524 - 0.01 * abs(x) / 0.072
    p, n = ell_front(SKULL_C, SKULL_R, x, z)
    q = face_quat(n) @ Quaternion(Vector((0.0, 1.0, 0.0)), 0.25 if i % 2 == 0 else -0.2)
    bangs.sphere(p + n * 0.01, (0.022, 0.016, 0.038), rot=q, seg=12, rings=8)
bangs.finish()

scr = Part("Hair_Scrunchie", [M_ORANGE])
scr.torus((0.0, 0.135, 1.54), (0.0, 0.89, 0.45), 0.028, 0.013, seg=16, sides=8)
scr.finish()

pony = Part("Hair_Ponytail", [M_HAIR])
pts = [(0.0, 0.165, 1.555), (0.0, 0.205, 1.562), (0.0, 0.245, 1.54), (0.0, 0.27, 1.495),
       (0.0, 0.28, 1.445), (0.0, 0.275, 1.395), (0.0, 0.26, 1.345), (0.0, 0.24, 1.30)]
for i, pt in enumerate(pts):
    r = 0.042 + (0.028 - 0.042) * i / (len(pts) - 1)
    c = Vector(pt)
    hair_sphere(pony, c, r)
    for k in range(3):
        v = Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1)))
        if v.length < 1e-3:
            v = Vector((1.0, 0.0, 0.0))
        v.normalize()
        hair_sphere(pony, c + v * r * 0.55, r * 0.75)
pony.finish()

# ---------------------------------------------------------------- crop top
crop = Part("Crop_Top", [M_BLACK])
crop.loft([
    ring(1.045, 0.118, 0.080),
    ring(1.08, 0.124, 0.084),
    ring(1.15, 0.139, 0.091),
    ring(1.22, 0.148, 0.088),
    ring(1.255, 0.12, 0.075),
    ring(1.275, 0.075, 0.055),
], segs=20)
for s in (1, -1):
    crop.sphere((0.055 * s, -0.055, 1.14), (0.055, 0.04, 0.05), seg=14, rings=8)
crop.finish()

# ---------------------------------------------------------------- jacket
jk = Part("Jacket", [M_CREAM])
jk.loft([
    ring(1.065, 0.137, 0.102),
    ring(1.10, 0.143, 0.106),
    ring(1.16, 0.153, 0.112),
    ring(1.22, 0.158, 0.11),
    ring(1.255, 0.13, 0.09),
    ring(1.28, 0.088, 0.072),
], segs=22, gap=0.6)
solidify(jk.finish(), 0.012)

jh = Part("Jacket_Hem", [M_BLACK])
jh.loft([ring(1.052, 0.141, 0.106), ring(1.08, 0.146, 0.110)], segs=22, gap=0.6)
solidify(jh.finish(), 0.012)

def cring(f, extra):
    zf = 1.262 + (1.30 - 1.262) * f
    zb = 1.262 + (1.365 - 1.262) * f
    rx = 0.092 + (0.074 - 0.092) * f + extra
    ry = 0.077 + (0.066 - 0.077) * f + extra
    cy = 0.006 * f
    return (zf, zb, rx, ry, cy)

col = Part("Jacket_Collar", [M_BLACK, M_ORANGE])
col.loft([cring(0.0, 0.0), cring(0.5, 0.0), cring(1.0, 0.0)], mi=0, segs=20, gap=0.38)
col.loft([cring(0.62, 0.004), cring(0.98, 0.004), cring(1.05, 0.0)], mi=1, segs=20, gap=0.38)
solidify(col.finish(), 0.008)

# ---------------------------------------------------------------- arms, sleeves, hands, gloves
for side, sfx in ((1, "L"), (-1, "R")):
    S = Vector((0.15 * side, 0.0, 1.22))
    a = math.radians(35.0)
    d = Vector((math.cos(a) * side, 0.0, -math.sin(a)))
    E = S + d * 0.25
    W = E + d * 0.22
    w = Vector((0.0, float(side), 0.0))
    n = d.cross(w)
    Rq = Matrix((tuple(d), tuple(w), tuple(n))).transposed().to_quaternion()
    qa = align(d)

    arm = Part("Arm_" + sfx, [M_SKIN])
    arm.sphere(S, (0.045, 0.045, 0.045), seg=12, rings=8)
    arm.cyl(S, E, 0.042, 0.034)
    arm.sphere(E, (0.035, 0.035, 0.035), seg=12, rings=8)
    arm.cyl(E, W, 0.033, 0.025)
    arm.finish()

    sl = Part("Sleeve_" + sfx, [M_CREAM, M_ORYEL, M_BLACK])
    sl.sphere(S, (0.06, 0.06, 0.06), mi=1, seg=14, rings=10)
    sl.cyl(S, S + d * 0.13, 0.062, 0.060, mi=1, seg=14)
    sl.cyl(S + d * 0.12, S + d * 0.20, 0.060, 0.064, mi=0, seg=14)
    sl.sphere(S + d * 0.215, (0.072, 0.072, 0.05), rot=qa, mi=0, seg=14, rings=10)
    sl.cyl(S + d * 0.235, S + d * 0.275, 0.046, 0.042, mi=2, seg=14)
    sl.finish()

    gl = Part("Glove_" + sfx, [M_BLACK, M_ORANGE])
    gl.cyl(W - d * 0.04, W + d * 0.015, 0.031, 0.030, mi=0)
    gl.sphere(W + d * 0.05, (0.05, 0.04, 0.016), rot=Rq, mi=0, seg=14, rings=8)
    gl.sphere(W + d * 0.09 + n * 0.011, (0.012, 0.036, 0.008), rot=Rq, mi=1, seg=12, rings=6)
    gl.finish()

    hd = Part("Hand_" + sfx, [M_SKIN])
    hd.sphere(W + d * 0.118, (0.042, 0.037, 0.013), rot=Rq, seg=14, rings=8)
    fwd = Vector((0.0, -1.0, 0.0))
    tb = W + d * 0.035 + fwd * 0.028 - n * 0.004
    tt = tb + d * 0.028 + fwd * 0.02 - n * 0.012
    hd.sphere(tb, (0.012, 0.012, 0.012), seg=10, rings=6)
    hd.cyl(tb, tt, 0.012, 0.0095, seg=10)
    hd.sphere(tt, (0.0095, 0.0095, 0.0095), seg=10, rings=6)
    hd.finish()

# ---------------------------------------------------------------- shorts / belt / straps
sh = Part("Shorts", [M_KHAKI, M_GREY])
sh.loft([
    ring(0.735, 0.09, 0.06, 0.005),
    ring(0.77, 0.155, 0.10, 0.005),
    ring(0.84, 0.165, 0.108, 0.005),
    ring(0.92, 0.145, 0.097),
    ring(0.975, 0.124, 0.086),
], mi=0, segs=20)
for s in (1, -1):
    ptop, _ = thigh_pt(s, 0.80)
    pbot, _ = thigh_pt(s, 0.665)
    sh.cyl(ptop, pbot, 0.09, 0.088, mi=0, seg=16)
    h1, _ = thigh_pt(s, 0.675)
    h2, _ = thigh_pt(s, 0.655)
    sh.cyl(h1, h2, 0.092, 0.092, mi=1, seg=16)
    pk, _ = thigh_pt(s, 0.73)
    sh.box(pk + Vector((0.086 * s, 0.0, 0.0)), (0.02, 0.07, 0.07), mi=0, bevel=0.006)
sh.finish()

belt = Part("Belt", [M_BELT, M_METAL])
belt.loft([ring(0.93, 0.147, 0.102), ring(0.975, 0.130, 0.092)], mi=0, segs=20)
belt.box((0.0, -0.098, 0.953), (0.04, 0.012, 0.03), mi=1, bevel=0.003)
belt.finish()

bs = Part("Belt_Straps_L", [M_ORANGE])
for (p1, p2) in (((0.13, -0.03, 0.965), (0.195, -0.035, 0.70)),
                 ((0.13, 0.025, 0.965), (0.19, 0.03, 0.74))):
    p1 = Vector(p1)
    p2 = Vector(p2)
    dd = p2 - p1
    bs.box((p1 + p2) * 0.5, (0.008, 0.026, dd.length), mi=0, rot=align(dd), bevel=0.002)
bs.finish()

# ---------------------------------------------------------------- crossbody bag
bag = Part("Bag", [M_BAG, M_ORANGE])
bag.box((-0.195, -0.02, 0.86), (0.07, 0.17, 0.13), mi=0, bevel=0.015)
bag.box((-0.232, -0.02, 0.89), (0.012, 0.172, 0.075), mi=0, bevel=0.004)
bag.box((-0.24, -0.02, 0.862), (0.012, 0.03, 0.026), mi=1, bevel=0.003)
bag.finish()

strap = Part("Bag_Strap", [M_BAG, M_ORANGE])
front = [(0.11, 0.0, 1.275), (0.092, -0.085, 1.225), (0.035, -0.10, 1.14),
         (-0.045, -0.098, 1.045), (-0.12, -0.098, 0.965), (-0.19, -0.09, 0.915)]
back = [(0.11, 0.0, 1.275), (0.09, 0.09, 1.22), (0.0, 0.116, 1.12),
        (-0.10, 0.108, 1.0), (-0.175, 0.075, 0.935), (-0.19, 0.045, 0.915)]
for path in (front, back):
    for i in range(len(path) - 1):
        strap.cyl(path[i], path[i + 1], 0.011, 0.011, mi=0, seg=8)
    for p in path:
        strap.sphere(p, (0.011, 0.011, 0.011), mi=0, seg=8, rings=6)
off = Vector((0.0, -0.009, 0.0))
for i in range(1, 4):
    strap.cyl(Vector(front[i]) + off, Vector(front[i + 1]) + off, 0.0055, 0.0055, mi=1, seg=8)
    strap.sphere(Vector(front[i + 1]) + off, (0.0055, 0.0055, 0.0055), mi=1, seg=8, rings=6)
strap.sphere(Vector(front[1]) + off, (0.0055, 0.0055, 0.0055), mi=1, seg=8, rings=6)
strap.finish()

# ---------------------------------------------------------------- legs (leggings) + sheer panel
for side, sfx in ((1, "L"), (-1, "R")):
    H = Vector((0.09 * side, 0.0, 0.78))
    K = Vector((0.10 * side, -0.005, 0.445))
    A = Vector((0.12 * side, 0.0, 0.09))
    leg = Part("Leg_" + sfx, [M_LEGG])
    leg.sphere(H, (0.074, 0.074, 0.074), seg=14, rings=8)
    leg.cyl(H, K, 0.074, 0.048, seg=16)
    leg.sphere(K, (0.049, 0.049, 0.049), seg=14, rings=8)
    leg.cyl(K, A, 0.048, 0.031, seg=16)
    leg.sphere(K.lerp(A, 0.3) + Vector((0.0, 0.008, 0.0)), (0.05, 0.052, 0.09), rot=align(A - K), seg=14, rings=8)
    leg.sphere(A, (0.032, 0.032, 0.032), seg=12, rings=8)
    leg.finish()

    pan = Part("Leggings_Panel_" + sfx, [M_SHEER])
    pm, rm = thigh_pt(side, 0.575)
    pa, _ = thigh_pt(side, 0.67)
    pb, _ = thigh_pt(side, 0.48)
    pan.sphere(pm + Vector((side * (rm - 0.002), 0.0, 0.0)), (0.008, 0.028, 0.10),
               rot=align(pa - pb), seg=12, rings=8)
    pan.finish()

    # ------------------------------------------------------------ sneakers
    fx = 0.12 * side
    sn = Part("Sneaker_" + sfx, [M_SNEAK, M_BLACK, M_ORANGE])
    sn.box((fx, -0.055, 0.024), (0.105, 0.275, 0.048), mi=0, bevel=0.012)
    sn.box((fx, -0.055, 0.036), (0.109, 0.279, 0.012), mi=1)
    sn.sphere((fx, -0.105, 0.06), (0.05, 0.09, 0.045), mi=0, seg=16, rings=10)
    sn.sphere((fx, 0.02, 0.07), (0.052, 0.06, 0.05), mi=0, seg=14, rings=8)
    sn.cyl((fx, 0.005, 0.03), (fx, 0.005, 0.17), 0.056, 0.05, mi=0, seg=16)
    sn.cyl((fx, 0.005, 0.10), (fx, 0.005, 0.115), 0.0555, 0.0555, mi=2, seg=16)
    sn.cyl((fx, 0.005, 0.155), (fx, 0.005, 0.18), 0.054, 0.05, mi=1, seg=16)
    sn.sphere((fx, -0.06, 0.105), (0.025, 0.06, 0.015),
              rot=Quaternion(Vector((1.0, 0.0, 0.0)), math.radians(-25.0)), mi=1, seg=12, rings=8)
    sn.box((fx, 0.06, 0.13), (0.03, 0.012, 0.07), mi=2, bevel=0.003)
    sn.finish()

bpy.ops.object.select_all(action='DESELECT')
ROOT.select_set(True)
bpy.context.view_layer.objects.active = ROOT
