"""
Modular Dominican Environment Generator
Northern Step Studio — Street Yun Original Environment Toolchain

Authors modular 3D environment assets in Blender 5.2.1 LTS:
1. colmado_storefront.glb — Dominican corner colmado with zinc roof, striped awning & counter
2. colmado_awning.glb — Standalone modular commercial striped canvas canopy with mounting struts
3. utility_pole_dominican.glb — Dominican concrete utility pole with crossarm, insulators & transformer
4. street_curb_tile.glb — Sidewalk curb tile with drainage gutter and asphalt step
"""

import bpy
import os
import math

OUTPUT_DIR = r"D:\dev\Northern Step Studio\games\Yun\assets\environment\dominican"
os.makedirs(OUTPUT_DIR, exist_ok=True)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)


def create_pbr_material(name: str, base_color: tuple, roughness: float = 0.6, metallic: float = 0.0):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    
    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.location = (0, 0)
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    
    output = nodes.new(type="ShaderNodeOutputMaterial")
    output.location = (300, 0)
    mat.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat


# -------------------------------------------------------------
# 1. Colmado Storefront (Building, Zinc Roof, Awning, Counter)
# -------------------------------------------------------------
def build_colmado_storefront():
    reset_scene()
    col = bpy.data.collections.new("ColmadoStorefront")
    bpy.context.scene.collection.children.link(col)
    
    # Materials
    mat_stucco = create_pbr_material("Mat_Colmado_Stucco", (0.15, 0.65, 0.72, 1.0), roughness=0.85)  # Caribbean turquoise
    mat_trim = create_pbr_material("Mat_Colmado_Trim", (0.95, 0.85, 0.35, 1.0), roughness=0.5)      # Sunny yellow trim
    mat_zinc = create_pbr_material("Mat_Zinc_Roof", (0.65, 0.68, 0.70, 1.0), roughness=0.45, metallic=0.75) # Weathered zinc
    mat_awning_red = create_pbr_material("Mat_Awning_Red", (0.85, 0.18, 0.16, 1.0), roughness=0.7)
    mat_awning_white = create_pbr_material("Mat_Awning_White", (0.95, 0.95, 0.92, 1.0), roughness=0.7)
    mat_wood = create_pbr_material("Mat_Wood_Counter", (0.42, 0.28, 0.18, 1.0), roughness=0.8)
    mat_metal_reja = create_pbr_material("Mat_Reja_Grill", (0.2, 0.2, 0.22, 1.0), roughness=0.4, metallic=0.9)
    mat_concrete = create_pbr_material("Mat_Concrete_Base", (0.55, 0.55, 0.53, 1.0), roughness=0.9)
    
    # Base Concrete Slab
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.1))
    slab = bpy.context.active_object
    slab.name = "Concrete_Slab"
    slab.scale = (4.2, 3.4, 0.2)
    slab.data.materials.append(mat_concrete)
    
    # Main Building Body
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.3, 1.6))
    building = bpy.context.active_object
    building.name = "Main_Structure"
    building.scale = (3.8, 2.6, 2.8)
    building.data.materials.append(mat_stucco)
    
    # Yellow Header Wall Trim
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.3, 3.05))
    trim = bpy.context.active_object
    trim.name = "Header_Trim"
    trim.scale = (3.9, 2.7, 0.3)
    trim.data.materials.append(mat_trim)
    
    # Counter Service Opening (front alcove)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.3, -1.05, 1.25))
    counter_niche = bpy.context.active_object
    counter_niche.name = "Service_Counter_Niche"
    counter_niche.scale = (2.2, 0.3, 1.3)
    counter_niche.data.materials.append(mat_wood)
    
    # Wooden Counter Shelf
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.3, -1.22, 0.9))
    shelf = bpy.context.active_object
    shelf.name = "Counter_Shelf"
    shelf.scale = (2.4, 0.5, 0.1)
    shelf.data.materials.append(mat_wood)
    
    # Metal Security Grill (Reja bars)
    for i in range(7):
        bx = -0.7 + i * 0.33
        bpy.ops.mesh.primitive_cylinder_add(radius=0.018, depth=1.1, location=(bx, -1.05, 1.35))
        bar = bpy.context.active_object
        bar.name = f"Reja_Bar_{i}"
        bar.data.materials.append(mat_metal_reja)
    
    # Corrugated Zinc Roof Overhang (Techo de Zinc)
    # Model 14 corrugation ridges
    for i in range(15):
        zx = -1.95 + i * 0.27
        bpy.ops.mesh.primitive_cylinder_add(radius=0.065, depth=3.2, location=(zx, 0.35, 3.25))
        ridge = bpy.context.active_object
        ridge.name = f"Zinc_Ridge_{i}"
        ridge.rotation_euler = (math.radians(12), 0, 0)
        ridge.scale = (1.0, 1.0, 1.0)
        ridge.data.materials.append(mat_zinc)
    
    # Roof Base Sheet
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.35, 3.22))
    zinc_sheet = bpy.context.active_object
    zinc_sheet.name = "Zinc_Sheet"
    zinc_sheet.rotation_euler = (math.radians(12), 0, 0)
    zinc_sheet.scale = (4.0, 3.2, 0.04)
    zinc_sheet.data.materials.append(mat_zinc)
    
    # Front Striped Awning (Toldo)
    # Striped canopy panels
    for i in range(12):
        ax = -1.65 + i * 0.3
        mat = mat_awning_red if (i % 2 == 0) else mat_awning_white
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(ax, -1.45, 2.05))
        panel = bpy.context.active_object
        panel.name = f"Awning_Stripe_{i}"
        panel.rotation_euler = (math.radians(24), 0, 0)
        panel.scale = (0.3, 0.9, 0.03)
        panel.data.materials.append(mat)
        
        # Scalloped valance
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(ax, -1.82, 1.82))
        valance = bpy.context.active_object
        valance.name = f"Awning_Valance_{i}"
        valance.scale = (0.29, 0.03, 0.22)
        valance.data.materials.append(mat)
    
    # Awning Support Struts
    for side_x in [-1.75, 1.75]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=1.3, location=(side_x, -1.4, 1.6))
        strut = bpy.context.active_object
        strut.name = f"Awning_Strut_{side_x}"
        strut.rotation_euler = (math.radians(45), 0, 0)
        strut.data.materials.append(mat_metal_reja)
    
    # Beverage Crates Stack (Prop)
    mat_crate = create_pbr_material("Mat_Plastic_Crate", (0.85, 0.3, 0.1, 1.0), roughness=0.5)
    for c_z in [0.25, 0.55]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-1.4, -1.2, c_z))
        crate = bpy.context.active_object
        crate.name = f"Drink_Crate_{c_z}"
        crate.scale = (0.5, 0.4, 0.28)
        crate.data.materials.append(mat_crate)
    
    # Select all and apply transforms
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    
    # Save & Export
    blend_path = os.path.join(OUTPUT_DIR, "colmado_storefront.blend")
    glb_path = os.path.join(OUTPUT_DIR, "colmado_storefront.glb")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB', use_selection=False)
    print(f"Exported colmado_storefront.glb: {os.path.getsize(glb_path)} bytes")


