from pathlib import Path
import importlib.util

import bpy
from mathutils import Matrix, Vector


OUTPUT_DIR = Path(__file__).resolve().parent
OUTPUT_BLEND = OUTPUT_DIR / "v02-structure-r8d-motorconcho-controls.blend"
RIDER_RENDER = OUTPUT_DIR / "v02-structure-r8d-controls-rider-view.png"
RIGHT_RENDER = OUTPUT_DIR / "v02-structure-r8d-controls-right-side.png"
FULL_RENDER = OUTPUT_DIR / "v02-structure-r8d-motorconcho-full.png"
DELIVERY_RENDER = OUTPUT_DIR / "v02-structure-r8d-delivery-full.png"
COLLECTION_NAME = "V02R8_Motorconcho_Controls"

spec = importlib.util.spec_from_file_location(
    "motorconcho_r6_helpers", OUTPUT_DIR / "fix_v02_motorconcho_r6.py"
)
r6 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r6)


def hide_placeholder_controls():
    prefixes = ("Motorconcho125", "Delivery125")
    tokens = ("Handlebar", "_Grip_", "_Mirror_")
    for obj in bpy.data.objects:
        if obj.name.startswith(prefixes) and any(token in obj.name for token in tokens):
            obj.hide_render = True
            obj.hide_set(True)


