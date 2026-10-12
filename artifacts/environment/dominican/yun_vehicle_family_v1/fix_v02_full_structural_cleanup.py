import math
from pathlib import Path

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(r"D:\dev\Northern Step Studio\artifacts\environment\dominican\yun_vehicle_family_v1")
BLEND_PATH = OUTPUT_DIR / "v02-structure-r5.blend"
LINEUP_RENDER = OUTPUT_DIR / "v02-structure-r5-lineup.png"
REAR_RENDER = OUTPUT_DIR / "v02-structure-r5-rear-lineup.png"
GAMEPLAY_RENDER = OUTPUT_DIR / "v02-structure-r5-gameplay.png"
DONE_FLAG = OUTPUT_DIR / "v02-structure-r5-ready.flag"
ERROR_FILE = OUTPUT_DIR / "v02-structure-r5-error.txt"

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

GLASS_SPECS = {
    "Sedan": dict(bz=0.735, tz=1.285, bw=1.50 * 0.78, tw=1.50 * 0.64, bl=2.55 * 0.47, tl=2.55 * 0.31, shift=0.0, split=0.50),
    "Taxi": dict(bz=0.745, tz=1.485, bw=1.50 * 0.78, tw=1.50 * 0.64, bl=2.75 * 0.47, tl=2.75 * 0.32, shift=0.0, split=0.50),
    "SportSedan": dict(bz=0.655, tz=1.065, bw=1.30 * 0.78, tw=1.30 * 0.62, bl=2.55 * 0.44, tl=2.55 * 0.28, shift=0.0, split=0.54),
    "SportHatch": dict(bz=0.655, tz=1.065, bw=1.30 * 0.78, tw=1.30 * 0.64, bl=2.85 * 0.55, tl=2.85 * 0.41, shift=2.85 * 0.08, split=0.48),
    "SUV": dict(bz=0.705, tz=1.235, bw=1.50 * 0.82, tw=1.50 * 0.70, bl=2.55 * 0.60, tl=2.55 * 0.48, shift=2.55 * 0.05, split=0.50),
    "Van": dict(bz=0.705, tz=1.285, bw=1.50 * 0.84, tw=1.50 * 0.76, bl=2.75 * 0.70, tl=2.75 * 0.60, shift=2.75 * 0.04, split=None),
    "Delivery": dict(bz=0.735, tz=1.355, bw=1.50 * 0.84, tw=1.50 * 0.73, bl=3.25 * 0.31, tl=3.25 * 0.23, shift=-3.25 * 0.29, split=None),
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


def remove_named(predicate):
    for obj in list(bpy.data.objects):
        if predicate(obj.name):
            bpy.data.objects.remove(obj, do_unlink=True)


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


def add_box(name, location, dimensions, collection, mat, bevel=0.0, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    move_to_collection(obj, collection)
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("StructureSoftEdges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
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
    solidify.thickness = 0.010
    solidify.offset = 0.0
    bevel = obj.modifiers.new("GlassEdgeSoftening", "BEVEL")
    bevel.width = 0.010
    bevel.segments = 2
    obj["window_revision"] = "v02-structure-r5"
    return obj


def side_quad(side, bottom_x, top_x, front_bottom, rear_bottom, front_top, rear_top, bz, tz):
    xb = side * bottom_x
    xt = side * top_x
    if side > 0.0:
        return [
            (xb, front_bottom, bz),
            (xb, rear_bottom, bz),
            (xt, rear_top, tz),
            (xt, front_top, tz),
        ]
    return [
        (xb, rear_bottom, bz),
        (xb, front_bottom, bz),
        (xt, front_top, tz),
        (xt, rear_top, tz),
    ]


def rebuild_side_glass(name, collection, root, glass):
    remove_named(lambda object_name: object_name.startswith((name, "DeliveryCab" if name == "Delivery" else "__never__")) and "SideWindow" in object_name)
    spec = GLASS_SPECS[name]
    bz = spec["bz"] + 0.045
    tz = spec["tz"] - 0.050
    bottom_x = spec["bw"] * 0.5 + 0.012
    top_x = spec["tw"] * 0.5 + 0.012
    front_bottom = spec["shift"] - spec["bl"] * 0.5 + 0.105
    rear_bottom = spec["shift"] + spec["bl"] * 0.5 - 0.105
    front_top = spec["shift"] - spec["tl"] * 0.5 + 0.085
    rear_top = spec["shift"] + spec["tl"] * 0.5 - 0.085

    if name == "Van":
        # Only the driving-door glass belongs here. The old sliding-door slabs
        # were floating outside the van and are removed separately.
        front_bottom = spec["shift"] - spec["bl"] * 0.5 + 0.10
        rear_bottom = front_bottom + 0.54
        front_top = spec["shift"] - spec["tl"] * 0.5 + 0.08
        rear_top = front_top + 0.47
    elif name == "Delivery":
        front_bottom = spec["shift"] - spec["bl"] * 0.5 + 0.08
        rear_bottom = spec["shift"] + spec["bl"] * 0.5 - 0.08
        front_top = spec["shift"] - spec["tl"] * 0.5 + 0.07
        rear_top = spec["shift"] + spec["tl"] * 0.5 - 0.07

    prefix = "DeliveryCab" if name == "Delivery" else name
    for side, suffix in ((-1.0, "L"), (1.0, "R")):
        if spec["split"] is None:
            add_panel(
                f"{prefix}_SideWindow_{suffix}_R5",
                side_quad(side, bottom_x, top_x, front_bottom, rear_bottom, front_top, rear_top, bz, tz),
                collection,
                root,
                glass,
            )
            continue

        split = spec["split"]
        mid_bottom = front_bottom + (rear_bottom - front_bottom) * split
        mid_top = front_top + (rear_top - front_top) * split
        gap = 0.042
        add_panel(
            f"{prefix}_SideWindowFront_{suffix}_R5",
            side_quad(side, bottom_x, top_x, front_bottom, mid_bottom - gap, front_top, mid_top - gap, bz, tz),
            collection,
            root,
            glass,
        )
        add_panel(
            f"{prefix}_SideWindowRear_{suffix}_R5",
            side_quad(side, bottom_x, top_x, mid_bottom + gap, rear_bottom, mid_top + gap, rear_top, bz, tz),
            collection,
            root,
            glass,
        )


def rebuild_end_glass(name, collection, root, glass):
    remove_named(
        lambda object_name: object_name.startswith((name, "DeliveryCab" if name == "Delivery" else "__never__"))
        and ("FrontWindshield" in object_name or "RearWindow" in object_name)
    )
    spec = GLASS_SPECS[name]
    front_bottom = spec["shift"] - spec["bl"] * 0.5 - 0.015
    front_top = spec["shift"] - spec["tl"] * 0.5 - 0.015
    rear_bottom = spec["shift"] + spec["bl"] * 0.5 + 0.015
    rear_top = spec["shift"] + spec["tl"] * 0.5 + 0.015
    bottom_half = max(0.24, spec["bw"] * 0.5 - 0.125)
    top_half = max(0.22, spec["tw"] * 0.5 - 0.110)
    bottom_z = spec["bz"] + 0.045
    top_z = spec["tz"] - 0.050

    if name == "Delivery":
        gap = 0.042
        for side, suffix in ((-1.0, "L"), (1.0, "R")):
            inner = side * gap
            outer_bottom = side * bottom_half
            outer_top = side * top_half
            corners = (
                [(outer_bottom, front_bottom, bottom_z), (inner, front_bottom, bottom_z), (inner, front_top, top_z), (outer_top, front_top, top_z)]
                if side < 0.0
                else [(inner, front_bottom, bottom_z), (outer_bottom, front_bottom, bottom_z), (outer_top, front_top, top_z), (inner, front_top, top_z)]
            )
            add_panel(f"DeliveryCab_FrontWindshield_{suffix}_R5", corners, collection, root, glass)
        return

    add_panel(
        f"{name}_FrontWindshield_R5",
        [
            (-bottom_half, front_bottom, bottom_z),
            (bottom_half, front_bottom, bottom_z),
            (top_half, front_top, top_z),
            (-top_half, front_top, top_z),
        ],
        collection,
        root,
        glass,
    )

    rear_bottom_half = max(0.22, bottom_half - 0.035)
    rear_top_half = max(0.20, top_half - 0.030)
    rear_bottom_z = bottom_z + 0.020
    rear_top_z = top_z - 0.020
    if name == "Van":
        rear_bottom_half = 0.42
        rear_top_half = 0.38
        rear_bottom_z = 0.82
        rear_top_z = 1.18
    elif name == "SportHatch":
        rear_bottom_half = min(rear_bottom_half, 0.43)
        rear_top_half = min(rear_top_half, 0.39)
    add_panel(
        f"{name}_RearWindow_R5",
        [
            (rear_bottom_half, rear_bottom, rear_bottom_z),
            (-rear_bottom_half, rear_bottom, rear_bottom_z),
            (-rear_top_half, rear_top, rear_top_z),
            (rear_top_half, rear_top, rear_top_z),
        ],
        collection,
        root,
        glass,
    )


def add_wheel_wells(name, collection, root):
    lower = bpy.data.objects.get(f"{name}_LowerBody")
    if lower is None:
        raise RuntimeError(f"Missing lower body for {name}")
    for modifier in list(lower.modifiers):
        if modifier.name.startswith("WheelWell_"):
            lower.modifiers.remove(modifier)
    remove_named(lambda object_name: object_name.startswith(f"{name}_WheelWellCutter_"))

    width, length, _ = VEHICLES[name]
    radius, _ = WHEEL_SPECS[name]
    wheel_y = length * 0.31
    for axle_y, axle_name in ((-wheel_y, "Front"), (wheel_y, "Rear")):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=16,
            radius=radius * 1.16,
            depth=width * 1.35,
            location=(0.0, 0.0, 0.0),
            rotation=(0.0, math.radians(90.0), 0.0),
        )
        cutter = bpy.context.object
        cutter.name = f"{name}_WheelWellCutter_{axle_name}_R5"
        move_to_collection(cutter, collection)
        cutter.parent = root
        cutter.location = (0.0, axle_y, radius * 0.94)
        cutter.display_type = "WIRE"
        cutter.hide_render = True
        cutter["export"] = False
        boolean = lower.modifiers.new(f"WheelWell_{axle_name}_R5", "BOOLEAN")
        boolean.operation = "DIFFERENCE"
        boolean.solver = "EXACT"
        boolean.object = cutter
        cutter.hide_set(True)
    lower["wheel_well_revision"] = "v02-structure-r5"


def add_van_door_seams(collection, root):
    remove_named(lambda object_name: object_name.startswith("Van_SlidingDoor"))
    remove_named(lambda object_name: object_name.startswith("Van_DoorSeam_"))
    seam = material("MAT_StructureDoorSeam", (0.19, 0.26, 0.29), roughness=0.82)
    side_x = 1.50 * 0.445 + 0.008
    for side, suffix in ((-1.0, "L"), (1.0, "R")):
        x = side * side_x
        add_box(f"Van_DoorSeam_Front_{suffix}", (x, 0.12, 0.88), (0.018, 0.025, 0.72), collection, seam, bevel=0.004, parent=root)
        add_box(f"Van_DoorSeam_Rear_{suffix}", (x, 0.98, 0.88), (0.018, 0.025, 0.72), collection, seam, bevel=0.004, parent=root)
        add_box(f"Van_DoorSeam_Top_{suffix}", (x, 0.55, 1.24), (0.018, 0.86, 0.025), collection, seam, bevel=0.004, parent=root)
        add_box(f"Van_DoorSeam_Bottom_{suffix}", (x, 0.55, 0.52), (0.018, 0.86, 0.025), collection, seam, bevel=0.004, parent=root)


def correct_vehicle(name):
    collection = bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure")
    root = bpy.data.objects.get(f"Vehicle_{name}_ROOT")
    glass = bpy.data.materials.get("MAT_StructureGlass")
    if collection is None or root is None or glass is None:
        raise RuntimeError(f"Missing r4 structure for {name}")
    # Stable inspection color from both sides; final materials remain a v04 task.
    glass.diffuse_color = (0.035, 0.16, 0.23, 1.0)
    if glass.use_nodes:
        principled = glass.node_tree.nodes.get("Principled BSDF")
        if principled:
            principled.inputs["Base Color"].default_value = (0.035, 0.16, 0.23, 1.0)
            principled.inputs["Roughness"].default_value = 0.46
            if "Metallic" in principled.inputs:
                principled.inputs["Metallic"].default_value = 0.05
    rebuild_end_glass(name, collection, root, glass)
    rebuild_side_glass(name, collection, root, glass)
    add_wheel_wells(name, collection, root)
    if name == "Van":
        add_van_door_seams(collection, root)
    root["checkpoint"] = "v02-structure-r5"
    root["structural_cleanup"] = "all glass rebuilt, wheel wells added, floating panels removed"
    set_status(f"v02 r5 — {name}: windows, wheel openings and side structure corrected ({list(VEHICLES).index(name) + 1}/7)")


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def camera(name, location, target, angle=48.0):
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
            area.spaces.active.region_3d.view_camera_zoom = 7
            try:
                area.spaces.active.shading.type = "RENDERED"
            except Exception:
                area.spaces.active.shading.type = "MATERIAL"
            area.tag_redraw()


def prepare_revision():
    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v02-structure-r5"
    scene["STATUS"] = "FULL_STRUCTURAL_CLEANUP_VISIBLE"
    scene["CORRECTION"] = "side windows, floating van panels, wheel openings, consistent glass, clean review viewport"
    title = bpy.data.objects.get("Title")
    if title and title.type == "FONT":
        title.data.body = "YUN VEHICLE FAMILY — v02 STRUCTURE r5 — FULL CLEANUP"
    close_camera = camera("StructureCleanupCamera", (10.8, -14.2, 6.7), (0.0, 0.0, 0.72), 52.0)
    configure_view(close_camera)
    set_status("v02 r5 — clean close-review camera ready; systematic correction begins")


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


def render_individual_side_views():
    inspection = bpy.data.objects.get("VehicleSideInspectionCamera")
    if inspection is None:
        data = bpy.data.cameras.new("VehicleSideInspectionCamera")
        inspection = bpy.data.objects.new("VehicleSideInspectionCamera", data)
        bpy.context.scene.collection.objects.link(inspection)
    inspection.data.type = "ORTHO"
    collections = {name: bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure") for name in VEHICLES}
    for name, (width, length, height) in VEHICLES.items():
        root = bpy.data.objects.get(f"Vehicle_{name}_ROOT")
        factor = root.scale.x if root else 1.0
        x, y, _ = POSITIONS[name]
        for other_name, collection in collections.items():
            if collection:
                collection.hide_render = other_name != name
        inspection.data.ortho_scale = max(3.4, length * factor * 1.28, height * factor * 1.85)
        inspection.location = (x + 4.8, y - 0.15, max(2.1, height * factor * 1.42))
        point_at(inspection, (x, y, height * factor * 0.48))
        render(OUTPUT_DIR / f"v02-structure-r5-{name.lower()}-side.png", inspection, resolution=(960, 720))
    for collection in collections.values():
        if collection:
            collection.hide_render = False


def save_revision():
    scene = bpy.context.scene
    lineup_camera = bpy.data.objects.get("BlockoutLineupCamera")
    gameplay_camera = bpy.data.objects.get("YunGameplayCamera46Degrees")
    rear_camera = bpy.data.objects.get("RearCorrectionCamera")
    close_camera = bpy.data.objects.get("StructureCleanupCamera")
    if lineup_camera is None or gameplay_camera is None or rear_camera is None or close_camera is None:
        raise RuntimeError("Review cameras are missing")
    render(LINEUP_RENDER, lineup_camera)
    render(REAR_RENDER, rear_camera)
    render(GAMEPLAY_RENDER, gameplay_camera)
    render_individual_side_views()
    scene["STATUS"] = "AWAITING_OWNER_REVIEW"
    scene.camera = close_camera
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    configure_view(close_camera)
    DONE_FLAG.write_text("AWAITING_OWNER_REVIEW\n", encoding="utf-8")
    set_status("v02 structure r5 full cleanup visible — AWAITING OWNER REVIEW")


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
        return 1.45 if step_index < len(steps) else None
    except Exception as error:
        ERROR_FILE.write_text(f"Step {step_index + 1}: {type(error).__name__}: {error}\n", encoding="utf-8")
        set_status(f"v02 r5 full cleanup failed: {error}")
        raise


for stale in (DONE_FLAG, ERROR_FILE):
    if stale.exists():
        stale.unlink()
set_status("Yun vehicle v02 r5 full cleanup — starting visibly in four seconds")
bpy.app.timers.register(run_next, first_interval=4.0)
