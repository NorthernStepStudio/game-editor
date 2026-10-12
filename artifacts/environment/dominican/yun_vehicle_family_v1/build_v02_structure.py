import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(r"D:\dev\Northern Step Studio")
OUTPUT_DIR = ROOT / "artifacts" / "environment" / "dominican" / "yun_vehicle_family_v1"
BLEND_PATH = OUTPUT_DIR / "v02-structure.blend"
LINEUP_RENDER = OUTPUT_DIR / "v02-structure-lineup.png"
GAMEPLAY_RENDER = OUTPUT_DIR / "v02-structure-gameplay.png"
DONE_FLAG = OUTPUT_DIR / "v02-structure-ready.flag"
ERROR_FILE = OUTPUT_DIR / "v02-structure-error.txt"

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


BODY = None
GLASS = None
DARK = None
ACCENT = None


def stage_materials():
    global BODY, GLASS, DARK, ACCENT
    BODY = material("MAT_StructureBody", (0.23, 0.42, 0.54), roughness=0.78)
    GLASS = material("MAT_StructureGlass", (0.035, 0.10, 0.15), roughness=0.45)
    DARK = material("MAT_StructureDark", (0.035, 0.045, 0.055), roughness=0.86)
    ACCENT = material("MAT_StructureAccent", (0.78, 0.39, 0.08), roughness=0.72)
    bpy.context.scene["CHECKPOINT"] = "v02-structure"
    bpy.context.scene["STATUS"] = "BUILDING_VISIBLE_STRUCTURE"
    bpy.context.scene["STRUCTURE_SCOPE"] = (
        "body profile, cabin taper, glass openings, bumpers, wheel surrounds, vehicle-specific major forms"
    )
    title = bpy.data.objects.get("Title")
    if title and title.type == "FONT":
        title.data.body = "YUN VEHICLE FAMILY — v02 STRUCTURE"
    set_status("v02 structure — major vehicle forms starting visibly")


