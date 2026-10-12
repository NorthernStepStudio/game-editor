/**
 * Blender script that rigs a mini character with a reference skeleton (the Kenney mini rig:
 * root, torso, head, arm-left/right, leg-left/right) and its animation clips.
 *
 * Config (JSON file passed after `--`):
 *   mode: "detect" — centre the character, find its joints, render an orthographic front view
 *                    and report the joints plus how image pixels map to metres.
 *   mode: "rig"    — the above, then build the rig (joints may be overridden), export a GLB with
 *                    the skeleton, the skinned character and every clip, and render preview frames.
 *   character, reference, outDir, baseName, joints?, clips?, frames?
 *
 * Joints only ever move (never rotate), so every reference animation plays the same on the new character.
 */
export const MINI_RIG_SCRIPT = String.raw`
import json
import math
import sys
import traceback

import bpy
from mathutils import Matrix, Vector

CFG = json.load(open(sys.argv[sys.argv.index("--") + 1], "r", encoding="utf-8"))
OUT = CFG["outDir"]
BASE = CFG.get("baseName", "character")
REPORT = {"ok": False, "stage": "start", "mode": CFG["mode"]}

HEAD_PARTS = ("head", "hair", "face", "eye", "brow", "mouth", "cheek", "ear", "scrunchie", "hat", "cap", "glasses", "nose", "beard", "mustache", "helmet", "bandana")
ARM_PARTS = ("arm", "hand", "glove", "sleeve", "cuff", "wrist", "bracelet", "watch")
LEG_PARTS = ("leg", "shoe", "sneaker", "boot", "sock", "foot", "knee", "sandal")
JOINT_NAMES = ("head", "arm-left", "arm-right", "leg-left", "leg-right")


def finish(ok=True):
    REPORT["ok"] = ok
    with open(OUT + "/" + BASE + "-rig-report.json", "w", encoding="utf-8") as handle:
        json.dump(REPORT, handle, indent=2)
    sys.exit(0 if ok else 1)


def bounds(objs):
    pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    return Vector(map(min, *pts)), Vector(map(max, *pts))


def side_of(name):
    n = name.lower()
    if n.endswith(("_l", ".l", "-l", "left")) or "_l_" in n or "_l." in n or "left_" in n:
        return "left"
    if n.endswith(("_r", ".r", "-r", "right")) or "_r_" in n or "_r." in n or "right_" in n:
        return "right"
    return None


def has(name, words):
    n = name.lower()
    return any(w in n for w in words)


try:
    # ---------------------------------------------------------- reference skeleton and clips
    REPORT["stage"] = "reference"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=CFG["reference"])
    armature = next(o for o in scene.objects if o.type == "ARMATURE")
    for obj in [o for o in scene.objects if o.type != "ARMATURE"]:
        bpy.data.objects.remove(obj, do_unlink=True)
    clips = sorted(a.name for a in bpy.data.actions)
    ref = {b.name: (armature.matrix_world @ b.head_local) for b in armature.data.bones}
    missing = [n for n in ("root", "torso") + JOINT_NAMES if n not in ref]
    if missing:
        raise RuntimeError("The reference skeleton is missing bones: " + ", ".join(missing))

    # ---------------------------------------------------------- character, centred on the skeleton
    REPORT["stage"] = "character"
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=CFG["character"])
    added = [o for o in bpy.data.objects if o not in before]
    parts = [o for o in added if o.type == "MESH" and not o.name.startswith("Icosphere")]
    if not parts:
        raise RuntimeError("The model has no mesh parts to rig.")
    if any(o.type == "ARMATURE" for o in added):
        raise RuntimeError("This model already has a skeleton.")
    bpy.context.view_layer.update()
    for obj in parts:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world
    for obj in [o for o in added if o.type != "MESH"]:
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()
    for obj in parts:
        obj.data.transform(obj.matrix_world)
        obj.matrix_world.identity()
        for modifier in list(obj.modifiers):
            obj.modifiers.remove(modifier)

    torso_parts = [o for o in parts if has(o.name, ("torso", "body", "chest"))] or parts
    lo_t, hi_t = bounds(torso_parts)
    lo_all, hi_all = bounds(parts)
    shift = Vector((-(lo_all.x + hi_all.x) / 2, ref["torso"].y - (lo_t.y + hi_t.y) / 2, -lo_all.z))
    for obj in parts:
        obj.data.transform(Matrix.Translation(shift))
    bpy.context.view_layer.update()
    lo_all, hi_all = bounds(parts)
    REPORT["centeringShift"] = [round(c, 4) for c in shift]
    REPORT["height"] = round(hi_all.z - lo_all.z, 4)

    # ---------------------------------------------------------- joints found from the parts
    def group_bounds(test):
        found = [o for o in parts if test(o.name)]
        return bounds(found) if found else None

    arm_l = group_bounds(lambda n: has(n, ARM_PARTS) and side_of(n) == "left")
    arm_r = group_bounds(lambda n: has(n, ARM_PARTS) and side_of(n) == "right")
    leg_l = group_bounds(lambda n: has(n, LEG_PARTS) and side_of(n) == "left")
    leg_r = group_bounds(lambda n: has(n, LEG_PARTS) and side_of(n) == "right")
    head = group_bounds(lambda n: n.lower().startswith("head"))
    scale_z = (hi_all.z - lo_all.z) / max(ref["head"].z + 0.33, 0.001)
    joints = {
        "arm-left": [arm_l[0].x, (arm_l[0].z + arm_l[1].z) / 2] if arm_l else [ref["arm-left"].x, ref["arm-left"].z * scale_z],
        "arm-right": [arm_r[1].x, (arm_r[0].z + arm_r[1].z) / 2] if arm_r else [ref["arm-right"].x, ref["arm-right"].z * scale_z],
        "leg-left": [(leg_l[0].x + leg_l[1].x) / 2, ref["leg-left"].z * scale_z] if leg_l else [ref["leg-left"].x, ref["leg-left"].z * scale_z],
        "leg-right": [(leg_r[0].x + leg_r[1].x) / 2, ref["leg-right"].z * scale_z] if leg_r else [ref["leg-right"].x, ref["leg-right"].z * scale_z],
        "head": [0.0, head[0].z] if head else [0.0, ref["head"].z * scale_z],
    }
    # One-piece models (e.g. image-to-3D) have no named parts: find the joints from the shape instead.
    SHAPE_MODE = len(parts) == 1 or not (arm_l or arm_r or head)
    REPORT["mode"] = "shape" if SHAPE_MODE else "parts"
    shape = {}
    if SHAPE_MODE:
        # The front silhouette, cast with rays: simplified image-to-3D meshes have big flat triangles with few
        # vertices, so reading vertices alone sees gaps in the chest and misses the torso's real width.
        from mathutils.bvhtree import BVHTree
        verts, polys = [], []
        for o in parts:
            offset = len(verts)
            verts += [o.matrix_world @ v.co for v in o.data.vertices]
            polys += [[offset + i for i in p.vertices] for p in o.data.polygons]
        tree = BVHTree.FromPolygons(verts, polys)
        z0, z1 = lo_all.z, hi_all.z
        height = z1 - z0
        bins = 160
        zb = lambda b: z0 + (b + 0.5) * height / bins
        xstep = height / 320
        ncols = int((hi_all.x - lo_all.x) / xstep) + 1
        xc = lambda c: lo_all.x + (c + 0.5) * xstep
        sil = [[tree.ray_cast(Vector((xc(c), lo_all.y - 1, zb(b))), Vector((0, 1, 0)), 10)[0] is not None for c in range(ncols)] for b in range(bins)]
        centre = min(range(ncols), key=lambda c: abs(xc(c)))
        # arms reach out on both sides; a ponytail or a bag sticks out on one, so a row is as wide as its shorter side
        half = [min(max([xc(c) for c in range(ncols) if sil[b][c]] or [0.0]), max([-xc(c) for c in range(ncols) if sil[b][c]] or [0.0])) for b in range(bins)]
        filled = lambda b: any(sil[b][c] for c in (centre - 1, centre, centre + 1) if 0 <= c < ncols)
        # arms: the widest band in the lower 75 % (T-pose); hair can be wide but sits higher
        low = range(int(bins * 0.2), int(bins * 0.75))
        peak = max(low, key=lambda b: half[b])
        widest = half[peak]
        band_bins = max(2, int(bins * 0.065))
        arm_bot, arm_top = max(0, peak - band_bins), min(bins - 1, peak + band_bins)
        arm_z = (zb(arm_bot) + zb(arm_top)) / 2

        def central_run(b):
            """Half-width of the solid run around the centre line in row b (the torso, not arms beside it)."""
            if not sil[b][centre]:
                return None
            left = right = centre
            while left > 0 and sil[b][left - 1]:
                left -= 1
            while right < ncols - 1 and sil[b][right + 1]:
                right += 1
            return (xc(right) - xc(left)) / 2

        # shoulders: the torso's width under the arms (a low quartile, so a drooping arm that touches the side
        # in a few rows does not count as torso)
        runs = sorted(r for r in (central_run(b) for b in range(max(0, arm_bot - int(bins * 0.08)), arm_bot)) if r)
        shoulder_x = runs[len(runs) // 4] if runs else widest * 0.4
        shoulder_x = min(shoulder_x, widest * 0.6)
        # hips: going down from the arms, the legs separate where the centre line stays empty
        crotch = next((b + 1 for b in range(arm_bot, 2, -1) if not filled(b) and not filled(b - 1) and not filled(b - 2)), int(bins * 0.17))
        hip_z = zb(crotch) + 0.04 * height
        legs = {}
        for side in (1, -1):
            xs = [xc(c) for b in range(bins) if zb(crotch) - 0.06 * height < zb(b) < zb(crotch) - 0.01 * height
                  for c in range(ncols) if sil[b][c] and xc(c) * side > xstep]
            legs[side] = sum(xs) / len(xs) if xs else side * shoulder_x * 0.5
        # how wide each leg is (thigh to shoe): clothing or hair that hangs below the hips outside it stays with the body
        leg_reach = {}
        for side in (1, -1):
            lc = min(range(ncols), key=lambda c: abs(xc(c) - legs[side]))
            reach = 0.0
            for b in range(int(bins * 0.03), max(int(bins * 0.03) + 1, crotch)):
                if not sil[b][lc]:
                    continue
                left = right = lc
                while left > 0 and sil[b][left - 1] and xc(left - 1) * side > 0:
                    left -= 1
                while right < ncols - 1 and sil[b][right + 1] and xc(right + 1) * side > 0:
                    right += 1
                reach = max(reach, abs(xc(left) - legs[side]), abs(xc(right) - legs[side]))
            leg_reach[side] = min(max(reach, 0.03 * height), 0.12 * height)
        neck_z = zb(arm_top) + 0.02 * height
        joints = {
            "arm-left": [shoulder_x, arm_z],
            "arm-right": [-shoulder_x, arm_z],
            "leg-left": [legs[1], hip_z],
            "leg-right": [legs[-1], hip_z],
            "head": [0.0, neck_z],
        }
        shape = {"armBand": [round(zb(arm_bot), 4), round(zb(arm_top), 4)], "shoulderX": round(shoulder_x, 4), "crotchZ": round(zb(crotch), 4),
                 "legReach": [round(leg_reach[1], 4), round(leg_reach[-1], 4)]}
        REPORT["shape"] = shape
    REPORT["detectedJoints"] = {k: [round(c, 4) for c in v] for k, v in joints.items()}
    for name, value in (CFG.get("joints") or {}).items():
        if name in joints and isinstance(value, list) and len(value) == 2:
            joints[name] = [float(value[0]), float(value[1])]
    REPORT["joints"] = {k: [round(c, 4) for c in v] for k, v in joints.items()}
    REPORT["clips"] = clips

    # ---------------------------------------------------------- render setup (front view / previews)
    engines = [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    scene.render.engine = next((e for e in engines if "EEVEE" in e), "BLENDER_WORKBENCH")
    if hasattr(scene, "eevee") and hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = 8
    scene.render.film_transparent = True
    world = bpy.data.worlds.new("RigWorld")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.52, 0.56, 1)
    scene.world = world
    sun = bpy.data.objects.new("RigSun", bpy.data.lights.new("RigSun", "SUN"))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(45), math.radians(8), math.radians(-25))
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("RigCam", bpy.data.cameras.new("RigCam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.type = "ORTHO"
    size = max(hi_all.x - lo_all.x, hi_all.z - lo_all.z) * 1.15
    center_z = (lo_all.z + hi_all.z) / 2

    if CFG["mode"] == "detect":
        REPORT["stage"] = "front"
        armature.hide_render = True
        cam.data.ortho_scale = size
        cam.location = Vector((0, -4, center_z))
        cam.rotation_euler = (math.radians(90), 0, 0)
        scene.render.resolution_x = 640
        scene.render.resolution_y = 640
        scene.render.filepath = OUT + "/" + BASE + "-front.png"
        bpy.ops.render.render(write_still=True)
        # Image pixel (px, py) maps to x = centerX + (px / size - 0.5) * orthoScale, z = centerZ + (0.5 - py / size) * orthoScale.
        REPORT["frame"] = {"image": BASE + "-front.png", "pixels": 640, "orthoScale": round(size, 5), "centerX": 0.0, "centerZ": round(center_z, 5)}
        REPORT["stage"] = "done"
        finish(True)

    # ---------------------------------------------------------- rig
    REPORT["stage"] = "rig"
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    inverse = armature.matrix_world.inverted()
    for name, (jx, jz) in joints.items():
        bone = armature.data.edit_bones[name]
        target = inverse @ Vector((jx, ref[name].y, jz))
        delta = target - bone.head
        bone.head += delta
        bone.tail += delta
    bpy.ops.object.mode_set(mode="OBJECT")
    hip_z = (joints["leg-left"][1] + joints["leg-right"][1]) / 2

    def bone_for_part(name):
        side = side_of(name)
        if has(name, HEAD_PARTS):
            return "head"
        if has(name, ARM_PARTS) and side:
            return "arm-" + side
        if has(name, LEG_PARTS) and side:
            return "leg-" + side
        return None

    def splits_at_hips(obj):
        lo, hi = bounds([obj])
        return lo.x < -0.02 and hi.x > 0.02 and lo.z < hip_z - 0.01

    def smooth(a, b, x):
        t = min(1.0, max(0.0, (x - a) / max(b - a, 1e-6)))
        return t * t * (3 - 2 * t)

    def shape_weights(p):
        """Soft weights by position for one-piece models: head above the neck, arms beyond the shoulders,
        legs below the hips, torso elsewhere; joints blend over a few centimetres so nothing tears."""
        neck = joints["head"][1]
        sx = (joints["arm-left"][0] - joints["arm-right"][0]) / 2
        hip = hip_z
        # the arm band follows the arm joint, so a hand-placed shoulder moves the weights too
        arm_mid = (joints["arm-left"][1] + joints["arm-right"][1]) / 2
        half_band = (shape["armBand"][1] - shape["armBand"][0]) / 2
        band_lo, band_hi = arm_mid - half_band, arm_mid + half_band
        w = {"head": smooth(neck - 0.012, neck + 0.02, p.z)}
        rest = 1.0 - w["head"]
        in_band = smooth(band_lo - 0.05, band_lo - 0.01, p.z) * (1 - smooth(band_hi + 0.01, band_hi + 0.05, p.z))
        arm = smooth(sx - 0.005, sx + 0.035, abs(p.x)) * in_band * rest
        w["arm-left" if p.x > 0 else "arm-right"] = arm
        rest -= arm
        side_name = "leg-left" if p.x > 0 else "leg-right"
        reach = shape["legReach"][0 if p.x > 0 else 1]
        inside = 1 - smooth(reach, reach + 0.025, abs(p.x - joints[side_name][0]))
        leg = (1 - smooth(hip - 0.035, hip + 0.01, p.z)) * inside * rest
        # between the legs (a hanging strap, the crotch of shorts) follow both legs equally, shifting to one leg
        # only toward it: legs swing opposite ways, so the middle stays put instead of stretching into a spike
        lean = smooth(0.0, 0.6 * abs(joints[side_name][0]), abs(p.x))
        other = "leg-right" if side_name == "leg-left" else "leg-left"
        w[side_name] = leg * (0.5 + 0.5 * lean)
        w[other] = leg * (0.5 - 0.5 * lean)
        rest -= leg
        w["torso"] = max(0.0, rest)
        return w

    assignment = {}
    if SHAPE_MODE:
        for obj in parts:
            groups = {b.name: obj.vertex_groups.new(name=b.name) for b in armature.data.bones}
            used = {}
            for v in obj.data.vertices:
                for bone, weight in shape_weights(v.co).items():
                    if weight > 0.001:
                        groups[bone].add([v.index], weight, "REPLACE")
                        used[bone] = used.get(bone, 0) + 1
            assignment[obj.name] = used
            modifier = obj.modifiers.new("Armature", "ARMATURE")
            modifier.object = armature
            obj.parent = armature
    for obj in ([] if SHAPE_MODE else parts):
        groups = {b.name: obj.vertex_groups.new(name=b.name) for b in armature.data.bones}
        fixed = bone_for_part(obj.name)
        split = not fixed and splits_at_hips(obj)
        used = {}
        for v in obj.data.vertices:
            bone = fixed or (("leg-left" if v.co.x >= 0 else "leg-right") if split and v.co.z < hip_z else "torso")
            groups[bone].add([v.index], 1.0, "REPLACE")
            used[bone] = used.get(bone, 0) + 1
        assignment[obj.name] = fixed or used
        modifier = obj.modifiers.new("Armature", "ARMATURE")
        modifier.object = armature
        obj.parent = armature
    REPORT["assignment"] = assignment

    REPORT["stage"] = "export"
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    for obj in parts:
        obj.select_set(True)
    glb = OUT + "/" + BASE + ".glb"
    bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_skins=True,
                              export_animations=True, export_animation_mode="ACTIONS")
    REPORT["glb"] = glb
    blend = OUT + "/" + BASE + ".blend"
    bpy.ops.wm.save_as_mainfile(filepath=blend, copy=True)
    REPORT["blend"] = blend

    # ---------------------------------------------------------- preview frames of the clips
    REPORT["stage"] = "preview"
    cam.data.ortho_scale = size * 1.25
    focus = Vector((0, 0, center_z))
    a = math.radians(30)
    cam.location = focus + Vector((math.sin(a), -math.cos(a), 0.25)) * 4
    cam.rotation_euler = (focus - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.resolution_x = 320
    scene.render.resolution_y = 320
    armature.animation_data_create()
    wanted = [c for c in CFG.get("clips", ["idle", "walk", "sprint", "jump"]) if c in clips]
    frames = int(CFG.get("frames", 12))
    previews = {}
    for clip in wanted:
        action = bpy.data.actions[clip]
        armature.animation_data.action = action
        if hasattr(armature.animation_data, "action_slot") and getattr(action, "slots", None):
            armature.animation_data.action_slot = action.slots[0]
        start, end = action.frame_range
        previews[clip] = []
        for i in range(frames):
            frame = start + (end - start) * i / frames
            scene.frame_set(int(frame), subframe=frame - int(frame))
            scene.render.filepath = OUT + "/anim_%s_%02d.png" % (clip, i)
            bpy.ops.render.render(write_still=True)
            previews[clip].append(scene.render.filepath)
    REPORT["previews"] = previews
    REPORT["stage"] = "done"
    finish(True)
except SystemExit:
    raise
except Exception:
    REPORT["error"] = traceback.format_exc(limit=6)
    finish(False)
`;
