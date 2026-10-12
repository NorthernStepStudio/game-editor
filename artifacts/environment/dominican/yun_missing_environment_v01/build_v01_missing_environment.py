import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(r"D:\dev\Northern Step Studio")
OUTPUT_DIR = ROOT / "artifacts" / "environment" / "dominican" / "yun_missing_environment_v01"
TITO_GLB = ROOT / "games" / "Yun" / "assets" / "kenney" / "mini_characters" / "character-male-a.glb"

BLEND_PATH = OUTPUT_DIR / "v01-blockout.blend"
READY_FLAG = OUTPUT_DIR / "v01-blockout-ready.flag"
ERROR_FILE = OUTPUT_DIR / "v01-blockout-error.txt"

ROAD_RENDER = OUTPUT_DIR / "v01-blockout-road-tubes.png"
OVERVIEW_RENDER = OUTPUT_DIR / "v01-blockout-overview.png"
GAMEPLAY_RENDER = OUTPUT_DIR / "v01-blockout-gameplay.png"
BUILDINGS_RENDER = OUTPUT_DIR / "v01-blockout-buildings.png"
FLORA_RENDER = OUTPUT_DIR / "v01-blockout-flora.png"
PROPS_RENDER = OUTPUT_DIR / "v01-blockout-props.png"

COLLECTIONS = {
    "road": "BLOCKOUT_RoadCourt",
    "houses": "BLOCKOUT_Residential_03_09",
    "commercial": "BLOCKOUT_Commercial_02_08",
    "flora": "BLOCKOUT_Flora_10",
    "props": "BLOCKOUT_StreetProps",
    "surfaces": "BLOCKOUT_SurfaceModules",
    "reference": "REFERENCE_CurrentGameplayTito",
    "review": "REVIEW_Only",
}

MATERIALS = {}


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


def ensure_collection(key):
    name = COLLECTIONS.get(key, key)
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def material(name, color, roughness=0.84, metallic=0.0):
    value = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1.0)
    value.roughness = roughness
    value.metallic = metallic
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    if shader:
        shader.inputs["Base Color"].default_value = (*color, 1.0)
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metallic
    MATERIALS[name] = value
    return value


def mat(name):
    return MATERIALS[name]


def add_box(name, location, dimensions, collection, material_value, bevel=0.0, rotation=(0.0, 0.0, 0.0), parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0), rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    move_to_collection(obj, collection)
    obj.location = location
    obj.parent = parent
    obj.data.materials.append(material_value)
    obj["checkpoint"] = "v01-blockout"
    if bevel > 0.0:
        modifier = obj.modifiers.new("BlockoutEdge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return obj


def add_cylinder(name, location, radius, depth, collection, material_value, vertices=10, rotation=(0.0, 0.0, 0.0), parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0.0, 0.0, 0.0), rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    obj.location = location
    obj.parent = parent
    obj.data.materials.append(material_value)
    obj["checkpoint"] = "v01-blockout"
    return obj


def add_uv_sphere(name, location, scale, collection, material_value, segments=12, rings=6, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=(0.0, 0.0, 0.0))
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    obj.location = location
    obj.scale = scale
    obj.parent = parent
    obj.data.materials.append(material_value)
    obj["checkpoint"] = "v01-blockout"
    return obj


def add_cone(name, location, radius1, radius2, depth, collection, material_value, vertices=9, parent=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=(0.0, 0.0, 0.0))
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    obj.location = location
    obj.parent = parent
    obj.data.materials.append(material_value)
    obj["checkpoint"] = "v01-blockout"
    return obj


def add_torus(name, location, major_radius, minor_radius, collection, material_value, parent=None):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=32,
        minor_segments=6,
        major_radius=major_radius,
        minor_radius=minor_radius,
        location=(0.0, 0.0, 0.0),
    )
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    obj.location = location
    obj.parent = parent
    obj.data.materials.append(material_value)
    obj["checkpoint"] = "v01-blockout"
    return obj


def add_curve(name, points, collection, material_value, bevel_depth=0.025):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 2
    data.bevel_depth = bevel_depth
    data.bevel_resolution = 1
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    data.materials.append(material_value)
    obj["checkpoint"] = "v01-blockout"
    return obj


def add_label(name, body, location, size=0.34, align="CENTER"):
    collection = ensure_collection("review")
    data = bpy.data.curves.new(name, "FONT")
    data.body = body
    data.align_x = align
    data.align_y = "CENTER"
    data.size = size
    data.extrude = 0.008
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj.location = location
    data.materials.append(mat("ReviewText"))
    obj["review_only"] = True
    return obj


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_camera(name, location, target, fov=50.0):
    data = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    obj = bpy.data.objects.get(name) or bpy.data.objects.new(name, data)
    if not obj.users_collection:
        ensure_collection("review").objects.link(obj)
    obj.location = location
    data.type = "PERSP"
    data.angle = math.radians(fov)
    point_at(obj, target)
    return obj


