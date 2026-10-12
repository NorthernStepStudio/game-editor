import math
from pathlib import Path

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(r"D:\dev\Northern Step Studio\artifacts\environment\dominican\yun_vehicle_family_v1")
BLEND_PATH = OUTPUT_DIR / "v03-details.blend"
LINEUP_RENDER = OUTPUT_DIR / "v03-details-lineup.png"
GAMEPLAY_RENDER = OUTPUT_DIR / "v03-details-gameplay.png"
REAR_RENDER = OUTPUT_DIR / "v03-details-rear.png"
DONE_FLAG = OUTPUT_DIR / "v03-details-ready.flag"
ERROR_FILE = OUTPUT_DIR / "v03-details-error.txt"

VEHICLES = {
    "Sedan": (1.50, 2.55, 1.45),
    "Taxi": (1.50, 2.75, 1.65),
    "SportSedan": (1.30, 2.55, 1.25),
    "SportHatch": (1.30, 2.85, 1.25),
    "SUV": (1.50, 2.55, 1.40),
    "Van": (1.50, 2.75, 1.45),
    "Delivery": (1.50, 3.25, 2.50),
}

POSITIONS = {
    "Sedan": (-6.6, -2.35, 0.0),
    "Taxi": (-2.25, -2.35, 0.0),
    "SportSedan": (2.1, -2.35, 0.0),
    "SportHatch": (6.45, -2.35, 0.0),
    "SUV": (-4.4, 2.2, 0.0),
    "Van": (0.0, 2.2, 0.0),
    "Delivery": (4.4, 2.2, 0.0),
}

WHEEL_SPECS = {
    "Sedan": (0.255, 0.17),
    "Taxi": (0.265, 0.17),
    "SportSedan": (0.255, 0.18),
    "SportHatch": (0.260, 0.18),
    "SUV": (0.300, 0.19),
    "Van": (0.290, 0.19),
    "Delivery": (0.325, 0.20),
}

CABINS = {
    "Sedan": dict(bottom_z=0.62, top_z=1.40, bw=1.50 * 0.78, tw=1.50 * 0.64, bl=2.55 * 0.47, tl=2.55 * 0.31, shift=0.0, split=0.50),
    "Taxi": dict(bottom_z=0.63, top_z=1.60, bw=1.50 * 0.78, tw=1.50 * 0.64, bl=2.75 * 0.47, tl=2.75 * 0.32, shift=0.0, split=0.50),
    "SportSedan": dict(bottom_z=0.54, top_z=1.18, bw=1.30 * 0.78, tw=1.30 * 0.62, bl=2.55 * 0.44, tl=2.55 * 0.28, shift=0.0, split=0.54),
    "SportHatch": dict(bottom_z=0.54, top_z=1.18, bw=1.30 * 0.78, tw=1.30 * 0.64, bl=2.85 * 0.55, tl=2.85 * 0.41, shift=2.85 * 0.08, split=0.48),
    "SUV": dict(bottom_z=0.58, top_z=1.35, bw=1.50 * 0.82, tw=1.50 * 0.70, bl=2.55 * 0.60, tl=2.55 * 0.48, shift=2.55 * 0.05, split=0.50),
    "Van": dict(bottom_z=0.58, top_z=1.41, bw=1.50 * 0.84, tw=1.50 * 0.76, bl=2.75 * 0.70, tl=2.75 * 0.60, shift=2.75 * 0.04, split=None),
    "Delivery": dict(bottom_z=0.61, top_z=1.48, bw=1.50 * 0.84, tw=1.50 * 0.73, bl=3.25 * 0.31, tl=3.25 * 0.23, shift=-3.25 * 0.29, split=None),
}


def redraw():
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            area.tag_redraw()


def set_status(message):
    bpy.context.scene["VISIBLE_CREATION_STATUS"] = message
    try:
        bpy.context.workspace.status_text_set(message)
    except Exception:
        pass
    redraw()


def material(name, color, metallic=0.0, roughness=0.8):
    value = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1.0)
    value.metallic = metallic
    value.roughness = roughness
    value.use_nodes = True
    principled = value.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = (*color, 1.0)
        principled.inputs["Roughness"].default_value = roughness
        principled.inputs["Metallic"].default_value = metallic
    return value


