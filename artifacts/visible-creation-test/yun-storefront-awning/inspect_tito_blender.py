import json
from pathlib import Path

import bpy
from mathutils import Vector


output = Path(r"D:\dev\Northern Step Studio\artifacts\visible-creation-test\yun-storefront-awning\tito-blender-inspection.json")
collection = bpy.data.collections.get("REFERENCE_CurrentTito")
rows = []
if collection:
    for obj in collection.all_objects:
        if obj.type != "MESH":
            continue
        points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
        maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
        rows.append(
            {
                "name": obj.name,
                "parent": obj.parent.name if obj.parent else None,
                "location": list(obj.location),
                "scale": list(obj.scale),
                "worldDimensions": list(maximum - minimum),
                "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
                "visibleRender": not obj.hide_render,
            }
        )
output.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
