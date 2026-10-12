from pathlib import Path

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(__file__).resolve().parent
OUTPUT_BLEND = OUTPUT_DIR / "v02-structure-r2.blend"

COLLECTION_NAME = "V02_Structure_Buildings"
HOUSE_ID = "yun_residential_house_04_v01"
CORRECTION_PREFIX = "V02R2_"


def ensure_collection(name):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj, collection):
    for old_collection in list(obj.users_collection):
        old_collection.objects.unlink(obj)
    collection.objects.link(obj)


def mark(obj, asset_id=HOUSE_ID):
    obj["asset_id"] = asset_id
    obj["checkpoint"] = "v02-structure-r2"
    obj["exportable"] = True
    obj["correction"] = "owner-visible structural contact repair"
    return obj


def add_box(name, location, dimensions, collection):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    move_to_collection(obj, collection)
    bevel = obj.modifiers.new("Readable edge bevel", "BEVEL")
    bevel.width = 0.025
    bevel.segments = 1
    return mark(obj)


def add_cylinder(name, location, radius, depth, collection, rotation=(1.5707963268, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=10,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    return mark(obj)


def remove_previous_correction():
    for obj in list(bpy.data.objects):
        if obj.name.startswith(CORRECTION_PREFIX):
            bpy.data.objects.remove(obj, do_unlink=True)


def remove_blocked_upper_window(collection):
    # The stair lands at the right side of House 04. Remove only the window that
    # occupied the future balcony-door bay; keep the second upper window intact.
    for obj in list(collection.objects):
        if "Window_" not in obj.name:
            continue
        if obj.location.z < 3.7:
            continue
        if abs(obj.location.x - (-3.95)) <= 0.75:
            bpy.data.objects.remove(obj, do_unlink=True)


def add_balcony_door(collection):
    x = -3.95
    front_y = 13.732
    floor_z = 3.38
    width = 0.98
    height = 2.18
    z = floor_z + height / 2

    add_box(
        f"{CORRECTION_PREFIX}{HOUSE_ID}_UpperDoor_Frame",
        (x, front_y - 0.105, z),
        (width + 0.20, 0.18, height + 0.22),
        collection,
    )
    add_box(
        f"{CORRECTION_PREFIX}{HOUSE_ID}_UpperDoor_Leaf",
        (x, front_y - 0.22, z),
        (width, 0.055, height),
        collection,
    )
    add_box(
        f"{CORRECTION_PREFIX}{HOUSE_ID}_UpperDoor_Panel",
        (x, front_y - 0.265, z + 0.10),
        (width * 0.65, 0.035, height * 0.53),
        collection,
    )
    add_cylinder(
        f"{CORRECTION_PREFIX}{HOUSE_ID}_UpperDoor_Knob",
        (x + width * 0.34, front_y - 0.31, z),
        0.055,
        0.06,
        collection,
    )
    add_box(
        f"{CORRECTION_PREFIX}{HOUSE_ID}_UpperDoor_Threshold",
        (x, front_y - 0.43, floor_z + 0.055),
        (1.18, 0.46, 0.11),
        collection,
    )


def connect_stair_to_landing(collection):
    front_lower = 13.2
    stair_x = -1.20
    for step in (18, 19):
        z = 0.16 + step * 0.18
        y = front_lower - 3.7 + step * 0.21
        add_box(
            f"{CORRECTION_PREFIX}{HOUSE_ID}_Exterior_Stair_{step + 1}",
            (stair_x, y, z),
            (0.95, 0.34, 0.18),
            collection,
        )


def seat_water_tanks_on_supports():
    # The v02 generator left a 4 cm visual air gap between every tank body and
    # its support legs. Lower the bodies/lids once so the geometry is in contact.
    for obj in bpy.data.objects:
        if "_WaterTank" not in obj.name and "_Tank_Lid" not in obj.name:
            continue
        if obj.get("v02r2_tank_contact_fixed"):
            continue
        obj.location.z -= 0.04
        obj["v02r2_tank_contact_fixed"] = True
        obj["checkpoint"] = "v02-structure-r2"


def frame_architecture_review():
    scene = bpy.context.scene
    cameras = [obj for obj in bpy.data.objects if obj.type == "CAMERA"]
    preferred = next(
        (obj for obj in cameras if "architecture" in obj.name.lower()),
        None,
    )
    if preferred is None:
        preferred = next(
            (obj for obj in cameras if "close" in obj.name.lower()),
            None,
        )
    if preferred is not None:
        scene.camera = preferred

    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type != "VIEW_3D":
                continue
            space = area.spaces.active
            space.region_3d.view_perspective = "CAMERA"
            space.overlay.show_floor = True
            space.overlay.show_axis_x = True
            space.overlay.show_axis_y = True


def render_review_images():
    scene = bpy.context.scene
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    views = (
        (
            "V02_ReviewCamera_Architecture",
            OUTPUT_DIR / "v02-structure-r2-architecture.png",
        ),
        (
            "V02_ReviewCamera_Overview",
            OUTPUT_DIR / "v02-structure-r2-overview.png",
        ),
    )
    for camera_name, output_path in views:
        camera = bpy.data.objects.get(camera_name)
        if camera is None:
            continue
        scene.camera = camera
        scene.render.filepath = str(output_path)
        bpy.ops.render.render(write_still=True)
    architecture_camera = bpy.data.objects.get("V02_ReviewCamera_Architecture")
    if architecture_camera is not None:
        scene.camera = architecture_camera


def main():
    collection = ensure_collection(COLLECTION_NAME)
    remove_previous_correction()
    remove_blocked_upper_window(collection)
    add_balcony_door(collection)
    connect_stair_to_landing(collection)
    seat_water_tanks_on_supports()

    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v02-structure-r2"
    scene["VISIBLE_CREATION_STATUS"] = "AWAITING OWNER REVIEW"
    scene["V02R2_CORRECTIONS"] = (
        "House 04 balcony door added; exterior stair connected to landing; "
        "all rooftop water tanks seated on their supports."
    )
    frame_architecture_review()
    render_review_images()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    print(f"VISIBLE CHECKPOINT SAVED: {OUTPUT_BLEND}")


if __name__ == "__main__":
    main()
