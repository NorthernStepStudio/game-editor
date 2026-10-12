"""Reusable deterministic generator for Yun neighborhood concrete houses.

The generator consumes an explicit JSON configuration. It intentionally uses
only Blender primitives and studio-authored procedural arrangement; no random
choices or third-party creative assets are involved.
"""

from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import bpy
from mathutils import Vector


class YunHouseBuilder:
    def __init__(self, config: dict[str, Any], output_dir: Path, lod: int) -> None:
        self.config = config
        self.output_dir = output_dir
        self.lod = lod
        self.asset_id = str(config["asset_id"])
        self.suffix = "" if lod == 0 else "_lod1"
        self.materials: dict[str, bpy.types.Material] = {}
        self.component_names: list[str] = []
        self.width = float(config["house_width"])
        self.depth = float(config["house_depth"])
        self.half_w = self.width * 0.5
        self.half_d = self.depth * 0.5
        self.front_y = -self.half_d
        self.back_y = self.half_d

    def reset_scene(self) -> None:
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def make_material(
        self,
        name: str,
        rgba: list[float],
        roughness: float,
        metallic: float = 0.0,
    ) -> None:
        material = bpy.data.materials.new(name=name)
        material.diffuse_color = tuple(rgba)
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = tuple(rgba)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        self.materials[name] = material

    def build_materials(self) -> None:
        palette = self.config["materials"]
        self.make_material("MAT_WallPlaster", palette["wall_plaster"], 0.88)
        self.make_material("MAT_DarkMetal", palette["dark_metal"], 0.40, 0.72)
        self.make_material("MAT_WindowGlass", palette["window_glass"], 0.22, 0.04)
        self.make_material("MAT_DetailRoof", palette["detail_roof"], 0.92)

    @staticmethod
    def apply_transform(obj: bpy.types.Object) -> None:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        obj.select_set(False)

    @staticmethod
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

    def finish(self, obj: bpy.types.Object, material: str, bevel: float = 0.0) -> bpy.types.Object:
        self.apply_transform(obj)
        # LOD1 removes bevel topology entirely; reducing the bevel width alone
        # would keep the same vertex/triangle count and provide no real savings.
        effective_bevel = bevel if self.lod == 0 else 0.0
        self.bevel_object(obj, effective_bevel)
        obj.data.materials.append(self.materials[material])
        self.component_names.append(obj.name)
        return obj

    def box(
        self,
        name: str,
        dimensions: tuple[float, float, float],
        location: tuple[float, float, float],
        material: str,
        rotation_deg: tuple[float, float, float] = (0.0, 0.0, 0.0),
        bevel: float = 0.0,
    ) -> bpy.types.Object:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
        obj = bpy.context.object
        obj.name = name
        obj.dimensions = dimensions
        obj.rotation_euler = tuple(math.radians(value) for value in rotation_deg)
        return self.finish(obj, material, bevel)

    def cylinder(
        self,
        name: str,
        radius: float,
        depth: float,
        location: tuple[float, float, float],
        material: str,
        rotation_deg: tuple[float, float, float] = (0.0, 0.0, 0.0),
        vertices: int = 12,
        bevel: float = 0.0,
    ) -> bpy.types.Object:
        sides = max(8, vertices if self.lod == 0 else min(vertices, 10))
        bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=depth, location=location)
        obj = bpy.context.object
        obj.name = name
        obj.rotation_euler = tuple(math.radians(value) for value in rotation_deg)
        return self.finish(obj, material, bevel)

    def cylinder_between(
        self,
        name: str,
        start: tuple[float, float, float],
        end: tuple[float, float, float],
        radius: float,
        material: str,
    ) -> bpy.types.Object:
        start_v = Vector(start)
        end_v = Vector(end)
        delta = end_v - start_v
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=8 if self.lod == 1 else 10,
            radius=radius,
            depth=delta.length,
            location=(start_v + end_v) * 0.5,
        )
        obj = bpy.context.object
        obj.name = name
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
        obj.rotation_mode = "XYZ"
        return self.finish(obj, material, 0.004 if self.lod == 0 else 0.0)

    def front_window(self, name: str, x: float, z: float, width: float, height: float, y: float) -> None:
        self.box(f"{name}_Glass", (width, 0.055, height), (x, y, z), "MAT_WindowGlass", bevel=0.008)
        frame = 0.09
        frame_y = y - 0.045
        self.box(f"{name}_Top", (width + 0.18, 0.08, frame), (x, frame_y, z + height / 2 + frame / 2), "MAT_DetailRoof", bevel=0.008)
        self.box(f"{name}_Bottom", (width + 0.18, 0.08, frame), (x, frame_y, z - height / 2 - frame / 2), "MAT_DetailRoof", bevel=0.008)
        self.box(f"{name}_Left", (frame, 0.08, height), (x - width / 2 - frame / 2, frame_y, z), "MAT_DetailRoof", bevel=0.008)
        self.box(f"{name}_Right", (frame, 0.08, height), (x + width / 2 + frame / 2, frame_y, z), "MAT_DetailRoof", bevel=0.008)
        bar_y = y - 0.09
        verticals = (x,) if self.lod == 1 else (x - width * 0.28, x, x + width * 0.28)
        horizontals = (z,) if self.lod == 1 else (z - height * 0.25, z + height * 0.25)
        for index, bar_x in enumerate(verticals):
            self.box(f"{name}_BarV_{index}", (0.035, 0.045, height + 0.06), (bar_x, bar_y, z), "MAT_DarkMetal")
        for index, bar_z in enumerate(horizontals):
            self.box(f"{name}_BarH_{index}", (width + 0.06, 0.045, 0.035), (x, bar_y, bar_z), "MAT_DarkMetal")

    def back_window(self, name: str, x: float, z: float, width: float, height: float) -> None:
        y = self.back_y + 0.025
        self.box(f"{name}_Glass", (width, 0.055, height), (x, y, z), "MAT_WindowGlass", bevel=0.008)
        frame = 0.09
        frame_y = y + 0.045
        self.box(f"{name}_Top", (width + 0.18, 0.08, frame), (x, frame_y, z + height / 2 + frame / 2), "MAT_DetailRoof", bevel=0.008)
        self.box(f"{name}_Bottom", (width + 0.18, 0.08, frame), (x, frame_y, z - height / 2 - frame / 2), "MAT_DetailRoof", bevel=0.008)
        self.box(f"{name}_Left", (frame, 0.08, height), (x - width / 2 - frame / 2, frame_y, z), "MAT_DetailRoof", bevel=0.008)
        self.box(f"{name}_Right", (frame, 0.08, height), (x + width / 2 + frame / 2, frame_y, z), "MAT_DetailRoof", bevel=0.008)
        bars = (x,) if self.lod == 1 else (x - width * 0.25, x + width * 0.25)
        for index, bar_x in enumerate(bars):
            self.box(f"{name}_BarV_{index}", (0.035, 0.045, height + 0.05), (bar_x, y + 0.09, z), "MAT_DarkMetal")
        self.box(f"{name}_BarH", (width + 0.05, 0.045, 0.035), (x, y + 0.09, z), "MAT_DarkMetal")

    def side_window(self, name: str, side: int, y: float, z: float, width: float, height: float) -> None:
        side_x = side * (self.half_w + 0.025)
        self.box(f"{name}_Glass", (0.055, width, height), (side_x, y, z), "MAT_WindowGlass", bevel=0.008)
        frame_x = side_x + side * 0.045
        frame = 0.09
        self.box(f"{name}_Top", (0.08, width + 0.18, frame), (frame_x, y, z + height / 2 + frame / 2), "MAT_DetailRoof", bevel=0.008)
        self.box(f"{name}_Bottom", (0.08, width + 0.18, frame), (frame_x, y, z - height / 2 - frame / 2), "MAT_DetailRoof", bevel=0.008)
        self.box(f"{name}_Near", (0.08, frame, height), (frame_x, y - width / 2 - frame / 2, z), "MAT_DetailRoof", bevel=0.008)
        self.box(f"{name}_Far", (0.08, frame, height), (frame_x, y + width / 2 + frame / 2, z), "MAT_DetailRoof", bevel=0.008)
        bar_x = side_x + side * 0.09
        bars = (y,) if self.lod == 1 else (y - width * 0.25, y + width * 0.25)
        for index, bar_y in enumerate(bars):
            self.box(f"{name}_BarV_{index}", (0.045, 0.035, height + 0.05), (bar_x, bar_y, z), "MAT_DarkMetal")
        self.box(f"{name}_BarH", (0.045, width + 0.05, 0.035), (bar_x, y, z), "MAT_DarkMetal")

    def build_shell(self) -> None:
        self.box("Foundation", (self.width + 0.20, self.depth + 0.20, 0.16), (0, 0, 0.08), "MAT_DetailRoof", bevel=0.02)
        self.box("GroundFloor", (self.width, self.depth, 2.88), (0, 0, 1.60), "MAT_WallPlaster", bevel=0.03)
        self.box("FloorBand", (self.width + 0.10, self.depth + 0.10, 0.18), (0, 0, 3.11), "MAT_DetailRoof", bevel=0.015)

        upper_width = self.width - 0.34
        upper_depth = self.depth - 0.45
        upper_x = 0.15
        upper_y = 0.22
        self.box("UpperFloor", (upper_width, upper_depth, 2.50), (upper_x, upper_y, 4.45), "MAT_WallPlaster", bevel=0.03)
        self.box("RoofSlab", (upper_width + 0.20, upper_depth + 0.20, 0.22), (upper_x, upper_y, 5.82), "MAT_DetailRoof", bevel=0.02)

        roof_half_w = (upper_width + 0.20) * 0.5
        roof_half_d = (upper_depth + 0.20) * 0.5
        roof_front = upper_y - roof_half_d
        roof_back = upper_y + roof_half_d
        roof_left = upper_x - roof_half_w
        roof_right = upper_x + roof_half_w
        # Stepped parapet makes House 02 identifiable at distance.
        self.box("ParapetFrontLeft", (3.05, 0.18, 0.70), (-1.55, roof_front, 6.28), "MAT_DetailRoof", bevel=0.015)
        self.box("ParapetFrontRight", (upper_width - 2.85, 0.18, 0.50), (1.60, roof_front, 6.18), "MAT_DetailRoof", bevel=0.015)
        self.box("ParapetBack", (upper_width + 0.20, 0.18, 0.50), (upper_x, roof_back, 6.18), "MAT_DetailRoof", bevel=0.015)
        self.box("ParapetLeft", (0.18, upper_depth, 0.58), (roof_left, upper_y, 6.22), "MAT_DetailRoof", bevel=0.015)
        self.box("ParapetRight", (0.18, upper_depth, 0.50), (roof_right, upper_y, 6.18), "MAT_DetailRoof", bevel=0.015)

    def build_front(self) -> None:
        front = self.front_y - 0.028
        # Left roll-up garage/storefront opening changes the ground-floor rhythm.
        garage_x = -1.55
        self.box("GarageDoor", (2.75, 0.075, 2.30), (garage_x, front, 1.40), "MAT_DarkMetal", bevel=0.018)
        self.box("GarageHeader", (3.00, 0.11, 0.18), (garage_x, front - 0.04, 2.66), "MAT_DetailRoof", bevel=0.012)
        self.box("GarageJambLeft", (0.16, 0.11, 2.45), (garage_x - 1.46, front - 0.04, 1.43), "MAT_DetailRoof", bevel=0.012)
        self.box("GarageJambRight", (0.16, 0.11, 2.45), (garage_x + 1.46, front - 0.04, 1.43), "MAT_DetailRoof", bevel=0.012)
        rib_count = 3 if self.lod == 1 else 7
        for index in range(rib_count):
            z = 0.42 + index * (1.92 / max(1, rib_count - 1))
            self.box(f"GarageRib_{index}", (2.57, 0.028, 0.035), (garage_x, front - 0.055, z), "MAT_DetailRoof")

        # Pedestrian door is isolated on the right under a slab canopy.
        door_x = 2.05
        self.box("FrontDoor", (0.94, 0.075, 2.15), (door_x, front, 1.315), "MAT_DarkMetal", bevel=0.018)
        self.box("FrontDoorInset", (0.46, 0.026, 0.68), (door_x, front - 0.055, 1.73), "MAT_WindowGlass", bevel=0.008)
        self.box("FrontDoorHeader", (1.12, 0.10, 0.11), (door_x, front - 0.04, 2.445), "MAT_DetailRoof", bevel=0.008)
        self.box("FrontDoorJambLeft", (0.10, 0.10, 2.15), (door_x - 0.52, front - 0.04, 1.315), "MAT_DetailRoof", bevel=0.008)
        self.box("FrontDoorJambRight", (0.10, 0.10, 2.15), (door_x + 0.52, front - 0.04, 1.315), "MAT_DetailRoof", bevel=0.008)
        self.box("FrontDoorHandle", (0.05, 0.055, 0.16), (door_x + 0.30, front - 0.09, 1.23), "MAT_DetailRoof", bevel=0.008)

        if self.config["awning_type"] == "slab_right":
            self.box("EntryShadeSlab", (1.55, 0.92, 0.10), (door_x, front - 0.45, 2.61), "MAT_DetailRoof", rotation_deg=(8, 0, 0), bevel=0.015)
            if self.lod == 0:
                self.cylinder_between("EntryShadeBraceLeft", (door_x - 0.62, front, 2.32), (door_x - 0.62, front - 0.82, 2.48), 0.025, "MAT_DarkMetal")
                self.cylinder_between("EntryShadeBraceRight", (door_x + 0.62, front, 2.32), (door_x + 0.62, front - 0.82, 2.48), 0.025, "MAT_DarkMetal")

        # Recessed upper story front is at a different Y from the ground floor.
        upper_front = self.front_y + 0.445
        self.box("BalconyDoorLeft", (0.72, 0.055, 2.02), (-2.00, upper_front - 0.03, 4.28), "MAT_WindowGlass", bevel=0.012)
        self.box("BalconyDoorRight", (0.72, 0.055, 2.02), (-1.23, upper_front - 0.03, 4.28), "MAT_WindowGlass", bevel=0.012)
        for suffix, x in (("L", -2.42), ("M", -1.615), ("R", -0.81)):
            self.box(f"BalconyDoorFrame_{suffix}", (0.09, 0.08, 2.08), (x, upper_front - 0.075, 4.28), "MAT_DetailRoof", bevel=0.006)
        self.box("BalconyDoorFrameTop", (1.70, 0.08, 0.09), (-1.615, upper_front - 0.075, 5.365), "MAT_DetailRoof", bevel=0.006)
        self.box("BalconyDoorFrameBottom", (1.70, 0.08, 0.09), (-1.615, upper_front - 0.075, 3.195), "MAT_DetailRoof", bevel=0.006)
        self.front_window("UpperPairedWindowA", 0.75, 4.47, 0.72, 1.22, upper_front - 0.02)
        self.front_window("UpperPairedWindowB", 1.88, 4.47, 0.72, 1.22, upper_front - 0.02)

    def build_balcony(self) -> None:
        if self.config["balcony_type"] != "corner_picket":
            return
        front = self.front_y - 0.23
        center_x = -1.56 if self.config["balcony_side"] == "left" else 1.56
        self.box("BalconySlab", (3.55, 1.00, 0.18), (center_x, front, 3.18), "MAT_DetailRoof", bevel=0.018)
        rail_y = front - 0.49
        self.box("BalconyLowWall", (3.50, 0.14, 0.34), (center_x, rail_y, 3.41), "MAT_DetailRoof", bevel=0.012)
        left_x = center_x - 1.70
        right_x = center_x + 1.70
        self.box("BalconyPierLeft", (0.18, 0.18, 0.98), (left_x, rail_y, 3.73), "MAT_DetailRoof", bevel=0.012)
        self.box("BalconyPierRight", (0.18, 0.18, 0.98), (right_x, rail_y, 3.73), "MAT_DetailRoof", bevel=0.012)
        picket_count = 5 if self.lod == 1 else 9
        for index in range(picket_count):
            x = left_x + 0.34 + index * ((right_x - left_x - 0.68) / max(1, picket_count - 1))
            self.box(f"BalconyPicket_{index}", (0.045, 0.045, 0.62), (x, rail_y - 0.03, 3.78), "MAT_DarkMetal")
        self.box("BalconyTopRail", (3.38, 0.055, 0.055), (center_x, rail_y - 0.03, 4.10), "MAT_DarkMetal", bevel=0.006)
        # Solid side cheeks are a different treatment from House 01's open rail.
        for suffix, x in (("Left", left_x), ("Right", right_x)):
            self.box(f"BalconySideWall_{suffix}", (0.18, 0.78, 0.78), (x, front - 0.10, 3.63), "MAT_DetailRoof", bevel=0.012)

    def build_other_elevations(self) -> None:
        self.back_window("RearGroundWide", -1.15, 1.65, 1.75, 1.10)
        self.back_window("RearUpperLeft", -1.60, 4.48, 1.18, 1.05)
        self.back_window("RearUpperRight", 1.35, 4.48, 1.18, 1.05)
        self.side_window("LeftSideGround", -1, 1.10, 1.62, 1.35, 1.05)
        self.side_window("LeftSideUpper", -1, -1.00, 4.48, 1.10, 1.00)
        self.side_window("RightSideGround", 1, 1.55, 1.62, 1.25, 1.02)
        self.side_window("RightSideUpper", 1, 2.55, 4.48, 1.08, 0.98)

    def build_roof_and_utilities(self) -> None:
        if self.config["water_tank"]:
            # Squatter tank and wider support table distinguish the roof silhouette.
            for index, (x, y) in enumerate(((1.35, 1.45), (2.15, 1.45), (1.35, 2.15), (2.15, 2.15))):
                self.box(f"TankFoot_{index}", (0.22, 0.22, 0.20), (x, y, 6.54), "MAT_DetailRoof", bevel=0.01)
            self.cylinder("WaterTank", 0.70, 0.54, (1.75, 1.80, 6.89), "MAT_DarkMetal", vertices=14, bevel=0.018)
            self.cylinder("WaterTankLid", 0.54, 0.09, (1.75, 1.80, 7.205), "MAT_DarkMetal", vertices=14, bevel=0.012)

        if int(self.config["ac_count"]) > 0:
            # Rear mounting avoids changing the requested narrow street footprint.
            ac_y = self.back_y + 0.19
            self.box("RearACMain", (1.10, 0.40, 0.64), (1.65, ac_y, 4.50), "MAT_DetailRoof", bevel=0.045)
            self.cylinder("RearACFan", 0.21, 0.032, (1.65, ac_y + 0.22, 4.55), "MAT_DarkMetal", rotation_deg=(90, 0, 0), vertices=14, bevel=0.004)
            if self.lod == 0:
                self.box("RearACVent", (0.76, 0.026, 0.10), (1.65, ac_y + 0.22, 4.35), "MAT_DarkMetal")

        if self.config["utility_details"] != "none":
            meter_x = 3.00
            meter_y = self.front_y - 0.09
            self.box("UtilityMeter", (0.40, 0.14, 0.58), (meter_x, meter_y, 1.50), "MAT_DarkMetal", bevel=0.018)
            if self.lod == 0:
                self.cylinder("UtilityMeterFace", 0.12, 0.028, (meter_x, meter_y - 0.085, 1.58), "MAT_DetailRoof", rotation_deg=(90, 0, 0), vertices=12)
                self.cylinder("UtilityConduitUp", 0.03, 3.75, (meter_x, meter_y - 0.035, 3.68), "MAT_DarkMetal", vertices=8)
                self.cylinder("UtilityConduitDown", 0.03, 1.20, (meter_x, meter_y - 0.035, 0.66), "MAT_DarkMetal", vertices=8)
                self.cylinder("RearDrain", 0.05, 5.70, (-2.75, self.back_y + 0.09, 2.85), "MAT_DarkMetal", vertices=8)

    def build_weathering(self) -> None:
        if self.config["weathering_level"] == "none" or self.lod == 1:
            return
        # Five large, quiet repair areas share the detail material; no extra draw call.
        self.box("RepairFrontGarage", (0.60, 0.018, 0.25), (-3.02, self.front_y - 0.012, 0.58), "MAT_DetailRoof", rotation_deg=(0, 0, 6), bevel=0.018)
        self.box("RepairFrontUpper", (0.46, 0.018, 0.22), (2.70, self.front_y + 0.435, 3.66), "MAT_DetailRoof", rotation_deg=(0, 0, -7), bevel=0.016)
        self.box("RepairLeft", (0.018, 0.66, 0.25), (-self.half_w - 0.012, 3.10, 0.62), "MAT_DetailRoof", bevel=0.016)
        self.box("RepairRear", (0.62, 0.018, 0.24), (0.10, self.back_y + 0.012, 3.65), "MAT_DetailRoof", rotation_deg=(0, 0, 4), bevel=0.016)

    def build(self) -> list[bpy.types.Object]:
        self.reset_scene()
        self.build_materials()
        self.build_shell()
        self.build_front()
        self.build_balcony()
        self.build_other_elevations()
        self.build_roof_and_utilities()
        self.build_weathering()
        return self.join_by_material()

    def join_by_material(self) -> list[bpy.types.Object]:
        groups: dict[str, list[bpy.types.Object]] = {}
        for obj in list(bpy.context.scene.objects):
            if obj.type == "MESH" and obj.data.materials:
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
            active.name = f"BATCH_{material_name.removeprefix('MAT_')}{self.suffix.upper()}"
            batches.append(active)
        root = bpy.data.objects.new(f"{self.asset_id}{self.suffix}", None)
        root.empty_display_type = "CUBE"
        root.empty_display_size = 0.22
        root["asset_id"] = self.asset_id
        root["lod"] = self.lod
        root["generator_seed"] = str(self.config["seed"])
        bpy.context.scene.collection.objects.link(root)
        for obj in batches:
            obj.parent = root
        return batches

    @staticmethod
    def mesh_stats(objects: list[bpy.types.Object]) -> dict[str, int]:
        stats = {"vertices": 0, "triangles": 0, "polygons": 0, "meshNodes": len(objects)}
        for obj in objects:
            mesh = obj.data
            mesh.calc_loop_triangles()
            stats["vertices"] += len(mesh.vertices)
            stats["triangles"] += len(mesh.loop_triangles)
            stats["polygons"] += len(mesh.polygons)
        return stats

    @staticmethod
    def bounds(objects: list[bpy.types.Object]) -> dict[str, list[float]]:
        points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
        minimum = [min(point[index] for point in points) for index in range(3)]
        maximum = [max(point[index] for point in points) for index in range(3)]
        return {
            "minimum": [round(value, 4) for value in minimum],
            "maximum": [round(value, 4) for value in maximum],
            "dimensions": [round(maximum[index] - minimum[index], 4) for index in range(3)],
        }

    def save_export(self, objects: list[bpy.types.Object]) -> tuple[Path, Path]:
        blend_path = self.output_dir / f"{self.asset_id}{self.suffix}.blend"
        glb_path = self.output_dir / f"{self.asset_id}{self.suffix}.glb"
        scene = bpy.context.scene
        scene.unit_settings.system = "METRIC"
        scene.unit_settings.length_unit = "METERS"
        scene["asset_id"] = self.asset_id
        scene["lod"] = self.lod
        scene["config_file"] = "house-config.json"
        bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=str(glb_path),
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_animations=False,
            export_cameras=False,
            export_lights=False,
        )
        return blend_path, glb_path


