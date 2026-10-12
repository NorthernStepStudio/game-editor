from pathlib import Path
import math

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[4]
OUTPUT_DIR = Path(__file__).resolve().parent
SOURCE_BLEND = OUTPUT_DIR / "v01-blockout.blend"
OUTPUT_BLEND = OUTPUT_DIR / "v02-structure.blend"
ART = ROOT / "artifacts" / "environment" / "dominican"
GAME_ASSETS = ROOT / "games" / "Yun" / "assets"

RENDERS = {
    "overview": OUTPUT_DIR / "v02-structure-overview.png",
    "architecture": OUTPUT_DIR / "v02-structure-architecture.png",
    "road": OUTPUT_DIR / "v02-structure-road-drainage.png",
    "flora": OUTPUT_DIR / "v02-structure-flora-props.png",
}

CLAY = (0.68, 0.70, 0.72, 1.0)
CHARACTER_GLB = GAME_ASSETS / "kenney" / "mini_characters" / "character-male-a.glb"
CURB_GLB = GAME_ASSETS / "environment" / "dominican" / "street_curb_tile.glb"
DRAIN_GLB = GAME_ASSETS / "environment" / "dominican" / "sidewalk_drainage_baden.glb"


def ensure_collection(name):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def clay_material():
    material = bpy.data.materials.get("MAT_V02_StructuralClay")
    if material is None:
        material = bpy.data.materials.new("MAT_V02_StructuralClay")
        material.diffuse_color = CLAY
        material.roughness = 0.9
    return material


def recessed_material():
    material = bpy.data.materials.get("MAT_V02_RecessedOpeningClay")
    if material is None:
        material = bpy.data.materials.new("MAT_V02_RecessedOpeningClay")
        material.diffuse_color = (0.19, 0.21, 0.23, 1.0)
        material.roughness = 0.96
    return material


def wear_material():
    material = bpy.data.materials.get("MAT_V02_LightPlasterWear")
    if material is None:
        material = bpy.data.materials.new("MAT_V02_LightPlasterWear")
        material.diffuse_color = (0.53, 0.55, 0.56, 1.0)
        material.roughness = 1.0
    return material


def finish(obj, name, collection, asset_id, reference=False):
    obj.name = name
    for old_collection in list(obj.users_collection):
        old_collection.objects.unlink(obj)
    collection.objects.link(obj)
    obj["asset_id"] = asset_id
    obj["checkpoint"] = "v02-structure"
    obj["exportable"] = False
    obj["review_reference"] = reference
    if obj.type == "MESH":
        obj.data.materials.clear()
        obj.data.materials.append(clay_material())
        minimum_edge = min((dimension for dimension in obj.dimensions if dimension > 0), default=0)
        if minimum_edge:
            bevel = obj.modifiers.new("V02_SoftStructuralChamfer", "BEVEL")
            bevel.width = min(0.045, minimum_edge * 0.22)
            bevel.segments = 1
            bevel.limit_method = "ANGLE"
    return obj


def set_recessed_appearance(obj):
    obj.data.materials.clear()
    obj.data.materials.append(recessed_material())
    obj["structural_read"] = "Recessed opening placeholder; not a final glass/material decision."
    return obj


def plaster_wear_patch(name, asset_id, collection, center_x, front_y, center_z,
                       width, height, seed=0):
    shapes = (
        ((-0.50, -0.42), (0.08, -0.50), (0.37, -0.18), (0.50, 0.15),
         (0.05, 0.39), (-0.28, 0.50), (-0.46, 0.12)),
        ((-0.44, -0.31), (0.28, -0.48), (0.50, -0.08), (0.23, 0.20),
         (0.35, 0.48), (-0.38, 0.36), (-0.50, 0.02)),
        ((-0.50, -0.20), (-0.18, -0.46), (0.34, -0.42), (0.50, -0.01),
         (0.16, 0.21), (0.27, 0.50), (-0.42, 0.34)),
    )
    shape = shapes[seed % len(shapes)]
    vertices = [
        (center_x + x * width, front_y, center_z + z * height)
        for x, z in shape
    ]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], [tuple(range(len(vertices)))])
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj["asset_id"] = asset_id
    obj["checkpoint"] = "v02-structure"
    obj["exportable"] = False
    obj["structural_read"] = "Small plaster edge loss; neutral clay placeholder, not a texture/material pass."
    obj.data.materials.append(wear_material())
    return obj


def soften_building_masses():
    collection = bpy.data.collections["BLOCKOUT_Missing_Building_Variants"]
    for obj in collection.objects:
        if not obj.name.endswith(("_ground_mass", "_upper_mass", "_parapet")):
            continue
        bevel = obj.modifiers.new("V02_SoftConcreteEdge", "BEVEL")
        bevel.width = 0.075
        bevel.segments = 1
        bevel.limit_method = "ANGLE"


def box(name, loc, dims, collection, asset_id, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    obj = bpy.context.object
    obj.dimensions = dims
    if rot:
        obj.rotation_euler = tuple(math.radians(v) for v in rot)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, collection, asset_id)


