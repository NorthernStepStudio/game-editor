import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(r"D:\dev\Northern Step Studio")
OUTPUT_DIR = ROOT / "artifacts" / "environment" / "dominican" / "yun_plastic_chair_01"
TITO_GLB = ROOT / "games" / "Yun" / "assets" / "kenney" / "mini_characters" / "character-male-a.glb"

BLEND_PATH = OUTPUT_DIR / "v01-blockout.blend"
CLOSE_RENDER = OUTPUT_DIR / "v01-blockout-close.png"
GAMEPLAY_RENDER = OUTPUT_DIR / "v01-blockout-gameplay.png"
DONE_FLAG = OUTPUT_DIR / "v01-blockout-ready.flag"

CHAIR_COLLECTION = "EXPORT_PlasticChair_Blockout"
REFERENCE_COLLECTION = "REFERENCE_CurrentTito"


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


def ensure_collection(name):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def material(name, color):
    value = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1.0)
    value.roughness = 0.82
    return value


def add_box(name, location, dimensions, collection, color=(0.70, 0.73, 0.72)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    move_to_collection(obj, collection)
    obj.data.materials.append(material("MAT_BlockoutChair", color))
    return obj


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    scene = bpy.context.scene
    scene["ASSET_ID"] = "yun_plastic_chair_01"
    scene["CHECKPOINT"] = "v01-blockout"
    scene["STATUS"] = "AWAITING_OWNER_REVIEW"
    scene["EXPORT_POLICY"] = "Chair only; Tito and ground excluded"
    scene.world.color = (0.055, 0.065, 0.075)
    set_status("v01 blockout — empty scene ready")


def create_seat():
    collection = ensure_collection(CHAIR_COLLECTION)
    add_box("Chair_Seat_Blockout", (0.0, 0.0, 0.29), (0.50, 0.46, 0.075), collection)
    set_status("v01 blockout — seat width, depth, and height placed")


def create_legs():
    collection = ensure_collection(CHAIR_COLLECTION)
    for x, y, suffix in (
        (-0.205, -0.17, "Front_L"),
        (0.205, -0.17, "Front_R"),
        (-0.205, 0.17, "Rear_L"),
        (0.205, 0.17, "Rear_R"),
    ):
        add_box(f"Chair_Leg_{suffix}_Blockout", (x, y, 0.14), (0.075, 0.075, 0.28), collection)
    set_status("v01 blockout — four stable legs placed")


def create_back_and_arms():
    collection = ensure_collection(CHAIR_COLLECTION)
    back = add_box("Chair_Back_Blockout", (0.0, 0.205, 0.51), (0.46, 0.075, 0.47), collection)
    back.rotation_euler.x = math.radians(-7.0)
    for x, suffix in ((-0.235, "L"), (0.235, "R")):
        add_box(f"Chair_Arm_{suffix}_Blockout", (x, -0.015, 0.46), (0.065, 0.40, 0.07), collection)
        add_box(f"Chair_ArmSupport_{suffix}_Blockout", (x, -0.10, 0.385), (0.06, 0.06, 0.24), collection)
    set_status("v01 blockout — recognizable plastic-chair silhouette complete")


def visible_mesh_bounds(objects):
    points = []
    for obj in objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        return None
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return minimum, maximum


def add_ground_and_tito():
    reference = ensure_collection(REFERENCE_COLLECTION)
    ground = add_box("GroundReference", (0.40, 0.0, -0.035), (2.8, 2.2, 0.07), reference, color=(0.35, 0.31, 0.26))
    ground.data.materials.clear()
    ground.data.materials.append(material("MAT_GroundReference", (0.35, 0.31, 0.26)))

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(TITO_GLB))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    imported_set = set(imported)
    root = bpy.data.objects.new("CurrentGameplayTito_RuntimeScale1_2", None)
    reference.objects.link(root)
    root.location = (0.90, -0.05, 0.0)
    root.rotation_euler = (0.0, 0.0, math.radians(180.0))
    root.scale = (1.2, 1.2, 1.2)
    root["source_asset"] = "res://assets/kenney/mini_characters/character-male-a.glb"
    root["roster_name"] = "Tito"
    root["runtime_scale"] = 1.2
    for obj in imported:
        move_to_collection(obj, reference)
    for obj in imported:
        if obj.parent not in imported_set:
            obj.parent = root
    helper = bpy.data.objects.get("Icosphere")
    if helper is not None and helper in imported_set:
        helper.hide_render = True
        helper.hide_viewport = True
        helper["excluded_from_yun_gameplay_reference"] = True
    bpy.context.view_layer.update()
    bounds = visible_mesh_bounds([obj for obj in reference.all_objects if obj != ground])
    if bounds is not None:
        root.location.z -= bounds[0].z
    bpy.context.view_layer.update()
    set_status("v01 blockout — exact current Tito added as non-exporting scale reference")


def point_camera(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def ensure_camera(name, location, target, lens=52.0, fov=None):
    data = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    camera = bpy.data.objects.get(name) or bpy.data.objects.new(name, data)
    if not camera.users_collection:
        bpy.context.scene.collection.objects.link(camera)
    camera.location = location
    if fov is not None:
        data.angle = math.radians(fov)
    else:
        data.lens = lens
    point_camera(camera, target)
    return camera


def add_lighting():
    bpy.ops.object.light_add(type="AREA", location=(1.3, -2.0, 2.8))
    key = bpy.context.object
    key.name = "Review_Key"
    key.data.energy = 700
    key.data.shape = "DISK"
    key.data.size = 4.0
    point_camera(key, (0.25, 0.0, 0.35))
    bpy.ops.object.light_add(type="AREA", location=(-2.0, 0.8, 1.8))
    fill = bpy.context.object
    fill.name = "Review_Fill"
    fill.data.energy = 320
    fill.data.size = 3.0
    point_camera(fill, (0.1, 0.0, 0.35))


def render(path, camera):
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
    scene.render.filepath = str(path)
    scene.render.film_transparent = False
    bpy.ops.render.render(write_still=True)


def save_checkpoint():
    add_lighting()
    close_camera = ensure_camera(
        "BlockoutCloseCamera",
        (2.25, -3.0, 1.65),
        (0.25, 0.0, 0.36),
        lens=58.0,
    )
    gameplay_camera = ensure_camera(
        "YunGameplayCamera46Degrees",
        (0.25, -4.9, 2.65),
        (0.35, 0.0, 0.48),
        fov=46.0,
    )
    render(CLOSE_RENDER, close_camera)
    render(GAMEPLAY_RENDER, gameplay_camera)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    bpy.context.scene.camera = close_camera
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
    DONE_FLAG.write_text("AWAITING_OWNER_REVIEW\n", encoding="utf-8")
    set_status("v01 plastic chair blockout visible — AWAITING OWNER REVIEW")


steps = [clear_scene, create_seat, create_legs, create_back_and_arms, add_ground_and_tito, save_checkpoint]
step_index = 0


def run_next():
    global step_index
    if step_index >= len(steps):
        return None
    try:
        steps[step_index]()
        step_index += 1
        return 1.4 if step_index < len(steps) else None
    except Exception as error:
        (OUTPUT_DIR / "v01-blockout-error.txt").write_text(
            f"Step {step_index + 1}: {type(error).__name__}: {error}\n",
            encoding="utf-8",
        )
        set_status(f"v01 plastic chair blockout failed: {error}")
        raise


OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
set_status("Yun plastic chair v01 — starting visibly in five seconds")
bpy.app.timers.register(run_next, first_interval=5.0)
