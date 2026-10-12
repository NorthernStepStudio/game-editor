import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(r"D:\dev\Northern Step Studio")
OUTPUT_DIR = ROOT / "artifacts" / "environment" / "dominican" / "yun_vehicle_family_v1"
BLEND_PATH = OUTPUT_DIR / "v02-structure-r3.blend"
LINEUP_RENDER = OUTPUT_DIR / "v02-structure-r3-lineup.png"
GAMEPLAY_RENDER = OUTPUT_DIR / "v02-structure-r3-gameplay.png"
DONE_FLAG = OUTPUT_DIR / "v02-structure-r3-ready.flag"
ERROR_FILE = OUTPUT_DIR / "v02-structure-r3-error.txt"

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

# Uniform scaling keeps the new wheels round. Only the visibly undersized
# candidates are enlarged; the taxi and delivery truck already read correctly.
SCALE_FACTORS = {
    "Sedan": 1.04,
    "Taxi": 1.00,
    "SportSedan": 1.10,
    "SportHatch": 1.10,
    "SUV": 1.08,
    "Van": 1.06,
    "Delivery": 1.00,
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

FRONT_GLASS = {
    "Sedan": dict(bz=0.735, tz=1.285, bw=1.50 * 0.78, tw=1.50 * 0.64, bl=2.55 * 0.47, tl=2.55 * 0.31, shift=0.0),
    "Taxi": dict(bz=0.745, tz=1.485, bw=1.50 * 0.78, tw=1.50 * 0.64, bl=2.75 * 0.47, tl=2.75 * 0.32, shift=0.0),
    "SportSedan": dict(bz=0.655, tz=1.065, bw=1.30 * 0.78, tw=1.30 * 0.62, bl=2.55 * 0.44, tl=2.55 * 0.28, shift=0.0),
    "SportHatch": dict(bz=0.655, tz=1.065, bw=1.30 * 0.78, tw=1.30 * 0.64, bl=2.85 * 0.55, tl=2.85 * 0.41, shift=2.85 * 0.08),
    "SUV": dict(bz=0.705, tz=1.235, bw=1.50 * 0.82, tw=1.50 * 0.70, bl=2.55 * 0.60, tl=2.55 * 0.48, shift=2.55 * 0.05),
    "Van": dict(bz=0.705, tz=1.285, bw=1.50 * 0.84, tw=1.50 * 0.76, bl=2.75 * 0.70, tl=2.75 * 0.60, shift=2.75 * 0.04),
    "Delivery": dict(bz=0.735, tz=1.355, bw=1.50 * 0.84, tw=1.50 * 0.73, bl=3.25 * 0.31, tl=3.25 * 0.23, shift=-3.25 * 0.29),
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


def move_to_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def remove_named(predicate):
    for obj in list(bpy.data.objects):
        if predicate(obj.name):
            bpy.data.objects.remove(obj, do_unlink=True)


def add_box(name, location, dimensions, collection, mat, bevel=0.0, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("StructureSoftEdges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    move_to_collection(obj, collection)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def add_panel(name, corners, collection, root, glass):
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(corners, [], [(0, 1, 2, 3)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = root
    obj.data.materials.append(glass)
    solidify = obj.modifiers.new("FlushGlassThickness", "SOLIDIFY")
    solidify.thickness = 0.014
    solidify.offset = 0.0
    bevel = obj.modifiers.new("GlassEdgeSoftening", "BEVEL")
    bevel.width = 0.012
    bevel.segments = 2
    obj["window_revision"] = "v02-structure-r3"
    return obj


def add_wheel(name, location, radius, width, collection, root, tire, hub, outward_sign):
    # A 16-sided tire and separate hub replace the buried blockout discs.
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16,
        radius=radius,
        depth=width,
        location=location,
        rotation=(0.0, math.radians(90.0), 0.0),
    )
    wheel = bpy.context.object
    wheel.name = name
    move_to_collection(wheel, collection)
    wheel.data.materials.append(tire)
    wheel.parent = root
    bevel = wheel.modifiers.new("TireShoulder", "BEVEL")
    bevel.width = radius * 0.12
    bevel.segments = 2

    hub_x = location[0] + outward_sign * (width * 0.53)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12,
        radius=radius * 0.49,
        depth=width * 0.20,
        location=(hub_x, location[1], location[2]),
        rotation=(0.0, math.radians(90.0), 0.0),
    )
    hub_obj = bpy.context.object
    hub_obj.name = f"{name}_Hub"
    move_to_collection(hub_obj, collection)
    hub_obj.data.materials.append(hub)
    hub_obj.parent = root
    hub_bevel = hub_obj.modifiers.new("HubEdge", "BEVEL")
    hub_bevel.width = radius * 0.055
    hub_bevel.segments = 2


def correct_front_glass(name, collection, root, glass):
    remove_named(
        lambda object_name: object_name.startswith((name, "DeliveryCab" if name == "Delivery" else "__never__"))
        and "FrontWindshield" in object_name
    )
    spec = FRONT_GLASS[name]
    bottom_half = spec["bw"] * 0.5 - 0.075
    top_half = spec["tw"] * 0.5 - 0.060
    front_bottom = spec["shift"] - spec["bl"] * 0.5 - 0.018
    front_top = spec["shift"] - spec["tl"] * 0.5 - 0.018

    if name != "Delivery":
        add_panel(
            f"{name}_FrontWindshield_R3",
            [
                (-bottom_half, front_bottom, spec["bz"]),
                (bottom_half, front_bottom, spec["bz"]),
                (top_half, front_top, spec["tz"]),
                (-top_half, front_top, spec["tz"]),
            ],
            collection,
            root,
            glass,
        )
        return

    # Delivery vehicles use two distinct windshield panes and a visible center post.
    gap = 0.035
    add_panel(
        "DeliveryCab_FrontWindshield_L_R3",
        [
            (-bottom_half, front_bottom, spec["bz"]),
            (-gap, front_bottom, spec["bz"]),
            (-gap, front_top, spec["tz"]),
            (-top_half, front_top, spec["tz"]),
        ],
        collection,
        root,
        glass,
    )
    add_panel(
        "DeliveryCab_FrontWindshield_R_R3",
        [
            (gap, front_bottom, spec["bz"]),
            (bottom_half, front_bottom, spec["bz"]),
            (top_half, front_top, spec["tz"]),
            (gap, front_top, spec["tz"]),
        ],
        collection,
        root,
        glass,
    )


def correct_delivery_shutter(collection, root, metal_panel, seam):
    shutter = bpy.data.objects.get("Delivery_RearRollDoor")
    if shutter:
        shutter.data.materials.clear()
        shutter.data.materials.append(metal_panel)
        shutter["surface_role"] = "rear_roll_door_not_glass"
    remove_named(lambda name: name.startswith("Delivery_RollDoorSeam_"))
    for index, z in enumerate((0.84, 1.11, 1.38, 1.65, 1.92, 2.19), start=1):
        add_box(
            f"Delivery_RollDoorSeam_{index:02d}",
            (0.0, 3.25 * 0.465 + 0.025, z),
            (1.50 * 0.70, 0.026, 0.026),
            collection,
            seam,
            bevel=0.006,
            parent=root,
        )


def correct_vehicle(name):
    collection = bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure")
    root = bpy.data.objects.get(f"Vehicle_{name}_ROOT")
    if collection is None or root is None:
        raise RuntimeError(f"Missing v02 structure data for {name}")

    glass = bpy.data.materials.get("MAT_StructureGlass")
    body = bpy.data.materials.get("MAT_StructureBody")
    if glass is None or body is None:
        raise RuntimeError("Structure materials are missing")
    # Make structural glass visibly blue enough to read as glass, not a black panel.
    glass.diffuse_color = (0.055, 0.20, 0.30, 1.0)
    if glass.use_nodes:
        principled = glass.node_tree.nodes.get("Principled BSDF")
        if principled:
            principled.inputs["Base Color"].default_value = (0.055, 0.20, 0.30, 1.0)
            principled.inputs["Roughness"].default_value = 0.34

    tire = material("MAT_StructureTire", (0.018, 0.022, 0.026), roughness=0.92)
    hub = material("MAT_StructureWheelHub", (0.38, 0.42, 0.44), metallic=0.55, roughness=0.42)
    metal_panel = material("MAT_StructureRollDoor", (0.48, 0.56, 0.59), metallic=0.12, roughness=0.70)
    seam = material("MAT_StructureRollDoorSeam", (0.12, 0.15, 0.17), roughness=0.82)

    root.scale = (SCALE_FACTORS[name],) * 3
    root["structure_scale_revision"] = "v02-structure-r3"
    root["uniform_scale_factor"] = SCALE_FACTORS[name]

    # Remove the oversized rectangular fender blocks and all blockout wheel discs.
    remove_named(
        lambda object_name: object_name.startswith(f"{name}_")
        and (
            "_Wheel_" in object_name
            or object_name.endswith("FrontFender")
            or object_name.endswith("RearFender")
        )
    )

    width, length, _ = VEHICLES[name]
    radius, wheel_width = WHEEL_SPECS[name]
    wheel_y = length * 0.31
    wheel_x = width * 0.48
    for side, side_name in ((-1.0, "L"), (1.0, "R")):
        for axle_y, axle_name in ((-wheel_y, "Front"), (wheel_y, "Rear")):
            add_wheel(
                f"{name}_Wheel_{axle_name}_{side_name}_R3",
                (side * wheel_x, axle_y, radius),
                radius,
                wheel_width,
                collection,
                root,
                tire,
                hub,
                side,
            )

    correct_front_glass(name, collection, root, glass)
    if name == "Delivery":
        correct_delivery_shutter(collection, root, metal_panel, seam)

    root["checkpoint"] = "v02-structure-r3"
    set_status(
        f"v02 r3 — {name}: proportion, windshield and real wheel structure corrected "
        f"({list(VEHICLES).index(name) + 1}/7)"
    )


def prepare_revision():
    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v02-structure-r3"
    scene["STATUS"] = "CORRECTING_PROPORTIONS_GLASS_WHEELS_VISIBLY"
    scene["CORRECTION"] = (
        "Family scale consistency, raked front glass, delivery shutter identity, tire and hub assemblies"
    )
    title = bpy.data.objects.get("Title")
    if title and title.type == "FONT":
        title.data.body = "YUN VEHICLE FAMILY — v02 STRUCTURE r3 — SCALE / GLASS / WHEELS"
    set_status("v02 r3 — structural correction begins visibly in the current Blender session")


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
    collections = {name: bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure") for name in VEHICLES}
    for name, (width, length, height) in VEHICLES.items():
        factor = SCALE_FACTORS[name]
        x, y, _ = POSITIONS[name]
        for other_name, collection in collections.items():
            if collection:
                collection.hide_render = other_name != name
        camera.data.ortho_scale = max(3.2, width * factor * 2.30, length * factor * 1.34, height * factor * 1.85)
        camera.location = (x + 3.5, y - 4.9, max(2.9, height * factor * 1.90))
        point_at(camera, (x, y, height * factor * 0.48))
        render(OUTPUT_DIR / f"v02-structure-r3-{name.lower()}.png", camera, resolution=(960, 720))
    for collection in collections.values():
        if collection:
            collection.hide_render = False


def save_revision():
    scene = bpy.context.scene
    lineup_camera = bpy.data.objects.get("BlockoutLineupCamera")
    gameplay_camera = bpy.data.objects.get("YunGameplayCamera46Degrees")
    if lineup_camera is None or gameplay_camera is None:
        raise RuntimeError("v02 review cameras are missing")
    render(LINEUP_RENDER, lineup_camera)
    render(GAMEPLAY_RENDER, gameplay_camera)
    render_individual_views()
    scene["STATUS"] = "AWAITING_OWNER_REVIEW"
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
    set_status("v02 structure r3 corrected — AWAITING OWNER REVIEW")


steps = [
    prepare_revision,
    lambda: correct_vehicle("Sedan"),
    lambda: correct_vehicle("Taxi"),
    lambda: correct_vehicle("SportSedan"),
    lambda: correct_vehicle("SportHatch"),
    lambda: correct_vehicle("SUV"),
    lambda: correct_vehicle("Van"),
    lambda: correct_vehicle("Delivery"),
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
        return 1.35 if step_index < len(steps) else None
    except Exception as error:
        ERROR_FILE.write_text(
            f"Step {step_index + 1}: {type(error).__name__}: {error}\n",
            encoding="utf-8",
        )
        set_status(f"v02 r3 correction failed: {error}")
        raise


for stale in (DONE_FLAG, ERROR_FILE):
    if stale.exists():
        stale.unlink()
set_status("Yun vehicle v02 r3 correction — starting visibly in four seconds")
bpy.app.timers.register(run_next, first_interval=4.0)