# -------------------------------------------------------------
# 2. Colmado Modular Awning
# -------------------------------------------------------------
def build_colmado_awning():
    reset_scene()
    col = bpy.data.collections.new("ColmadoAwning")
    bpy.context.scene.collection.children.link(col)
    
    mat_yellow = create_pbr_material("Mat_Awning_Yellow", (0.95, 0.78, 0.15, 1.0), roughness=0.65)
    mat_blue = create_pbr_material("Mat_Awning_Blue", (0.15, 0.38, 0.85, 1.0), roughness=0.65)
    mat_metal = create_pbr_material("Mat_Awning_Frame", (0.22, 0.22, 0.25, 1.0), roughness=0.35, metallic=0.9)
    
    # Width 3.0m, slope depth 1.2m
    for i in range(10):
        sx = -1.35 + i * 0.3
        mat = mat_yellow if (i % 2 == 0) else mat_blue
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx, -0.5, 0.45))
        panel = bpy.context.active_object
        panel.name = f"Awning_Panel_{i}"
        panel.rotation_euler = (math.radians(26), 0, 0)
        panel.scale = (0.3, 1.1, 0.025)
        panel.data.materials.append(mat)
        
        # Scallop Valance
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx, -0.98, 0.18))
        valance = bpy.context.active_object
        valance.name = f"Valance_{i}"
        valance.scale = (0.29, 0.025, 0.2)
        valance.data.materials.append(mat)
    
    # Steel Frame
    for side_x in [-1.45, 1.45]:
        # Wall mount plate
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(side_x, 0.0, 0.4))
        plate = bpy.context.active_object
        plate.name = f"Mount_Plate_{side_x}"
        plate.scale = (0.05, 0.08, 0.6)
        plate.data.materials.append(mat_metal)
        
        # Diagonal strut
        bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=1.1, location=(side_x, -0.45, 0.15))
        strut = bpy.context.active_object
        strut.name = f"Diagonal_Strut_{side_x}"
        strut.rotation_euler = (math.radians(48), 0, 0)
        strut.data.materials.append(mat_metal)
    
    # Horizontal front bar
    bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=3.0, location=(0, -0.98, 0.28))
    f_bar = bpy.context.active_object
    f_bar.name = "Front_Bar"
    f_bar.rotation_euler = (0, math.radians(90), 0)
    f_bar.data.materials.append(mat_metal)
    
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    
    blend_path = os.path.join(OUTPUT_DIR, "colmado_awning.blend")
    glb_path = os.path.join(OUTPUT_DIR, "colmado_awning.glb")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB', use_selection=False)
    print(f"Exported colmado_awning.glb: {os.path.getsize(glb_path)} bytes")


