import bpy
import math
import os
import json
from datetime import datetime, timezone
from mathutils import Vector

WORK_DIR = "C:/Users/winst/AppData/Local/Temp/matterhorn-yun-environment-T69Out/t-yun-calle-env"
EXECUTION_ID = "7ec6c2f5-e335-44dc-b4fd-2538a7712e71"
TASK_ID = "t-yun-calle-env"
HANDOFF_ID = "h-yun-calle-env"

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
        scene.name = "yun_street_block_calle_v1"
        completed.append("scene.new")


        # op[1] world.set_background
        if bpy.context.scene.world is None:
            bpy.context.scene.world = bpy.data.worlds.new('Matterhorn_Environment_Preview')
        world = bpy.context.scene.world
        world.use_nodes = True
        background = world.node_tree.nodes.get('Background')
        background.inputs['Color'].default_value = (0.52, 0.67, 0.76, 1)
        background.inputs['Strength'].default_value = 0.7
        completed.append("world.set_background")


        # op[2] material.create
        mat = bpy.data.materials.new(name="MAT_BuildingWarm")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.92, 0.57, 0.32, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_BuildingWarm"] = mat
        completed.append("material.create:MAT_BuildingWarm")


        # op[3] material.create
        mat = bpy.data.materials.new(name="MAT_BuildingCoral")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.84, 0.31, 0.25, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_BuildingCoral"] = mat
        completed.append("material.create:MAT_BuildingCoral")


        # op[4] material.create
        mat = bpy.data.materials.new(name="MAT_BuildingTeal")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.18, 0.56, 0.55, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_BuildingTeal"] = mat
        completed.append("material.create:MAT_BuildingTeal")


        # op[5] material.create
        mat = bpy.data.materials.new(name="MAT_Concrete")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.52, 0.49, 0.43, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_Concrete"] = mat
        completed.append("material.create:MAT_Concrete")


        # op[6] material.create
        mat = bpy.data.materials.new(name="MAT_Metal")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.16, 0.19, 0.22, 1)
            bsdf.inputs["Metallic"].default_value = 0.55
            bsdf.inputs["Roughness"].default_value = 0.34
        materials["MAT_Metal"] = mat
        completed.append("material.create:MAT_Metal")


        # op[7] material.create
        mat = bpy.data.materials.new(name="MAT_Wood")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.44, 0.25, 0.13, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_Wood"] = mat
        completed.append("material.create:MAT_Wood")


        # op[8] material.create
        mat = bpy.data.materials.new(name="MAT_Foliage")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.22, 0.46, 0.2, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_Foliage"] = mat
        completed.append("material.create:MAT_Foliage")


        # op[9] material.create
        mat = bpy.data.materials.new(name="MAT_AsphaltProp")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.1, 0.13, 0.18, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_AsphaltProp"] = mat
        completed.append("material.create:MAT_AsphaltProp")


        # op[10] material.create
        mat = bpy.data.materials.new(name="MAT_Light")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (1, 0.77, 0.32, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_Light"] = mat
        completed.append("material.create:MAT_Light")


        # op[11] material.create
        mat = bpy.data.materials.new(name="MAT_Glass")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.25, 0.62, 0.72, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_Glass"] = mat
        completed.append("material.create:MAT_Glass")


        # op[12] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.7, -14.8, 1.55))
        obj = bpy.context.active_object
        obj.name = "shop_left__body"
        obj.scale = (4.6, 2.5, 3)
        objects["shop_left__body"] = obj
        completed.append("mesh.create_primitive:shop_left__body")


        # op[13] material.assign
        obj = objects.get("shop_left__body") or bpy.data.objects.get("shop_left__body")
        mat = materials.get("MAT_BuildingTeal") or bpy.data.materials.get("MAT_BuildingTeal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:shop_left__body")


        # op[14] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.7, -14.8, 3.2))
        obj = bpy.context.active_object
        obj.name = "shop_left__roof"
        obj.scale = (4.9, 2.75, 0.24)
        objects["shop_left__roof"] = obj
        completed.append("mesh.create_primitive:shop_left__roof")


        # op[15] material.assign
        obj = objects.get("shop_left__roof") or bpy.data.objects.get("shop_left__roof")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:shop_left__roof")


        # op[16] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.7, -13.510000000000002, 0.84))
        obj = bpy.context.active_object
        obj.name = "shop_left__door"
        obj.scale = (0.62, 0.08, 1.65)
        objects["shop_left__door"] = obj
        completed.append("mesh.create_primitive:shop_left__door")


        # op[17] material.assign
        obj = objects.get("shop_left__door") or bpy.data.objects.get("shop_left__door")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:shop_left__door")


        # op[18] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.5, -13.5, 2))
        obj = bpy.context.active_object
        obj.name = "shop_left__window_l"
        obj.scale = (0.82, 0.09, 0.7)
        objects["shop_left__window_l"] = obj
        completed.append("mesh.create_primitive:shop_left__window_l")


        # op[19] material.assign
        obj = objects.get("shop_left__window_l") or bpy.data.objects.get("shop_left__window_l")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:shop_left__window_l")


        # op[20] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(1.9, -13.5, 2))
        obj = bpy.context.active_object
        obj.name = "shop_left__window_r"
        obj.scale = (0.82, 0.09, 0.7)
        objects["shop_left__window_r"] = obj
        completed.append("mesh.create_primitive:shop_left__window_r")


        # op[21] material.assign
        obj = objects.get("shop_left__window_r") or bpy.data.objects.get("shop_left__window_r")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:shop_left__window_r")


        # op[22] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.7, -13.18, 2.75))
        obj = bpy.context.active_object
        obj.name = "shop_left__awning"
        obj.scale = (2.9, 0.72, 0.18)
        objects["shop_left__awning"] = obj
        completed.append("mesh.create_primitive:shop_left__awning")


        # op[23] material.assign
        obj = objects.get("shop_left__awning") or bpy.data.objects.get("shop_left__awning")
        mat = materials.get("MAT_BuildingCoral") or bpy.data.materials.get("MAT_BuildingCoral")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:shop_left__awning")


        # op[24] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.7, -13.46, 3.45))
        obj = bpy.context.active_object
        obj.name = "shop_left__sign"
        obj.scale = (2, 0.12, 0.48)
        objects["shop_left__sign"] = obj
        completed.append("mesh.create_primitive:shop_left__sign")


        # op[25] material.assign
        obj = objects.get("shop_left__sign") or bpy.data.objects.get("shop_left__sign")
        mat = materials.get("MAT_Light") or bpy.data.materials.get("MAT_Light")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:shop_left__sign")


        # op[26] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.8, -6.6, 1.55))
        obj = bpy.context.active_object
        obj.name = "house_left__body"
        obj.scale = (4.6, 2.5, 3)
        objects["house_left__body"] = obj
        completed.append("mesh.create_primitive:house_left__body")


        # op[27] material.assign
        obj = objects.get("house_left__body") or bpy.data.objects.get("house_left__body")
        mat = materials.get("MAT_BuildingCoral") or bpy.data.materials.get("MAT_BuildingCoral")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:house_left__body")


        # op[28] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.8, -6.6, 3.2))
        obj = bpy.context.active_object
        obj.name = "house_left__roof"
        obj.scale = (4.9, 2.75, 0.24)
        objects["house_left__roof"] = obj
        completed.append("mesh.create_primitive:house_left__roof")


        # op[29] material.assign
        obj = objects.get("house_left__roof") or bpy.data.objects.get("house_left__roof")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:house_left__roof")


        # op[30] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.8, -5.31, 0.84))
        obj = bpy.context.active_object
        obj.name = "house_left__door"
        obj.scale = (0.62, 0.08, 1.65)
        objects["house_left__door"] = obj
        completed.append("mesh.create_primitive:house_left__door")


        # op[31] material.assign
        obj = objects.get("house_left__door") or bpy.data.objects.get("house_left__door")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:house_left__door")


        # op[32] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.3999999999999999, -5.3, 2))
        obj = bpy.context.active_object
        obj.name = "house_left__window_l"
        obj.scale = (0.82, 0.09, 0.7)
        objects["house_left__window_l"] = obj
        completed.append("mesh.create_primitive:house_left__window_l")


        # op[33] material.assign
        obj = objects.get("house_left__window_l") or bpy.data.objects.get("house_left__window_l")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:house_left__window_l")


        # op[34] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(2, -5.3, 2))
        obj = bpy.context.active_object
        obj.name = "house_left__window_r"
        obj.scale = (0.82, 0.09, 0.7)
        objects["house_left__window_r"] = obj
        completed.append("mesh.create_primitive:house_left__window_r")


        # op[35] material.assign
        obj = objects.get("house_left__window_r") or bpy.data.objects.get("house_left__window_r")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:house_left__window_r")


        # op[36] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28, -15.2, 1.55))
        obj = bpy.context.active_object
        obj.name = "shop_right__body"
        obj.scale = (4.6, 2.5, 3)
        objects["shop_right__body"] = obj
        completed.append("mesh.create_primitive:shop_right__body")


        # op[37] material.assign
        obj = objects.get("shop_right__body") or bpy.data.objects.get("shop_right__body")
        mat = materials.get("MAT_BuildingTeal") or bpy.data.materials.get("MAT_BuildingTeal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:shop_right__body")


        # op[38] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28, -15.2, 3.2))
        obj = bpy.context.active_object
        obj.name = "shop_right__roof"
        obj.scale = (4.9, 2.75, 0.24)
        objects["shop_right__roof"] = obj
        completed.append("mesh.create_primitive:shop_right__roof")


        # op[39] material.assign
        obj = objects.get("shop_right__roof") or bpy.data.objects.get("shop_right__roof")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:shop_right__roof")


        # op[40] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28, -13.91, 0.84))
        obj = bpy.context.active_object
        obj.name = "shop_right__door"
        obj.scale = (0.62, 0.08, 1.65)
        objects["shop_right__door"] = obj
        completed.append("mesh.create_primitive:shop_right__door")


        # op[41] material.assign
        obj = objects.get("shop_right__door") or bpy.data.objects.get("shop_right__door")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:shop_right__door")


        # op[42] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.8, -13.899999999999999, 2))
        obj = bpy.context.active_object
        obj.name = "shop_right__window_l"
        obj.scale = (0.82, 0.09, 0.7)
        objects["shop_right__window_l"] = obj
        completed.append("mesh.create_primitive:shop_right__window_l")


        # op[43] material.assign
        obj = objects.get("shop_right__window_l") or bpy.data.objects.get("shop_right__window_l")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:shop_right__window_l")


        # op[44] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(29.2, -13.899999999999999, 2))
        obj = bpy.context.active_object
        obj.name = "shop_right__window_r"
        obj.scale = (0.82, 0.09, 0.7)
        objects["shop_right__window_r"] = obj
        completed.append("mesh.create_primitive:shop_right__window_r")


        # op[45] material.assign
        obj = objects.get("shop_right__window_r") or bpy.data.objects.get("shop_right__window_r")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:shop_right__window_r")


        # op[46] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28, -13.579999999999998, 2.75))
        obj = bpy.context.active_object
        obj.name = "shop_right__awning"
        obj.scale = (2.9, 0.72, 0.18)
        objects["shop_right__awning"] = obj
        completed.append("mesh.create_primitive:shop_right__awning")


        # op[47] material.assign
        obj = objects.get("shop_right__awning") or bpy.data.objects.get("shop_right__awning")
        mat = materials.get("MAT_BuildingCoral") or bpy.data.materials.get("MAT_BuildingCoral")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:shop_right__awning")


        # op[48] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28, -13.86, 3.45))
        obj = bpy.context.active_object
        obj.name = "shop_right__sign"
        obj.scale = (2, 0.12, 0.48)
        objects["shop_right__sign"] = obj
        completed.append("mesh.create_primitive:shop_right__sign")


        # op[49] material.assign
        obj = objects.get("shop_right__sign") or bpy.data.objects.get("shop_right__sign")
        mat = materials.get("MAT_Light") or bpy.data.materials.get("MAT_Light")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:shop_right__sign")


        # op[50] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.1, -8, 1.55))
        obj = bpy.context.active_object
        obj.name = "house_right__body"
        obj.scale = (4.6, 2.5, 3)
        objects["house_right__body"] = obj
        completed.append("mesh.create_primitive:house_right__body")


        # op[51] material.assign
        obj = objects.get("house_right__body") or bpy.data.objects.get("house_right__body")
        mat = materials.get("MAT_BuildingCoral") or bpy.data.materials.get("MAT_BuildingCoral")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:house_right__body")


        # op[52] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.1, -8, 3.2))
        obj = bpy.context.active_object
        obj.name = "house_right__roof"
        obj.scale = (4.9, 2.75, 0.24)
        objects["house_right__roof"] = obj
        completed.append("mesh.create_primitive:house_right__roof")


        # op[53] material.assign
        obj = objects.get("house_right__roof") or bpy.data.objects.get("house_right__roof")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:house_right__roof")


        # op[54] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.1, -6.71, 0.84))
        obj = bpy.context.active_object
        obj.name = "house_right__door"
        obj.scale = (0.62, 0.08, 1.65)
        objects["house_right__door"] = obj
        completed.append("mesh.create_primitive:house_right__door")


        # op[55] material.assign
        obj = objects.get("house_right__door") or bpy.data.objects.get("house_right__door")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:house_right__door")


        # op[56] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.900000000000002, -6.7, 2))
        obj = bpy.context.active_object
        obj.name = "house_right__window_l"
        obj.scale = (0.82, 0.09, 0.7)
        objects["house_right__window_l"] = obj
        completed.append("mesh.create_primitive:house_right__window_l")


        # op[57] material.assign
        obj = objects.get("house_right__window_l") or bpy.data.objects.get("house_right__window_l")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:house_right__window_l")


        # op[58] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(29.3, -6.7, 2))
        obj = bpy.context.active_object
        obj.name = "house_right__window_r"
        obj.scale = (0.82, 0.09, 0.7)
        objects["house_right__window_r"] = obj
        completed.append("mesh.create_primitive:house_right__window_r")


        # op[59] material.assign
        obj = objects.get("house_right__window_r") or bpy.data.objects.get("house_right__window_r")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:house_right__window_r")


        # op[60] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(2.45, -8.6, 0.5))
        obj = bpy.context.active_object
        obj.name = "bench_left__seat"
        obj.scale = (1.4, 0.42, 0.12)
        objects["bench_left__seat"] = obj
        completed.append("mesh.create_primitive:bench_left__seat")


        # op[61] material.assign
        obj = objects.get("bench_left__seat") or bpy.data.objects.get("bench_left__seat")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:bench_left__seat")


        # op[62] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(2.45, -8.75, 0.82))
        obj = bpy.context.active_object
        obj.name = "bench_left__back"
        obj.scale = (1.4, 0.12, 0.52)
        objects["bench_left__back"] = obj
        completed.append("mesh.create_primitive:bench_left__back")


        # op[63] material.assign
        obj = objects.get("bench_left__back") or bpy.data.objects.get("bench_left__back")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:bench_left__back")


        # op[64] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.48, location=(1.9100000000000001, -8.6, 0.25))
        obj = bpy.context.active_object
        obj.name = "bench_left__leg_l"
        obj.scale = (0.045, 0.045, 0.48)
        objects["bench_left__leg_l"] = obj
        completed.append("mesh.create_primitive:bench_left__leg_l")


        # op[65] material.assign
        obj = objects.get("bench_left__leg_l") or bpy.data.objects.get("bench_left__leg_l")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:bench_left__leg_l")


        # op[66] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.48, location=(2.99, -8.6, 0.25))
        obj = bpy.context.active_object
        obj.name = "bench_left__leg_r"
        obj.scale = (0.045, 0.045, 0.48)
        objects["bench_left__leg_r"] = obj
        completed.append("mesh.create_primitive:bench_left__leg_r")


        # op[67] material.assign
        obj = objects.get("bench_left__leg_r") or bpy.data.objects.get("bench_left__leg_r")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:bench_left__leg_r")


        # op[68] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.2, -6.8, 0.5))
        obj = bpy.context.active_object
        obj.name = "bench_right__seat"
        obj.scale = (1.4, 0.42, 0.12)
        objects["bench_right__seat"] = obj
        completed.append("mesh.create_primitive:bench_right__seat")


        # op[69] material.assign
        obj = objects.get("bench_right__seat") or bpy.data.objects.get("bench_right__seat")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:bench_right__seat")


        # op[70] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.2, -6.95, 0.82))
        obj = bpy.context.active_object
        obj.name = "bench_right__back"
        obj.scale = (1.4, 0.12, 0.52)
        objects["bench_right__back"] = obj
        completed.append("mesh.create_primitive:bench_right__back")


        # op[71] material.assign
        obj = objects.get("bench_right__back") or bpy.data.objects.get("bench_right__back")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:bench_right__back")


        # op[72] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.48, location=(25.66, -6.8, 0.25))
        obj = bpy.context.active_object
        obj.name = "bench_right__leg_l"
        obj.scale = (0.045, 0.045, 0.48)
        objects["bench_right__leg_l"] = obj
        completed.append("mesh.create_primitive:bench_right__leg_l")


        # op[73] material.assign
        obj = objects.get("bench_right__leg_l") or bpy.data.objects.get("bench_right__leg_l")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:bench_right__leg_l")


        # op[74] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.48, location=(26.74, -6.8, 0.25))
        obj = bpy.context.active_object
        obj.name = "bench_right__leg_r"
        obj.scale = (0.045, 0.045, 0.48)
        objects["bench_right__leg_r"] = obj
        completed.append("mesh.create_primitive:bench_right__leg_r")


        # op[75] material.assign
        obj = objects.get("bench_right__leg_r") or bpy.data.objects.get("bench_right__leg_r")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:bench_right__leg_r")


        # op[76] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=4.3, location=(2.95, -4.4, 2.15))
        obj = bpy.context.active_object
        obj.name = "lamp_left_near__pole"
        obj.scale = (0.07, 0.07, 4.3)
        objects["lamp_left_near__pole"] = obj
        completed.append("mesh.create_primitive:lamp_left_near__pole")


        # op[77] material.assign
        obj = objects.get("lamp_left_near__pole") or bpy.data.objects.get("lamp_left_near__pole")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:lamp_left_near__pole")


        # op[78] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(3.3000000000000003, -4.4, 4.15))
        obj = bpy.context.active_object
        obj.name = "lamp_left_near__arm"
        obj.scale = (0.85, 0.08, 0.08)
        objects["lamp_left_near__arm"] = obj
        completed.append("mesh.create_primitive:lamp_left_near__arm")


        # op[79] material.assign
        obj = objects.get("lamp_left_near__arm") or bpy.data.objects.get("lamp_left_near__arm")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:lamp_left_near__arm")


        # op[80] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(3.6300000000000003, -4.4, 4.08))
        obj = bpy.context.active_object
        obj.name = "lamp_left_near__lamp"
        obj.scale = (0.42, 0.3, 0.16)
        objects["lamp_left_near__lamp"] = obj
        completed.append("mesh.create_primitive:lamp_left_near__lamp")


        # op[81] material.assign
        obj = objects.get("lamp_left_near__lamp") or bpy.data.objects.get("lamp_left_near__lamp")
        mat = materials.get("MAT_Light") or bpy.data.materials.get("MAT_Light")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:lamp_left_near__lamp")


        # op[82] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=4.3, location=(2.95, -12.6, 2.15))
        obj = bpy.context.active_object
        obj.name = "lamp_left_far__pole"
        obj.scale = (0.07, 0.07, 4.3)
        objects["lamp_left_far__pole"] = obj
        completed.append("mesh.create_primitive:lamp_left_far__pole")


        # op[83] material.assign
        obj = objects.get("lamp_left_far__pole") or bpy.data.objects.get("lamp_left_far__pole")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:lamp_left_far__pole")


        # op[84] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(3.3000000000000003, -12.6, 4.15))
        obj = bpy.context.active_object
        obj.name = "lamp_left_far__arm"
        obj.scale = (0.85, 0.08, 0.08)
        objects["lamp_left_far__arm"] = obj
        completed.append("mesh.create_primitive:lamp_left_far__arm")


        # op[85] material.assign
        obj = objects.get("lamp_left_far__arm") or bpy.data.objects.get("lamp_left_far__arm")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:lamp_left_far__arm")


        # op[86] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(3.6300000000000003, -12.6, 4.08))
        obj = bpy.context.active_object
        obj.name = "lamp_left_far__lamp"
        obj.scale = (0.42, 0.3, 0.16)
        objects["lamp_left_far__lamp"] = obj
        completed.append("mesh.create_primitive:lamp_left_far__lamp")


        # op[87] material.assign
        obj = objects.get("lamp_left_far__lamp") or bpy.data.objects.get("lamp_left_far__lamp")
        mat = materials.get("MAT_Light") or bpy.data.materials.get("MAT_Light")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:lamp_left_far__lamp")


        # op[88] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=4.3, location=(25.9, -4.8, 2.15))
        obj = bpy.context.active_object
        obj.name = "lamp_right_near__pole"
        obj.scale = (0.07, 0.07, 4.3)
        objects["lamp_right_near__pole"] = obj
        completed.append("mesh.create_primitive:lamp_right_near__pole")


        # op[89] material.assign
        obj = objects.get("lamp_right_near__pole") or bpy.data.objects.get("lamp_right_near__pole")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:lamp_right_near__pole")


        # op[90] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.25, -4.8, 4.15))
        obj = bpy.context.active_object
        obj.name = "lamp_right_near__arm"
        obj.scale = (0.85, 0.08, 0.08)
        objects["lamp_right_near__arm"] = obj
        completed.append("mesh.create_primitive:lamp_right_near__arm")


        # op[91] material.assign
        obj = objects.get("lamp_right_near__arm") or bpy.data.objects.get("lamp_right_near__arm")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:lamp_right_near__arm")


        # op[92] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.58, -4.8, 4.08))
        obj = bpy.context.active_object
        obj.name = "lamp_right_near__lamp"
        obj.scale = (0.42, 0.3, 0.16)
        objects["lamp_right_near__lamp"] = obj
        completed.append("mesh.create_primitive:lamp_right_near__lamp")


        # op[93] material.assign
        obj = objects.get("lamp_right_near__lamp") or bpy.data.objects.get("lamp_right_near__lamp")
        mat = materials.get("MAT_Light") or bpy.data.materials.get("MAT_Light")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:lamp_right_near__lamp")


        # op[94] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=4.3, location=(25.9, -12, 2.15))
        obj = bpy.context.active_object
        obj.name = "lamp_right_far__pole"
        obj.scale = (0.07, 0.07, 4.3)
        objects["lamp_right_far__pole"] = obj
        completed.append("mesh.create_primitive:lamp_right_far__pole")


        # op[95] material.assign
        obj = objects.get("lamp_right_far__pole") or bpy.data.objects.get("lamp_right_far__pole")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:lamp_right_far__pole")


        # op[96] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.25, -12, 4.15))
        obj = bpy.context.active_object
        obj.name = "lamp_right_far__arm"
        obj.scale = (0.85, 0.08, 0.08)
        objects["lamp_right_far__arm"] = obj
        completed.append("mesh.create_primitive:lamp_right_far__arm")


        # op[97] material.assign
        obj = objects.get("lamp_right_far__arm") or bpy.data.objects.get("lamp_right_far__arm")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:lamp_right_far__arm")


        # op[98] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.58, -12, 4.08))
        obj = bpy.context.active_object
        obj.name = "lamp_right_far__lamp"
        obj.scale = (0.42, 0.3, 0.16)
        objects["lamp_right_far__lamp"] = obj
        completed.append("mesh.create_primitive:lamp_right_far__lamp")


        # op[99] material.assign
        obj = objects.get("lamp_right_far__lamp") or bpy.data.objects.get("lamp_right_far__lamp")
        mat = materials.get("MAT_Light") or bpy.data.materials.get("MAT_Light")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:lamp_right_far__lamp")


        # op[100] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(2, -3, 0.52))
        obj = bpy.context.active_object
        obj.name = "car_left_blue__chassis"
        obj.scale = (1.72, 3.1, 0.48)
        objects["car_left_blue__chassis"] = obj
        completed.append("mesh.create_primitive:car_left_blue__chassis")


        # op[101] mesh.transform
        obj = objects.get("car_left_blue__chassis") or bpy.data.objects.get("car_left_blue__chassis")
        if obj is None:
            raise RuntimeError("mesh.transform missing target car_left_blue__chassis")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 4))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:car_left_blue__chassis")


        # op[102] material.assign
        obj = objects.get("car_left_blue__chassis") or bpy.data.objects.get("car_left_blue__chassis")
        mat = materials.get("MAT_BuildingTeal") or bpy.data.materials.get("MAT_BuildingTeal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:car_left_blue__chassis")


        # op[103] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(1.99441948210047, -3.079805124020786, 1.02))
        obj = bpy.context.active_object
        obj.name = "car_left_blue__cabin"
        obj.scale = (1.35, 1.6, 0.62)
        objects["car_left_blue__cabin"] = obj
        completed.append("mesh.create_primitive:car_left_blue__cabin")


        # op[104] mesh.transform
        obj = objects.get("car_left_blue__cabin") or bpy.data.objects.get("car_left_blue__cabin")
        if obj is None:
            raise RuntimeError("mesh.transform missing target car_left_blue__cabin")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 4))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:car_left_blue__cabin")


        # op[105] material.assign
        obj = objects.get("car_left_blue__cabin") or bpy.data.objects.get("car_left_blue__cabin")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:car_left_blue__cabin")


        # op[106] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(1.250358823056187, -1.9651869222751897, 0.3))
        obj = bpy.context.active_object
        obj.name = "car_left_blue__wheel_0_l"
        obj.scale = (0.25, 0.25, 0.16)
        objects["car_left_blue__wheel_0_l"] = obj
        completed.append("mesh.create_primitive:car_left_blue__wheel_0_l")


        # op[107] mesh.transform
        obj = objects.get("car_left_blue__wheel_0_l") or bpy.data.objects.get("car_left_blue__wheel_0_l")
        if obj is None:
            raise RuntimeError("mesh.transform missing target car_left_blue__wheel_0_l")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 4))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:car_left_blue__wheel_0_l")


        # op[108] material.assign
        obj = objects.get("car_left_blue__wheel_0_l") or bpy.data.objects.get("car_left_blue__wheel_0_l")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:car_left_blue__wheel_0_l")


        # op[109] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(2.8863638654822985, -2.079587539215555, 0.3))
        obj = bpy.context.active_object
        obj.name = "car_left_blue__wheel_0_r"
        obj.scale = (0.25, 0.25, 0.16)
        objects["car_left_blue__wheel_0_r"] = obj
        completed.append("mesh.create_primitive:car_left_blue__wheel_0_r")


        # op[110] mesh.transform
        obj = objects.get("car_left_blue__wheel_0_r") or bpy.data.objects.get("car_left_blue__wheel_0_r")
        if obj is None:
            raise RuntimeError("mesh.transform missing target car_left_blue__wheel_0_r")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 4))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:car_left_blue__wheel_0_r")


        # op[111] material.assign
        obj = objects.get("car_left_blue__wheel_0_r") or bpy.data.objects.get("car_left_blue__wheel_0_r")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:car_left_blue__wheel_0_r")


        # op[112] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(1.1136361345177015, -3.920412460784445, 0.3))
        obj = bpy.context.active_object
        obj.name = "car_left_blue__wheel_1_l"
        obj.scale = (0.25, 0.25, 0.16)
        objects["car_left_blue__wheel_1_l"] = obj
        completed.append("mesh.create_primitive:car_left_blue__wheel_1_l")


        # op[113] mesh.transform
        obj = objects.get("car_left_blue__wheel_1_l") or bpy.data.objects.get("car_left_blue__wheel_1_l")
        if obj is None:
            raise RuntimeError("mesh.transform missing target car_left_blue__wheel_1_l")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 4))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:car_left_blue__wheel_1_l")


        # op[114] material.assign
        obj = objects.get("car_left_blue__wheel_1_l") or bpy.data.objects.get("car_left_blue__wheel_1_l")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:car_left_blue__wheel_1_l")


        # op[115] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(2.749641176943813, -4.03481307772481, 0.3))
        obj = bpy.context.active_object
        obj.name = "car_left_blue__wheel_1_r"
        obj.scale = (0.25, 0.25, 0.16)
        objects["car_left_blue__wheel_1_r"] = obj
        completed.append("mesh.create_primitive:car_left_blue__wheel_1_r")


        # op[116] mesh.transform
        obj = objects.get("car_left_blue__wheel_1_r") or bpy.data.objects.get("car_left_blue__wheel_1_r")
        if obj is None:
            raise RuntimeError("mesh.transform missing target car_left_blue__wheel_1_r")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 4))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:car_left_blue__wheel_1_r")


        # op[117] material.assign
        obj = objects.get("car_left_blue__wheel_1_r") or bpy.data.objects.get("car_left_blue__wheel_1_r")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:car_left_blue__wheel_1_r")


        # op[118] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.8, -10.3, 0.52))
        obj = bpy.context.active_object
        obj.name = "car_right_coral__chassis"
        obj.scale = (1.72, 3.1, 0.48)
        objects["car_right_coral__chassis"] = obj
        completed.append("mesh.create_primitive:car_right_coral__chassis")


        # op[119] mesh.transform
        obj = objects.get("car_right_coral__chassis") or bpy.data.objects.get("car_right_coral__chassis")
        if obj is None:
            raise RuntimeError("mesh.transform missing target car_right_coral__chassis")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 178))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:car_right_coral__chassis")


        # op[120] material.assign
        obj = objects.get("car_right_coral__chassis") or bpy.data.objects.get("car_right_coral__chassis")
        mat = materials.get("MAT_BuildingCoral") or bpy.data.materials.get("MAT_BuildingCoral")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:car_right_coral__chassis")


        # op[121] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.7972080402638, -10.220048733838473, 1.02))
        obj = bpy.context.active_object
        obj.name = "car_right_coral__cabin"
        obj.scale = (1.35, 1.6, 0.62)
        objects["car_right_coral__cabin"] = obj
        completed.append("mesh.create_primitive:car_right_coral__cabin")


        # op[122] mesh.transform
        obj = objects.get("car_right_coral__cabin") or bpy.data.objects.get("car_right_coral__cabin")
        if obj is None:
            raise RuntimeError("mesh.transform missing target car_right_coral__cabin")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 178))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:car_right_coral__cabin")


        # op[123] material.assign
        obj = objects.get("car_right_coral__cabin") or bpy.data.objects.get("car_right_coral__cabin")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:car_right_coral__cabin")


        # op[124] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(27.65370198492411, -11.250785423182665, 0.3))
        obj = bpy.context.active_object
        obj.name = "car_right_coral__wheel_0_l"
        obj.scale = (0.25, 0.25, 0.16)
        objects["car_right_coral__wheel_0_l"] = obj
        completed.append("mesh.create_primitive:car_right_coral__wheel_0_l")


        # op[125] mesh.transform
        obj = objects.get("car_right_coral__wheel_0_l") or bpy.data.objects.get("car_right_coral__wheel_0_l")
        if obj is None:
            raise RuntimeError("mesh.transform missing target car_right_coral__wheel_0_l")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 178))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:car_right_coral__wheel_0_l")


        # op[126] material.assign
        obj = objects.get("car_right_coral__wheel_0_l") or bpy.data.objects.get("car_right_coral__wheel_0_l")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:car_right_coral__wheel_0_l")


        # op[127] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(26.014701028612794, -11.308020597774766, 0.3))
        obj = bpy.context.active_object
        obj.name = "car_right_coral__wheel_0_r"
        obj.scale = (0.25, 0.25, 0.16)
        objects["car_right_coral__wheel_0_r"] = obj
        completed.append("mesh.create_primitive:car_right_coral__wheel_0_r")


        # op[128] mesh.transform
        obj = objects.get("car_right_coral__wheel_0_r") or bpy.data.objects.get("car_right_coral__wheel_0_r")
        if obj is None:
            raise RuntimeError("mesh.transform missing target car_right_coral__wheel_0_r")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 178))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:car_right_coral__wheel_0_r")


        # op[129] material.assign
        obj = objects.get("car_right_coral__wheel_0_r") or bpy.data.objects.get("car_right_coral__wheel_0_r")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:car_right_coral__wheel_0_r")


        # op[130] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(27.585298971387207, -9.291979402225236, 0.3))
        obj = bpy.context.active_object
        obj.name = "car_right_coral__wheel_1_l"
        obj.scale = (0.25, 0.25, 0.16)
        objects["car_right_coral__wheel_1_l"] = obj
        completed.append("mesh.create_primitive:car_right_coral__wheel_1_l")


        # op[131] mesh.transform
        obj = objects.get("car_right_coral__wheel_1_l") or bpy.data.objects.get("car_right_coral__wheel_1_l")
        if obj is None:
            raise RuntimeError("mesh.transform missing target car_right_coral__wheel_1_l")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 178))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:car_right_coral__wheel_1_l")


        # op[132] material.assign
        obj = objects.get("car_right_coral__wheel_1_l") or bpy.data.objects.get("car_right_coral__wheel_1_l")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:car_right_coral__wheel_1_l")


        # op[133] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.16, location=(25.946298015075893, -9.349214576817337, 0.3))
        obj = bpy.context.active_object
        obj.name = "car_right_coral__wheel_1_r"
        obj.scale = (0.25, 0.25, 0.16)
        objects["car_right_coral__wheel_1_r"] = obj
        completed.append("mesh.create_primitive:car_right_coral__wheel_1_r")


        # op[134] mesh.transform
        obj = objects.get("car_right_coral__wheel_1_r") or bpy.data.objects.get("car_right_coral__wheel_1_r")
        if obj is None:
            raise RuntimeError("mesh.transform missing target car_right_coral__wheel_1_r")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 90, 178))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:car_right_coral__wheel_1_r")


        # op[135] material.assign
        obj = objects.get("car_right_coral__wheel_1_r") or bpy.data.objects.get("car_right_coral__wheel_1_r")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:car_right_coral__wheel_1_r")


        # op[136] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.19, depth=2.8, location=(2.6, -17.3, 1.4))
        obj = bpy.context.active_object
        obj.name = "palm_left__trunk"
        obj.scale = (0.19, 0.19, 2.8)
        objects["palm_left__trunk"] = obj
        completed.append("mesh.create_primitive:palm_left__trunk")


        # op[137] material.assign
        obj = objects.get("palm_left__trunk") or bpy.data.objects.get("palm_left__trunk")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:palm_left__trunk")


        # op[138] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(2.6, -17.3, 3))
        obj = bpy.context.active_object
        obj.name = "palm_left__crown_a"
        obj.scale = (1.55, 1.45, 1.1)
        objects["palm_left__crown_a"] = obj
        completed.append("mesh.create_primitive:palm_left__crown_a")


        # op[139] material.assign
        obj = objects.get("palm_left__crown_a") or bpy.data.objects.get("palm_left__crown_a")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:palm_left__crown_a")


        # op[140] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(1.98, -17.330000000000002, 3.52))
        obj = bpy.context.active_object
        obj.name = "palm_left__crown_b"
        obj.scale = (1.05, 1, 0.8)
        objects["palm_left__crown_b"] = obj
        completed.append("mesh.create_primitive:palm_left__crown_b")


        # op[141] material.assign
        obj = objects.get("palm_left__crown_b") or bpy.data.objects.get("palm_left__crown_b")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:palm_left__crown_b")


        # op[142] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.19, depth=2.8, location=(26.2, -17, 1.4))
        obj = bpy.context.active_object
        obj.name = "palm_right__trunk"
        obj.scale = (0.19, 0.19, 2.8)
        objects["palm_right__trunk"] = obj
        completed.append("mesh.create_primitive:palm_right__trunk")


        # op[143] material.assign
        obj = objects.get("palm_right__trunk") or bpy.data.objects.get("palm_right__trunk")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:palm_right__trunk")


        # op[144] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(26.2, -17, 3))
        obj = bpy.context.active_object
        obj.name = "palm_right__crown_a"
        obj.scale = (1.55, 1.45, 1.1)
        objects["palm_right__crown_a"] = obj
        completed.append("mesh.create_primitive:palm_right__crown_a")


        # op[145] material.assign
        obj = objects.get("palm_right__crown_a") or bpy.data.objects.get("palm_right__crown_a")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:palm_right__crown_a")


        # op[146] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(25.58, -17.03, 3.52))
        obj = bpy.context.active_object
        obj.name = "palm_right__crown_b"
        obj.scale = (1.05, 1, 0.8)
        objects["palm_right__crown_b"] = obj
        completed.append("mesh.create_primitive:palm_right__crown_b")


        # op[147] material.assign
        obj = objects.get("palm_right__crown_b") or bpy.data.objects.get("palm_right__crown_b")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:palm_right__crown_b")


        # op[148] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(2.4, -11, 0.26))
        obj = bpy.context.active_object
        obj.name = "planter_left__pot"
        obj.scale = (0.78, 0.68, 0.5)
        objects["planter_left__pot"] = obj
        completed.append("mesh.create_primitive:planter_left__pot")


        # op[149] material.assign
        obj = objects.get("planter_left__pot") or bpy.data.objects.get("planter_left__pot")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:planter_left__pot")


        # op[150] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(2.4, -11, 0.78))
        obj = bpy.context.active_object
        obj.name = "planter_left__plant"
        obj.scale = (0.7, 0.62, 0.65)
        objects["planter_left__plant"] = obj
        completed.append("mesh.create_primitive:planter_left__plant")


        # op[151] material.assign
        obj = objects.get("planter_left__plant") or bpy.data.objects.get("planter_left__plant")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:planter_left__plant")


        # op[152] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(25.8, -8.1, 0.45))
        obj = bpy.context.active_object
        obj.name = "bin_right__body"
        obj.scale = (0.52, 0.55, 0.85)
        objects["bin_right__body"] = obj
        completed.append("mesh.create_primitive:bin_right__body")


        # op[153] material.assign
        obj = objects.get("bin_right__body") or bpy.data.objects.get("bin_right__body")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:bin_right__body")


        # op[154] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(25.8, -8.1, 0.92))
        obj = bpy.context.active_object
        obj.name = "bin_right__lid"
        obj.scale = (0.62, 0.64, 0.12)
        objects["bin_right__lid"] = obj
        completed.append("mesh.create_primitive:bin_right__lid")


        # op[155] material.assign
        obj = objects.get("bin_right__lid") or bpy.data.objects.get("bin_right__lid")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:bin_right__lid")


        # op[156] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.39999999999999997, -0.5, 0.43))
        obj = bpy.context.active_object
        obj.name = "fence_left__post_0"
        obj.scale = (0.08, 0.08, 0.85)
        objects["fence_left__post_0"] = obj
        completed.append("mesh.create_primitive:fence_left__post_0")


        # op[157] mesh.transform
        obj = objects.get("fence_left__post_0") or bpy.data.objects.get("fence_left__post_0")
        if obj is None:
            raise RuntimeError("mesh.transform missing target fence_left__post_0")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:fence_left__post_0")


        # op[158] material.assign
        obj = objects.get("fence_left__post_0") or bpy.data.objects.get("fence_left__post_0")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:fence_left__post_0")


        # op[159] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.39999999999999997, -1.1, 0.43))
        obj = bpy.context.active_object
        obj.name = "fence_left__post_1"
        obj.scale = (0.08, 0.08, 0.85)
        objects["fence_left__post_1"] = obj
        completed.append("mesh.create_primitive:fence_left__post_1")


        # op[160] mesh.transform
        obj = objects.get("fence_left__post_1") or bpy.data.objects.get("fence_left__post_1")
        if obj is None:
            raise RuntimeError("mesh.transform missing target fence_left__post_1")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:fence_left__post_1")


        # op[161] material.assign
        obj = objects.get("fence_left__post_1") or bpy.data.objects.get("fence_left__post_1")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:fence_left__post_1")


        # op[162] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.4, -1.7, 0.43))
        obj = bpy.context.active_object
        obj.name = "fence_left__post_2"
        obj.scale = (0.08, 0.08, 0.85)
        objects["fence_left__post_2"] = obj
        completed.append("mesh.create_primitive:fence_left__post_2")


        # op[163] mesh.transform
        obj = objects.get("fence_left__post_2") or bpy.data.objects.get("fence_left__post_2")
        if obj is None:
            raise RuntimeError("mesh.transform missing target fence_left__post_2")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:fence_left__post_2")


        # op[164] material.assign
        obj = objects.get("fence_left__post_2") or bpy.data.objects.get("fence_left__post_2")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:fence_left__post_2")


        # op[165] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.4000000000000001, -2.3, 0.43))
        obj = bpy.context.active_object
        obj.name = "fence_left__post_3"
        obj.scale = (0.08, 0.08, 0.85)
        objects["fence_left__post_3"] = obj
        completed.append("mesh.create_primitive:fence_left__post_3")


        # op[166] mesh.transform
        obj = objects.get("fence_left__post_3") or bpy.data.objects.get("fence_left__post_3")
        if obj is None:
            raise RuntimeError("mesh.transform missing target fence_left__post_3")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:fence_left__post_3")


        # op[167] material.assign
        obj = objects.get("fence_left__post_3") or bpy.data.objects.get("fence_left__post_3")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:fence_left__post_3")


        # op[168] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.4000000000000001, -2.9, 0.43))
        obj = bpy.context.active_object
        obj.name = "fence_left__post_4"
        obj.scale = (0.08, 0.08, 0.85)
        objects["fence_left__post_4"] = obj
        completed.append("mesh.create_primitive:fence_left__post_4")


        # op[169] mesh.transform
        obj = objects.get("fence_left__post_4") or bpy.data.objects.get("fence_left__post_4")
        if obj is None:
            raise RuntimeError("mesh.transform missing target fence_left__post_4")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:fence_left__post_4")


        # op[170] material.assign
        obj = objects.get("fence_left__post_4") or bpy.data.objects.get("fence_left__post_4")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:fence_left__post_4")


        # op[171] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.4, -1.7, 0.26))
        obj = bpy.context.active_object
        obj.name = "fence_left__rail_low"
        obj.scale = (2.5, 0.08, 0.09)
        objects["fence_left__rail_low"] = obj
        completed.append("mesh.create_primitive:fence_left__rail_low")


        # op[172] mesh.transform
        obj = objects.get("fence_left__rail_low") or bpy.data.objects.get("fence_left__rail_low")
        if obj is None:
            raise RuntimeError("mesh.transform missing target fence_left__rail_low")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:fence_left__rail_low")


        # op[173] material.assign
        obj = objects.get("fence_left__rail_low") or bpy.data.objects.get("fence_left__rail_low")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:fence_left__rail_low")


        # op[174] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.4, -1.7, 0.68))
        obj = bpy.context.active_object
        obj.name = "fence_left__rail_high"
        obj.scale = (2.5, 0.08, 0.09)
        objects["fence_left__rail_high"] = obj
        completed.append("mesh.create_primitive:fence_left__rail_high")


        # op[175] mesh.transform
        obj = objects.get("fence_left__rail_high") or bpy.data.objects.get("fence_left__rail_high")
        if obj is None:
            raise RuntimeError("mesh.transform missing target fence_left__rail_high")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:fence_left__rail_high")


        # op[176] material.assign
        obj = objects.get("fence_left__rail_high") or bpy.data.objects.get("fence_left__rail_high")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:fence_left__rail_high")


        # op[177] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=2.4, location=(25.5, -15.7, 1.2))
        obj = bpy.context.active_object
        obj.name = "street_sign_right__post"
        obj.scale = (0.045, 0.045, 2.4)
        objects["street_sign_right__post"] = obj
        completed.append("mesh.create_primitive:street_sign_right__post")


        # op[178] material.assign
        obj = objects.get("street_sign_right__post") or bpy.data.objects.get("street_sign_right__post")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:street_sign_right__post")


        # op[179] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(25.5, -15.7, 2.08))
        obj = bpy.context.active_object
        obj.name = "street_sign_right__board"
        obj.scale = (0.82, 0.14, 0.66)
        objects["street_sign_right__board"] = obj
        completed.append("mesh.create_primitive:street_sign_right__board")


        # op[180] material.assign
        obj = objects.get("street_sign_right__board") or bpy.data.objects.get("street_sign_right__board")
        mat = materials.get("MAT_BuildingCoral") or bpy.data.materials.get("MAT_BuildingCoral")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:street_sign_right__board")


        # op[181] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(2.4, -10, 0.07))
        obj = bpy.context.active_object
        obj.name = "sidewalk_left__strip"
        obj.scale = (1.6, 19, 0.14)
        objects["sidewalk_left__strip"] = obj
        completed.append("mesh.create_primitive:sidewalk_left__strip")


        # op[182] material.assign
        obj = objects.get("sidewalk_left__strip") or bpy.data.objects.get("sidewalk_left__strip")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:sidewalk_left__strip")


        # op[183] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.4, -10, 0.07))
        obj = bpy.context.active_object
        obj.name = "sidewalk_right__strip"
        obj.scale = (1.6, 19, 0.14)
        objects["sidewalk_right__strip"] = obj
        completed.append("mesh.create_primitive:sidewalk_right__strip")


        # op[184] material.assign
        obj = objects.get("sidewalk_right__strip") or bpy.data.objects.get("sidewalk_right__strip")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:sidewalk_right__strip")


        # op[185] light.create
        bpy.ops.object.light_add(type="SUN", location=(4, -4, 6))
        light = bpy.context.active_object
        light.name = "Preview_Sun"
        light.data.energy = 2
        light.rotation_euler = tuple(math.radians(v) for v in (28, 0, 24))
        objects[light.name] = light
        completed.append("light.create")


        # op[186] render.multi_view
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
        out_path = os.path.join(WORK_DIR, "yun_street_block_calle_v1-overview.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_calle_v1-overview.png"] = out_path
        previews.append(out_path)


        cam.location = (8.4, 3, 11.5)
        cam.data.lens = 50
        cam.rotation_euler = (Vector((2.4, -10, 1.5)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_calle_v1-left.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_calle_v1-left.png"] = out_path
        previews.append(out_path)


        cam.location = (20.4, 3, 11.5)
        cam.data.lens = 50
        cam.rotation_euler = (Vector((26.4, -10, 1.5)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_calle_v1-right.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_calle_v1-right.png"] = out_path
        previews.append(out_path)


        cam.location = (14.4, 17.2, 12.8)
        cam.data.lens = 24
        cam.rotation_euler = (Vector((14.4, -4.8, 1.8)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_calle_v1-yun_side.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_calle_v1-yun_side.png"] = out_path
        previews.append(out_path)


        cam.location = (14.4, -37.2, 12.8)
        cam.data.lens = 24
        cam.rotation_euler = (Vector((14.4, -15.2, 1.8)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_calle_v1-turn_side.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_calle_v1-turn_side.png"] = out_path
        previews.append(out_path)


        cam.location = (44.4, 32, 34.8)
        cam.data.lens = 50
        cam.rotation_euler = (Vector((14.4, -10, 1.8)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_calle_v1-gameplay.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_calle_v1-gameplay.png"] = out_path
        previews.append(out_path)

        completed.append("render.multi_view")


        # op[187] file.save_blend
        out_path = os.path.join(WORK_DIR, "yun_street_block_calle_v1.blend")
        assert_under_work(out_path)
        bpy.ops.wm.save_as_mainfile(filepath=out_path)
        artifacts["yun_street_block_calle_v1.blend"] = out_path
        completed.append("file.save_blend:yun_street_block_calle_v1.blend")


        # op[188] export.glb
        out_path = os.path.join(WORK_DIR, "yun_street_block_calle_v1.glb")
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
        artifacts["yun_street_block_calle_v1.glb"] = out_path
        completed.append("export.glb:yun_street_block_calle_v1.glb")

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
            "requestedOperations": ["scene.new","world.set_background","material.create","material.create","material.create","material.create","material.create","material.create","material.create","material.create","material.create","material.create","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","light.create","render.multi_view","file.save_blend","export.glb"],
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
        asset_report = os.path.join(WORK_DIR, "yun_street_block_calle_v1-report.json")
        assert_under_work(asset_report)
        with open(asset_report, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        artifacts["yun_street_block_calle_v1-report.json"] = asset_report
        print("Wrote asset report", asset_report)

if __name__ == "__main__":
    main()
