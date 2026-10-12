from pathlib import Path
import importlib.util
import math

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(__file__).resolve().parent
OUTPUT_BLEND = OUTPUT_DIR / "v02-structure-r5-flora.blend"
PALM_RENDER = OUTPUT_DIR / "v02-structure-r5-palms.png"
TREE_RENDER = OUTPUT_DIR / "v02-structure-r5-trees.png"
SHRUB_RENDER = OUTPUT_DIR / "v02-structure-r5-shrubs.png"
OVERVIEW_RENDER = OUTPUT_DIR / "v02-structure-r5-overview.png"
COLLECTION_NAME = "V02R5_PalmAndAlmondCorrection"

spec_r3 = importlib.util.spec_from_file_location(
    "flora_r3_helpers", OUTPUT_DIR / "fix_v02_flora_r3.py"
)
helpers = importlib.util.module_from_spec(spec_r3)
spec_r3.loader.exec_module(helpers)

spec_r4 = importlib.util.spec_from_file_location(
    "flora_r4_helpers", OUTPUT_DIR / "fix_v02_flora_r4.py"
)
r4 = importlib.util.module_from_spec(spec_r4)
spec_r4.loader.exec_module(r4)


def hide_previous_palms_and_almond_top():
    for obj in bpy.data.objects:
        if obj.name.startswith(("RoyalPalmTall_R4", "RoyalPalmShort_R4")):
            obj.hide_render = True
            obj.hide_set(True)
        if obj.name == "Almond_TopCluster":
            obj.hide_render = True
            obj.hide_set(True)


def frond_point(center, direction, length, t, lift, droop):
    return (
        Vector(center)
        + direction * (length * t)
        + Vector((0, 0, lift * math.sin(math.pi * t) - droop * t * t))
    )


def frond_ribbon(name, points, widths, collection, asset_id):
    verts = []
    for index, point in enumerate(points):
        tangent = points[min(index + 1, len(points) - 1)] - points[max(index - 1, 0)]
        tangent.normalize()
        side = Vector((-tangent.y, tangent.x, 0.0))
        if side.length < 0.001:
            side = Vector((1, 0, 0))
        side.normalize()
        verts.append(tuple(point + side * widths[index]))
        verts.append(tuple(point - side * widths[index]))
    faces = [(0, 1, 3, 2), (2, 3, 5, 4), (4, 5, 7, 6)]
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    solidify = obj.modifiers.new("Frond blade thickness", "SOLIDIFY")
    solidify.thickness = 0.020
    solidify.offset = 0.0
    return helpers.finish(obj, collection, asset_id)


