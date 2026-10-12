"""
Render Studio Renders for Modular Dominican Environment Assets
Northern Step Studio — Asset Production Review Suite
"""

import bpy
import os
import math

ENV_DIR = r"D:\dev\Northern Step Studio\games\Yun\assets\environment\dominican"
BLEND_DIR = r"D:\dev\Northern Step Studio\artifacts\environment\dominican"
OUT_DIR = r"D:\dev\Northern Step Studio\artifacts\environment\renders"
os.makedirs(OUT_DIR, exist_ok=True)

ASSETS = [
    ("colmado_storefront", "colmado_storefront.blend", (0, 0, 1.8), 8.5),
    ("colmado_awning", "colmado_awning.blend", (0, 0, 0.5), 4.2),
    ("utility_pole_dominican", "utility_pole_dominican.blend", (0, 0, 3.8), 12.0),
    ("street_curb_tile", "street_curb_tile.blend", (0, 0, 0.15), 3.8),
]

for name, blend_file, target_center, cam_dist in ASSETS:
    blend_path = os.path.join(BLEND_DIR, blend_file)
    bpy.ops.wm.open_mainfile(filepath=blend_path)
    
    # Setup camera
    cam_data = bpy.data.cameras.new("StudioCam")
    cam_data.lens = 50.0
    cam_obj = bpy.data.objects.new("StudioCam", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    
    # Position camera in three-quarter isometric perspective
    yaw = math.radians(35)
    pitch = math.radians(25)
    cx = target_center[0] + cam_dist * math.cos(pitch) * math.sin(yaw)
    cy = target_center[1] - cam_dist * math.cos(pitch) * math.cos(yaw)
    cz = target_center[2] + cam_dist * math.sin(pitch)
    cam_obj.location = (cx, cy, cz)
    
    # Point at target
    dx = target_center[0] - cx
    dy = target_center[1] - cy
    dz = target_center[2] - cz
    rot_z = math.atan2(dx, -dy)
    rot_x = math.atan2(math.sqrt(dx*dx + dy*dy), -dz) - math.pi / 2
    cam_obj.rotation_euler = (rot_x, 0, rot_z)
    
    # Lighting
    light_data = bpy.data.lights.new(name="KeyLight", type='SUN')
    light_data.energy = 4.5
    light_obj = bpy.data.objects.new(name="KeyLight", object_data=light_data)
    bpy.context.scene.collection.objects.link(light_obj)
    light_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(30))
    
    fill_data = bpy.data.lights.new(name="FillLight", type='SUN')
    fill_data.energy = 1.8
    fill_obj = bpy.data.objects.new(name="FillLight", object_data=fill_data)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(-30), math.radians(-40), math.radians(120))
    
    # Background color
    bpy.context.scene.render.film_transparent = True
    bpy.context.scene.render.resolution_x = 768
    bpy.context.scene.render.resolution_y = 768
    bpy.context.scene.render.image_settings.file_format = 'PNG'
    
    out_img = os.path.join(OUT_DIR, f"{name}_render.png")
    bpy.context.scene.render.filepath = out_img
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_img} ({os.path.getsize(out_img)} bytes)")

print("\nAll Environment Studio Renders Completed!")
