"""Make an image-to-3D result game-ready: one mesh, facing -Y, centred, feet on the ground, scaled to a target
height, and lightened to a polygon budget. Keeps its colour texture.
Usage: blender --background --factory-startup --python normalize_model.py -- <in.glb> <out.glb> <height_m> [max_faces] [yaw_deg]
"""
import math
import sys

import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT, HEIGHT = args[0], args[1], float(args[2])
MAX_FACES = int(args[3]) if len(args) > 3 else 40000
YAW = float(args[4]) if len(args) > 4 else 0.0
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == "MESH" and not o.name.startswith("Icosphere")]
bpy.context.view_layer.update()
for o in meshes:
    world = Matrix.Rotation(math.radians(YAW), 4, "Z") @ o.matrix_world
    o.parent = None
    o.matrix_world = world
for o in [o for o in scene.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.update()
for o in meshes:
    o.data.transform(o.matrix_world)
    o.matrix_world.identity()
faces = sum(len(o.data.polygons) for o in meshes)
if faces > MAX_FACES:
    for o in meshes:
        mod = o.modifiers.new("Lighten", "DECIMATE")
        mod.ratio = MAX_FACES / faces
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
pts = [v.co for o in meshes for v in o.data.vertices]
lo, hi = Vector(map(min, *pts)), Vector(map(max, *pts))
s = HEIGHT / (hi.z - lo.z)
fit = Matrix.Diagonal((s, s, s, 1.0)) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))
for o in meshes:
    o.data.transform(fit)
    o.name = o.data.name = "Body"
    for poly in o.data.polygons:
        poly.use_smooth = True
pts = [v.co for o in meshes for v in o.data.vertices]
lo, hi = Vector(map(min, *pts)), Vector(map(max, *pts))
for o in meshes:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True)
print("NORMALIZED|faces=%d->%d|size=(%.3f, %.3f, %.3f)" % (faces, sum(len(o.data.polygons) for o in meshes), *(hi - lo)))
