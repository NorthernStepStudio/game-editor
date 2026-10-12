from pathlib import Path
import importlib.util
import math

import bpy
from mathutils import Matrix, Vector


OUTPUT_DIR = Path(__file__).resolve().parent
OUTPUT_BLEND = OUTPUT_DIR / "v02-structure-r9-dominican-dog.blend"
SIDE_RENDER = OUTPUT_DIR / "v02-structure-r9-dog-side.png"
THREE_QUARTER_RENDER = OUTPUT_DIR / "v02-structure-r9-dog-three-quarter.png"
FRONT_RENDER = OUTPUT_DIR / "v02-structure-r9-dog-front.png"
SCALE_RENDER = OUTPUT_DIR / "v02-structure-r9-dog-tito-scale.png"
COLLECTION_NAME = "V02R9_DominicanStreetDog_Structure"
ASSET_ID = "yun_dominican_street_dog_v01"

spec = importlib.util.spec_from_file_location(
    "motorconcho_r6_helpers", OUTPUT_DIR / "fix_v02_motorconcho_r6.py"
)
r6 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r6)


def hide_previous_dog():
    for obj in bpy.data.objects:
        if obj.get("asset_id") == ASSET_ID:
            obj.hide_render = True
            obj.hide_set(True)


def triangular_prism(name, xz_points, center_y, depth, collection, dark=False):
    front_y = center_y - depth * 0.5
    back_y = center_y + depth * 0.5
    verts = [(x, front_y, z) for x, z in xz_points] + [(x, back_y, z) for x, z in xz_points]
    faces = [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return r6.finish(obj, collection, ASSET_ID, dark=dark, bevel=0.012)


def tapered_segment(name, start, end, radius_start, radius_end, collection, dark=False, vertices=10):
    start_v = Vector(start)
    end_v = Vector(end)
    delta = end_v - start_v
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_start,
        radius2=radius_end,
        depth=delta.length,
        location=(start_v + end_v) * 0.5,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    return r6.finish(obj, collection, ASSET_ID, dark=dark, bevel=0.006)


def build_leg(prefix, hip, knee, ankle, paw_center, collection, hind=False):
    tapered_segment(prefix + "_Upper", hip, knee,
                    0.125 if hind else 0.095,
                    0.090 if hind else 0.075,
                    collection, vertices=9)
    tapered_segment(prefix + "_Lower", knee, ankle,
                    0.085 if hind else 0.070,
                    0.055,
                    collection, vertices=9)
    r6.ellipsoid(prefix + "_Paw", paw_center, (0.17, 0.105, 0.070),
                 collection, ASSET_ID, subdivisions=2)


def build_dog(collection):
    x, y = 9.0, -18.0

    # Lean, healthy island mixed-breed torso: deep chest, visible waist, strong hips.
    r6.ellipsoid("Viralata_Ribcage", (x - 0.05, y, 0.82), (0.62, 0.32, 0.39),
                 collection, ASSET_ID, subdivisions=2)
    r6.ellipsoid("Viralata_Chest", (x + 0.43, y, 0.83), (0.36, 0.34, 0.43),
                 collection, ASSET_ID, subdivisions=2)
    r6.ellipsoid("Viralata_TuckedWaist", (x - 0.48, y, 0.76), (0.36, 0.255, 0.27),
                 collection, ASSET_ID, subdivisions=2)
    r6.ellipsoid("Viralata_Haunch", (x - 0.77, y, 0.77), (0.39, 0.34, 0.38),
                 collection, ASSET_ID, subdivisions=2)
    tapered_segment("Viralata_Backline", (x - 0.72, y, 0.99), (x + 0.37, y, 1.02),
                    0.080, 0.065, collection, vertices=9)

    # Upright neck and wedge-shaped head with a tapered muzzle.
    tapered_segment("Viralata_Neck", (x + 0.39, y, 0.89), (x + 0.62, y, 1.13),
                    0.235, 0.185, collection, vertices=10)
    r6.ellipsoid("Viralata_Head", (x + 0.78, y, 1.24), (0.34, 0.275, 0.30),
                 collection, ASSET_ID, subdivisions=2)
    r6.ellipsoid("Viralata_Muzzle", (x + 1.04, y, 1.15), (0.27, 0.205, 0.17),
                 collection, ASSET_ID, subdivisions=2)
    r6.ellipsoid("Viralata_Nose", (x + 1.27, y, 1.16), (0.09, 0.15, 0.105),
                 collection, ASSET_ID, dark=True, subdivisions=2)
    r6.ellipsoid("Viralata_Chin", (x + 1.02, y, 1.05), (0.20, 0.17, 0.085),
                 collection, ASSET_ID, subdivisions=2)

    # One alert ear and one slightly relaxed ear keep the silhouette original and lived-in.
    triangular_prism(
        "Viralata_Ear_Alert",
        ((x + 0.57, 1.35), (x + 0.67, 1.73), (x + 0.82, 1.39)),
        y - 0.17, 0.115, collection,
    )
    triangular_prism(
        "Viralata_Ear_Relaxed",
        ((x + 0.63, 1.38), (x + 0.83, 1.61), (x + 0.91, 1.36)),
        y + 0.17, 0.115, collection,
    )
    for side in (-1, 1):
        r6.ellipsoid("Viralata_Eye_L" if side < 0 else "Viralata_Eye_R",
                     (x + 0.92, y + side * 0.247, 1.30), (0.038, 0.027, 0.045),
                     collection, ASSET_ID, dark=True, subdivisions=2)

    # Correct canine stance: vertical forelegs and angled rear legs with visible hocks.
    for side_sign in (-1, 1):
        side = side_sign * 0.215
        build_leg(
            "Viralata_FrontLeg_L" if side_sign < 0 else "Viralata_FrontLeg_R",
            (x + 0.38, y + side, 0.82),
            (x + 0.33, y + side, 0.48),
            (x + 0.36, y + side, 0.17),
            (x + 0.47, y + side, 0.085),
            collection,
            hind=False,
        )
        build_leg(
            "Viralata_HindLeg_L" if side_sign < 0 else "Viralata_HindLeg_R",
            (x - 0.73, y + side * 1.05, 0.77),
            (x - 0.48, y + side * 1.05, 0.48),
            (x - 0.67, y + side * 1.05, 0.22),
            (x - 0.53, y + side * 1.05, 0.085),
            collection,
            hind=True,
        )

    # Curved island-dog tail, thick at the rump and tapering into a raised hook.
    tail_points = (
        (x - 1.03, y + 0.02, 0.87),
        (x - 1.28, y + 0.03, 1.09),
        (x - 1.42, y + 0.02, 1.36),
        (x - 1.33, y - 0.01, 1.56),
        (x - 1.12, y - 0.03, 1.63),
    )
    radii = (0.105, 0.088, 0.066, 0.045, 0.020)
    for index in range(len(tail_points) - 1):
        tapered_segment(
            f"Viralata_Tail_{index + 1}", tail_points[index], tail_points[index + 1],
            radii[index], radii[index + 1], collection, vertices=9
        )


def group_dog(collection):
    root = bpy.data.objects.get("DominicanViralata_AssemblyRoot")
    if root is not None:
        bpy.data.objects.remove(root, do_unlink=True)
    root = bpy.data.objects.new("DominicanViralata_AssemblyRoot", None)
    collection.objects.link(root)
    location = Vector((9.0, -18.0, 0.0))
    root.location = location
    root["asset_id"] = ASSET_ID
    root["checkpoint"] = "v02-structure-r9-dominican-dog"
    root["exportable"] = True
    root["forward_axis"] = "+X"
    root["up_axis"] = "+Z"
    root["design_note"] = "Healthy lean Dominican viralata / Caribbean island mixed-breed."
    parent_world = Matrix.Translation(location)
    for obj in list(bpy.data.objects):
        if obj is root or obj.get("asset_id") != ASSET_ID or obj.hide_get() or obj.hide_render:
            continue
        world = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_basis = parent_world.inverted() @ world
    return root


def duplicate_tito_reference(collection):
    old = bpy.data.objects.get("DogReview_CurrentTito_RuntimeScale1_2")
    if old is not None:
        for child in list(old.children_recursive):
            bpy.data.objects.remove(child, do_unlink=True)
        bpy.data.objects.remove(old, do_unlink=True)
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
    root.location = (11.7, -18.0, 0.0)
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
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    views = (
        ("V02R9_DogSide", (9.0, -24.0, 2.25), (9.0, -18.0, 0.83), 3.0, SIDE_RENDER),
        ("V02R9_DogThreeQuarter", (12.2, -23.2, 2.45), (9.0, -18.0, 0.85), 3.0, THREE_QUARTER_RENDER),
        ("V02R9_DogFront", (14.0, -18.0, 2.10), (9.45, -18.0, 0.92), 2.8, FRONT_RENDER),
        ("V02R9_DogTitoScale", (10.3, -25.5, 3.25), (10.3, -18.0, 0.90), 4.2, SCALE_RENDER),
    )
    review_camera = None
    for name, location, target, scale, output in views:
        camera = set_camera(name, location, target, scale)
        if name == "V02R9_DogThreeQuarter":
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
    hide_previous_dog()
    collection = r6.reset_collection(COLLECTION_NAME)
    build_dog(collection)
    group_dog(collection)
    duplicate_tito_reference(collection)

    scene = bpy.context.scene
    scene["CHECKPOINT"] = "v02-structure-r9-dominican-dog"
    scene["VISIBLE_CREATION_STATUS"] = "AWAITING OWNER REVIEW"
    scene["V02R9_DOG_AUDIT"] = (
        "Reference-based healthy Dominican viralata: lean deep-chested torso, tucked waist, "
        "wedge head, tapered muzzle, alert asymmetric ears, correct foreleg/hindleg joints, "
        "grounded paws, and raised curved tail. Actual current Tito duplicated for scale review."
    )
    render_reviews()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    print(f"VISIBLE CHECKPOINT SAVED: {OUTPUT_BLEND}")


if __name__ == "__main__":
    main()
