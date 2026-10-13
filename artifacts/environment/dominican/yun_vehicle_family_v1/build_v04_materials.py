"""v04-materials for the Yun vehicle family: each vehicle gets its own Dominican street colour (body), plus real
glass, tyres, wheel metal, trim and lights; then each vehicle is exported as its own game GLB (root at the origin,
front as authored) and the lineup is rendered.

Usage: blender --background v03-details-r2.blend --python build_v04_materials.py -- <out_dir>
Writes <out_dir>/v04-materials.blend, v04-materials-lineup.png, v04-materials-gameplay.png and <vehicle>.glb.
v03-details-r2.blend is never overwritten.
"""
import sys
from pathlib import Path

import bpy

OUT = Path(sys.argv[sys.argv.index("--") + 1])
OUT.mkdir(parents=True, exist_ok=True)


def srgb(c):
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


BODY = {  # what parks on a Dominican barrio street
    "Sedan": (0.62, 0.66, 0.70),        # silver-grey everyday Corolla-style
    "Taxi": (0.96, 0.78, 0.12),         # yellow taxi
    "SUV": (0.12, 0.36, 0.26),          # dark green
    "Van": (0.95, 0.95, 0.93),          # white guagua
    "Delivery": (0.90, 0.28, 0.20),     # red cab, white box
    "SportSedan": (0.10, 0.30, 0.70),   # blue
    "SportHatch": (0.90, 0.16, 0.22),   # red
}
SHARED = {
    "MAT_V03_WheelMetal": ((0.72, 0.74, 0.76), 0.35, 0.8),
    "MAT_StructureWheelHub": ((0.55, 0.57, 0.60), 0.4, 0.7),
    "MAT_StructureTire": ((0.05, 0.05, 0.055), 0.9, 0.0),
    "MAT_V03_DarkTrim": ((0.05, 0.055, 0.06), 0.6, 0.1),
    "MAT_StructureDark": ((0.04, 0.045, 0.05), 0.7, 0.0),
    "MAT_StructureGlass": ((0.10, 0.20, 0.26), 0.12, 0.3),
    "MAT_V03_SubtleSeam": ((0.18, 0.18, 0.2), 0.7, 0.0),
    "MAT_StructureMirrorFace": ((0.55, 0.62, 0.68), 0.1, 0.9),
    "MAT_StructureMirrorHousing": ((0.06, 0.06, 0.07), 0.6, 0.0),
    "MAT_StructureMirrorMount": ((0.06, 0.06, 0.07), 0.6, 0.0),
    "MAT_V03_Plate": ((0.95, 0.93, 0.85), 0.6, 0.0),
    "MAT_StructureRollDoor": ((0.82, 0.83, 0.84), 0.5, 0.4),
    "MAT_StructureRollDoorSeam": ((0.45, 0.46, 0.48), 0.5, 0.3),
}
LIGHTS = {"MAT_V03_Headlight": ((1.0, 0.96, 0.82), 1.2), "MAT_V03_TailLamp": ((0.85, 0.06, 0.06), 0.8),
          "MAT_V03_AmberLamp": ((1.0, 0.55, 0.08), 0.8)}


def set_mat(mat, colour, rough, metal, emit=0.0):
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*srgb(colour), 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*srgb(colour), 1)
        bsdf.inputs["Emission Strength"].default_value = emit
    mat.diffuse_color = (*srgb(colour), 1)


for name, (c, r, m) in SHARED.items():
    if name in bpy.data.materials:
        set_mat(bpy.data.materials[name], c, r, m)
for name, (c, e) in LIGHTS.items():
    if name in bpy.data.materials:
        set_mat(bpy.data.materials[name], c, 0.3, 0.0, e)

BODY_MATS = {"MAT_StructureBody", "MAT_BlockoutVehicles", "MAT_StructureAccent", "MAT_V03_ReviewAccent", "MAT_BlockoutAccent"}
for vehicle, colour in BODY.items():
    col = bpy.data.collections[f"EXPORT_Vehicle_{vehicle}_Structure"]
    body = bpy.data.materials.new(f"MAT_V04_Body_{vehicle}")
    set_mat(body, colour, 0.35, 0.25)
    box = bpy.data.materials.new(f"MAT_V04_Box_{vehicle}")
    set_mat(box, (0.94, 0.94, 0.92), 0.6, 0.0)
    sign = bpy.data.materials.new(f"MAT_V04_Sign_{vehicle}")
    set_mat(sign, (0.98, 0.96, 0.88), 0.4, 0.0, 0.6)
    for obj in col.objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            if slot.material and slot.material.name in BODY_MATS:
                if vehicle == "Delivery" and ("Cargo" in obj.name):
                    slot.material = box
                elif vehicle == "Taxi" and ("Sign" in obj.name or "Roof" in obj.name and slot.material.name != "MAT_StructureBody"):
                    slot.material = sign
                else:
                    slot.material = body

# lineup + gameplay renders from the review cameras already in the file
scene = bpy.context.scene
for cam_name, label in (("BlockoutLineupCamera", "lineup"), ("DetailLiveCamera", "gameplay")):
    cam = bpy.data.objects.get(cam_name)
    if cam is None:
        continue
    scene.camera = cam
    scene.render.filepath = str(OUT / f"v04-materials-{label}.png")
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "v04-materials.blend"), copy=True)

# one GLB per vehicle: exported where it stands (window cut-outs are tied to the scene, so moving the root leaves
# the cabin behind), then re-centred as one piece: root position to the origin, wheels on the ground
import json
centres = {}
for vehicle in BODY:
    root = bpy.data.objects[f"Vehicle_{vehicle}_ROOT"]
    centres[vehicle] = list(root.matrix_world.translation)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [root, *root.children_recursive]:
        if obj.type in ("MESH", "EMPTY") and not obj.name.startswith(("Label", "Grid")) and "Cutter" not in obj.name:
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT / f"{vehicle.lower()}.glb"), export_format="GLB", use_selection=True,
                              export_apply=True)
for vehicle, (x, y, _z) in centres.items():
    path = OUT / f"{vehicle.lower()}.glb"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for o in meshes:
        world = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = world
    for o in [o for o in bpy.context.scene.objects if o.type != "MESH"]:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.update()
    from mathutils import Matrix
    for o in meshes:
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
        o.data.transform(Matrix.Translation((-x, -y, 0)))
    for o in meshes:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True)
    print("EXPORTED", vehicle)
