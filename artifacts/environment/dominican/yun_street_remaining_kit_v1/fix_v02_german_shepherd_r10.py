from pathlib import Path
import importlib.util
import math

import bpy
from mathutils import Matrix, Vector


OUTPUT_DIR = Path(__file__).resolve().parent
OUTPUT_BLEND = OUTPUT_DIR / "v02-structure-r13-german-shepherd.blend"
SIDE_RENDER = OUTPUT_DIR / "v02-structure-r13-dog-side.png"
THREE_QUARTER_RENDER = OUTPUT_DIR / "v02-structure-r13-dog-three-quarter.png"
FRONT_RENDER = OUTPUT_DIR / "v02-structure-r13-dog-front.png"
SCALE_RENDER = OUTPUT_DIR / "v02-structure-r13-dog-tito-scale.png"
COLLECTION_NAME = "V02R13_GermanShepherd_Structure"
ASSET_ID = "yun_neighborhood_german_shepherd_v01"
CHECKPOINT = "v02-structure-r13-german-shepherd"

spec = importlib.util.spec_from_file_location(
    "motorconcho_r6_helpers", OUTPUT_DIR / "fix_v02_motorconcho_r6.py"
)
r6 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r6)


def remove_or_hide_previous_dogs():
    dog_tokens = ("dog", "viralata", "shepherd", "perro")
    for obj in list(bpy.data.objects):
        asset_id = str(obj.get("asset_id", "")).lower()
        object_name = obj.name.lower()
        if asset_id == ASSET_ID:
            bpy.data.objects.remove(obj, do_unlink=True)
        elif any(token in asset_id or token in object_name for token in dog_tokens):
            if not obj.get("review_reference"):
                obj.hide_render = True
                obj.hide_set(True)


def finish_mesh(obj, collection, dark=False, bevel=0.0):
    r6.finish(obj, collection, ASSET_ID, dark=dark, bevel=bevel)
    obj["checkpoint"] = CHECKPOINT
    return obj


