import math
from pathlib import Path

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(r"D:\dev\Northern Step Studio\artifacts\environment\dominican\yun_vehicle_family_v1")
BLEND_PATH = OUTPUT_DIR / "v03-details-r1.blend"
LINEUP_RENDER = OUTPUT_DIR / "v03-details-r1-lineup.png"
GAMEPLAY_RENDER = OUTPUT_DIR / "v03-details-r1-gameplay.png"
REAR_RENDER = OUTPUT_DIR / "v03-details-r1-rear.png"
SIDE_RENDER = OUTPUT_DIR / "v03-details-r1-side-audit.png"
DONE_FLAG = OUTPUT_DIR / "v03-details-r1-ready.flag"
ERROR_FILE = OUTPUT_DIR / "v03-details-r1-error.txt"

VEHICLES = {
    "Sedan": (1.50, 2.55, 1.45),
    "Taxi": (1.50, 2.75, 1.65),
    "SportSedan": (1.30, 2.55, 1.25),
    "SportHatch": (1.30, 2.85, 1.25),
    "SUV": (1.50, 2.55, 1.40),
    "Van": (1.50, 2.75, 1.45),
    "Delivery": (1.50, 3.25, 2.50),
}

CABINS = {
    "Sedan": dict(shift=0.0),
    "Taxi": dict(shift=0.0),
    "SportSedan": dict(shift=0.0),
    "SportHatch": dict(shift=2.85 * 0.08),
    "SUV": dict(shift=2.55 * 0.05),
    "Van": dict(shift=2.75 * 0.04),
    "Delivery": dict(shift=-3.25 * 0.29),
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


def move_to_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def add_box(name, location, dimensions, collection, mat, bevel, parent):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    move_to_collection(obj, collection)
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new("FlushSeamEdge", "BEVEL")
    modifier.width = bevel
    modifier.segments = 2
    obj["checkpoint"] = "v03-details-r1"
    obj["flush_fit"] = True
    return obj


def remove_named(prefixes):
    for obj in list(bpy.data.objects):
        if obj.name.startswith(prefixes):
            bpy.data.objects.remove(obj, do_unlink=True)


def focus_vehicle(name):
    positions = {
        "Sedan": (-6.6, -2.35, 0.0), "Taxi": (-2.25, -2.35, 0.0),
        "SportSedan": (2.1, -2.35, 0.0), "SportHatch": (6.45, -2.35, 0.0),
        "SUV": (-4.4, 2.2, 0.0), "Van": (0.0, 2.2, 0.0), "Delivery": (4.4, 2.2, 0.0),
    }
    x, y, _ = positions[name]
    _, _, height = VEHICLES[name]
    root = bpy.data.objects.get(f"Vehicle_{name}_ROOT")
    factor = root.scale.x if root else 1.0
    camera_obj = bpy.data.objects.get("V03FlushAuditCamera")
    if camera_obj is None:
        data = bpy.data.cameras.new("V03FlushAuditCamera")
        camera_obj = bpy.data.objects.new("V03FlushAuditCamera", data)
        bpy.context.scene.collection.objects.link(camera_obj)
    camera_obj.data.type = "PERSP"
    camera_obj.data.angle = math.radians(49.0)
    camera_obj.location = (x + 3.25 * factor, y - 4.0 * factor, max(2.3, height * factor * 1.45))
    camera_obj.rotation_euler = (Vector((x, y, height * factor * 0.46)) - camera_obj.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera_obj
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type != "VIEW_3D":
                continue
            area.spaces.active.overlay.show_relationship_lines = False
            area.spaces.active.overlay.show_extras = False
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.region_3d.view_camera_zoom = 6
            try:
                area.spaces.active.shading.type = "RENDERED"
            except Exception:
                area.spaces.active.shading.type = "MATERIAL"
            area.tag_redraw()


def correct_passenger_seams(name):
    collection = bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure")
    root = bpy.data.objects.get(f"Vehicle_{name}_ROOT")
    seam = bpy.data.materials.get("MAT_V03_SubtleSeam")
    if collection is None or root is None or seam is None:
        raise RuntimeError(f"Missing v03 detail data for {name}")
    remove_named((f"V03_{name}_DoorSeam_", f"V03_{name}_DoorSeamFlush_"))
    width, _, _ = VEHICLES[name]
    seam_z = 0.63 if name in {"SportSedan", "SportHatch"} else 0.69
    x_surface = width * 0.493
    for side, suffix in ((-1.0, "L"), (1.0, "R")):
        add_box(
            f"V03_{name}_DoorSeamFlush_{suffix}",
            (side * x_surface, CABINS[name]["shift"], seam_z),
            (0.010, 0.016, 0.28),
            collection,
            seam,
            0.0025,
            root,
        )
    root["checkpoint"] = "v03-details-r1"
    root["seam_fit"] = "flush inset; no pole silhouette"
    set_status(f"v03 r1 — {name}: side seams embedded flush")


def correct_van_hardware():
    name = "Van"
    collection = bpy.data.collections.get("EXPORT_Vehicle_Van_Structure")
    root = bpy.data.objects.get("Vehicle_Van_ROOT")
    seam = bpy.data.materials.get("MAT_V03_SubtleSeam")
    if collection is None or root is None or seam is None:
        raise RuntimeError("Missing v03 van detail data")
    remove_named(("V03_Van_CargoDoorSeam_", "V03_Van_CargoDoorSeamFlush_"))
    width = VEHICLES[name][0]
    for side, suffix in ((-1.0, "L"), (1.0, "R")):
        add_box(
            f"V03_Van_CargoDoorSeamFlush_{suffix}",
            (side * width * 0.493, 0.72, 0.59),
            (0.010, 0.016, 0.36),
            collection,
            seam,
            0.0025,
            root,
        )
    root["checkpoint"] = "v03-details-r1"
    root["cargo_seam_fit"] = "flush inset"
    set_status("v03 r1 — Van: cargo seams embedded flush")


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


def prepare_revision():
    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v03-details-r1"
    scene["STATUS"] = "CORRECTING_FLOATING_SEAMS_VISIBLY"
    scene["CORRECTION"] = "Embed side and cargo-door seams so they do not read as detached poles"
    title = bpy.data.objects.get("Title")
    if title and title.type == "FONT":
        title.data.body = "YUN VEHICLE FAMILY — v03 DETAILS r1 — FLUSH SIDE SEAMS"
    focus_vehicle("Sedan")
    set_status("v03 r1 — correcting floating door-seam geometry visibly")


def save_revision():
    scene = bpy.context.scene
    lineup = bpy.data.objects.get("BlockoutLineupCamera")
    gameplay = bpy.data.objects.get("YunGameplayCamera46Degrees")
    live = bpy.data.objects.get("V03FlushAuditCamera")
    if lineup is None or gameplay is None or live is None:
        raise RuntimeError("v03 r1 review cameras are missing")
    rear = camera("V03R1RearReviewCamera", (-11.5, 12.8, 6.2), (0.0, 0.0, 0.82), 50.0)
    side = camera("V03R1SideReviewCamera", (12.8, -0.4, 4.0), (0.0, -0.1, 0.75), 53.0)
    render(LINEUP_RENDER, lineup)
    render(GAMEPLAY_RENDER, gameplay)
    render(REAR_RENDER, rear)
    render(SIDE_RENDER, side)
    scene["STATUS"] = "AWAITING_OWNER_REVIEW"
    scene.camera = side
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.context.scene.camera = side
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.overlay.show_relationship_lines = False
                area.spaces.active.overlay.show_extras = False
                area.spaces.active.region_3d.view_perspective = "CAMERA"
                area.spaces.active.region_3d.view_camera_zoom = 6
                area.tag_redraw()
    DONE_FLAG.write_text("AWAITING_OWNER_REVIEW\n", encoding="utf-8")
    set_status("v03 r1 flush seam correction — AWAITING OWNER REVIEW")


steps = [
    prepare_revision,
    lambda: correct_passenger_seams("Sedan"),
    lambda: correct_passenger_seams("Taxi"),
    lambda: correct_passenger_seams("SportSedan"),
    lambda: correct_passenger_seams("SportHatch"),
    lambda: correct_passenger_seams("SUV"),
    correct_van_hardware,
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
        return 1.8 if step_index < len(steps) else None
    except Exception as error:
        ERROR_FILE.write_text(f"Step {step_index + 1}: {type(error).__name__}: {error}\n", encoding="utf-8")
        set_status(f"v03 r1 seam correction failed: {error}")
        raise


for stale in (DONE_FLAG, ERROR_FILE):
    if stale.exists():
        stale.unlink()
set_status("Yun vehicle v03 r1 seam correction — starting visibly in four seconds")
bpy.app.timers.register(run_next, first_interval=4.0)
