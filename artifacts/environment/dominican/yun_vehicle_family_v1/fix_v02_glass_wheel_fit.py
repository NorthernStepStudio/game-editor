import math
from pathlib import Path

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(r"D:\dev\Northern Step Studio\artifacts\environment\dominican\yun_vehicle_family_v1")
BLEND_PATH = OUTPUT_DIR / "v02-structure-r4.blend"
LINEUP_RENDER = OUTPUT_DIR / "v02-structure-r4-lineup.png"
REAR_RENDER = OUTPUT_DIR / "v02-structure-r4-rear-lineup.png"
GAMEPLAY_RENDER = OUTPUT_DIR / "v02-structure-r4-gameplay.png"
DONE_FLAG = OUTPUT_DIR / "v02-structure-r4-ready.flag"
ERROR_FILE = OUTPUT_DIR / "v02-structure-r4-error.txt"

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


def remove_named(predicate):
    for obj in list(bpy.data.objects):
        if predicate(obj.name):
            bpy.data.objects.remove(obj, do_unlink=True)


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
    obj["window_revision"] = "v02-structure-r4"
    return obj


def rebuild_end_glass(name, collection, root, glass):
    remove_named(
        lambda object_name: object_name.startswith((name, "DeliveryCab" if name == "Delivery" else "__never__"))
        and ("FrontWindshield" in object_name or "RearWindow" in object_name)
    )
    spec = GLASS_SPECS[name]
    front_bottom = spec["shift"] - spec["bl"] * 0.5 - 0.018
    front_top = spec["shift"] - spec["tl"] * 0.5 - 0.018
    rear_bottom = spec["shift"] + spec["bl"] * 0.5 + 0.018
    rear_top = spec["shift"] + spec["tl"] * 0.5 + 0.018

    # The owner's photos showed glass filling nearly the whole end of the cab.
    # These larger borders make the painted A/C pillars and roof surround readable.
    bottom_half = max(0.24, spec["bw"] * 0.5 - 0.115)
    top_half = max(0.22, spec["tw"] * 0.5 - 0.100)
    bottom_z = spec["bz"] + 0.035
    top_z = spec["tz"] - 0.040

    if name == "Delivery":
        gap = 0.040
        add_panel(
            "DeliveryCab_FrontWindshield_L_R4",
            [
                (-bottom_half, front_bottom, bottom_z),
                (-gap, front_bottom, bottom_z),
                (-gap, front_top, top_z),
                (-top_half, front_top, top_z),
            ],
            collection,
            root,
            glass,
        )
        add_panel(
            "DeliveryCab_FrontWindshield_R_R4",
            [
                (gap, front_bottom, bottom_z),
                (bottom_half, front_bottom, bottom_z),
                (top_half, front_top, top_z),
                (gap, front_top, top_z),
            ],
            collection,
            root,
            glass,
        )
        # The cargo box sits directly behind the cab; no false rear-cab glass is visible.
        return

    add_panel(
        f"{name}_FrontWindshield_R4",
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

    rear_bottom_half = max(0.22, spec["bw"] * 0.5 - 0.145)
    rear_top_half = max(0.20, spec["tw"] * 0.5 - 0.125)
    rear_bottom_z = bottom_z + 0.025
    rear_top_z = top_z - 0.025
    if name == "Van":
        # A commercial van gets a smaller, clearly framed rear cab window.
        rear_bottom_half = 0.42
        rear_top_half = 0.38
        rear_bottom_z = 0.82
        rear_top_z = 1.18
    elif name == "SportHatch":
        rear_bottom_half = min(rear_bottom_half, 0.43)
        rear_top_half = min(rear_top_half, 0.39)

    add_panel(
        f"{name}_RearWindow_R4",
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


def inset_wheels(name, root):
    width, _, _ = VEHICLES[name]
    _, wheel_width = WHEEL_SPECS[name]
    center_x = width * (0.425 if name in {"SUV", "Van", "Delivery"} else 0.415)
    for obj in root.children_recursive:
        if not obj.name.startswith(f"{name}_Wheel_"):
            continue
        side = -1.0 if obj.location.x < 0.0 else 1.0
        if obj.name.endswith("_Hub"):
            obj.location.x = side * (center_x + wheel_width * 0.53)
        else:
            obj.location.x = side * center_x
        obj["wheel_fit_revision"] = "v02-structure-r4"


def correct_vehicle(name):
    collection = bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure")
    root = bpy.data.objects.get(f"Vehicle_{name}_ROOT")
    glass = bpy.data.materials.get("MAT_StructureGlass")
    if collection is None or root is None or glass is None:
        raise RuntimeError(f"Missing r3 data for {name}")
    inset_wheels(name, root)
    rebuild_end_glass(name, collection, root, glass)
    root["checkpoint"] = "v02-structure-r4"
    root["correction"] = "glass borders and inset wheel fit"
    set_status(f"v02 r4 — {name}: glass border and wheel/body fit corrected ({list(VEHICLES).index(name) + 1}/7)")


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def camera(name, location, target, angle=46.0):
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


def show_camera(obj):
    bpy.context.scene.camera = obj
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


def prepare_revision():
    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v02-structure-r4"
    scene["STATUS"] = "CORRECTING_GLASS_AND_WHEEL_FIT_VISIBLY"
    scene["CORRECTION"] = "Reduce end-glass panels and seat wheels inside body width"
    title = bpy.data.objects.get("Title")
    if title and title.type == "FONT":
        title.data.body = "YUN VEHICLE FAMILY — v02 STRUCTURE r4 — GLASS / WHEEL FIT"
    rear_camera = camera("RearCorrectionCamera", (0.0, 18.5, 8.8), (0.0, 0.0, 0.72), 48.0)
    show_camera(rear_camera)
    set_status("v02 r4 — rear correction view ready; changes begin visibly")


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


def save_revision():
    scene = bpy.context.scene
    lineup_camera = bpy.data.objects.get("BlockoutLineupCamera")
    gameplay_camera = bpy.data.objects.get("YunGameplayCamera46Degrees")
    rear_camera = bpy.data.objects.get("RearCorrectionCamera")
    if lineup_camera is None or gameplay_camera is None or rear_camera is None:
        raise RuntimeError("Review cameras are missing")
    render(LINEUP_RENDER, lineup_camera)
    render(REAR_RENDER, rear_camera)
    render(GAMEPLAY_RENDER, gameplay_camera)
    scene["STATUS"] = "AWAITING_OWNER_REVIEW"
    scene.camera = rear_camera
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    show_camera(rear_camera)
    DONE_FLAG.write_text("AWAITING_OWNER_REVIEW\n", encoding="utf-8")
    set_status("v02 structure r4 glass and wheel fit corrected — AWAITING OWNER REVIEW")


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
        set_status(f"v02 r4 correction failed: {error}")
        raise


for stale in (DONE_FLAG, ERROR_FILE):
    if stale.exists():
        stale.unlink()
set_status("Yun vehicle v02 r4 correction — starting visibly in four seconds")
bpy.app.timers.register(run_next, first_interval=4.0)