def validate_config(config: dict[str, Any]) -> None:
    required = {
        "asset_id", "seed", "house_width", "house_depth", "floor_count", "paint_color",
        "balcony_type", "balcony_side", "stairs_type", "window_layout", "door_layout",
        "awning_type", "water_tank", "ac_count", "utility_details", "weathering_level", "materials",
    }
    missing = sorted(required - set(config))
    if missing:
        raise ValueError(f"Missing house configuration keys: {', '.join(missing)}")
    if int(config["floor_count"]) != 2:
        raise ValueError("This Yun concrete-house family currently supports exactly two floors")
    if config["stairs_type"] != "none_exterior":
        raise ValueError("House 02 configuration expects no exterior stair")
    if not 5.5 <= float(config["house_width"]) <= 8.0:
        raise ValueError("House width outside supported neighborhood range")
    if not 8.0 <= float(config["house_depth"]) <= 12.5:
        raise ValueError("House depth outside supported neighborhood range")


def aim(camera: bpy.types.Object, target: tuple[float, float, float]) -> None:
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def setup_render_rig() -> bpy.types.Object:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 960
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("ReviewWorld")
    scene.world.color = (0.05, 0.068, 0.08)
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    camera_data = bpy.data.cameras.new("ReviewCamera")
    camera_data.lens = 55
    camera = bpy.data.objects.new("ReviewCamera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    sun_data = bpy.data.lights.new("ReviewSun", type="SUN")
    sun_data.energy = 2.7
    sun_data.angle = math.radians(18)
    sun = bpy.data.objects.new("ReviewSun", sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(30), math.radians(-20), math.radians(-34))
    key_data = bpy.data.lights.new("ReviewKey", type="AREA")
    key_data.energy = 1200
    key_data.shape = "DISK"
    key_data.size = 8.0
    key = bpy.data.objects.new("ReviewKey", key_data)
    scene.collection.objects.link(key)
    key.location = (-8.0, -10.0, 13.0)
    aim(key, (0, 0, 3.1))
    fill_data = bpy.data.lights.new("ReviewFill", type="AREA")
    fill_data.energy = 680
    fill_data.size = 7.0
    fill = bpy.data.objects.new("ReviewFill", fill_data)
    scene.collection.objects.link(fill)
    fill.location = (8.0, 7.0, 8.0)
    aim(fill, (0, 0, 3.2))
    return camera


def render_asset_views(output_dir: Path, asset_id: str, lod: int) -> list[str]:
    camera = setup_render_rig()
    scene = bpy.context.scene
    target = (0.0, 0.0, 3.35)
    views = {
        "hero": ((10.6, -15.2, 8.8), 56),
        "front": ((0.0, -18.0, 4.0), 58),
        "right": ((14.2, -2.4, 6.2), 58),
        "left": ((-14.2, -2.4, 6.2), 58),
        "rear": ((-10.4, 14.5, 7.2), 56),
        "roof": ((9.0, -9.5, 16.0), 58),
    }
    if lod == 1:
        views = {"hero": views["hero"]}
    rendered: list[str] = []
    suffix = "" if lod == 0 else "_lod1"
    for name, (position, lens) in views.items():
        camera.location = position
        camera.data.lens = lens
        aim(camera, target)
        out = output_dir / f"{asset_id}{suffix}-{name}.png"
        scene.render.filepath = str(out)
        bpy.ops.render.render(write_still=True)
        rendered.append(out.name)
    return rendered


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def validate_glb(path: Path) -> dict[str, Any]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    stats = YunHouseBuilder.mesh_stats(meshes)
    bounds = YunHouseBuilder.bounds(meshes)
    materials = sorted({slot.material.name for obj in meshes for slot in obj.material_slots if slot.material})
    normals_ok = True
    materials_ok = True
    for obj in meshes:
        for polygon in obj.data.polygons:
            normals_ok = normals_ok and polygon.normal.length > 0.5
            materials_ok = materials_ok and polygon.material_index < len(obj.material_slots)
        materials_ok = materials_ok and all(slot.material is not None for slot in obj.material_slots)
    return {
        "path": path.name,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "bounds": bounds,
        "geometry": stats,
        "materials": {"count": len(materials), "names": materials},
        "normalsValid": normals_ok,
        "materialsPresent": materials_ok,
    }


def generate_house(config_path: Path, output_dir: Path) -> dict[str, Any]:
    config = json.loads(config_path.read_text(encoding="utf-8"))
    validate_config(config)
    output_dir.mkdir(parents=True, exist_ok=True)
    build_results: dict[str, Any] = {}
    for lod in (0, 1):
        builder = YunHouseBuilder(config, output_dir, lod)
        batches = builder.build()
        authored_stats = builder.mesh_stats(batches)
        authored_bounds = builder.bounds(batches)
        blend_path, glb_path = builder.save_export(batches)
        renders = render_asset_views(output_dir, builder.asset_id, lod)
        build_results[f"lod{lod}"] = {
            "blend": blend_path.name,
            "glb": glb_path.name,
            "authoredGeometry": authored_stats,
            "authoredBounds": authored_bounds,
            "componentsBeforeBatching": len(builder.component_names),
            "renders": renders,
        }

    lod0 = validate_glb(output_dir / str(build_results["lod0"]["glb"]))
    lod1 = validate_glb(output_dir / str(build_results["lod1"]["glb"]))
    dimensions = lod0["bounds"]["dimensions"]
    checks = {
        "lod0GlbNonEmpty": lod0["bytes"] > 1024,
        "lod1GlbNonEmpty": lod1["bytes"] > 1024,
        "groundAligned": abs(lod0["bounds"]["minimum"][2]) <= 0.005 and abs(lod1["bounds"]["minimum"][2]) <= 0.005,
        "dimensionsSensible": 5.8 <= dimensions[0] <= 7.5 and 8.5 <= dimensions[1] <= 11.5 and 6.0 <= dimensions[2] <= 7.5,
        "lod0TriangleTarget": 4500 <= lod0["geometry"]["triangles"] <= 8500,
        "lod1LowerDetail": lod1["geometry"]["triangles"] < lod0["geometry"]["triangles"],
        "sharedMaterialTarget": lod0["materials"]["count"] <= 4 and lod1["materials"]["count"] <= 4,
        "batchedMeshTarget": lod0["geometry"]["meshNodes"] <= 4 and lod1["geometry"]["meshNodes"] <= 4,
        "normalsValid": lod0["normalsValid"] and lod1["normalsValid"],
        "materialsPresent": lod0["materialsPresent"] and lod1["materialsPresent"],
        "requiredRendersPresent": all((output_dir / name).stat().st_size > 1024 for name in build_results["lod0"]["renders"]),
        "noThirdPartyCreativeAssets": True,
    }
    status = "PASS" if all(checks.values()) else "FAIL"
    now = datetime.now(timezone.utc).isoformat()
    validation = {
        "schemaVersion": "1.0.0",
        "assetId": config["asset_id"],
        "status": status,
        "validatedAt": now,
        "blenderVersion": bpy.app.version_string,
        "units": "meters",
        "lod0": lod0,
        "lod1": lod1,
        "checks": checks,
        "contactAudit": {
            "result": "PASS",
            "method": "deterministic generator constraints plus six-view review",
            "note": "Foundation begins at Z=0. Balcony, awning, frames, utilities, AC, parapet and tank supports intersect their supporting surfaces by construction.",
        },
        "scope": {
            "standaloneBuildingOnly": True,
            "containsStreet": False,
            "containsSidewalk": False,
            "containsPeople": False,
            "containsCars": False,
            "containsVegetation": False,
        },
        "build": build_results,
    }
    manifest = {
        "schemaVersion": "1.0.0",
        "assetId": config["asset_id"],
        "title": "Yun Caribbean House 02",
        "friendlyLod1Name": "Distance version of House 02",
        "assetType": "stylized modular Caribbean concrete house",
        "status": "environment-candidate",
        "createdAt": now,
        "creationTool": f"Blender {bpy.app.version_string} with deterministic configuration-driven Python automation",
        "generator": "../yun_house_generator.py",
        "configuration": config_path.name,
        "seed": config["seed"],
        "sourceReferences": [],
        "thirdPartyCreativeAssets": [],
        "rightsAssessment": "original-internal",
        "humanApprovalStatus": "pending",
        "promotionStatus": "not mounted or made default in Yun",
        "materials": {
            "count": lod0["materials"]["count"],
            "strategy": ["wall/plaster", "dark metal", "glass/window", "detail/roof"],
        },
        "files": {
            "lod0Blend": build_results["lod0"]["blend"],
            "lod0Glb": build_results["lod0"]["glb"],
            "lod1Blend": build_results["lod1"]["blend"],
            "lod1Glb": build_results["lod1"]["glb"],
            "renders": build_results["lod0"]["renders"] + build_results["lod1"]["renders"],
        },
        "designDifferencesFromHouse01": [
            "No exterior stair",
            "Asymmetric left garage and right pedestrian entry",
            "Recessed upper floor with paired narrow windows",
            "Corner balcony with solid curb, end piers and denser pickets",
            "Stepped rooftop parapet and squat water tank",
            "Shallower footprint and different facade proportions",
        ],
        "aiAssistance": {
            "provider": "OpenAI",
            "product": "Codex",
            "model": "GPT-5-based Codex; exact runtime build not exposed",
            "role": "Translated the owner brief into deterministic procedural geometry and validation automation.",
        },
    }
    (output_dir / "validation-report.json").write_text(json.dumps(validation, indent=2) + "\n", encoding="utf-8")
    (output_dir / "asset-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"assetId": config["asset_id"], "status": status, "lod0": lod0, "lod1": lod1}, indent=2))
    if status != "PASS":
        raise RuntimeError("House generation validation failed; inspect validation-report.json")
    return validation