def ellipsoid(name, location, scale, collection, dark=False, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions, radius=1.0, location=location
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_mesh(obj, collection, dark=dark)


def loft(name, stations, collection, dark=False, sides=12):
    """Create a single, clean ring-loft mesh along X.

    Each station is (x, center_z, half_width_y, half_height_z).  The resulting
    body is one watertight mesh rather than a stack of disconnected blobs.
    """
    vertices = []
    faces = []
    for x, center_z, radius_y, radius_z in stations:
        for index in range(sides):
            angle = math.tau * index / sides
            vertices.append((x, math.cos(angle) * radius_y, center_z + math.sin(angle) * radius_z))
    for ring in range(len(stations) - 1):
        start = ring * sides
        next_start = (ring + 1) * sides
        for index in range(sides):
            nxt = (index + 1) % sides
            faces.append((start + index, start + nxt, next_start + nxt, next_start + index))
    faces.append(tuple(reversed(range(sides))))
    final_start = (len(stations) - 1) * sides
    faces.append(tuple(final_start + index for index in range(sides)))
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return finish_mesh(obj, collection, dark=dark, bevel=0.012)


def tapered_segment(name, start, end, radius_start, radius_end, collection, dark=False, vertices=12):
    start_v = Vector(start)
    end_v = Vector(end)
    delta = end_v - start_v
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_start,
        radius2=radius_end,
        depth=delta.length * 1.025,
        location=(start_v + end_v) * 0.5,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return finish_mesh(obj, collection, dark=dark, bevel=0.004)


def triangular_prism(name, points_xz, center_y, depth, collection, dark=False):
    near_y = center_y - depth * 0.5
    far_y = center_y + depth * 0.5
    vertices = [(x, near_y, z) for x, z in points_xz] + [(x, far_y, z) for x, z in points_xz]
    faces = [
        (0, 1, 2), (3, 5, 4),
        (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0),
    ]
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return finish_mesh(obj, collection, dark=dark, bevel=0.009)


def shepherd_ear(name, center_y, collection, dark=False, inset=False):
    """A tapered ear volume that reads triangular from side, front and 3/4 views."""
    if inset:
        x_back, x_front = 0.62, 0.78
        z_base, z_tip = 1.33, 1.53
        half_depth = 0.042
    else:
        x_back, x_front = 0.57, 0.82
        z_base, z_tip = 1.30, 1.59
        half_depth = 0.085
    vertices = [
        (x_back, center_y - half_depth, z_base),
        (x_front, center_y - half_depth, z_base),
        (x_back, center_y + half_depth, z_base),
        (x_front, center_y + half_depth, z_base),
        (0.69, center_y, z_tip),
    ]
    faces = [
        (0, 1, 3, 2),
        (0, 4, 1),
        (2, 3, 4),
        (0, 2, 4),
        (1, 4, 3),
    ]
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return finish_mesh(obj, collection, dark=dark, bevel=0.008)


def build_front_leg(prefix, shoulder, elbow, wrist, paw, collection):
    tapered_segment(prefix + "_UpperArm", shoulder, elbow, 0.090, 0.069, collection)
    ellipsoid(prefix + "_Elbow", elbow, (0.073, 0.070, 0.078), collection)
    tapered_segment(prefix + "_Forearm", elbow, wrist, 0.066, 0.047, collection)
    ellipsoid(prefix + "_Wrist", wrist, (0.052, 0.050, 0.054), collection)
    tapered_segment(prefix + "_Pastern", wrist, (paw[0] - 0.025, paw[1], paw[2] + 0.055),
                    0.048, 0.040, collection)
    ellipsoid(prefix + "_Paw", paw, (0.140, 0.085, 0.055), collection)


def build_hind_leg(prefix, hip, stifle, hock, pastern, paw, collection):
    tapered_segment(prefix + "_Thigh", hip, stifle, 0.130, 0.090, collection)
    ellipsoid(prefix + "_Stifle", stifle, (0.080, 0.076, 0.084), collection)
    tapered_segment(prefix + "_LowerThigh", stifle, hock, 0.082, 0.058, collection)
    ellipsoid(prefix + "_Hock", hock, (0.058, 0.055, 0.062), collection)
    tapered_segment(prefix + "_RearPastern", hock, pastern, 0.055, 0.042, collection)
    ellipsoid(prefix + "_Paw", paw, (0.145, 0.088, 0.057), collection)


def build_tail(collection):
    points = (
        (-0.83, 0.0, 0.79),
        (-1.06, 0.0, 0.66),
        (-1.24, 0.0, 0.45),
        (-1.33, 0.0, 0.25),
        (-1.29, 0.0, 0.105),
        (-1.15, 0.0, 0.075),
    )
    radii = (0.090, 0.082, 0.068, 0.050, 0.034, 0.018)
    for index in range(len(points) - 1):
        tapered_segment(
            f"Shepherd_Tail_{index + 1}", points[index], points[index + 1],
            radii[index], radii[index + 1], collection, vertices=12
        )


def build_shepherd(collection):
    # One watertight torso with a strong chest, firm loin and gently sloped croup.
    loft(
        "Shepherd_Torso",
        (
            (-0.70, 0.715, 0.220, 0.235),
            (-0.46, 0.790, 0.225, 0.210),
            (-0.20, 0.770, 0.255, 0.280),
            (0.08, 0.740, 0.285, 0.350),
            (0.34, 0.770, 0.295, 0.345),
            (0.50, 0.800, 0.255, 0.315),
        ),
        collection,
        sides=14,
    )

    # Shoulder and rear muscle masses overlap the torso and legs, avoiding floating joints.
    ellipsoid("Shepherd_ShoulderMass", (0.42, 0.0, 0.78), (0.225, 0.285, 0.315), collection)
    ellipsoid("Shepherd_HaunchMass", (-0.57, 0.0, 0.72), (0.235, 0.245, 0.265), collection)

    # Upright working-dog neck and continuous wedge head/muzzle.
    tapered_segment("Shepherd_Neck", (0.40, 0.0, 0.83), (0.58, 0.0, 1.09),
                    0.220, 0.190, collection, vertices=14)
    loft(
        "Shepherd_HeadAndMuzzle",
        (
            (0.54, 1.15, 0.185, 0.210),
            (0.68, 1.19, 0.235, 0.240),
            (0.82, 1.17, 0.210, 0.200),
            (0.94, 1.12, 0.158, 0.130),
            (1.04, 1.105, 0.105, 0.080),
        ),
        collection,
        sides=12,
    )
    ellipsoid("Shepherd_BlackNose", (1.078, 0.0, 1.11), (0.045, 0.095, 0.065),
              collection, dark=True)

    # Breed-defining erect ears, both attached broadly to the skull.
    shepherd_ear("Shepherd_Ear_Near", -0.135, collection)
    shepherd_ear("Shepherd_Ear_Far", 0.135, collection)
    shepherd_ear("Shepherd_EarInner_Near", -0.222, collection, dark=True, inset=True)

    # Eyes, brows and mouth line make the face readable from gameplay distance.
    for side_sign, side_name in ((-1, "Near"), (1, "Far")):
        ellipsoid(
            f"Shepherd_Eye_{side_name}",
            (0.805, side_sign * 0.202, 1.245),
            (0.030, 0.020, 0.032), collection, dark=True,
        )
        tapered_segment(
            f"Shepherd_Brow_{side_name}",
            (0.75, side_sign * 0.208, 1.295),
            (0.85, side_sign * 0.205, 1.290),
            0.013, 0.009, collection, dark=True, vertices=8,
        )
    tapered_segment("Shepherd_MouthLine_Near", (0.93, -0.157, 1.060), (1.045, -0.102, 1.075),
                    0.010, 0.006, collection, dark=True, vertices=8)

    # Correct stance: straight forelegs and visibly articulated, angulated hind legs.
    for side_sign, side_name in ((-1, "Near"), (1, "Far")):
        side = side_sign * 0.235
        build_front_leg(
            f"Shepherd_FrontLeg_{side_name}",
            (0.40, side, 0.84),
            (0.36, side, 0.49),
            (0.38, side, 0.20),
            (0.47, side, 0.083),
            collection,
        )
        build_hind_leg(
            f"Shepherd_HindLeg_{side_name}",
            (-0.58, side, 0.75),
            (-0.30, side, 0.48),
            (-0.59, side, 0.245),
            (-0.55, side, 0.13),
            (-0.39, side, 0.083),
            collection,
        )

    build_tail(collection)

    # Simple collar is a structural scale/readability cue; tags and materials wait for later stages.
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.205,
        minor_radius=0.027,
        major_segments=20,
        minor_segments=6,
        location=(0.61, 0.0, 1.075),
        rotation=(0.0, math.pi / 2.0, 0.0),
    )
    collar = bpy.context.object
    collar.name = "Shepherd_Collar"
    finish_mesh(collar, collection, dark=True)


