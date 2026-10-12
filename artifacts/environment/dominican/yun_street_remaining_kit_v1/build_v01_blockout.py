from pathlib import Path
import math

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[4]
OUTPUT_DIR = Path(__file__).resolve().parent
BLEND_PATH = OUTPUT_DIR / "v01-blockout.blend"
RENDER_PATH = OUTPUT_DIR / "v01-blockout-overview.png"

COLORS = {
    "building": (0.70, 0.72, 0.74, 1.0),
    "surface": (0.42, 0.45, 0.47, 1.0),
    "flora": (0.56, 0.60, 0.56, 1.0),
    "street": (0.64, 0.66, 0.68, 1.0),
    "metal": (0.34, 0.37, 0.39, 1.0),
    "label": (0.01, 0.015, 0.02, 1.0),
    "ground": (0.24, 0.26, 0.28, 1.0),
}


def get_collection(name):
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


def move_to(obj, collection, asset_id=None):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)
    obj["v01_blockout_only"] = True
    obj["exportable"] = False
    if asset_id:
        obj["asset_id"] = asset_id
    return obj


def get_material(name, color):
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.roughness = 0.86
    return material


def finish_object(obj, name, collection, family, asset_id=None):
    obj.name = name
    move_to(obj, collection, asset_id)
    obj["family"] = family
    material = get_material(f"MAT_V01_{family}", COLORS[family])
    if obj.type == "MESH":
        obj.data.materials.append(material)
    return obj


