from pathlib import Path
import math

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(__file__).resolve().parent
OUTPUT_BLEND = OUTPUT_DIR / "v02-structure-r6-motorconcho.blend"
BASE_RENDER = OUTPUT_DIR / "v02-structure-r6-motorconcho-base.png"
DELIVERY_RENDER = OUTPUT_DIR / "v02-structure-r6-motorconcho-delivery.png"
LINEUP_RENDER = OUTPUT_DIR / "v02-structure-r6-motorconcho-lineup.png"
OVERVIEW_RENDER = OUTPUT_DIR / "v02-structure-r6-overview.png"
COLLECTION_NAME = "V02R6_Motorconcho_Structure"
CLAY_MATERIAL = "MAT_V02_StructuralClay"
RECESSED_MATERIAL = "MAT_V02_RecessedOpeningClay"


def ensure_collection(name):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def reset_collection(name):
    old = bpy.data.collections.get(name)
    if old is not None:
        for obj in list(old.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(old)
    return ensure_collection(name)


def material(name, fallback):
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing
    created = bpy.data.materials.new(name)
    created.diffuse_color = fallback
    created.roughness = 0.9
    return created


def finish(obj, collection, asset_id, dark=False, bevel=0.0):
    obj.name = obj.name.replace("Cube", "MotorconchoPart")
    for previous in list(obj.users_collection):
        previous.objects.unlink(obj)
    collection.objects.link(obj)
    obj["asset_id"] = asset_id
    obj["checkpoint"] = "v02-structure-r6-motorconcho"
    obj["exportable"] = True
    if obj.type == "MESH":
        obj.data.materials.clear()
        obj.data.materials.append(material(
            RECESSED_MATERIAL if dark else CLAY_MATERIAL,
            (0.17, 0.19, 0.21, 1.0) if dark else (0.68, 0.70, 0.72, 1.0),
        ))
        if bevel > 0:
            modifier = obj.modifiers.new("V02R6_SoftEdge", "BEVEL")
            modifier.width = bevel
            modifier.segments = 1
            modifier.limit_method = "ANGLE"
    return obj


def box(name, loc, dims, collection, asset_id, dark=False, bevel=0.025, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, collection, asset_id, dark=dark, bevel=bevel)


def beam(name, start, end, radius, collection, asset_id, dark=False, vertices=8):
    start_v = Vector(start)
    end_v = Vector(end)
    delta = end_v - start_v
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=delta.length,
        location=(start_v + end_v) * 0.5,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    return finish(obj, collection, asset_id, dark=dark, bevel=0.008)


def cylinder(name, loc, radius, depth, collection, asset_id, dark=False, vertices=12, axis=(0, 0, 1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = Vector(axis).to_track_quat("Z", "Y").to_euler()
    return finish(obj, collection, asset_id, dark=dark, bevel=0.012)


def ellipsoid(name, loc, scale, collection, asset_id, dark=False, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1.0, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, collection, asset_id, dark=dark)


def torus(name, loc, major, minor, collection, asset_id, dark=False):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=20,
        minor_segments=7,
        location=loc,
        rotation=(math.pi / 2, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    return finish(obj, collection, asset_id, dark=dark)


def arc_tube(name, center, radius, start_angle, end_angle, y, tube_radius,
             collection, asset_id, dark=False, points=9):
    data = bpy.data.curves.new(name + "_Curve", "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = tube_radius
    data.bevel_resolution = 1
    spline = data.splines.new("POLY")
    spline.points.add(points - 1)
    for index in range(points):
        angle = start_angle + (end_angle - start_angle) * index / (points - 1)
        spline.points[index].co = (
            center[0] + math.cos(angle) * radius,
            y,
            center[2] + math.sin(angle) * radius,
            1.0,
        )
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj["asset_id"] = asset_id
    obj["checkpoint"] = "v02-structure-r6-motorconcho"
    obj["exportable"] = True
    data.materials.append(material(
        RECESSED_MATERIAL if dark else CLAY_MATERIAL,
        (0.17, 0.19, 0.21, 1.0) if dark else (0.68, 0.70, 0.72, 1.0),
    ))
    return obj


def trapezoid_prism(name, xz_points, center_y, depth, collection, asset_id, dark=False):
    front_y = center_y - depth * 0.5
    back_y = center_y + depth * 0.5
    verts = [(x, front_y, z) for x, z in xz_points] + [(x, back_y, z) for x, z in xz_points]
    count = len(xz_points)
    faces = [tuple(range(count)), tuple(range(count, count * 2))]
    for index in range(count):
        nxt = (index + 1) % count
        faces.append((index, nxt, count + nxt, count + index))
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return finish(obj, collection, asset_id, dark=dark, bevel=0.018)


def hide_previous_motorconchos():
    targets = {"yun_motorconcho_base_v01", "yun_motorconcho_delivery_variant_v01"}
    for obj in bpy.data.objects:
        if obj.get("asset_id") in targets:
            obj.hide_render = True
            obj.hide_set(True)


def wheel(prefix, center, collection, asset_id):
    x, y, z = center
    torus(prefix + "_Tire", center, 0.315, 0.090, collection, asset_id, dark=True)
    torus(prefix + "_Rim", center, 0.255, 0.023, collection, asset_id)
    cylinder(prefix + "_Hub", center, 0.085, 0.25, collection, asset_id, vertices=12, axis=(0, 1, 0))
    for side_index, spoke_y in enumerate((y - 0.085, y + 0.085)):
        for spoke in range(8):
            angle = spoke * math.tau / 8
            beam(
                f"{prefix}_Spoke_{side_index + 1}_{spoke + 1}",
                (x, spoke_y, z),
                (x + math.cos(angle) * 0.245, spoke_y, z + math.sin(angle) * 0.245),
                0.010,
                collection,
                asset_id,
            )
    cylinder(prefix + "_Axle", center, 0.035, 0.34, collection, asset_id, dark=True, vertices=10, axis=(0, 1, 0))


def suspension(prefix, upper, lower, collection, asset_id):
    beam(prefix + "_ShockRod", upper, lower, 0.035, collection, asset_id)
    upper_v = Vector(upper)
    lower_v = Vector(lower)
    for index in range(5):
        point = upper_v.lerp(lower_v, 0.18 + index * 0.14)
        torus(prefix + f"_Spring_{index + 1}", point, 0.065, 0.012, collection, asset_id, dark=True)


def mirror(prefix, mount, stem_end, collection, asset_id):
    beam(prefix + "_Stem", mount, stem_end, 0.018, collection, asset_id, dark=True, vertices=7)
    ellipsoid(prefix + "_Mirror", stem_end, (0.12, 0.045, 0.085), collection, asset_id, dark=True, subdivisions=2)


def build_motorcycle(collection, asset_id, x, y, delivery=False):
    rear_x = x - 0.80
    front_x = x + 0.80
    wheel_z = 0.40
    prefix = "Delivery125" if delivery else "Motorconcho125"

    wheel(prefix + "_RearWheel", (rear_x, y, wheel_z), collection, asset_id)
    wheel(prefix + "_FrontWheel", (front_x, y, wheel_z), collection, asset_id)

    # Double-sided cradle frame and the steering neck define a real motorcycle silhouette.
    for side in (-0.13, 0.13):
        beam(prefix + f"_FrameTop_{side:+.0f}", (x - 0.42, y + side, 0.95),
             (x + 0.43, y + side, 1.10), 0.045, collection, asset_id, dark=True)
        beam(prefix + f"_FrameDown_{side:+.0f}", (x + 0.43, y + side, 1.10),
             (x + 0.15, y + side, 0.55), 0.045, collection, asset_id, dark=True)
        beam(prefix + f"_FrameCradle_{side:+.0f}", (x + 0.15, y + side, 0.55),
             (x - 0.38, y + side, 0.55), 0.045, collection, asset_id, dark=True)
        beam(prefix + f"_FrameRear_{side:+.0f}", (x - 0.38, y + side, 0.55),
             (x - 0.50, y + side, 0.98), 0.045, collection, asset_id, dark=True)
        beam(prefix + f"_Swingarm_{side:+.0f}", (rear_x, y + side, wheel_z),
             (x - 0.27, y + side, 0.61), 0.050, collection, asset_id, dark=True)

    # Raked twin front fork.
    for side in (-0.12, 0.12):
        beam(prefix + f"_Fork_{side:+.0f}", (front_x, y + side, wheel_z),
             (x + 0.54, y + side, 1.36), 0.047, collection, asset_id)
    cylinder(prefix + "_SteeringHead", (x + 0.51, y, 1.26), 0.072, 0.34,
             collection, asset_id, dark=True, vertices=10, axis=(0, 1, 0))

    # Front and rear fenders follow the wheel arcs.
    arc_tube(prefix + "_FrontFender", (front_x, y, wheel_z), 0.435,
             math.radians(32), math.radians(158), y, 0.045, collection, asset_id)
    arc_tube(prefix + "_RearFender", (rear_x, y, wheel_z), 0.435,
             math.radians(18), math.radians(162), y, 0.040, collection, asset_id)

    # Air-cooled single-cylinder engine, cooling fins, crankcase, and chain guard.
    box(prefix + "_EngineBlock", (x - 0.03, y, 0.67), (0.42, 0.36, 0.34),
        collection, asset_id, dark=True, bevel=0.045)
    cylinder(prefix + "_Crankcase", (x - 0.16, y - 0.20, 0.61), 0.18, 0.10,
             collection, asset_id, vertices=12, axis=(0, 1, 0))
    for index in range(4):
        box(prefix + f"_CoolingFin_{index + 1}",
            (x + 0.12, y, 0.72 + index * 0.055), (0.28, 0.43, 0.020),
            collection, asset_id, dark=True, bevel=0.004)
    trapezoid_prism(prefix + "_ChainGuard",
                    ((rear_x - 0.05, 0.52), (x - 0.20, 0.55), (x - 0.08, 0.63), (rear_x, 0.61)),
                    y + 0.18, 0.045, collection, asset_id, dark=True)

    # Compact tank and long saddle are characteristic of common CG-style commuter bikes.
    ellipsoid(prefix + "_FuelTank", (x + 0.20, y, 1.02), (0.40, 0.24, 0.25),
              collection, asset_id)
    box(prefix + "_TankKneeInset", (x + 0.16, y - 0.235, 0.98), (0.28, 0.025, 0.16),
        collection, asset_id, dark=True, bevel=0.012)
    seat_center_x = x - (0.08 if delivery else 0.28)
    seat_length = 0.64 if delivery else 0.92
    box(prefix + "_Seat", (seat_center_x, y, 1.08), (seat_length, 0.46, 0.15),
        collection, asset_id, dark=True, bevel=0.065, rot=(0, math.radians(-2.0), 0))
    for side in (-0.205, 0.205):
        trapezoid_prism(prefix + f"_SideCover_{side:+.0f}",
                        ((x - 0.48, 0.72), (x - 0.12, 0.70), (x - 0.03, 0.92), (x - 0.42, 0.94)),
                        y + side, 0.035, collection, asset_id)

    # Rear shocks are placed on both sides and attach to the rear frame, not the seat.
    for side in (-0.18, 0.18):
        suspension(prefix + f"_RearShock_{side:+.0f}",
                   (x - 0.47, y + side, 0.98), (rear_x + 0.02, y + side, 0.48),
                   collection, asset_id)

    # Exhaust header and low muffler on the street-visible side.
    beam(prefix + "_ExhaustHeader", (x + 0.12, y + 0.22, 0.72),
         (x + 0.27, y + 0.22, 0.51), 0.035, collection, asset_id, dark=True)
    beam(prefix + "_ExhaustPipe", (x + 0.27, y + 0.22, 0.51),
         (x - 0.46, y + 0.22, 0.48), 0.040, collection, asset_id, dark=True)
    beam(prefix + "_Muffler", (x - 0.44, y + 0.22, 0.49),
         (rear_x - 0.12, y + 0.22, 0.56), 0.075, collection, asset_id)

    # Controls, round light, indicators, mirrors, pegs, stand, and registration plate.
    beam(prefix + "_Handlebar", (x + 0.48, y - 0.38, 1.47),
         (x + 0.48, y + 0.38, 1.47), 0.035, collection, asset_id, dark=True)
    for side in (-1, 1):
        grip_y = y + side * 0.43
        beam(prefix + f"_Grip_{side:+.0f}", (x + 0.48, y + side * 0.31, 1.47),
             (x + 0.48, grip_y, 1.47), 0.052, collection, asset_id, dark=True)
        mirror(prefix + f"_Mirror_{side:+.0f}", (x + 0.47, grip_y, 1.50),
               (x + 0.42, y + side * 0.54, 1.70), collection, asset_id)
        beam(prefix + f"_FootPeg_{side:+.0f}", (x - 0.02, y + side * 0.16, 0.56),
             (x - 0.02, y + side * 0.34, 0.56), 0.035, collection, asset_id, dark=True)
    cylinder(prefix + "_Headlamp", (x + 0.62, y, 1.30), 0.15, 0.18,
             collection, asset_id, vertices=16, axis=(1, 0, 0))
    for side in (-1, 1):
        cylinder(prefix + f"_FrontIndicator_{side:+.0f}",
                 (x + 0.62, y + side * 0.24, 1.27), 0.055, 0.09,
                 collection, asset_id, vertices=10, axis=(0, 1, 0))
    box(prefix + "_TailLamp", (rear_x - 0.28, y, 0.90), (0.10, 0.26, 0.13),
        collection, asset_id, dark=True, bevel=0.025)
    box(prefix + "_LicensePlate", (rear_x - 0.34, y, 0.72), (0.035, 0.28, 0.16),
        collection, asset_id, bevel=0.010)
    beam(prefix + "_Kickstand", (x - 0.22, y - 0.10, 0.55),
         (x - 0.40, y - 0.32, 0.06), 0.025, collection, asset_id, dark=True)

    if delivery:
        # The box is modest, centered over a real rack, and triangulated down to the frame.
        box(prefix + "_CargoRack", (x - 0.68, y, 1.09), (0.72, 0.58, 0.055),
            collection, asset_id, dark=True, bevel=0.012)
        for side in (-0.24, 0.24):
            beam(prefix + f"_RackBraceRear_{side:+.0f}",
                 (x - 0.88, y + side, 1.08), (rear_x, y + side, 0.54),
                 0.026, collection, asset_id, dark=True)
            beam(prefix + f"_RackBraceFront_{side:+.0f}",
                 (x - 0.48, y + side, 1.08), (x - 0.38, y + side, 0.72),
                 0.026, collection, asset_id, dark=True)
        box(prefix + "_DeliveryBox", (x - 0.72, y, 1.40), (0.64, 0.60, 0.56),
            collection, asset_id, bevel=0.055)
        box(prefix + "_DeliveryBoxLid", (x - 0.72, y, 1.70), (0.69, 0.65, 0.07),
            collection, asset_id, dark=True, bevel=0.025)
        box(prefix + "_DeliveryBoxLatch", (x - 0.39, y, 1.39), (0.035, 0.14, 0.16),
            collection, asset_id, dark=True, bevel=0.012)
    else:
        box(prefix + "_RearRack", (x - 0.82, y, 1.01), (0.48, 0.50, 0.045),
            collection, asset_id, dark=True, bevel=0.010)
        for side in (-0.20, 0.20):
            beam(prefix + f"_RearRackRail_{side:+.0f}",
                 (x - 0.58, y + side, 1.00), (x - 1.02, y + side, 1.00),
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
        ("V02R6_MotorconchoBase_Close", (-8.3, -23.5, 3.0), (-11.5, -18.0, 0.82), 3.6, BASE_RENDER),
        ("V02R6_MotorconchoDelivery_Close", (3.2, -23.5, 3.0), (0.0, -18.0, 0.90), 3.8, DELIVERY_RENDER),
        ("V02R6_MotorconchoLineup", (-5.7, -28.5, 4.0), (-5.7, -18.0, 0.85), 14.0, LINEUP_RENDER),
        ("V02_ReviewCamera_Overview", None, None, None, OVERVIEW_RENDER),
    )
    base_camera = None
    for name, location, target, scale, output in views:
        camera = bpy.data.objects.get(name)
        if location is not None:
            camera = set_camera(name, location, target, scale)
        if camera is None:
            continue
        if name == "V02R6_MotorconchoBase_Close":
            base_camera = camera
        scene.camera = camera
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
    scene.camera = base_camera
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"


def main():
    hide_previous_motorconchos()
    collection = reset_collection(COLLECTION_NAME)
    build_motorcycle(collection, "yun_motorconcho_base_v01", -11.5, -18.0, delivery=False)
    build_motorcycle(collection, "yun_motorconcho_delivery_variant_v01", 0.0, -18.0, delivery=True)

    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v02-structure-r6-motorconcho"
    scene["VISIBLE_CREATION_STATUS"] = "AWAITING OWNER REVIEW"
    scene["V02R6_CORRECTIONS"] = (
        "Replaced bicycle-like motorconchos with original CG-style 125cc commuter structures: "
        "spoked wheels, double cradle frame, raked twin fork, engine/fins, tank, saddle, shocks, "
        "fenders, exhaust, lights, indicators, controls, mirrors, stands, plates, and supported cargo box."
    )
    render_reviews()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    print(f"VISIBLE CHECKPOINT SAVED: {OUTPUT_BLEND}")


if __name__ == "__main__":
    main()
