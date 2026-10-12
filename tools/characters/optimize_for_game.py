"""Make a one-piece character light enough for phones before rigging: fewer triangles, one compact colour texture
(JPEG), no extra texture maps (metallic/roughness).
The mesh is simplified WITHOUT welding its texture seams: each texture island is simplified on its own, so the
original texture still fits. (Welding first smears the texture across islands; re-baking onto a new layout at a few
thousand triangles blurs faces and loses the smile.) 8000 triangles keeps faces and outfits at game size.
Usage: blender --background --factory-startup --python optimize_for_game.py -- <in.glb> <out.glb> [triangles=8000] [texture_px=1024]
"""
import sys

import bpy

args = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = args[0], args[1]
TRIS = int(args[2]) if len(args) > 2 else 8000
TEX = int(args[3]) if len(args) > 3 else 1024
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
before = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
for o in meshes:
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris * len(meshes) > TRIS:
        mod = o.modifiers.new("Lighten", "DECIMATE")
        mod.ratio = TRIS / before
        mod.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
after = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)

kept = set()
for o in meshes:
    for slot in o.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        nodes = mat.node_tree.nodes
        bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
        colour_sources = set()
        if bsdf and bsdf.inputs["Base Color"].links:
            colour_sources.add(bsdf.inputs["Base Color"].links[0].from_node)
        for node in list(nodes):
            if node.type == "TEX_IMAGE" and node in colour_sources:
                kept.add(node.image)
            elif node.type not in ("BSDF_PRINCIPLED", "OUTPUT_MATERIAL") and node not in colour_sources:
                nodes.remove(node)  # metallic/roughness/normal maps and their helpers: not worth a phone's memory
        if bsdf:
            bsdf.inputs["Metallic"].default_value = 0.0
            bsdf.inputs["Roughness"].default_value = 0.8
for img in kept:
    if img and max(img.size) > TEX:
        img.scale(TEX, TEX)
for o in meshes:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True,
                          export_image_format="JPEG", export_image_quality=90)
print("OPTIMIZED|tris=%d->%d|textures=%d" % (before, after, len(kept)))