def configure_view(camera_obj):
    bpy.context.scene.camera = camera_obj
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type != "VIEW_3D":
                continue
            area.spaces.active.overlay.show_relationship_lines = False
            area.spaces.active.overlay.show_extras = False
            area.spaces.active.overlay.show_outline_selected = False
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.region_3d.view_camera_zoom = 5
            try:
                area.spaces.active.shading.type = "RENDERED"
            except Exception:
                area.spaces.active.shading.type = "MATERIAL"
            area.tag_redraw()


def setup_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene["ASSET_ID"] = "yun_missing_environment_v01"
    scene["CHECKPOINT"] = "v01-blockout"
    scene["STATUS"] = "BUILDING_VISIBLY"
    scene["HOUSE_SCALE_STANDARD"] = "House 01/02 locked native geometry; import scale 1.0"
    scene["COURT_SOURCE"] = "games/Yun/scripts/court.gd; TO_3D 0.025"
    scene["REFERENCE_POLICY"] = "Current gameplay Tito only; scale 1.2; excluded from export"
    scene["PRODUCTION_POLICY"] = "Candidate blockouts only; no gameplay files modified"
    scene.render.film_transparent = False
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.035, 0.045, 0.060, 1.0)
    background.inputs["Strength"].default_value = 0.38

    material("Asphalt", (0.075, 0.073, 0.070), 0.96)
    material("Sidewalk", (0.48, 0.43, 0.36), 0.92)
    material("Curb", (0.72, 0.66, 0.54), 0.88)
    material("Chalk", (0.92, 0.84, 0.58), 0.82)
    material("TubeChannel", (0.040, 0.043, 0.045), 0.97)
    material("ResidentialClay", (0.67, 0.36, 0.26), 0.89)
    material("ResidentialAccent", (0.78, 0.60, 0.42), 0.86)
    material("CommercialClay", (0.31, 0.52, 0.56), 0.88)
    material("CommercialAccent", (0.78, 0.68, 0.46), 0.86)
    material("Opening", (0.045, 0.075, 0.085), 0.82)
    material("Roof", (0.54, 0.52, 0.46), 0.91)
    material("Trunk", (0.26, 0.15, 0.075), 0.96)
    material("LeafPalm", (0.19, 0.42, 0.23), 0.93)
    material("LeafBroad", (0.12, 0.32, 0.17), 0.94)
    material("Flower", (0.63, 0.16, 0.29), 0.86)
    material("PropBlue", (0.16, 0.39, 0.48), 0.89)
    material("PropOrange", (0.78, 0.32, 0.10), 0.88)
    material("PropGreen", (0.24, 0.44, 0.28), 0.92)
    material("Metal", (0.07, 0.08, 0.09), 0.72, 0.35)
    material("Dog", (0.42, 0.25, 0.13), 0.92)
    material("Tire", (0.025, 0.028, 0.030), 0.92)
    material("ReviewText", (0.93, 0.77, 0.27), 0.78)
    set_status("v01 — clean visible scene ready")


def build_road_shell():
    c = ensure_collection("road")
    add_box("Court_Asphalt_23_8x17_75", (0.0, 0.0, 0.0), (23.8, 17.75, 0.08), c, mat("Asphalt"))
    add_box("Sidewalk_Left", (-13.0, 0.0, 0.10), (4.2, 22.0, 0.20), c, mat("Sidewalk"), bevel=0.04)
    add_box("Sidewalk_Right", (13.0, 0.0, 0.10), (4.2, 22.0, 0.20), c, mat("Sidewalk"), bevel=0.04)
    add_box("Curb_Left", (-10.85, 0.0, 0.20), (0.45, 22.0, 0.28), c, mat("Curb"), bevel=0.03)
    add_box("Curb_Right", (10.85, 0.0, 0.20), (0.45, 22.0, 0.28), c, mat("Curb"), bevel=0.03)

    # Exact playable width and approximate longitudinal outline from court.gd.
    play_w = 20.8
    outline_d = 14.25
    rail = 0.075
    z = 0.075
    add_box("CourtOutline_Left", (-play_w * 0.5, 0.0, z), (rail, outline_d, 0.025), c, mat("Chalk"))
    add_box("CourtOutline_Right", (play_w * 0.5, 0.0, z), (rail, outline_d, 0.025), c, mat("Chalk"))
    add_box("CourtOutline_Near", (0.0, -outline_d * 0.5, z), (play_w, rail, 0.025), c, mat("Chalk"))
    add_box("CourtOutline_Far", (0.0, outline_d * 0.5, z), (play_w, rail, 0.025), c, mat("Chalk"))
    add_label("RoadLabel", "CURRENT YUN COURT ROAD — v01", (0.0, -8.35, 0.075), 0.44)
    set_status("v01 — main Yun road, sidewalks, curbs and playable outline visible")


