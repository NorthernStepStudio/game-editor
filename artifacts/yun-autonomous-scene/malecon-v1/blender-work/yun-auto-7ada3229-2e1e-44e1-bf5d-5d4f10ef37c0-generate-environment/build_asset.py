import bpy
import math
import os
import json
from datetime import datetime, timezone
from mathutils import Vector

WORK_DIR = "D:/dev/Northern Step Studio/apps/matterhorn/artifacts/yun-autonomous-scene/malecon-v1/blender-work/yun-auto-7ada3229-2e1e-44e1-bf5d-5d4f10ef37c0-generate-environment"
EXECUTION_ID = "7e31af46-0740-4268-a132-8eff5de91ffb"
TASK_ID = "yun-auto-7ada3229-2e1e-44e1-bf5d-5d4f10ef37c0-generate-environment"
HANDOFF_ID = "handoff-yun-auto-7ada3229-2e1e-44e1-bf5d-5d4f10ef37c0-generate-environment-1790282739139"

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

        # op[0] scene.new
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene = bpy.context.scene
        scene.name = "yun_street_block_malecon_v1"
        completed.append("scene.new")


        # op[1] world.set_background
        if bpy.context.scene.world is None:
            bpy.context.scene.world = bpy.data.worlds.new('Matterhorn_Environment_Preview')
        world = bpy.context.scene.world
        world.use_nodes = True
        background = world.node_tree.nodes.get('Background')
        background.inputs['Color'].default_value = (0.48, 0.72, 0.82, 1)
        background.inputs['Strength'].default_value = 0.82
        completed.append("world.set_background")


        # op[2] material.create
        mat = bpy.data.materials.new(name="MAT_BuildingWarm")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.93, 0.86, 0.63, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_BuildingWarm"] = mat
        completed.append("material.create:MAT_BuildingWarm")


        # op[3] material.create
        mat = bpy.data.materials.new(name="MAT_BuildingCoral")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.96, 0.6, 0.42, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_BuildingCoral"] = mat
        completed.append("material.create:MAT_BuildingCoral")


        # op[4] material.create
        mat = bpy.data.materials.new(name="MAT_BuildingTeal")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.24, 0.7, 0.72, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_BuildingTeal"] = mat
        completed.append("material.create:MAT_BuildingTeal")


        # op[5] material.create
        mat = bpy.data.materials.new(name="MAT_Concrete")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.72, 0.68, 0.58, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_Concrete"] = mat
        completed.append("material.create:MAT_Concrete")


        # op[6] material.create
        mat = bpy.data.materials.new(name="MAT_Metal")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.24, 0.32, 0.36, 1)
            bsdf.inputs["Metallic"].default_value = 0.55
            bsdf.inputs["Roughness"].default_value = 0.34
        materials["MAT_Metal"] = mat
        completed.append("material.create:MAT_Metal")


        # op[7] material.create
        mat = bpy.data.materials.new(name="MAT_Wood")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.5, 0.34, 0.18, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_Wood"] = mat
        completed.append("material.create:MAT_Wood")


        # op[8] material.create
        mat = bpy.data.materials.new(name="MAT_Foliage")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.3, 0.58, 0.26, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_Foliage"] = mat
        completed.append("material.create:MAT_Foliage")


        # op[9] material.create
        mat = bpy.data.materials.new(name="MAT_AsphaltProp")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.24, 0.3, 0.32, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_AsphaltProp"] = mat
        completed.append("material.create:MAT_AsphaltProp")


        # op[10] material.create
        mat = bpy.data.materials.new(name="MAT_Light")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (1, 0.88, 0.52, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_Light"] = mat
        completed.append("material.create:MAT_Light")


        # op[11] material.create
        mat = bpy.data.materials.new(name="MAT_Glass")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.32, 0.74, 0.82, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_Glass"] = mat
        completed.append("material.create:MAT_Glass")


        # op[12] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.7, -4.2, 1.55))
        obj = bpy.context.active_object
        obj.name = "malecon_build_left_a__body"
        obj.scale = (4.6, 2.5, 3)
        objects["malecon_build_left_a__body"] = obj
        completed.append("mesh.create_primitive:malecon_build_left_a__body")


        # op[13] material.assign
        obj = objects.get("malecon_build_left_a__body") or bpy.data.objects.get("malecon_build_left_a__body")
        mat = materials.get("MAT_BuildingWarm") or bpy.data.materials.get("MAT_BuildingWarm")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_build_left_a__body")


        # op[14] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.7, -4.2, 3.2))
        obj = bpy.context.active_object
        obj.name = "malecon_build_left_a__roof"
        obj.scale = (4.9, 2.75, 0.24)
        objects["malecon_build_left_a__roof"] = obj
        completed.append("mesh.create_primitive:malecon_build_left_a__roof")


        # op[15] material.assign
        obj = objects.get("malecon_build_left_a__roof") or bpy.data.objects.get("malecon_build_left_a__roof")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_build_left_a__roof")


        # op[16] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.7, -2.91, 0.84))
        obj = bpy.context.active_object
        obj.name = "malecon_build_left_a__door"
        obj.scale = (0.62, 0.08, 1.65)
        objects["malecon_build_left_a__door"] = obj
        completed.append("mesh.create_primitive:malecon_build_left_a__door")


        # op[17] material.assign
        obj = objects.get("malecon_build_left_a__door") or bpy.data.objects.get("malecon_build_left_a__door")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_build_left_a__door")


        # op[18] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.5, -2.9000000000000004, 2))
        obj = bpy.context.active_object
        obj.name = "malecon_build_left_a__window_l"
        obj.scale = (0.82, 0.09, 0.7)
        objects["malecon_build_left_a__window_l"] = obj
        completed.append("mesh.create_primitive:malecon_build_left_a__window_l")


        # op[19] material.assign
        obj = objects.get("malecon_build_left_a__window_l") or bpy.data.objects.get("malecon_build_left_a__window_l")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_build_left_a__window_l")


        # op[20] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(1.9, -2.9000000000000004, 2))
        obj = bpy.context.active_object
        obj.name = "malecon_build_left_a__window_r"
        obj.scale = (0.82, 0.09, 0.7)
        objects["malecon_build_left_a__window_r"] = obj
        completed.append("mesh.create_primitive:malecon_build_left_a__window_r")


        # op[21] material.assign
        obj = objects.get("malecon_build_left_a__window_r") or bpy.data.objects.get("malecon_build_left_a__window_r")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_build_left_a__window_r")


        # op[22] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.65, -11, 1.55))
        obj = bpy.context.active_object
        obj.name = "malecon_shop_left__body"
        obj.scale = (4.6, 2.5, 3)
        objects["malecon_shop_left__body"] = obj
        completed.append("mesh.create_primitive:malecon_shop_left__body")


        # op[23] material.assign
        obj = objects.get("malecon_shop_left__body") or bpy.data.objects.get("malecon_shop_left__body")
        mat = materials.get("MAT_BuildingTeal") or bpy.data.materials.get("MAT_BuildingTeal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_shop_left__body")


        # op[24] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.65, -11, 3.2))
        obj = bpy.context.active_object
        obj.name = "malecon_shop_left__roof"
        obj.scale = (4.9, 2.75, 0.24)
        objects["malecon_shop_left__roof"] = obj
        completed.append("mesh.create_primitive:malecon_shop_left__roof")


        # op[25] material.assign
        obj = objects.get("malecon_shop_left__roof") or bpy.data.objects.get("malecon_shop_left__roof")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_shop_left__roof")


        # op[26] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.65, -9.71, 0.84))
        obj = bpy.context.active_object
        obj.name = "malecon_shop_left__door"
        obj.scale = (0.62, 0.08, 1.65)
        objects["malecon_shop_left__door"] = obj
        completed.append("mesh.create_primitive:malecon_shop_left__door")


        # op[27] material.assign
        obj = objects.get("malecon_shop_left__door") or bpy.data.objects.get("malecon_shop_left__door")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_shop_left__door")


        # op[28] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.5499999999999999, -9.7, 2))
        obj = bpy.context.active_object
        obj.name = "malecon_shop_left__window_l"
        obj.scale = (0.82, 0.09, 0.7)
        objects["malecon_shop_left__window_l"] = obj
        completed.append("mesh.create_primitive:malecon_shop_left__window_l")


        # op[29] material.assign
        obj = objects.get("malecon_shop_left__window_l") or bpy.data.objects.get("malecon_shop_left__window_l")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_shop_left__window_l")


        # op[30] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(1.85, -9.7, 2))
        obj = bpy.context.active_object
        obj.name = "malecon_shop_left__window_r"
        obj.scale = (0.82, 0.09, 0.7)
        objects["malecon_shop_left__window_r"] = obj
        completed.append("mesh.create_primitive:malecon_shop_left__window_r")


        # op[31] material.assign
        obj = objects.get("malecon_shop_left__window_r") or bpy.data.objects.get("malecon_shop_left__window_r")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_shop_left__window_r")


        # op[32] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.65, -9.379999999999999, 2.75))
        obj = bpy.context.active_object
        obj.name = "malecon_shop_left__awning"
        obj.scale = (2.9, 0.72, 0.18)
        objects["malecon_shop_left__awning"] = obj
        completed.append("mesh.create_primitive:malecon_shop_left__awning")


        # op[33] material.assign
        obj = objects.get("malecon_shop_left__awning") or bpy.data.objects.get("malecon_shop_left__awning")
        mat = materials.get("MAT_BuildingCoral") or bpy.data.materials.get("MAT_BuildingCoral")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_shop_left__awning")


        # op[34] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.65, -9.66, 3.45))
        obj = bpy.context.active_object
        obj.name = "malecon_shop_left__sign"
        obj.scale = (2, 0.12, 0.48)
        objects["malecon_shop_left__sign"] = obj
        completed.append("mesh.create_primitive:malecon_shop_left__sign")


        # op[35] material.assign
        obj = objects.get("malecon_shop_left__sign") or bpy.data.objects.get("malecon_shop_left__sign")
        mat = materials.get("MAT_Light") or bpy.data.materials.get("MAT_Light")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_shop_left__sign")


        # op[36] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.1, -5, 1.55))
        obj = bpy.context.active_object
        obj.name = "malecon_build_right_a__body"
        obj.scale = (4.6, 2.5, 3)
        objects["malecon_build_right_a__body"] = obj
        completed.append("mesh.create_primitive:malecon_build_right_a__body")


        # op[37] material.assign
        obj = objects.get("malecon_build_right_a__body") or bpy.data.objects.get("malecon_build_right_a__body")
        mat = materials.get("MAT_BuildingWarm") or bpy.data.materials.get("MAT_BuildingWarm")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_build_right_a__body")


        # op[38] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.1, -5, 3.2))
        obj = bpy.context.active_object
        obj.name = "malecon_build_right_a__roof"
        obj.scale = (4.9, 2.75, 0.24)
        objects["malecon_build_right_a__roof"] = obj
        completed.append("mesh.create_primitive:malecon_build_right_a__roof")


        # op[39] material.assign
        obj = objects.get("malecon_build_right_a__roof") or bpy.data.objects.get("malecon_build_right_a__roof")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_build_right_a__roof")


        # op[40] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.1, -3.71, 0.84))
        obj = bpy.context.active_object
        obj.name = "malecon_build_right_a__door"
        obj.scale = (0.62, 0.08, 1.65)
        objects["malecon_build_right_a__door"] = obj
        completed.append("mesh.create_primitive:malecon_build_right_a__door")


        # op[41] material.assign
        obj = objects.get("malecon_build_right_a__door") or bpy.data.objects.get("malecon_build_right_a__door")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_build_right_a__door")


        # op[42] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.900000000000002, -3.7, 2))
        obj = bpy.context.active_object
        obj.name = "malecon_build_right_a__window_l"
        obj.scale = (0.82, 0.09, 0.7)
        objects["malecon_build_right_a__window_l"] = obj
        completed.append("mesh.create_primitive:malecon_build_right_a__window_l")


        # op[43] material.assign
        obj = objects.get("malecon_build_right_a__window_l") or bpy.data.objects.get("malecon_build_right_a__window_l")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_build_right_a__window_l")


        # op[44] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(29.3, -3.7, 2))
        obj = bpy.context.active_object
        obj.name = "malecon_build_right_a__window_r"
        obj.scale = (0.82, 0.09, 0.7)
        objects["malecon_build_right_a__window_r"] = obj
        completed.append("mesh.create_primitive:malecon_build_right_a__window_r")


        # op[45] material.assign
        obj = objects.get("malecon_build_right_a__window_r") or bpy.data.objects.get("malecon_build_right_a__window_r")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_build_right_a__window_r")


        # op[46] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.15, -13.8, 1.55))
        obj = bpy.context.active_object
        obj.name = "malecon_shop_right__body"
        obj.scale = (4.6, 2.5, 3)
        objects["malecon_shop_right__body"] = obj
        completed.append("mesh.create_primitive:malecon_shop_right__body")


        # op[47] material.assign
        obj = objects.get("malecon_shop_right__body") or bpy.data.objects.get("malecon_shop_right__body")
        mat = materials.get("MAT_BuildingTeal") or bpy.data.materials.get("MAT_BuildingTeal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_shop_right__body")


        # op[48] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.15, -13.8, 3.2))
        obj = bpy.context.active_object
        obj.name = "malecon_shop_right__roof"
        obj.scale = (4.9, 2.75, 0.24)
        objects["malecon_shop_right__roof"] = obj
        completed.append("mesh.create_primitive:malecon_shop_right__roof")


        # op[49] material.assign
        obj = objects.get("malecon_shop_right__roof") or bpy.data.objects.get("malecon_shop_right__roof")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_shop_right__roof")


        # op[50] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.15, -12.510000000000002, 0.84))
        obj = bpy.context.active_object
        obj.name = "malecon_shop_right__door"
        obj.scale = (0.62, 0.08, 1.65)
        objects["malecon_shop_right__door"] = obj
        completed.append("mesh.create_primitive:malecon_shop_right__door")


        # op[51] material.assign
        obj = objects.get("malecon_shop_right__door") or bpy.data.objects.get("malecon_shop_right__door")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_shop_right__door")


        # op[52] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.95, -12.5, 2))
        obj = bpy.context.active_object
        obj.name = "malecon_shop_right__window_l"
        obj.scale = (0.82, 0.09, 0.7)
        objects["malecon_shop_right__window_l"] = obj
        completed.append("mesh.create_primitive:malecon_shop_right__window_l")


        # op[53] material.assign
        obj = objects.get("malecon_shop_right__window_l") or bpy.data.objects.get("malecon_shop_right__window_l")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_shop_right__window_l")


        # op[54] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(29.349999999999998, -12.5, 2))
        obj = bpy.context.active_object
        obj.name = "malecon_shop_right__window_r"
        obj.scale = (0.82, 0.09, 0.7)
        objects["malecon_shop_right__window_r"] = obj
        completed.append("mesh.create_primitive:malecon_shop_right__window_r")


        # op[55] material.assign
        obj = objects.get("malecon_shop_right__window_r") or bpy.data.objects.get("malecon_shop_right__window_r")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_shop_right__window_r")


        # op[56] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.15, -12.18, 2.75))
        obj = bpy.context.active_object
        obj.name = "malecon_shop_right__awning"
        obj.scale = (2.9, 0.72, 0.18)
        objects["malecon_shop_right__awning"] = obj
        completed.append("mesh.create_primitive:malecon_shop_right__awning")


        # op[57] material.assign
        obj = objects.get("malecon_shop_right__awning") or bpy.data.objects.get("malecon_shop_right__awning")
        mat = materials.get("MAT_BuildingCoral") or bpy.data.materials.get("MAT_BuildingCoral")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_shop_right__awning")


        # op[58] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.15, -12.46, 3.45))
        obj = bpy.context.active_object
        obj.name = "malecon_shop_right__sign"
        obj.scale = (2, 0.12, 0.48)
        objects["malecon_shop_right__sign"] = obj
        completed.append("mesh.create_primitive:malecon_shop_right__sign")


        # op[59] material.assign
        obj = objects.get("malecon_shop_right__sign") or bpy.data.objects.get("malecon_shop_right__sign")
        mat = materials.get("MAT_Light") or bpy.data.materials.get("MAT_Light")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_shop_right__sign")


        # op[60] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.19, depth=2.8, location=(2.55, -2, 1.4))
        obj = bpy.context.active_object
        obj.name = "malecon_palm_left_near__trunk"
        obj.scale = (0.19, 0.19, 2.8)
        objects["malecon_palm_left_near__trunk"] = obj
        completed.append("mesh.create_primitive:malecon_palm_left_near__trunk")


        # op[61] material.assign
        obj = objects.get("malecon_palm_left_near__trunk") or bpy.data.objects.get("malecon_palm_left_near__trunk")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_palm_left_near__trunk")


        # op[62] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(2.55, -2, 3))
        obj = bpy.context.active_object
        obj.name = "malecon_palm_left_near__crown_a"
        obj.scale = (1.55, 1.45, 1.1)
        objects["malecon_palm_left_near__crown_a"] = obj
        completed.append("mesh.create_primitive:malecon_palm_left_near__crown_a")


        # op[63] material.assign
        obj = objects.get("malecon_palm_left_near__crown_a") or bpy.data.objects.get("malecon_palm_left_near__crown_a")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_palm_left_near__crown_a")


        # op[64] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(1.9299999999999997, -2.03, 3.52))
        obj = bpy.context.active_object
        obj.name = "malecon_palm_left_near__crown_b"
        obj.scale = (1.05, 1, 0.8)
        objects["malecon_palm_left_near__crown_b"] = obj
        completed.append("mesh.create_primitive:malecon_palm_left_near__crown_b")


        # op[65] material.assign
        obj = objects.get("malecon_palm_left_near__crown_b") or bpy.data.objects.get("malecon_palm_left_near__crown_b")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_palm_left_near__crown_b")


        # op[66] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.19, depth=2.8, location=(2.45, -16.7, 1.4))
        obj = bpy.context.active_object
        obj.name = "malecon_palm_left_far__trunk"
        obj.scale = (0.19, 0.19, 2.8)
        objects["malecon_palm_left_far__trunk"] = obj
        completed.append("mesh.create_primitive:malecon_palm_left_far__trunk")


        # op[67] material.assign
        obj = objects.get("malecon_palm_left_far__trunk") or bpy.data.objects.get("malecon_palm_left_far__trunk")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_palm_left_far__trunk")


        # op[68] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(2.45, -16.7, 3))
        obj = bpy.context.active_object
        obj.name = "malecon_palm_left_far__crown_a"
        obj.scale = (1.55, 1.45, 1.1)
        objects["malecon_palm_left_far__crown_a"] = obj
        completed.append("mesh.create_primitive:malecon_palm_left_far__crown_a")


        # op[69] material.assign
        obj = objects.get("malecon_palm_left_far__crown_a") or bpy.data.objects.get("malecon_palm_left_far__crown_a")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_palm_left_far__crown_a")


        # op[70] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(1.83, -16.73, 3.52))
        obj = bpy.context.active_object
        obj.name = "malecon_palm_left_far__crown_b"
        obj.scale = (1.05, 1, 0.8)
        objects["malecon_palm_left_far__crown_b"] = obj
        completed.append("mesh.create_primitive:malecon_palm_left_far__crown_b")


        # op[71] material.assign
        obj = objects.get("malecon_palm_left_far__crown_b") or bpy.data.objects.get("malecon_palm_left_far__crown_b")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_palm_left_far__crown_b")


        # op[72] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.19, depth=2.8, location=(26.3, -3.3, 1.4))
        obj = bpy.context.active_object
        obj.name = "malecon_palm_right_near__trunk"
        obj.scale = (0.19, 0.19, 2.8)
        objects["malecon_palm_right_near__trunk"] = obj
        completed.append("mesh.create_primitive:malecon_palm_right_near__trunk")


        # op[73] material.assign
        obj = objects.get("malecon_palm_right_near__trunk") or bpy.data.objects.get("malecon_palm_right_near__trunk")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_palm_right_near__trunk")


        # op[74] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(26.3, -3.3, 3))
        obj = bpy.context.active_object
        obj.name = "malecon_palm_right_near__crown_a"
        obj.scale = (1.55, 1.45, 1.1)
        objects["malecon_palm_right_near__crown_a"] = obj
        completed.append("mesh.create_primitive:malecon_palm_right_near__crown_a")


        # op[75] material.assign
        obj = objects.get("malecon_palm_right_near__crown_a") or bpy.data.objects.get("malecon_palm_right_near__crown_a")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_palm_right_near__crown_a")


        # op[76] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(25.68, -3.3299999999999996, 3.52))
        obj = bpy.context.active_object
        obj.name = "malecon_palm_right_near__crown_b"
        obj.scale = (1.05, 1, 0.8)
        objects["malecon_palm_right_near__crown_b"] = obj
        completed.append("mesh.create_primitive:malecon_palm_right_near__crown_b")


        # op[77] material.assign
        obj = objects.get("malecon_palm_right_near__crown_b") or bpy.data.objects.get("malecon_palm_right_near__crown_b")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_palm_right_near__crown_b")


        # op[78] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.19, depth=2.8, location=(26.25, -17.2, 1.4))
        obj = bpy.context.active_object
        obj.name = "malecon_palm_right_far__trunk"
        obj.scale = (0.19, 0.19, 2.8)
        objects["malecon_palm_right_far__trunk"] = obj
        completed.append("mesh.create_primitive:malecon_palm_right_far__trunk")


        # op[79] material.assign
        obj = objects.get("malecon_palm_right_far__trunk") or bpy.data.objects.get("malecon_palm_right_far__trunk")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_palm_right_far__trunk")


        # op[80] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(26.25, -17.2, 3))
        obj = bpy.context.active_object
        obj.name = "malecon_palm_right_far__crown_a"
        obj.scale = (1.55, 1.45, 1.1)
        objects["malecon_palm_right_far__crown_a"] = obj
        completed.append("mesh.create_primitive:malecon_palm_right_far__crown_a")


        # op[81] material.assign
        obj = objects.get("malecon_palm_right_far__crown_a") or bpy.data.objects.get("malecon_palm_right_far__crown_a")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_palm_right_far__crown_a")


        # op[82] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(25.63, -17.23, 3.52))
        obj = bpy.context.active_object
        obj.name = "malecon_palm_right_far__crown_b"
        obj.scale = (1.05, 1, 0.8)
        objects["malecon_palm_right_far__crown_b"] = obj
        completed.append("mesh.create_primitive:malecon_palm_right_far__crown_b")


        # op[83] material.assign
        obj = objects.get("malecon_palm_right_far__crown_b") or bpy.data.objects.get("malecon_palm_right_far__crown_b")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_palm_right_far__crown_b")


        # op[84] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(2.5, -7.6, 0.5))
        obj = bpy.context.active_object
        obj.name = "malecon_bench_left__seat"
        obj.scale = (1.4, 0.42, 0.12)
        objects["malecon_bench_left__seat"] = obj
        completed.append("mesh.create_primitive:malecon_bench_left__seat")


        # op[85] material.assign
        obj = objects.get("malecon_bench_left__seat") or bpy.data.objects.get("malecon_bench_left__seat")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_bench_left__seat")


        # op[86] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(2.5, -7.75, 0.82))
        obj = bpy.context.active_object
        obj.name = "malecon_bench_left__back"
        obj.scale = (1.4, 0.12, 0.52)
        objects["malecon_bench_left__back"] = obj
        completed.append("mesh.create_primitive:malecon_bench_left__back")


        # op[87] material.assign
        obj = objects.get("malecon_bench_left__back") or bpy.data.objects.get("malecon_bench_left__back")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_bench_left__back")


        # op[88] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.48, location=(1.96, -7.6, 0.25))
        obj = bpy.context.active_object
        obj.name = "malecon_bench_left__leg_l"
        obj.scale = (0.045, 0.045, 0.48)
        objects["malecon_bench_left__leg_l"] = obj
        completed.append("mesh.create_primitive:malecon_bench_left__leg_l")


        # op[89] material.assign
        obj = objects.get("malecon_bench_left__leg_l") or bpy.data.objects.get("malecon_bench_left__leg_l")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_bench_left__leg_l")


        # op[90] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.48, location=(3.04, -7.6, 0.25))
        obj = bpy.context.active_object
        obj.name = "malecon_bench_left__leg_r"
        obj.scale = (0.045, 0.045, 0.48)
        objects["malecon_bench_left__leg_r"] = obj
        completed.append("mesh.create_primitive:malecon_bench_left__leg_r")


        # op[91] material.assign
        obj = objects.get("malecon_bench_left__leg_r") or bpy.data.objects.get("malecon_bench_left__leg_r")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_bench_left__leg_r")


        # op[92] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.15, -9.2, 0.5))
        obj = bpy.context.active_object
        obj.name = "malecon_bench_right__seat"
        obj.scale = (1.4, 0.42, 0.12)
        objects["malecon_bench_right__seat"] = obj
        completed.append("mesh.create_primitive:malecon_bench_right__seat")


        # op[93] material.assign
        obj = objects.get("malecon_bench_right__seat") or bpy.data.objects.get("malecon_bench_right__seat")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_bench_right__seat")


        # op[94] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.15, -9.35, 0.82))
        obj = bpy.context.active_object
        obj.name = "malecon_bench_right__back"
        obj.scale = (1.4, 0.12, 0.52)
        objects["malecon_bench_right__back"] = obj
        completed.append("mesh.create_primitive:malecon_bench_right__back")


        # op[95] material.assign
        obj = objects.get("malecon_bench_right__back") or bpy.data.objects.get("malecon_bench_right__back")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_bench_right__back")


        # op[96] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.48, location=(25.61, -9.2, 0.25))
        obj = bpy.context.active_object
        obj.name = "malecon_bench_right__leg_l"
        obj.scale = (0.045, 0.045, 0.48)
        objects["malecon_bench_right__leg_l"] = obj
        completed.append("mesh.create_primitive:malecon_bench_right__leg_l")


        # op[97] material.assign
        obj = objects.get("malecon_bench_right__leg_l") or bpy.data.objects.get("malecon_bench_right__leg_l")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_bench_right__leg_l")


        # op[98] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.48, location=(26.689999999999998, -9.2, 0.25))
        obj = bpy.context.active_object
        obj.name = "malecon_bench_right__leg_r"
        obj.scale = (0.045, 0.045, 0.48)
        objects["malecon_bench_right__leg_r"] = obj
        completed.append("mesh.create_primitive:malecon_bench_right__leg_r")


        # op[99] material.assign
        obj = objects.get("malecon_bench_right__leg_r") or bpy.data.objects.get("malecon_bench_right__leg_r")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_bench_right__leg_r")


        # op[100] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=4.3, location=(2.95, -12.9, 2.15))
        obj = bpy.context.active_object
        obj.name = "malecon_lamp_left__pole"
        obj.scale = (0.07, 0.07, 4.3)
        objects["malecon_lamp_left__pole"] = obj
        completed.append("mesh.create_primitive:malecon_lamp_left__pole")


        # op[101] material.assign
        obj = objects.get("malecon_lamp_left__pole") or bpy.data.objects.get("malecon_lamp_left__pole")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_lamp_left__pole")


        # op[102] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(3.3000000000000003, -12.9, 4.15))
        obj = bpy.context.active_object
        obj.name = "malecon_lamp_left__arm"
        obj.scale = (0.85, 0.08, 0.08)
        objects["malecon_lamp_left__arm"] = obj
        completed.append("mesh.create_primitive:malecon_lamp_left__arm")


        # op[103] material.assign
        obj = objects.get("malecon_lamp_left__arm") or bpy.data.objects.get("malecon_lamp_left__arm")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_lamp_left__arm")


        # op[104] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(3.6300000000000003, -12.9, 4.08))
        obj = bpy.context.active_object
        obj.name = "malecon_lamp_left__lamp"
        obj.scale = (0.42, 0.3, 0.16)
        objects["malecon_lamp_left__lamp"] = obj
        completed.append("mesh.create_primitive:malecon_lamp_left__lamp")


        # op[105] material.assign
        obj = objects.get("malecon_lamp_left__lamp") or bpy.data.objects.get("malecon_lamp_left__lamp")
        mat = materials.get("MAT_Light") or bpy.data.materials.get("MAT_Light")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_lamp_left__lamp")


        # op[106] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=4.3, location=(25.85, -6.2, 2.15))
        obj = bpy.context.active_object
        obj.name = "malecon_lamp_right__pole"
        obj.scale = (0.07, 0.07, 4.3)
        objects["malecon_lamp_right__pole"] = obj
        completed.append("mesh.create_primitive:malecon_lamp_right__pole")


        # op[107] material.assign
        obj = objects.get("malecon_lamp_right__pole") or bpy.data.objects.get("malecon_lamp_right__pole")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_lamp_right__pole")


        # op[108] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.200000000000003, -6.2, 4.15))
        obj = bpy.context.active_object
        obj.name = "malecon_lamp_right__arm"
        obj.scale = (0.85, 0.08, 0.08)
        objects["malecon_lamp_right__arm"] = obj
        completed.append("mesh.create_primitive:malecon_lamp_right__arm")


        # op[109] material.assign
        obj = objects.get("malecon_lamp_right__arm") or bpy.data.objects.get("malecon_lamp_right__arm")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_lamp_right__arm")


        # op[110] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.53, -6.2, 4.08))
        obj = bpy.context.active_object
        obj.name = "malecon_lamp_right__lamp"
        obj.scale = (0.42, 0.3, 0.16)
        objects["malecon_lamp_right__lamp"] = obj
        completed.append("mesh.create_primitive:malecon_lamp_right__lamp")


        # op[111] material.assign
        obj = objects.get("malecon_lamp_right__lamp") or bpy.data.objects.get("malecon_lamp_right__lamp")
        mat = materials.get("MAT_Light") or bpy.data.materials.get("MAT_Light")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_lamp_right__lamp")


        # op[112] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(1.9, -14.6, 0.52))
        obj = bpy.context.active_object
        obj.name = "malecon_car_left__chassis"
        obj.scale = (1.72, 3.1, 0.48)
        objects["malecon_car_left__chassis"] = obj
        completed.append("mesh.create_primitive:malecon_car_left__chassis")


        # op[113] material.assign
        obj = objects.get("malecon_car_left__chassis") or bpy.data.objects.get("malecon_car_left__chassis")
        mat = materials.get("MAT_BuildingTeal") or bpy.data.materials.get("MAT_BuildingTeal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_car_left__chassis")


        # op[114] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(1.9, -14.68, 1.02))
        obj = bpy.context.active_object
        obj.name = "malecon_car_left__cabin"
        obj.scale = (1.35, 1.6, 0.62)
        objects["malecon_car_left__cabin"] = obj
        completed.append("mesh.create_primitive:malecon_car_left__cabin")


        # op[115] material.assign
        obj = objects.get("malecon_car_left__cabin") or bpy.data.objects.get("malecon_car_left__cabin")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_car_left__cabin")


        # op[116] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(1.08, -13.62, 0.3))
        obj = bpy.context.active_object
        obj.name = "malecon_car_left__wheel_0_l"
        obj.scale = (0.25, 0.25, 0.16)
        objects["malecon_car_left__wheel_0_l"] = obj
        completed.append("mesh.create_primitive:malecon_car_left__wheel_0_l")


        # op[117] mesh.transform
        obj = objects.get("malecon_car_left__wheel_0_l") or bpy.data.objects.get("malecon_car_left__wheel_0_l")
        if obj is None:
            raise RuntimeError("mesh.transform missing target malecon_car_left__wheel_0_l")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 0))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:malecon_car_left__wheel_0_l")


        # op[118] material.assign
        obj = objects.get("malecon_car_left__wheel_0_l") or bpy.data.objects.get("malecon_car_left__wheel_0_l")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_car_left__wheel_0_l")


        # op[119] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(2.7199999999999998, -13.62, 0.3))
        obj = bpy.context.active_object
        obj.name = "malecon_car_left__wheel_0_r"
        obj.scale = (0.25, 0.25, 0.16)
        objects["malecon_car_left__wheel_0_r"] = obj
        completed.append("mesh.create_primitive:malecon_car_left__wheel_0_r")


        # op[120] mesh.transform
        obj = objects.get("malecon_car_left__wheel_0_r") or bpy.data.objects.get("malecon_car_left__wheel_0_r")
        if obj is None:
            raise RuntimeError("mesh.transform missing target malecon_car_left__wheel_0_r")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 0))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:malecon_car_left__wheel_0_r")


        # op[121] material.assign
        obj = objects.get("malecon_car_left__wheel_0_r") or bpy.data.objects.get("malecon_car_left__wheel_0_r")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_car_left__wheel_0_r")


        # op[122] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(1.08, -15.58, 0.3))
        obj = bpy.context.active_object
        obj.name = "malecon_car_left__wheel_1_l"
        obj.scale = (0.25, 0.25, 0.16)
        objects["malecon_car_left__wheel_1_l"] = obj
        completed.append("mesh.create_primitive:malecon_car_left__wheel_1_l")


        # op[123] mesh.transform
        obj = objects.get("malecon_car_left__wheel_1_l") or bpy.data.objects.get("malecon_car_left__wheel_1_l")
        if obj is None:
            raise RuntimeError("mesh.transform missing target malecon_car_left__wheel_1_l")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 0))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:malecon_car_left__wheel_1_l")


        # op[124] material.assign
        obj = objects.get("malecon_car_left__wheel_1_l") or bpy.data.objects.get("malecon_car_left__wheel_1_l")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_car_left__wheel_1_l")


        # op[125] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(2.7199999999999998, -15.58, 0.3))
        obj = bpy.context.active_object
        obj.name = "malecon_car_left__wheel_1_r"
        obj.scale = (0.25, 0.25, 0.16)
        objects["malecon_car_left__wheel_1_r"] = obj
        completed.append("mesh.create_primitive:malecon_car_left__wheel_1_r")


        # op[126] mesh.transform
        obj = objects.get("malecon_car_left__wheel_1_r") or bpy.data.objects.get("malecon_car_left__wheel_1_r")
        if obj is None:
            raise RuntimeError("mesh.transform missing target malecon_car_left__wheel_1_r")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 0))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:malecon_car_left__wheel_1_r")


        # op[127] material.assign
        obj = objects.get("malecon_car_left__wheel_1_r") or bpy.data.objects.get("malecon_car_left__wheel_1_r")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_car_left__wheel_1_r")


        # op[128] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.9, -11.7, 0.52))
        obj = bpy.context.active_object
        obj.name = "malecon_car_right__chassis"
        obj.scale = (1.72, 3.1, 0.48)
        objects["malecon_car_right__chassis"] = obj
        completed.append("mesh.create_primitive:malecon_car_right__chassis")


        # op[129] material.assign
        obj = objects.get("malecon_car_right__chassis") or bpy.data.objects.get("malecon_car_right__chassis")
        mat = materials.get("MAT_BuildingCoral") or bpy.data.materials.get("MAT_BuildingCoral")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_car_right__chassis")


        # op[130] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.9, -11.78, 1.02))
        obj = bpy.context.active_object
        obj.name = "malecon_car_right__cabin"
        obj.scale = (1.35, 1.6, 0.62)
        objects["malecon_car_right__cabin"] = obj
        completed.append("mesh.create_primitive:malecon_car_right__cabin")


        # op[131] material.assign
        obj = objects.get("malecon_car_right__cabin") or bpy.data.objects.get("malecon_car_right__cabin")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_car_right__cabin")


        # op[132] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(26.08, -10.719999999999999, 0.3))
        obj = bpy.context.active_object
        obj.name = "malecon_car_right__wheel_0_l"
        obj.scale = (0.25, 0.25, 0.16)
        objects["malecon_car_right__wheel_0_l"] = obj
        completed.append("mesh.create_primitive:malecon_car_right__wheel_0_l")


        # op[133] mesh.transform
        obj = objects.get("malecon_car_right__wheel_0_l") or bpy.data.objects.get("malecon_car_right__wheel_0_l")
        if obj is None:
            raise RuntimeError("mesh.transform missing target malecon_car_right__wheel_0_l")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 0))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:malecon_car_right__wheel_0_l")


        # op[134] material.assign
        obj = objects.get("malecon_car_right__wheel_0_l") or bpy.data.objects.get("malecon_car_right__wheel_0_l")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_car_right__wheel_0_l")


        # op[135] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(27.72, -10.719999999999999, 0.3))
        obj = bpy.context.active_object
        obj.name = "malecon_car_right__wheel_0_r"
        obj.scale = (0.25, 0.25, 0.16)
        objects["malecon_car_right__wheel_0_r"] = obj
        completed.append("mesh.create_primitive:malecon_car_right__wheel_0_r")


        # op[136] mesh.transform
        obj = objects.get("malecon_car_right__wheel_0_r") or bpy.data.objects.get("malecon_car_right__wheel_0_r")
        if obj is None:
            raise RuntimeError("mesh.transform missing target malecon_car_right__wheel_0_r")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 0))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:malecon_car_right__wheel_0_r")


        # op[137] material.assign
        obj = objects.get("malecon_car_right__wheel_0_r") or bpy.data.objects.get("malecon_car_right__wheel_0_r")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_car_right__wheel_0_r")


        # op[138] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(26.08, -12.68, 0.3))
        obj = bpy.context.active_object
        obj.name = "malecon_car_right__wheel_1_l"
        obj.scale = (0.25, 0.25, 0.16)
        objects["malecon_car_right__wheel_1_l"] = obj
        completed.append("mesh.create_primitive:malecon_car_right__wheel_1_l")


        # op[139] mesh.transform
        obj = objects.get("malecon_car_right__wheel_1_l") or bpy.data.objects.get("malecon_car_right__wheel_1_l")
        if obj is None:
            raise RuntimeError("mesh.transform missing target malecon_car_right__wheel_1_l")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 0))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:malecon_car_right__wheel_1_l")


        # op[140] material.assign
        obj = objects.get("malecon_car_right__wheel_1_l") or bpy.data.objects.get("malecon_car_right__wheel_1_l")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_car_right__wheel_1_l")


        # op[141] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(27.72, -12.68, 0.3))
        obj = bpy.context.active_object
        obj.name = "malecon_car_right__wheel_1_r"
        obj.scale = (0.25, 0.25, 0.16)
        objects["malecon_car_right__wheel_1_r"] = obj
        completed.append("mesh.create_primitive:malecon_car_right__wheel_1_r")


        # op[142] mesh.transform
        obj = objects.get("malecon_car_right__wheel_1_r") or bpy.data.objects.get("malecon_car_right__wheel_1_r")
        if obj is None:
            raise RuntimeError("mesh.transform missing target malecon_car_right__wheel_1_r")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 0))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:malecon_car_right__wheel_1_r")


        # op[143] material.assign
        obj = objects.get("malecon_car_right__wheel_1_r") or bpy.data.objects.get("malecon_car_right__wheel_1_r")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_car_right__wheel_1_r")


        # op[144] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(2.45, -10.4, 0.26))
        obj = bpy.context.active_object
        obj.name = "malecon_planter_left__pot"
        obj.scale = (0.78, 0.68, 0.5)
        objects["malecon_planter_left__pot"] = obj
        completed.append("mesh.create_primitive:malecon_planter_left__pot")


        # op[145] material.assign
        obj = objects.get("malecon_planter_left__pot") or bpy.data.objects.get("malecon_planter_left__pot")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_planter_left__pot")


        # op[146] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(2.45, -10.4, 0.78))
        obj = bpy.context.active_object
        obj.name = "malecon_planter_left__plant"
        obj.scale = (0.7, 0.62, 0.65)
        objects["malecon_planter_left__plant"] = obj
        completed.append("mesh.create_primitive:malecon_planter_left__plant")


        # op[147] material.assign
        obj = objects.get("malecon_planter_left__plant") or bpy.data.objects.get("malecon_planter_left__plant")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_planter_left__plant")


        # op[148] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.2, -14.8, 0.26))
        obj = bpy.context.active_object
        obj.name = "malecon_planter_right__pot"
        obj.scale = (0.78, 0.68, 0.5)
        objects["malecon_planter_right__pot"] = obj
        completed.append("mesh.create_primitive:malecon_planter_right__pot")


        # op[149] material.assign
        obj = objects.get("malecon_planter_right__pot") or bpy.data.objects.get("malecon_planter_right__pot")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_planter_right__pot")


        # op[150] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(26.2, -14.8, 0.78))
        obj = bpy.context.active_object
        obj.name = "malecon_planter_right__plant"
        obj.scale = (0.7, 0.62, 0.65)
        objects["malecon_planter_right__plant"] = obj
        completed.append("mesh.create_primitive:malecon_planter_right__plant")


        # op[151] material.assign
        obj = objects.get("malecon_planter_right__plant") or bpy.data.objects.get("malecon_planter_right__plant")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:malecon_planter_right__plant")


        # op[152] light.create
        bpy.ops.object.light_add(type="SUN", location=(4, -4, 6))
        light = bpy.context.active_object
        light.name = "Preview_Sun"
        light.data.energy = 2
        light.rotation_euler = tuple(math.radians(v) for v in (28, 0, 24))
        objects[light.name] = light
        completed.append("light.create")


        # op[153] render.multi_view
        scene = bpy.context.scene
        scene.render.engine = "BLENDER_EEVEE_NEXT" if hasattr(bpy.types, "BLENDER_EEVEE_NEXT") else "BLENDER_EEVEE"
        scene.render.resolution_x = 960
        scene.render.resolution_y = 640
        cam = scene.camera
        if cam is None:
            bpy.ops.object.camera_add()
            cam = bpy.context.active_object
            scene.camera = cam

        cam.location = (48.4, 36, 40.8)
        cam.data.lens = 50
        cam.rotation_euler = (Vector((14.4, -10, 1.8)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_malecon_v1-overview.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_malecon_v1-overview.png"] = out_path
        previews.append(out_path)


        cam.location = (8.4, 3, 11.5)
        cam.data.lens = 50
        cam.rotation_euler = (Vector((2.4, -10, 1.5)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_malecon_v1-left.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_malecon_v1-left.png"] = out_path
        previews.append(out_path)


        cam.location = (20.4, 3, 11.5)
        cam.data.lens = 50
        cam.rotation_euler = (Vector((26.4, -10, 1.5)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_malecon_v1-right.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_malecon_v1-right.png"] = out_path
        previews.append(out_path)


        cam.location = (14.4, 17.2, 12.8)
        cam.data.lens = 24
        cam.rotation_euler = (Vector((14.4, -4.8, 1.8)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_malecon_v1-yun_side.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_malecon_v1-yun_side.png"] = out_path
        previews.append(out_path)


        cam.location = (14.4, -37.2, 12.8)
        cam.data.lens = 24
        cam.rotation_euler = (Vector((14.4, -15.2, 1.8)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_malecon_v1-turn_side.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_malecon_v1-turn_side.png"] = out_path
        previews.append(out_path)


        cam.location = (44.4, 32, 34.8)
        cam.data.lens = 50
        cam.rotation_euler = (Vector((14.4, -10, 1.8)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_malecon_v1-gameplay.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_malecon_v1-gameplay.png"] = out_path
        previews.append(out_path)

        completed.append("render.multi_view")


        # op[154] file.save_blend
        out_path = os.path.join(WORK_DIR, "yun_street_block_malecon_v1.blend")
        assert_under_work(out_path)
        bpy.ops.wm.save_as_mainfile(filepath=out_path)
        artifacts["yun_street_block_malecon_v1.blend"] = out_path
        completed.append("file.save_blend:yun_street_block_malecon_v1.blend")


        # op[155] export.glb
        out_path = os.path.join(WORK_DIR, "yun_street_block_malecon_v1.glb")
        assert_under_work(out_path)
        export_kwargs = dict(
            filepath=out_path,
            export_format="GLB",
            use_selection=False,
            export_apply=True,
        )
        try:
            export_kwargs["export_skins"] = False
            export_kwargs["export_animations"] = False
        except Exception:
            pass
        bpy.ops.export_scene.gltf(**export_kwargs)
        artifacts["yun_street_block_malecon_v1.glb"] = out_path
        completed.append("export.glb:yun_street_block_malecon_v1.glb")

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
            "requestedOperations": ["scene.new","world.set_background","material.create","material.create","material.create","material.create","material.create","material.create","material.create","material.create","material.create","material.create","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","light.create","render.multi_view","file.save_blend","export.glb"],
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
        asset_report = os.path.join(WORK_DIR, "yun_street_block_malecon_v1-report.json")
        assert_under_work(asset_report)
        with open(asset_report, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        artifacts["yun_street_block_malecon_v1-report.json"] = asset_report
        print("Wrote asset report", asset_report)

if __name__ == "__main__":
    main()
