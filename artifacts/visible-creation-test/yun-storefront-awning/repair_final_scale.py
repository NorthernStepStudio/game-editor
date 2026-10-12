import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(r"D:\dev\Northern Step Studio")
OUTPUT_DIR = ROOT / "artifacts" / "visible-creation-test" / "yun-storefront-awning"
SCALE = 0.55

FINAL_BLEND = OUTPUT_DIR / "v05-final-scale-r4.blend"
FINAL_GLB = OUTPUT_DIR / "yun_storefront_canopy_v05_scale_r4.glb"
REPORT_PATH = OUTPUT_DIR / "validation-report-scale-r4.json"
DONE_FLAG = OUTPUT_DIR / "v05-scale-r4-finished.flag"

EXPORT_COLLECTION = "EXPORT_YunStorefrontCanopy"
REFERENCE_COLLECTION = "REFERENCE_Facade"
SCALE_COLLECTION = "REFERENCE_CurrentTito"


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


def point_camera(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def set_view(camera):
    bpy.context.scene.camera = camera
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type != "VIEW_3D":
                continue
            space = area.spaces.active
            space.region_3d.view_perspective = "CAMERA"
            space.region_3d.view_camera_zoom = 10
            space.shading.type = "RENDERED"
            area.tag_redraw()


def world_bounds(objects):
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


def bounds_json(bounds):
    minimum, maximum = bounds
    dimensions = maximum - minimum
    return {
        "minimum": [round(v, 4) for v in minimum],
        "maximum": [round(v, 4) for v in maximum],
        "dimensions": [round(v, 4) for v in dimensions],
    }


def render(path, camera):
    scene = bpy.context.scene
    set_view(camera)
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def remove_confusing_downspout():
    removed = []
    for name in ("Downspout_R_Upper", "Downspout_R_Main", "Downspout_R_Outlet"):
        obj = bpy.data.objects.get(name)
        if obj is None:
            continue
        removed.append(name)
        bpy.data.objects.remove(obj, do_unlink=True)
    if not removed:
        raise RuntimeError("Expected right-side drainage objects were not found")
    bpy.context.scene["RIGHT_SUPPORT_CORRECTION"] = (
        "Removed drainage detail; retained one structural support on the right"
    )
    bpy.context.view_layer.update()
    set_status("v05 correction — right side now has one structural support only")


def apply_locked_scale():
    scene = bpy.context.scene
    if scene.get("YUN_LOCKED_SCALE_APPLIED"):
        return
    names = (EXPORT_COLLECTION, REFERENCE_COLLECTION)
    for collection_name in names:
        collection = bpy.data.collections.get(collection_name)
        if collection is None:
            continue
        for obj in collection.objects:
            if obj.type not in {"MESH", "EMPTY"}:
                continue
            obj.location *= SCALE
            obj.scale *= SCALE
    scene["YUN_LOCKED_SCALE_APPLIED"] = SCALE
    bpy.context.view_layer.update()
    set_status("v05 correction — locked Yun environment scale 0.55 applied")


def place_current_tito():
    root = bpy.data.objects.get("CurrentGameplayTito_RuntimeScale1_2")
    scale_collection = bpy.data.collections.get(SCALE_COLLECTION)
    if root is None or scale_collection is None:
        raise RuntimeError("Current gameplay Tito reference is missing")

    # The source GLB contains an unmaterialed Blender helper named Icosphere.
    # Godot excludes it from the mounted gameplay bounds; hide the helper so
    # Blender displays the same body/head geometry that Yun actually renders.
    helper = bpy.data.objects.get("Icosphere")
    if helper is not None and helper.users_collection:
        helper.hide_render = True
        helper.hide_viewport = True
        helper["excluded_from_yun_gameplay_reference"] = True

    root.location = (2.0, -1.30, 0.0)
    root.rotation_euler = (0.0, 0.0, math.radians(180.0))
    root.scale = (1.2, 1.2, 1.2)
    bpy.context.view_layer.update()

    meshes = [obj for obj in scale_collection.all_objects if obj.type == "MESH"]
    bounds = world_bounds(meshes)
    if bounds is None:
        raise RuntimeError("Current gameplay Tito has no mesh bounds")
    minimum, _maximum = bounds
    root.location.z -= minimum.z
    bpy.context.view_layer.update()
    set_status("v05 correction — exact Tito grounded beside the scaled canopy")


def create_renders():
    close_camera = bpy.data.objects["ReviewCamera"]
    close_camera.location = (4.8, -6.6, 3.3)
    close_camera.data.lens = 52
    point_camera(close_camera, (0.0, -0.62, 0.86))
    render(OUTPUT_DIR / "v05-final-close-r4.png", close_camera)
    set_status("v05 correction — close scale view captured")

    gameplay_camera = bpy.data.objects["YunGameplayCamera"]
    gameplay_camera.location = (0.0, -7.4, 3.65)
    gameplay_camera.data.angle = math.radians(46.0)
    point_camera(gameplay_camera, (0.0, -0.55, 0.90))
    render(OUTPUT_DIR / "v05-final-gameplay-r4.png", gameplay_camera)
    set_status("v05 correction — Yun 46-degree gameplay view captured")


def export_and_finish():
    export_collection = bpy.data.collections[EXPORT_COLLECTION]
    export_meshes = [obj for obj in export_collection.objects if obj.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in export_meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = export_meshes[0]
    bpy.ops.export_scene.gltf(filepath=str(FINAL_GLB), export_format="GLB", use_selection=True)

    tito_collection = bpy.data.collections[SCALE_COLLECTION]
    tito_meshes = [obj for obj in tito_collection.all_objects if obj.type == "MESH"]
    triangles = sum(sum(max(1, len(poly.vertices) - 2) for poly in obj.data.polygons) for obj in export_meshes)
    materials = sorted({slot.material.name for obj in export_meshes for slot in obj.material_slots if slot.material})
    report = {
        "schemaVersion": "1.0.0",
        "asset": "yun_storefront_canopy_v05_scale_r4",
        "status": "CANDIDATE_UNPROMOTED",
        "lockedYunEnvironmentScale": SCALE,
        "rightSupportCorrection": "Drainage detail removed; one right structural support retained",
        "titoBlenderHelperExcluded": "Icosphere (unmaterialed helper not present in Godot gameplay bounds)",
        "sourceCheckpoint": "v05-final.blend",
        "finalCheckpoint": FINAL_BLEND.name,
        "export": FINAL_GLB.name,
        "exportMeshCount": len(export_meshes),
        "triangles": triangles,
        "materials": materials,
        "boundsGameUnits": bounds_json(world_bounds(export_meshes)),
        "scaleReference": {
            "name": "Tito",
            "source": "res://assets/kenney/mini_characters/character-male-a.glb",
            "runtimeScale": 1.2,
            "boundsGameUnits": bounds_json(world_bounds(tito_meshes)),
        },
        "gameplayCameraFovDegrees": 46.0,
        "productionFilesChanged": False,
        "promoted": False,
        "visualEvidence": ["v05-final-close-r4.png", "v05-final-gameplay-r4.png"],
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    bpy.ops.wm.save_as_mainfile(filepath=str(FINAL_BLEND))
    DONE_FLAG.write_text("FINISHED\n", encoding="utf-8")

    gameplay_camera = bpy.data.objects["YunGameplayCamera"]
    set_view(gameplay_camera)
    set_status("v05 scale correction complete — unpromoted candidate ready")


steps = [remove_confusing_downspout, apply_locked_scale, place_current_tito, create_renders, export_and_finish]
step_index = 0


def run_next():
    global step_index
    try:
        if step_index >= len(steps):
            return None
        steps[step_index]()
        step_index += 1
        return 1.8
    except Exception as error:
        (OUTPUT_DIR / "scale-repair-error.txt").write_text(
            f"Step {step_index + 1}: {type(error).__name__}: {error}\n",
            encoding="utf-8",
        )
        set_status(f"v05 scale repair failed: {error}")
        raise


set_status("v05 scale correction ready — starting in five seconds")
bpy.app.timers.register(run_next, first_interval=5.0)