# -------------------------------------------------------------
# 3. Dominican Concrete Utility Pole
# -------------------------------------------------------------
def build_utility_pole():
    reset_scene()
    col = bpy.data.collections.new("UtilityPole")
    bpy.context.scene.collection.children.link(col)
    
    mat_pole = create_pbr_material("Mat_Concrete_Pole", (0.58, 0.58, 0.55, 1.0), roughness=0.88)
    mat_crossarm = create_pbr_material("Mat_Wood_Crossarm", (0.38, 0.26, 0.16, 1.0), roughness=0.85)
    mat_insulator = create_pbr_material("Mat_Ceramic_Insulator", (0.25, 0.65, 0.58, 1.0), roughness=0.25)
    mat_transformer = create_pbr_material("Mat_Transformer_Grey", (0.42, 0.44, 0.46, 1.0), roughness=0.45, metallic=0.8)
    mat_lamp = create_pbr_material("Mat_Streetlamp", (0.85, 0.88, 0.82, 1.0), roughness=0.3, metallic=0.5)
    
    # Main Pole (7.2m tall, tapered cylinder)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=7.2, location=(0, 0, 3.6))
    pole = bpy.context.active_object
    pole.name = "Concrete_Pole_Shaft"
    pole.data.materials.append(mat_pole)
    
    # Chamfered Top Cap
    bpy.ops.mesh.primitive_cone_add(radius1=0.18, radius2=0.08, depth=0.25, location=(0, 0, 7.32))
    cap = bpy.context.active_object
    cap.name = "Pole_Cap"
    cap.data.materials.append(mat_pole)
    
    # Wooden Crossarm (upper)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 6.7))
    crossarm = bpy.context.active_object
    crossarm.name = "High_Voltage_Crossarm"
    crossarm.scale = (2.2, 0.14, 0.14)
    crossarm.data.materials.append(mat_crossarm)
    
    # Ceramic Insulators (3 on crossarm)
    for ix in [-0.9, 0.0, 0.9]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.22, location=(ix, 0, 6.85))
        ins = bpy.context.active_object
        ins.name = f"Insulator_{ix}"
        ins.data.materials.append(mat_insulator)
    
    # Lower Secondary Crossarm
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 5.8))
    crossarm_low = bpy.context.active_object
    crossarm_low.name = "Low_Voltage_Crossarm"
    crossarm_low.scale = (1.4, 0.12, 0.12)
    crossarm_low.data.materials.append(mat_crossarm)
    
    for ix in [-0.55, 0.55]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=0.18, location=(ix, 0, 5.92))
        ins_low = bpy.context.active_object
        ins_low.name = f"Insulator_Low_{ix}"
        ins_low.data.materials.append(mat_insulator)
    
    # Heavy Transformer Drum
    bpy.ops.mesh.primitive_cylinder_add(radius=0.35, depth=0.9, location=(0.42, 0, 5.1))
    trans = bpy.context.active_object
    trans.name = "Transformer_Drum"
    trans.data.materials.append(mat_transformer)
    
    # Transformer Bushing Terminals
    for bx in [0.28, 0.56]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=0.22, location=(bx, 0, 5.62))
        bushing = bpy.context.active_object
        bushing.name = f"Transformer_Bushing_{bx}"
        bushing.data.materials.append(mat_insulator)
    
    # Streetlight Arm & Fixture
    bpy.ops.mesh.primitive_cylinder_add(radius=0.04, depth=1.2, location=(-0.55, 0, 4.4))
    lamp_arm = bpy.context.active_object
    lamp_arm.name = "Streetlight_Arm"
    lamp_arm.rotation_euler = (0, math.radians(-70), 0)
    lamp_arm.data.materials.append(mat_transformer)
    
    # Streetlight Bell Dome
    bpy.ops.mesh.primitive_cone_add(radius1=0.22, radius2=0.08, depth=0.16, location=(-1.15, 0, 4.58))
    bell = bpy.context.active_object
    bell.name = "Lamp_Dome"
    bell.rotation_euler = (0, math.radians(180), 0)
    bell.data.materials.append(mat_lamp)
    
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    
    blend_path = os.path.join(OUTPUT_DIR, "utility_pole_dominican.blend")
    glb_path = os.path.join(OUTPUT_DIR, "utility_pole_dominican.glb")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB', use_selection=False)
    print(f"Exported utility_pole_dominican.glb: {os.path.getsize(glb_path)} bytes")