def cylinder(name, loc, radius, depth, collection, asset_id, vertices=12, direction=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    if direction is not None:
        obj.rotation_euler = Vector(direction).to_track_quat("Z", "Y").to_euler()
    return finish(obj, name, collection, asset_id)


def sphere(name, loc, scale, collection, asset_id, segments=12, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, collection, asset_id)


def beam(name, start, end, radius, collection, asset_id, vertices=8):
    start_v, end_v = Vector(start), Vector(end)
    delta = end_v - start_v
    return cylinder(name, (start_v + end_v) / 2, radius, delta.length, collection,
                    asset_id, vertices, delta)


def add_label(body, loc, collection, size=0.42):
    data = bpy.data.curves.new(f"V02_Label_{body}", "FONT")
    data.body = body
    data.size = size
    obj = bpy.data.objects.new(f"V02_Label_{body}", data)
    obj.location = loc
    collection.objects.link(obj)
    data.materials.append(clay_material())
    obj["review_label"] = True
    obj["exportable"] = False
    return obj


def add_window(collection, asset_id, x, front_y, z, width, height, bars=3):
    frame_y = front_y - 0.10
    box(f"{asset_id}_Window_Reveal", (x, frame_y, z), (width + 0.18, 0.16, height + 0.18),
        collection, asset_id)
    inset = box(f"{asset_id}_Window_Inset", (x, frame_y - 0.10, z),
                (width, 0.035, height), collection, asset_id)
    set_recessed_appearance(inset)
    for index in range(bars):
        bar_x = x + (index - (bars - 1) / 2) * width / max(bars, 1)
        box(f"{asset_id}_Window_Bar", (bar_x, frame_y - 0.15, z), (0.055, 0.07, height + 0.04),
            collection, asset_id)
    box(f"{asset_id}_Window_Rail", (x, frame_y - 0.17, z), (width + 0.08, 0.07, 0.055),
        collection, asset_id)
    box(f"{asset_id}_Window_Sill", (x, front_y - 0.17, z - height / 2 - 0.10),
        (width + 0.30, 0.28, 0.16), collection, asset_id)


def add_door(collection, asset_id, x, front_y, z=1.12, width=0.98, height=2.18):
    box(f"{asset_id}_Door_Frame", (x, front_y - 0.105, z), (width + 0.20, 0.18, height + 0.22),
        collection, asset_id)
    leaf = box(f"{asset_id}_Door_Leaf", (x, front_y - 0.22, z),
               (width, 0.055, height), collection, asset_id)
    set_recessed_appearance(leaf)
    box(f"{asset_id}_Door_Panel", (x, front_y - 0.265, z + 0.10),
        (width * 0.65, 0.035, height * 0.53), collection, asset_id)
    cylinder(f"{asset_id}_Door_Knob", (x + width * 0.34, front_y - 0.31, z),
             0.055, 0.06, collection, asset_id, 10, (0, 1, 0))


def add_ac_unit(collection, asset_id, x, front_y, z):
    box(f"{asset_id}_AC_Body", (x, front_y - 0.20, z), (0.88, 0.46, 0.48),
        collection, asset_id)
    for index in range(5):
        box(f"{asset_id}_AC_Vent", (x - 0.27 + index * 0.135, front_y - 0.445, z),
            (0.035, 0.035, 0.24), collection, asset_id)
    beam(f"{asset_id}_AC_Bracket_L", (x - 0.30, front_y - 0.03, z - 0.34),
         (x - 0.30, front_y - 0.38, z - 0.27), 0.04, collection, asset_id)
    beam(f"{asset_id}_AC_Bracket_R", (x + 0.30, front_y - 0.03, z - 0.34),
         (x + 0.30, front_y - 0.38, z - 0.27), 0.04, collection, asset_id)


def add_tank(collection, asset_id, x, y, roof_z, radius=0.64, height=0.92):
    for dx, dy in ((-0.34, -0.34), (0.34, -0.34), (-0.34, 0.34), (0.34, 0.34)):
        box(f"{asset_id}_Tank_Support", (x + dx, y + dy, roof_z + 0.14),
            (0.12, 0.12, 0.28), collection, asset_id)
    cylinder(f"{asset_id}_WaterTank", (x, y, roof_z + 0.32 + height / 2),
             radius, height, collection, asset_id, 16)
    cylinder(f"{asset_id}_Tank_Lid", (x, y, roof_z + 0.32 + height),
             radius * 0.82, 0.10, collection, asset_id, 16)


def structure_houses():
    collection = ensure_collection("V02_Structure_Buildings")
    ids = {
        "house03": "yun_residential_house_03_v01",
        "house04": "yun_residential_house_04_v01",
        "shop": "yun_narrow_commercial_shell_v01",
    }
    h03 = ids["house03"]
    front = 17.0 - 7.4 / 2
    add_door(collection, h03, -13.65, front)
    add_window(collection, h03, -16.45, front, 1.78, 1.42, 1.12, 4)
    # A modest entrance grille keeps the single-storey home distinct from the taller house.
    for x in (-14.17, -13.95, -13.73, -13.51):
        box(f"{h03}_Entry_Grille", (x, front - 0.33, 1.02), (0.045, 0.07, 1.74),
            collection, h03)
    box(f"{h03}_Facade_Band", (-15.0, front - 0.12, 0.39), (6.35, 0.24, 0.22),
        collection, h03)
    box(f"{h03}_Roof_Access_Hatch", (-15.0, 16.7, 3.91), (0.92, 0.90, 0.26),
        collection, h03)
    add_tank(collection, h03, -16.65, 18.0, 3.86, 0.53, 0.82)
    add_ac_unit(collection, h03, -11.15, front, 2.64)
    box(f"{h03}_Meter_Cabinet", (-17.80, front - 0.16, 0.95), (0.34, 0.16, 0.45),
        collection, h03)
    # Readable service conduit, rain leader, and protected footing.
    beam(f"{h03}_Meter_Conduit", (-17.80, front - 0.27, 1.18),
         (-17.80, front - 0.27, 3.02), 0.035, collection, h03)
    beam(f"{h03}_Rain_Downpipe", (-12.12, front - 0.14, 0.24),
         (-12.12, front - 0.14, 3.62), 0.075, collection, h03)
    beam(f"{h03}_Rain_Outlet", (-12.12, front - 0.14, 0.20),
         (-11.78, front - 0.58, 0.20), 0.065, collection, h03)
    box(f"{h03}_Entry_Threshold", (-13.65, front - 0.36, 0.12),
        (1.25, 0.48, 0.18), collection, h03)
    plaster_wear_patch(f"{h03}_PlasterWear_LowerLeft", h03, collection,
                       -17.94, front - 0.16, 0.50, 0.40, 0.32, 0)
    plaster_wear_patch(f"{h03}_PlasterWear_RightBase", h03, collection,
                       -12.35, front - 0.16, 0.35, 0.42, 0.29, 1)

    h04 = ids["house04"]
    front_lower = 17.0 - 7.6 / 2
    lower_h = 6.5 * 0.52
    upper_h = 6.5 - lower_h
    front_upper = front_lower + 7.6 * 0.07
    second_floor = lower_h
    add_door(collection, h04, -3.55, front_lower)
    add_window(collection, h04, -6.35, front_lower, 1.82, 1.52, 1.18, 4)
    add_window(collection, h04, -3.95, front_upper, second_floor + upper_h * 0.55,
               1.24, 1.28, 3)
    add_window(collection, h04, -5.65, front_upper, second_floor + upper_h * 0.55,
               1.16, 1.28, 3)
    balcony_z = second_floor + 0.25
    balcony_x = -5.05
    box(f"{h04}_Balcony_Slab", (balcony_x, front_upper - 0.56, balcony_z),
        (3.05, 1.46, 0.20), collection, h04)
    rail_y = front_upper - 1.20
    for x in (-6.48, -6.0, -5.52, -5.04, -4.56, -4.08, -3.60):
        beam(f"{h04}_Balcony_Picket", (x, rail_y, balcony_z + 0.10),
             (x, rail_y, balcony_z + 1.04), 0.035, collection, h04)
    box(f"{h04}_Balcony_Handrail", (balcony_x, rail_y, balcony_z + 1.05),
        (3.05, 0.11, 0.11), collection, h04)
    box(f"{h04}_Upper_Fascia", (-5.0, front_upper - 0.13, second_floor + upper_h - 0.13),
        (5.6, 0.22, 0.22), collection, h04)
    box(f"{h04}_Roof_Access_Hatch", (-5.0, 16.5, 6.74), (0.9, 0.9, 0.25),
        collection, h04)
    add_tank(collection, h04, -3.1, 18.5, 6.68, 0.60, 0.90)
    add_ac_unit(collection, h04, -1.9, front_lower, 2.68)
    box(f"{h04}_Meter_Cabinet", (-7.70, front_lower - 0.16, 0.98),
        (0.38, 0.16, 0.50), collection, h04)
    beam(f"{h04}_Meter_Conduit", (-7.70, front_lower - 0.26, 1.24),
         (-7.70, front_lower - 0.26, 3.10), 0.035, collection, h04)
    beam(f"{h04}_Rain_Downpipe", (-1.98, front_lower - 0.16, 0.25),
         (-1.98, front_lower - 0.16, 6.30), 0.075, collection, h04)
    beam(f"{h04}_Rain_Outlet", (-1.98, front_lower - 0.16, 0.20),
         (-1.98, front_lower - 0.59, 0.20), 0.065, collection, h04)
    plaster_wear_patch(f"{h04}_PlasterWear_LowerLeft", h04, collection,
                       -7.88, front_lower - 0.15, 0.50, 0.43, 0.32, 2)
    plaster_wear_patch(f"{h04}_PlasterWear_UpperRight", h04, collection,
                       -2.02, front_upper - 0.15, 5.82, 0.34, 0.46, 1)
    # Exterior side stair rises from the street-side foot to a shared balcony landing.
    stair_x = -1.20
    for step in range(18):
        z = 0.16 + step * 0.18
        y = front_lower - 3.7 + step * 0.21
        box(f"{h04}_Exterior_Stair_{step + 1}", (stair_x, y, z),
            (0.95, 0.34, 0.18), collection, h04)
    landing_x = -2.65
    landing_y = front_upper - 0.72
    box(f"{h04}_Stair_Landing", (landing_x, landing_y, balcony_z + 0.04),
        (2.65, 1.35, 0.20), collection, h04)
    for x in (-3.85, -1.48):
        beam(f"{h04}_Stair_Railing", (x, front_lower - 3.65, 0.38),
             (x, front_upper - 0.10, balcony_z + 0.92), 0.055, collection, h04)
    beam(f"{h04}_Stair_Landing_Rail", (-3.85, landing_y - 0.60, balcony_z + 0.98),
         (-1.48, landing_y - 0.60, balcony_z + 0.98), 0.055, collection, h04)

    shop = ids["shop"]
    shop_front = 17.0 - 7.2 / 2
    box(f"{shop}_Shopfront_Reveal", (5.0, shop_front - 0.10, 1.68),
        (4.20, 0.18, 2.82), collection, shop)
    box(f"{shop}_Display_Window", (4.72, shop_front - 0.21, 1.65),
        (1.60, 0.06, 2.45), collection, shop)
    for x in (4.24, 4.56, 4.88, 5.20):
        box(f"{shop}_Display_Bar", (x, shop_front - 0.28, 1.65),
            (0.055, 0.07, 2.40), collection, shop)
    for z in (0.52, 1.30, 2.10, 2.83):
        box(f"{shop}_Display_Rail", (4.72, shop_front - 0.28, z),
            (1.64, 0.07, 0.055), collection, shop)
    add_door(collection, shop, 6.55, shop_front, width=0.88, height=2.14)
    box(f"{shop}_Roller_Shutter", (3.22, shop_front - 0.20, 1.38),
        (1.20, 0.10, 2.48), collection, shop)
    for z in (0.35, 0.62, 0.89, 1.16, 1.43, 1.70, 1.97, 2.24):
        box(f"{shop}_Shutter_Rib", (3.22, shop_front - 0.28, z),
            (1.12, 0.055, 0.065), collection, shop)
    box(f"{shop}_Awning_Canopy", (5.0, shop_front - 0.73, 3.20),
        (5.15, 1.24, 0.20), collection, shop)
    for x in (2.55, 7.45):
        beam(f"{shop}_Awning_Brace", (x, shop_front - 0.16, 2.58),
             (x, shop_front - 1.18, 3.02), 0.065, collection, shop)
    box(f"{shop}_Blank_Signboard", (5.0, shop_front - 0.17, 3.78),
        (4.50, 0.18, 0.54), collection, shop)
    add_tank(collection, shop, 6.9, 18.9, 4.38, 0.48, 0.75)
    beam(f"{shop}_Meter_Conduit", (7.46, shop_front - 0.22, 0.22),
         (7.46, shop_front - 0.22, 2.90), 0.035, collection, shop)
    plaster_wear_patch(f"{shop}_PlasterWear_LeftBase", shop, collection,
                       2.48, shop_front - 0.14, 0.47, 0.32, 0.34, 1)
    plaster_wear_patch(f"{shop}_PlasterWear_RightBase", shop, collection,
                       7.63, shop_front - 0.14, 0.42, 0.30, 0.34, 0)
    add_label("HOUSE 03  |  ONE-STOREY", (-18.0, 12.4, 0.06), collection)
    add_label("HOUSE 04  |  BALCONY / STAIR", (-8.0, 12.4, 0.06), collection)
    add_label("NARROW SHOP  |  DISPLAY / ROLL-UP", (1.5, 12.4, 0.06), collection)


def structure_roads():
    collection = ensure_collection("V02_Structure_Road_and_Drainage")
    asset = "yun_asphalt_road_tile_v01"
    for index in range(5):
        x = -19.8 + index * 2.5
        box(f"Road_Center_Dash_{index + 1}", (x, 4.0, 0.176),
            (1.12, 0.12, 0.025), collection, asset)
    for side_y in (1.35, 6.65):
        box("Road_Edge_Line", (-15.0, side_y, 0.177), (12.5, 0.09, 0.025),
            collection, asset)
    # Roadside slabs make the asphalt read as a street cross-section at this stage.
    for side_y in (-0.15, 8.15):
        box("Sidewalk_Slab_StreetSection", (-15.0, side_y, 0.12),
            (13.0, 2.25, 0.24), collection, "yun_sidewalk_straight_v01")
    box("Curb_Reference_PlacementGuide", (-15.0, 1.12, 0.20),
        (13.0, 0.12, 0.40), collection, "yun_street_curb_tile")
    box("Drainage_Reference_PlacementGuide", (-15.0, 1.38, 0.13),
        (13.0, 0.22, 0.12), collection, "yun_sidewalk_drainage_baden")
    # Extend the v01 ramp profile into a supported sloping curb transition.
    ramp_asset = "yun_sidewalk_ramp_v01"
    for index in range(4):
        x = 12.65 + index * 0.42
        box(f"Sidewalk_Ramp_Tread_{index + 1}", (x, 3.96, 0.18 + index * 0.09),
            (0.46, 1.82, 0.18), collection, ramp_asset)


def import_reference_glb(path, collection, label, offset, repeat_x=None, repeat_y=None):
    if not path.is_file():
        raise FileNotFoundError(f"Required read-only review reference was not found: {path}")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"No mesh objects were imported from review reference: {path}")
    base_locs = {obj.name: obj.location.copy() for obj in meshes}
    for obj in meshes:
        old = list(obj.users_collection)
        for old_collection in old:
            old_collection.objects.unlink(obj)
        collection.objects.link(obj)
        obj.location += Vector(offset)
        obj.hide_select = True
        obj["review_reference"] = True
        obj["exportable"] = False
        obj["source_asset"] = str(path)
        obj["reference_only"] = True
        obj.data.materials.clear()
        obj.data.materials.append(clay_material())
    if repeat_x is not None:
        for index, x in enumerate(repeat_x, start=1):
            for source in meshes:
                duplicate = source.copy()
                duplicate.data = source.data
                collection.objects.link(duplicate)
                duplicate.location = base_locs[source.name] + Vector((x, offset[1], offset[2]))
                duplicate.hide_select = True
                duplicate["review_reference"] = True
                duplicate["exportable"] = False
                duplicate["source_asset"] = str(path)
                duplicate["reference_only"] = True
                duplicate.name = f"{label}_Repeat{index}_{source.name}"
    elif repeat_y is not None:
        for index, y in enumerate(repeat_y, start=1):
            for source in meshes:
                duplicate = source.copy()
                duplicate.data = source.data
                collection.objects.link(duplicate)
                duplicate.location = base_locs[source.name] + Vector((offset[0], y, offset[2]))
                duplicate.hide_select = True
                duplicate["review_reference"] = True
                duplicate["exportable"] = False
                duplicate["source_asset"] = str(path)
                duplicate["reference_only"] = True
                duplicate.name = f"{label}_Repeat{index}_{source.name}"
    return meshes