def build_tubes_and_spine():
    c = ensure_collection("road")
    play_w = 20.8
    tube_centers = (-3.125, 0.125, 3.375)
    tube_depth = 1.70
    rail = 0.075
    z = 0.085
    for index, y in enumerate(tube_centers, start=1):
        add_box(f"Tube{index}_Fill", (0.0, y, z), (play_w, tube_depth, 0.03), c, mat("TubeChannel"))
        add_box(f"Tube{index}_Near", (0.0, y - tube_depth * 0.5, z + 0.02), (play_w, rail, 0.035), c, mat("Chalk"))
        add_box(f"Tube{index}_Far", (0.0, y + tube_depth * 0.5, z + 0.02), (play_w, rail, 0.035), c, mat("Chalk"))
        add_box(f"Tube{index}_Left", (-play_w * 0.5, y, z + 0.02), (rail, tube_depth, 0.035), c, mat("Chalk"))
        add_box(f"Tube{index}_Right", (play_w * 0.5, y, z + 0.02), (rail, tube_depth, 0.035), c, mat("Chalk"))
        add_label(f"Tube{index}_Label", f"TUBE {index}", (-8.95, y - 0.05, z + 0.025), 0.30, "LEFT")

    segments = ((-6.1, -3.975), (-2.275, -0.725), (0.975, 2.525), (4.225, 6.8))
    for index, (start, end) in enumerate(segments, start=1):
        length = end - start
        center = (start + end) * 0.5
        add_box(f"Spine{index}_Channel", (0.0, center, z), (1.60, length, 0.028), c, mat("TubeChannel"))
        add_box(f"Spine{index}_Left", (-0.80, center, z + 0.018), (rail, length, 0.03), c, mat("Chalk"))
        add_box(f"Spine{index}_Right", (0.80, center, z + 0.018), (rail, length, 0.03), c, mat("Chalk"))
    add_torus("YunHomeRing", (0.0, -6.25, z + 0.025), 1.45, 0.055, c, mat("Chalk"))
    add_torus("FarTurnRing", (0.0, 6.25, z + 0.025), 1.40, 0.055, c, mat("Chalk"))
    add_label("HomeLabel", "YUN", (0.0, -6.25, z + 0.04), 0.52)
    add_label("TurnLabel", "TURN", (0.0, 6.25, z + 0.04), 0.45)

    camera_obj = add_camera("RoadTubeReviewCamera", (20.0, -19.0, 20.0), (0.0, 0.0, 0.0), 48.0)
    configure_view(camera_obj)
    set_status("v01 — all three Yun painted tubes and broken center spine visible")


def building_root(name, collection, location):
    root = bpy.data.objects.new(name + "_ROOT", None)
    collection.objects.link(root)
    root.location = location
    root["checkpoint"] = "v01-blockout"
    root["ground_aligned"] = True
    root["scale_standard"] = "House 01/02 native locked scale"
    return root


def residential_variant(name, y, design):
    c = ensure_collection("houses")
    root = building_root(name, c, (-17.6, y, 0.0))
    clay = mat("ResidentialClay")
    accent = mat("ResidentialAccent")
    roof = mat("Roof")
    opening = mat("Opening")
    specs = {
        3: (5.0, 3.1, 4.7), 4: (4.8, 3.2, 2.65), 5: (5.4, 3.0, 3.5),
        6: (5.2, 3.35, 4.45), 7: (5.0, 3.15, 4.4), 8: (4.6, 2.85, 5.65), 9: (5.5, 3.3, 3.1),
    }
    depth, width, height = specs[design]
    add_box(f"{name}_MainMass", (0.0, 0.0, height * 0.5), (depth, width, height), c, clay, bevel=0.08, parent=root)
    add_box(f"{name}_RoofParapet", (0.0, 0.0, height + 0.13), (depth + 0.12, width + 0.12, 0.26), c, roof, bevel=0.035, parent=root)
    # Front faces the street at local +X.
    front_x = depth * 0.5 + 0.025
    add_box(f"{name}_EntryRead", (front_x, -width * 0.22, 1.05), (0.07, 0.78, 2.10), c, opening, bevel=0.025, parent=root)
    if design in {3, 6, 7, 8}:
        balcony_z = 2.75 if design != 8 else 3.65
        add_box(f"{name}_Balcony", (front_x + 0.48, 0.15, balcony_z), (0.95, width * 0.72, 0.18), c, accent, bevel=0.04, parent=root)
    if design == 3:
        add_box(f"{name}_StairMass", (front_x + 0.70, width * 0.34, 1.25), (1.35, 0.72, 2.5), c, accent, bevel=0.04, rotation=(0.0, math.radians(-24.0), 0.0), parent=root)
    elif design == 4:
        add_box(f"{name}_PorchCanopy", (front_x + 0.58, 0.0, 2.18), (1.18, width * 0.82, 0.18), c, accent, bevel=0.04, parent=root)
        add_box(f"{name}_RoofRoom", (-0.65, 0.2, height + 0.58), (1.35, 1.45, 0.90), c, clay, bevel=0.05, parent=root)
    elif design == 5:
        add_box(f"{name}_UpperMass", (-0.62, 0.25, height + 0.62), (depth * 0.48, width * 0.72, 1.24), c, accent, bevel=0.06, parent=root)
    elif design == 6:
        add_box(f"{name}_SecondEntryRead", (front_x, width * 0.25, 1.05), (0.07, 0.72, 2.10), c, opening, bevel=0.025, parent=root)
    elif design == 7:
        add_box(f"{name}_CornerBalconyWing", (0.70, width * 0.53, 2.75), (depth * 0.58, 0.75, 0.18), c, accent, bevel=0.04, parent=root)
    elif design == 8:
        add_box(f"{name}_UpperSetback", (-0.45, 0.0, 4.85), (depth * 0.68, width * 0.78, 1.60), c, accent, bevel=0.06, parent=root)
    elif design == 9:
        add_box(f"{name}_FrontWall", (front_x + 0.72, 0.0, 0.72), (0.20, width + 0.85, 1.44), c, accent, bevel=0.035, parent=root)
        add_box(f"{name}_GateOpening", (front_x + 0.84, -0.55, 0.85), (0.10, 0.95, 1.70), c, opening, bevel=0.02, parent=root)
    add_label(f"{name}_Label", name.replace("_", " ").upper(), (-14.55, y - width * 0.5, 0.24), 0.28, "RIGHT")


