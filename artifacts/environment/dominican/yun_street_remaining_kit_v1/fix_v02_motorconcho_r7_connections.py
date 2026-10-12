from pathlib import Path
import importlib.util
import math

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(__file__).resolve().parent
OUTPUT_BLEND = OUTPUT_DIR / "v02-structure-r7-motorconcho-connections.blend"
NEAR_RENDER = OUTPUT_DIR / "v02-structure-r7-motorconcho-nearside.png"
FAR_RENDER = OUTPUT_DIR / "v02-structure-r7-motorconcho-farside.png"
DELIVERY_RENDER = OUTPUT_DIR / "v02-structure-r7-motorconcho-delivery-connections.png"
OVERVIEW_RENDER = OUTPUT_DIR / "v02-structure-r7-overview.png"
COLLECTION_NAME = "V02R7_Motorconcho_Connections"

spec = importlib.util.spec_from_file_location(
    "motorconcho_r6_helpers", OUTPUT_DIR / "fix_v02_motorconcho_r6.py"
)
r6 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r6)


def hide_misoriented_parts():
    for obj in bpy.data.objects:
        name = obj.name
        if (
            name.startswith(("Motorconcho125_Mirror_", "Delivery125_Mirror_"))
            and name.endswith("_Mirror")
        ) or (
            name.startswith(("Motorconcho125_RearShock_", "Delivery125_RearShock_"))
            and "_Spring_" in name
        ):
            obj.hide_render = True
            obj.hide_set(True)


def oriented_torus(name, center, axis, major, minor, collection, asset_id, dark=True):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=16,
        minor_segments=6,
        location=center,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = Vector(axis).to_track_quat("Z", "Y").to_euler()
    return r6.finish(obj, collection, asset_id, dark=dark)


def corrected_shock(prefix, upper, lower, collection, asset_id):
    upper_v = Vector(upper)
    lower_v = Vector(lower)
    axis = lower_v - upper_v
    for index in range(6):
        point = upper_v.lerp(lower_v, 0.20 + index * 0.11)
        oriented_torus(
            f"{prefix}_AlignedSpring_{index + 1}", point, axis, 0.062, 0.010,
            collection, asset_id, dark=True
        )


def corrected_mirror(prefix, mount, glass_center, collection, asset_id):
    # The mirror face lies in YZ and looks back toward the rider, not sideways.
    r6.ellipsoid(
        prefix + "_RearFacingHousing", glass_center, (0.042, 0.125, 0.092),
        collection, asset_id, dark=True, subdivisions=2
    )
    r6.ellipsoid(
        prefix + "_RearFacingGlass", (glass_center[0] - 0.040, glass_center[1], glass_center[2]),
        (0.010, 0.104, 0.074), collection, asset_id, dark=False, subdivisions=2
    )
    r6.beam(prefix + "_StemConnector", mount, glass_center, 0.018,
            collection, asset_id, dark=True, vertices=7)