def add_locked_street_references():
    collection = ensure_collection("REFERENCE_Existing_Curb_and_Drainage_NotForExport")
    curb_positions = [(-20.0 + index * 2.0, 0.55, 0.0) for index in range(7)]
    curb_positions += [(-20.0 + index * 2.0, 7.45, 0.0) for index in range(7)]
    curb_x = [position[0] for position in curb_positions]
    curb = import_reference_glb(CURB_GLB, collection, "ExistingCurb", curb_positions[0],
                                repeat_x=curb_x[1:7])
    upper_curb = import_reference_glb(CURB_GLB, collection, "ExistingCurbUpper",
                                      curb_positions[7], repeat_x=curb_x[8:])
    drainage_x = [-20.0 + index * 2.0 for index in range(7)]
    import_reference_glb(DRAIN_GLB, collection, "ExistingDrainageLower",
                         (drainage_x[0], 1.35, 0.01), repeat_x=drainage_x[1:])
    import_reference_glb(DRAIN_GLB, collection, "ExistingDrainageUpper",
                         (drainage_x[0], 6.65, 0.01), repeat_x=drainage_x[1:])
    for obj in curb + upper_curb:
        obj["reference_set"] = "street_curb_tile.glb — original, read-only"
    add_label("EXISTING CURB + DRAINAGE  |  READ-ONLY FIT REFERENCE",
              (-21.5, -1.45, 0.06), collection, 0.28)