def build_houses_a():
    for design, y in zip((3, 4, 5, 6), (-10.8, -7.2, -3.6, 0.0)):
        residential_variant(f"House_{design:02d}", y, design)
    set_status("v01 — House 03 through House 06 silhouettes visible")


def build_houses_b():
    for design, y in zip((7, 8, 9), (3.6, 7.2, 10.8)):
        residential_variant(f"House_{design:02d}", y, design)
    set_status("v01 — all seven missing residential silhouettes visible")


def commercial_variant(name, y, design):
    c = ensure_collection("commercial")
    root = building_root(name, c, (17.6, y, 0.0))
    clay = mat("CommercialClay")
    accent = mat("CommercialAccent")
    opening = mat("Opening")
    roof = mat("Roof")
    specs = {
        2: (5.6, 3.2, 3.1), 3: (4.8, 2.8, 3.25), 4: (5.0, 3.25, 2.75),
        5: (5.4, 3.45, 3.05), 6: (5.1, 3.1, 4.8), 7: (5.9, 3.25, 3.55), 8: (5.2, 3.2, 5.6),
    }
    depth, width, height = specs[design]
    add_box(f"{name}_MainMass", (0.0, 0.0, height * 0.5), (depth, width, height), c, clay, bevel=0.08, parent=root)
    add_box(f"{name}_Roof", (0.0, 0.0, height + 0.12), (depth + 0.12, width + 0.12, 0.24), c, roof, bevel=0.035, parent=root)
    # Front faces the street at local -X.
    front_x = -depth * 0.5 - 0.025
    if design == 2:
        add_box(f"{name}_GarageBay", (front_x, 0.10, 1.25), (0.07, width * 0.72, 2.50), c, opening, bevel=0.025, parent=root)
        add_box(f"{name}_BayCanopy", (front_x - 0.62, 0.10, 2.72), (1.25, width * 0.82, 0.18), c, accent, bevel=0.04, parent=root)
    elif design == 3:
        add_box(f"{name}_StoreOpening", (front_x, 0.0, 1.18), (0.07, width * 0.68, 2.36), c, opening, bevel=0.025, parent=root)
        add_box(f"{name}_Awning", (front_x - 0.65, 0.0, 2.60), (1.30, width * 0.86, 0.17), c, accent, bevel=0.04, rotation=(0.0, math.radians(-7.0), 0.0), parent=root)
    elif design == 4:
        add_box(f"{name}_FrontOpening", (front_x, -0.42, 1.15), (0.07, width * 0.45, 2.30), c, opening, bevel=0.025, parent=root)
        add_box(f"{name}_SideOpening", (-0.6, -width * 0.5 - 0.02, 1.15), (depth * 0.45, 0.07, 2.30), c, opening, bevel=0.025, parent=root)
        add_box(f"{name}_WrapAwning", (front_x - 0.58, 0.0, 2.45), (1.15, width * 0.92, 0.18), c, accent, bevel=0.04, parent=root)
    elif design == 5:
        for offset in (-0.78, 0.78):
            add_box(f"{name}_MarketBay_{offset:+.2f}", (front_x, offset, 1.18), (0.07, 1.15, 2.36), c, opening, bevel=0.025, parent=root)
        add_box(f"{name}_MarketCanopy", (front_x - 0.72, 0.0, 2.62), (1.45, width * 0.92, 0.20), c, accent, bevel=0.04, parent=root)
    elif design == 6:
        add_box(f"{name}_ShopOpening", (front_x, -0.35, 1.12), (0.07, width * 0.56, 2.24), c, opening, bevel=0.025, parent=root)
        add_box(f"{name}_UpperBalcony", (front_x - 0.48, 0.28, 3.15), (0.95, width * 0.62, 0.18), c, accent, bevel=0.04, parent=root)
    elif design == 7:
        add_box(f"{name}_WarehouseDoor", (front_x, 0.0, 1.38), (0.07, width * 0.70, 2.76), c, opening, bevel=0.025, parent=root)
        add_box(f"{name}_LoadingLip", (front_x - 0.55, 0.0, 0.24), (1.10, width * 0.80, 0.38), c, accent, bevel=0.04, parent=root)
    elif design == 8:
        add_box(f"{name}_GroundShop", (front_x, 0.0, 1.12), (0.07, width * 0.62, 2.24), c, opening, bevel=0.025, parent=root)
        add_box(f"{name}_UpperSetback", (0.45, 0.0, 4.80), (depth * 0.65, width * 0.78, 1.60), c, accent, bevel=0.06, parent=root)
        add_box(f"{name}_Balcony", (front_x - 0.48, 0.0, 3.18), (0.95, width * 0.70, 0.18), c, accent, bevel=0.04, parent=root)
    add_label(f"{name}_Label", name.replace("_", " ").upper(), (14.55, y - width * 0.5, 0.24), 0.28, "LEFT")


