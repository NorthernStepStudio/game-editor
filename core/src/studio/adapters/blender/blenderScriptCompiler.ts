/**
 * Compiles validated BlenderOperation lists into controlled Python.
 * User-supplied Python is never accepted as the normal public interface.
 */

import { join } from "node:path";
import type { BlenderOperation } from "./blenderOperations.js";
import type { BlenderTaskSpec } from "./blenderTaskSpec.js";

function pyStr(value: string): string {
  return JSON.stringify(value);
}

function pyTuple(values: readonly number[]): string {
  return `(${values.map((v) => Number(v)).join(", ")})`;
}

function compileOperation(op: BlenderOperation, index: number): string {
  switch (op.op) {
    case "scene.new":
      return `
# op[${index}] scene.new
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = ${pyStr(op.sceneName ?? "MatterhornScene")}
completed.append("scene.new")
`;
    case "scene.inspect":
      return `
# op[${index}] scene.inspect
completed.append("scene.inspect")
`;
    case "world.set_background":
      return `
# op[${index}] world.set_background
if bpy.context.scene.world is None:
    bpy.context.scene.world = bpy.data.worlds.new('Matterhorn_Environment_Preview')
world = bpy.context.scene.world
world.use_nodes = True
background = world.node_tree.nodes.get('Background')
background.inputs['Color'].default_value = ${pyTuple(op.color)}
background.inputs['Strength'].default_value = ${op.strength ?? 0.65}
completed.append("world.set_background")
`;
    case "mesh.create_primitive": {
      const loc = op.location ?? [0, 0, 0];
      const size = op.size ?? 1;
      const radius = op.radius ?? 0.5;
      const depth = op.depth ?? 1;
      let create = "";
      switch (op.primitive) {
        case "cube":
          create = `bpy.ops.mesh.primitive_cube_add(size=${size}, location=${pyTuple(loc)})`;
          break;
        case "uv_sphere":
          create = `bpy.ops.mesh.primitive_uv_sphere_add(radius=${radius}, location=${pyTuple(loc)})`;
          break;
        case "cylinder":
          create = `bpy.ops.mesh.primitive_cylinder_add(radius=${radius}, depth=${depth}, location=${pyTuple(loc)})`;
          break;
        case "cone":
          create = `bpy.ops.mesh.primitive_cone_add(radius1=${radius}, depth=${depth}, location=${pyTuple(loc)})`;
          break;
        case "plane":
          create = `bpy.ops.mesh.primitive_plane_add(size=${size}, location=${pyTuple(loc)})`;
          break;
      }
      return `
# op[${index}] mesh.create_primitive
${create}
obj = bpy.context.active_object
obj.name = ${pyStr(op.name)}
${op.scale ? `obj.scale = ${pyTuple(op.scale)}` : ""}
objects[${pyStr(op.name)}] = obj
completed.append("mesh.create_primitive:${op.name}")
`;
    }
    case "mesh.create_tapered_segment": {
      return `
# op[${index}] mesh.create_tapered_segment
start = Vector(${pyTuple(op.start)})
end = Vector(${pyTuple(op.end)})
delta = end - start
length = delta.length
if length <= 0.000001:
    raise RuntimeError("mesh.create_tapered_segment start/end are coincident")
mid = (start + end) * 0.5
bpy.ops.mesh.primitive_cone_add(
    vertices=${op.sides ?? 10},
    radius1=${op.radiusStart},
    radius2=${op.radiusEnd},
    depth=length,
    location=mid,
)
obj = bpy.context.active_object
obj.name = ${pyStr(op.name)}
obj.rotation_mode = "QUATERNION"
obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
objects[${pyStr(op.name)}] = obj
completed.append("mesh.create_tapered_segment:${op.name}")
`;
    }
    case "mesh.create_tapered_box": {
      return `
# op[${index}] mesh.create_tapered_box
top_w, top_d = ${pyTuple(op.topSize)}
bottom_w, bottom_d = ${pyTuple(op.bottomSize)}
half_h = ${op.height} * 0.5
verts = [
    (-bottom_w * 0.5, -bottom_d * 0.5, -half_h),
    ( bottom_w * 0.5, -bottom_d * 0.5, -half_h),
    ( bottom_w * 0.5,  bottom_d * 0.5, -half_h),
    (-bottom_w * 0.5,  bottom_d * 0.5, -half_h),
    (-top_w * 0.5, -top_d * 0.5, half_h),
    ( top_w * 0.5, -top_d * 0.5, half_h),
    ( top_w * 0.5,  top_d * 0.5, half_h),
    (-top_w * 0.5,  top_d * 0.5, half_h),
]
faces = [
    (0, 1, 2, 3),
    (4, 7, 6, 5),
    (0, 4, 5, 1),
    (1, 5, 6, 2),
    (2, 6, 7, 3),
    (4, 0, 3, 7),
]
mesh_data = bpy.data.meshes.new(${pyStr(op.name + "_mesh")})
mesh_data.from_pydata(verts, [], faces)
mesh_data.update()
obj = bpy.data.objects.new(${pyStr(op.name)}, mesh_data)
bpy.context.collection.objects.link(obj)
obj.location = ${pyTuple(op.location)}
${op.rotationEulerDeg ? `obj.rotation_euler = tuple(math.radians(v) for v in ${pyTuple(op.rotationEulerDeg)})` : ""}
objects[${pyStr(op.name)}] = obj
completed.append("mesh.create_tapered_box:${op.name}")
`;
    }
    case "mesh.join": {
      return `
# op[${index}] mesh.join
source_names = ${JSON.stringify(op.sources)}
source_objects = []
for source_name in source_names:
    source_obj = objects.get(source_name) or bpy.data.objects.get(source_name)
    if source_obj is None or source_obj.type != "MESH":
        raise RuntimeError("mesh.join missing mesh " + source_name)
    source_objects.append(source_obj)
bpy.ops.object.select_all(action="DESELECT")
for source_obj in source_objects:
    source_obj.select_set(True)
bpy.context.view_layer.objects.active = source_objects[0]
bpy.ops.object.join()
obj = bpy.context.active_object
obj.name = ${pyStr(op.name)}
for source_name in source_names:
    objects.pop(source_name, None)
objects[${pyStr(op.name)}] = obj
completed.append("mesh.join:${op.name}")
`;
    }
    case "mesh.smooth":
      return `
# op[${index}] mesh.smooth
obj = objects.get(${pyStr(op.target)}) or bpy.data.objects.get(${pyStr(op.target)})
if obj is None or obj.type != "MESH":
    raise RuntimeError("mesh.smooth missing mesh ${op.target}")
for poly in obj.data.polygons:
    poly.use_smooth = ${op.enabled === false ? "False" : "True"}
completed.append("mesh.smooth:${op.target}")
`;
    case "mesh.transform":
      return `
# op[${index}] mesh.transform
obj = objects.get(${pyStr(op.target)}) or bpy.data.objects.get(${pyStr(op.target)})
if obj is None:
    raise RuntimeError("mesh.transform missing target ${op.target}")
${op.location ? `obj.location = ${pyTuple(op.location)}` : ""}
${op.rotationEulerDeg ? `obj.rotation_euler = tuple(math.radians(v) for v in ${pyTuple(op.rotationEulerDeg)})` : ""}
${op.scale ? `obj.scale = ${pyTuple(op.scale)}` : ""}
${op.apply ? `bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)` : ""}
completed.append("mesh.transform:${op.target}")
`;
    case "mesh.bevel":
      return `
# op[${index}] mesh.bevel
obj = objects.get(${pyStr(op.target)}) or bpy.data.objects.get(${pyStr(op.target)})
if obj is None or obj.type != "MESH":
    raise RuntimeError("mesh.bevel missing mesh ${op.target}")
mod = obj.modifiers.new(name="Bevel", type="BEVEL")
mod.width = ${op.width ?? 0.03}
mod.segments = ${op.segments ?? 2}
completed.append("mesh.bevel:${op.target}")
`;
    case "material.create":
      return `
# op[${index}] material.create
mat = bpy.data.materials.new(name=${pyStr(op.name)})
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
if bsdf:
    ${op.baseColor ? `bsdf.inputs["Base Color"].default_value = ${pyTuple(op.baseColor)}` : ""}
    ${op.metallic !== undefined ? `bsdf.inputs["Metallic"].default_value = ${op.metallic}` : ""}
    ${op.roughness !== undefined ? `bsdf.inputs["Roughness"].default_value = ${op.roughness}` : ""}
materials[${pyStr(op.name)}] = mat
completed.append("material.create:${op.name}")
`;
    case "material.assign":
      return `
# op[${index}] material.assign
obj = objects.get(${pyStr(op.target)}) or bpy.data.objects.get(${pyStr(op.target)})
mat = materials.get(${pyStr(op.material)}) or bpy.data.materials.get(${pyStr(op.material)})
if obj is None or mat is None:
    raise RuntimeError("material.assign missing target/material")
if obj.data.materials:
    obj.data.materials[0] = mat
else:
    obj.data.materials.append(mat)
completed.append("material.assign:${op.target}")
`;
    case "camera.create":
      return `
# op[${index}] camera.create
bpy.ops.object.camera_add(location=${pyTuple(op.location ?? [3.2, -3.2, 2.6])})
cam = bpy.context.active_object
cam.name = ${pyStr(op.name ?? "Camera_Main")}
${op.rotationEulerDeg ? `cam.rotation_euler = tuple(math.radians(v) for v in ${pyTuple(op.rotationEulerDeg)})` : "cam.rotation_euler = (math.radians(60), 0, math.radians(45))"}
${op.setActive !== false ? "bpy.context.scene.camera = cam" : ""}
objects[cam.name] = cam
completed.append("camera.create")
`;
    case "light.create":
      return `
# op[${index}] light.create
bpy.ops.object.light_add(type=${pyStr(op.type ?? "SUN")}, location=${pyTuple(op.location ?? [4, -4, 6])})
light = bpy.context.active_object
light.name = ${pyStr(op.name ?? "Light_Key")}
light.data.energy = ${op.energy ?? 3.5}
${op.rotationEulerDeg ? `light.rotation_euler = tuple(math.radians(v) for v in ${pyTuple(op.rotationEulerDeg)})` : ""}
objects[light.name] = light
completed.append("light.create")
`;
    case "render.preview":
      return `
# op[${index}] render.preview
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT" if hasattr(bpy.types, "BLENDER_EEVEE_NEXT") else "BLENDER_EEVEE"
scene.render.resolution_x = ${op.width ?? 800}
scene.render.resolution_y = ${op.height ?? 800}
out_path = os.path.join(WORK_DIR, ${pyStr(op.outputName)})
assert_under_work(out_path)
scene.render.filepath = out_path
bpy.ops.render.render(write_still=True)
artifacts[${pyStr(op.outputName)}] = out_path
previews.append(out_path)
completed.append("render.preview:${op.outputName}")
`;
    case "render.multi_view": {
      const views = op.views ?? ["front", "side", "three_quarter"];
      const targetedOffsets: Record<string, readonly [number, number, number]> = {
        overview: [34, 46, 39], left: [6, 13, 10], right: [-6, 13, 10],
        yun_side: [0, 22, 11], turn_side: [0, -22, 11], gameplay: [30, 42, 33],
      };
      const targetedCenters: Record<string, readonly [number, number, number]> = {
        left: [2.4, -10, 1.5], right: [26.4, -10, 1.5],
        yun_side: [14.4, -4.8, 1.8], turn_side: [14.4, -15.2, 1.8],
      };
      const viewBlocks = views
        .map((view) => {
          if (op.target && targetedOffsets[view]) {
            const offset = targetedOffsets[view];
            const center = targetedCenters[view] ?? op.target;
            const loc = `(${center[0] + offset[0]}, ${center[1] + offset[1]}, ${center[2] + offset[2]})`;
            const file = `${op.outputPrefix}-${view}.png`;
            return `
cam.location = ${loc}
cam.data.lens = ${view === "yun_side" || view === "turn_side" ? 24 : 50}
cam.rotation_euler = (Vector(${pyTuple(center)}) - cam.location).to_track_quat('-Z', 'Y').to_euler()
out_path = os.path.join(WORK_DIR, ${pyStr(file)})
assert_under_work(out_path)
scene.render.filepath = out_path
bpy.ops.render.render(write_still=True)
artifacts[${pyStr(file)}] = out_path
previews.append(out_path)
`;
          }
          const loc =
            view === "front"
              ? "(0, -4.5, 1.6)"
              : view === "side"
                ? "(4.5, 0, 1.6)"
                : view === "back"
                  ? "(0, 4.5, 1.6)"
                  : view === "top"
                    ? "(0, 0, 5.5)"
                    : "(3.2, -3.2, 2.6)";
          const rot =
            view === "front"
              ? "(math.radians(80), 0, 0)"
              : view === "side"
                ? "(math.radians(80), 0, math.radians(90))"
                : view === "back"
                  ? "(math.radians(80), 0, math.radians(180))"
                  : view === "top"
                    ? "(0, 0, 0)"
                    : "(math.radians(60), 0, math.radians(45))";
          const file =
            view === "three_quarter"
              ? `${op.outputPrefix}-three-quarter.png`
              : `${op.outputPrefix}-${view}.png`;
          return `
cam.location = ${loc}
cam.rotation_euler = ${rot}
out_path = os.path.join(WORK_DIR, ${pyStr(file)})
assert_under_work(out_path)
scene.render.filepath = out_path
bpy.ops.render.render(write_still=True)
artifacts[${pyStr(file)}] = out_path
previews.append(out_path)
`;
        })
        .join("\n");
      return `
# op[${index}] render.multi_view
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT" if hasattr(bpy.types, "BLENDER_EEVEE_NEXT") else "BLENDER_EEVEE"
scene.render.resolution_x = ${op.width ?? 640}
scene.render.resolution_y = ${op.height ?? 640}
cam = scene.camera
if cam is None:
    bpy.ops.object.camera_add()
    cam = bpy.context.active_object
    scene.camera = cam
${viewBlocks}
completed.append("render.multi_view")
`;
    }
    case "file.save_blend":
      return `
# op[${index}] file.save_blend
out_path = os.path.join(WORK_DIR, ${pyStr(op.outputName)})
assert_under_work(out_path)
bpy.ops.wm.save_as_mainfile(filepath=out_path)
artifacts[${pyStr(op.outputName)}] = out_path
completed.append("file.save_blend:${op.outputName}")
`;
    case "export.glb":
    case "export.character_glb":
      return `
# op[${index}] ${op.op}
out_path = os.path.join(WORK_DIR, ${pyStr(op.outputName)})
assert_under_work(out_path)
export_kwargs = dict(
    filepath=out_path,
    export_format="GLB",
    use_selection=False,
    export_apply=${op.op === "export.glb" ? (op.applyModifiers !== false ? "True" : "False") : "True"},
)
try:
    export_kwargs["export_skins"] = ${op.op === "export.glb" ? (op.exportSkins ? "True" : "False") : "True"}
    export_kwargs["export_animations"] = ${op.op === "export.glb" ? (op.exportAnimations ? "True" : "False") : "True"}
except Exception:
    pass
bpy.ops.export_scene.gltf(**export_kwargs)
artifacts[${pyStr(op.outputName)}] = out_path
completed.append("${op.op}:${op.outputName}")
`;
    case "rig.create_armature":
      return `
# op[${index}] rig.create_armature
bpy.ops.object.armature_add(enter_editmode=False, location=${pyTuple(op.location ?? [0, 0, 0])})
arm = bpy.context.active_object
arm.name = ${pyStr(op.name)}
arm.data.name = ${pyStr(op.name)}
# Clear default bone; bones are added explicitly.
bpy.ops.object.mode_set(mode="EDIT")
for bone in list(arm.data.edit_bones):
    arm.data.edit_bones.remove(bone)
bpy.ops.object.mode_set(mode="OBJECT")
objects[arm.name] = arm
armatures[arm.name] = arm
completed.append("rig.create_armature:${op.name}")
`;
    case "rig.create_bone":
      return `
# op[${index}] rig.create_bone
arm = armatures.get(${pyStr(op.armature)}) or bpy.data.objects.get(${pyStr(op.armature)})
if arm is None or arm.type != "ARMATURE":
    raise RuntimeError("rig.create_bone missing armature ${op.armature}")
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
eb = arm.data.edit_bones.new(${pyStr(op.name)})
eb.head = ${pyTuple(op.head)}
eb.tail = ${pyTuple(op.tail)}
${op.parent ? `parent = arm.data.edit_bones.get(${pyStr(op.parent)})\nif parent is not None:\n    eb.parent = parent\n    eb.use_connect = False` : ""}
bpy.ops.object.mode_set(mode="OBJECT")
completed.append("rig.create_bone:${op.name}")
`;
    case "rig.parent_mesh":
      return `
# op[${index}] rig.parent_mesh
mesh = objects.get(${pyStr(op.mesh)}) or bpy.data.objects.get(${pyStr(op.mesh)})
arm = armatures.get(${pyStr(op.armature)}) or bpy.data.objects.get(${pyStr(op.armature)})
if mesh is None or arm is None:
    raise RuntimeError("rig.parent_mesh missing mesh/armature")
mesh.parent = arm
mesh.parent_type = "ARMATURE"
completed.append("rig.parent_mesh:${op.mesh}")
`;
    case "rig.assign_weights":
      return `
# op[${index}] rig.assign_weights
mesh = objects.get(${pyStr(op.mesh)}) or bpy.data.objects.get(${pyStr(op.mesh)})
arm = armatures.get(${pyStr(op.armature)}) or bpy.data.objects.get(${pyStr(op.armature)})
if mesh is None or arm is None:
    raise RuntimeError("rig.assign_weights missing mesh/armature")
# Ensure armature modifier + automatic weights.
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
completed.append("rig.assign_weights:${op.mesh}")
`;
    case "animation.create_action":
      return `
# op[${index}] animation.create_action
arm = armatures.get(${pyStr(op.armature)}) or bpy.data.objects.get(${pyStr(op.armature)})
if arm is None:
    raise RuntimeError("animation.create_action missing armature")
action = bpy.data.actions.new(name=${pyStr(op.name)})
if arm.animation_data is None:
    arm.animation_data_create()
arm.animation_data.action = action
actions[${pyStr(op.name)}] = action
scene = bpy.context.scene
scene.frame_start = ${op.frameStart ?? 1}
scene.frame_end = ${op.frameEnd ?? 24}
completed.append("animation.create_action:${op.name}")
`;
    case "animation.insert_keyframe":
      return `
# op[${index}] animation.insert_keyframe
arm = armatures.get(${pyStr(op.armature)}) or bpy.data.objects.get(${pyStr(op.armature)})
action = actions.get(${pyStr(op.action)}) or bpy.data.actions.get(${pyStr(op.action)})
if arm is None or action is None:
    raise RuntimeError("animation.insert_keyframe missing armature/action")
if arm.animation_data is None:
    arm.animation_data_create()
arm.animation_data.action = action
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
pbone = arm.pose.bones.get(${pyStr(op.bone)})
if pbone is None:
    bpy.ops.object.mode_set(mode="OBJECT")
    raise RuntimeError("animation.insert_keyframe missing bone ${op.bone}")
${op.location ? `pbone.location = ${pyTuple(op.location)}` : ""}
${op.rotationEulerDeg ? `pbone.rotation_mode = "XYZ"\npbone.rotation_euler = tuple(math.radians(v) for v in ${pyTuple(op.rotationEulerDeg)})` : ""}
pbone.keyframe_insert(data_path="location", frame=${op.frame})
pbone.keyframe_insert(data_path="rotation_euler", frame=${op.frame})
bpy.ops.object.mode_set(mode="OBJECT")
completed.append("animation.insert_keyframe:${op.action}:${op.bone}:${op.frame}")
`;
    case "animation.inspect":
    case "character.inspect":
      return `
# op[${index}] ${op.op}
completed.append(${pyStr(op.op)})
`;
    default: {
      const _never: never = op;
      throw new Error(`Unhandled operation in compiler: ${JSON.stringify(_never)}`);
    }
  }
}