def structure_flora():
    collection = ensure_collection("V02_Structure_Flora")
    palm_ids = ("RoyalPalm_Tall_Blockout", "RoyalPalm_Short_Blockout")
    for palm_id in palm_ids:
        trunk = bpy.data.objects.get(f"{palm_id}_trunk")
        if trunk is None:
            raise RuntimeError(f"Expected approved v01 palm silhouette was not found: {palm_id}")
        x, y, _ = trunk.location
        height = 8.5 if "Tall" in palm_id else 5.8
        crown_z = height * 0.66
        # Fan-shaped tapered leaf blades follow the approved radial silhouette.
        for index in range(9):
            angle = 2 * math.pi * index / 9
            dx, dy = math.cos(angle), math.sin(angle)
            length = 2.55 if "Tall" in palm_id else 1.90
            start = Vector((x + dx * 0.20, y + dy * 0.20, crown_z))
            middle = Vector((x + dx * length * 0.56, y + dy * length * 0.56,
                             crown_z + 0.40))
            tip = Vector((x + dx * length, y + dy * length, crown_z - height * 0.19))
            width = 0.19 if "Tall" in palm_id else 0.15
            verts = [
                start + Vector((-dy * width / 2, dx * width / 2, 0)),
                start + Vector((dy * width / 2, -dx * width / 2, 0)),
                middle + Vector((dy * width, -dx * width, 0)),
                tip,
                middle + Vector((-dy * width, dx * width, 0)),
            ]
            mesh = bpy.data.meshes.new(f"{palm_id}_FrondMesh_{index}")
            mesh.from_pydata(verts, [], [(0, 1, 2, 3, 4)])
            obj = bpy.data.objects.new(f"{palm_id}_TaperedFrond_{index + 1}", mesh)
            collection.objects.link(obj)
            finish(obj, obj.name, collection, palm_id)
        for old_obj in list(bpy.data.objects):
            if old_obj.name.startswith(f"{palm_id}_frond_") or old_obj.name == f"{palm_id}_crown":
                old_obj.hide_render = True
                old_obj.hide_set(True)
        # Layer a compact crown over the primitive v01 hub; no decorative finish yet.
        sphere(f"{palm_id}_Crown_Core", (x, y, crown_z), (0.35, 0.35, 0.30),
               collection, palm_id)

    broad = bpy.data.objects.get("BroadleafShadeTree_Blockout_trunk")
    compact = bpy.data.objects.get("CompactStreetTree_Blockout_trunk")
    if broad is None or compact is None:
        raise RuntimeError("Expected v01 shade-tree silhouettes were not found.")
    for trunk, asset_id, lobe, branch_r in (
        (broad, "yun_broadleaf_shade_tree_v01", 1.17, 0.15),
        (compact, "yun_compact_street_tree_v01", 0.82, 0.11),
    ):
        x, y, _ = trunk.location
        height = 5.6 if "broadleaf" in asset_id else 3.8
        trunk_h = height * (0.58 if "broadleaf" in asset_id else 0.50)
        canopy_z = trunk_h + lobe * 0.55
        # Branches and overlapping canopy masses create a readable, intentional silhouette.
        for index, angle in enumerate((0.15, 1.55, 2.80, 4.35, 5.55)):
            end = (x + math.cos(angle) * lobe * 0.78,
                   y + math.sin(angle) * lobe * 0.72,
                   canopy_z + 0.16)
            beam(f"{asset_id}_Branch_{index + 1}", (x, y, trunk_h * 0.77), end,
                 branch_r, collection, asset_id, 7)
        for index, angle in enumerate((0.0, 1.26, 2.51, 3.77, 5.03)):
            sphere(f"{asset_id}_CanopyLobe_{index + 1}",
                   (x + math.cos(angle) * lobe * 0.48,
                    y + math.sin(angle) * lobe * 0.40,
                    canopy_z + (0.12 if index % 2 else 0.0)),
                   (lobe * 0.60, lobe * 0.52, lobe * 0.52),
                   collection, asset_id)
        old_canopy = bpy.data.objects.get(
            "BroadleafShadeTree_Blockout_canopy"
            if "broadleaf" in asset_id else "CompactStreetTree_Blockout_canopy"
        )
        if old_canopy is not None:
            old_canopy.hide_render = True
            old_canopy.hide_set(True)

    bougainvillea = "yun_bougainvillea_v01"
    shrub = "yun_potted_shrub_v01"
    for asset_id, x, y, scale in (
        (bougainvillea, 12, -8.5, 1.0),
        (shrub, 19, -8.5, 0.72),
    ):
        for index, angle in enumerate((0, 1.57, 3.14, 4.71)):
            beam(f"{asset_id}_PrimaryBranch_{index + 1}",
                 (x, y, 0.7), (x + math.cos(angle) * 0.68 * scale,
                                y + math.sin(angle) * 0.54 * scale, 1.55 * scale),
                 0.055, collection, asset_id)
        for index in range(5):
            angle = index * 2.0 * math.pi / 5
            sphere(f"{asset_id}_FoliageMass_{index + 1}",
                   (x + math.cos(angle) * 0.48 * scale,
                    y + math.sin(angle) * 0.34 * scale, 1.32 * scale),
                   (0.52 * scale, 0.42 * scale, 0.48 * scale), collection, asset_id)
        old_canopy = bpy.data.objects.get(
            "BougainvilleaCanopy_Blockout" if asset_id == bougainvillea
            else "PottedShrubCanopy_Blockout"
        )
        if old_canopy is not None:
            old_canopy.hide_render = True
            old_canopy.hide_set(True)


