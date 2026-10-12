import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(r"D:\dev\Northern Step Studio")
OUTPUT_DIR = ROOT / "artifacts" / "environment" / "dominican" / "yun_vehicle_family_v1"
BLEND_PATH = OUTPUT_DIR / "v02-structure-r2.blend"
LINEUP_RENDER = OUTPUT_DIR / "v02-structure-r2-lineup.png"
GAMEPLAY_RENDER = OUTPUT_DIR / "v02-structure-r2-gameplay.png"
DONE_FLAG = OUTPUT_DIR / "v02-structure-r2-ready.flag"
ERROR_FILE = OUTPUT_DIR / "v02-structure-r2-error.txt"

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

PASSENGER_SPECS = {
    "Sedan": dict(bottom_z=0.62, top_z=1.40, bottom_width=1.50 * 0.78, top_width=1.50 * 0.64, bottom_length=2.55 * 0.47, top_length=2.55 * 0.31, y_shift=0.0, split=True),
    "Taxi": dict(bottom_z=0.63, top_z=1.60, bottom_width=1.50 * 0.78, top_width=1.50 * 0.64, bottom_length=2.75 * 0.47, top_length=2.75 * 0.32, y_shift=0.0, split=True),
    "SportSedan": dict(bottom_z=0.54, top_z=1.18, bottom_width=1.30 * 0.78, top_width=1.30 * 0.62, bottom_length=2.55 * 0.44, top_length=2.55 * 0.28, y_shift=0.0, split=True),
    "SportHatch": dict(bottom_z=0.54, top_z=1.18, bottom_width=1.30 * 0.78, top_width=1.30 * 0.64, bottom_length=2.85 * 0.55, top_length=2.85 * 0.41, y_shift=2.85 * 0.08, split=False),
    "SUV": dict(bottom_z=0.58, top_z=1.35, bottom_width=1.50 * 0.82, top_width=1.50 * 0.70, bottom_length=2.55 * 0.60, top_length=2.55 * 0.48, y_shift=2.55 * 0.05, split=True),
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


def add_panel(name, corners, collection, root, glass):
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(corners, [], [(0, 1, 2, 3)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = root
    obj.data.materials.append(glass)
    solidify = obj.modifiers.new("FlushGlassThickness", "SOLIDIFY")
    solidify.thickness = 0.012
    solidify.offset = 0.0
    bevel = obj.modifiers.new("GlassEdgeSoftening", "BEVEL")
    bevel.width = 0.010
    bevel.segments = 2
    obj["window_revision"] = "v02-structure-r2"
    return obj


def remove_windows(prefixes):
    for obj in list(bpy.data.objects):
        if not obj.name.startswith(tuple(prefixes)):
            continue
        if "Window" in obj.name or "Windshield" in obj.name:
            bpy.data.objects.remove(obj, do_unlink=True)


def add_front_rear_windows(prefix, spec, collection, root, glass):
    bw = spec["bottom_width"]
    tw = spec["top_width"]
    bl = spec["bottom_length"]
    tl = spec["top_length"]
    bz = spec["bottom_z"] + 0.115
    tz = spec["top_z"] - 0.115
    shift = spec["y_shift"]
    outward = 0.014

    # The glass follows both the width taper and front/rear rake of the cabin.
    bottom_half = max(0.16, bw * 0.5 - 0.105)
    top_half = max(0.14, tw * 0.5 - 0.085)
    front_bottom = shift - bl * 0.5 - outward
    front_top = shift - tl * 0.5 - outward
    rear_bottom = shift + bl * 0.5 + outward
    rear_top = shift + tl * 0.5 + outward

    add_panel(
        f"{prefix}_FrontWindshield_R2",
        [
            (-bottom_half, front_bottom, bz),
            (bottom_half, front_bottom, bz),
            (top_half, front_top, tz),
            (-top_half, front_top, tz),
        ],
        collection,
        root,
        glass,
    )
    add_panel(
        f"{prefix}_RearWindow_R2",
        [
            (bottom_half, rear_bottom, bz),
            (-bottom_half, rear_bottom, bz),
            (-top_half, rear_top, tz),
            (top_half, rear_top, tz),
        ],
        collection,
        root,
        glass,
    )


def side_quad(side, bottom_x, top_x, front_bottom, rear_bottom, front_top, rear_top, bz, tz):
    x_bottom = side * bottom_x
    x_top = side * top_x
    if side > 0:
        return [
            (x_bottom, front_bottom, bz),
            (x_bottom, rear_bottom, bz),
            (x_top, rear_top, tz),
            (x_top, front_top, tz),
        ]
    return [
        (x_bottom, rear_bottom, bz),
        (x_bottom, front_bottom, bz),
        (x_top, front_top, tz),
        (x_top, rear_top, tz),
    ]


def add_side_windows(prefix, spec, collection, root, glass, y_range=None):
    bw = spec["bottom_width"]
    tw = spec["top_width"]
    bl = spec["bottom_length"]
    tl = spec["top_length"]
    bz = spec["bottom_z"] + 0.125
    tz = spec["top_z"] - 0.125
    shift = spec["y_shift"]
    bottom_x = bw * 0.5 + 0.014
    top_x = tw * 0.5 + 0.014

    if y_range is None:
        front_bottom = shift - bl * 0.5 + 0.12
        rear_bottom = shift + bl * 0.5 - 0.12
        front_top = shift - tl * 0.5 + 0.09
        rear_top = shift + tl * 0.5 - 0.09
    else:
        front_bottom, rear_bottom, front_top, rear_top = y_range

    split = spec.get("split", True)
    gap = 0.038
    for side, suffix in ((-1.0, "L"), (1.0, "R")):
        if not split:
            add_panel(
                f"{prefix}_SideWindow_{suffix}_R2",
                side_quad(side, bottom_x, top_x, front_bottom, rear_bottom, front_top, rear_top, bz, tz),
                collection,
                root,
                glass,
            )
            continue

        # The split is centered in plan view, leaving a visible B-pillar.
        middle_bottom = (front_bottom + rear_bottom) * 0.5
        middle_top = (front_top + rear_top) * 0.5
        add_panel(
            f"{prefix}_SideWindowFront_{suffix}_R2",
            side_quad(
                side,
                bottom_x,
                top_x,
                front_bottom,
                middle_bottom - gap,
                front_top,
                middle_top - gap,
                bz,
                tz,
            ),
            collection,
            root,
            glass,
        )
        add_panel(
            f"{prefix}_SideWindowRear_{suffix}_R2",
            side_quad(
                side,
                bottom_x,
                top_x,
                middle_bottom + gap,
                rear_bottom,
                middle_top + gap,
                rear_top,
                bz,
                tz,
            ),
            collection,
            root,
            glass,
        )


def correct_passenger_windows(name):
    collection = bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure")
    root = bpy.data.objects.get(f"Vehicle_{name}_ROOT")
    glass = bpy.data.materials.get("MAT_StructureGlass")
    if collection is None or root is None or glass is None:
        raise RuntimeError(f"Missing v02 data for {name}")
    remove_windows([name])
    redundant_body_blocks = {
        "SportHatch": "SportHatch_RearHatchMass",
        "SUV": "SUV_RearCargoMass",
    }
    redundant_name = redundant_body_blocks.get(name)
    if redundant_name:
        # These old blockout masses intersect the corrected rear quarter glass.
        # The tapered cabin shells already provide the required body volume.
        redundant = bpy.data.objects.get(redundant_name)
        if redundant is not None:
            bpy.data.objects.remove(redundant, do_unlink=True)
    spec = PASSENGER_SPECS[name]
    add_front_rear_windows(name, spec, collection, root, glass)
    add_side_windows(name, spec, collection, root, glass)
    root["window_revision"] = "v02-structure-r2"
    set_status(f"v02 r2 — {name} glass reshaped and seated correctly")


def correct_van_windows():
    name = "Van"
    collection = bpy.data.collections.get("EXPORT_Vehicle_Van_Structure")
    root = bpy.data.objects.get("Vehicle_Van_ROOT")
    glass = bpy.data.materials.get("MAT_StructureGlass")
    if collection is None or root is None or glass is None:
        raise RuntimeError("Missing v02 data for Van")
    remove_windows(["Van"])
    spec = dict(
        bottom_z=0.58,
        top_z=1.41,
        bottom_width=1.50 * 0.84,
        top_width=1.50 * 0.76,
        bottom_length=2.75 * 0.70,
        top_length=2.75 * 0.60,
        y_shift=2.75 * 0.04,
        split=False,
    )
    add_front_rear_windows(name, spec, collection, root, glass)
    # Front-door glass only; the rear side panel remains solid for the sliding door.
    add_side_windows(
        name,
        spec,
        collection,
        root,
        glass,
        y_range=(-0.72, -0.12, -0.64, -0.10),
    )
    root["window_revision"] = "v02-structure-r2"
    set_status("v02 r2 — Van windshield and front-door glass corrected")


def correct_delivery_windows():
    name = "Delivery"
    collection = bpy.data.collections.get("EXPORT_Vehicle_Delivery_Structure")
    root = bpy.data.objects.get("Vehicle_Delivery_ROOT")
    glass = bpy.data.materials.get("MAT_StructureGlass")
    if collection is None or root is None or glass is None:
        raise RuntimeError("Missing v02 data for Delivery")
    remove_windows(["Delivery", "DeliveryCab"])
    spec = dict(
        bottom_z=0.61,
        top_z=1.48,
        bottom_width=1.50 * 0.84,
        top_width=1.50 * 0.73,
        bottom_length=3.25 * 0.31,
        top_length=3.25 * 0.23,
        y_shift=-3.25 * 0.29,
        split=False,
    )
    add_front_rear_windows("DeliveryCab", spec, collection, root, glass)
    add_side_windows("DeliveryCab", spec, collection, root, glass)
    root["window_revision"] = "v02-structure-r2"
    set_status("v02 r2 — Delivery cab glass corrected")


def prepare_revision():
    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v02-structure-r2"
    scene["STATUS"] = "CORRECTING_WINDOWS_VISIBLY"
    scene["CORRECTION"] = "Window width taper, rake, border and surface seating"
    title = bpy.data.objects.get("Title")
    if title and title.type == "FONT":
        title.data.body = "YUN VEHICLE FAMILY — v02 STRUCTURE r2 — WINDOWS"
    set_status("v02 r2 — correcting window shape and position only")


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
        x, y, _ = POSITIONS[name]
        for other_name, collection in collections.items():
            if collection:
                collection.hide_render = other_name != name
        camera.data.ortho_scale = max(3.1, width * 2.25, length * 1.28, height * 1.75)
        camera.location = (x + 3.4, y - 4.7, max(2.8, height * 1.85))
        point_at(camera, (x, y, height * 0.48))
        render(OUTPUT_DIR / f"v02-structure-r2-{name.lower()}.png", camera, resolution=(960, 720))
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
    set_status("v02 structure r2 windows corrected — AWAITING OWNER REVIEW")


steps = [
    prepare_revision,
    lambda: correct_passenger_windows("Sedan"),
    lambda: correct_passenger_windows("Taxi"),
    lambda: correct_passenger_windows("SportSedan"),
    lambda: correct_passenger_windows("SportHatch"),
    lambda: correct_passenger_windows("SUV"),
    correct_van_windows,
    correct_delivery_windows,
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
        return 1.2 if step_index < len(steps) else None
    except Exception as error:
        ERROR_FILE.write_text(
            f"Step {step_index + 1}: {type(error).__name__}: {error}\n",
            encoding="utf-8",
        )
        set_status(f"v02 r2 window correction failed: {error}")
        raise


for stale in (DONE_FLAG, ERROR_FILE):
    if stale.exists():
        stale.unlink()
set_status("Yun vehicle window correction — starting visibly in four seconds")
bpy.app.timers.register(run_next, first_interval=4.0)
