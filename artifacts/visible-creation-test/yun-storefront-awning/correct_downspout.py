from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(r"D:\dev\Northern Step Studio")
OUTPUT_DIR = ROOT / "artifacts" / "visible-creation-test" / "yun-storefront-awning"
CORRECTED_BLEND = OUTPUT_DIR / "v04-materials-r2.blend"
CORRECTED_RENDER = OUTPUT_DIR / "v04-materials-r2.png"
DONE_FLAG = OUTPUT_DIR / "v04-downspout-corrected.flag"


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


def set_dimensions(obj, dimensions):
    bpy.ops.object.select_all(action="DESELECT")
    obj.dimensions = dimensions
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.select_set(False)


def correct_downspout():
    # The main front support remains structural. The drainage run now returns
    # along the canopy side, then drops against the facade wall.
    connector = bpy.data.objects.get("Downspout_R_Upper")
    downspout = bpy.data.objects.get("Downspout_R_Main")
    outlet = bpy.data.objects.get("Downspout_R_Outlet")
    if not all((connector, downspout, outlet)):
        raise RuntimeError("Expected right-side drainage objects were not found")

    connector.location = (2.67, -1.27, 2.63)
    set_dimensions(connector, (0.11, 1.90, 0.11))

    downspout.location = (2.67, -0.32, 1.34)
    set_dimensions(downspout, (0.11, 0.12, 2.48))

    outlet.location = (2.67, -0.44, 0.12)
    set_dimensions(outlet, (0.11, 0.36, 0.12))

    bpy.context.scene["DOWNSPOUT_CORRECTION"] = (
        "Moved drainage behind the front support; added side gutter return"
    )
    bpy.context.view_layer.update()
    set_status("v04 correction — support retained; downspout moved to the wall")


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
    set_status("v04 corrected — one support post; wall-mounted downspout ready for review")


steps = [correct_downspout, save_and_render]
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
        (OUTPUT_DIR / "downspout-correction-error.txt").write_text(
            f"Step {step_index + 1}: {type(error).__name__}: {error}\n",
            encoding="utf-8",
        )
        set_status(f"v04 downspout correction failed: {error}")
        raise


set_status("v04 correction ready — moving the drainage behind the support in five seconds")
bpy.app.timers.register(run_next, first_interval=5.0)