def structure_wires_and_props():
    collection = ensure_collection("V02_Structure_Street_Props")
    # Give the three missing wire modules a clear physical assembly rather than loose lines.
    for x in (-20.0, -4.0):
        box("UtilityPole_ConcreteFoot", (x, -18.0, 0.35), (0.52, 0.52, 0.70),
            collection, "yun_utility_pole_attachment_v01")
        cylinder("UtilityPole_Shaft", (x, -18.0, 2.9), 0.14, 5.2,
                 collection, "yun_utility_pole_attachment_v01", 10)
        beam("UtilityPole_Crossarm", (x - 0.82, -18.0, 5.1),
             (x + 0.82, -18.0, 5.1), 0.085, collection,
             "yun_utility_pole_attachment_v01")
        for dx in (-0.62, 0.0, 0.62):
            cylinder("UtilityPole_Insulator", (x + dx, -18.0, 5.32), 0.11, 0.32,
                     collection, "yun_utility_pole_attachment_v01", 8)
    for z in (5.82, 5.55, 5.28):
        points = [(-20.0, -18.0, z), (-16.0, -18.0, z - 0.45),
                  (-12.0, -18.0, z - 0.60), (-8.0, -18.0, z - 0.45), (-4.0, -18.0, z)]
        data = bpy.data.curves.new("Overhead_Utility_Cable_Span", "CURVE")
        data.dimensions = "3D"
        data.bevel_depth = 0.035
        data.bevel_resolution = 1
        spline = data.splines.new("POLY")
        spline.points.add(len(points) - 1)
        for point, co in zip(spline.points, points):
            point.co = (*co, 1.0)
        obj = bpy.data.objects.new("Overhead_Utility_Cable_Span", data)
        collection.objects.link(obj)
        obj["asset_id"] = "yun_utility_cable_span_v01"
        obj["checkpoint"] = "v02-structure"
        obj["exportable"] = False

    structure_motorconcho(collection)
    structure_dog(collection)
    structure_neighborhood_props(collection)


