from pathlib import Path
import math

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(__file__).resolve().parent
OUTPUT_BLEND = OUTPUT_DIR / "v02-structure-r3-flora.blend"
OUTPUT_RENDER = OUTPUT_DIR / "v02-structure-r3-flora.png"
OUTPUT_OVERVIEW = OUTPUT_DIR / "v02-structure-r3-overview.png"
COLLECTION_NAME = "V02R3_Structure_Flora"


def ensure_collection(name):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def reset_collection(name):
    collection = bpy.data.collections.get(name)
    if collection is not None:
        for obj in list(collection.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(collection)
    return ensure_collection(name)


def finish(obj, collection, asset_id):
    for old_collection in list(obj.users_collection):
        old_collection.objects.unlink(obj)
    collection.objects.link(obj)
    obj["asset_id"] = asset_id
    obj["checkpoint"] = "v02-structure-r3-flora"
    obj["exportable"] = True
    return obj


def tapered_segment(name, start, end, radius_start, radius_end, collection, asset_id, vertices=10):
    start_v = Vector(start)
    end_v = Vector(end)
    delta = end_v - start_v
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_start,
        radius2=radius_end,
        depth=delta.length,
        location=(start_v + end_v) * 0.5,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    return finish(obj, collection, asset_id)


def ellipsoid(name, location, scale, collection, asset_id, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, collection, asset_id)


def palm_frond(name, center, angle, length, lift, droop, width, collection, asset_id):
    direction = Vector((math.cos(angle), math.sin(angle), 0.0))
    side = Vector((-direction.y, direction.x, 0.0))
    center_v = Vector(center)
    stations = (
        center_v + direction * 0.14,
        center_v + direction * (length * 0.32) + Vector((0, 0, lift)),
        center_v + direction * (length * 0.72) + Vector((0, 0, lift * 0.45)),
        center_v + direction * length + Vector((0, 0, -droop)),
    )
    widths = (width * 0.35, width, width * 0.72, 0.02)
    verts = []
    for station, station_width in zip(stations, widths):
        verts.append(tuple(station + side * station_width))
        verts.append(tuple(station - side * station_width))
    faces = [(0, 1, 3, 2), (2, 3, 5, 4), (4, 5, 7, 6)]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    solidify = obj.modifiers.new("Frond thickness", "SOLIDIFY")
    solidify.thickness = 0.025
    solidify.offset = 0.0
    finish(obj, collection, asset_id)
    tapered_segment(
        f"{name}_Rib",
        stations[0],
        stations[-1],
        0.045,
        0.012,
        collection,
        asset_id,
        vertices=7,
    )


def hide_previous_flora():
    previous = bpy.data.collections.get("V02_Structure_Flora")
    if previous is not None:
        previous.hide_render = True
        previous.hide_viewport = True

    prefixes = (
        "RoyalPalm_Tall_Blockout",
        "RoyalPalm_Short_Blockout",
        "BroadleafShadeTree_Blockout",
        "CompactStreetTree_Blockout",
        "BougainvilleaCanopy_Blockout",
        "BougainvilleaPot_Blockout",
        "PottedShrubCanopy_Blockout",
        "PottedShrubPot_Blockout",
    )
    for obj in bpy.data.objects:
        if obj.name.startswith(prefixes):
            obj.hide_render = True
            obj.hide_set(True)


def build_royal_palm(collection, name, x, y, height, crown_radius, short=False):
    asset_id = "yun_royal_palm_short_v01" if short else "yun_royal_palm_tall_v01"
    points = [
        Vector((x, y, 0.0)),
        Vector((x + 0.06, y - 0.02, height * 0.25)),
        Vector((x - 0.04, y + 0.04, height * 0.52)),
        Vector((x + 0.08, y, height * 0.78)),
        Vector((x, y, height * 0.88)),
    ]
    radii = [0.34 if not short else 0.28, 0.27, 0.22, 0.17, 0.14]
    for index in range(len(points) - 1):
        tapered_segment(
            f"{name}_Trunk_{index + 1}",
            points[index],
            points[index + 1],
            radii[index],
            radii[index + 1],
            collection,
            asset_id,
            vertices=10,
        )
    crown = points[-1]
    ellipsoid(f"{name}_CrownHub", crown, (0.30, 0.30, 0.24), collection, asset_id)
    frond_count = 11 if not short else 10
    for index in range(frond_count):
        angle = (2 * math.pi * index / frond_count) + (0.12 if index % 2 else 0.0)
        length = crown_radius * (0.90 + 0.12 * ((index % 3) - 1))
        lift = 0.42 + 0.10 * (index % 2)
        droop = (1.05 if not short else 0.78) + 0.10 * (index % 3)
        palm_frond(
            f"{name}_Frond_{index + 1}",
            crown,
            angle,
            length,
            lift,
            droop,
            0.22 if not short else 0.18,
            collection,
            asset_id,
        )
    # A few younger upright leaves prevent the crown from looking like a flat star.
    for index, angle in enumerate((0.4, 2.55, 4.65)):
        palm_frond(
            f"{name}_YoungFrond_{index + 1}",
            crown,
            angle,
            crown_radius * 0.62,
            0.82 if not short else 0.60,
            0.18,
            0.15,
            collection,
            asset_id,
        )


def build_branching_tree(collection, name, x, y, height, spread, compact=False):
    asset_id = "yun_compact_street_tree_v01" if compact else "yun_broadleaf_shade_tree_v01"
    fork_z = height * (0.48 if compact else 0.45)
    tapered_segment(
        f"{name}_TrunkLower",
        (x, y, 0.0),
        (x + 0.04, y, fork_z),
        0.30 if not compact else 0.22,
        0.16 if not compact else 0.12,
        collection,
        asset_id,
        vertices=9,
    )
    branch_angles = (0.25, 1.45, 2.75, 4.05, 5.30)
    branch_ends = []
    for index, angle in enumerate(branch_angles):
        radial = spread * (0.54 if compact else 0.68)
        end = Vector((
            x + math.cos(angle) * radial,
            y + math.sin(angle) * radial * 0.76,
            fork_z + height * (0.22 + 0.04 * (index % 2)),
        ))
        branch_ends.append(end)
        tapered_segment(
            f"{name}_Branch_{index + 1}",
            (x + 0.04, y, fork_z * 0.92),
            end,
            0.13 if not compact else 0.095,
            0.055,
            collection,
            asset_id,
            vertices=8,
        )

    lobe_scales = (
        (0.70, 0.58, 0.55),
        (0.62, 0.68, 0.52),
        (0.72, 0.56, 0.62),
        (0.58, 0.64, 0.56),
        (0.66, 0.60, 0.50),
    )
    for index, (end, proportions) in enumerate(zip(branch_ends, lobe_scales)):
        scale = tuple(spread * value for value in proportions)
        end.z += (0.10 if index % 2 else 0.0)
        ellipsoid(f"{name}_CanopyCluster_{index + 1}", end, scale, collection, asset_id)
    ellipsoid(
        f"{name}_CanopyTop",
        (x, y, height * 0.83),
        (spread * 0.78, spread * 0.66, spread * 0.58),
        collection,
        asset_id,
    )


def build_bougainvillea(collection):
    asset_id = "yun_bougainvillea_v01"
    x, y = 12.0, -8.5
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.52, radius2=0.42, depth=0.68, location=(x, y, 0.34))
    finish(bpy.context.object, collection, asset_id).name = "Bougainvillea_Planter"
    stems = (
        ((x, y, 0.62), (x - 0.70, y + 0.18, 1.65)),
        ((x, y, 0.62), (x + 0.66, y - 0.20, 1.48)),
        ((x, y, 0.62), (x + 0.05, y + 0.30, 1.95)),
        ((x, y, 0.62), (x - 0.18, y - 0.28, 1.35)),
    )
    for index, (start, end) in enumerate(stems):
        tapered_segment(f"Bougainvillea_Stem_{index + 1}", start, end, 0.065, 0.025, collection, asset_id, 7)
    clusters = (
        (-0.72, 0.15, 1.65, 0.62),
        (-0.26, -0.22, 1.82, 0.70),
        (0.28, 0.18, 1.72, 0.72),
        (0.68, -0.16, 1.50, 0.58),
        (0.04, 0.02, 2.10, 0.62),
        (-0.44, 0.28, 1.28, 0.52),
        (0.42, -0.24, 1.18, 0.50),
    )
    for index, (dx, dy, z, size) in enumerate(clusters):
        ellipsoid(
            f"Bougainvillea_Cluster_{index + 1}",
            (x + dx, y + dy, z),
            (size, size * 0.70, size * 0.74),
            collection,
            asset_id,
            subdivisions=1,
        )