# -------------------------------------------------------------
# 4. Street Curb Tile (Sidewalk, Gutter, Asphalt transition)
# -------------------------------------------------------------
def build_street_curb():
    reset_scene()
    col = bpy.data.collections.new("StreetCurb")
    bpy.context.scene.collection.children.link(col)
    
    mat_sidewalk = create_pbr_material("Mat_Sidewalk_Tile", (0.75, 0.72, 0.68, 1.0), roughness=0.85)
    mat_curb_stone = create_pbr_material("Mat_Curb_Stone", (0.55, 0.54, 0.52, 1.0), roughness=0.9)
    mat_asphalt = create_pbr_material("Mat_Street_Asphalt", (0.22, 0.22, 0.23, 1.0), roughness=0.92)
    mat_yellow_paint = create_pbr_material("Mat_Curb_Yellow_Paint", (0.92, 0.76, 0.15, 1.0), roughness=0.7)
    
    # Sidewalk Block (X: 2.0m, Y: 0.8m, Z: 0.22m)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.4, 0.11))
    sidewalk = bpy.context.active_object
    sidewalk.name = "Sidewalk_Top"
    sidewalk.scale = (2.0, 0.8, 0.22)
    sidewalk.data.materials.append(mat_sidewalk)
    
    # Sidewalk Tile expansion joints (two grooves)
    for jx in [-0.5, 0.5]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(jx, 0.4, 0.222))
        groove = bpy.context.active_object
        groove.name = f"Joint_{jx}"
        groove.scale = (0.02, 0.8, 0.01)
        groove.data.materials.append(mat_curb_stone)
    
    # Chamfered Curb Stone (front edge of sidewalk)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.05, 0.11))
    curb = bpy.context.active_object
    curb.name = "Curb_Bevel_Stone"
    curb.scale = (2.0, 0.16, 0.22)
    curb.data.materials.append(mat_yellow_paint)  # Street curb yellow paint
    
    # Street Asphalt Strip (lower level)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.4, 0.025))
    asphalt = bpy.context.active_object
    asphalt.name = "Street_Asphalt_Section"
    asphalt.scale = (2.0, 0.6, 0.05)
    asphalt.data.materials.append(mat_asphalt)
    
    # Gutter Drain Line (Badén water runoff channel)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.16, 0.015))
    gutter = bpy.context.active_object
    gutter.name = "Gutter_Channel"
    gutter.scale = (2.0, 0.08, 0.03)
    gutter.data.materials.append(mat_curb_stone)
    
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    
    blend_path = os.path.join(OUTPUT_DIR, "street_curb_tile.blend")
    glb_path = os.path.join(OUTPUT_DIR, "street_curb_tile.glb")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB', use_selection=False)
    print(f"Exported street_curb_tile.glb: {os.path.getsize(glb_path)} bytes")


print("=== AUTHORING MODULAR DOMINICAN ENVIRONMENT ASSETS IN BLENDER 5.2.1 LTS ===")
build_colmado_storefront()
build_colmado_awning()
build_utility_pole()
build_street_curb()
print("=== DOMINICAN ENVIRONMENT ASSET GENERATION COMPLETE ===")