def structure_motorconcho(collection):
    for asset_id, x, y, delivery in (
        ("yun_motorconcho_base_v01", -11.5, -18.0, False),
        ("yun_motorconcho_delivery_variant_v01", 0.0, -18.0, True),
    ):
        # Existing v01 axle and silhouette set the wheelbase and seat height.
        for wheel_x in (x - 0.82, x + 0.82):
            wheel = cylinder(f"{asset_id}_Tire_Sidewall", (wheel_x, y, 0.40), 0.41,
                             0.21, collection, asset_id, 16, (0, 1, 0))
            cylinder(f"{asset_id}_Hub", (wheel_x, y - 0.12, 0.40), 0.18,
                     0.05, collection, asset_id, 12, (0, 1, 0))
            for spoke in range(8):
                angle = spoke * math.pi / 4
                beam(f"{asset_id}_Wheel_Spoke",
                     (wheel_x, y - 0.16, 0.40),
                     (wheel_x + math.cos(angle) * 0.29, y - 0.16,
                      0.40 + math.sin(angle) * 0.29),
                     0.018, collection, asset_id)
        beam(f"{asset_id}_Front_Fork", (x + 0.55, y, 0.64),
             (x + 0.82, y, 1.28), 0.065, collection, asset_id)
        beam(f"{asset_id}_Rear_Swingarm", (x - 0.65, y, 0.55),
             (x - 0.20, y, 0.89), 0.065, collection, asset_id)
        sphere(f"{asset_id}_FuelTank", (x + 0.18, y, 1.04),
               (0.48, 0.29, 0.29), collection, asset_id)
        beam(f"{asset_id}_Handlebar", (x + 0.47, y - 0.30, 1.42),
             (x + 0.47, y + 0.30, 1.42), 0.045, collection, asset_id)
        box(f"{asset_id}_Headlamp", (x + 0.72, y - 0.02, 1.22),
            (0.24, 0.22, 0.20), collection, asset_id)
        beam(f"{asset_id}_Exhaust", (x - 0.33, y + 0.18, 0.58),
             (x + 0.20, y + 0.18, 0.68), 0.065, collection, asset_id)
        for side in (-1, 1):
            beam(f"{asset_id}_Footrest", (x - 0.08, y + side * 0.24, 0.64),
                 (x + 0.20, y + side * 0.24, 0.64), 0.045, collection, asset_id)
        if delivery:
            for dx in (-0.38, 0.38):
                beam(f"{asset_id}_DeliveryRack_Support", (x - 0.54, y + dx, 1.15),
                     (x - 0.78, y + dx, 1.50), 0.045, collection, asset_id)