def lance_leaflet(name, base, direction, side, side_sign, length, width, drop, collection, asset_id):
    root = Vector(base)
    lateral = side * side_sign
    mid = root + lateral * (length * 0.58) + direction * (length * 0.05) + Vector((0, 0, -drop * 0.40))
    tip = root + lateral * length + direction * (length * 0.10) + Vector((0, 0, -drop))
    verts = (
        tuple(root - direction * width * 0.24),
        tuple(root + direction * width * 0.24),
        tuple(mid + direction * width * 0.52),
        tuple(tip),
        tuple(mid - direction * width * 0.52),
    )
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], [(0, 1, 2, 3, 4)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    solidify = obj.modifiers.new("Leaflet thickness", "SOLIDIFY")
    solidify.thickness = 0.016
    solidify.offset = 0.0
    return helpers.finish(obj, collection, asset_id)


def full_frond(name, center, angle, length, lift, droop, collection, asset_id):
    direction = Vector((math.cos(angle), math.sin(angle), 0.0))
    side = Vector((-direction.y, direction.x, 0.0))
    points = [frond_point(center, direction, length, t, lift, droop) for t in (0.0, 0.34, 0.68, 1.0)]
    frond_ribbon(name + "_RachisBlade", points, (0.07, 0.11, 0.075, 0.015), collection, asset_id)
    for index in range(3):
        helpers.tapered_segment(
            f"{name}_Rachis_{index + 1}",
            points[index],
            points[index + 1],
            0.052 - index * 0.012,
            0.039 - index * 0.012,
            collection,
            asset_id,
            vertices=7,
        )
    for pair_index, t in enumerate((0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.84, 0.92)):
        base = frond_point(center, direction, length, t, lift, droop)
        fullness = 1.0 - abs(t - 0.50) * 0.85
        leaf_length = length * 0.22 * fullness
        leaf_width = max(0.10, leaf_length * 0.22)
        leaf_drop = 0.12 + 0.24 * t
        for side_sign in (-1, 1):
            lance_leaflet(
                f"{name}_Leaflet_{pair_index + 1}_{'L' if side_sign < 0 else 'R'}",
                base,
                direction,
                side,
                side_sign,
                leaf_length,
                leaf_width,
                leaf_drop,
                collection,
                asset_id,
            )


def build_full_royal_palm(collection, name, x, y, height, short=False):
    asset_id = "yun_royal_palm_short_v01" if short else "yun_royal_palm_tall_v01"
    top_z = height * 0.91
    points = (
        Vector((x, y, 0.0)),
        Vector((x + 0.035, y - 0.02, height * 0.22)),
        Vector((x - 0.035, y + 0.025, height * 0.48)),
        Vector((x + 0.055, y, height * 0.73)),
        Vector((x, y, top_z - 0.72)),
    )
    radii = (
        0.40 if not short else 0.33,
        0.31 if not short else 0.27,
        0.27 if not short else 0.23,
        0.22 if not short else 0.19,
        0.18 if not short else 0.16,
    )
    for index in range(len(points) - 1):
        helpers.tapered_segment(
            f"{name}_Trunk_{index + 1}",
            points[index],
            points[index + 1],
            radii[index],
            radii[index + 1],
            collection,
            asset_id,
            vertices=12,
        )
    for index, fraction in enumerate((0.16, 0.28, 0.40, 0.53, 0.65, 0.76)):
        radius = radii[0] + (radii[-1] - radii[0]) * fraction
        r4.trunk_ring(f"{name}_TrunkRing_{index + 1}", x, y, height * fraction, radius, collection, asset_id)

    center = Vector((x, y, top_z))
    r4.crownshaft(name + "_Crownshaft", center, 0.72, radii[-1] * 1.22, radii[-1] * 0.96, collection, asset_id)
    helpers.ellipsoid(name + "_CrownBud", center, (0.28, 0.28, 0.34), collection, asset_id, subdivisions=2)
    count = 13 if not short else 12
    base_length = 2.95 if not short else 2.20
    for index in range(count):
        angle = 2 * math.pi * index / count
        layer = index % 3
        if layer == 0:
            lift, droop, length_scale = (0.88, 0.48, 0.82)
        elif layer == 1:
            lift, droop, length_scale = (0.62, 0.92, 1.00)
        else:
            lift, droop, length_scale = (0.44, 1.30, 1.08)
        if short:
            lift *= 0.78
            droop *= 0.75
        full_frond(
            f"{name}_Frond_{index + 1}",
            center,
            angle,
            base_length * length_scale,
            lift,
            droop,
            collection,
            asset_id,
        )
    for index, angle in enumerate((0.30, 2.45, 4.55)):
        full_frond(
            f"{name}_Spear_{index + 1}",
            center,
            angle,
            base_length * 0.58,
            1.08 if not short else 0.78,
            0.12,
            collection,
            asset_id,
        )


def rebuild_almond_top(collection):
    asset_id = "yun_broadleaf_shade_tree_v01"
    x, y = -2.0, -8.5
    top_clusters = (
        (-0.72, 0.04, 4.92, 0.82, 0.58, 0.38),
        (0.70, 0.08, 4.90, 0.84, 0.60, 0.40),
        (-0.18, -0.22, 5.20, 0.90, 0.66, 0.44),
        (0.18, 0.22, 5.30, 0.74, 0.58, 0.42),
    )
    for index, (dx, dy, z, sx, sy, sz) in enumerate(top_clusters):
        helpers.ellipsoid(
            f"Almond_R5_TopCluster_{index + 1}",
            (x + dx, y + dy, z),
            (sx, sy, sz),
            collection,
            asset_id,
            subdivisions=2,
        )


def set_camera(name, location, target, ortho_scale):
    camera = bpy.data.objects.get(name)
    if camera is None:
        data = bpy.data.cameras.new(name)
        camera = bpy.data.objects.new(name, data)
        bpy.context.scene.collection.objects.link(camera)
    camera.location = location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    return camera


def render_reviews():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    views = (
        ("V02R5_Palms_Close", (-12.5, -30.0, 9.5), (-12.5, -8.5, 4.2), 19.0, PALM_RENDER),
        ("V02R5_Trees_Close", (1.5, -27.0, 8.0), (1.5, -8.5, 3.0), 16.0, TREE_RENDER),
        ("V02R4_FloraShrubs_Close", None, None, None, SHRUB_RENDER),
        ("V02_ReviewCamera_Overview", None, None, None, OVERVIEW_RENDER),
    )
    for name, location, target, scale, output in views:
        camera = bpy.data.objects.get(name)
        if location is not None:
            camera = set_camera(name, location, target, scale)
        if camera is None:
            continue
        scene.camera = camera
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
    palm_camera = bpy.data.objects.get("V02R5_Palms_Close")
    scene.camera = palm_camera
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"


def main():
    hide_previous_palms_and_almond_top()
    collection = helpers.reset_collection(COLLECTION_NAME)
    build_full_royal_palm(collection, "RoyalPalmTall_R5", -16.0, -8.5, 8.5, short=False)
    build_full_royal_palm(collection, "RoyalPalmShort_R5", -9.0, -8.5, 5.8, short=True)
    rebuild_almond_top(collection)

    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v02-structure-r5-flora"
    scene["VISIBLE_CREATION_STATUS"] = "AWAITING OWNER REVIEW"
    scene["V02R5_CORRECTIONS"] = (
        "Full feathered royal-palm crowns with wider pinnate leaflets and mixed "
        "frond layers; tropical-almond top split into flatter tiered clusters."
    )
    render_reviews()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    print(f"VISIBLE CHECKPOINT SAVED: {OUTPUT_BLEND}")


if __name__ == "__main__":
    main()