def build_commercial_a():
    for design, y in zip((2, 3, 4, 5), (-10.8, -7.2, -3.6, 0.0)):
        commercial_variant(f"Commercial_{design:02d}", y, design)
    set_status("v01 — Commercial 02 through Commercial 05 silhouettes visible")


def build_commercial_b():
    for design, y in zip((6, 7, 8), (3.6, 7.2, 10.8)):
        commercial_variant(f"Commercial_{design:02d}", y, design)
    camera_obj = add_camera("BuildingReviewCamera", (0.0, -30.0, 14.0), (0.0, 0.0, 2.2), 58.0)
    configure_view(camera_obj)
    set_status("v01 — all fourteen missing building silhouettes visible")


def palm(name, x, y, height, lean=0.0, fan=False):
    c = ensure_collection("flora")
    root = bpy.data.objects.new(name + "_ROOT", None)
    c.objects.link(root)
    root.location = (x, y, 0.0)
    trunk = add_cone(f"{name}_Trunk", (lean * height * 0.22, 0.0, height * 0.43), 0.18, 0.11, height * 0.86, c, mat("Trunk"), vertices=9, parent=root)
    trunk.rotation_euler.y = math.radians(lean)
    crown_z = height * 0.86
    crown_x = lean * 0.025 * height
    for index in range(7 if fan else 6):
        angle = index * math.tau / (7 if fan else 6)
        length = 1.20 if fan else 1.55
        leaf = add_box(
            f"{name}_Leaf_{index + 1}",
            (crown_x + math.cos(angle) * length * 0.40, math.sin(angle) * length * 0.40, crown_z + 0.12),
            (length, 0.22 if fan else 0.16, 0.08),
            c,
            mat("LeafPalm"),
            bevel=0.04,
            rotation=(0.0, math.radians(-12.0), angle),
            parent=root,
        )
    add_label(f"{name}_Label", name.replace("_", " ").upper(), (x, y - 0.85, 0.06), 0.22)


def broadleaf(name, x, y, height, compact=False, flowering=False):
    c = ensure_collection("flora")
    root = bpy.data.objects.new(name + "_ROOT", None)
    c.objects.link(root)
    root.location = (x, y, 0.0)
    add_cylinder(f"{name}_Trunk", (0.0, 0.0, height * 0.36), 0.15 if compact else 0.22, height * 0.72, c, mat("Trunk"), vertices=9, parent=root)
    canopy = mat("Flower") if flowering else mat("LeafBroad")
    radius = 0.82 if compact else 1.25
    add_uv_sphere(f"{name}_CrownA", (-radius * 0.35, 0.0, height * 0.77), (radius, radius * 0.82, radius * 0.72), c, canopy, parent=root)
    add_uv_sphere(f"{name}_CrownB", (radius * 0.42, 0.15, height * 0.79), (radius * 0.92, radius, radius * 0.68), c, canopy, parent=root)
    add_uv_sphere(f"{name}_CrownC", (0.0, -0.25, height * 0.92), (radius * 0.82, radius * 0.80, radius * 0.64), c, canopy, parent=root)
    add_label(f"{name}_Label", name.replace("_", " ").upper(), (x, y - 0.95, 0.06), 0.22)


def build_flora_a():
    palm("RoyalPalmTall", -8.5, -15.0, 6.3)
    palm("RoyalPalmShort", -5.9, -15.0, 4.4)
    palm("RoyalPalmLeaning", -3.2, -15.0, 5.4, lean=7.0)
    palm("FanPalm", -0.5, -15.0, 3.8, fan=True)
    broadleaf("BroadleafShade", 2.5, -15.0, 4.4)
    set_status("v01 — first five Yun flora silhouettes visible")