def box(name, location, dimensions, collection, family="street", asset_id=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_object(obj, name, collection, family, asset_id)


def cylinder(name, location, radius, depth, collection, family="street", asset_id=None, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
    )
    return finish_object(bpy.context.object, name, collection, family, asset_id)


def sphere(name, location, scale, collection, family="street", asset_id=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, location=location)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_object(obj, name, collection, family, asset_id)


def curve(name, points, bevel, collection, family="street", asset_id=None):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 1
    data.bevel_depth = bevel
    data.bevel_resolution = 1
    spline = data.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    finish_object(obj, name, collection, family, asset_id)
    data.materials.append(get_material(f"MAT_V01_{family}", COLORS[family]))
    return obj


def label(text, location, collection, size=0.62, family="label"):
    data = bpy.data.curves.new(f"Label_{text}", "FONT")
    data.body = text
    data.size = size
    data.extrude = 0.0
    obj = bpy.data.objects.new(f"Label_{text}", data)
    obj.location = location
    collection.objects.link(obj)
    obj["review_label"] = True
    data.materials.append(get_material(f"MAT_V01_{family}", COLORS[family]))
    return obj


def create_house(asset_id, x, y, width, depth, height, stories, color_family="building"):
    collection = COLLECTIONS["architecture"]
    if stories == 1:
        box(f"{asset_id}_ground_mass", (x, y, height * 0.48), (width, depth, height * 0.96),
            collection, color_family, asset_id)
    else:
        lower_h = height * 0.52
        upper_h = height - lower_h
        box(f"{asset_id}_ground_mass", (x, y, lower_h / 2), (width, depth, lower_h),
            collection, color_family, asset_id)
        inset = width * 0.10
        box(f"{asset_id}_upper_mass", (x - inset * 0.35, y + depth * 0.07, lower_h + upper_h / 2),
            (width - inset, depth * 0.86, upper_h), collection, color_family, asset_id)
    box(f"{asset_id}_parapet", (x, y, height + 0.18), (width + 0.12, depth + 0.12, 0.36),
        collection, color_family, asset_id)


def create_palm(asset_id, x, y, height, spread):
    collection = COLLECTIONS["flora"]
    trunk_h = height * 0.66
    trunk = cylinder(f"{asset_id}_trunk", (x, y, trunk_h / 2), 0.22, trunk_h,
                     collection, "flora", asset_id)
    trunk.rotation_euler.y = math.radians(-5)
    crown_z = trunk_h
    for index in range(7):
        angle = 2 * math.pi * index / 7
        end_x = x + math.cos(angle) * spread
        end_y = y + math.sin(angle) * spread
        curve(f"{asset_id}_frond_{index + 1}", [
            (x, y, crown_z),
            (x + math.cos(angle) * spread * 0.45, y + math.sin(angle) * spread * 0.45, crown_z + height * 0.10),
            (end_x, end_y, crown_z - height * 0.20),
        ], 0.12, collection, "flora", asset_id)
    sphere(f"{asset_id}_crown", (x, y, crown_z), (0.42, 0.42, 0.34), collection, "flora", asset_id)


def create_tree(asset_id, x, y, height, canopy_radius, compact=False):
    collection = COLLECTIONS["flora"]
    trunk_h = height * (0.50 if compact else 0.58)
    cylinder(f"{asset_id}_trunk", (x, y, trunk_h / 2), 0.24 if not compact else 0.18,
             trunk_h, collection, "flora", asset_id)
    sphere(f"{asset_id}_canopy", (x, y, trunk_h + canopy_radius * 0.55),
           (canopy_radius, canopy_radius * 0.88, canopy_radius * 0.78),
           collection, "flora", asset_id)


def create_road_modules():
    collection = COLLECTIONS["surfaces"]
    box("AsphaltRoadTile_Blockout", (-15, 4, 0.08), (13, 5.6, 0.16),
        collection, "surface", "yun_asphalt_road_tile_v01")
    label("ASPHALT ROAD TILE", (-20.4, 7.4, 0.17), collection, 0.48)

    box("SidewalkStraight_Blockout", (-3.8, 4, 0.12), (7.4, 2.0, 0.24),
        collection, "surface", "yun_sidewalk_straight_v01")
    label("SIDEWALK STRAIGHT", (-7.1, 5.5, 0.25), collection, 0.40)

    box("SidewalkCorner_Horizontal", (7.2, 4.0, 0.12), (4.0, 1.7, 0.24),
        collection, "surface", "yun_sidewalk_corner_v01")
    box("SidewalkCorner_Vertical", (8.35, 5.55, 0.12), (1.7, 3.1, 0.24),
        collection, "surface", "yun_sidewalk_corner_v01")
    label("SIDEWALK CORNER", (5.2, 7.5, 0.25), collection, 0.38)

    vertices = [
        (12.3, 3.0, 0.0), (16.0, 3.0, 0.0), (16.0, 5.0, 0.0), (12.3, 5.0, 0.0),
        (12.3, 3.0, 0.0), (13.6, 3.0, 0.38), (14.7, 3.0, 0.38), (16.0, 3.0, 0.0),
        (12.3, 5.0, 0.0), (13.6, 5.0, 0.38), (14.7, 5.0, 0.38), (16.0, 5.0, 0.0),
    ]
    mesh = bpy.data.meshes.new("SidewalkRamp_BlockoutMesh")
    mesh.from_pydata(vertices, [], [(0, 1, 2, 3), (0, 4, 5, 6, 7), (3, 8, 9, 10, 11)])
    obj = bpy.data.objects.new("SidewalkRamp_Blockout", mesh)
    collection.objects.link(obj)
    finish_object(obj, obj.name, collection, "surface", "yun_sidewalk_ramp_v01")
    label("SIDEWALK RAMP", (12.3, 5.5, 0.42), collection, 0.38)

    box("GutterChannel_Blockout", (20.1, 4.0, 0.05), (6.2, 0.42, 0.10),
        collection, "surface", "yun_gutter_v01")
    label("GUTTER", (18.0, 4.55, 0.13), collection, 0.42)

    box("PatchedConcrete_Blockout", (27.7, 4.0, 0.09), (4.1, 4.1, 0.18),
        collection, "surface", "yun_patched_concrete_v01")
    label("PATCHED CONCRETE", (25.2, 6.5, 0.2), collection, 0.38)


def create_flora():
    collection = COLLECTIONS["flora"]
    create_palm("RoyalPalm_Tall_Blockout", -16, -8.5, 8.5, 2.5)
    create_palm("RoyalPalm_Short_Blockout", -9, -8.5, 5.8, 1.9)
    create_tree("BroadleafShadeTree_Blockout", -2, -8.5, 5.6, 2.3)
    create_tree("CompactStreetTree_Blockout", 5, -8.5, 3.8, 1.65, compact=True)

    sphere("BougainvilleaCanopy_Blockout", (12, -8.5, 1.25), (1.55, 0.85, 1.15),
           collection, "flora", "yun_bougainvillea_v01")
    cylinder("BougainvilleaPot_Blockout", (12, -8.5, 0.34), 0.48, 0.68,
             collection, "flora", "yun_bougainvillea_v01")
    cylinder("PottedShrubPot_Blockout", (19, -8.5, 0.36), 0.52, 0.72,
             collection, "flora", "yun_potted_shrub_v01")
    sphere("PottedShrubCanopy_Blockout", (19, -8.5, 1.25), (0.88, 0.78, 0.82),
           collection, "flora", "yun_potted_shrub_v01")
    for x, name in (
        (-18.7, "ROYAL PALM TALL"),
        (-11.6, "ROYAL PALM SHORT"),
        (-4.3, "BROADLEAF TREE"),
        (3.4, "COMPACT TREE"),
        (10.0, "BOUGAINVILLEA"),
        (17.0, "POTTED SHRUB"),
    ):
        label(name, (x, -11.1, 0.02), collection, 0.36)


def create_wires():
    collection = COLLECTIONS["street"]
    curve("OverheadCableSpan_Blockout", [
        (-20, -18, 5.8), (-16, -18, 5.2), (-12, -18, 4.9), (-8, -18, 5.2), (-4, -18, 5.8),
    ], 0.055, collection, "metal", "yun_utility_cable_span_v01")
    curve("ServiceDrop_Blockout", [
        (-2.8, -18, 5.55), (-2.6, -18, 4.1), (-2.1, -18, 3.6),
    ], 0.045, collection, "metal", "yun_utility_service_drop_v01")
    box("PoleAttachment_Blockout", (-20.0, -18, 5.85), (0.42, 0.26, 0.20),
        collection, "metal", "yun_utility_pole_attachment_v01")
    label("WIRE SPAN / DROP / ATTACHMENT", (-21.0, -19.3, 0.02), collection, 0.42)


def create_motorconcho(asset_id, x, y, delivery_box=False):
    collection = COLLECTIONS["street"]
    for wheel_x, suffix in ((x - 0.82, "rear"), (x + 0.82, "front")):
        wheel = cylinder(f"{asset_id}_{suffix}_wheel", (wheel_x, y, 0.40), 0.39, 0.15,
                         collection, "metal", asset_id)
        wheel.rotation_euler.y = math.radians(90)
    box(f"{asset_id}_frame", (x, y, 0.77), (1.58, 0.30, 0.22),
        collection, "street", asset_id)
    box(f"{asset_id}_body", (x + 0.12, y, 0.98), (0.68, 0.48, 0.55),
        collection, "street", asset_id)
    box(f"{asset_id}_seat", (x - 0.24, y, 1.22), (0.78, 0.42, 0.16),
        collection, "street", asset_id)
    curve(f"{asset_id}_handlebar", [
        (x + 0.53, y, 1.18), (x + 0.68, y, 1.45), (x + 0.94, y, 1.43),
    ], 0.06, collection, "metal", asset_id)
    if delivery_box:
        box(f"{asset_id}_delivery_box", (x - 0.58, y, 1.50), (0.74, 0.62, 0.55),
            collection, "street", asset_id)


def create_dog(asset_id, x, y):
    collection = COLLECTIONS["street"]
    sphere(f"{asset_id}_torso", (x, y, 0.70), (0.90, 0.34, 0.38), collection, "street", asset_id)
    sphere(f"{asset_id}_shoulders", (x + 0.55, y, 0.85), (0.38, 0.34, 0.43),
           collection, "street", asset_id)
    sphere(f"{asset_id}_head", (x + 0.93, y, 1.03), (0.34, 0.31, 0.32),
           collection, "street", asset_id)
    for leg_x in (x - 0.50, x + 0.42):
        for leg_y in (y - 0.21, y + 0.21):
            cylinder(f"{asset_id}_leg", (leg_x, leg_y, 0.34), 0.10, 0.54,
                     collection, "street", asset_id, vertices=8)
    curve(f"{asset_id}_tail", [(x - 0.82, y, 0.85), (x - 1.16, y, 1.04), (x - 1.34, y, 0.91)],
          0.085, collection, "street", asset_id)


def create_furniture_and_fence():
    collection = COLLECTIONS["street"]
    asset = "yun_stacked_plastic_chair_v01"
    for index in range(3):
        z = 0.36 + index * 0.29
        box(f"StackedChair_{index + 1}_seat", (-18.5, -25.0, z), (0.55, 0.48, 0.07),
            collection, "street", asset)
        box(f"StackedChair_{index + 1}_back", (-18.5, -24.77, z + 0.25), (0.50, 0.07, 0.45),
            collection, "street", asset)
    label("STACKED CHAIR VARIANT", (-20.8, -26.0, 0.02), collection, 0.38)

    table_id = "yun_domino_table_v01"
    box("DominoTable_Top", (-10.0, -25.0, 0.83), (1.8, 1.3, 0.18),
        collection, "street", table_id)
    for dx in (-0.68, 0.68):
        for dy in (-0.46, 0.46):
            box("DominoTable_Leg", (-10.0 + dx, -25.0 + dy, 0.40), (0.12, 0.12, 0.78),
                collection, "street", table_id)
    label("DOMINO TABLE", (-11.1, -26.0, 0.02), collection, 0.40)

    box("NeighborhoodCrate_Blockout", (-3.5, -25.0, 0.36), (0.85, 0.72, 0.72),
        collection, "street", "yun_neighborhood_crate_v01")
    label("CRATE", (-4.0, -25.9, 0.02), collection, 0.40)
    box("CoolerBody_Blockout", (3.0, -25.0, 0.46), (1.1, 0.78, 0.92),
        collection, "street", "yun_neighborhood_cooler_v01")
    box("CoolerLid_Blockout", (3.0, -25.0, 0.96), (1.16, 0.82, 0.12),
        collection, "street", "yun_neighborhood_cooler_v01")
    label("COOLER", (2.3, -25.9, 0.02), collection, 0.40)

    fence_id = "yun_court_fence_span_v01"
    for x in (9.0, 10.4, 11.8, 13.2, 14.6):
        box("CourtFence_Post", (x, -25.0, 1.05), (0.12, 0.12, 2.1),
            collection, "metal", fence_id)
    for z in (0.50, 1.65):
        box("CourtFence_Rail", (11.8, -25.0, z), (5.6, 0.10, 0.10),
            collection, "metal", fence_id)
    for x in (9.4, 10.1, 10.8, 11.5, 12.2, 12.9, 13.6, 14.3):
        box("CourtFence_Bar", (x, -25.0, 1.05), (0.045, 0.06, 1.1),
            collection, "metal", fence_id)
    gate_id = "yun_court_fence_gate_v01"
    box("CourtGate_Blockout", (19.0, -25.0, 1.05), (1.8, 0.09, 2.1),
        collection, "metal", gate_id)
    for x in (18.1, 19.9):
        box("CourtFence_EndPost", (x, -25.0, 1.1), (0.20, 0.20, 2.2),
            collection, "metal", "yun_court_fence_end_post_v01")
    label("FENCE SPAN / GATE / END POSTS", (8.0, -26.4, 0.02), collection, 0.40)


def create_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.cameras, bpy.data.lights, bpy.data.materials):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)

    scene = bpy.context.scene
    scene["ASSET_ID"] = "yun_street_remaining_kit_v1"
    scene["CHECKPOINT"] = "v01-blockout"
    scene["VISIBLE_CREATION_STATUS"] = "AWAITING OWNER REVIEW"
    scene["CONTENT_SCOPE"] = "Only newly missing silhouettes and unfinished modules; existing candidates excluded."
    scene["EXPORT_POLICY"] = "No asset is export-ready; all geometry is a non-exporting blockout."
    scene.world.color = (0.055, 0.065, 0.075)
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1100
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False

    global COLLECTIONS
    COLLECTIONS = {
        "architecture": get_collection("BLOCKOUT_Missing_Building_Variants"),
        "surfaces": get_collection("BLOCKOUT_Missing_Street_Surfaces"),
        "flora": get_collection("BLOCKOUT_Missing_Flora"),
        "street": get_collection("BLOCKOUT_Missing_Street_Props"),
        "review": get_collection("REVIEW_Setup_NotForExport"),
    }
    ground = box("ReviewGround_NotForExport", (1.5, -4.5, -0.12), (58, 58, 0.24),
                 COLLECTIONS["review"], "ground")
    ground["review_only"] = True

    create_house("yun_residential_house_03_v01", -15.0, 17.0, 6.5, 7.4, 3.7, 1)
    create_house("yun_residential_house_04_v01", -5.0, 17.0, 6.2, 7.6, 6.5, 2)
    create_house("yun_narrow_commercial_shell_v01", 5.0, 17.0, 5.5, 7.2, 4.4, 1)
    label("RESIDENTIAL 03", (-18.0, 12.3, 0.02), COLLECTIONS["architecture"], 0.46)
    label("RESIDENTIAL 04", (-8.1, 12.3, 0.02), COLLECTIONS["architecture"], 0.46)
    label("NARROW COMMERCIAL", (2.2, 12.3, 0.02), COLLECTIONS["architecture"], 0.42)

    create_road_modules()
    create_flora()
    create_wires()
    create_motorconcho("yun_motorconcho_base_v01", -11.5, -18.0)
    create_motorconcho("yun_motorconcho_delivery_variant_v01", 0.0, -18.0, delivery_box=True)
    label("MOTORCONCHO", (-14.0, -19.5, 0.02), COLLECTIONS["street"], 0.42)
    label("DELIVERY VARIANT", (-2.8, -19.5, 0.02), COLLECTIONS["street"], 0.42)
    create_dog("yun_dominican_street_dog_v01", 9.0, -18.0)
    label("STREET DOG", (7.8, -19.5, 0.02), COLLECTIONS["street"], 0.42)
    create_furniture_and_fence()

    camera_data = bpy.data.cameras.new("ReviewCamera_Overview")
    camera = bpy.data.objects.new("ReviewCamera_Overview", camera_data)
    COLLECTIONS["review"].objects.link(camera)
    camera.location = (28.0, -47.0, 46.0)
    target = Vector((1.0, -3.2, 0.0))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 80
    scene.camera = camera

    light_data = bpy.data.lights.new("ReviewKey", "AREA")
    light = bpy.data.objects.new("ReviewKey", light_data)
    COLLECTIONS["review"].objects.link(light)
    light.location = (1.0, -5.0, 42.0)
    light_data.energy = 4200
    light_data.size = 28
    fill_data = bpy.data.lights.new("ReviewFill", "AREA")
    fill = bpy.data.objects.new("ReviewFill", fill_data)
    COLLECTIONS["review"].objects.link(fill)
    fill.location = (-22.0, 18.0, 22.0)
    fill_data.energy = 1500
    fill_data.size = 22

    scene.world.color = (0.34, 0.36, 0.38)
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    shading.background_type = "WORLD"
    shading.show_shadows = True
    shading.show_cavity = True
    shading.cavity_type = "BOTH"
    shading.cavity_ridge_factor = 1.2
    shading.cavity_valley_factor = 1.0
    scene.render.image_settings.color_mode = "RGBA"
    scene.camera.data.lens = 50
    bpy.context.view_layer.update()

    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"
                area.spaces.active.overlay.show_floor = False
                area.spaces.active.overlay.show_axis_x = False
                area.spaces.active.overlay.show_axis_y = False
                area.spaces.active.shading.type = "SOLID"
                area.spaces.active.shading.color_type = "MATERIAL"
                area.spaces.active.shading.light = "STUDIO"
                area.spaces.active.shading.show_shadows = True
                area.spaces.active.shading.show_cavity = True

    views = (
        ("ReviewCamera_Overview", (28.0, -47.0, 46.0), (1.0, -3.2, 0.0), 80,
         RENDER_PATH),
        ("ReviewCamera_ArchitectureRoad", (8.0, -31.0, 38.0), (2.0, 10.0, 0.0), 52,
         OUTPUT_DIR / "v01-blockout-architecture-road.png"),
        ("ReviewCamera_FloraStreetProps", (8.0, -47.0, 38.0), (0.0, -18.0, 0.0), 48,
         OUTPUT_DIR / "v01-blockout-flora-street-props.png"),
    )
    for name, location, view_target, scale, output in views:
        camera.location = location
        camera.rotation_euler = (Vector(view_target) - camera.location).to_track_quat("-Z", "Y").to_euler()
        camera.data.ortho_scale = scale
        scene.camera = camera
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
    camera.location = views[0][1]
    camera.rotation_euler = (Vector(views[0][2]) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.ortho_scale = views[0][3]
    scene.camera = camera
    scene.render.filepath = str(RENDER_PATH)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))


if __name__ == "__main__":
    create_scene()
