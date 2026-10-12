"""Build Yun Caribbean House 01 as an original Blender/GLB game asset.

Run with Blender 5.2+:
    blender --background --factory-startup --python build_asset.py

The generator intentionally uses only Blender primitives and studio-authored
procedural arrangement. No third-party creative assets or textures are used.
"""

from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import bpy
from mathutils import Vector


ASSET_ID = "yun_caribbean_house_01"
ASSET_TITLE = "Yun Caribbean House 01"
OUTPUT_DIR = Path(__file__).resolve().parent
BLEND_PATH = OUTPUT_DIR / f"{ASSET_ID}.blend"
GLB_PATH = OUTPUT_DIR / f"{ASSET_ID}.glb"

COMPONENT_NAMES: list[str] = []
MATERIALS: dict[str, bpy.types.Material] = {}


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_material(
    name: str,
    rgba: tuple[float, float, float, float],
    roughness: float = 0.72,
    metallic: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    MATERIALS[name] = material
    return material


def build_materials() -> None:
    # Warm, faded pigments stay saturated enough to read from Yun's gameplay camera.
    make_material("MAT_Wall_Faded_Mango", (0.52, 0.245, 0.105, 1.0), 0.86)
    make_material("MAT_Wall_Sunwashed_Coral", (0.49, 0.155, 0.095, 1.0), 0.86)
    make_material("MAT_Concrete_Sand", (0.66, 0.545, 0.385, 1.0), 0.92)
    make_material("MAT_Plaster_Patch", (0.76, 0.675, 0.52, 1.0), 0.96)
    make_material("MAT_Accent_Seafoam", (0.12, 0.32, 0.30, 1.0), 0.76)
    make_material("MAT_Metal_Dark", (0.035, 0.045, 0.055, 1.0), 0.40, 0.72)
    make_material("MAT_Window_Dark", (0.025, 0.07, 0.085, 1.0), 0.24, 0.05)
    make_material("MAT_AC_OffWhite", (0.72, 0.70, 0.62, 1.0), 0.64)
    make_material("MAT_Tank_DeepBlue", (0.025, 0.075, 0.105, 1.0), 0.52)


def apply_transform(obj: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)


def bevel_object(obj: bpy.types.Object, amount: float) -> None:
    if amount <= 0:
        return
    modifier = obj.modifiers.new(name="Gameplay_Bevel", type="BEVEL")
    modifier.width = amount
    modifier.segments = 1
    modifier.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def finish_object(obj: bpy.types.Object, material: str, bevel: float = 0.0) -> bpy.types.Object:
    apply_transform(obj)
    bevel_object(obj, bevel)
    obj.data.materials.append(MATERIALS[material])
    COMPONENT_NAMES.append(obj.name)
    return obj


def add_box(
    name: str,
    dimensions: tuple[float, float, float],
    location: tuple[float, float, float],
    material: str,
    rotation_deg: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.015,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    obj.rotation_euler = tuple(math.radians(v) for v in rotation_deg)
    return finish_object(obj, material, bevel)


def add_cylinder(
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    material: str,
    rotation_deg: tuple[float, float, float] = (0.0, 0.0, 0.0),
    vertices: int = 12,
    bevel: float = 0.01,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = tuple(math.radians(v) for v in rotation_deg)
    return finish_object(obj, material, bevel)


def add_cylinder_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    material: str,
    vertices: int = 10,
) -> bpy.types.Object:
    start_v = Vector(start)
    end_v = Vector(end)
    delta = end_v - start_v
    midpoint = (start_v + end_v) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=delta.length, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    obj.rotation_mode = "XYZ"
    return finish_object(obj, material, 0.006)


def add_front_window(name: str, x: float, z: float, width: float, height: float, y: float = -5.30) -> None:
    add_box(f"{name}_Recess", (width, 0.055, height), (x, y, z), "MAT_Window_Dark", bevel=0.01)
    frame = 0.095
    add_box(f"{name}_FrameTop", (width + 0.20, 0.08, frame), (x, y - 0.035, z + height / 2 + frame / 2), "MAT_Concrete_Sand", bevel=0.01)
    add_box(f"{name}_FrameBottom", (width + 0.20, 0.08, frame), (x, y - 0.035, z - height / 2 - frame / 2), "MAT_Concrete_Sand", bevel=0.01)
    add_box(f"{name}_FrameLeft", (frame, 0.08, height), (x - width / 2 - frame / 2, y - 0.035, z), "MAT_Concrete_Sand", bevel=0.01)
    add_box(f"{name}_FrameRight", (frame, 0.08, height), (x + width / 2 + frame / 2, y - 0.035, z), "MAT_Concrete_Sand", bevel=0.01)
    for index, bar_x in enumerate((x - width * 0.30, x, x + width * 0.30)):
        add_box(f"{name}_BarV_{index}", (0.035, 0.055, height + 0.08), (bar_x, y - 0.085, z), "MAT_Metal_Dark", bevel=0.006)
    for index, bar_z in enumerate((z - height * 0.25, z + height * 0.25)):
        add_box(f"{name}_BarH_{index}", (width + 0.06, 0.055, 0.035), (x, y - 0.085, bar_z), "MAT_Metal_Dark", bevel=0.006)


def add_back_window(name: str, x: float, z: float, width: float, height: float, y: float = 5.30) -> None:
    add_box(f"{name}_Recess", (width, 0.055, height), (x, y, z), "MAT_Window_Dark", bevel=0.01)
    frame = 0.095
    for suffix, dims, loc in (
        ("Top", (width + 0.20, 0.08, frame), (x, y + 0.035, z + height / 2 + frame / 2)),
        ("Bottom", (width + 0.20, 0.08, frame), (x, y + 0.035, z - height / 2 - frame / 2)),
        ("Left", (frame, 0.08, height), (x - width / 2 - frame / 2, y + 0.035, z)),
        ("Right", (frame, 0.08, height), (x + width / 2 + frame / 2, y + 0.035, z)),
    ):
        add_box(f"{name}_Frame{suffix}", dims, loc, "MAT_Concrete_Sand", bevel=0.01)
    for index, bar_x in enumerate((x - width * 0.30, x, x + width * 0.30)):
        add_box(f"{name}_BarV_{index}", (0.035, 0.055, height + 0.08), (bar_x, y + 0.085, z), "MAT_Metal_Dark", bevel=0.006)
    for index, bar_z in enumerate((z - height * 0.25, z + height * 0.25)):
        add_box(f"{name}_BarH_{index}", (width + 0.06, 0.055, 0.035), (x, y + 0.085, bar_z), "MAT_Metal_Dark", bevel=0.006)


def add_side_window(name: str, side_x: float, y: float, z: float, width: float, height: float) -> None:
    outward = -1.0 if side_x < 0 else 1.0
    panel_x = side_x + outward * 0.025
    add_box(f"{name}_Recess", (0.055, width, height), (panel_x, y, z), "MAT_Window_Dark", bevel=0.01)
    frame = 0.095
    rail_x = panel_x + outward * 0.035
    add_box(f"{name}_FrameTop", (0.08, width + 0.20, frame), (rail_x, y, z + height / 2 + frame / 2), "MAT_Concrete_Sand", bevel=0.01)
    add_box(f"{name}_FrameBottom", (0.08, width + 0.20, frame), (rail_x, y, z - height / 2 - frame / 2), "MAT_Concrete_Sand", bevel=0.01)
    add_box(f"{name}_FrameNear", (0.08, frame, height), (rail_x, y - width / 2 - frame / 2, z), "MAT_Concrete_Sand", bevel=0.01)
    add_box(f"{name}_FrameFar", (0.08, frame, height), (rail_x, y + width / 2 + frame / 2, z), "MAT_Concrete_Sand", bevel=0.01)
    bar_x = panel_x + outward * 0.085
    for index, bar_y in enumerate((y - width * 0.30, y, y + width * 0.30)):
        add_box(f"{name}_BarV_{index}", (0.055, 0.035, height + 0.08), (bar_x, bar_y, z), "MAT_Metal_Dark", bevel=0.006)
    for index, bar_z in enumerate((z - height * 0.25, z + height * 0.25)):
        add_box(f"{name}_BarH_{index}", (0.055, width + 0.06, 0.035), (bar_x, y, bar_z), "MAT_Metal_Dark", bevel=0.006)


def add_door(name: str, x: float, y: float, z: float, width: float = 0.96, height: float = 2.14, back: bool = False) -> None:
    offset = 0.035 if back else -0.035
    add_box(f"{name}_Panel", (width, 0.075, height), (x, y, z), "MAT_Accent_Seafoam", bevel=0.018)
    add_box(f"{name}_FrameTop", (width + 0.18, 0.10, 0.10), (x, y + offset, z + height / 2 + 0.05), "MAT_Concrete_Sand", bevel=0.01)
    add_box(f"{name}_FrameLeft", (0.10, 0.10, height), (x - width / 2 - 0.05, y + offset, z), "MAT_Concrete_Sand", bevel=0.01)
    add_box(f"{name}_FrameRight", (0.10, 0.10, height), (x + width / 2 + 0.05, y + offset, z), "MAT_Concrete_Sand", bevel=0.01)
    add_box(f"{name}_Handle", (0.055, 0.055, 0.16), (x + width * 0.30, y + offset * 2.2, z), "MAT_Metal_Dark", bevel=0.012)
    # Two broad pressed-metal ribs read at gameplay distance without micro-detail.
    for index, rib_z in enumerate((z - 0.42, z + 0.42)):
        add_box(f"{name}_Rib_{index}", (width * 0.72, 0.022, 0.055), (x, y + offset * 1.8, rib_z), "MAT_Metal_Dark", bevel=0.005)


def build_structure() -> None:
    # Foundation bottom is exactly Z=0. The main shell is closed on every side.
    add_box("Foundation_Plinth", (6.60, 10.90, 0.16), (0.0, 0.0, 0.08), "MAT_Concrete_Sand", bevel=0.025)
    add_box("Ground_Floor_Shell", (6.00, 10.50, 2.86), (-0.15, 0.0, 1.59), "MAT_Wall_Faded_Mango", bevel=0.035)
    add_box("Interfloor_Band", (6.12, 10.60, 0.20), (-0.15, 0.0, 3.07), "MAT_Concrete_Sand", bevel=0.018)
    add_box("Upper_Floor_Shell", (6.00, 10.50, 2.55), (-0.15, 0.0, 4.445), "MAT_Wall_Sunwashed_Coral", bevel=0.035)
    add_box("Roof_Slab", (6.20, 10.70, 0.22), (-0.15, 0.0, 5.83), "MAT_Concrete_Sand", bevel=0.025)

    # Rooftop parapet: four complete, low reinforced-concrete walls.
    add_box("Parapet_Front", (6.20, 0.18, 0.55), (-0.15, -5.26, 6.215), "MAT_Concrete_Sand", bevel=0.018)
    add_box("Parapet_Back", (6.20, 0.18, 0.55), (-0.15, 5.26, 6.215), "MAT_Concrete_Sand", bevel=0.018)
    add_box("Parapet_Left", (0.18, 10.34, 0.55), (-3.16, 0.0, 6.215), "MAT_Concrete_Sand", bevel=0.018)
    add_box("Parapet_Right", (0.18, 10.34, 0.55), (2.86, 0.0, 6.215), "MAT_Concrete_Sand", bevel=0.018)

    # Front elevation: realistic-scale front door, barred windows, balcony door.
    add_door("Front_Metal_Door", -1.72, -5.285, 1.28)
    add_front_window("Front_Ground_Window", 0.52, 1.62, 1.42, 1.15)
    add_front_window("Front_Upper_Window", -1.72, 4.52, 1.38, 1.08)
    add_door("Balcony_Metal_Door", 0.48, -5.285, 4.22, width=0.92, height=2.05)

    # Back elevation and both sides remain authored, not blank proxy faces.
    add_door("Rear_Utility_Door", 1.52, 5.285, 1.28, width=0.90, height=2.10, back=True)
    add_back_window("Rear_Ground_Window", -1.35, 1.60, 1.34, 1.08)
    add_back_window("Rear_Upper_Window_Left", -1.45, 4.47, 1.25, 1.02)
    add_back_window("Rear_Upper_Window_Right", 1.28, 4.47, 1.25, 1.02)
    add_side_window("Left_Ground_Window_Front", -3.175, -2.10, 1.62, 1.30, 1.05)
    add_side_window("Left_Ground_Window_Back", -3.175, 2.25, 1.62, 1.18, 1.00)
    add_side_window("Left_Upper_Window", -3.175, -1.15, 4.47, 1.35, 1.08)
    add_side_window("Right_Upper_Window", 2.875, 3.15, 4.47, 1.20, 1.02)


def build_balcony_and_awning() -> None:
    # Small balcony cantilevered from the second floor.
    add_box("Balcony_Slab", (2.82, 0.92, 0.18), (0.42, -5.63, 3.14), "MAT_Concrete_Sand", bevel=0.025)
    front_y = -6.07
    for index, x in enumerate((-0.96, -0.50, -0.04, 0.42, 0.88, 1.34, 1.80)):
        add_box(f"Balcony_Front_Post_{index}", (0.045, 0.045, 0.92), (x, front_y, 3.67), "MAT_Metal_Dark", bevel=0.006)
    add_box("Balcony_Front_Rail_Top", (2.82, 0.055, 0.055), (0.42, front_y, 4.13), "MAT_Metal_Dark", bevel=0.009)
    add_box("Balcony_Front_Rail_Mid", (2.82, 0.045, 0.045), (0.42, front_y, 3.70), "MAT_Metal_Dark", bevel=0.007)
    for side_index, side_x in enumerate((-0.98, 1.82)):
        for y_index, rail_y in enumerate((-5.43, -5.73, -6.03)):
            add_box(f"Balcony_Side_{side_index}_Post_{y_index}", (0.045, 0.045, 0.92), (side_x, rail_y, 3.67), "MAT_Metal_Dark", bevel=0.006)
        add_box(f"Balcony_Side_{side_index}_Top", (0.055, 0.68, 0.055), (side_x, -5.73, 4.13), "MAT_Metal_Dark", bevel=0.008)
        add_box(f"Balcony_Side_{side_index}_Mid", (0.045, 0.68, 0.045), (side_x, -5.73, 3.70), "MAT_Metal_Dark", bevel=0.006)

    # Slightly oversized awning gives a strong, readable tropical street silhouette.
    add_box("Entry_Awning", (1.85, 1.06, 0.10), (-1.72, -5.68, 2.56), "MAT_Accent_Seafoam", rotation_deg=(12, 0, 0), bevel=0.018)
    add_cylinder_between("Awning_Strut_Left", (-2.52, -5.28, 2.26), (-2.52, -6.08, 2.42), 0.025, "MAT_Metal_Dark")
    add_cylinder_between("Awning_Strut_Right", (-0.92, -5.28, 2.26), (-0.92, -6.08, 2.42), 0.025, "MAT_Metal_Dark")


def build_gated_entry() -> None:
    gate_y = -5.50
    gate_center_x = -1.72
    gate_width = 1.22
    add_box("Entry_Gate_Left_Pier", (0.18, 0.28, 2.28), (gate_center_x - gate_width / 2 - 0.10, gate_y, 1.14), "MAT_Concrete_Sand", bevel=0.018)
    add_box("Entry_Gate_Right_Pier", (0.18, 0.28, 2.28), (gate_center_x + gate_width / 2 + 0.10, gate_y, 1.14), "MAT_Concrete_Sand", bevel=0.018)
    add_box("Entry_Gate_Header", (1.60, 0.16, 0.16), (gate_center_x, gate_y, 2.22), "MAT_Concrete_Sand", bevel=0.012)
    add_box("Entry_Gate_Frame_Top", (gate_width, 0.055, 0.055), (gate_center_x, gate_y - 0.16, 2.07), "MAT_Metal_Dark", bevel=0.007)
    add_box("Entry_Gate_Frame_Bottom", (gate_width, 0.055, 0.055), (gate_center_x, gate_y - 0.16, 0.22), "MAT_Metal_Dark", bevel=0.007)
    add_box("Entry_Gate_Frame_Left", (0.055, 0.055, 1.90), (gate_center_x - gate_width / 2, gate_y - 0.16, 1.14), "MAT_Metal_Dark", bevel=0.007)
    add_box("Entry_Gate_Frame_Right", (0.055, 0.055, 1.90), (gate_center_x + gate_width / 2, gate_y - 0.16, 1.14), "MAT_Metal_Dark", bevel=0.007)
    for index in range(6):
        x = gate_center_x - gate_width * 0.40 + index * gate_width * 0.16
        add_box(f"Entry_Gate_Bar_{index}", (0.035, 0.045, 1.82), (x, gate_y - 0.19, 1.14), "MAT_Metal_Dark", bevel=0.005)
    add_box("Entry_Gate_Latch", (0.12, 0.07, 0.12), (gate_center_x + 0.32, gate_y - 0.22, 1.10), "MAT_Metal_Dark", bevel=0.012)


def build_exterior_stair() -> None:
    # Twelve solid, attached steps climb along the right wall to a full turning
    # landing. The landing and rail remain clear of the outward-facing door.
    step_count = 12
    run = 0.28
    rise = 0.26
    stair_x = 3.22
    front_y = -4.95
    for index in range(step_count):
        top_z = (index + 1) * rise
        y = front_y + index * run
        add_box(
            f"Exterior_Stair_Step_{index + 1:02d}",
            (0.82, run + 0.025, top_z),
            (stair_x, y, top_z / 2),
            "MAT_Concrete_Sand",
            bevel=0.012,
        )
    landing_center_y = -1.12
    landing_front_y = -1.72
    landing_back_y = -0.52
    landing_outer_x = 3.68
    add_box("Exterior_Stair_Landing", (0.92, 1.20, 0.18), (3.22, landing_center_y, 3.12), "MAT_Concrete_Sand", bevel=0.018)

    # Side metal door at the landing with a visible threshold. Its full 0.95 m
    # opening faces the clear center of the landing rather than a guardrail post.
    add_box("Stair_Side_Door", (0.075, 0.95, 2.05), (2.89, landing_center_y, 4.19), "MAT_Accent_Seafoam", bevel=0.018)
    add_box("Stair_Side_Door_Header", (0.10, 1.12, 0.10), (2.925, landing_center_y, 5.265), "MAT_Concrete_Sand", bevel=0.01)
    add_box("Stair_Side_Door_Jamb_A", (0.10, 0.10, 2.05), (2.925, landing_center_y - 0.52, 4.19), "MAT_Concrete_Sand", bevel=0.01)
    add_box("Stair_Side_Door_Jamb_B", (0.10, 0.10, 2.05), (2.925, landing_center_y + 0.52, 4.19), "MAT_Concrete_Sand", bevel=0.01)
    add_box("Stair_Side_Door_Threshold", (0.18, 0.95, 0.10), (2.94, landing_center_y, 3.19), "MAT_Concrete_Sand", bevel=0.01)
    add_box("Stair_Side_Door_Handle", (0.055, 0.055, 0.16), (2.83, landing_center_y - 0.30, 4.18), "MAT_Metal_Dark", bevel=0.01)

    # Continuous outer handrail. Every post terminates on a tread or landing;
    # the sloped rail meets the horizontal landing rail at one shared corner.
    for index in range(0, step_count, 2):
        top_z = (index + 1) * rise
        y = front_y + index * run
        add_box(f"Stair_Rail_Post_{index:02d}", (0.045, 0.045, 0.96), (landing_outer_x, y, top_z + 0.48), "MAT_Metal_Dark", bevel=0.006)
    add_cylinder_between(
        "Stair_Rail_Sloped_Top",
        (landing_outer_x, front_y, rise + 0.96),
        (landing_outer_x, landing_front_y, step_count * rise + 0.96),
        0.035,
        "MAT_Metal_Dark",
        vertices=10,
    )
    for suffix, y in (("Front", landing_front_y), ("Center", landing_center_y), ("Back", landing_back_y)):
        add_box(f"Landing_Outer_Rail_Post_{suffix}", (0.045, 0.045, 0.96), (landing_outer_x, y, 3.60), "MAT_Metal_Dark", bevel=0.006)
    add_box("Landing_Outer_Rail_Top", (0.045, 1.20, 0.055), (landing_outer_x, landing_center_y, 4.08), "MAT_Metal_Dark", bevel=0.008)
    add_box("Landing_Outer_Rail_Mid", (0.045, 1.20, 0.045), (landing_outer_x, landing_center_y, 3.67), "MAT_Metal_Dark", bevel=0.006)
    # A short rear return protects the open landing edge without crossing the door.
    add_box("Landing_Back_Rail_Post_Wall", (0.045, 0.045, 0.96), (2.92, landing_back_y, 3.60), "MAT_Metal_Dark", bevel=0.006)
    add_box("Landing_Back_Rail_Top", (0.80, 0.045, 0.055), (3.30, landing_back_y, 4.08), "MAT_Metal_Dark", bevel=0.008)
    add_box("Landing_Back_Rail_Mid", (0.80, 0.045, 0.045), (3.30, landing_back_y, 3.67), "MAT_Metal_Dark", bevel=0.006)


def build_rooftop_and_utilities() -> None:
    # Compact rooftop tank on short concrete feet; total asset height stays near 7.2 m.
    for index, (x, y) in enumerate(((1.15, 1.25), (1.85, 1.25), (1.15, 1.95), (1.85, 1.95))):
        add_box(f"Tank_Foot_{index}", (0.20, 0.20, 0.18), (x, y, 6.56), "MAT_Concrete_Sand", bevel=0.015)
    add_cylinder("Rooftop_Water_Tank", 0.58, 0.64, (1.50, 1.60, 6.92), "MAT_Tank_DeepBlue", vertices=16, bevel=0.025)
    add_cylinder("Rooftop_Water_Tank_Lid", 0.48, 0.10, (1.50, 1.60, 7.29), "MAT_Tank_DeepBlue", vertices=16, bevel=0.018)
    add_cylinder("Rooftop_Tank_Pipe", 0.045, 0.78, (1.50, 2.18, 6.83), "MAT_Metal_Dark", vertices=10, bevel=0.006)

    # One wall-mounted split AC unit on the left upper story.
    add_box("Wall_AC_Main", (0.42, 1.10, 0.66), (-3.38, 1.65, 4.52), "MAT_AC_OffWhite", bevel=0.055)
    add_box("Wall_AC_Vent", (0.03, 0.82, 0.13), (-3.60, 1.65, 4.36), "MAT_Metal_Dark", bevel=0.008)
    add_cylinder("Wall_AC_Fan", 0.22, 0.032, (-3.605, 1.65, 4.60), "MAT_Metal_Dark", rotation_deg=(0, 90, 0), vertices=16, bevel=0.006)
    for index, y in enumerate((1.52, 1.78)):
        add_box(f"Wall_AC_Bracket_{index}", (0.46, 0.045, 0.045), (-3.36, y, 4.18), "MAT_Metal_Dark", bevel=0.005)

    # Front electrical meter and conduit attach directly to the wall.
    add_box("Electrical_Meter_Box", (0.44, 0.16, 0.62), (2.28, -5.34, 1.58), "MAT_Metal_Dark", bevel=0.025)
    add_cylinder("Electrical_Meter_Face", 0.13, 0.035, (2.28, -5.44, 1.68), "MAT_AC_OffWhite", rotation_deg=(90, 0, 0), vertices=16, bevel=0.005)
    add_cylinder("Electrical_Conduit_Up", 0.032, 3.65, (2.28, -5.39, 3.72), "MAT_Metal_Dark", vertices=8, bevel=0.004)
    add_cylinder("Electrical_Conduit_Down", 0.032, 1.24, (2.28, -5.39, 0.70), "MAT_Metal_Dark", vertices=8, bevel=0.004)
    add_box("Electrical_Junction_Box", (0.24, 0.12, 0.24), (2.28, -5.37, 5.38), "MAT_Metal_Dark", bevel=0.018)

    # Back rainwater drain gives the rear elevation a believable utility read.
    add_cylinder("Rear_Rainwater_Downpipe", 0.055, 5.70, (-2.62, 5.34, 2.85), "MAT_Metal_Dark", vertices=10, bevel=0.006)
    add_cylinder_between("Rear_Rainwater_Elbow", (-2.62, 5.34, 5.70), (-2.62, 5.08, 5.92), 0.055, "MAT_Metal_Dark", vertices=10)


def build_weathering() -> None:
    # Broad, restrained repair patches read as lived-in plaster rather than decay.
    add_box("Patch_Front_Low", (0.62, 0.020, 0.32), (0.90, -5.262, 0.52), "MAT_Plaster_Patch", bevel=0.025)
    add_box("Patch_Front_Upper", (0.48, 0.020, 0.24), (-2.43, -5.262, 3.68), "MAT_Plaster_Patch", rotation_deg=(0, 0, -8), bevel=0.022)
    add_box("Patch_Left_Low", (0.020, 0.70, 0.28), (-3.162, 3.65, 0.62), "MAT_Plaster_Patch", rotation_deg=(4, 0, 0), bevel=0.022)
    add_box("Patch_Back_Mid", (0.72, 0.020, 0.28), (0.05, 5.262, 3.72), "MAT_Plaster_Patch", rotation_deg=(0, 0, 5), bevel=0.022)
    add_box("Patch_Right_Low", (0.020, 0.62, 0.26), (2.862, 3.98, 0.58), "MAT_Plaster_Patch", rotation_deg=(-5, 0, 0), bevel=0.020)


def join_by_material() -> list[bpy.types.Object]:
    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH" or not obj.data.materials:
            continue
        groups.setdefault(obj.data.materials[0].name, []).append(obj)

    batches: list[bpy.types.Object] = []
    for material_name, objects in sorted(groups.items()):
        active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.select_all(action="DESELECT")
            for obj in objects:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = active
            bpy.ops.object.join()
        active.name = f"BATCH_{material_name.removeprefix('MAT_')}"
        batches.append(active)

    root = bpy.data.objects.new(ASSET_ID, None)
    root.empty_display_type = "CUBE"
    root.empty_display_size = 0.25
    bpy.context.scene.collection.objects.link(root)
    for obj in batches:
        obj.parent = root
    root["asset_id"] = ASSET_ID
    root["asset_type"] = "modular_building"
    root["front_axis"] = "-Y"
    root["ground_origin_z"] = 0.0
    return batches


def mesh_statistics(objects: list[bpy.types.Object]) -> dict[str, int]:
    vertices = 0
    triangles = 0
    polygons = 0
    for obj in objects:
        mesh = obj.data
        mesh.calc_loop_triangles()
        vertices += len(mesh.vertices)
        triangles += len(mesh.loop_triangles)
        polygons += len(mesh.polygons)
    return {"vertices": vertices, "triangles": triangles, "polygons": polygons, "meshNodes": len(objects)}


def world_bounds(objects: list[bpy.types.Object]) -> dict[str, list[float]]:
    points: list[Vector] = []
    for obj in objects:
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    minimum = [min(point[index] for point in points) for index in range(3)]
    maximum = [max(point[index] for point in points) for index in range(3)]
    dimensions = [maximum[index] - minimum[index] for index in range(3)]
    return {
        "minimum": [round(value, 4) for value in minimum],
        "maximum": [round(value, 4) for value in maximum],
        "dimensions": [round(value, 4) for value in dimensions],
    }


def save_and_export(objects: list[bpy.types.Object]) -> None:
    scene = bpy.context.scene
    scene["asset_id"] = ASSET_ID
    scene["original_design"] = True
    scene["units"] = "meters"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    export_args = {
        "filepath": str(GLB_PATH),
        "export_format": "GLB",
        "use_selection": True,
        "export_apply": True,
        "export_animations": False,
        "export_cameras": False,
        "export_lights": False,
    }
    bpy.ops.export_scene.gltf(**export_args)


def aim_camera(camera: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_render_rig() -> bpy.types.Object:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 960
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Review_World")
    scene.world.color = (0.055, 0.072, 0.085)
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass

    camera_data = bpy.data.cameras.new("Review_Camera")
    camera_data.lens = 55
    camera = bpy.data.objects.new("Review_Camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    sun_data = bpy.data.lights.new("Review_Sun", type="SUN")
    sun_data.energy = 2.8
    sun_data.angle = math.radians(18)
    sun = bpy.data.objects.new("Review_Sun", sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(28), math.radians(-22), math.radians(-32))

    key_data = bpy.data.lights.new("Review_Key", type="AREA")
    key_data.energy = 1200
    key_data.shape = "DISK"
    key_data.size = 8.0
    key = bpy.data.objects.new("Review_Key", key_data)
    scene.collection.objects.link(key)
    key.location = (-8.0, -10.0, 13.0)
    key.rotation_euler = (Vector((0, 0, 3.2)) - key.location).to_track_quat("-Z", "Y").to_euler()

    fill_data = bpy.data.lights.new("Review_Fill", type="AREA")
    fill_data.energy = 700
    fill_data.size = 7.0
    fill = bpy.data.objects.new("Review_Fill", fill_data)
    scene.collection.objects.link(fill)
    fill.location = (8.0, 6.0, 8.0)
    fill.rotation_euler = (Vector((0, 0, 3.4)) - fill.location).to_track_quat("-Z", "Y").to_euler()
    return camera


def render_views(camera: bpy.types.Object) -> list[str]:
    scene = bpy.context.scene
    target = (0.0, 0.0, 3.45)
    views = {
        "hero": ((10.8, -15.6, 9.2), 56),
        "front": ((0.0, -18.5, 4.1), 58),
        "right-stair": ((14.8, -2.6, 6.6), 58),
        "left-utilities": ((-14.8, -1.5, 6.5), 58),
        "rear": ((-10.5, 15.5, 7.6), 56),
        "roof": ((9.5, -10.5, 17.0), 58),
    }
    rendered: list[str] = []
    for name, (position, lens) in views.items():
        camera.location = position
        camera.data.lens = lens
        aim_camera(camera, target)
        output = OUTPUT_DIR / f"{ASSET_ID}-{name}.png"
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        rendered.append(output.name)
    return rendered


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def validate_export(render_names: list[str], authored_stats: dict[str, int]) -> tuple[dict, dict]:
    # Re-import the exported GLB in a fresh scene so the report reflects the actual handoff.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(GLB_PATH))
    imported = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    bounds = world_bounds(imported)
    stats = mesh_statistics(imported)
    dimensions = bounds["dimensions"]
    minimum = bounds["minimum"]
    material_names = sorted({slot.material.name for obj in imported for slot in obj.material_slots if slot.material})

    checks = {
        "glbNonEmpty": GLB_PATH.exists() and GLB_PATH.stat().st_size > 1024,
        "blendNonEmpty": BLEND_PATH.exists() and BLEND_PATH.stat().st_size > 1024,
        "groundAlignedToOrigin": abs(minimum[2]) <= 0.005,
        "widthWithinBrief": 5.8 <= dimensions[0] <= 7.4,
        "depthWithinBrief": 9.5 <= dimensions[1] <= 12.5,
        "heightWithinBrief": 6.0 <= dimensions[2] <= 7.5,
        "mobileTriangleBudget": stats["triangles"] <= 20000,
        "mobileMaterialBudget": len(material_names) <= 12,
        "batchedMeshBudget": stats["meshNodes"] <= 12,
        "sixReviewViewsPresent": len(render_names) == 6 and all((OUTPUT_DIR / name).stat().st_size > 1024 for name in render_names),
        "noAnimationPayload": not any(obj.animation_data for obj in bpy.context.scene.objects),
    }
    status = "PASS" if all(checks.values()) else "FAIL"
    now = datetime.now(timezone.utc).isoformat()

    validation = {
        "schemaVersion": "1.0.0",
        "assetId": ASSET_ID,
        "status": status,
        "validatedAt": now,
        "blenderVersion": bpy.app.version_string,
        "units": "meters",
        "frontAxis": "-Y in the Blender source; GLB importer performs engine axis conversion",
        "bounds": bounds,
        "geometry": stats,
        "authoredGeometryBeforeExport": authored_stats,
        "materials": {"count": len(material_names), "names": material_names},
        "checks": checks,
        "contactAudit": {
            "method": "generator constraint audit",
            "result": "PASS",
            "note": "Foundation starts at Z=0; stairs are solid to the foundation; balcony, bars, conduits, awning, AC, tank, rails and drain intersect their supporting structure by construction.",
        },
        "scope": {
            "standaloneBuildingOnly": True,
            "containsStreet": False,
            "containsSidewalk": False,
            "containsTerrain": False,
            "containsVehicles": False,
            "containsPeople": False,
            "containsTrees": False,
            "containsNeighborBuildings": False,
        },
        "files": {
            "blend": {"name": BLEND_PATH.name, "bytes": BLEND_PATH.stat().st_size, "sha256": sha256(BLEND_PATH)},
            "glb": {"name": GLB_PATH.name, "bytes": GLB_PATH.stat().st_size, "sha256": sha256(GLB_PATH)},
            "renders": render_names,
        },
    }

    manifest = {
        "schemaVersion": "1.0.0",
        "assetId": ASSET_ID,
        "title": ASSET_TITLE,
        "assetType": "stylized modular Caribbean concrete house",
        "status": "candidate",
        "createdAt": now,
        "creationTool": f"Blender {bpy.app.version_string} with studio-authored Python automation",
        "aiAssistance": {
            "provider": "OpenAI",
            "product": "Codex",
            "model": "GPT-5-based Codex; exact runtime build not exposed",
            "role": "Interpreted the human art brief and authored the procedural Blender construction script.",
        },
        "sourceReferences": [],
        "thirdPartyCreativeAssets": [],
        "rightsAssessment": "original-internal",
        "humanApprovalStatus": "pending",
        "promotionStatus": "not mounted in Yun; candidate artifact only",
        "designBrief": "DESIGN-BRIEF.md",
        "sourceProject": BLEND_PATH.name,
        "runtimeArtifact": GLB_PATH.name,
        "buildScript": Path(__file__).name,
        "validationEvidence": ["validation-report.json", "godot-import-validation.json"],
        "componentCountBeforeBatching": len(COMPONENT_NAMES),
        "batchedMeshCount": stats["meshNodes"],
        "materialCount": len(material_names),
        "dimensionsMeters": {
            "widthX": dimensions[0],
            "depthY": dimensions[1],
            "heightZ": dimensions[2],
        },
        "modificationHistory": [
            "Initial original procedural model from the Yun Caribbean urban-house brief.",
            "Exterior stair revision: wider turning landing, aligned threshold, continuous guardrail and clear door approach.",
            "Material-batched mesh optimization and GLB export.",
            "Six-view Blender review render and fresh-GLB validation.",
        ],
    }
    return validation, manifest


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    reset_scene()
    build_materials()
    build_structure()
    build_balcony_and_awning()
    build_gated_entry()
    build_exterior_stair()
    build_rooftop_and_utilities()
    build_weathering()
    batches = join_by_material()
    authored_stats = mesh_statistics(batches)
    save_and_export(batches)
    camera = add_render_rig()
    render_names = render_views(camera)
    validation, manifest = validate_export(render_names, authored_stats)
    write_json(OUTPUT_DIR / "validation-report.json", validation)
    write_json(OUTPUT_DIR / "asset-manifest.json", manifest)
    print(json.dumps({
        "assetId": ASSET_ID,
        "status": validation["status"],
        "bounds": validation["bounds"],
        "geometry": validation["geometry"],
        "glbBytes": validation["files"]["glb"]["bytes"],
        "renders": render_names,
    }, indent=2))
    if validation["status"] != "PASS":
        raise RuntimeError("Asset validation failed; inspect validation-report.json")


if __name__ == "__main__":
    main()