def control_cable(name, points, collection, asset_id):
    data = bpy.data.curves.new(name + "_Curve", "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = 0.012
    data.bevel_resolution = 1
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, co in zip(spline.bezier_points, points):
        point.co = co
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj["asset_id"] = asset_id
    obj["checkpoint"] = "v02-structure-r8-motorconcho-controls"
    obj["exportable"] = True
    data.materials.append(r6.material(r6.RECESSED_MATERIAL, (0.17, 0.19, 0.21, 1.0)))
    return obj


def rear_facing_mirror(prefix, mount, stem_mid, center, collection, asset_id):
    r6.beam(prefix + "_StemLower", mount, stem_mid, 0.018,
            collection, asset_id, dark=True, vertices=7)
    r6.beam(prefix + "_StemUpper", stem_mid, center, 0.018,
            collection, asset_id, dark=True, vertices=7)
    # Forward is +X; the mirror face is a YZ oval looking rearward toward -X.
    r6.ellipsoid(prefix + "_Housing", center, (0.043, 0.120, 0.087),
                 collection, asset_id, dark=True, subdivisions=2)
    r6.ellipsoid(prefix + "_Glass", (center[0] - 0.041, center[1], center[2]),
                 (0.009, 0.102, 0.071), collection, asset_id, subdivisions=2)


def lever(prefix, pivot, elbow, tip, collection, asset_id):
    r6.beam(prefix + "_Inner", pivot, elbow, 0.015,
            collection, asset_id, dark=True, vertices=7)
    r6.beam(prefix + "_Outer", elbow, tip, 0.012,
            collection, asset_id, dark=True, vertices=7)
    r6.ellipsoid(prefix + "_Ball", tip, (0.025, 0.025, 0.025),
                 collection, asset_id, dark=True, subdivisions=1)


def build_controls(collection, asset_id, x, y, delivery=False):
    prefix = "Delivery125" if delivery else "Motorconcho125"

    # Two risers and clamps connect the handlebar directly to the upper fork crown.
    for side in (-0.075, 0.075):
        r6.beam(prefix + f"_ControlRiser_{side:+.3f}",
                (x + 0.54, y + side, 1.35), (x + 0.49, y + side, 1.445),
                0.030, collection, asset_id, dark=True)
        r6.box(prefix + f"_ControlClamp_{side:+.3f}",
               (x + 0.49, y + side, 1.455), (0.11, 0.075, 0.065),
               collection, asset_id, dark=True, bevel=0.015)

    # Swept bar: it rises from the clamps and bends rearward toward the rider at both grips.
    for side_sign in (-1, 1):
        side = float(side_sign)
        inner = (x + 0.49, y + side * 0.055, 1.46)
        bend = (x + 0.43, y + side * 0.27, 1.515)
        outer = (x + 0.34, y + side * 0.43, 1.515)
        end = (x + 0.32, y + side * 0.58, 1.515)
        r6.beam(prefix + f"_SweptBarInner_{side_sign:+d}", inner, bend, 0.028,
                collection, asset_id)
        r6.beam(prefix + f"_SweptBarOuter_{side_sign:+d}", bend, outer, 0.028,
                collection, asset_id)

        # Both grips are reachable; the rider's right (-Y) is a separate twist-throttle sleeve.
        is_throttle = side_sign < 0
        r6.beam(prefix + ("_RightThrottleGrip" if is_throttle else "_LeftClutchGrip"),
                outer, end, 0.052, collection, asset_id, dark=True, vertices=12)
        for ring_index in range(4):
            t = 0.20 + ring_index * 0.19
            ring_center = Vector(outer).lerp(Vector(end), t)
            r6.cylinder(prefix + f"_GripRib_{side_sign:+d}_{ring_index + 1}",
                        ring_center, 0.057, 0.012, collection, asset_id,
                        dark=True, vertices=12, axis=Vector(end) - Vector(outer))

        pod_center = (x + 0.385, y + side * 0.355, 1.515)
        r6.box(prefix + f"_SwitchHousing_{side_sign:+d}", pod_center,
               (0.105, 0.115, 0.105), collection, asset_id, dark=True, bevel=0.022)
        # A visible thumb control communicates that this is functional switchgear.
        r6.box(prefix + f"_SwitchButton_{side_sign:+d}",
               (x + 0.33, y + side * 0.355, 1.53), (0.018, 0.048, 0.026),
               collection, asset_id, bevel=0.006)

        if is_throttle:
            # Throttle collar and front-brake perch on the rider's right.
            r6.cylinder(prefix + "_ThrottleCollar", (x + 0.35, y - 0.405, 1.515),
                        0.061, 0.045, collection, asset_id, dark=True,
                        vertices=12, axis=(0, 1, 0))
            r6.box(prefix + "_FrontBrakePerch", (x + 0.37, y - 0.31, 1.555),
                   (0.11, 0.09, 0.07), collection, asset_id, dark=True, bevel=0.014)
            lever(prefix + "_FrontBrakeLever",
                  (x + 0.37, y - 0.34, 1.565),
                  (x + 0.27, y - 0.47, 1.545),
                  (x + 0.24, y - 0.56, 1.505),
                  collection, asset_id)
            # Small hydraulic/cable reservoir sits inboard and above the brake perch.
            r6.box(prefix + "_BrakeReservoir", (x + 0.40, y - 0.245, 1.585),
                   (0.13, 0.12, 0.085), collection, asset_id, dark=True, bevel=0.016)
            mirror_mount = (x + 0.38, y - 0.30, 1.59)
            mirror_mid = (x + 0.34, y - 0.40, 1.72)
            mirror_center = (x + 0.27, y - 0.51, 1.84)
        else:
            # Clutch lever and perch on the rider's left.
            r6.box(prefix + "_ClutchPerch", (x + 0.37, y + 0.31, 1.555),
                   (0.11, 0.09, 0.07), collection, asset_id, dark=True, bevel=0.014)
            lever(prefix + "_ClutchLever",
                  (x + 0.37, y + 0.34, 1.565),
                  (x + 0.27, y + 0.47, 1.545),
                  (x + 0.24, y + 0.56, 1.505),
                  collection, asset_id)
            mirror_mount = (x + 0.38, y + 0.30, 1.59)
            mirror_mid = (x + 0.34, y + 0.40, 1.72)
            mirror_center = (x + 0.27, y + 0.51, 1.84)

        rear_facing_mirror(prefix + f"_ControlMirror_{side_sign:+d}",
                           mirror_mount, mirror_mid, mirror_center,
                           collection, asset_id)

    # Two simple analogue instruments and a bridge attach to the steering head.
    r6.beam(prefix + "_GaugeBridge", (x + 0.48, y - 0.13, 1.48),
            (x + 0.48, y + 0.13, 1.48), 0.025, collection, asset_id, dark=True)
    for side in (-0.10, 0.10):
        r6.cylinder(prefix + f"_GaugeHousing_{side:+.2f}",
                    (x + 0.43, y + side, 1.585), 0.095, 0.085,
                    collection, asset_id, dark=True, vertices=16, axis=(-1, 0, 0.18))
        r6.cylinder(prefix + f"_GaugeFace_{side:+.2f}",
                    (x + 0.388, y + side, 1.593), 0.077, 0.010,
                    collection, asset_id, vertices=16, axis=(-1, 0, 0.18))

    # Control cables visibly route from the bars to their actual destinations.
    control_cable(prefix + "_ThrottleCable", (
        (x + 0.37, y - 0.36, 1.54),
        (x + 0.49, y - 0.15, 1.36),
        (x + 0.27, y - 0.12, 1.03),
        (x + 0.13, y - 0.14, 0.81),
    ), collection, asset_id)
    control_cable(prefix + "_FrontBrakeCable", (
        (x + 0.37, y - 0.31, 1.57),
        (x + 0.61, y - 0.12, 1.28),
        (x + 0.76, y - 0.11, 0.78),
        (x + 0.80, y - 0.11, 0.44),
    ), collection, asset_id)
    control_cable(prefix + "_ClutchCable", (
        (x + 0.37, y + 0.31, 1.57),
        (x + 0.45, y + 0.15, 1.31),
        (x + 0.04, y + 0.16, 0.92),
        (x - 0.16, y + 0.18, 0.71),
    ), collection, asset_id)


def group_motorcycle(asset_id, root_name, location, collection):
    existing = bpy.data.objects.get(root_name)
    if existing is not None:
        bpy.data.objects.remove(existing, do_unlink=True)
    root = bpy.data.objects.new(root_name, None)
    collection.objects.link(root)
    root.location = location
    root["asset_id"] = asset_id
    root["checkpoint"] = "v02-structure-r8-motorconcho-controls"
    root["exportable"] = True
    root["forward_axis"] = "+X"
    root["up_axis"] = "+Z"
    root["assembly_note"] = "All visible motorcycle pieces are grouped under this root."
    parent_world = Matrix.Translation(Vector(location))
    for obj in bpy.data.objects:
        if obj is root or obj.get("asset_id") != asset_id:
            continue
        if obj.hide_get() or obj.hide_render:
            continue
        # Convert the existing world transform into a true root-local transform.
        world_matrix = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_basis = parent_world.inverted() @ world_matrix
    return root


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
        ("V02R8_RiderControlView", (-13.9, -18.0, 2.05), (-11.05, -18.0, 1.49), 2.0, RIDER_RENDER),
        ("V02R8_RightControlView", (-10.1, -20.5, 2.45), (-11.1, -18.0, 1.48), 2.25, RIGHT_RENDER),
        ("V02R8_MotorconchoFull", (-8.3, -23.5, 3.0), (-11.5, -18.0, 0.92), 3.7, FULL_RENDER),
        ("V02R8_DeliveryFull", (3.2, -23.5, 3.0), (0.0, -18.0, 0.96), 3.9, DELIVERY_RENDER),
    )
    rider_camera = None
    for name, location, target, scale, output in views:
        camera = set_camera(name, location, target, scale)
        if name == "V02R8_RiderControlView":
            rider_camera = camera
        scene.camera = camera
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
    scene.camera = rider_camera
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"