def structure_dog(collection):
    asset_id = "yun_dominican_street_dog_v01"
    sphere(f"{asset_id}_Ribcage", (9.0, -18.0, 0.70), (0.72, 0.35, 0.35),
           collection, asset_id)
    sphere(f"{asset_id}_Haunch", (8.42, -18.0, 0.72), (0.40, 0.37, 0.40),
           collection, asset_id)
    sphere(f"{asset_id}_Shoulder", (9.58, -18.0, 0.82), (0.36, 0.34, 0.38),
           collection, asset_id)
    beam(f"{asset_id}_Neck", (9.70, -18.0, 0.86), (9.86, -18.0, 1.05),
         0.23, collection, asset_id)
    sphere(f"{asset_id}_Head", (10.04, -18.0, 1.08), (0.34, 0.29, 0.31),
           collection, asset_id)
    sphere(f"{asset_id}_Muzzle", (10.31, -18.0, 0.99), (0.24, 0.20, 0.17),
           collection, asset_id)
    for side in (-1, 1):
        sphere(f"{asset_id}_Ear", (9.92, -18.0 + side * 0.22, 1.34),
               (0.13, 0.12, 0.25), collection, asset_id)
    for leg_x in (8.48, 9.48):
        for leg_y in (-18.22, -17.78):
            beam(f"{asset_id}_Leg_Upper", (leg_x, leg_y, 0.60),
                 (leg_x - 0.04, leg_y, 0.32), 0.095, collection, asset_id)
            beam(f"{asset_id}_Leg_Lower", (leg_x - 0.04, leg_y, 0.32),
                 (leg_x + 0.05, leg_y, 0.10), 0.065, collection, asset_id)
            sphere(f"{asset_id}_Paw", (leg_x + 0.08, leg_y, 0.10),
                   (0.16, 0.12, 0.09), collection, asset_id, 8, 6)
    beam(f"{asset_id}_Tail", (8.18, -18.0, 0.86), (7.93, -18.0, 1.12),
         0.07, collection, asset_id)


def structure_neighborhood_props(collection):
    chair_id = "yun_stacked_plastic_chair_v01"
    for index in range(3):
        y = -25.0 + index * 0.06
        z = 0.36 + index * 0.29
        for x in (-18.73, -18.27):
            box(f"StackedChair_{index + 1}_Leg", (x, y - 0.08, z - 0.14),
                (0.055, 0.065, 0.28), collection, chair_id)
        beam(f"StackedChair_{index + 1}_BackRib",
             (-18.5, y - 0.05, z + 0.08), (-18.5, y - 0.05, z + 0.49),
             0.035, collection, chair_id)

    table_id = "yun_domino_table_v01"
    for x in (-10.45, -10.15, -9.85, -9.55):
        for y in (-25.48, -25.18, -24.88, -24.58):
            box("DominoTable_TopSlat", (x, y, 0.93), (0.29, 0.29, 0.045),
                collection, table_id)

    cooler = "yun_neighborhood_cooler_v01"
    box("Cooler_Lid_Rim", (3.0, -25.0, 1.04), (1.20, 0.88, 0.09),
        collection, cooler)
    box("Cooler_Front_Latch", (3.0, -25.43, 0.83), (0.20, 0.06, 0.13),
        collection, cooler)
    beam("Cooler_Handle", (2.69, -25.0, 1.10), (3.31, -25.0, 1.10),
         0.045, collection, cooler)

    fence = "yun_court_fence_span_v01"
    for x in (9.4, 10.1, 10.8, 11.5, 12.2, 12.9, 13.6, 14.3):
        beam("CourtFence_DiagonalBrace", (x - 0.30, -25.05, 0.58),
             (x + 0.30, -25.05, 1.56), 0.025, collection, fence)
    gate = "yun_court_fence_gate_v01"
    for x in (18.12, 19.88):
        box("CourtGate_HingePlate", (x, -25.12, 1.45), (0.16, 0.10, 0.28),
            collection, gate)
    box("CourtGate_Latch", (19.72, -25.18, 1.08), (0.12, 0.13, 0.20),
        collection, gate)


