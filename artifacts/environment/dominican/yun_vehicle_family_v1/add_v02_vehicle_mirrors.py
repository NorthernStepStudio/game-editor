import math
from pathlib import Path

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(r"D:\dev\Northern Step Studio\artifacts\environment\dominican\yun_vehicle_family_v1")
BLEND_PATH = OUTPUT_DIR / "v02-structure-r8.blend"
LINEUP_RENDER = OUTPUT_DIR / "v02-structure-r8-lineup.png"
GAMEPLAY_RENDER = OUTPUT_DIR / "v02-structure-r8-gameplay.png"
DONE_FLAG = OUTPUT_DIR / "v02-structure-r8-ready.flag"
ERROR_FILE = OUTPUT_DIR / "v02-structure-r8-error.txt"

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

CABINS = {
    "Sedan": dict(bottom_z=0.62, bw=1.50 * 0.78, bl=2.55 * 0.47, shift=0.0),
    "Taxi": dict(bottom_z=0.63, bw=1.50 * 0.78, bl=2.75 * 0.47, shift=0.0),
    "SportSedan": dict(bottom_z=0.54, bw=1.30 * 0.78, bl=2.55 * 0.44, shift=0.0),
    "SportHatch": dict(bottom_z=0.54, bw=1.30 * 0.78, bl=2.85 * 0.55, shift=2.85 * 0.08),
    "SUV": dict(bottom_z=0.58, bw=1.50 * 0.82, bl=2.55 * 0.60, shift=2.55 * 0.05),
    "Van": dict(bottom_z=0.58, bw=1.50 * 0.84, bl=2.75 * 0.70, shift=2.75 * 0.04),
    "Delivery": dict(bottom_z=0.61, bw=1.50 * 0.84, bl=3.25 * 0.31, shift=-3.25 * 0.29),
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


def material(name, color, metallic=0.0, roughness=0.8):
    value = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1.0)
    value.metallic = metallic
    value.roughness = roughness
    value.use_nodes = True
    principled = value.node_tree.nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = (*color, 1.0)
        principled.inputs["Roughness"].default_value = roughness
        principled.inputs["Metallic"].default_value = metallic
    return value


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
    modifier = obj.modifiers.new("MirrorSoftEdges", "BEVEL")
    modifier.width = bevel
    modifier.segments = 2
    obj["mirror_revision"] = "v02-structure-r8"
    return obj


def remove_old_mirrors(name):
    for obj in list(bpy.data.objects):
        if obj.name.startswith(f"{name}_Mirror_"):
            bpy.data.objects.remove(obj, do_unlink=True)


def add_vehicle_mirrors(name):
    collection = bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure")
    root = bpy.data.objects.get(f"Vehicle_{name}_ROOT")
    if collection is None or root is None:
        raise RuntimeError(f"Missing r7 structure for {name}")
    remove_old_mirrors(name)
    spec = CABINS[name]
    housing = material("MAT_StructureMirrorHousing", (0.16, 0.24, 0.28), roughness=0.74)
    reflective = material("MAT_StructureMirrorFace", (0.09, 0.16, 0.19), metallic=0.55, roughness=0.28)
    mount = material("MAT_StructureMirrorMount", (0.04, 0.05, 0.06), roughness=0.86)

    commercial = name in {"Van", "Delivery"}
    suv = name == "SUV"
    housing_x = 0.19 if commercial else (0.17 if suv else 0.15)
    housing_y = 0.16 if commercial else 0.14
    housing_z = 0.12 if commercial else (0.11 if suv else 0.09)
    stem_x = 0.10 if commercial else 0.075
    front_edge = spec["shift"] - spec["bl"] * 0.5
    mirror_y = front_edge + (0.14 if commercial else 0.12)
    mirror_z = spec["bottom_z"] + (0.28 if commercial else 0.20)
    side_surface = spec["bw"] * 0.5

    for side, suffix in ((-1.0, "L"), (1.0, "R")):
        stem_center_x = side * (side_surface + stem_x * 0.48)
        housing_center_x = side * (side_surface + stem_x + housing_x * 0.38)
        add_box(
            f"{name}_Mirror_Mount_{suffix}",
            (stem_center_x, mirror_y, mirror_z - 0.015),
            (stem_x, 0.050, 0.050),
            collection,
            mount,
            0.012,
            root,
        )
        add_box(
            f"{name}_Mirror_Housing_{suffix}",
            (housing_center_x, mirror_y, mirror_z),
            (housing_x, housing_y, housing_z),
            collection,
            housing,
            0.030,
            root,
        )
        face_x = housing_center_x + side * (housing_x * 0.51)
        add_box(
            f"{name}_Mirror_Face_{suffix}",
            (face_x, mirror_y, mirror_z),
            (0.010, housing_y * 0.76, housing_z * 0.70),
            collection,
            reflective,
            0.012,
            root,
        )

    root["checkpoint"] = "v02-structure-r8"
    root["side_mirrors"] = "left and right fitted at front-door A-pillar"
    set_status(f"v02 r8 — {name}: left and right mirrors fitted ({list(VEHICLES).index(name) + 1}/7)")


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
            overlay = area.spaces.active.overlay
            overlay.show_relationship_lines = False
            overlay.show_extras = False
            overlay.show_outline_selected = False
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.region_3d.view_camera_zoom = 7
            try:
                area.spaces.active.shading.type = "RENDERED"
            except Exception:
                area.spaces.active.shading.type = "MATERIAL"
            area.tag_redraw()


