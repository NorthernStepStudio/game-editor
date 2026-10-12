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

    assignment = {}
    for obj in parts:
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
