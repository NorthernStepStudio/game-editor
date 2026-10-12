import math
from pathlib import Path

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(r"D:\dev\Northern Step Studio\artifacts\environment\dominican\yun_vehicle_family_v1")
BLEND_PATH = OUTPUT_DIR / "v02-structure-r6.blend"
LINEUP_RENDER = OUTPUT_DIR / "v02-structure-r6-lineup.png"
GAMEPLAY_RENDER = OUTPUT_DIR / "v02-structure-r6-gameplay.png"
DONE_FLAG = OUTPUT_DIR / "v02-structure-r6-ready.flag"
ERROR_FILE = OUTPUT_DIR / "v02-structure-r6-error.txt"

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

# These are the actual cabin-shell bounds used by v02, not secondary window
# insets inherited from earlier revisions. Glass is derived from these values.
CABINS = {
    "Sedan": dict(bottom_z=0.62, top_z=1.40, bw=1.50 * 0.78, tw=1.50 * 0.64, bl=2.55 * 0.47, tl=2.55 * 0.31, shift=0.0, split=0.50),
    "Taxi": dict(bottom_z=0.63, top_z=1.60, bw=1.50 * 0.78, tw=1.50 * 0.64, bl=2.75 * 0.47, tl=2.75 * 0.32, shift=0.0, split=0.50),
    "SportSedan": dict(bottom_z=0.54, top_z=1.18, bw=1.30 * 0.78, tw=1.30 * 0.62, bl=2.55 * 0.44, tl=2.55 * 0.28, shift=0.0, split=0.54),
    "SportHatch": dict(bottom_z=0.54, top_z=1.18, bw=1.30 * 0.78, tw=1.30 * 0.64, bl=2.85 * 0.55, tl=2.85 * 0.41, shift=2.85 * 0.08, split=0.48),
    "SUV": dict(bottom_z=0.58, top_z=1.35, bw=1.50 * 0.82, tw=1.50 * 0.70, bl=2.55 * 0.60, tl=2.55 * 0.48, shift=2.55 * 0.05, split=0.50),
    "Van": dict(bottom_z=0.58, top_z=1.41, bw=1.50 * 0.84, tw=1.50 * 0.76, bl=2.75 * 0.70, tl=2.75 * 0.60, shift=2.75 * 0.04, split=None),
    "Delivery": dict(bottom_z=0.61, top_z=1.48, bw=1.50 * 0.84, tw=1.50 * 0.73, bl=3.25 * 0.31, tl=3.25 * 0.23, shift=-3.25 * 0.29, split=None),
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
    solidify.thickness = 0.010
    solidify.offset = 0.0
    bevel = obj.modifiers.new("GlassEdgeSoftening", "BEVEL")
    bevel.width = 0.009
    bevel.segments = 2
    obj["window_revision"] = "v02-structure-r6"
    return obj


def side_quad(side, bottom_x, top_x, front_bottom, rear_bottom, front_top, rear_top, bottom_z, top_z):
    xb = side * bottom_x
    xt = side * top_x
    if side > 0.0:
        return [
            (xb, front_bottom, bottom_z),
            (xb, rear_bottom, bottom_z),
            (xt, rear_top, top_z),
            (xt, front_top, top_z),
        ]
    return [
        (xb, rear_bottom, bottom_z),
        (xb, front_bottom, bottom_z),
        (xt, front_top, top_z),
        (xt, rear_top, top_z),
    ]


def rebuild_front_glass(name, collection, root, glass):
    remove_named(
        lambda object_name: object_name.startswith((name, "DeliveryCab" if name == "Delivery" else "__never__"))
        and "FrontWindshield" in object_name
    )
    spec = CABINS[name]
    front_bottom = spec["shift"] - spec["bl"] * 0.5 - 0.012
    front_top = spec["shift"] - spec["tl"] * 0.5 - 0.012
    bottom_z = spec["bottom_z"] + 0.060
    top_z = spec["top_z"] - 0.055
    bottom_half = spec["bw"] * 0.5 - 0.060
    top_half = spec["tw"] * 0.5 - 0.055

    if name == "Delivery":
        gap = 0.038
        add_panel(
            "DeliveryCab_FrontWindshield_L_R6",
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
            "DeliveryCab_FrontWindshield_R_R6",
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
        return

    add_panel(
        f"{name}_FrontWindshield_R6",
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


def rebuild_side_glass(name, collection, root, glass):
    remove_named(
        lambda object_name: object_name.startswith((name, "DeliveryCab" if name == "Delivery" else "__never__"))
        and "SideWindow" in object_name
    )
    spec = CABINS[name]
    bottom_z = spec["bottom_z"] + 0.060
    top_z = spec["top_z"] - 0.055
    bottom_x = spec["bw"] * 0.5 + 0.010
    top_x = spec["tw"] * 0.5 + 0.010
    front_bottom = spec["shift"] - spec["bl"] * 0.5 + 0.060
    rear_bottom = spec["shift"] + spec["bl"] * 0.5 - 0.060
    front_top = spec["shift"] - spec["tl"] * 0.5 + 0.050
    rear_top = spec["shift"] + spec["tl"] * 0.5 - 0.050

    if name == "Van":
        # Driver/front-passenger glass fills the forward door opening and rises
        # to the roof header; the cargo-side panel stays solid.
        front_bottom = spec["shift"] - spec["bl"] * 0.5 + 0.055
        rear_bottom = front_bottom + 0.62
        front_top = spec["shift"] - spec["tl"] * 0.5 + 0.045
        rear_top = front_top + 0.56
    elif name == "Delivery":
        # Cab-over glass uses almost the full short door opening for visibility.
        front_bottom = spec["shift"] - spec["bl"] * 0.5 + 0.050
        rear_bottom = spec["shift"] + spec["bl"] * 0.5 - 0.050
        front_top = spec["shift"] - spec["tl"] * 0.5 + 0.045
        rear_top = spec["shift"] + spec["tl"] * 0.5 - 0.045

    prefix = "DeliveryCab" if name == "Delivery" else name
    for side, suffix in ((-1.0, "L"), (1.0, "R")):
        if spec["split"] is None:
            add_panel(
                f"{prefix}_SideWindow_{suffix}_R6",
                side_quad(side, bottom_x, top_x, front_bottom, rear_bottom, front_top, rear_top, bottom_z, top_z),
                collection,
                root,
                glass,
            )
            continue

        split = spec["split"]
        mid_bottom = front_bottom + (rear_bottom - front_bottom) * split
        mid_top = front_top + (rear_top - front_top) * split
        pillar_half = 0.034
        add_panel(
            f"{prefix}_SideWindowFront_{suffix}_R6",
            side_quad(side, bottom_x, top_x, front_bottom, mid_bottom - pillar_half, front_top, mid_top - pillar_half, bottom_z, top_z),
            collection,
            root,
            glass,
        )
        add_panel(
            f"{prefix}_SideWindowRear_{suffix}_R6",
            side_quad(side, bottom_x, top_x, mid_bottom + pillar_half, rear_bottom, mid_top + pillar_half, rear_top, bottom_z, top_z),
            collection,
            root,
            glass,
        )


def correct_vehicle(name):
    collection = bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure")
    root = bpy.data.objects.get(f"Vehicle_{name}_ROOT")
    glass = bpy.data.materials.get("MAT_StructureGlass")
    if collection is None or root is None or glass is None:
        raise RuntimeError(f"Missing r5 structure for {name}")
    rebuild_front_glass(name, collection, root, glass)
    rebuild_side_glass(name, collection, root, glass)
    if name == "Van":
        # The r5 temporary seam frame was visually too strong and belongs in
        # the later detail pass, not in the corrected structure checkpoint.
        remove_named(lambda object_name: object_name.startswith("Van_DoorSeam_"))
    root["checkpoint"] = "v02-structure-r6"
    root["window_construction_rule"] = "60mm beltline gap, 55mm roof-header gap, narrow pillars"
    set_status(f"v02 r6 — {name}: front and side glass now reaches the roof header ({list(VEHICLES).index(name) + 1}/7)")


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
    scene["CHECKPOINT"] = "v02-structure-r6"
    scene["STATUS"] = "CORRECTING_WINDOWS_TO_MEASURED_CABIN_BOUNDS"
    scene["CORRECTION"] = "front and side glass extends to roof header and beltline using cabin-shell bounds"
    title = bpy.data.objects.get("Title")
    if title and title.type == "FONT":
        title.data.body = "YUN VEHICLE FAMILY — v02 STRUCTURE r6 — CABIN-FIT WINDOWS"
    audit_camera = camera("WindowOpeningAuditCamera", (9.7, -13.2, 5.6), (0.0, -0.15, 0.76), 52.0)
    configure_view(audit_camera)
    set_status("v02 r6 — measured cabin-bound window correction begins visibly")


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
    camera_obj = bpy.data.objects.get("VehicleWindowInspectionCamera")
    if camera_obj is None:
        data = bpy.data.cameras.new("VehicleWindowInspectionCamera")
        camera_obj = bpy.data.objects.new("VehicleWindowInspectionCamera", data)
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
        camera_obj.data.ortho_scale = max(3.25, length * factor * 1.20, height * factor * 1.75)
        camera_obj.location = (x + 3.8, y - 4.6, max(2.5, height * factor * 1.65))
        point_at(camera_obj, (x, y, height * factor * 0.50))
        render(OUTPUT_DIR / f"v02-structure-r6-{name.lower()}-windows.png", camera_obj, resolution=(960, 720))
    for collection in collections.values():
        if collection:
            collection.hide_render = False


def save_revision():
    scene = bpy.context.scene
    lineup_camera = bpy.data.objects.get("BlockoutLineupCamera")
    gameplay_camera = bpy.data.objects.get("YunGameplayCamera46Degrees")
    audit_camera = bpy.data.objects.get("WindowOpeningAuditCamera")
    if lineup_camera is None or gameplay_camera is None or audit_camera is None:
        raise RuntimeError("Window review cameras are missing")
    render(LINEUP_RENDER, lineup_camera)
    render(GAMEPLAY_RENDER, gameplay_camera)
    render_individual_views()
    scene["STATUS"] = "AWAITING_OWNER_REVIEW"
    scene.camera = audit_camera
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    configure_view(audit_camera)
    DONE_FLAG.write_text("AWAITING_OWNER_REVIEW\n", encoding="utf-8")
    set_status("v02 structure r6 cabin-fit windows visible — AWAITING OWNER REVIEW")


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
        return 1.45 if step_index < len(steps) else None
    except Exception as error:
        ERROR_FILE.write_text(f"Step {step_index + 1}: {type(error).__name__}: {error}\n", encoding="utf-8")
        set_status(f"v02 r6 window correction failed: {error}")
        raise


for stale in (DONE_FLAG, ERROR_FILE):
    if stale.exists():
        stale.unlink()
set_status("Yun vehicle v02 r6 cabin-fit windows — starting visibly in four seconds")
bpy.app.timers.register(run_next, first_interval=4.0)