def move_to_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def add_box(name, location, dimensions, collection, mat, bevel=0.0, rotation=(0.0, 0.0, 0.0), parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0.0:
        modifier = obj.modifiers.new("StructureSoftEdges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    move_to_collection(obj, collection)
    obj.data.materials.append(mat)
    if parent is not None:
        obj.parent = parent
    return obj


def add_tapered_cabin(
    name,
    center,
    bottom_width,
    top_width,
    bottom_length,
    top_length,
    bottom_z,
    top_z,
    collection,
    parent,
    y_shift=0.0,
):
    x, y, _ = center
    y += y_shift
    bw = bottom_width * 0.5
    tw = top_width * 0.5
    bl = bottom_length * 0.5
    tl = top_length * 0.5
    vertices = [
        (x - bw, y - bl, bottom_z),
        (x + bw, y - bl, bottom_z),
        (x + bw, y + bl, bottom_z),
        (x - bw, y + bl, bottom_z),
        (x - tw, y - tl, top_z),
        (x + tw, y - tl, top_z),
        (x + tw, y + tl, top_z),
        (x - tw, y + tl, top_z),
    ]
    faces = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (4, 0, 3, 7),
    ]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(BODY)
    obj.parent = parent
    bevel = obj.modifiers.new("StructureCabinEdges", "BEVEL")
    bevel.width = 0.035
    bevel.segments = 2
    return obj


def add_window_panel(name, corners, collection, parent):
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    # Duplicate the face with a slight normal offset is unnecessary at v02;
    # the panel sits just outside the body surface.
    mesh.from_pydata(corners, [], [(0, 1, 2, 3)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(GLASS)
    obj.parent = parent
    solidify = obj.modifiers.new("WindowThickness", "SOLIDIFY")
    solidify.thickness = 0.018
    return obj


def remove_old_upper_forms(name):
    prefixes = (
        f"{name}_Cabin",
        f"{name}_UpperCabin",
        f"{name}_CargoBox",
        f"{name}_Windshield",
    )
    for obj in list(bpy.data.objects):
        if obj.name.startswith(prefixes):
            bpy.data.objects.remove(obj, do_unlink=True)


def collection_for(name):
    candidates = [
        bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Blockout"),
        bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure"),
    ]
    collection = next((item for item in candidates if item is not None), None)
    if collection is None:
        raise RuntimeError(f"Missing v01 collection for {name}")
    collection.name = f"EXPORT_Vehicle_{name}_Structure"
    return collection


def add_axle_fenders(name, x, y, width, length, height, collection, root):
    wheel_y = length * 0.31
    for axle_y, axle_name in ((-wheel_y, "Front"), (wheel_y, "Rear")):
        add_box(
            f"{name}_{axle_name}Fender",
            (x, y + axle_y, height * 0.29),
            (width * 0.98, 0.36, max(0.20, height * 0.18)),
            collection,
            BODY,
            bevel=0.06,
            parent=root,
        )


def add_bumpers(name, x, y, width, length, height, collection, root):
    bumper_z = max(0.24, height * 0.20)
    for sign, suffix in ((-1.0, "Front"), (1.0, "Rear")):
        add_box(
            f"{name}_{suffix}Bumper",
            (x, y + sign * length * 0.47, bumper_z),
            (width * 0.88, 0.10, 0.14),
            collection,
            DARK,
            bevel=0.025,
            parent=root,
        )


def add_side_glass(name, x, y, side_x, bottom_z, top_z, cabin_length, collection, root, split=True):
    inset = 0.06
    front_y = y - cabin_length * 0.40
    rear_y = y + cabin_length * 0.40
    middle_y = y + (0.02 if split else 0.0)
    for side, suffix in ((-1.0, "L"), (1.0, "R")):
        x_pos = x + side * side_x
        if split:
            add_window_panel(
                f"{name}_SideWindowFront_{suffix}",
                [
                    (x_pos, front_y, bottom_z),
                    (x_pos, middle_y - inset, bottom_z),
                    (x_pos, middle_y - inset * 1.5, top_z),
                    (x_pos, front_y + inset, top_z),
                ],
                collection,
                root,
            )
            add_window_panel(
                f"{name}_SideWindowRear_{suffix}",
                [
                    (x_pos, middle_y + inset, bottom_z),
                    (x_pos, rear_y, bottom_z),
                    (x_pos, rear_y - inset, top_z),
                    (x_pos, middle_y + inset * 1.5, top_z),
                ],
                collection,
                root,
            )
        else:
            add_window_panel(
                f"{name}_SideWindow_{suffix}",
                [
                    (x_pos, front_y, bottom_z),
                    (x_pos, rear_y, bottom_z),
                    (x_pos, rear_y - inset, top_z),
                    (x_pos, front_y + inset, top_z),
                ],
                collection,
                root,
            )


def add_front_rear_glass(name, x, y, width, bottom_z, top_z, bottom_length, top_length, collection, root):
    bottom_front = y - bottom_length * 0.5 - 0.012
    top_front = y - top_length * 0.5 - 0.012
    bottom_rear = y + bottom_length * 0.5 + 0.012
    top_rear = y + top_length * 0.5 + 0.012
    panel_width = width * 0.68
    add_window_panel(
        f"{name}_FrontWindshield",
        [
            (x - panel_width * 0.5, bottom_front, bottom_z),
            (x + panel_width * 0.5, bottom_front, bottom_z),
            (x + panel_width * 0.5, top_front, top_z),
            (x - panel_width * 0.5, top_front, top_z),
        ],
        collection,
        root,
    )
    add_window_panel(
        f"{name}_RearWindow",
        [
            (x + panel_width * 0.5, bottom_rear, bottom_z),
            (x - panel_width * 0.5, bottom_rear, bottom_z),
            (x - panel_width * 0.5, top_rear, top_z),
            (x + panel_width * 0.5, top_rear, top_z),
        ],
        collection,
        root,
    )


def build_passenger_structure(name, profile):
    width, length, height = VEHICLES[name]
    x, y, _ = POSITIONS[name]
    collection = collection_for(name)
    root = bpy.data.objects.get(f"Vehicle_{name}_ROOT")
    if root is None:
        raise RuntimeError(f"Missing vehicle root for {name}")
    remove_old_upper_forms(name)

    bottom_z = profile["bottom_z"]
    top_z = height - profile.get("roof_inset", 0.05)
    bottom_length = length * profile["bottom_length"]
    top_length = length * profile["top_length"]
    bottom_width = width * profile.get("bottom_width", 0.78)
    top_width = width * profile.get("top_width", 0.66)
    y_shift = length * profile.get("y_shift", 0.0)

    add_tapered_cabin(
        f"{name}_CabinShell",
        (x, y, 0.0),
        bottom_width,
        top_width,
        bottom_length,
        top_length,
        bottom_z,
        top_z,
        collection,
        root,
        y_shift=y_shift,
    )
    cabin_y = y + y_shift
    add_front_rear_glass(
        name,
        x,
        cabin_y,
        width,
        bottom_z + 0.07,
        top_z - 0.08,
        bottom_length,
        top_length,
        collection,
        root,
    )
    add_side_glass(
        name,
        x,
        cabin_y,
        bottom_width * 0.505,
        bottom_z + 0.08,
        top_z - 0.09,
        bottom_length,
        collection,
        root,
        split=profile.get("split_glass", True),
    )
    add_axle_fenders(name, x, y, width, length, height, collection, root)
    add_bumpers(name, x, y, width, length, height, collection, root)

    if name == "Sedan":
        add_box("Sedan_TrunkDeck", (x, y + length * 0.36, height * 0.49), (width * 0.80, length * 0.18, 0.12), collection, BODY, bevel=0.035, parent=root)
    elif name == "Taxi":
        sign = bpy.data.objects.get("Taxi_RoofSign_Blockout")
        if sign:
            sign.name = "Taxi_RoofSign_Structure"
            sign.data.materials.clear()
            sign.data.materials.append(ACCENT)
        add_box("Taxi_RearDeck", (x, y + length * 0.36, height * 0.49), (width * 0.82, length * 0.17, 0.12), collection, BODY, bevel=0.035, parent=root)
    elif name == "SportSedan":
        add_box("SportSedan_FrontSplitter", (x, y - length * 0.485, height * 0.115), (width * 0.96, 0.16, 0.07), collection, DARK, bevel=0.015, parent=root)
        add_box("SportSedan_SideSkirt_L", (x - width * 0.455, y, height * 0.17), (0.07, length * 0.68, 0.10), collection, DARK, bevel=0.015, parent=root)
        add_box("SportSedan_SideSkirt_R", (x + width * 0.455, y, height * 0.17), (0.07, length * 0.68, 0.10), collection, DARK, bevel=0.015, parent=root)
    elif name == "SportHatch":
        old_spoiler = bpy.data.objects.get("SportHatch_RearSpoiler")
        if old_spoiler is not None:
            bpy.data.objects.remove(old_spoiler, do_unlink=True)
        wing_y = y + length * 0.22
        wing_z = top_z + 0.015
        add_box("SportHatch_RearRoofWing", (x, wing_y, wing_z), (width * 0.76, 0.16, 0.065), collection, ACCENT, bevel=0.018, parent=root)
        for support_x, suffix in ((-width * 0.25, "L"), (width * 0.25, "R")):
            add_box(
                f"SportHatch_WingSupport_{suffix}",
                (x + support_x, wing_y, top_z - 0.035),
                (0.045, 0.055, 0.11),
                collection,
                DARK,
                bevel=0.01,
                parent=root,
            )
        add_box("SportHatch_RearHatchMass", (x, y + length * 0.28, height * 0.58), (width * 0.78, length * 0.20, height * 0.34), collection, BODY, bevel=0.045, parent=root)
    elif name == "SUV":
        for side_x, suffix in ((-width * 0.32, "L"), (width * 0.32, "R")):
            add_box(f"SUV_RoofRail_{suffix}", (x + side_x, cabin_y, top_z + 0.035), (0.055, top_length * 0.92, 0.07), collection, DARK, bevel=0.015, parent=root)
        add_box("SUV_RearCargoMass", (x, y + length * 0.29, height * 0.57), (width * 0.80, length * 0.18, height * 0.42), collection, BODY, bevel=0.045, parent=root)

    root["checkpoint"] = "v02-structure"
    set_status(f"v02 structure — {name} major forms complete ({list(VEHICLES).index(name) + 1}/7)")


def build_van_structure():
    name = "Van"
    width, length, height = VEHICLES[name]
    x, y, _ = POSITIONS[name]
    collection = collection_for(name)
    root = bpy.data.objects.get("Vehicle_Van_ROOT")
    remove_old_upper_forms(name)
    bottom_z = 0.58
    top_z = height - 0.04
    bottom_length = length * 0.70
    top_length = length * 0.60
    add_tapered_cabin("Van_BodyShell", (x, y, 0.0), width * 0.84, width * 0.76, bottom_length, top_length, bottom_z, top_z, collection, root, y_shift=length * 0.04)
    add_front_rear_glass(name, x, y + length * 0.04, width, bottom_z + 0.08, top_z - 0.10, bottom_length, top_length, collection, root)
    add_side_glass(name, x, y - length * 0.13, width * 0.425, bottom_z + 0.10, top_z - 0.12, length * 0.31, collection, root, split=False)
    for side, suffix in ((-1.0, "L"), (1.0, "R")):
        add_box(f"Van_SlidingDoor_{suffix}", (x + side * width * 0.445, y + length * 0.20, height * 0.62), (0.025, length * 0.32, height * 0.52), collection, BODY, bevel=0.012, parent=root)
    add_axle_fenders(name, x, y, width, length, height, collection, root)
    add_bumpers(name, x, y, width, length, height, collection, root)
    root["checkpoint"] = "v02-structure"
    set_status("v02 structure — Van major forms complete (6/7)")


def build_delivery_structure():
    name = "Delivery"
    width, length, height = VEHICLES[name]
    x, y, _ = POSITIONS[name]
    collection = collection_for(name)
    root = bpy.data.objects.get("Vehicle_Delivery_ROOT")
    remove_old_upper_forms(name)

    cab_bottom = 0.61
    cab_top = 1.48
    cab_bottom_length = length * 0.31
    cab_top_length = length * 0.23
    cab_y = y - length * 0.29
    add_tapered_cabin("Delivery_CabShell", (x, cab_y, 0.0), width * 0.84, width * 0.73, cab_bottom_length, cab_top_length, cab_bottom, cab_top, collection, root)
    add_front_rear_glass("DeliveryCab", x, cab_y, width, cab_bottom + 0.08, cab_top - 0.10, cab_bottom_length, cab_top_length, collection, root)
    add_side_glass("DeliveryCab", x, cab_y, width * 0.425, cab_bottom + 0.10, cab_top - 0.12, cab_bottom_length, collection, root, split=False)

    cargo_length = length * 0.56
    cargo_height = height - 0.62
    cargo_y = y + length * 0.18
    add_box("Delivery_CargoBody", (x, cargo_y, 0.62 + cargo_height * 0.5), (width * 0.90, cargo_length, cargo_height), collection, BODY, bevel=0.055, parent=root)
    add_box("Delivery_CargoRoofCap", (x, cargo_y, height - 0.04), (width * 0.94, cargo_length * 1.01, 0.09), collection, DARK, bevel=0.025, parent=root)
    add_box("Delivery_RearRollDoor", (x, y + length * 0.465, 1.42), (width * 0.76, 0.035, 1.43), collection, DARK, bevel=0.025, parent=root)
    add_box("Delivery_CabStep_L", (x - width * 0.48, cab_y, 0.28), (0.12, cab_bottom_length * 0.76, 0.10), collection, DARK, bevel=0.015, parent=root)
    add_box("Delivery_CabStep_R", (x + width * 0.48, cab_y, 0.28), (0.12, cab_bottom_length * 0.76, 0.10), collection, DARK, bevel=0.015, parent=root)
    add_axle_fenders(name, x, y, width, length, height, collection, root)
    add_bumpers(name, x, y, width, length, height, collection, root)
    root["checkpoint"] = "v02-structure"
    set_status("v02 structure — Delivery major forms complete (7/7)")


def normalize_vehicle_roots():
    """Make every asset local to its root while preserving the review layout.

    The v01 sheet placed child geometry and its parent at the same review
    coordinates, so the review transform was applied twice. This removes the
    duplicate offset from every child and keeps the root at the intended Yun
    review position. Each vehicle is now reusable around a local origin.
    """
    for name in VEHICLES:
        root = bpy.data.objects.get(f"Vehicle_{name}_ROOT")
        if root is None:
            raise RuntimeError(f"Missing vehicle root for {name}")
        offset = root.location.copy()
        for child in list(root.children):
            child.location.x -= offset.x
            child.location.y -= offset.y
            child.location.z -= offset.z
        root["geometry_local_to_root"] = True
        root["review_position_xyz"] = tuple(offset)
    bpy.context.view_layer.update()
    set_status("v02 structure — duplicate review offsets fixed; all seven assets are local to their roots")


PASSENGER_PROFILES = {
    "Sedan": {"bottom_z": 0.62, "bottom_length": 0.47, "top_length": 0.31, "top_width": 0.64},
    "Taxi": {"bottom_z": 0.63, "bottom_length": 0.47, "top_length": 0.32, "top_width": 0.64},
    "SportSedan": {"bottom_z": 0.54, "bottom_length": 0.44, "top_length": 0.28, "top_width": 0.62, "roof_inset": 0.07},
    "SportHatch": {"bottom_z": 0.54, "bottom_length": 0.55, "top_length": 0.41, "top_width": 0.64, "y_shift": 0.08, "split_glass": False, "roof_inset": 0.07},
    "SUV": {"bottom_z": 0.58, "bottom_length": 0.60, "top_length": 0.48, "bottom_width": 0.82, "top_width": 0.70, "y_shift": 0.05, "split_glass": True},
}


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def render(path, camera, resolution=(1440, 900)):
    scene = bpy.context.scene
    scene.camera = camera
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
    camera = bpy.data.objects.get("VehicleInspectionCamera")
    if camera is None:
        data = bpy.data.cameras.new("VehicleInspectionCamera")
        camera = bpy.data.objects.new("VehicleInspectionCamera", data)
        bpy.context.scene.collection.objects.link(camera)
    camera.data.type = "ORTHO"
    vehicle_collections = {
        name: bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure")
        for name in VEHICLES
    }
    for name in VEHICLES:
        x, y, _ = POSITIONS[name]
        width, length, height = VEHICLES[name]
        for other_name, collection in vehicle_collections.items():
            if collection is not None:
                collection.hide_render = other_name != name
        camera.data.ortho_scale = max(3.1, width * 2.25, length * 1.28, height * 1.75)
        camera.location = (x + 3.4, y - 4.7, max(2.8, height * 1.85))
        point_at(camera, (x, y, height * 0.48))
        render(OUTPUT_DIR / f"v02-structure-{name.lower()}.png", camera, resolution=(960, 720))
    for collection in vehicle_collections.values():
        if collection is not None:
            collection.hide_render = False


def save_checkpoint():
    scene = bpy.context.scene
    scene["STATUS"] = "AWAITING_OWNER_REVIEW"
    lineup_camera = bpy.data.objects.get("BlockoutLineupCamera")
    gameplay_camera = bpy.data.objects.get("YunGameplayCamera46Degrees")
    if lineup_camera is None or gameplay_camera is None:
        raise RuntimeError("v01 review cameras are missing")
    lineup_camera.location = (10.8, -16.8, 11.8)
    lineup_camera.data.angle = math.radians(53.0)
    point_at(lineup_camera, (0.0, 0.0, 0.68))
    gameplay_camera.location = (0.0, -20.8, 9.6)
    gameplay_camera.data.angle = math.radians(46.0)
    point_at(gameplay_camera, (0.0, 0.0, 0.72))
    render(LINEUP_RENDER, lineup_camera)
    render(GAMEPLAY_RENDER, gameplay_camera)
    render_individual_views()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    scene.camera = lineup_camera
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type != "VIEW_3D":
                continue
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.region_3d.view_camera_zoom = 7
            try:
                area.spaces.active.shading.type = "RENDERED"
            except Exception:
                area.spaces.active.shading.type = "MATERIAL"
            area.tag_redraw()
    DONE_FLAG.write_text("AWAITING_OWNER_REVIEW\n", encoding="utf-8")
    set_status("v02 seven-vehicle structure visible — AWAITING OWNER REVIEW")


steps = [
    stage_materials,
    lambda: build_passenger_structure("Sedan", PASSENGER_PROFILES["Sedan"]),
    lambda: build_passenger_structure("Taxi", PASSENGER_PROFILES["Taxi"]),
    lambda: build_passenger_structure("SportSedan", PASSENGER_PROFILES["SportSedan"]),
    lambda: build_passenger_structure("SportHatch", PASSENGER_PROFILES["SportHatch"]),
    lambda: build_passenger_structure("SUV", PASSENGER_PROFILES["SUV"]),
    build_van_structure,
    build_delivery_structure,
    normalize_vehicle_roots,
    save_checkpoint,
]
step_index = 0


def run_next():
    global step_index
    if step_index >= len(steps):
        return None
    try:
        steps[step_index]()
        step_index += 1
        return 1.35 if step_index < len(steps) else None
    except Exception as error:
        ERROR_FILE.write_text(
            f"Step {step_index + 1}: {type(error).__name__}: {error}\n",
            encoding="utf-8",
        )
        set_status(f"v02 vehicle structure failed: {error}")
        raise


for stale in (DONE_FLAG, ERROR_FILE):
    if stale.exists():
        stale.unlink()
set_status("Yun vehicle v02 structure — starting visibly in four seconds")
bpy.app.timers.register(run_next, first_interval=4.0)
