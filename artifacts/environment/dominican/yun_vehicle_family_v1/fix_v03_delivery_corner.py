import math
from pathlib import Path

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(r"D:\dev\Northern Step Studio\artifacts\environment\dominican\yun_vehicle_family_v1")
BLEND_PATH = OUTPUT_DIR / "v03-details-r2.blend"
LINEUP_RENDER = OUTPUT_DIR / "v03-details-r2-lineup.png"
GAMEPLAY_RENDER = OUTPUT_DIR / "v03-details-r2-gameplay.png"
REAR_RENDER = OUTPUT_DIR / "v03-details-r2-rear.png"
SIDE_RENDER = OUTPUT_DIR / "v03-details-r2-side-audit.png"
DONE_FLAG = OUTPUT_DIR / "v03-details-r2-ready.flag"
ERROR_FILE = OUTPUT_DIR / "v03-details-r2-error.txt"


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
            area.spaces.active.overlay.show_relationship_lines = False
            area.spaces.active.overlay.show_extras = False
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.region_3d.view_camera_zoom = 6
            try:
                area.spaces.active.shading.type = "RENDERED"
            except Exception:
                area.spaces.active.shading.type = "MATERIAL"
            area.tag_redraw()


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
    scene["CHECKPOINT"] = "v03-details-r2"
    scene["STATUS"] = "CORRECTING_DELIVERY_CARGO_CORNER_VISIBLY"
    scene["CORRECTION"] = "Move delivery cargo reinforcement from middle of box side to actual rear corner"
    title = bpy.data.objects.get("Title")
    if title and title.type == "FONT":
        title.data.body = "YUN VEHICLE FAMILY — v03 DETAILS r2 — CLEAN SIDE FIT"
    review = camera("V03R2DeliverySideCamera", (9.0, -3.5, 4.0), (4.4, 2.35, 1.05), 48.0)
    configure_view(review)
    set_status("v03 r2 — moving delivery cargo rails to rear corners")


def move_delivery_rails():
    rear_y = 3.25 * 0.455
    found = []
    for suffix in ("L", "R"):
        obj = bpy.data.objects.get(f"V03_Delivery_CargoCorner_{suffix}")
        if obj is None:
            raise RuntimeError(f"Missing delivery cargo rail {suffix}")
        obj.location.y = rear_y
        obj["checkpoint"] = "v03-details-r2"
        obj["fit"] = "rear cargo corner"
        found.append(obj.name)
    root = bpy.data.objects.get("Vehicle_Delivery_ROOT")
    if root:
        root["checkpoint"] = "v03-details-r2"
        root["cargo_corner_fit"] = "reinforcement rails moved to rear corners"
    set_status("v03 r2 — delivery cargo reinforcement now fitted at rear edge")


def save_revision():
    scene = bpy.context.scene
    lineup = bpy.data.objects.get("BlockoutLineupCamera")
    gameplay = bpy.data.objects.get("YunGameplayCamera46Degrees")
    review = bpy.data.objects.get("V03R2DeliverySideCamera")
    if lineup is None or gameplay is None or review is None:
        raise RuntimeError("v03 r2 review cameras are missing")
    rear = camera("V03R2RearReviewCamera", (-11.5, 12.8, 6.2), (0.0, 0.0, 0.82), 50.0)
    side = camera("V03R2SideReviewCamera", (12.8, -0.4, 4.0), (0.0, -0.1, 0.75), 53.0)
    render(LINEUP_RENDER, lineup)
    render(GAMEPLAY_RENDER, gameplay)
    render(REAR_RENDER, rear)
    render(SIDE_RENDER, side)
    scene["STATUS"] = "AWAITING_OWNER_REVIEW"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    configure_view(side)
    DONE_FLAG.write_text("AWAITING_OWNER_REVIEW\n", encoding="utf-8")
    set_status("v03 r2 side-fit correction — AWAITING OWNER REVIEW")


steps = [prepare_revision, move_delivery_rails, save_revision]
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
        set_status(f"v03 r2 correction failed: {error}")
        raise


for stale in (DONE_FLAG, ERROR_FILE):
    if stale.exists():
        stale.unlink()
set_status("Yun vehicle v03 r2 delivery-side correction — starting visibly in four seconds")
bpy.app.timers.register(run_next, first_interval=4.0)