def prepare_revision():
    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v02-structure-r8"
    scene["STATUS"] = "ADDING_SIDE_MIRRORS_VISIBLY"
    scene["CORRECTION"] = "left and right side mirrors on all seven vehicles"
    title = bpy.data.objects.get("Title")
    if title and title.type == "FONT":
        title.data.body = "YUN VEHICLE FAMILY — v02 STRUCTURE r8 — SIDE MIRRORS"
    close_camera = camera("MirrorAuditCamera", (9.8, -13.4, 5.4), (0.0, -0.2, 0.76), 52.0)
    configure_view(close_camera)
    set_status("v02 r8 — mirror correction begins visibly")


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


def render_individual_views():
    camera_obj = bpy.data.objects.get("VehicleMirrorInspectionCamera")
    if camera_obj is None:
        data = bpy.data.cameras.new("VehicleMirrorInspectionCamera")
        camera_obj = bpy.data.objects.new("VehicleMirrorInspectionCamera", data)
        bpy.context.scene.collection.objects.link(camera_obj)
    camera_obj.data.type = "ORTHO"
    collections = {name: bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure") for name in VEHICLES}
    for name, (width, length, height) in VEHICLES.items():
        root = bpy.data.objects.get(f"Vehicle_{name}_ROOT")
        factor = root.scale.x if root else 1.0
        x, y, _ = POSITIONS[name]
        for other_name, collection in collections.items():
            if collection:
                collection.hide_render = other_name != name
        camera_obj.data.ortho_scale = max(3.15, length * factor * 1.16, height * factor * 1.72)
        camera_obj.location = (x + 3.5, y - 4.3, max(2.35, height * factor * 1.58))
        point_at(camera_obj, (x, y, height * factor * 0.48))
        render(OUTPUT_DIR / f"v02-structure-r8-{name.lower()}-mirrors.png", camera_obj, resolution=(960, 720))
    for collection in collections.values():
        if collection:
            collection.hide_render = False


def save_revision():
    scene = bpy.context.scene
    lineup = bpy.data.objects.get("BlockoutLineupCamera")
    gameplay = bpy.data.objects.get("YunGameplayCamera46Degrees")
    audit = bpy.data.objects.get("MirrorAuditCamera")
    if lineup is None or gameplay is None or audit is None:
        raise RuntimeError("Mirror review cameras are missing")
    render(LINEUP_RENDER, lineup)
    render(GAMEPLAY_RENDER, gameplay)
    render_individual_views()
    scene["STATUS"] = "AWAITING_OWNER_REVIEW"
    scene.camera = audit
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    configure_view(audit)
    DONE_FLAG.write_text("AWAITING_OWNER_REVIEW\n", encoding="utf-8")
    set_status("v02 structure r8 mirrors fitted — AWAITING OWNER REVIEW")


steps = [
    prepare_revision,
    lambda: add_vehicle_mirrors("Sedan"),
    lambda: add_vehicle_mirrors("Taxi"),
    lambda: add_vehicle_mirrors("SportSedan"),
    lambda: add_vehicle_mirrors("SportHatch"),
    lambda: add_vehicle_mirrors("SUV"),
    lambda: add_vehicle_mirrors("Van"),
    lambda: add_vehicle_mirrors("Delivery"),
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
        return 1.45 if step_index < len(steps) else None
    except Exception as error:
        ERROR_FILE.write_text(f"Step {step_index + 1}: {type(error).__name__}: {error}\n", encoding="utf-8")
        set_status(f"v02 r8 mirror correction failed: {error}")
        raise


for stale in (DONE_FLAG, ERROR_FILE):
    if stale.exists():
        stale.unlink()
set_status("Yun vehicle v02 r8 mirrors — starting visibly in four seconds")
bpy.app.timers.register(run_next, first_interval=4.0)
