import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(r"D:\dev\Northern Step Studio")
OUTPUT_DIR = ROOT / "artifacts" / "visible-creation-test" / "yun-storefront-awning"
TITO_GLB = ROOT / "games" / "Yun" / "assets" / "kenney" / "mini_characters" / "character-male-a.glb"

V02_BLEND = OUTPUT_DIR / "v02-structure.blend"
V03_BLEND = OUTPUT_DIR / "v03-details.blend"
V04_BLEND = OUTPUT_DIR / "v04-materials.blend"
V05_BLEND = OUTPUT_DIR / "v05-final.blend"
FINAL_GLB = OUTPUT_DIR / "yun_storefront_canopy_v05.glb"
DONE_FLAG = OUTPUT_DIR / "v05-finished.flag"
REPORT_PATH = OUTPUT_DIR / "validation-report.json"

EXPORT_COLLECTION_NAME = "EXPORT_YunStorefrontCanopy"
REFERENCE_COLLECTION_NAME = "REFERENCE_Facade"
SCALE_COLLECTION_NAME = "REFERENCE_CurrentTito"

STEP_DELAY = 1.35
steps = []
step_index = 0


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
    if obj.name not in collection.objects:
        collection.objects.link(obj)
    for source in list(obj.users_collection):
        if source != collection:
            source.objects.unlink(obj)


