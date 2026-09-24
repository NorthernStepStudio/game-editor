import bpy
import math
import os
import json
from datetime import datetime, timezone
from mathutils import Vector

WORK_DIR = "C:/Users/winst/AppData/Local/Temp/matterhorn-yun-environment-set-yLSvrv/t-yun_street_block_parque_v1"
EXECUTION_ID = "50a78e7a-57a9-4b4a-bc21-50a504e0780d"
TASK_ID = "t-yun_street_block_parque_v1"
HANDOFF_ID = "h-yun_street_block_parque_v1"

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
        scene.name = "yun_street_block_parque_v1"
        completed.append("scene.new")


        # op[1] world.set_background
        if bpy.context.scene.world is None:
            bpy.context.scene.world = bpy.data.worlds.new('Matterhorn_Environment_Preview')
        world = bpy.context.scene.world
        world.use_nodes = True
        background = world.node_tree.nodes.get('Background')
        background.inputs['Color'].default_value = (0.46, 0.62, 0.48, 1)
        background.inputs['Strength'].default_value = 0.65
        completed.append("world.set_background")


        # op[2] material.create
        mat = bpy.data.materials.new(name="MAT_BuildingWarm")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.78, 0.72, 0.56, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_BuildingWarm"] = mat
        completed.append("material.create:MAT_BuildingWarm")


        # op[3] material.create
        mat = bpy.data.materials.new(name="MAT_BuildingCoral")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.72, 0.47, 0.31, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_BuildingCoral"] = mat
        completed.append("material.create:MAT_BuildingCoral")


        # op[4] material.create
        mat = bpy.data.materials.new(name="MAT_BuildingTeal")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.35, 0.58, 0.48, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_BuildingTeal"] = mat
        completed.append("material.create:MAT_BuildingTeal")


        # op[5] material.create
        mat = bpy.data.materials.new(name="MAT_Concrete")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.46, 0.5, 0.38, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_Concrete"] = mat
        completed.append("material.create:MAT_Concrete")


        # op[6] material.create
        mat = bpy.data.materials.new(name="MAT_Metal")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.18, 0.24, 0.2, 1)
            bsdf.inputs["Metallic"].default_value = 0.55
            bsdf.inputs["Roughness"].default_value = 0.34
        materials["MAT_Metal"] = mat
        completed.append("material.create:MAT_Metal")


        # op[7] material.create
        mat = bpy.data.materials.new(name="MAT_Wood")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.36, 0.24, 0.13, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_Wood"] = mat
        completed.append("material.create:MAT_Wood")


        # op[8] material.create
        mat = bpy.data.materials.new(name="MAT_Foliage")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.2, 0.5, 0.2, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_Foliage"] = mat
        completed.append("material.create:MAT_Foliage")


        # op[9] material.create
        mat = bpy.data.materials.new(name="MAT_AsphaltProp")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.14, 0.22, 0.16, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_AsphaltProp"] = mat
        completed.append("material.create:MAT_AsphaltProp")


        # op[10] material.create
        mat = bpy.data.materials.new(name="MAT_Light")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.92, 0.84, 0.48, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_Light"] = mat
        completed.append("material.create:MAT_Light")


        # op[11] material.create
        mat = bpy.data.materials.new(name="MAT_Glass")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.28, 0.54, 0.48, 1)
            bsdf.inputs["Metallic"].default_value = 0
            bsdf.inputs["Roughness"].default_value = 0.72
        materials["MAT_Glass"] = mat
        completed.append("material.create:MAT_Glass")


        # op[12] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.7, -4.8, 1.55))
        obj = bpy.context.active_object
        obj.name = "parque_house_left_a__body"
        obj.scale = (4.6, 2.5, 3)
        objects["parque_house_left_a__body"] = obj
        completed.append("mesh.create_primitive:parque_house_left_a__body")


        # op[13] material.assign
        obj = objects.get("parque_house_left_a__body") or bpy.data.objects.get("parque_house_left_a__body")
        mat = materials.get("MAT_BuildingWarm") or bpy.data.materials.get("MAT_BuildingWarm")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_left_a__body")


        # op[14] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.7, -4.8, 3.2))
        obj = bpy.context.active_object
        obj.name = "parque_house_left_a__roof"
        obj.scale = (4.9, 2.75, 0.24)
        objects["parque_house_left_a__roof"] = obj
        completed.append("mesh.create_primitive:parque_house_left_a__roof")


        # op[15] material.assign
        obj = objects.get("parque_house_left_a__roof") or bpy.data.objects.get("parque_house_left_a__roof")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_left_a__roof")


        # op[16] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.7, -3.51, 0.84))
        obj = bpy.context.active_object
        obj.name = "parque_house_left_a__door"
        obj.scale = (0.62, 0.08, 1.65)
        objects["parque_house_left_a__door"] = obj
        completed.append("mesh.create_primitive:parque_house_left_a__door")


        # op[17] material.assign
        obj = objects.get("parque_house_left_a__door") or bpy.data.objects.get("parque_house_left_a__door")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_left_a__door")


        # op[18] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.5, -3.5, 2))
        obj = bpy.context.active_object
        obj.name = "parque_house_left_a__window_l"
        obj.scale = (0.82, 0.09, 0.7)
        objects["parque_house_left_a__window_l"] = obj
        completed.append("mesh.create_primitive:parque_house_left_a__window_l")


        # op[19] material.assign
        obj = objects.get("parque_house_left_a__window_l") or bpy.data.objects.get("parque_house_left_a__window_l")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_left_a__window_l")


        # op[20] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(1.9, -3.5, 2))
        obj = bpy.context.active_object
        obj.name = "parque_house_left_a__window_r"
        obj.scale = (0.82, 0.09, 0.7)
        objects["parque_house_left_a__window_r"] = obj
        completed.append("mesh.create_primitive:parque_house_left_a__window_r")


        # op[21] material.assign
        obj = objects.get("parque_house_left_a__window_r") or bpy.data.objects.get("parque_house_left_a__window_r")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_left_a__window_r")


        # op[22] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.65, -14.8, 1.55))
        obj = bpy.context.active_object
        obj.name = "parque_house_left_b__body"
        obj.scale = (4.6, 2.5, 3)
        objects["parque_house_left_b__body"] = obj
        completed.append("mesh.create_primitive:parque_house_left_b__body")


        # op[23] material.assign
        obj = objects.get("parque_house_left_b__body") or bpy.data.objects.get("parque_house_left_b__body")
        mat = materials.get("MAT_BuildingCoral") or bpy.data.materials.get("MAT_BuildingCoral")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_left_b__body")


        # op[24] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.65, -14.8, 3.2))
        obj = bpy.context.active_object
        obj.name = "parque_house_left_b__roof"
        obj.scale = (4.9, 2.75, 0.24)
        objects["parque_house_left_b__roof"] = obj
        completed.append("mesh.create_primitive:parque_house_left_b__roof")


        # op[25] material.assign
        obj = objects.get("parque_house_left_b__roof") or bpy.data.objects.get("parque_house_left_b__roof")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_left_b__roof")


        # op[26] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.65, -13.510000000000002, 0.84))
        obj = bpy.context.active_object
        obj.name = "parque_house_left_b__door"
        obj.scale = (0.62, 0.08, 1.65)
        objects["parque_house_left_b__door"] = obj
        completed.append("mesh.create_primitive:parque_house_left_b__door")


        # op[27] material.assign
        obj = objects.get("parque_house_left_b__door") or bpy.data.objects.get("parque_house_left_b__door")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_left_b__door")


        # op[28] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.5499999999999999, -13.5, 2))
        obj = bpy.context.active_object
        obj.name = "parque_house_left_b__window_l"
        obj.scale = (0.82, 0.09, 0.7)
        objects["parque_house_left_b__window_l"] = obj
        completed.append("mesh.create_primitive:parque_house_left_b__window_l")


        # op[29] material.assign
        obj = objects.get("parque_house_left_b__window_l") or bpy.data.objects.get("parque_house_left_b__window_l")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_left_b__window_l")


        # op[30] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(1.85, -13.5, 2))
        obj = bpy.context.active_object
        obj.name = "parque_house_left_b__window_r"
        obj.scale = (0.82, 0.09, 0.7)
        objects["parque_house_left_b__window_r"] = obj
        completed.append("mesh.create_primitive:parque_house_left_b__window_r")


        # op[31] material.assign
        obj = objects.get("parque_house_left_b__window_r") or bpy.data.objects.get("parque_house_left_b__window_r")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_left_b__window_r")


        # op[32] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.1, -5.8, 1.55))
        obj = bpy.context.active_object
        obj.name = "parque_house_right_a__body"
        obj.scale = (4.6, 2.5, 3)
        objects["parque_house_right_a__body"] = obj
        completed.append("mesh.create_primitive:parque_house_right_a__body")


        # op[33] material.assign
        obj = objects.get("parque_house_right_a__body") or bpy.data.objects.get("parque_house_right_a__body")
        mat = materials.get("MAT_BuildingWarm") or bpy.data.materials.get("MAT_BuildingWarm")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_right_a__body")


        # op[34] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.1, -5.8, 3.2))
        obj = bpy.context.active_object
        obj.name = "parque_house_right_a__roof"
        obj.scale = (4.9, 2.75, 0.24)
        objects["parque_house_right_a__roof"] = obj
        completed.append("mesh.create_primitive:parque_house_right_a__roof")


        # op[35] material.assign
        obj = objects.get("parque_house_right_a__roof") or bpy.data.objects.get("parque_house_right_a__roof")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_right_a__roof")


        # op[36] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.1, -4.51, 0.84))
        obj = bpy.context.active_object
        obj.name = "parque_house_right_a__door"
        obj.scale = (0.62, 0.08, 1.65)
        objects["parque_house_right_a__door"] = obj
        completed.append("mesh.create_primitive:parque_house_right_a__door")


        # op[37] material.assign
        obj = objects.get("parque_house_right_a__door") or bpy.data.objects.get("parque_house_right_a__door")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_right_a__door")


        # op[38] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.900000000000002, -4.5, 2))
        obj = bpy.context.active_object
        obj.name = "parque_house_right_a__window_l"
        obj.scale = (0.82, 0.09, 0.7)
        objects["parque_house_right_a__window_l"] = obj
        completed.append("mesh.create_primitive:parque_house_right_a__window_l")


        # op[39] material.assign
        obj = objects.get("parque_house_right_a__window_l") or bpy.data.objects.get("parque_house_right_a__window_l")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_right_a__window_l")


        # op[40] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(29.3, -4.5, 2))
        obj = bpy.context.active_object
        obj.name = "parque_house_right_a__window_r"
        obj.scale = (0.82, 0.09, 0.7)
        objects["parque_house_right_a__window_r"] = obj
        completed.append("mesh.create_primitive:parque_house_right_a__window_r")


        # op[41] material.assign
        obj = objects.get("parque_house_right_a__window_r") or bpy.data.objects.get("parque_house_right_a__window_r")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_right_a__window_r")


        # op[42] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.15, -15.2, 1.55))
        obj = bpy.context.active_object
        obj.name = "parque_house_right_b__body"
        obj.scale = (4.6, 2.5, 3)
        objects["parque_house_right_b__body"] = obj
        completed.append("mesh.create_primitive:parque_house_right_b__body")


        # op[43] material.assign
        obj = objects.get("parque_house_right_b__body") or bpy.data.objects.get("parque_house_right_b__body")
        mat = materials.get("MAT_BuildingCoral") or bpy.data.materials.get("MAT_BuildingCoral")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_right_b__body")


        # op[44] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.15, -15.2, 3.2))
        obj = bpy.context.active_object
        obj.name = "parque_house_right_b__roof"
        obj.scale = (4.9, 2.75, 0.24)
        objects["parque_house_right_b__roof"] = obj
        completed.append("mesh.create_primitive:parque_house_right_b__roof")


        # op[45] material.assign
        obj = objects.get("parque_house_right_b__roof") or bpy.data.objects.get("parque_house_right_b__roof")
        mat = materials.get("MAT_Concrete") or bpy.data.materials.get("MAT_Concrete")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_right_b__roof")


        # op[46] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.15, -13.91, 0.84))
        obj = bpy.context.active_object
        obj.name = "parque_house_right_b__door"
        obj.scale = (0.62, 0.08, 1.65)
        objects["parque_house_right_b__door"] = obj
        completed.append("mesh.create_primitive:parque_house_right_b__door")


        # op[47] material.assign
        obj = objects.get("parque_house_right_b__door") or bpy.data.objects.get("parque_house_right_b__door")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_right_b__door")


        # op[48] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.95, -13.899999999999999, 2))
        obj = bpy.context.active_object
        obj.name = "parque_house_right_b__window_l"
        obj.scale = (0.82, 0.09, 0.7)
        objects["parque_house_right_b__window_l"] = obj
        completed.append("mesh.create_primitive:parque_house_right_b__window_l")


        # op[49] material.assign
        obj = objects.get("parque_house_right_b__window_l") or bpy.data.objects.get("parque_house_right_b__window_l")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_right_b__window_l")


        # op[50] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(29.349999999999998, -13.899999999999999, 2))
        obj = bpy.context.active_object
        obj.name = "parque_house_right_b__window_r"
        obj.scale = (0.82, 0.09, 0.7)
        objects["parque_house_right_b__window_r"] = obj
        completed.append("mesh.create_primitive:parque_house_right_b__window_r")


        # op[51] material.assign
        obj = objects.get("parque_house_right_b__window_r") or bpy.data.objects.get("parque_house_right_b__window_r")
        mat = materials.get("MAT_Glass") or bpy.data.materials.get("MAT_Glass")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_house_right_b__window_r")


        # op[52] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.19, depth=2.8, location=(2.5, -2, 1.4))
        obj = bpy.context.active_object
        obj.name = "parque_tree_left_a__trunk"
        obj.scale = (0.19, 0.19, 2.8)
        objects["parque_tree_left_a__trunk"] = obj
        completed.append("mesh.create_primitive:parque_tree_left_a__trunk")


        # op[53] material.assign
        obj = objects.get("parque_tree_left_a__trunk") or bpy.data.objects.get("parque_tree_left_a__trunk")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_left_a__trunk")


        # op[54] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(2.5, -2, 3))
        obj = bpy.context.active_object
        obj.name = "parque_tree_left_a__crown_a"
        obj.scale = (1.55, 1.45, 1.1)
        objects["parque_tree_left_a__crown_a"] = obj
        completed.append("mesh.create_primitive:parque_tree_left_a__crown_a")


        # op[55] material.assign
        obj = objects.get("parque_tree_left_a__crown_a") or bpy.data.objects.get("parque_tree_left_a__crown_a")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_left_a__crown_a")


        # op[56] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(1.88, -2.03, 3.52))
        obj = bpy.context.active_object
        obj.name = "parque_tree_left_a__crown_b"
        obj.scale = (1.05, 1, 0.8)
        objects["parque_tree_left_a__crown_b"] = obj
        completed.append("mesh.create_primitive:parque_tree_left_a__crown_b")


        # op[57] material.assign
        obj = objects.get("parque_tree_left_a__crown_b") or bpy.data.objects.get("parque_tree_left_a__crown_b")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_left_a__crown_b")


        # op[58] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.19, depth=2.8, location=(2.45, -8.8, 1.4))
        obj = bpy.context.active_object
        obj.name = "parque_tree_left_b__trunk"
        obj.scale = (0.19, 0.19, 2.8)
        objects["parque_tree_left_b__trunk"] = obj
        completed.append("mesh.create_primitive:parque_tree_left_b__trunk")


        # op[59] material.assign
        obj = objects.get("parque_tree_left_b__trunk") or bpy.data.objects.get("parque_tree_left_b__trunk")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_left_b__trunk")


        # op[60] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(2.45, -8.8, 3))
        obj = bpy.context.active_object
        obj.name = "parque_tree_left_b__crown_a"
        obj.scale = (1.55, 1.45, 1.1)
        objects["parque_tree_left_b__crown_a"] = obj
        completed.append("mesh.create_primitive:parque_tree_left_b__crown_a")


        # op[61] material.assign
        obj = objects.get("parque_tree_left_b__crown_a") or bpy.data.objects.get("parque_tree_left_b__crown_a")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_left_b__crown_a")


        # op[62] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(1.83, -8.83, 3.52))
        obj = bpy.context.active_object
        obj.name = "parque_tree_left_b__crown_b"
        obj.scale = (1.05, 1, 0.8)
        objects["parque_tree_left_b__crown_b"] = obj
        completed.append("mesh.create_primitive:parque_tree_left_b__crown_b")


        # op[63] material.assign
        obj = objects.get("parque_tree_left_b__crown_b") or bpy.data.objects.get("parque_tree_left_b__crown_b")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_left_b__crown_b")


        # op[64] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.19, depth=2.8, location=(2.55, -17.2, 1.4))
        obj = bpy.context.active_object
        obj.name = "parque_tree_left_c__trunk"
        obj.scale = (0.19, 0.19, 2.8)
        objects["parque_tree_left_c__trunk"] = obj
        completed.append("mesh.create_primitive:parque_tree_left_c__trunk")


        # op[65] material.assign
        obj = objects.get("parque_tree_left_c__trunk") or bpy.data.objects.get("parque_tree_left_c__trunk")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_left_c__trunk")


        # op[66] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(2.55, -17.2, 3))
        obj = bpy.context.active_object
        obj.name = "parque_tree_left_c__crown_a"
        obj.scale = (1.55, 1.45, 1.1)
        objects["parque_tree_left_c__crown_a"] = obj
        completed.append("mesh.create_primitive:parque_tree_left_c__crown_a")


        # op[67] material.assign
        obj = objects.get("parque_tree_left_c__crown_a") or bpy.data.objects.get("parque_tree_left_c__crown_a")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_left_c__crown_a")


        # op[68] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(1.9299999999999997, -17.23, 3.52))
        obj = bpy.context.active_object
        obj.name = "parque_tree_left_c__crown_b"
        obj.scale = (1.05, 1, 0.8)
        objects["parque_tree_left_c__crown_b"] = obj
        completed.append("mesh.create_primitive:parque_tree_left_c__crown_b")


        # op[69] material.assign
        obj = objects.get("parque_tree_left_c__crown_b") or bpy.data.objects.get("parque_tree_left_c__crown_b")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_left_c__crown_b")


        # op[70] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.19, depth=2.8, location=(26.3, -2.6, 1.4))
        obj = bpy.context.active_object
        obj.name = "parque_tree_right_a__trunk"
        obj.scale = (0.19, 0.19, 2.8)
        objects["parque_tree_right_a__trunk"] = obj
        completed.append("mesh.create_primitive:parque_tree_right_a__trunk")


        # op[71] material.assign
        obj = objects.get("parque_tree_right_a__trunk") or bpy.data.objects.get("parque_tree_right_a__trunk")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_right_a__trunk")


        # op[72] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(26.3, -2.6, 3))
        obj = bpy.context.active_object
        obj.name = "parque_tree_right_a__crown_a"
        obj.scale = (1.55, 1.45, 1.1)
        objects["parque_tree_right_a__crown_a"] = obj
        completed.append("mesh.create_primitive:parque_tree_right_a__crown_a")


        # op[73] material.assign
        obj = objects.get("parque_tree_right_a__crown_a") or bpy.data.objects.get("parque_tree_right_a__crown_a")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_right_a__crown_a")


        # op[74] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(25.68, -2.63, 3.52))
        obj = bpy.context.active_object
        obj.name = "parque_tree_right_a__crown_b"
        obj.scale = (1.05, 1, 0.8)
        objects["parque_tree_right_a__crown_b"] = obj
        completed.append("mesh.create_primitive:parque_tree_right_a__crown_b")


        # op[75] material.assign
        obj = objects.get("parque_tree_right_a__crown_b") or bpy.data.objects.get("parque_tree_right_a__crown_b")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_right_a__crown_b")


        # op[76] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.19, depth=2.8, location=(26.25, -10.2, 1.4))
        obj = bpy.context.active_object
        obj.name = "parque_tree_right_b__trunk"
        obj.scale = (0.19, 0.19, 2.8)
        objects["parque_tree_right_b__trunk"] = obj
        completed.append("mesh.create_primitive:parque_tree_right_b__trunk")


        # op[77] material.assign
        obj = objects.get("parque_tree_right_b__trunk") or bpy.data.objects.get("parque_tree_right_b__trunk")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_right_b__trunk")


        # op[78] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(26.25, -10.2, 3))
        obj = bpy.context.active_object
        obj.name = "parque_tree_right_b__crown_a"
        obj.scale = (1.55, 1.45, 1.1)
        objects["parque_tree_right_b__crown_a"] = obj
        completed.append("mesh.create_primitive:parque_tree_right_b__crown_a")


        # op[79] material.assign
        obj = objects.get("parque_tree_right_b__crown_a") or bpy.data.objects.get("parque_tree_right_b__crown_a")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_right_b__crown_a")


        # op[80] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(25.63, -10.229999999999999, 3.52))
        obj = bpy.context.active_object
        obj.name = "parque_tree_right_b__crown_b"
        obj.scale = (1.05, 1, 0.8)
        objects["parque_tree_right_b__crown_b"] = obj
        completed.append("mesh.create_primitive:parque_tree_right_b__crown_b")


        # op[81] material.assign
        obj = objects.get("parque_tree_right_b__crown_b") or bpy.data.objects.get("parque_tree_right_b__crown_b")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_right_b__crown_b")


        # op[82] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.19, depth=2.8, location=(26.2, -17.4, 1.4))
        obj = bpy.context.active_object
        obj.name = "parque_tree_right_c__trunk"
        obj.scale = (0.19, 0.19, 2.8)
        objects["parque_tree_right_c__trunk"] = obj
        completed.append("mesh.create_primitive:parque_tree_right_c__trunk")


        # op[83] material.assign
        obj = objects.get("parque_tree_right_c__trunk") or bpy.data.objects.get("parque_tree_right_c__trunk")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_right_c__trunk")


        # op[84] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(26.2, -17.4, 3))
        obj = bpy.context.active_object
        obj.name = "parque_tree_right_c__crown_a"
        obj.scale = (1.55, 1.45, 1.1)
        objects["parque_tree_right_c__crown_a"] = obj
        completed.append("mesh.create_primitive:parque_tree_right_c__crown_a")


        # op[85] material.assign
        obj = objects.get("parque_tree_right_c__crown_a") or bpy.data.objects.get("parque_tree_right_c__crown_a")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_right_c__crown_a")


        # op[86] mesh.create_primitive
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(25.58, -17.43, 3.52))
        obj = bpy.context.active_object
        obj.name = "parque_tree_right_c__crown_b"
        obj.scale = (1.05, 1, 0.8)
        objects["parque_tree_right_c__crown_b"] = obj
        completed.append("mesh.create_primitive:parque_tree_right_c__crown_b")


        # op[87] material.assign
        obj = objects.get("parque_tree_right_c__crown_b") or bpy.data.objects.get("parque_tree_right_c__crown_b")
        mat = materials.get("MAT_Foliage") or bpy.data.materials.get("MAT_Foliage")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_tree_right_c__crown_b")


        # op[88] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(2.45, -12.4, 0.5))
        obj = bpy.context.active_object
        obj.name = "parque_bench_left__seat"
        obj.scale = (1.4, 0.42, 0.12)
        objects["parque_bench_left__seat"] = obj
        completed.append("mesh.create_primitive:parque_bench_left__seat")


        # op[89] material.assign
        obj = objects.get("parque_bench_left__seat") or bpy.data.objects.get("parque_bench_left__seat")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_bench_left__seat")


        # op[90] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(2.45, -12.55, 0.82))
        obj = bpy.context.active_object
        obj.name = "parque_bench_left__back"
        obj.scale = (1.4, 0.12, 0.52)
        objects["parque_bench_left__back"] = obj
        completed.append("mesh.create_primitive:parque_bench_left__back")


        # op[91] material.assign
        obj = objects.get("parque_bench_left__back") or bpy.data.objects.get("parque_bench_left__back")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_bench_left__back")


        # op[92] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.48, location=(1.9100000000000001, -12.4, 0.25))
        obj = bpy.context.active_object
        obj.name = "parque_bench_left__leg_l"
        obj.scale = (0.045, 0.045, 0.48)
        objects["parque_bench_left__leg_l"] = obj
        completed.append("mesh.create_primitive:parque_bench_left__leg_l")


        # op[93] material.assign
        obj = objects.get("parque_bench_left__leg_l") or bpy.data.objects.get("parque_bench_left__leg_l")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_bench_left__leg_l")


        # op[94] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.48, location=(2.99, -12.4, 0.25))
        obj = bpy.context.active_object
        obj.name = "parque_bench_left__leg_r"
        obj.scale = (0.045, 0.045, 0.48)
        objects["parque_bench_left__leg_r"] = obj
        completed.append("mesh.create_primitive:parque_bench_left__leg_r")


        # op[95] material.assign
        obj = objects.get("parque_bench_left__leg_r") or bpy.data.objects.get("parque_bench_left__leg_r")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_bench_left__leg_r")


        # op[96] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.2, -6.8, 0.5))
        obj = bpy.context.active_object
        obj.name = "parque_bench_right__seat"
        obj.scale = (1.4, 0.42, 0.12)
        objects["parque_bench_right__seat"] = obj
        completed.append("mesh.create_primitive:parque_bench_right__seat")


        # op[97] material.assign
        obj = objects.get("parque_bench_right__seat") or bpy.data.objects.get("parque_bench_right__seat")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_bench_right__seat")


        # op[98] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.2, -6.95, 0.82))
        obj = bpy.context.active_object
        obj.name = "parque_bench_right__back"
        obj.scale = (1.4, 0.12, 0.52)
        objects["parque_bench_right__back"] = obj
        completed.append("mesh.create_primitive:parque_bench_right__back")


        # op[99] material.assign
        obj = objects.get("parque_bench_right__back") or bpy.data.objects.get("parque_bench_right__back")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_bench_right__back")


        # op[100] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.48, location=(25.66, -6.8, 0.25))
        obj = bpy.context.active_object
        obj.name = "parque_bench_right__leg_l"
        obj.scale = (0.045, 0.045, 0.48)
        objects["parque_bench_right__leg_l"] = obj
        completed.append("mesh.create_primitive:parque_bench_right__leg_l")


        # op[101] material.assign
        obj = objects.get("parque_bench_right__leg_l") or bpy.data.objects.get("parque_bench_right__leg_l")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_bench_right__leg_l")


        # op[102] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.48, location=(26.74, -6.8, 0.25))
        obj = bpy.context.active_object
        obj.name = "parque_bench_right__leg_r"
        obj.scale = (0.045, 0.045, 0.48)
        objects["parque_bench_right__leg_r"] = obj
        completed.append("mesh.create_primitive:parque_bench_right__leg_r")


        # op[103] material.assign
        obj = objects.get("parque_bench_right__leg_r") or bpy.data.objects.get("parque_bench_right__leg_r")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_bench_right__leg_r")


        # op[104] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.39999999999999997, -0.5, 0.43))
        obj = bpy.context.active_object
        obj.name = "parque_fence_left__post_0"
        obj.scale = (0.08, 0.08, 0.85)
        objects["parque_fence_left__post_0"] = obj
        completed.append("mesh.create_primitive:parque_fence_left__post_0")


        # op[105] mesh.transform
        obj = objects.get("parque_fence_left__post_0") or bpy.data.objects.get("parque_fence_left__post_0")
        if obj is None:
            raise RuntimeError("mesh.transform missing target parque_fence_left__post_0")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:parque_fence_left__post_0")


        # op[106] material.assign
        obj = objects.get("parque_fence_left__post_0") or bpy.data.objects.get("parque_fence_left__post_0")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_fence_left__post_0")


        # op[107] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.39999999999999997, -1.1, 0.43))
        obj = bpy.context.active_object
        obj.name = "parque_fence_left__post_1"
        obj.scale = (0.08, 0.08, 0.85)
        objects["parque_fence_left__post_1"] = obj
        completed.append("mesh.create_primitive:parque_fence_left__post_1")


        # op[108] mesh.transform
        obj = objects.get("parque_fence_left__post_1") or bpy.data.objects.get("parque_fence_left__post_1")
        if obj is None:
            raise RuntimeError("mesh.transform missing target parque_fence_left__post_1")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:parque_fence_left__post_1")


        # op[109] material.assign
        obj = objects.get("parque_fence_left__post_1") or bpy.data.objects.get("parque_fence_left__post_1")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_fence_left__post_1")


        # op[110] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.4, -1.7, 0.43))
        obj = bpy.context.active_object
        obj.name = "parque_fence_left__post_2"
        obj.scale = (0.08, 0.08, 0.85)
        objects["parque_fence_left__post_2"] = obj
        completed.append("mesh.create_primitive:parque_fence_left__post_2")


        # op[111] mesh.transform
        obj = objects.get("parque_fence_left__post_2") or bpy.data.objects.get("parque_fence_left__post_2")
        if obj is None:
            raise RuntimeError("mesh.transform missing target parque_fence_left__post_2")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:parque_fence_left__post_2")


        # op[112] material.assign
        obj = objects.get("parque_fence_left__post_2") or bpy.data.objects.get("parque_fence_left__post_2")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_fence_left__post_2")


        # op[113] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.4000000000000001, -2.3, 0.43))
        obj = bpy.context.active_object
        obj.name = "parque_fence_left__post_3"
        obj.scale = (0.08, 0.08, 0.85)
        objects["parque_fence_left__post_3"] = obj
        completed.append("mesh.create_primitive:parque_fence_left__post_3")


        # op[114] mesh.transform
        obj = objects.get("parque_fence_left__post_3") or bpy.data.objects.get("parque_fence_left__post_3")
        if obj is None:
            raise RuntimeError("mesh.transform missing target parque_fence_left__post_3")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:parque_fence_left__post_3")


        # op[115] material.assign
        obj = objects.get("parque_fence_left__post_3") or bpy.data.objects.get("parque_fence_left__post_3")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_fence_left__post_3")


        # op[116] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.4000000000000001, -2.9, 0.43))
        obj = bpy.context.active_object
        obj.name = "parque_fence_left__post_4"
        obj.scale = (0.08, 0.08, 0.85)
        objects["parque_fence_left__post_4"] = obj
        completed.append("mesh.create_primitive:parque_fence_left__post_4")


        # op[117] mesh.transform
        obj = objects.get("parque_fence_left__post_4") or bpy.data.objects.get("parque_fence_left__post_4")
        if obj is None:
            raise RuntimeError("mesh.transform missing target parque_fence_left__post_4")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:parque_fence_left__post_4")


        # op[118] material.assign
        obj = objects.get("parque_fence_left__post_4") or bpy.data.objects.get("parque_fence_left__post_4")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_fence_left__post_4")


        # op[119] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.4, -1.7, 0.26))
        obj = bpy.context.active_object
        obj.name = "parque_fence_left__rail_low"
        obj.scale = (2.5, 0.08, 0.09)
        objects["parque_fence_left__rail_low"] = obj
        completed.append("mesh.create_primitive:parque_fence_left__rail_low")


        # op[120] mesh.transform
        obj = objects.get("parque_fence_left__rail_low") or bpy.data.objects.get("parque_fence_left__rail_low")
        if obj is None:
            raise RuntimeError("mesh.transform missing target parque_fence_left__rail_low")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:parque_fence_left__rail_low")


        # op[121] material.assign
        obj = objects.get("parque_fence_left__rail_low") or bpy.data.objects.get("parque_fence_left__rail_low")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_fence_left__rail_low")


        # op[122] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0.4, -1.7, 0.68))
        obj = bpy.context.active_object
        obj.name = "parque_fence_left__rail_high"
        obj.scale = (2.5, 0.08, 0.09)
        objects["parque_fence_left__rail_high"] = obj
        completed.append("mesh.create_primitive:parque_fence_left__rail_high")


        # op[123] mesh.transform
        obj = objects.get("parque_fence_left__rail_high") or bpy.data.objects.get("parque_fence_left__rail_high")
        if obj is None:
            raise RuntimeError("mesh.transform missing target parque_fence_left__rail_high")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:parque_fence_left__rail_high")


        # op[124] material.assign
        obj = objects.get("parque_fence_left__rail_high") or bpy.data.objects.get("parque_fence_left__rail_high")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_fence_left__rail_high")


        # op[125] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.4, -0.5, 0.43))
        obj = bpy.context.active_object
        obj.name = "parque_fence_right__post_0"
        obj.scale = (0.08, 0.08, 0.85)
        objects["parque_fence_right__post_0"] = obj
        completed.append("mesh.create_primitive:parque_fence_right__post_0")


        # op[126] mesh.transform
        obj = objects.get("parque_fence_right__post_0") or bpy.data.objects.get("parque_fence_right__post_0")
        if obj is None:
            raise RuntimeError("mesh.transform missing target parque_fence_right__post_0")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:parque_fence_right__post_0")


        # op[127] material.assign
        obj = objects.get("parque_fence_right__post_0") or bpy.data.objects.get("parque_fence_right__post_0")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_fence_right__post_0")


        # op[128] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.4, -1.1, 0.43))
        obj = bpy.context.active_object
        obj.name = "parque_fence_right__post_1"
        obj.scale = (0.08, 0.08, 0.85)
        objects["parque_fence_right__post_1"] = obj
        completed.append("mesh.create_primitive:parque_fence_right__post_1")


        # op[129] mesh.transform
        obj = objects.get("parque_fence_right__post_1") or bpy.data.objects.get("parque_fence_right__post_1")
        if obj is None:
            raise RuntimeError("mesh.transform missing target parque_fence_right__post_1")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:parque_fence_right__post_1")


        # op[130] material.assign
        obj = objects.get("parque_fence_right__post_1") or bpy.data.objects.get("parque_fence_right__post_1")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_fence_right__post_1")


        # op[131] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.4, -1.7, 0.43))
        obj = bpy.context.active_object
        obj.name = "parque_fence_right__post_2"
        obj.scale = (0.08, 0.08, 0.85)
        objects["parque_fence_right__post_2"] = obj
        completed.append("mesh.create_primitive:parque_fence_right__post_2")


        # op[132] mesh.transform
        obj = objects.get("parque_fence_right__post_2") or bpy.data.objects.get("parque_fence_right__post_2")
        if obj is None:
            raise RuntimeError("mesh.transform missing target parque_fence_right__post_2")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:parque_fence_right__post_2")


        # op[133] material.assign
        obj = objects.get("parque_fence_right__post_2") or bpy.data.objects.get("parque_fence_right__post_2")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_fence_right__post_2")


        # op[134] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.4, -2.3, 0.43))
        obj = bpy.context.active_object
        obj.name = "parque_fence_right__post_3"
        obj.scale = (0.08, 0.08, 0.85)
        objects["parque_fence_right__post_3"] = obj
        completed.append("mesh.create_primitive:parque_fence_right__post_3")


        # op[135] mesh.transform
        obj = objects.get("parque_fence_right__post_3") or bpy.data.objects.get("parque_fence_right__post_3")
        if obj is None:
            raise RuntimeError("mesh.transform missing target parque_fence_right__post_3")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:parque_fence_right__post_3")


        # op[136] material.assign
        obj = objects.get("parque_fence_right__post_3") or bpy.data.objects.get("parque_fence_right__post_3")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_fence_right__post_3")


        # op[137] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.4, -2.9, 0.43))
        obj = bpy.context.active_object
        obj.name = "parque_fence_right__post_4"
        obj.scale = (0.08, 0.08, 0.85)
        objects["parque_fence_right__post_4"] = obj
        completed.append("mesh.create_primitive:parque_fence_right__post_4")


        # op[138] mesh.transform
        obj = objects.get("parque_fence_right__post_4") or bpy.data.objects.get("parque_fence_right__post_4")
        if obj is None:
            raise RuntimeError("mesh.transform missing target parque_fence_right__post_4")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:parque_fence_right__post_4")


        # op[139] material.assign
        obj = objects.get("parque_fence_right__post_4") or bpy.data.objects.get("parque_fence_right__post_4")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_fence_right__post_4")


        # op[140] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.4, -1.7, 0.26))
        obj = bpy.context.active_object
        obj.name = "parque_fence_right__rail_low"
        obj.scale = (2.5, 0.08, 0.09)
        objects["parque_fence_right__rail_low"] = obj
        completed.append("mesh.create_primitive:parque_fence_right__rail_low")


        # op[141] mesh.transform
        obj = objects.get("parque_fence_right__rail_low") or bpy.data.objects.get("parque_fence_right__rail_low")
        if obj is None:
            raise RuntimeError("mesh.transform missing target parque_fence_right__rail_low")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:parque_fence_right__rail_low")


        # op[142] material.assign
        obj = objects.get("parque_fence_right__rail_low") or bpy.data.objects.get("parque_fence_right__rail_low")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_fence_right__rail_low")


        # op[143] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(28.4, -1.7, 0.68))
        obj = bpy.context.active_object
        obj.name = "parque_fence_right__rail_high"
        obj.scale = (2.5, 0.08, 0.09)
        objects["parque_fence_right__rail_high"] = obj
        completed.append("mesh.create_primitive:parque_fence_right__rail_high")


        # op[144] mesh.transform
        obj = objects.get("parque_fence_right__rail_high") or bpy.data.objects.get("parque_fence_right__rail_high")
        if obj is None:
            raise RuntimeError("mesh.transform missing target parque_fence_right__rail_high")

        obj.rotation_euler = tuple(math.radians(v) for v in (0, 0, 90))

        bpy.context.view_layer.objects.active = obj; obj.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); obj.select_set(False)
        completed.append("mesh.transform:parque_fence_right__rail_high")


        # op[145] material.assign
        obj = objects.get("parque_fence_right__rail_high") or bpy.data.objects.get("parque_fence_right__rail_high")
        mat = materials.get("MAT_Wood") or bpy.data.materials.get("MAT_Wood")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_fence_right__rail_high")


        # op[146] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=4.3, location=(2.95, -15, 2.15))
        obj = bpy.context.active_object
        obj.name = "parque_lamp_left__pole"
        obj.scale = (0.07, 0.07, 4.3)
        objects["parque_lamp_left__pole"] = obj
        completed.append("mesh.create_primitive:parque_lamp_left__pole")


        # op[147] material.assign
        obj = objects.get("parque_lamp_left__pole") or bpy.data.objects.get("parque_lamp_left__pole")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_lamp_left__pole")


        # op[148] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(3.3000000000000003, -15, 4.15))
        obj = bpy.context.active_object
        obj.name = "parque_lamp_left__arm"
        obj.scale = (0.85, 0.08, 0.08)
        objects["parque_lamp_left__arm"] = obj
        completed.append("mesh.create_primitive:parque_lamp_left__arm")


        # op[149] material.assign
        obj = objects.get("parque_lamp_left__arm") or bpy.data.objects.get("parque_lamp_left__arm")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_lamp_left__arm")


        # op[150] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(3.6300000000000003, -15, 4.08))
        obj = bpy.context.active_object
        obj.name = "parque_lamp_left__lamp"
        obj.scale = (0.42, 0.3, 0.16)
        objects["parque_lamp_left__lamp"] = obj
        completed.append("mesh.create_primitive:parque_lamp_left__lamp")


        # op[151] material.assign
        obj = objects.get("parque_lamp_left__lamp") or bpy.data.objects.get("parque_lamp_left__lamp")
        mat = materials.get("MAT_Light") or bpy.data.materials.get("MAT_Light")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_lamp_left__lamp")


        # op[152] mesh.create_primitive
        bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=4.3, location=(25.85, -4.3, 2.15))
        obj = bpy.context.active_object
        obj.name = "parque_lamp_right__pole"
        obj.scale = (0.07, 0.07, 4.3)
        objects["parque_lamp_right__pole"] = obj
        completed.append("mesh.create_primitive:parque_lamp_right__pole")


        # op[153] material.assign
        obj = objects.get("parque_lamp_right__pole") or bpy.data.objects.get("parque_lamp_right__pole")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_lamp_right__pole")


        # op[154] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.200000000000003, -4.3, 4.15))
        obj = bpy.context.active_object
        obj.name = "parque_lamp_right__arm"
        obj.scale = (0.85, 0.08, 0.08)
        objects["parque_lamp_right__arm"] = obj
        completed.append("mesh.create_primitive:parque_lamp_right__arm")


        # op[155] material.assign
        obj = objects.get("parque_lamp_right__arm") or bpy.data.objects.get("parque_lamp_right__arm")
        mat = materials.get("MAT_Metal") or bpy.data.materials.get("MAT_Metal")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_lamp_right__arm")


        # op[156] mesh.create_primitive
        bpy.ops.mesh.primitive_cube_add(size=1, location=(26.53, -4.3, 4.08))
        obj = bpy.context.active_object
        obj.name = "parque_lamp_right__lamp"
        obj.scale = (0.42, 0.3, 0.16)
        objects["parque_lamp_right__lamp"] = obj
        completed.append("mesh.create_primitive:parque_lamp_right__lamp")


        # op[157] material.assign
        obj = objects.get("parque_lamp_right__lamp") or bpy.data.objects.get("parque_lamp_right__lamp")
        mat = materials.get("MAT_Light") or bpy.data.materials.get("MAT_Light")
        if obj is None or mat is None:
            raise RuntimeError("material.assign missing target/material")
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
        completed.append("material.assign:parque_lamp_right__lamp")


        # op[158] light.create
        bpy.ops.object.light_add(type="SUN", location=(4, -4, 6))
        light = bpy.context.active_object
        light.name = "Preview_Sun"
        light.data.energy = 2
        light.rotation_euler = tuple(math.radians(v) for v in (28, 0, 24))
        objects[light.name] = light
        completed.append("light.create")


        # op[159] render.multi_view
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
        out_path = os.path.join(WORK_DIR, "yun_street_block_parque_v1-overview.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_parque_v1-overview.png"] = out_path
        previews.append(out_path)


        cam.location = (8.4, 3, 11.5)
        cam.data.lens = 50
        cam.rotation_euler = (Vector((2.4, -10, 1.5)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_parque_v1-left.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_parque_v1-left.png"] = out_path
        previews.append(out_path)


        cam.location = (20.4, 3, 11.5)
        cam.data.lens = 50
        cam.rotation_euler = (Vector((26.4, -10, 1.5)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_parque_v1-right.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_parque_v1-right.png"] = out_path
        previews.append(out_path)


        cam.location = (14.4, 17.2, 12.8)
        cam.data.lens = 24
        cam.rotation_euler = (Vector((14.4, -4.8, 1.8)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_parque_v1-yun_side.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_parque_v1-yun_side.png"] = out_path
        previews.append(out_path)


        cam.location = (14.4, -37.2, 12.8)
        cam.data.lens = 24
        cam.rotation_euler = (Vector((14.4, -15.2, 1.8)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_parque_v1-turn_side.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_parque_v1-turn_side.png"] = out_path
        previews.append(out_path)


        cam.location = (44.4, 32, 34.8)
        cam.data.lens = 50
        cam.rotation_euler = (Vector((14.4, -10, 1.8)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        out_path = os.path.join(WORK_DIR, "yun_street_block_parque_v1-gameplay.png")
        assert_under_work(out_path)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        artifacts["yun_street_block_parque_v1-gameplay.png"] = out_path
        previews.append(out_path)

        completed.append("render.multi_view")


        # op[160] file.save_blend
        out_path = os.path.join(WORK_DIR, "yun_street_block_parque_v1.blend")
        assert_under_work(out_path)
        bpy.ops.wm.save_as_mainfile(filepath=out_path)
        artifacts["yun_street_block_parque_v1.blend"] = out_path
        completed.append("file.save_blend:yun_street_block_parque_v1.blend")


        # op[161] export.glb
        out_path = os.path.join(WORK_DIR, "yun_street_block_parque_v1.glb")
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
        artifacts["yun_street_block_parque_v1.glb"] = out_path
        completed.append("export.glb:yun_street_block_parque_v1.glb")

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
            "requestedOperations": ["scene.new","world.set_background","material.create","material.create","material.create","material.create","material.create","material.create","material.create","material.create","material.create","material.create","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","mesh.transform","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","mesh.create_primitive","material.assign","light.create","render.multi_view","file.save_blend","export.glb"],
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
        asset_report = os.path.join(WORK_DIR, "yun_street_block_parque_v1-report.json")
        assert_under_work(asset_report)
        with open(asset_report, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        artifacts["yun_street_block_parque_v1-report.json"] = asset_report
        print("Wrote asset report", asset_report)

if __name__ == "__main__":
    main()