def import_scale_character():
    if not CHARACTER_GLB.is_file():
        raise FileNotFoundError(f"Current Yun scale reference was not found: {CHARACTER_GLB}")
    collection = ensure_collection("REFERENCE_Current_Yun_Character_NotForExport")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(CHARACTER_GLB))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    root = bpy.data.objects.new("Current_Tito_RuntimeScale1_2", None)
    collection.objects.link(root)
    root.location = (13.0, 12.55, 0.0)
    root.rotation_euler.z = math.radians(180)
    root.scale = (1.2, 1.2, 1.2)
    root["source_asset"] = "res://assets/kenney/mini_characters/character-male-a.glb"
    root["runtime_scale"] = 1.2
    root["review_reference"] = True
    root["exportable"] = False
    imported_set = set(imported)
    for obj in imported:
        for old_collection in list(obj.users_collection):
            old_collection.objects.unlink(obj)
        collection.objects.link(obj)
        obj["review_reference"] = True
        obj["exportable"] = False
        obj.hide_select = True
        if obj.name == "Icosphere":
            obj.hide_render = True
            obj.hide_set(True)
        if obj.parent not in imported_set:
            obj.parent = root
    bpy.context.view_layer.update()
    bounds = [
        obj.matrix_world @ Vector(corner)
        for obj in collection.objects if obj.type == "MESH" and obj.name != "Icosphere"
        for corner in obj.bound_box
    ]
    if bounds:
        root.location.z = -min(point.z for point in bounds)
    add_label("CURRENT TITO  |  NON-EXPORTING SCALE REFERENCE",
              (11.0, 11.7, 0.04), collection, 0.30)


def set_camera(name, location, target, ortho_scale, output):
    scene = bpy.context.scene
    camera = bpy.data.objects.get(name)
    if camera is None:
        camera_data = bpy.data.cameras.new(name)
        camera = bpy.data.objects.new(name, camera_data)
        ensure_collection("V02_Review_Cameras").objects.link(camera)
    camera.location = location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    scene.camera = camera
    scene.render.filepath = str(output)


def prepare_scene():
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE_BLEND))
    scene = bpy.context.scene
    scene["V01_BLOCKOUT_APPROVAL_STATUS"] = "APPROVED_BY_OWNER"
    scene["V01_BLOCKOUT_APPROVAL_DATE"] = "2026-10-10"
    scene["V01_APPROVAL_SCOPE"] = "Blockout direction only; v02-v05 and runtime promotion remain unapproved."
    scene["CHECKPOINT"] = "v02-structure"
    scene["VISIBLE_CREATION_STATUS"] = "AWAITING OWNER REVIEW"
    scene["EXPORT_POLICY"] = "Non-exporting v02 structural review; owner review required before v03."
    scene["CONTENT_SCOPE"] = "Refine only missing kit from approved v01; preserve existing candidates and references."
    scene["STYLE_REFERENCE"] = "Use existing Dominican houses: faded concrete, parapets, barred openings, modest roofs."

    for collection_name in (
        "V02_Structure_Buildings", "V02_Structure_Road_and_Drainage",
        "REFERENCE_Existing_Curb_and_Drainage_NotForExport", "V02_Structure_Flora",
        "V02_Structure_Street_Props", "REFERENCE_Current_Yun_Character_NotForExport",
        "V02_Review_Cameras",
    ):
        previous = bpy.data.collections.get(collection_name)
        if previous:
            bpy.data.collections.remove(previous)

    structure_houses()
    soften_building_masses()
    structure_roads()
    add_locked_street_references()
    structure_flora()
    structure_wires_and_props()
    import_scale_character()

    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.34, 0.36, 0.38)
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    shading.background_type = "WORLD"
    shading.show_shadows = True
    shading.show_cavity = True
    shading.cavity_type = "BOTH"
    shading.cavity_ridge_factor = 1.2
    shading.cavity_valley_factor = 1.0
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast"
    scene.render.image_settings.color_mode = "RGBA"

    collection = ensure_collection("V02_Review_Labels")
    add_label("V02 STRUCTURE  |  NEW STREET KIT ONLY", (-22.0, 21.1, 0.08), collection, 0.86)
    add_label("Clay review  |  No final materials or fine details  |  Awaiting owner review",
              (-21.8, 19.6, 0.08), collection, 0.44)
    scene.render.filepath = str(RENDERS["overview"])

    overview_camera = bpy.data.objects.get("ReviewCamera_Overview")
    if overview_camera:
        overview_camera.name = "V02_ReviewCamera_Overview"
    views = (
        ("V02_ReviewCamera_Overview", (28.0, -47.0, 46.0), (1.0, -3.2, 0.0), 80,
         RENDERS["overview"]),
        ("V02_ReviewCamera_Architecture", (0.0, -38.0, 17.0), (-3.0, 15.0, 3.0), 35,
         RENDERS["architecture"]),
        ("V02_ReviewCamera_Road", (-15.0, -8.0, 22.0), (-15.0, 4.0, 0.0), 17,
         RENDERS["road"]),
        ("V02_ReviewCamera_Flora", (8.0, -39.0, 29.0), (1.0, -16.0, 1.5), 42,
         RENDERS["flora"]),
    )
    for name, location, target, scale, image_path in views:
        set_camera(name, location, target, scale, image_path)
        bpy.ops.render.render(write_still=True)

    set_camera("V02_ReviewCamera_Architecture", (0.0, -38.0, 17.0),
               (-3.0, 15.0, 3.0), 35, RENDERS["architecture"])
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == "VIEW_3D":
                space = area.spaces.active
                space.region_3d.view_perspective = "CAMERA"
                space.overlay.show_floor = False
                space.overlay.show_axis_x = False
                space.overlay.show_axis_y = False
                space.shading.type = "SOLID"
                space.shading.color_type = "MATERIAL"
                space.shading.light = "STUDIO"
                space.shading.show_shadows = True
                space.shading.show_cavity = True
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))


if __name__ == "__main__":
    prepare_scene()
