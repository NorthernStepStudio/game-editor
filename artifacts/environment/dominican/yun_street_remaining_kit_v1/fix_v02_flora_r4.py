from pathlib import Path
import importlib.util
import math

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(__file__).resolve().parent
OUTPUT_BLEND = OUTPUT_DIR / "v02-structure-r4-flora.blend"
TREE_RENDER = OUTPUT_DIR / "v02-structure-r4-flora-trees.png"
SHRUB_RENDER = OUTPUT_DIR / "v02-structure-r4-flora-shrubs.png"
OVERVIEW_RENDER = OUTPUT_DIR / "v02-structure-r4-overview.png"
COLLECTION_NAME = "V02R4_Structure_Flora"

spec = importlib.util.spec_from_file_location(
    "flora_r3_helpers", OUTPUT_DIR / "fix_v02_flora_r3.py"
)
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


def hide_previous_revision():
    previous = bpy.data.collections.get("V02R3_Structure_Flora")
    if previous is not None:
        previous.hide_render = True
        previous.hide_viewport = True


def crownshaft(name, center, height, radius_bottom, radius_top, collection, asset_id):
    start = Vector((center.x, center.y, center.z - height))
    end = Vector(center)
    return helpers.tapered_segment(
        name, start, end, radius_bottom, radius_top, collection, asset_id, vertices=12
    )


def trunk_ring(name, x, y, z, radius, collection, asset_id):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=radius,
        minor_radius=0.022,
        major_segments=12,
        minor_segments=4,
        location=(x, y, z),
    )
    obj = bpy.context.object
    obj.name = name
    return helpers.finish(obj, collection, asset_id)


def frond_point(center, direction, length, t, lift, droop):
    return (
        Vector(center)
        + direction * (length * t)
        + Vector((0, 0, lift * math.sin(math.pi * t) - droop * t * t))
    )


