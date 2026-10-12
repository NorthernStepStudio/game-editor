import json
from pathlib import Path

import bpy
from mathutils import Vector


OUTPUT = Path(r"D:\dev\Northern Step Studio\artifacts\environment\dominican\yun_vehicle_family_v1\v02-bounds.json")


def collection_bounds(collection):
    points = []
    for obj in collection.all_objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        return None
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    center = (minimum + maximum) * 0.5
    size = maximum - minimum
    return {
        "minimum": list(minimum),
        "maximum": list(maximum),
        "center": list(center),
        "size": list(size),
    }


result = {
    collection.name: collection_bounds(collection)
    for collection in bpy.data.collections
    if collection.name.startswith("EXPORT_Vehicle_")
}
OUTPUT.write_text(json.dumps(result, indent=2), encoding="utf-8")
