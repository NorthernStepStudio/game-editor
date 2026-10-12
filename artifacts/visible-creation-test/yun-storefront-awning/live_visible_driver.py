from pathlib import Path

import bpy
from mathutils import Vector


SESSION_DIR = Path(
    r"D:\dev\Northern Step Studio\artifacts\visible-creation-test\yun-storefront-awning"
)
READY_BLEND = SESSION_DIR / "LIVE-READY-R2.blend"
READY_FLAG = SESSION_DIR / "live-ready-r2.flag"
START_TRIGGER = SESSION_DIR / "start-v01-live-r2.trigger"
OUTPUT_BLEND = SESSION_DIR / "v01-blockout-live-r2.blend"

STEP_DELAY_SECONDS = 2.00
step_index = 0
build_started = False


def set_status(message):
    bpy.context.scene["VISIBLE_CREATION_STATUS"] = message
    try:
        bpy.context.workspace.status_text_set(message)
    except Exception:
        pass
    redraw()


def redraw():
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            area.tag_redraw()


def add_block(name, location, dimensions, color):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    obj.color = (*color, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def point_camera(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def frame_review_view():
    scene = bpy.context.scene
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type != "VIEW_3D":
                continue
            space = area.spaces.active
            space.region_3d.view_perspective = "CAMERA"
            space.region_3d.view_camera_zoom = 8
            space.overlay.show_floor = True
            space.overlay.show_axis_x = True
            space.overlay.show_axis_y = True
            space.shading.type = "SOLID"
            space.shading.color_type = "OBJECT"
            area.tag_redraw()
    scene.camera.data.lens = 52


def prepare_empty_review_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"

    camera_data = bpy.data.cameras.new("ReviewCamera")
    camera = bpy.data.objects.new("ReviewCamera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (10.2, -12.4, 7.4)
    point_camera(camera, (0.0, -0.65, 1.65))
    scene.camera = camera

    frame_review_view()
    set_status("LIVE VISIBLE MODE READY — empty review scene")
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(READY_BLEND))
    READY_FLAG.write_text("READY\n", encoding="utf-8")
    bpy.app.timers.register(watch_for_start, first_interval=0.25)
    return None


def create_wall():
    add_block(
        "BLOCKOUT_WallReference",
        (0.0, 0.0, 1.8),
        (7.0, 0.35, 3.6),
        (0.56, 0.58, 0.60),
    )
    set_status("LIVE 1/5 — wall reference created")


def create_awning():
    add_block(
        "BLOCKOUT_Awning",
        (0.0, -1.16, 2.86),
        (5.4, 2.05, 0.18),
        (0.76, 0.78, 0.80),
    )
    set_status("LIVE 2/5 — awning created")


def create_left_post():
    add_block(
        "BLOCKOUT_SupportPost_L",
        (-2.48, -2.08, 1.385),
        (0.16, 0.16, 2.77),
        (0.35, 0.37, 0.39),
    )
    set_status("LIVE 3/5 — left support created")


def create_right_post():
    add_block(
        "BLOCKOUT_SupportPost_R",
        (2.48, -2.08, 1.385),
        (0.16, 0.16, 2.77),
        (0.35, 0.37, 0.39),
    )
    set_status("LIVE 4/5 — right support created")


def create_storefront_opening():
    add_block(
        "BLOCKOUT_StorefrontOpening",
        (0.0, -0.205, 1.30),
        (4.6, 0.08, 2.60),
        (0.16, 0.18, 0.20),
    )
    set_status("LIVE 5/5 — storefront opening created")


def finish_blockout():
    frame_review_view()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    set_status("v01 blockout ready — AWAITING OWNER REVIEW")


STEPS = [
    create_wall,
    create_awning,
    create_left_post,
    create_right_post,
    create_storefront_opening,
    finish_blockout,
]


def run_next_step():
    global step_index
    frame_review_view()
    if step_index >= len(STEPS):
        return None
    STEPS[step_index]()
    step_index += 1
    return STEP_DELAY_SECONDS


def watch_for_start():
    global build_started
    frame_review_view()
    if build_started:
        return None
    if not START_TRIGGER.exists():
        return 0.25

    START_TRIGGER.unlink()
    build_started = True
    set_status("LIVE BUILD STARTING — watch the viewport")
    bpy.app.timers.register(run_next_step, first_interval=1.0)
    return None


bpy.app.timers.register(prepare_empty_review_scene, first_interval=1.0)