def add_box(name, location, dimensions, collection, rotation=(0.0, 0.0, 0.0), color=(0.55, 0.57, 0.59)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    obj.color = (*color, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    move_to_collection(obj, collection)
    return obj


def add_cylinder(name, location, radius, depth, collection, vertices=10, rotation=(0.0, 0.0, 0.0), color=(0.25, 0.27, 0.29)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.color = (*color, 1.0)
    move_to_collection(obj, collection)
    return obj


def add_beam_between(name, start, end, thickness, collection, color=(0.25, 0.27, 0.29)):
    start_v = Vector(start)
    end_v = Vector(end)
    direction = end_v - start_v
    obj = add_box(name, (start_v + end_v) * 0.5, (thickness, thickness, direction.length), collection, color=color)
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    return obj


def make_material(name, base_color, roughness=0.55, metallic=0.0, emission=None):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.diffuse_color = (*base_color, 1.0)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
            bsdf.inputs["Emission Strength"].default_value = 2.2
    return material


def assign_material(obj, material):
    if obj.type != "MESH":
        return
    obj.data.materials.clear()
    obj.data.materials.append(material)


def point_camera(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def set_view_to_camera(camera):
    scene = bpy.context.scene
    scene.camera = camera
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type != "VIEW_3D":
                continue
            space = area.spaces.active
            space.region_3d.view_perspective = "CAMERA"
            space.region_3d.view_camera_zoom = 9
            space.overlay.show_floor = True
            try:
                space.shading.type = "MATERIAL"
            except TypeError:
                # Blender 5.2 Workbench exposes rendered/solid here instead.
                space.shading.type = "RENDERED"
            area.tag_redraw()


def render_preview(path, camera, workbench=False):
    scene = bpy.context.scene
    set_view_to_camera(camera)
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(path)
    if workbench:
        scene.render.engine = "BLENDER_WORKBENCH"
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "OBJECT"
        scene.display.shading.show_shadows = True
        scene.display.shading.show_cavity = True
        scene.display.shading.cavity_type = "WORLD"
    else:
        try:
            scene.render.engine = "BLENDER_EEVEE_NEXT"
        except TypeError:
            scene.render.engine = "BLENDER_EEVEE"
    bpy.ops.render.render(write_still=True)


def configure_scene():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    scene.render.film_transparent = False

    export_collection = ensure_collection(EXPORT_COLLECTION_NAME)
    reference_collection = ensure_collection(REFERENCE_COLLECTION_NAME)
    ensure_collection(SCALE_COLLECTION_NAME)

    wall = bpy.data.objects.get("BLOCKOUT_WallReference")
    opening = bpy.data.objects.get("BLOCKOUT_StorefrontOpening")
    for obj in (wall, opening):
        if obj is not None:
            move_to_collection(obj, reference_collection)

    for name in ("BLOCKOUT_SupportPost_L", "BLOCKOUT_SupportPost_R"):
        obj = bpy.data.objects.get(name)
        if obj is not None:
            move_to_collection(obj, export_collection)

    camera = bpy.data.objects.get("ReviewCamera")
    if camera is None:
        camera_data = bpy.data.cameras.new("ReviewCamera")
        camera = bpy.data.objects.new("ReviewCamera", camera_data)
        scene.collection.objects.link(camera)
    camera.location = (9.2, -11.8, 6.6)
    camera.data.lens = 52
    point_camera(camera, (0.0, -0.8, 1.65))
    set_view_to_camera(camera)

    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.10, 0.12, 0.15, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.65

    sun_data = bpy.data.lights.get("ReviewSun") or bpy.data.lights.new("ReviewSun", "SUN")
    sun = bpy.data.objects.get("ReviewSun") or bpy.data.objects.new("ReviewSun", sun_data)
    if not sun.users_collection:
        scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(28), math.radians(-18), math.radians(-28))
    sun_data.energy = 2.0
    sun_data.color = (1.0, 0.82, 0.67)

    area_data = bpy.data.lights.get("ReviewFill") or bpy.data.lights.new("ReviewFill", "AREA")
    area = bpy.data.objects.get("ReviewFill") or bpy.data.objects.new("ReviewFill", area_data)
    if not area.users_collection:
        scene.collection.objects.link(area)
    area.location = (-4.0, -4.0, 6.0)
    area_data.energy = 650
    area_data.shape = "DISK"
    area_data.size = 5.0
    point_camera(area, (0.0, -1.0, 1.5))

    set_status("Full production pass ready — starting v02 structure")


def v02_roof_and_frame():
    export_collection = ensure_collection(EXPORT_COLLECTION_NAME)
    old_awning = bpy.data.objects.get("BLOCKOUT_Awning")
    if old_awning is not None:
        bpy.data.objects.remove(old_awning, do_unlink=True)

    roof = add_box(
        "Canopy_RoofSheet",
        (0.0, -1.18, 2.86),
        (5.55, 2.12, 0.08),
        export_collection,
        rotation=(math.radians(6.0), 0.0, 0.0),
        color=(0.40, 0.58, 0.60),
    )
    roof["role"] = "primary_canopy"
    add_box("Frame_WallLedger", (0.0, -0.22, 2.91), (5.45, 0.12, 0.14), export_collection)
    add_box("Frame_FrontBeam", (0.0, -2.18, 2.74), (5.55, 0.14, 0.16), export_collection)
    add_box("Frame_SideBeam_L", (-2.67, -1.19, 2.82), (0.13, 2.02, 0.14), export_collection, rotation=(math.radians(6.0), 0.0, 0.0))
    add_box("Frame_SideBeam_R", (2.67, -1.19, 2.82), (0.13, 2.02, 0.14), export_collection, rotation=(math.radians(6.0), 0.0, 0.0))
    set_status("v02 structure — sloped roof and perimeter frame")


def v02_posts_and_braces():
    export_collection = ensure_collection(EXPORT_COLLECTION_NAME)
    left = bpy.data.objects.get("BLOCKOUT_SupportPost_L")
    right = bpy.data.objects.get("BLOCKOUT_SupportPost_R")
    for obj, name, x in (
        (left, "SupportPost_L", -2.48),
        (right, "SupportPost_R", 2.48),
    ):
        if obj is None:
            obj = add_box(name, (x, -2.08, 1.36), (0.14, 0.14, 2.72), export_collection)
        else:
            obj.name = name
            obj.location = (x, -2.08, 1.36)
            obj.dimensions = (0.14, 0.14, 2.72)
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            obj.select_set(False)
        obj["role"] = "support_post"

    add_beam_between("Brace_L_Outer", (-2.48, -2.08, 2.55), (-1.90, -1.48, 2.79), 0.09, export_collection)
    add_beam_between("Brace_R_Outer", (2.48, -2.08, 2.55), (1.90, -1.48, 2.79), 0.09, export_collection)
    add_beam_between("Brace_L_Wall", (-2.55, -0.28, 2.88), (-2.05, -1.02, 2.77), 0.08, export_collection)
    add_beam_between("Brace_R_Wall", (2.55, -0.28, 2.88), (2.05, -1.02, 2.77), 0.08, export_collection)
    set_status("v02 structure — posts and readable diagonal braces")


def v02_storefront_reference():
    reference = ensure_collection(REFERENCE_COLLECTION_NAME)
    add_box("Storefront_Frame_L", (-2.37, -0.24, 1.30), (0.14, 0.10, 2.72), reference, color=(0.72, 0.70, 0.64))
    add_box("Storefront_Frame_R", (2.37, -0.24, 1.30), (0.14, 0.10, 2.72), reference, color=(0.72, 0.70, 0.64))
    add_box("Storefront_Frame_Top", (0.0, -0.24, 2.64), (4.88, 0.10, 0.14), reference, color=(0.72, 0.70, 0.64))
    add_box("Storefront_Sill", (0.0, -0.25, 0.08), (4.88, 0.12, 0.16), reference, color=(0.72, 0.70, 0.64))
    add_box("Storefront_Mullion", (0.0, -0.265, 1.30), (0.10, 0.08, 2.50), reference, color=(0.24, 0.26, 0.27))
    set_status("v02 structure — modular storefront reference framing")


def checkpoint_v02():
    camera = bpy.data.objects["ReviewCamera"]
    bpy.ops.wm.save_as_mainfile(filepath=str(V02_BLEND))
    render_preview(OUTPUT_DIR / "v02-structure.png", camera, workbench=True)
    set_status("v02 structure saved — continuing by owner instruction")


def v03_corrugation():
    export_collection = ensure_collection(EXPORT_COLLECTION_NAME)
    for index, x in enumerate([(-2.50 + i * 0.50) for i in range(11)]):
        ridge = add_box(
            f"RoofRidge_{index:02d}",
            (x, -1.18, 2.915),
            (0.045, 2.08, 0.035),
            export_collection,
            rotation=(math.radians(6.0), 0.0, 0.0),
            color=(0.34, 0.52, 0.54),
        )
        ridge["role"] = "corrugation"
    set_status("v03 details — broad corrugation added for gameplay readability")


def v03_gutter_and_downspout():
    export_collection = ensure_collection(EXPORT_COLLECTION_NAME)
    add_box("RainGutter", (0.0, -2.235, 2.71), (5.65, 0.13, 0.15), export_collection)
    add_box("Downspout_R_Upper", (2.67, -2.22, 2.45), (0.11, 0.12, 0.52), export_collection)
    add_box("Downspout_R_Main", (2.67, -2.20, 1.24), (0.11, 0.12, 1.92), export_collection)
    add_box("Downspout_R_Outlet", (2.67, -2.29, 0.24), (0.11, 0.32, 0.12), export_collection)
    set_status("v03 details — gutter and square downspout")


def v03_mounting_hardware():
    export_collection = ensure_collection(EXPORT_COLLECTION_NAME)
    for side, x in (("L", -2.48), ("R", 2.48)):
        add_box(f"BasePlate_{side}", (x, -2.08, 0.035), (0.30, 0.30, 0.07), export_collection)
        for bolt_index, offset in enumerate((-0.09, 0.09)):
            add_cylinder(
                f"BaseBolt_{side}_{bolt_index}",
                (x + offset, -2.08, 0.085),
                0.025,
                0.045,
                export_collection,
                vertices=8,
            )
    for index, x in enumerate((-2.30, -0.78, 0.78, 2.30)):
        add_box(f"WallMountPlate_{index}", (x, -0.285, 2.91), (0.26, 0.04, 0.28), export_collection)
    set_status("v03 details — base plates and wall mounts")


def v03_lamp_and_patch():
    export_collection = ensure_collection(EXPORT_COLLECTION_NAME)
    reference = ensure_collection(REFERENCE_COLLECTION_NAME)
    add_box("Lamp_Housing", (0.0, -1.05, 2.72), (0.48, 0.26, 0.11), export_collection, color=(0.22, 0.23, 0.24))
    add_box("Lamp_Lens", (0.0, -1.05, 2.655), (0.38, 0.19, 0.035), export_collection, color=(0.92, 0.78, 0.48))
    add_box("PlasterPatch_Reference", (-2.82, -0.196, 1.65), (0.78, 0.035, 0.56), reference, color=(0.63, 0.57, 0.47))
    set_status("v03 details — simple lamp and subtle plaster repair")


def checkpoint_v03():
    camera = bpy.data.objects["ReviewCamera"]
    bpy.ops.wm.save_as_mainfile(filepath=str(V03_BLEND))
    render_preview(OUTPUT_DIR / "v03-details.png", camera, workbench=True)
    set_status("v03 details saved — continuing by owner instruction")


def v04_create_materials():
    materials = {
        "roof": make_material("MAT_FadedTealMetal", (0.10, 0.38, 0.40), roughness=0.58, metallic=0.38),
        "frame": make_material("MAT_DarkPaintedMetal", (0.035, 0.050, 0.055), roughness=0.42, metallic=0.58),
        "wall": make_material("MAT_WarmSandPlaster", (0.58, 0.42, 0.28), roughness=0.92),
        "patch": make_material("MAT_PatchedPlaster", (0.48, 0.42, 0.33), roughness=0.96),
        "trim": make_material("MAT_OffWhiteTrim", (0.78, 0.72, 0.61), roughness=0.82),
        "glass": make_material("MAT_StorefrontBlueGlass", (0.035, 0.14, 0.16), roughness=0.30, metallic=0.08),
        "lamp": make_material("MAT_WarmLamp", (0.92, 0.68, 0.30), roughness=0.34, emission=(1.0, 0.58, 0.16)),
    }
    bpy.context.scene["MATERIAL_KEYS"] = ",".join(sorted(materials.keys()))
    set_status("v04 materials — grounded Caribbean palette created")


def v04_apply_canopy_materials():
    roof_mat = bpy.data.materials["MAT_FadedTealMetal"]
    frame_mat = bpy.data.materials["MAT_DarkPaintedMetal"]
    lamp_mat = bpy.data.materials["MAT_WarmLamp"]
    export_collection = ensure_collection(EXPORT_COLLECTION_NAME)
    for obj in export_collection.objects:
        if obj.type != "MESH":
            continue
        if obj.name.startswith("Canopy_Roof") or obj.name.startswith("RoofRidge"):
            assign_material(obj, roof_mat)
        elif obj.name == "Lamp_Lens":
            assign_material(obj, lamp_mat)
        else:
            assign_material(obj, frame_mat)
    set_status("v04 materials — faded teal roof and dark metal structure")


def v04_apply_facade_materials():
    wall_mat = bpy.data.materials["MAT_WarmSandPlaster"]
    patch_mat = bpy.data.materials["MAT_PatchedPlaster"]
    trim_mat = bpy.data.materials["MAT_OffWhiteTrim"]
    glass_mat = bpy.data.materials["MAT_StorefrontBlueGlass"]
    for obj in ensure_collection(REFERENCE_COLLECTION_NAME).objects:
        if obj.type != "MESH":
            continue
        if obj.name == "BLOCKOUT_WallReference":
            assign_material(obj, wall_mat)
        elif obj.name == "PlasterPatch_Reference":
            assign_material(obj, patch_mat)
        elif obj.name == "BLOCKOUT_StorefrontOpening":
            assign_material(obj, glass_mat)
        else:
            assign_material(obj, trim_mat if "Storefront" in obj.name else wall_mat)
    set_status("v04 materials — warm sand facade, off-white trim, deep teal opening")


def checkpoint_v04():
    camera = bpy.data.objects["ReviewCamera"]
    bpy.ops.wm.save_as_mainfile(filepath=str(V04_BLEND))
    render_preview(OUTPUT_DIR / "v04-materials.png", camera, workbench=False)
    set_status("v04 materials saved — continuing to final game-scale view")


def v05_ground_and_tito():
    reference = ensure_collection(REFERENCE_COLLECTION_NAME)
    scale_collection = ensure_collection(SCALE_COLLECTION_NAME)
    ground = add_box("GroundReference", (0.0, -1.0, -0.055), (9.5, 6.5, 0.10), reference, color=(0.24, 0.23, 0.20))
    ground_mat = make_material("MAT_GroundReference", (0.20, 0.19, 0.17), roughness=1.0)
    assign_material(ground, ground_mat)

    if not TITO_GLB.exists():
        raise RuntimeError(f"Current Yun Tito asset missing: {TITO_GLB}")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(TITO_GLB))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    imported_set = set(imported)

    root = bpy.data.objects.new("CurrentGameplayTito_RuntimeScale1_2", None)
    scale_collection.objects.link(root)
    root.location = (3.25, -2.10, 0.0)
    root.rotation_euler = (0.0, 0.0, math.radians(180.0))
    root.scale = (1.2, 1.2, 1.2)
    root["source_asset"] = "res://assets/kenney/mini_characters/character-male-a.glb"
    root["roster_name"] = "Tito"
    root["runtime_scale"] = 1.2

    for obj in imported:
        move_to_collection(obj, scale_collection)
    for obj in imported:
        if obj.parent not in imported_set:
            obj.parent = root
    set_status("v05 final — exact current Tito imported at Yun runtime scale 1.2")


def v05_close_render():
    camera = bpy.data.objects["ReviewCamera"]
    camera.location = (8.2, -10.8, 5.8)
    camera.data.lens = 54
    point_camera(camera, (0.0, -1.05, 1.55))
    render_preview(OUTPUT_DIR / "v05-final-close.png", camera, workbench=False)
    set_status("v05 final — close creation view captured")


def v05_gameplay_render():
    scene = bpy.context.scene
    camera_data = bpy.data.cameras.get("YunGameplayCamera") or bpy.data.cameras.new("YunGameplayCamera")
    camera = bpy.data.objects.get("YunGameplayCamera") or bpy.data.objects.new("YunGameplayCamera", camera_data)
    if not camera.users_collection:
        scene.collection.objects.link(camera)
    camera.location = (0.0, -11.8, 6.2)
    camera.data.angle = math.radians(46.0)
    point_camera(camera, (0.0, -0.75, 1.55))
    render_preview(OUTPUT_DIR / "v05-final-gameplay.png", camera, workbench=False)
    set_status("v05 final — 46-degree Yun gameplay-camera scale view captured")


def export_candidate():
    export_collection = ensure_collection(EXPORT_COLLECTION_NAME)
    bpy.ops.object.select_all(action="DESELECT")
    export_meshes = [obj for obj in export_collection.objects if obj.type == "MESH"]
    for obj in export_meshes:
        obj.select_set(True)
    if export_meshes:
        bpy.context.view_layer.objects.active = export_meshes[0]
    bpy.ops.export_scene.gltf(filepath=str(FINAL_GLB), export_format="GLB", use_selection=True)
    set_status("v05 final — standalone canopy GLB exported; references excluded")


def export_bounds(objects):
    points = []
    for obj in objects:
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    dimensions = maximum - minimum
    return {
        "minimum": [round(v, 4) for v in minimum],
        "maximum": [round(v, 4) for v in maximum],
        "dimensions": [round(v, 4) for v in dimensions],
    }


def finish_v05():
    export_collection = ensure_collection(EXPORT_COLLECTION_NAME)
    export_meshes = [obj for obj in export_collection.objects if obj.type == "MESH"]
    triangles = sum(sum(max(1, len(poly.vertices) - 2) for poly in obj.data.polygons) for obj in export_meshes)
    material_names = sorted({slot.material.name for obj in export_meshes for slot in obj.material_slots if slot.material})

    report = {
        "schemaVersion": "1.0.0",
        "asset": "yun_storefront_canopy_v05",
        "status": "CANDIDATE_UNPROMOTED",
        "checkpoints": {
            "v01": "v01-blockout-live-r2.blend",
            "v02": V02_BLEND.name,
            "v03": V03_BLEND.name,
            "v04": V04_BLEND.name,
            "v05": V05_BLEND.name,
        },
        "export": FINAL_GLB.name,
        "exportMeshCount": len(export_meshes),
        "triangles": triangles,
        "materials": material_names,
        "boundsMeters": export_bounds(export_meshes),
        "scaleReference": {
            "name": "Tito",
            "source": "res://assets/kenney/mini_characters/character-male-a.glb",
            "runtimeScale": 1.2,
        },
        "gameplayCameraFovDegrees": 46.0,
        "productionFilesChanged": False,
        "promoted": False,
        "visualEvidence": [
            "v02-structure.png",
            "v03-details.png",
            "v04-materials.png",
            "v05-final-close.png",
            "v05-final-gameplay.png",
        ],
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    bpy.ops.wm.save_as_mainfile(filepath=str(V05_BLEND))
    error_path = OUTPUT_DIR / "build-error.txt"
    if error_path.exists():
        error_path.unlink()
    DONE_FLAG.write_text("FINISHED\n", encoding="utf-8")

    gameplay_camera = bpy.data.objects["YunGameplayCamera"]
    set_view_to_camera(gameplay_camera)
    set_status("v05 final complete — candidate unpromoted — ready for owner review")


steps.extend(
    [
        v02_roof_and_frame,
        v02_posts_and_braces,
        v02_storefront_reference,
        checkpoint_v02,
        v03_corrugation,
        v03_gutter_and_downspout,
        v03_mounting_hardware,
        v03_lamp_and_patch,
        checkpoint_v03,
        v04_create_materials,
        v04_apply_canopy_materials,
        v04_apply_facade_materials,
        checkpoint_v04,
        v05_ground_and_tito,
        v05_close_render,
        v05_gameplay_render,
        export_candidate,
        finish_v05,
    ]
)


def run_next_step():
    global step_index
    if step_index >= len(steps):
        return None
    try:
        steps[step_index]()
        step_index += 1
        redraw()
        return STEP_DELAY
    except Exception as error:
        set_status(f"BUILD ERROR at step {step_index + 1}: {error}")
        (OUTPUT_DIR / "build-error.txt").write_text(
            f"Step {step_index + 1}: {type(error).__name__}: {error}\n",
            encoding="utf-8",
        )
        raise


resume_index_by_file = {
    "v02-structure.blend": 4,
    "v03-details.blend": 9,
    "v04-materials.blend": 12,
}
step_index = resume_index_by_file.get(Path(bpy.data.filepath).name, 0)
configure_scene()
if step_index:
    set_status(f"Resuming visible production pass at step {step_index + 1} of {len(steps)}")
bpy.app.timers.register(run_next_step, first_interval=5.0)