def add_connection_pass(collection, asset_id, x, y, delivery=False):
    prefix = "Delivery125" if delivery else "Motorconcho125"
    rear_x = x - 0.80
    front_x = x + 0.80

    # Fork crown and handlebar risers make the controls one connected steering assembly.
    r6.beam(prefix + "_LowerTripleClamp", (x + 0.60, y - 0.16, 1.15),
            (x + 0.60, y + 0.16, 1.15), 0.045, collection, asset_id, dark=True)
    r6.beam(prefix + "_UpperTripleClamp", (x + 0.54, y - 0.16, 1.35),
            (x + 0.54, y + 0.16, 1.35), 0.045, collection, asset_id, dark=True)
    for side in (-0.10, 0.10):
        r6.beam(prefix + f"_HandlebarRiser_{side:+.2f}",
                (x + 0.54, y + side, 1.34), (x + 0.48, y + side, 1.47),
                0.027, collection, asset_id, dark=True)
        r6.beam(prefix + f"_HeadlampBracket_{side:+.2f}",
                (x + 0.57, y + side, 1.23), (x + 0.62, y + side, 1.30),
                0.022, collection, asset_id, dark=True)

    # Both fenders are tied to their wheel/fork assemblies rather than floating over the tires.
    for side in (-0.10, 0.10):
        r6.beam(prefix + f"_FrontFenderBrace_{side:+.2f}",
                (front_x, y + side, 0.42), (front_x - 0.11, y + side, 0.80),
                0.020, collection, asset_id, dark=True)
        r6.beam(prefix + f"_RearFenderBrace_{side:+.2f}",
                (rear_x, y + side, 0.43), (rear_x + 0.02, y + side, 0.82),
                0.020, collection, asset_id, dark=True)

    # Engine plates connect the power unit to both lower frame rails.
    for side in (-0.17, 0.17):
        r6.beam(prefix + f"_EngineMountFront_{side:+.2f}",
                (x + 0.16, y + side, 0.56), (x + 0.11, y + side, 0.72),
                0.025, collection, asset_id, dark=True)
        r6.beam(prefix + f"_EngineMountRear_{side:+.2f}",
                (x - 0.36, y + side, 0.57), (x - 0.20, y + side, 0.70),
                0.025, collection, asset_id, dark=True)

    # Seat rails bridge the rear subframe to the tank junction.
    seat_rear = x - (0.39 if delivery else 0.70)
    seat_front = x + (0.24 if delivery else 0.18)
    for side in (-0.15, 0.15):
        r6.beam(prefix + f"_SeatRail_{side:+.2f}",
                (seat_rear, y + side, 1.00), (seat_front, y + side, 1.01),
                0.028, collection, asset_id, dark=True)

    # Shock coils are now perpendicular to the shock axis on both sides.
    for side in (-0.18, 0.18):
        corrected_shock(
            prefix + f"_RearShock_{side:+.2f}",
            (x - 0.47, y + side, 0.98),
            (rear_x + 0.02, y + side, 0.48),
            collection,
            asset_id,
        )

    # Mirror glass is reoriented to face the rider and remains connected to the bars.
    for side_sign in (-1, 1):
        mount = (x + 0.48, y + side_sign * 0.43, 1.50)
        center = (x + 0.42, y + side_sign * 0.54, 1.70)
        corrected_mirror(prefix + f"_Mirror_{side_sign:+d}", mount, center,
                         collection, asset_id)

    # Exhaust and rear electrical pieces receive real supports.
    r6.beam(prefix + "_MufflerHanger", (x - 0.47, y + 0.22, 0.84),
            (x - 0.59, y + 0.22, 0.53), 0.022, collection, asset_id, dark=True)
    r6.beam(prefix + "_TailLampBracket", (rear_x - 0.04, y, 0.82),
            (rear_x - 0.25, y, 0.90), 0.022, collection, asset_id, dark=True)
    r6.beam(prefix + "_PlateBracket", (rear_x - 0.25, y, 0.86),
            (rear_x - 0.32, y, 0.72), 0.018, collection, asset_id, dark=True)

    if delivery:
        # Four box feet land directly on the rack, with diagonal braces down to the subframe.
        for dx in (-0.22, 0.22):
            for dy in (-0.22, 0.22):
                r6.box(prefix + f"_BoxFoot_{dx:+.2f}_{dy:+.2f}",
                       (x - 0.72 + dx, y + dy, 1.105), (0.055, 0.055, 0.07),
                       collection, asset_id, dark=True, bevel=0.008)
        for side in (-0.25, 0.25):
            r6.beam(prefix + f"_RackLongBrace_{side:+.2f}",
                    (x - 0.94, y + side, 1.08), (x - 0.43, y + side, 0.79),
                    0.024, collection, asset_id, dark=True)
    else:
        for side in (-0.20, 0.20):
            r6.beam(prefix + f"_RearRackSupport_{side:+.2f}",
                    (x - 0.98, y + side, 1.00), (rear_x, y + side, 0.54),
                    0.022, collection, asset_id, dark=True)


def set_camera(name, location, target, ortho_scale):
    camera = bpy.data.objects.get(name)
    if camera is None:
        data = bpy.data.cameras.new(name)
        camera = bpy.data.objects.new(name, data)
        bpy.context.scene.collection.objects.link(camera)
    camera.location = location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    return camera


def render_reviews():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    views = (
        ("V02R7_MotorconchoNearSide", (-8.3, -23.5, 3.0), (-11.5, -18.0, 0.84), 3.6, NEAR_RENDER),
        ("V02R7_MotorconchoFarSide", (-8.3, -12.5, 3.0), (-11.5, -18.0, 0.84), 3.6, FAR_RENDER),
        ("V02R7_DeliveryConnections", (3.2, -23.5, 3.0), (0.0, -18.0, 0.92), 3.8, DELIVERY_RENDER),
        ("V02_ReviewCamera_Overview", None, None, None, OVERVIEW_RENDER),
    )
    near_camera = None
    for name, location, target, scale, output in views:
        camera = bpy.data.objects.get(name)
        if location is not None:
            camera = set_camera(name, location, target, scale)
        if camera is None:
            continue
        if name == "V02R7_MotorconchoNearSide":
            near_camera = camera
        scene.camera = camera
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
    scene.camera = near_camera
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"


def main():
    hide_misoriented_parts()
    collection = r6.reset_collection(COLLECTION_NAME)
    add_connection_pass(collection, "yun_motorconcho_base_v01", -11.5, -18.0, delivery=False)
    add_connection_pass(collection, "yun_motorconcho_delivery_variant_v01", 0.0, -18.0, delivery=True)

    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v02-structure-r7-motorconcho-connections"
    scene["VISIBLE_CREATION_STATUS"] = "AWAITING OWNER REVIEW"
    scene["V02R7_AUDIT"] = (
        "Both motorcycles face +X. Added steering/fork crowns, control risers, fender braces, "
        "engine mounts, seat rails, axis-aligned shock coils, rear-facing mirrors, exhaust hanger, "
        "tail/plate brackets, and physically connected luggage supports."
    )
    render_reviews()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    print(f"VISIBLE CHECKPOINT SAVED: {OUTPUT_BLEND}")


if __name__ == "__main__":
    main()
