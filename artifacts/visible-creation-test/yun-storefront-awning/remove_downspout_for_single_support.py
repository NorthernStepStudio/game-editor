from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(r"D:\dev\Northern Step Studio")
OUTPUT_DIR = ROOT / "artifacts" / "visible-creation-test" / "yun-storefront-awning"
CORRECTED_BLEND = OUTPUT_DIR / "v04-materials-r3.blend"
CORRECTED_RENDER = OUTPUT_DIR / "v04-materials-r3.png"
DONE_FLAG = OUTPUT_DIR / "v04-single-right-support.flag"
DRAINAGE_OBJECTS = (
    "Downspout_R_Upper",
    "Downspout_R_Main",
    "Downspout_R_Outlet",
)


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


def point_camera(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def remove_drainage_detail():
    removed = []
    for name in DRAINAGE_OBJECTS:
        obj = bpy.data.objects.get(name)
        if obj is None:
            continue
        removed.append(name)
        bpy.data.objects.remove(obj, do_unlink=True)
    if not removed:
        raise RuntimeError("The right-side drainage objects were not found")
    bpy.context.scene["RIGHT_SUPPORT_CORRECTION"] = (
        "Removed drainage detail; retained one structural support on the right"
    )
    bpy.context.view_layer.update()
    set_status("v04 correction — right side now has one structural support only")


def save_and_render():
    camera = bpy.data.objects.get("ReviewCamera")
    if camera is None:
        raise RuntimeError("ReviewCamera is missing")
    camera.location = (5.6, -7.5, 3.7)
    camera.data.lens = 54
    point_camera(camera, (0.0, -0.82, 1.45))

    scene = bpy.context.scene
    scene.camera = camera
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(CORRECTED_RENDER)
    bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(CORRECTED_BLEND))

    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type != "VIEW_3D":
                continue
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.region_3d.view_camera_zoom = 10
            try:
                area.spaces.active.shading.type = "RENDERED"
            except Exception:
                area.spaces.active.shading.type = "MATERIAL"
            area.tag_redraw()

    DONE_FLAG.write_text("CORRECTED\n", encoding="utf-8")
    set_status("v04 corrected — one right support; ready for final Yun-scale pass")


steps = [remove_drainage_detail, save_and_render]
step_index = 0


def run_next():
    global step_index
    if step_index >= len(steps):
        return None
    try:
        steps[step_index]()
        step_index += 1
        return 2.0
    except Exception as error:
        (OUTPUT_DIR / "single-support-correction-error.txt").write_text(
            f"Step {step_index + 1}: {type(error).__name__}: {error}\n",
            encoding="utf-8",
        )
        set_status(f"v04 single-support correction failed: {error}")
        raise


set_status("v04 correction ready — removing the confusing drain detail in five seconds")
bpy.app.timers.register(run_next, first_interval=5.0)
