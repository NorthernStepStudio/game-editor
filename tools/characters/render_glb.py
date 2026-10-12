"""Render any GLB from front, 3/4, side and back (orthographic, framed to fit).
Usage: blender --background --factory-startup --python render_glb.py -- <model.glb> <out_dir> [yaw_degrees]
yaw rotates the model first (e.g. 180 if it faces +Y). Writes render_<view>.png.
"""
import math
import sys

import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:]
GLB, OUT = args[:2]
YAW = float(args[2]) if len(args) > 2 else 0.0
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=GLB)
meshes = [o for o in scene.objects if o.type == "MESH" and not o.name.startswith("Icosphere")]
bpy.context.view_layer.update()
rot = Matrix.Rotation(math.radians(YAW), 4, "Z")
for o in meshes:
    o.matrix_world = rot @ o.matrix_world
bpy.context.view_layer.update()
pts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
lo, hi = Vector(map(min, *pts)), Vector(map(max, *pts))
print("SIZE|%.3f %.3f %.3f|min=%.3f %.3f %.3f" % (*(hi - lo), *lo))
engines = [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
scene.render.engine = next((e for e in engines if "EEVEE" in e), "BLENDER_WORKBENCH")
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = 640
world = bpy.data.worlds.new("W")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.42, 0.45, 0.5, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.2
scene.world = world
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 2.5
sun.rotation_euler = (math.radians(50), math.radians(8), math.radians(-25))
scene.collection.objects.link(sun)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = max(hi.x - lo.x, hi.z - lo.z, hi.y - lo.y) * 1.12
focus = (lo + hi) / 2
for label, az, el in (("front", 0, 6), ("three_quarter", 35, 15), ("side", 90, 6), ("back", 180, 6)):
    a, e = math.radians(az), math.radians(el)
    cam.location = focus + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * 10
    cam.rotation_euler = (focus - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_end = 100
    scene.render.filepath = f"{OUT}/render_{label}.png"
    bpy.ops.render.render(write_still=True)
print("RENDER_OK")