def build_potted_shrub(collection):
    asset_id = "yun_potted_shrub_v01"
    x, y = 19.0, -8.5
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.55, radius2=0.44, depth=0.72, location=(x, y, 0.36))
    finish(bpy.context.object, collection, asset_id).name = "PottedShrub_Planter"
    tapered_segment("PottedShrub_Stem", (x, y, 0.66), (x, y, 1.28), 0.09, 0.045, collection, asset_id, 7)
    for index, (dx, dy, z, sx, sy, sz) in enumerate((
        (-0.38, 0.0, 1.22, 0.46, 0.38, 0.48),
        (0.34, 0.08, 1.25, 0.45, 0.38, 0.46),
        (0.0, -0.20, 1.48, 0.50, 0.40, 0.52),
        (0.02, 0.12, 1.82, 0.40, 0.36, 0.46),
    )):
        ellipsoid(f"PottedShrub_Cluster_{index + 1}", (x + dx, y + dy, z), (sx, sy, sz), collection, asset_id, subdivisions=1)


def render_reviews():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    for camera_name, output_path in (
        ("V02_ReviewCamera_Flora", OUTPUT_RENDER),
        ("V02_ReviewCamera_Overview", OUTPUT_OVERVIEW),
    ):
        camera = bpy.data.objects.get(camera_name)
        if camera is None:
            continue
        scene.camera = camera
        scene.render.filepath = str(output_path)
        bpy.ops.render.render(write_still=True)
    flora_camera = bpy.data.objects.get("V02_ReviewCamera_Flora")
    if flora_camera is not None:
        scene.camera = flora_camera
        for window in bpy.context.window_manager.windows:
            for area in window.screen.areas:
                if area.type == "VIEW_3D":
                    area.spaces.active.region_3d.view_perspective = "CAMERA"


def main():
    collection = reset_collection(COLLECTION_NAME)
    hide_previous_flora()
    build_royal_palm(collection, "RoyalPalmTall_R3", -16.0, -8.5, 8.5, 2.65, short=False)
    build_royal_palm(collection, "RoyalPalmShort_R3", -9.0, -8.5, 5.8, 2.00, short=True)
    build_branching_tree(collection, "BroadleafTree_R3", -2.0, -8.5, 5.6, 1.55, compact=False)
    build_branching_tree(collection, "CompactTree_R3", 5.0, -8.5, 3.8, 1.05, compact=True)
    build_bougainvillea(collection)
    build_potted_shrub(collection)

    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v02-structure-r3-flora"
    scene["VISIBLE_CREATION_STATUS"] = "AWAITING OWNER REVIEW"
    scene["V02R3_FLORA_CORRECTIONS"] = (
        "Rebuilt royal palms, broadleaf tree, compact tree, bougainvillea, "
        "and potted shrub with tapered trunks, branching structure, layered "
        "canopies, curved fronds, and distinct silhouettes."
    )
    render_reviews()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    print(f"VISIBLE CHECKPOINT SAVED: {OUTPUT_BLEND}")


if __name__ == "__main__":
    main()
