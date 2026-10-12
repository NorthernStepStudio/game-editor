from pathlib import Path

import bpy
from mathutils import Vector


OUTPUT_DIR = Path(r"D:\dev\Northern Step Studio\artifacts\environment\dominican\yun_vehicle_family_v1")
OUTPUT_PATH = OUTPUT_DIR / "v02-structure-r3-delivery-rear.png"


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


camera = bpy.data.objects.get("DeliveryRearInspectionCamera")
if camera is None:
    camera_data = bpy.data.cameras.new("DeliveryRearInspectionCamera")
    camera = bpy.data.objects.new("DeliveryRearInspectionCamera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
camera.data.type = "ORTHO"
camera.data.ortho_scale = 4.0
camera.location = (7.8, 7.0, 3.8)
point_at(camera, (4.4, 2.2, 1.15))

for name in ("Sedan", "Taxi", "SportSedan", "SportHatch", "SUV", "Van", "Delivery"):
    collection = bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure")
    if collection:
        collection.hide_render = name != "Delivery"

scene = bpy.context.scene
scene.camera = camera
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 960
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(OUTPUT_PATH)
scene.render.film_transparent = False
bpy.ops.render.render(write_still=True)

for name in ("Sedan", "Taxi", "SportSedan", "SportHatch", "SUV", "Van", "Delivery"):
    collection = bpy.data.collections.get(f"EXPORT_Vehicle_{name}_Structure")
    if collection:
        collection.hide_render = False

scene["STATUS"] = "AWAITING_OWNER_REVIEW"
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_DIR / "v02-structure-r3.blend"))
scene.camera = camera
for window in bpy.context.window_manager.windows:
    for area in window.screen.areas:
        if area.type == "VIEW_3D":
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.region_3d.view_camera_zoom = 7
            try:
                area.spaces.active.shading.type = "RENDERED"
            except Exception:
                area.spaces.active.shading.type = "MATERIAL"
            area.tag_redraw()
try:
    bpy.context.workspace.status_text_set("v02 r3 delivery rear corrected — AWAITING OWNER REVIEW")
except Exception:
    pass