def leaflet(name, base, direction, side, side_sign, length, width, drop, collection, asset_id):
    lateral = side * side_sign
    root = Vector(base)
    tip = root + lateral * length + direction * (length * 0.10) + Vector((0, 0, -drop))
    verts = (
        tuple(root - direction * width * 0.45),
        tuple(root + direction * width * 0.45),
        tuple(tip),
    )
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(verts, [], [(0, 1, 2)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    solidify = obj.modifiers.new("Leaflet thickness", "SOLIDIFY")
    solidify.thickness = 0.018
    solidify.offset = 0.0
    return helpers.finish(obj, collection, asset_id)


def feather_frond(name, center, angle, length, lift, droop, collection, asset_id, leaflet_scale=1.0):
    direction = Vector((math.cos(angle), math.sin(angle), 0.0))
    side = Vector((-direction.y, direction.x, 0.0))
    points = [frond_point(center, direction, length, t, lift, droop) for t in (0.0, 0.34, 0.68, 1.0)]
    for index in range(3):
        helpers.tapered_segment(
            f"{name}_Rachis_{index + 1}",
            points[index],
            points[index + 1],
            0.050 - index * 0.012,
            0.036 - index * 0.011,
            collection,
            asset_id,
            vertices=7,
        )
    for pair_index, t in enumerate((0.18, 0.31, 0.44, 0.57, 0.70, 0.82, 0.92)):
        base = frond_point(center, direction, length, t, lift, droop)
        leaf_length = length * (0.18 - abs(t - 0.55) * 0.10) * leaflet_scale
        leaf_width = max(0.055, leaf_length * 0.18)
        leaf_drop = 0.08 + 0.15 * t
        for side_sign in (-1, 1):
            leaflet(
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


def build_detailed_royal_palm(collection, name, x, y, height, short=False):
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
        trunk_ring(f"{name}_TrunkRing_{index + 1}", x, y, height * fraction, radius, collection, asset_id)

    center = Vector((x, y, top_z))
    crownshaft(name + "_Crownshaft", center, 0.72, radii[-1] * 1.18, radii[-1] * 0.94, collection, asset_id)
    helpers.ellipsoid(name + "_CrownBud", center, (0.24, 0.24, 0.30), collection, asset_id, subdivisions=2)
    count = 12 if not short else 11
    base_length = 2.80 if not short else 2.12
    for index in range(count):
        angle = 2 * math.pi * index / count + (0.06 if index % 2 else 0.0)
        length = base_length * (0.92 + 0.12 * (index % 3))
        feather_frond(
            f"{name}_Frond_{index + 1}",
            center,
            angle,
            length,
            0.56 if not short else 0.43,
            1.30 if not short else 0.92,
            collection,
            asset_id,
        )
    for index, angle in enumerate((0.25, 2.35, 4.42)):
        feather_frond(
            f"{name}_Spear_{index + 1}",
            center,
            angle,
            base_length * 0.62,
            0.92 if not short else 0.67,
            0.18,
            collection,
            asset_id,
            leaflet_scale=0.72,
        )


def build_tropical_almond(collection):
    asset_id = "yun_broadleaf_shade_tree_v01"
    x, y = -2.0, -8.5
    helpers.tapered_segment("Almond_TrunkLower", (x, y, 0.0), (x + 0.05, y, 2.25), 0.36, 0.20, collection, asset_id, vertices=11)
    helpers.tapered_segment("Almond_TrunkUpper", (x + 0.05, y, 2.10), (x - 0.02, y, 4.55), 0.22, 0.10, collection, asset_id, vertices=10)
    tiers = (
        (2.15, 2.25, 5, 0.05),
        (3.15, 1.95, 5, 0.52),
        (4.10, 1.50, 4, 0.18),
    )
    cluster_index = 0
    for tier_index, (z, reach, count, phase) in enumerate(tiers):
        for branch_index in range(count):
            angle = phase + 2 * math.pi * branch_index / count
            direction = Vector((math.cos(angle), math.sin(angle), 0.0))
            start = Vector((x, y, z))
            elbow = start + direction * (reach * 0.52) + Vector((0, 0, 0.20))
            end = start + direction * reach + Vector((0, 0, 0.08 + 0.10 * (branch_index % 2)))
            helpers.tapered_segment(f"Almond_Tier{tier_index + 1}_Branch{branch_index + 1}A", start, elbow, 0.12, 0.075, collection, asset_id, vertices=8)
            helpers.tapered_segment(f"Almond_Tier{tier_index + 1}_Branch{branch_index + 1}B", elbow, end, 0.075, 0.035, collection, asset_id, vertices=7)
            for along, size in ((0.62, 0.54), (0.92, 0.64)):
                cluster_index += 1
                center = start.lerp(end, along)
                center.z += 0.22 + 0.08 * ((cluster_index + tier_index) % 2)
                helpers.ellipsoid(
                    f"Almond_LeafCluster_{cluster_index}",
                    center,
                    (size * 1.18, size * 0.72, size * 0.42),
                    collection,
                    asset_id,
                    subdivisions=2,
                )
    helpers.ellipsoid("Almond_TopCluster", (x, y, 5.10), (1.0, 0.86, 0.58), collection, asset_id, subdivisions=2)


def build_compact_tree(collection):
    asset_id = "yun_compact_street_tree_v01"
    x, y = 5.0, -8.5
    helpers.tapered_segment("Compact_Trunk", (x, y, 0.0), (x, y, 1.95), 0.24, 0.11, collection, asset_id, vertices=9)
    cluster_positions = (
        (-0.72, 0.02, 2.32, 0.62),
        (0.70, 0.08, 2.38, 0.64),
        (-0.40, -0.28, 2.86, 0.68),
        (0.42, -0.20, 2.92, 0.70),
        (0.0, 0.20, 3.35, 0.66),
        (-0.72, 0.16, 3.18, 0.52),
        (0.74, 0.12, 3.12, 0.50),
    )
    for index, (dx, dy, z, size) in enumerate(cluster_positions):
        branch_end = Vector((x + dx * 0.72, y + dy, z - 0.18))
        helpers.tapered_segment(f"Compact_Branch_{index + 1}", (x, y, 1.72), branch_end, 0.085, 0.035, collection, asset_id, vertices=7)
        helpers.ellipsoid(f"Compact_LeafCluster_{index + 1}", (x + dx, y + dy, z), (size, size * 0.82, size * 0.72), collection, asset_id, subdivisions=2)


def build_bougainvillea(collection):
    asset_id = "yun_bougainvillea_v01"
    x, y = 12.0, -8.5
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.56, radius2=0.44, depth=0.72, location=(x, y, 0.36))
    helpers.finish(bpy.context.object, collection, asset_id).name = "Bougainvillea_Planter_R4"
    stem_ends = (
        (-0.95, 0.12, 1.72),
        (-0.50, -0.25, 2.12),
        (0.05, 0.20, 2.42),
        (0.58, -0.20, 2.08),
        (0.98, 0.10, 1.58),
    )
    for index, (dx, dy, z) in enumerate(stem_ends):
        elbow = Vector((x + dx * 0.42, y + dy * 0.55, 1.12 + 0.12 * (index % 2)))
        end = Vector((x + dx, y + dy, z))
        helpers.tapered_segment(f"Bougainvillea_Stem_{index + 1}A", (x, y, 0.66), elbow, 0.060, 0.038, collection, asset_id, vertices=7)
        helpers.tapered_segment(f"Bougainvillea_Stem_{index + 1}B", elbow, end, 0.038, 0.018, collection, asset_id, vertices=7)
    clusters = (
        (-1.02, 0.14, 1.70, 0.44), (-0.78, -0.18, 1.95, 0.48),
        (-0.52, 0.22, 2.16, 0.48), (-0.20, -0.20, 2.34, 0.46),
        (0.12, 0.18, 2.52, 0.48), (0.48, -0.18, 2.25, 0.50),
        (0.82, 0.20, 1.92, 0.46), (1.02, -0.10, 1.62, 0.40),
        (-0.45, 0.05, 1.52, 0.50), (0.42, 0.04, 1.54, 0.52),
        (-0.10, -0.12, 1.88, 0.56),
    )
    for index, (dx, dy, z, size) in enumerate(clusters):
        helpers.ellipsoid(f"Bougainvillea_Growth_{index + 1}", (x + dx, y + dy, z), (size, size * 0.72, size * 0.64), collection, asset_id, subdivisions=2)


def build_potted_shrub(collection):
    asset_id = "yun_potted_shrub_v01"
    x, y = 19.0, -8.5
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.58, radius2=0.45, depth=0.74, location=(x, y, 0.37))
    helpers.finish(bpy.context.object, collection, asset_id).name = "PottedShrub_Planter_R4"
    helpers.tapered_segment("PottedShrub_MainStem", (x, y, 0.68), (x, y, 1.54), 0.095, 0.035, collection, asset_id, vertices=7)
    clusters = (
        (-0.46, 0.00, 1.12, 0.46), (0.46, 0.04, 1.18, 0.46),
        (-0.28, -0.14, 1.52, 0.50), (0.30, 0.12, 1.58, 0.50),
        (0.00, -0.08, 1.94, 0.48), (-0.48, 0.10, 1.82, 0.38),
        (0.46, -0.10, 1.86, 0.38),
    )
    for index, (dx, dy, z, size) in enumerate(clusters):
        helpers.ellipsoid(f"PottedShrub_Growth_{index + 1}", (x + dx, y + dy, z), (size, size * 0.82, size * 0.78), collection, asset_id, subdivisions=2)


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
        ("V02R4_FloraTrees_Close", (-4.0, -34.0, 11.0), (-4.5, -8.5, 3.5), 25.0, TREE_RENDER),
        ("V02R4_FloraShrubs_Close", (15.5, -24.0, 6.0), (15.5, -8.5, 1.3), 12.0, SHRUB_RENDER),
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
    close_camera = bpy.data.objects.get("V02R4_FloraTrees_Close")
    scene.camera = close_camera
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"


def main():
    hide_previous_revision()
    collection = helpers.reset_collection(COLLECTION_NAME)
    build_detailed_royal_palm(collection, "RoyalPalmTall_R4", -16.0, -8.5, 8.5, short=False)
    build_detailed_royal_palm(collection, "RoyalPalmShort_R4", -9.0, -8.5, 5.8, short=True)
    build_tropical_almond(collection)
    build_compact_tree(collection)
    build_bougainvillea(collection)
    build_potted_shrub(collection)

    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v02-structure-r4-flora"
    scene["VISIBLE_CREATION_STATUS"] = "AWAITING OWNER REVIEW"
    scene["FLORA_REFERENCE_DIRECTION"] = (
        "Dominican royal palm crownshaft and pinnate fronds; tropical almond "
        "tiered canopy; cascading urban bougainvillea."
    )
    render_reviews()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    print(f"VISIBLE CHECKPOINT SAVED: {OUTPUT_BLEND}")


if __name__ == "__main__":
    main()