DETAIL_DARK = None
DETAIL_CHROME = None
DETAIL_HEADLIGHT = None
DETAIL_RED = None
DETAIL_AMBER = None
DETAIL_PLATE = None
DETAIL_ACCENT = None
DETAIL_SEAM = None


def stage_materials():
    global DETAIL_DARK, DETAIL_CHROME, DETAIL_HEADLIGHT, DETAIL_RED, DETAIL_AMBER, DETAIL_PLATE, DETAIL_ACCENT, DETAIL_SEAM
    DETAIL_DARK = material("MAT_V03_DarkTrim", (0.025, 0.035, 0.040), roughness=0.80)
    DETAIL_CHROME = material("MAT_V03_WheelMetal", (0.42, 0.48, 0.50), metallic=0.72, roughness=0.32)
    DETAIL_HEADLIGHT = material("MAT_V03_Headlight", (0.72, 0.90, 0.96), metallic=0.08, roughness=0.24)
    DETAIL_RED = material("MAT_V03_TailLamp", (0.58, 0.035, 0.025), roughness=0.30)
    DETAIL_AMBER = material("MAT_V03_AmberLamp", (0.95, 0.42, 0.045), roughness=0.34)
    DETAIL_PLATE = material("MAT_V03_Plate", (0.78, 0.80, 0.72), metallic=0.08, roughness=0.58)
    DETAIL_ACCENT = material("MAT_V03_ReviewAccent", (0.10, 0.36, 0.48), roughness=0.64)
    DETAIL_SEAM = material("MAT_V03_SubtleSeam", (0.10, 0.13, 0.14), roughness=0.82)


def move_to_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def mark_detail(obj):
    obj["checkpoint"] = "v03-details"
    obj["gameplay_readable_detail"] = True
    return obj