def group_dog(collection):
    root = bpy.data.objects.new("GermanShepherd_AssemblyRoot", None)
    collection.objects.link(root)
    world_location = Vector((9.0, -18.0, 0.0))
    root.location = world_location
    root["asset_id"] = ASSET_ID
    root["checkpoint"] = CHECKPOINT
    root["exportable"] = True
    root["forward_axis"] = "+X"
    root["up_axis"] = "+Z"
    root.scale = (0.58, 0.58, 0.58)
    root["design_note"] = (
        "Healthy, cared-for German Shepherd based on FCD-supported breed references; "
        "stylized for Yun gameplay readability."
    )
    for obj in list(collection.objects):
        if obj is root or obj.get("asset_id") != ASSET_ID:
            continue
        # Geometry is authored around local origin.  Preserve that local matrix
        # so the assembly root moves the entire connected dog to its review bay.
        local_matrix = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_basis = local_matrix
    return root


def duplicate_tito_reference(collection):
    for obj in list(bpy.data.objects):
        if obj.name.startswith("DogReview_"):
            bpy.data.objects.remove(obj, do_unlink=True)
    source = bpy.data.objects.get("Current_Tito_RuntimeScale1_2")
    if source is None:
        return None
    originals = [source] + list(source.children_recursive)
    mapping = {}
    for original in originals:
        clone = original.copy()
        clone.name = "DogReview_" + original.name
        collection.objects.link(clone)
        clone["exportable"] = False
        clone["review_reference"] = True
        mapping[original] = clone
    for original, clone in mapping.items():
        if original.parent in mapping:
            clone.parent = mapping[original.parent]
            clone.matrix_parent_inverse = original.matrix_parent_inverse.copy()
            clone.matrix_basis = original.matrix_basis.copy()
    root = mapping[source]
    root.name = "DogReview_CurrentTito_RuntimeScale1_2"
    root.location = (11.5, -18.0, 0.0)
    root.rotation_euler = source.rotation_euler.copy()
    root.scale = source.scale.copy()
    root["source_asset"] = source.get("source_asset", "current Yun gameplay character")
    root["runtime_scale"] = source.get("runtime_scale", 1.2)
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
    scene.display.shading.light = "STUDIO"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = "WORLD"
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    views = (
        ("V02R13_DogSide", (9.0, -24.0, 1.35), (8.98, -18.0, 0.47), 1.58, SIDE_RENDER),
        ("V02R13_DogThreeQuarter", (10.9, -21.5, 1.48), (8.98, -18.0, 0.48), 1.65, THREE_QUARTER_RENDER),
        ("V02R13_DogFront", (12.25, -18.0, 1.28), (9.18, -18.0, 0.50), 1.48, FRONT_RENDER),
        ("V02R13_DogTitoScale", (10.25, -25.7, 2.55), (10.25, -18.0, 0.62), 2.9, SCALE_RENDER),
    )
    review_camera = None
    for name, location, target, scale, output in views:
        camera = set_camera(name, location, target, scale)
        if name == "V02R13_DogThreeQuarter":
            review_camera = camera
        scene.camera = camera
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
    scene.camera = review_camera
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"


def main():
    remove_or_hide_previous_dogs()
    collection = r6.reset_collection(COLLECTION_NAME)
    build_shepherd(collection)
    group_dog(collection)
    duplicate_tito_reference(collection)

    scene = bpy.context.scene
    scene["CHECKPOINT"] = CHECKPOINT
    scene["VISIBLE_CREATION_STATUS"] = "AWAITING OWNER REVIEW"
    scene["V02R13_DOG_AUDIT"] = (
        "Replaced rejected viralata direction with a healthy German Shepherd. "
        "Single lofted torso, wedge head, paired erect ears, straight forelegs, articulated "
        "rear angulation, grounded broad paws, low natural tail and actual Tito scale reference."
    )
    render_reviews()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    print(f"VISIBLE CHECKPOINT SAVED: {OUTPUT_BLEND}")


if __name__ == "__main__":
    main()
