import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(r"D:\dev\Northern Step Studio")
OUTPUT_DIR = ROOT / "artifacts" / "environment" / "dominican" / "yun_vehicle_family_v1"
TITO_GLB = ROOT / "games" / "Yun" / "assets" / "kenney" / "mini_characters" / "character-male-a.glb"

BLEND_PATH = OUTPUT_DIR / "v01-blockout.blend"
LINEUP_RENDER = OUTPUT_DIR / "v01-blockout-lineup.png"
GAMEPLAY_RENDER = OUTPUT_DIR / "v01-blockout-gameplay.png"
DONE_FLAG = OUTPUT_DIR / "v01-blockout-ready.flag"
ERROR_FILE = OUTPUT_DIR / "v01-blockout-error.txt"

# Width, length, height in meters. These are the current Yun runtime bounds at
# scale 1.15, measured from the seven parked Kenney placeholders. Only the
# dimensional contract is used; every visible replacement form is new.
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


def ensure_collection(name, parent=None):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(collection)
    return collection


def move_to_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def material(name, color, metallic=0.0, roughness=0.82):
    value = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1.0)
    value.metallic = metallic
    value.roughness = roughness
    return value


def add_box(name, location, dimensions, collection, mat, bevel=0.0, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0.0:
        modifier = obj.modifiers.new("BlockoutSoftEdges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    move_to_collection(obj, collection)
    obj.data.materials.append(mat)
    if parent is not None:
        obj.parent = parent
    return obj


def add_wheel(name, location, radius, width, collection, parent):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12,
        radius=radius,
        depth=width,
        location=location,
        rotation=(0.0, math.radians(90.0), 0.0),
    )
    wheel = bpy.context.object
    wheel.name = name
    move_to_collection(wheel, collection)
    wheel.data.materials.append(material("MAT_BlockoutTires", (0.055, 0.065, 0.075), roughness=0.9))
    wheel.parent = parent
    return wheel


def add_text(name, body, location, size=0.32, align="CENTER"):
    reference = ensure_collection("REFERENCE_ReviewOnly")
    bpy.ops.object.text_add(location=location, rotation=(math.radians(72.0), 0.0, 0.0))
    text = bpy.context.object
    text.name = name
    text.data.body = body
    text.data.align_x = align
    text.data.align_y = "CENTER"
    text.data.size = size
    text.data.extrude = 0.008
    text.data.materials.append(material("MAT_ReviewLabels", (0.92, 0.94, 0.96), roughness=1.0))
    move_to_collection(text, reference)
    return text


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    base = bpy.data.collections.get("Collection")
    if base:
        base.name = "SCENE_LightingAndCameras"

    scene = bpy.context.scene
    scene["ASSET_ID"] = "yun_vehicle_family_v1"
    scene["CHECKPOINT"] = "v01-blockout"
    scene["STATUS"] = "AWAITING_OWNER_REVIEW"
    scene["VEHICLE_COUNT"] = 7
    scene["DESIGN_PROVENANCE"] = "Original NSS geometry; current Yun assets used only for dimensions"
    scene["EXPORT_POLICY"] = "Seven EXPORT collections only; Tito, labels, ground, cameras excluded"
    scene.world.color = (0.035, 0.045, 0.060)

    reference = ensure_collection("REFERENCE_ReviewOnly")
    ground = add_box(
        "ReviewGround",
        (0.0, 0.0, -0.06),
        (19.2, 10.8, 0.12),
        reference,
        material("MAT_ReviewGround", (0.18, 0.20, 0.23)),
    )
    ground["export"] = False
    for x in (-8.8, -4.4, 0.0, 4.4, 8.8):
        add_box(
            f"GridLineX_{x:+.1f}",
            (x, 0.0, 0.012),
            (0.025, 10.3, 0.008),
            reference,
            material("MAT_ReviewGrid", (0.29, 0.33, 0.38)),
        )
    for y in (-4.7, 0.0, 4.7):
        add_box(
            f"GridLineY_{y:+.1f}",
            (0.0, y, 0.013),
            (18.7, 0.025, 0.008),
            reference,
            material("MAT_ReviewGrid", (0.29, 0.33, 0.38)),
        )
    add_text("Title", "YUN VEHICLE FAMILY — v01 BLOCKOUT", (-8.7, 4.55, 0.08), size=0.38, align="LEFT")
    set_status("v01 vehicle family — review ground and exact Yun footprints ready")


def create_vehicle(name):
    width, length, height = VEHICLES[name]
    x, y, _ = POSITIONS[name]
    collection = ensure_collection(f"EXPORT_Vehicle_{name}_Blockout")
    root = bpy.data.objects.new(f"Vehicle_{name}_ROOT", None)
    collection.objects.link(root)
    # Children are authored at their review-world positions for this combined
    # v01 sheet, so the collection root must not apply that offset a second time.
    root.location = (0.0, 0.0, 0.0)
    root["review_position_xyz"] = (x, y, 0.0)
    root["checkpoint"] = "v01-blockout"
    root["target_width_m"] = width
    root["target_length_m"] = length
    root["target_height_m"] = height
    root["runtime_scale_contract"] = 1.15

    clay = material("MAT_BlockoutVehicles", (0.39, 0.53, 0.62), roughness=0.84)
    glass = material("MAT_BlockoutGlass", (0.13, 0.23, 0.30), roughness=0.65)
    accent = material("MAT_BlockoutAccent", (0.70, 0.47, 0.18), roughness=0.80)
    wheel_radius = min(0.29, height * 0.20)
    wheel_width = 0.14
    body_bottom = wheel_radius * 0.68
    lower_height = max(0.38, min(0.58, height * 0.36))
    lower_z = body_bottom + lower_height * 0.50
    lower_length = length * 0.92

    add_box(
        f"{name}_LowerBody",
        (x, y, lower_z),
        (width * 0.92, lower_length, lower_height),
        collection,
        clay,
        bevel=0.07,
        parent=root,
    )

    if name == "Delivery":
        cabin_height = height * 0.47
        cabin_length = length * 0.30
        cabin_y = y - length * 0.28
        add_box(
            f"{name}_Cabin",
            (x, cabin_y, lower_z + lower_height * 0.50 + cabin_height * 0.50 - 0.02),
            (width * 0.84, cabin_length, cabin_height),
            collection,
            glass,
            bevel=0.05,
            parent=root,
        )
        cargo_height = height - (lower_z + lower_height * 0.50)
        cargo_length = length * 0.56
        cargo_y = y + length * 0.17
        add_box(
            f"{name}_CargoBox",
            (x, cargo_y, lower_z + lower_height * 0.50 + cargo_height * 0.50),
            (width * 0.90, cargo_length, cargo_height),
            collection,
            clay,
            bevel=0.035,
            parent=root,
        )
    elif name == "Van":
        upper_height = height - (lower_z + lower_height * 0.50)
        add_box(
            f"{name}_UpperCabin",
            (x, y + length * 0.02, lower_z + lower_height * 0.50 + upper_height * 0.50),
            (width * 0.86, length * 0.67, upper_height),
            collection,
            clay,
            bevel=0.08,
            parent=root,
        )
        add_box(
            f"{name}_Windshield",
            (x, y - length * 0.325, height * 0.69),
            (width * 0.70, 0.035, upper_height * 0.48),
            collection,
            glass,
            bevel=0.015,
            parent=root,
        )
    else:
        roof_height = max(0.30, height - (lower_z + lower_height * 0.50))
        cabin_length_factor = {
            "Sedan": 0.45,
            "Taxi": 0.46,
            "SportSedan": 0.43,
            "SportHatch": 0.52,
            "SUV": 0.57,
        }[name]
        cabin_y = y + (length * 0.08 if name in {"SportHatch", "SUV"} else 0.0)
        add_box(
            f"{name}_Cabin",
            (x, cabin_y, lower_z + lower_height * 0.50 + roof_height * 0.50 - 0.015),
            (width * 0.72, length * cabin_length_factor, roof_height),
            collection,
            glass,
            bevel=0.09 if name != "SportSedan" else 0.06,
            parent=root,
        )
        hood_length = length * (0.23 if name != "SportHatch" else 0.18)
        add_box(
            f"{name}_Hood",
            (x, y - length * 0.35, lower_z + lower_height * 0.36),
            (width * 0.84, hood_length, lower_height * 0.28),
            collection,
            clay,
            bevel=0.035,
            parent=root,
        )
        if name == "Taxi":
            add_box(
                "Taxi_RoofSign_Blockout",
                (x, cabin_y, height - 0.065),
                (0.38, 0.24, 0.13),
                collection,
                accent,
                bevel=0.025,
                parent=root,
            )
        if name in {"SportSedan", "SportHatch"}:
            add_box(
                f"{name}_RearSpoiler",
                (x, y + length * 0.43, lower_z + lower_height * 0.72),
                (width * 0.73, 0.09, 0.07),
                collection,
                accent,
                bevel=0.015,
                parent=root,
            )

    wheel_y = length * 0.31
    wheel_x = width * 0.46
    for side_x, side_name in ((-wheel_x, "L"), (wheel_x, "R")):
        for axle_y, axle_name in ((-wheel_y, "Front"), (wheel_y, "Rear")):
            add_wheel(
                f"{name}_Wheel_{axle_name}_{side_name}",
                (x + side_x, y + axle_y, wheel_radius),
                wheel_radius,
                wheel_width,
                collection,
                root,
            )

    add_text(f"Label_{name}", name.upper().replace("SPORT", "SPORT "), (x, y - length * 0.70, 0.05), size=0.26)
    set_status(f"v01 vehicle family — {name} silhouette added ({list(VEHICLES).index(name) + 1}/7)")


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


def add_current_tito():
    reference = ensure_collection("REFERENCE_ReviewOnly")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(TITO_GLB))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    imported_set = set(imported)
    root = bpy.data.objects.new("CurrentGameplayTito_RuntimeScale1_2", None)
    reference.objects.link(root)
    root.location = (-8.35, -4.05, 0.0)
    root.rotation_euler = (0.0, 0.0, math.radians(180.0))
    root.scale = (1.2, 1.2, 1.2)
    root["source_asset"] = "res://assets/kenney/mini_characters/character-male-a.glb"
    root["roster_name"] = "Tito"
    root["runtime_scale"] = 1.2
    root["export"] = False
    for obj in imported:
        move_to_collection(obj, reference)
    for obj in imported:
        if obj.parent not in imported_set:
            obj.parent = root
    helper = next((obj for obj in imported if obj.name.startswith("Icosphere")), None)
    if helper is not None:
        helper.hide_render = True
        helper.hide_viewport = True
        helper["excluded_from_yun_gameplay_reference"] = True
    bpy.context.view_layer.update()
    bounds = visible_mesh_bounds([obj for obj in imported if obj.type == "MESH"])
    if bounds is not None:
        root.location.z -= bounds[0].z
    add_text("TitoLabel", "CURRENT TITO 1.2x", (-8.35, -4.72, 0.05), size=0.25)
    set_status("v01 vehicle family — exact current Tito added as scale reference")


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_lighting():
    bpy.ops.object.light_add(type="AREA", location=(-4.0, -6.0, 11.0))
    key = bpy.context.object
    key.name = "Review_Key"
    key.data.energy = 850
    key.data.shape = "DISK"
    key.data.size = 7.0
    point_at(key, (0.0, 0.0, 0.8))
    bpy.ops.object.light_add(type="AREA", location=(8.0, 3.0, 7.0))
    fill = bpy.context.object
    fill.name = "Review_Fill"
    fill.data.energy = 380
    fill.data.size = 8.0
    point_at(fill, (0.0, 0.0, 0.8))