def build_flora_b():
    broadleaf("CompactStreetTree", 5.4, -15.0, 3.3, compact=True)
    broadleaf("FloweringStreetTree", 8.1, -15.0, 3.8, flowering=True)
    c = ensure_collection("flora")
    add_box("BougainvilleaWall", (-11.5, -15.0, 1.25), (0.22, 2.15, 2.50), c, mat("Roof"), bevel=0.035)
    add_uv_sphere("BougainvilleaClimber", (-11.15, -15.0, 1.65), (0.50, 1.30, 1.45), c, mat("Flower"))
    add_label("BougainvilleaLabel", "BOUGAINVILLEA CLIMBER", (-11.0, -16.10, 0.06), 0.20)
    for name, x, tall in (("PottedShrubRound", 10.5, False), ("PottedShrubTall", 12.5, True)):
        add_cone(name + "_Pot", (x, -15.0, 0.34), 0.42, 0.32, 0.68, c, mat("ResidentialAccent"), vertices=10)
        add_uv_sphere(name + "_Plant", (x, -15.0, 1.15 if tall else 0.90), (0.46, 0.46, 1.0 if tall else 0.55), c, mat("LeafBroad"))
        add_label(name + "_Label", name.replace("Potted", "POTTED ").replace("Shrub", "SHRUB ").upper(), (x, -16.0, 0.06), 0.18)
    camera_obj = add_camera("FloraReviewCamera", (0.0, -26.0, 7.0), (0.0, -15.0, 2.0), 55.0)
    configure_view(camera_obj)
    set_status("v01 — all ten missing flora silhouettes visible")


def build_surface_modules():
    c = ensure_collection("surfaces")
    names = ("SidewalkStraight", "SidewalkCorner", "CurbRamp", "AsphaltTile", "Gutter", "PatchedConcrete")
    xs = (-9.0, -5.4, -1.8, 1.8, 5.4, 9.0)
    for name, x in zip(names, xs):
        material_value = mat("Asphalt") if name == "AsphaltTile" else mat("Sidewalk")
        if name == "Gutter":
            add_box(name, (x, 15.8, 0.10), (2.7, 2.0, 0.18), c, mat("Curb"), bevel=0.035)
            add_box(name + "_Channel", (x, 15.8, 0.20), (0.60, 2.0, 0.10), c, mat("Asphalt"), bevel=0.02)
        elif name == "CurbRamp":
            add_box(name, (x, 15.8, 0.12), (2.7, 2.0, 0.24), c, material_value, bevel=0.04, rotation=(0.0, math.radians(4.0), 0.0))
        elif name == "SidewalkCorner":
            add_box(name, (x, 15.8, 0.12), (2.7, 2.0, 0.24), c, material_value, bevel=0.30)
        else:
            add_box(name, (x, 15.8, 0.10), (2.7, 2.0, 0.20), c, material_value, bevel=0.035)
        add_label(name + "_Label", name.replace("Sidewalk", "SIDEWALK ").replace("Curb", "CURB ").replace("Asphalt", "ASPHALT ").replace("Patched", "PATCHED ").upper(), (x, 14.55, 0.22), 0.19)
    set_status("v01 — six reusable road and sidewalk modules visible")


