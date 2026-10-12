from pathlib import Path

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(r"D:\dev\Northern Step Studio\artifacts\environment\dominican\yun_vehicle_family_v1")
BLEND_PATH = OUTPUT_DIR / "v02-structure-r7.blend"
LINEUP_RENDER = OUTPUT_DIR / "v02-structure-r7-lineup.png"
GAMEPLAY_RENDER = OUTPUT_DIR / "v02-structure-r7-gameplay.png"
SUV_RENDER = OUTPUT_DIR / "v02-structure-r7-suv-windows.png"
DELIVERY_RENDER = OUTPUT_DIR / "v02-structure-r7-delivery-cab.png"
DONE_FLAG = OUTPUT_DIR / "v02-structure-r7-ready.flag"
ERROR_FILE = OUTPUT_DIR / "v02-structure-r7-error.txt"


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


def remove_object(name):
    obj = bpy.data.objects.get(name)
    if obj is not None:
        bpy.data.objects.remove(obj, do_unlink=True)


def prepare():
    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v02-structure-r7"
    scene["STATUS"] = "REMOVING_WINDOW_AND_WHEEL_OVERLAPS_VISIBLY"
    title = bpy.data.objects.get("Title")
    if title and title.type == "FONT":
        title.data.body = "YUN VEHICLE FAMILY — v02 STRUCTURE r7 — CLEAN WINDOWS"
    set_status("v02 r7 — final overlap cleanup begins visibly")


def clean_suv():
    remove_object("SUV_RearCargoMass")
    root = bpy.data.objects.get("Vehicle_SUV_ROOT")
    if root:
        root["overlap_cleanup"] = "legacy cargo mass removed from rear side glass"
    set_status("v02 r7 — SUV rear side window is fully clear")


def clean_delivery():
    remove_object("Delivery_CabStep_L")
    remove_object("Delivery_CabStep_R")
    root = bpy.data.objects.get("Vehicle_Delivery_ROOT")
    if root:
        root["overlap_cleanup"] = "temporary step bars removed from front wheels"
    set_status("v02 r7 — delivery front wheels and cab sides are clear")


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


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


def render_single(name, path, location, target, ortho_scale=3.4):
    camera_obj = bpy.data.objects.get("FinalWindowInspectionCamera")
    if camera_obj is None:
        data = bpy.data.cameras.new("FinalWindowInspectionCamera")
        camera_obj = bpy.data.objects.new("FinalWindowInspectionCamera", data)
        bpy.context.scene.collection.objects.link(camera_obj)
    camera_obj.data.type = "ORTHO"
    camera_obj.data.ortho_scale = ortho_scale
    camera_obj.location = location
    point_at(camera_obj, target)
    collections = {
        vehicle: bpy.data.collections.get(f"EXPORT_Vehicle_{vehicle}_Structure")
        for vehicle in ("Sedan", "Taxi", "SportSedan", "SportHatch", "SUV", "Van", "Delivery")
    }
    for vehicle, collection in collections.items():
        if collection:
            collection.hide_render = vehicle != name
    render(path, camera_obj, resolution=(960, 720))
    for collection in collections.values():
        if collection:
            collection.hide_render = False


def save_revision():
    scene = bpy.context.scene
    lineup = bpy.data.objects.get("BlockoutLineupCamera")
    gameplay = bpy.data.objects.get("YunGameplayCamera46Degrees")
    audit = bpy.data.objects.get("WindowOpeningAuditCamera")
    if lineup is None or gameplay is None or audit is None:
        raise RuntimeError("Required review cameras are missing")
    render(LINEUP_RENDER, lineup)
    render(GAMEPLAY_RENDER, gameplay)
    render_single("SUV", SUV_RENDER, (-0.4, -2.4, 2.6), (-4.4, 2.2, 0.75), 3.5)
    render_single("Delivery", DELIVERY_RENDER, (8.0, -2.6, 3.6), (4.4, 2.2, 1.15), 4.0)
    scene["STATUS"] = "AWAITING_OWNER_REVIEW"
    scene.camera = audit
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
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
            area.tag_redraw()
    DONE_FLAG.write_text("AWAITING_OWNER_REVIEW\n", encoding="utf-8")
    set_status("v02 structure r7 clean cabin-fit windows — AWAITING OWNER REVIEW")


steps = [prepare, clean_suv, clean_delivery, save_revision]
step_index = 0


def run_next():
    global step_index
    if step_index >= len(steps):
        return None
    try:
        steps[step_index]()
        step_index += 1
        return 1.5 if step_index < len(steps) else None
    except Exception as error:
        ERROR_FILE.write_text(f"Step {step_index + 1}: {type(error).__name__}: {error}\n", encoding="utf-8")
        set_status(f"v02 r7 cleanup failed: {error}")
        raise


for stale in (DONE_FLAG, ERROR_FILE):
    if stale.exists():
        stale.unlink()
set_status("Yun vehicle v02 r7 cleanup — starting visibly in four seconds")
bpy.app.timers.register(run_next, first_interval=4.0)