def add_box(name, location, dimensions, collection, mat, bevel=0.0, rotation=(0.0, 0.0, 0.0), parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0), rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    move_to_collection(obj, collection)
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(mat)
    if bevel > 0.0:
        modifier = obj.modifiers.new("DetailSoftEdges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return mark_detail(obj)


def add_cylinder(name, location, radius, depth, collection, mat, rotation, parent, vertices=12, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0.0, 0.0, 0.0), rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(mat)
    if bevel > 0.0:
        modifier = obj.modifiers.new("DetailCylinderEdge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return mark_detail(obj)


def add_torus(name, location, major_radius, minor_radius, collection, mat, parent):
    bpy.ops.mesh.primitive_torus_add(
        align="WORLD",
        major_segments=16,
        minor_segments=4,
        location=(0.0, 0.0, 0.0),
        rotation=(0.0, math.radians(90.0), 0.0),
        major_radius=major_radius,
        minor_radius=minor_radius,
    )
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(mat)
    return mark_detail(obj)


def remove_previous_details(name):
    for obj in list(bpy.data.objects):
        if obj.name.startswith(f"V03_{name}_"):
            bpy.data.objects.remove(obj, do_unlink=True)


def add_wheel_details(name, collection, root):
    width, length, _ = VEHICLES[name]
    radius, wheel_width = WHEEL_SPECS[name]
    wheel_y = length * 0.31
    center_x = width * (0.425 if name in {"SUV", "Van", "Delivery"} else 0.415)
    for side, side_name in ((-1.0, "L"), (1.0, "R")):
        face_x = side * (center_x + wheel_width * 0.66)
        for axle_y, axle_name in ((-wheel_y, "Front"), (wheel_y, "Rear")):
            add_torus(
                f"V03_{name}_RimRing_{axle_name}_{side_name}",
                (face_x, axle_y, radius),
                radius * 0.34,
                radius * 0.038,
                collection,
                DETAIL_CHROME,
                root,
            )
            add_cylinder(
                f"V03_{name}_CenterCap_{axle_name}_{side_name}",
                (face_x + side * 0.008, axle_y, radius),
                radius * 0.105,
                0.024,
                collection,
                DETAIL_DARK,
                (0.0, math.radians(90.0), 0.0),
                root,
                vertices=12,
                bevel=0.005,
            )
            for spoke_index, angle in enumerate((0.0, 45.0, 90.0, 135.0), start=1):
                add_box(
                    f"V03_{name}_WheelSpoke_{axle_name}_{side_name}_{spoke_index}",
                    (face_x, axle_y, radius),
                    (0.025, radius * 0.43, radius * 0.055),
                    collection,
                    DETAIL_CHROME,
                    bevel=0.008,
                    rotation=(math.radians(angle), 0.0, 0.0),
                    parent=root,
                )


def add_front_and_rear_details(name, collection, root):
    width, length, height = VEHICLES[name]
    front_y = -length * 0.505
    rear_y = length * 0.505
    commercial = name in {"Van", "Delivery"}
    sport = name in {"SportSedan", "SportHatch"}
    headlight_w = 0.30 if name in {"SUV", "Van", "Delivery"} else 0.25
    headlight_h = 0.17 if commercial else (0.12 if sport else 0.14)
    headlight_z = 0.57 if commercial else (0.46 if sport else 0.53)
    headlight_x = width * 0.31
    light_rotation = math.radians(8.0 if sport else 0.0)
    for side, suffix in ((-1.0, "L"), (1.0, "R")):
        add_box(
            f"V03_{name}_Headlight_{suffix}",
            (side * headlight_x, front_y, headlight_z),
            (headlight_w, 0.040, headlight_h),
            collection,
            DETAIL_HEADLIGHT,
            bevel=0.025,
            rotation=(0.0, side * light_rotation, 0.0),
            parent=root,
        )
        add_box(
            f"V03_{name}_FrontIndicator_{suffix}",
            (side * (headlight_x + headlight_w * 0.56), front_y - 0.004, headlight_z),
            (0.065, 0.044, headlight_h * 0.64),
            collection,
            DETAIL_AMBER,
            bevel=0.012,
            parent=root,
        )
        tail_w = 0.19 if sport else 0.22
        tail_h = 0.22 if name in {"SUV", "Van", "Delivery"} else 0.18
        add_box(
            f"V03_{name}_TailLamp_{suffix}",
            (side * width * 0.36, rear_y, 0.55 if commercial else 0.50),
            (tail_w, 0.042, tail_h),
            collection,
            DETAIL_RED,
            bevel=0.025,
            parent=root,
        )

    grille_width = width * (0.50 if sport else (0.46 if commercial else 0.40))
    grille_height = 0.22 if name in {"SUV", "Van", "Delivery"} else 0.17
    grille_z = 0.37 if commercial else (0.34 if sport else 0.39)
    add_box(
        f"V03_{name}_FrontGrille",
        (0.0, front_y - 0.006, grille_z),
        (grille_width, 0.048, grille_height),
        collection,
        DETAIL_DARK,
        bevel=0.025,
        parent=root,
    )
    bar_count = 3 if name not in {"SUV", "Delivery"} else 4
    if name in {"SUV", "Delivery"}:
        for index in range(bar_count):
            x = -grille_width * 0.33 + index * (grille_width * 0.66 / max(1, bar_count - 1))
            add_box(
                f"V03_{name}_GrilleBar_{index + 1}",
                (x, front_y - 0.034, grille_z),
                (0.035, 0.020, grille_height * 0.78),
                collection,
                DETAIL_CHROME,
                bevel=0.008,
                parent=root,
            )
    else:
        for index in range(bar_count):
            z = grille_z - grille_height * 0.26 + index * (grille_height * 0.26)
            add_box(
                f"V03_{name}_GrilleBar_{index + 1}",
                (0.0, front_y - 0.034, z),
                (grille_width * 0.86, 0.020, 0.022),
                collection,
                DETAIL_CHROME,
                bevel=0.006,
                parent=root,
            )

    for y, suffix in ((front_y - 0.040, "Front"), (rear_y + 0.040, "Rear")):
        add_box(
            f"V03_{name}_Plate_{suffix}",
            (0.0, y, 0.285),
            (0.35, 0.024, 0.12),
            collection,
            DETAIL_PLATE,
            bevel=0.018,
            parent=root,
        )


def add_side_details(name, collection, root):
    width, length, _ = VEHICLES[name]
    spec = CABINS[name]
    wheel_radius, _ = WHEEL_SPECS[name]
    wheel_y = length * 0.31
    # Seams are inset into the body surface; handles and tracks are allowed to
    # sit slightly proud. This prevents the seam from reading as a loose pole.
    side_x = width * 0.493
    seam_z = 0.63 if name in {"SportSedan", "SportHatch"} else 0.69
    front_door_y = spec["shift"] - spec["bl"] * 0.14
    rear_door_y = spec["shift"] + spec["bl"] * 0.24
    for side, suffix in ((-1.0, "L"), (1.0, "R")):
        if name not in {"Van", "Delivery"}:
            add_box(
                f"V03_{name}_DoorSeam_{suffix}",
                (side * side_x, spec["shift"], seam_z),
                (0.016, 0.020, 0.32),
                collection,
                DETAIL_SEAM,
                bevel=0.004,
                parent=root,
            )
            handle_positions = (front_door_y, rear_door_y)
        else:
            handle_positions = (front_door_y,)
        for index, handle_y in enumerate(handle_positions, start=1):
            add_box(
                f"V03_{name}_DoorHandle_{suffix}_{index}",
                (side * (side_x + 0.018), handle_y, seam_z + 0.08),
                (0.032, 0.17, 0.045),
                collection,
                DETAIL_DARK,
                bevel=0.015,
                parent=root,
            )
        rocker_length = max(0.30, wheel_y * 2.0 - wheel_radius * 2.65)
        add_box(
            f"V03_{name}_RockerTrim_{suffix}",
            (side * (side_x + 0.008), 0.0, 0.235),
            (0.018, rocker_length, 0.055),
            collection,
            DETAIL_SEAM,
            bevel=0.010,
            parent=root,
        )


def add_wipers(name, collection, root):
    spec = CABINS[name]
    front_bottom = spec["shift"] - spec["bl"] * 0.5 - 0.026
    bottom_z = spec["bottom_z"] + 0.095
    width, _, _ = VEHICLES[name]
    for side, suffix in ((-1.0, "L"), (1.0, "R")):
        add_box(
            f"V03_{name}_Wiper_{suffix}",
            (side * width * 0.18, front_bottom - 0.010, bottom_z),
            (width * 0.26, 0.018, 0.022),
            collection,
            DETAIL_DARK,
            bevel=0.006,
            rotation=(0.0, side * math.radians(8.0), 0.0),
            parent=root,
        )


def add_vehicle_specific_details(name, collection, root):
    width, length, _ = VEHICLES[name]
    if name == "Sedan":
        add_box("V03_Sedan_TrunkLip", (0.0, length * 0.455, 0.70), (width * 0.62, 0.07, 0.055), collection, DETAIL_ACCENT, 0.014, parent=root)
    elif name == "Taxi":
        for side, suffix in ((-1.0, "L"), (1.0, "R")):
            add_box(f"V03_Taxi_DoorPlacard_{suffix}", (side * width * 0.515, 0.16, 0.52), (0.025, 0.38, 0.23), collection, DETAIL_PLATE, 0.018, parent=root)
        add_box("V03_Taxi_RoofSignFrame", (0.0, 0.0, 1.62), (0.44, 0.28, 0.06), collection, DETAIL_DARK, 0.018, parent=root)
    elif name in {"SportSedan", "SportHatch"}:
        add_box(f"V03_{name}_FrontSplitter", (0.0, -length * 0.515, 0.20), (width * 0.90, 0.16, 0.06), collection, DETAIL_DARK, 0.020, parent=root)
        for side, suffix in ((-1.0, "L"), (1.0, "R")):
            add_cylinder(f"V03_{name}_Exhaust_{suffix}", (side * width * 0.25, length * 0.515, 0.22), 0.055, 0.14, collection, DETAIL_CHROME, (math.radians(90.0), 0.0, 0.0), root, vertices=12, bevel=0.008)
    elif name == "SUV":
        add_box("V03_SUV_FrontSkidPlate", (0.0, -length * 0.515, 0.24), (width * 0.44, 0.08, 0.12), collection, DETAIL_CHROME, 0.022, parent=root)
        add_box("V03_SUV_RearSkidPlate", (0.0, length * 0.515, 0.24), (width * 0.44, 0.08, 0.12), collection, DETAIL_CHROME, 0.022, parent=root)
        for side, suffix in ((-1.0, "L"), (1.0, "R")):
            add_box(f"V03_SUV_FogLamp_{suffix}", (side * width * 0.27, -length * 0.516, 0.30), (0.14, 0.035, 0.09), collection, DETAIL_HEADLIGHT, 0.025, parent=root)
    elif name == "Van":
        for side, suffix in ((-1.0, "L"), (1.0, "R")):
            add_box(f"V03_Van_SlidingDoorTrack_{suffix}", (side * width * 0.512, 0.50, 0.89), (0.025, 0.90, 0.045), collection, DETAIL_DARK, 0.010, parent=root)
            add_box(f"V03_Van_CargoDoorSeam_{suffix}", (side * width * 0.493, 0.72, 0.59), (0.012, 0.018, 0.38), collection, DETAIL_SEAM, 0.003, parent=root)
        add_box("V03_Van_RearDoorSplit", (0.0, length * 0.514, 0.76), (0.020, 0.018, 0.68), collection, DETAIL_SEAM, 0.004, parent=root)
    elif name == "Delivery":
        for side, suffix in ((-1.0, "L"), (1.0, "R")):
            add_box(f"V03_Delivery_CargoCorner_{suffix}", (side * width * 0.47, length * 0.455, 1.46), (0.045, 0.045, 1.58), collection, DETAIL_CHROME, 0.009, parent=root)
        marker_y = CABINS["Delivery"]["shift"] - CABINS["Delivery"]["tl"] * 0.5 - 0.025
        for index, marker_x in enumerate((-width * 0.27, 0.0, width * 0.27), start=1):
            add_box(f"V03_Delivery_CabMarker_{index}", (marker_x, marker_y, 1.435), (0.09, 0.030, 0.050), collection, DETAIL_AMBER, 0.014, parent=root)
        add_box("V03_Delivery_RearStep", (0.0, length * 0.515, 0.23), (width * 0.76, 0.20, 0.09), collection, DETAIL_DARK, 0.020, parent=root)
        add_box("V03_Delivery_RollDoorHandle", (0.0, length * 0.520, 0.72), (0.42, 0.035, 0.06), collection, DETAIL_DARK, 0.014, parent=root)


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def camera(name, location, target, angle=50.0):
    obj = bpy.data.objects.get(name)
    if obj is None:
        data = bpy.data.cameras.new(name)
        obj = bpy.data.objects.new(name, data)
        bpy.context.scene.collection.objects.link(obj)
    obj.data.type = "PERSP"
    obj.data.angle = math.radians(angle)
    obj.location = location
    point_at(obj, target)
    return obj


def configure_view(camera_obj):
    bpy.context.scene.camera = camera_obj
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type != "VIEW_3D":
                continue
            overlay = area.spaces.active.overlay
            overlay.show_relationship_lines = False
            overlay.show_extras = False
            overlay.show_outline_selected = False
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.region_3d.view_camera_zoom = 6
            try:
                area.spaces.active.shading.type = "RENDERED"
            except Exception:
                area.spaces.active.shading.type = "MATERIAL"
            area.tag_redraw()


def focus_vehicle(name):
    x, y, _ = POSITIONS[name]
    _, length, height = VEHICLES[name]
    root = bpy.data.objects.get(f"Vehicle_{name}_ROOT")
    factor = root.scale.x if root else 1.0
    camera_obj = camera(
        "DetailLiveCamera",
        (x + 3.2 * factor, y - 4.1 * factor, max(2.35, height * factor * 1.48)),
        (x, y, height * factor * 0.48),
        48.0,
    )
    configure_view(camera_obj)


def build_vehicle_details(name):
    collection = bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure")
    root = bpy.data.objects.get(f"Vehicle_{name}_ROOT")
    if collection is None or root is None:
        raise RuntimeError(f"Missing approved v02 vehicle structure for {name}")
    focus_vehicle(name)
    remove_previous_details(name)
    add_front_and_rear_details(name, collection, root)
    add_side_details(name, collection, root)
    add_wipers(name, collection, root)
    add_wheel_details(name, collection, root)
    add_vehicle_specific_details(name, collection, root)
    root["checkpoint"] = "v03-details"
    root["detail_pass"] = "lights, grille, plate, doors, handles, wipers, rim detail, vehicle-specific hardware"
    set_status(f"v03 details — {name} complete ({list(VEHICLES).index(name) + 1}/7)")


def prepare_revision():
    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v03-details"
    scene["STATUS"] = "BUILDING_DETAILS_VISIBLY"
    scene["DETAIL_SCOPE"] = "readable lighting, grilles, plates, doors, handles, wipers, wheel faces and vehicle-specific equipment"
    title = bpy.data.objects.get("Title")
    if title and title.type == "FONT":
        title.data.body = "YUN VEHICLE FAMILY — v03 DETAILS — OWNER REVIEW"
    stage_materials()
    focus_vehicle("Sedan")
    set_status("v03 details — starting visibly with Sedan")


def render(path, camera_obj, resolution=(1440, 900)):
    scene = bpy.context.scene
    scene.camera = camera_obj
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = resolution[0]
    scene.render.resolution_y = resolution[1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(path)
    scene.render.film_transparent = False
    bpy.ops.render.render(write_still=True)


def render_individual_views():
    camera_obj = bpy.data.objects.get("V03VehicleInspectionCamera")
    if camera_obj is None:
        data = bpy.data.cameras.new("V03VehicleInspectionCamera")
        camera_obj = bpy.data.objects.new("V03VehicleInspectionCamera", data)
        bpy.context.scene.collection.objects.link(camera_obj)
    camera_obj.data.type = "ORTHO"
    collections = {name: bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure") for name in VEHICLES}
    for name, (width, length, height) in VEHICLES.items():
        root = bpy.data.objects.get(f"Vehicle_{name}_ROOT")
        factor = root.scale.x if root else 1.0
        x, y, _ = POSITIONS[name]
        for other_name, collection in collections.items():
            if collection:
                collection.hide_render = other_name != name
        camera_obj.data.ortho_scale = max(3.15, length * factor * 1.18, height * factor * 1.75)
        camera_obj.location = (x + 3.5, y - 4.3, max(2.35, height * factor * 1.58))
        point_at(camera_obj, (x, y, height * factor * 0.47))
        render(OUTPUT_DIR / f"v03-details-{name.lower()}.png", camera_obj, resolution=(960, 720))
    for collection in collections.values():
        if collection:
            collection.hide_render = False


def save_revision():
    scene = bpy.context.scene
    lineup = bpy.data.objects.get("BlockoutLineupCamera")
    gameplay = bpy.data.objects.get("YunGameplayCamera46Degrees")
    live = bpy.data.objects.get("DetailLiveCamera")
    if lineup is None or gameplay is None or live is None:
        raise RuntimeError("v03 review cameras are missing")
    rear = camera("V03RearReviewCamera", (-11.5, 12.8, 6.2), (0.0, 0.0, 0.82), 50.0)
    render(LINEUP_RENDER, lineup)
    render(GAMEPLAY_RENDER, gameplay)
    render(REAR_RENDER, rear)
    render_individual_views()
    scene["STATUS"] = "AWAITING_OWNER_REVIEW"
    scene.camera = live
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    configure_view(live)
    DONE_FLAG.write_text("AWAITING_OWNER_REVIEW\n", encoding="utf-8")
    set_status("v03 details complete — AWAITING OWNER REVIEW")


steps = [
    prepare_revision,
    lambda: build_vehicle_details("Sedan"),
    lambda: build_vehicle_details("Taxi"),
    lambda: build_vehicle_details("SportSedan"),
    lambda: build_vehicle_details("SportHatch"),
    lambda: build_vehicle_details("SUV"),
    lambda: build_vehicle_details("Van"),
    lambda: build_vehicle_details("Delivery"),
    save_revision,
]
step_index = 0


def run_next():
    global step_index
    if step_index >= len(steps):
        return None
    try:
        steps[step_index]()
        step_index += 1
        return 2.0 if step_index < len(steps) else None
    except Exception as error:
        ERROR_FILE.write_text(f"Step {step_index + 1}: {type(error).__name__}: {error}\n", encoding="utf-8")
        set_status(f"v03 detail pass failed: {error}")
        raise


for stale in (DONE_FLAG, ERROR_FILE):
    if stale.exists():
        stale.unlink()
set_status("Yun vehicle v03 details — starting visibly in four seconds")
bpy.app.timers.register(run_next, first_interval=4.0)