def build_props_a():
    c = ensure_collection("props")
    # Neighborhood dog blockout.
    dog = bpy.data.objects.new("StreetDog_ROOT", None)
    c.objects.link(dog)
    dog.location = (-8.8, 12.4, 0.0)
    add_box("StreetDog_Body", (0.0, 0.0, 0.45), (1.05, 0.38, 0.48), c, mat("Dog"), bevel=0.16, parent=dog)
    add_uv_sphere("StreetDog_Head", (-0.62, 0.0, 0.67), (0.28, 0.24, 0.30), c, mat("Dog"), parent=dog)
    for x in (-0.32, 0.34):
        for y in (-0.13, 0.13):
            add_cylinder(f"StreetDog_Leg_{x}_{y}", (x, y, 0.20), 0.065, 0.40, c, mat("Dog"), vertices=8, parent=dog)
    add_box("StreetDog_Tail", (0.62, 0.0, 0.67), (0.58, 0.10, 0.10), c, mat("Dog"), bevel=0.04, rotation=(0.0, math.radians(-28.0), 0.0), parent=dog)
    add_label("StreetDog_Label", "STREET DOG", (-8.8, 11.65, 0.05), 0.22)

    # Motorconcho base and delivery-box variant.
    for index, (name, x, with_box) in enumerate((("MotorconchoBase", -5.3, False), ("MotorconchoDelivery", -2.5, True))):
        root = bpy.data.objects.new(name + "_ROOT", None)
        c.objects.link(root)
        root.location = (x, 12.4, 0.0)
        for wheel_y in (-0.62, 0.62):
            add_cylinder(name + f"_Wheel_{wheel_y}", (0.0, wheel_y, 0.32), 0.32, 0.14, c, mat("Tire"), vertices=12, rotation=(0.0, math.radians(90.0), 0.0), parent=root)
        add_box(name + "_Frame", (0.0, 0.0, 0.52), (0.18, 1.08, 0.16), c, mat("Metal"), bevel=0.04, rotation=(math.radians(6.0), 0.0, 0.0), parent=root)
        add_box(name + "_Seat", (0.0, 0.16, 0.76), (0.38, 0.65, 0.16), c, mat("PropBlue"), bevel=0.06, parent=root)
        add_box(name + "_Handlebar", (0.0, -0.54, 1.02), (0.78, 0.10, 0.08), c, mat("Metal"), bevel=0.03, parent=root)
        if with_box:
            add_box(name + "_DeliveryBox", (0.0, 0.66, 1.02), (0.72, 0.62, 0.66), c, mat("PropOrange"), bevel=0.08, parent=root)
        add_label(name + "_Label", name.replace("Motorconcho", "MOTORCONCHO ").upper(), (x, 11.65, 0.05), 0.19)

    # Furniture not already represented by the approved plastic-chair v01.
    add_box("StackedChair_Blockout", (0.4, 12.4, 0.40), (0.58, 0.58, 0.80), c, mat("PropBlue"), bevel=0.07)
    add_label("StackedChair_Label", "STACKED CHAIRS", (0.4, 11.65, 0.05), 0.19)
    add_box("DominoTable_Top", (3.0, 12.4, 0.72), (1.0, 1.0, 0.14), c, mat("PropGreen"), bevel=0.05)
    for dx in (-0.38, 0.38):
        for dy in (-0.38, 0.38):
            add_box(f"DominoTable_Leg_{dx}_{dy}", (3.0 + dx, 12.4 + dy, 0.35), (0.10, 0.10, 0.70), c, mat("Metal"), bevel=0.02)
    add_label("DominoTable_Label", "DOMINO TABLE", (3.0, 11.65, 0.05), 0.19)
    add_box("Crate_Blockout", (5.5, 12.4, 0.38), (0.82, 0.62, 0.76), c, mat("ResidentialAccent"), bevel=0.06)
    add_label("Crate_Label", "PLASTIC CRATE", (5.5, 11.65, 0.05), 0.19)
    add_box("Cooler_Blockout", (7.8, 12.4, 0.45), (1.05, 0.68, 0.90), c, mat("PropBlue"), bevel=0.09)
    add_box("Cooler_Lid", (7.8, 12.4, 0.93), (1.10, 0.72, 0.10), c, mat("Curb"), bevel=0.04)
    add_label("Cooler_Label", "STREET COOLER", (7.8, 11.65, 0.05), 0.19)
    set_status("v01 — dog, two motorconchos and remaining furniture blockouts visible")


def build_props_b():
    c = ensure_collection("props")
    # Wire kit: cable span, service drop, pole attachment, shown on review posts.
    for x in (-10.0, -7.0):
        add_cylinder(f"WireReviewPost_{x}", (x, 18.6, 1.8), 0.09, 3.6, c, mat("Metal"), vertices=8)
    add_curve("WireKit_CableSpan", [(-10.0, 18.6, 3.25), (-8.5, 18.6, 2.92), (-7.0, 18.6, 3.25)], c, mat("Metal"), 0.025)
    add_curve("WireKit_ServiceDrop", [(-7.0, 18.6, 3.10), (-6.25, 18.6, 2.60), (-5.7, 18.6, 1.55)], c, mat("Metal"), 0.022)
    add_box("WireKit_PoleAttachment", (-10.0, 18.6, 3.25), (0.42, 0.16, 0.16), c, mat("PropBlue"), bevel=0.035)
    add_label("WireKit_Label", "WIRE KIT ×3", (-8.5, 17.85, 0.05), 0.22)

    # Wrought-iron fence family: span, gate and end post.
    base_x = 6.5
    y = 18.6
    for index in range(7):
        add_box(f"FenceSpan_Bar_{index}", (base_x - 2.1 + index * 0.36, y, 1.0), (0.065, 0.065, 2.0), c, mat("Metal"), bevel=0.012)
    add_box("FenceSpan_Top", (base_x - 1.02, y, 1.82), (2.32, 0.08, 0.08), c, mat("Metal"), bevel=0.012)
    add_box("FenceSpan_Bottom", (base_x - 1.02, y, 0.25), (2.32, 0.08, 0.08), c, mat("Metal"), bevel=0.012)
    for index in range(5):
        add_box(f"FenceGate_Bar_{index}", (base_x + 0.55 + index * 0.36, y, 1.0), (0.065, 0.065, 2.0), c, mat("Metal"), bevel=0.012)
    add_box("FenceGate_Top", (base_x + 1.27, y, 1.82), (1.75, 0.08, 0.08), c, mat("Metal"), bevel=0.012)
    add_box("FenceGate_Bottom", (base_x + 1.27, y, 0.25), (1.75, 0.08, 0.08), c, mat("Metal"), bevel=0.012)
    add_box("Fence_EndPost", (base_x + 2.35, y, 1.05), (0.18, 0.18, 2.10), c, mat("Metal"), bevel=0.02)
    add_label("FenceKit_Label", "FENCE SPAN + GATE + END", (base_x, 17.85, 0.05), 0.20)
    set_status("v01 — cable kit and three-piece fence family visible")


def visible_mesh_bounds(objects):
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