export function compileBlenderTaskScript(input: {
  readonly spec: BlenderTaskSpec;
  readonly executionId: string;
  readonly taskId: string;
  readonly handoffId: string;
}): { scriptPath: string; pythonCode: string } {
  const { spec, executionId, taskId, handoffId } = input;
  const workDirPosix = spec.workingDirectory.replace(/\\/g, "/");
  const body = spec.operations.map((op, i) => compileOperation(op, i)).join("\n");
  const indentedBody = body
    .split("\n")
    .map((line) => (line.length > 0 ? `        ${line}` : ""))
    .join("\n");

  const pythonCode = `import bpy
import math
import os
import json
from datetime import datetime, timezone
from mathutils import Vector

WORK_DIR = ${pyStr(workDirPosix)}
EXECUTION_ID = ${pyStr(executionId)}
TASK_ID = ${pyStr(taskId)}
HANDOFF_ID = ${pyStr(handoffId)}

objects = {}
materials = {}
armatures = {}
actions = {}
artifacts = {}
previews = []
completed = []
warnings = []
errors = []

def assert_under_work(path):
    real_work = os.path.realpath(WORK_DIR)
    real_path = os.path.realpath(path)
    if real_path != real_work and not real_path.startswith(real_work + os.sep):
        raise RuntimeError("Path escapes work directory: " + path)

def collect_geometry():
    total_v = total_e = total_p = 0
    mesh_count = 0
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and obj.data:
            mesh_count += 1
            total_v += len(obj.data.vertices)
            total_e += len(obj.data.edges)
            total_p += len(obj.data.polygons)
    return {
        "vertices": total_v,
        "edges": total_e,
        "polygons": total_p,
        "meshObjects": mesh_count,
    }

def collect_skeleton():
    for obj in bpy.context.scene.objects:
        if obj.type == "ARMATURE" and obj.data:
            return {
                "armatureName": obj.name,
                "boneNames": [b.name for b in obj.data.bones],
            }
    return None

def collect_animations():
    names = []
    for action in bpy.data.actions:
        names.append(action.name)
    return names

def collect_scene_objects():
    out = []
    for obj in bpy.context.scene.objects:
        if obj.type not in {"MESH", "EMPTY", "CAMERA", "LIGHT"}:
            continue
        coords = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        if coords:
            mins = [min(v[i] for v in coords) for i in range(3)]
            maxs = [max(v[i] for v in coords) for i in range(3)]
            bounds = {"min": mins, "max": maxs}
        else:
            bounds = None
        out.append({"name": obj.name, "type": obj.type, "bounds": bounds})
    return out

def main():
    started = datetime.now(timezone.utc).isoformat()
    status = "completed"
    try:
${indentedBody}
    except Exception as exc:
        status = "failed"
        errors.append(str(exc))
        raise
    finally:
        geometry = collect_geometry()
        skeleton = collect_skeleton()
        animation_names = collect_animations()
        material_names = [m.name for m in bpy.data.materials]
        scene_objects = collect_scene_objects()
        ended = datetime.now(timezone.utc).isoformat()
        artifact_sizes = {}
        for name, path in artifacts.items():
            artifact_sizes[name] = os.path.getsize(path) if os.path.exists(path) else 0
        report = {
            "schemaVersion": "1.0.0",
            "taskId": TASK_ID,
            "executionId": EXECUTION_ID,
            "handoffId": HANDOFF_ID,
            "blenderVersion": bpy.app.version_string,
            "startedAt": started,
            "endedAt": ended,
            "requestedOperations": ${JSON.stringify(spec.operations.map((o) => o.op))},
            "completedOperations": completed,
            "artifacts": artifacts,
            "artifactSizes": artifact_sizes,
            "previews": previews,
            "geometry": geometry,
            "objectCount": len(scene_objects),
            "sceneObjects": scene_objects,
            "materials": {"count": len(material_names), "names": material_names},
            "exportInfo": {
                "animations": animation_names,
                "skins": skeleton is not None,
            },
            "skeleton": skeleton,
            "warnings": warnings,
            "errors": errors,
            "status": status if not errors else "failed",
            "success": status == "completed" and len(errors) == 0,
        }
        report_path = os.path.join(WORK_DIR, "blender-report.json")
        assert_under_work(report_path)
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print("Wrote blender-report.json", report_path)
        asset_report = os.path.join(WORK_DIR, ${pyStr(`${spec.assetName}-report.json`)})
        assert_under_work(asset_report)
        with open(asset_report, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        artifacts[${pyStr(`${spec.assetName}-report.json`)}] = asset_report
        print("Wrote asset report", asset_report)

if __name__ == "__main__":
    main()
`;

  return {
    scriptPath: join(spec.workingDirectory, "build_asset.py"),
    pythonCode,
  };
}