def main():
    hide_placeholder_controls()
    collection = r6.reset_collection(COLLECTION_NAME)
    build_controls(collection, "yun_motorconcho_base_v01", -11.5, -18.0, delivery=False)
    build_controls(collection, "yun_motorconcho_delivery_variant_v01", 0.0, -18.0, delivery=True)
    group_motorcycle("yun_motorconcho_base_v01", "Motorconcho125_AssemblyRoot",
                     (-11.5, -18.0, 0.0), collection)
    group_motorcycle("yun_motorconcho_delivery_variant_v01", "Delivery125_AssemblyRoot",
                     (0.0, -18.0, 0.0), collection)

    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v02-structure-r8d-motorconcho-controls"
    scene["VISIBLE_CREATION_STATUS"] = "AWAITING OWNER REVIEW"
    scene["V02R8_CONTROL_AUDIT"] = (
        "Reference-based swept handlebars with clamped risers, reachable grips, right twist throttle, "
        "front brake, left clutch, switch housings, routed cables, gauges, and rear-facing mirrors. "
        "All visible parts are parented to one assembly root per motorcycle; forward axis is +X."
    )
    render_reviews()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    print(f"VISIBLE CHECKPOINT SAVED: {OUTPUT_BLEND}")


if __name__ == "__main__":
    main()