def add_tito_reference():
    c = ensure_collection("reference")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(TITO_GLB))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    imported_set = set(imported)
    root = bpy.data.objects.new("CurrentGameplayTito_RuntimeScale1_2", None)
    c.objects.link(root)
    root.location = (9.4, -7.1, 0.0)
    root.rotation_euler = (0.0, 0.0, math.radians(135.0))
    root.scale = (1.2, 1.2, 1.2)
    root["source_asset"] = "res://assets/kenney/mini_characters/character-male-a.glb"
    root["roster_name"] = "Tito"
    root["runtime_scale"] = 1.2
    root["reference_only"] = True
    for obj in imported:
        move_to_collection(obj, c)
    for obj in imported:
        if obj.parent not in imported_set:
            obj.parent = root
    helper = bpy.data.objects.get("Icosphere")
    if helper is not None and helper in imported_set:
        helper.hide_render = True
        helper.hide_viewport = True
    bpy.context.view_layer.update()
    bounds = visible_mesh_bounds([obj for obj in c.all_objects])
    if bounds:
        root.location.z -= bounds[0].z
    add_label("TitoReferenceLabel", "CURRENT GAMEPLAY TITO — SCALE 1.2", (9.0, -8.10, 0.06), 0.24)
    set_status("v01 — actual current Tito added as scale-only reference")


def add_lighting():
    c = ensure_collection("review")
    bpy.ops.object.light_add(type="SUN", location=(0.0, 0.0, 18.0))
    sun = bpy.context.object
    sun.name = "ReviewSun"
    sun.rotation_euler = (math.radians(28.0), math.radians(-22.0), math.radians(-32.0))
    sun.data.energy = 2.4
    move_to_collection(sun, c)
    bpy.ops.object.light_add(type="AREA", location=(0.0, -8.0, 18.0))
    fill = bpy.context.object
    fill.name = "ReviewFill"
    fill.data.energy = 1800
    fill.data.shape = "DISK"
    fill.data.size = 24.0
    point_at(fill, (0.0, 0.0, 0.0))
    move_to_collection(fill, c)


def render(path, camera_obj, resolution=(1600, 900)):
    scene = bpy.context.scene
    scene.camera = camera_obj
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = resolution[0]
    scene.render.resolution_y = resolution[1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def save_checkpoint():
    add_lighting()
    overview = add_camera("V01_Overview", (39.0, -43.0, 35.0), (0.0, 1.0, 1.6), 52.0)
    gameplay = add_camera("YunGameplayCamera46Degrees", (30.0, -25.0, 12.5), (0.0, -0.4, 1.1), 46.0)
    road = bpy.data.objects.get("RoadTubeReviewCamera") or add_camera("RoadTubeReviewCamera", (20.0, -19.0, 20.0), (0.0, 0.0, 0.0), 48.0)
    buildings = bpy.data.objects.get("BuildingReviewCamera") or add_camera("BuildingReviewCamera", (0.0, -30.0, 14.0), (0.0, 0.0, 2.2), 58.0)
    flora = bpy.data.objects.get("FloraReviewCamera") or add_camera("FloraReviewCamera", (0.0, -26.0, 7.0), (0.0, -15.0, 2.0), 55.0)
    props = add_camera("PropsReviewCamera", (0.0, 28.0, 10.5), (0.0, 15.3, 1.0), 58.0)

    render(ROAD_RENDER, road)
    render(BUILDINGS_RENDER, buildings)
    render(FLORA_RENDER, flora)
    render(PROPS_RENDER, props)
    render(GAMEPLAY_RENDER, gameplay)
    render(OVERVIEW_RENDER, overview)

    scene = bpy.context.scene
    scene["STATUS"] = "AWAITING_OWNER_REVIEW"
    scene["BLOCKOUT_COUNTS"] = "14 buildings; 10 flora; 6 surface modules; 13 other props; 1 court-road shell"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    configure_view(overview)
    READY_FLAG.write_text("AWAITING_OWNER_REVIEW\n", encoding="utf-8")
    set_status("v01 missing Yun environment blockouts — AWAITING OWNER REVIEW")


steps = [
    setup_scene,
    build_road_shell,
    build_tubes_and_spine,
    build_houses_a,
    build_houses_b,
    build_commercial_a,
    build_commercial_b,
    build_flora_a,
    build_flora_b,
    build_surface_modules,
    build_props_a,
    build_props_b,
    add_tito_reference,
    save_checkpoint,
]
step_index = 0


def run_next():
    global step_index
    if step_index >= len(steps):
        return None
    try:
        steps[step_index]()
        step_index += 1
        return 1.15 if step_index < len(steps) else None
    except Exception as error:
        ERROR_FILE.write_text(
            f"Step {step_index + 1}: {type(error).__name__}: {error}\n",
            encoding="utf-8",
        )
        set_status(f"v01 missing environment failed: {error}")
        raise


OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
for stale in (READY_FLAG, ERROR_FILE):
    if stale.exists():
        stale.unlink()
set_status("Yun missing-environment v01 — starting visibly in four seconds")
bpy.app.timers.register(run_next, first_interval=4.0)