def ensure_camera(name, location, target, fov=46.0):
    data = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    camera = bpy.data.objects.get(name) or bpy.data.objects.new(name, data)
    if not camera.users_collection:
        bpy.context.scene.collection.objects.link(camera)
    camera.location = location
    data.angle = math.radians(fov)
    point_at(camera, target)
    return camera


def render(path, camera):
    scene = bpy.context.scene
    scene.camera = camera
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1440
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(path)
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    bpy.ops.render.render(write_still=True)


def save_checkpoint():
    add_lighting()
    lineup_camera = ensure_camera(
        "BlockoutLineupCamera",
        (14.5, -24.0, 17.2),
        (0.0, 0.0, 0.65),
        fov=55.0,
    )
    gameplay_camera = ensure_camera(
        "YunGameplayCamera46Degrees",
        (0.0, -30.0, 14.5),
        (0.0, 0.0, 0.72),
        fov=46.0,
    )
    render(LINEUP_RENDER, lineup_camera)
    render(GAMEPLAY_RENDER, gameplay_camera)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    bpy.context.scene.camera = lineup_camera
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
    set_status("v01 seven-vehicle family visible — AWAITING OWNER REVIEW")


steps = [
    clear_scene,
    lambda: create_vehicle("Sedan"),
    lambda: create_vehicle("Taxi"),
    lambda: create_vehicle("SportSedan"),
    lambda: create_vehicle("SportHatch"),
    lambda: create_vehicle("SUV"),
    lambda: create_vehicle("Van"),
    lambda: create_vehicle("Delivery"),
    add_current_tito,
    save_checkpoint,
]
step_index = 0


def run_next():
    global step_index
    if step_index >= len(steps):
        return None
    try:
        steps[step_index]()
        step_index += 1
        return 1.15 if step_index < len(steps) else None
    except Exception as error:
        ERROR_FILE.write_text(
            f"Step {step_index + 1}: {type(error).__name__}: {error}\n",
            encoding="utf-8",
        )
        set_status(f"v01 vehicle family failed: {error}")
        raise


OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
for stale in (DONE_FLAG, ERROR_FILE):
    if stale.exists():
        stale.unlink()
set_status("Yun seven-vehicle v01 batch — starting visibly in five seconds")
bpy.app.timers.register(run_next, first_interval=5.0)
