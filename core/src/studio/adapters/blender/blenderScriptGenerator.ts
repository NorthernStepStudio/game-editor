import { join } from "node:path";

export interface BlenderCrateSpec {
  readonly assetName?: string;
  readonly crateSize?: number;
  readonly woodColor?: readonly [number, number, number, number];
  readonly metalColor?: readonly [number, number, number, number];
  readonly previewWidth?: number;
  readonly previewHeight?: number;
}

export function generateBlenderCrateScript(
  workDir: string,
  spec: BlenderCrateSpec = {},
): { scriptPath: string; pythonCode: string } {
  const assetName = spec.assetName || "Crate";
  const crateSize = spec.crateSize ?? 1.6;
  const previewWidth = spec.previewWidth ?? 800;
  const previewHeight = spec.previewHeight ?? 800;

  const scriptPath = join(workDir, "build_asset.py");
  const blendPath = join(workDir, `${assetName.toLowerCase()}.blend`).replace(/\\/g, "/");
  const pngPath = join(workDir, `${assetName.toLowerCase()}-preview.png`).replace(/\\/g, "/");
  const glbPath = join(workDir, `${assetName.toLowerCase()}.glb`).replace(/\\/g, "/");
  const reportPath = join(workDir, `${assetName.toLowerCase()}-report.json`).replace(/\\/g, "/");

  const pythonCode = `import bpy
import math
import os
import json
from datetime import datetime

def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "CrateScene"

    # 1. Materials
    mat_wood = bpy.data.materials.new(name="MAT_Wood")
    mat_wood.use_nodes = True
    bsdf_wood = mat_wood.node_tree.nodes.get("Principled BSDF")
    if bsdf_wood:
        bsdf_wood.inputs["Base Color"].default_value = (0.45, 0.28, 0.12, 1.0)
        bsdf_wood.inputs["Roughness"].default_value = 0.65

    mat_metal = bpy.data.materials.new(name="MAT_Metal")
    mat_metal.use_nodes = True
    bsdf_metal = mat_metal.node_tree.nodes.get("Principled BSDF")
    if bsdf_metal:
        bsdf_metal.inputs["Base Color"].default_value = (0.2, 0.22, 0.25, 1.0)
        bsdf_metal.inputs["Metallic"].default_value = 0.85
        bsdf_metal.inputs["Roughness"].default_value = 0.35

    # 2. Main Crate Body
    bpy.ops.mesh.primitive_cube_add(size=${crateSize}, location=(0, 0, ${crateSize / 2}))
    crate_body = bpy.context.active_object
    crate_body.name = "Crate_Body"
    if crate_body.data.materials:
        crate_body.data.materials[0] = mat_wood
    else:
        crate_body.data.materials.append(mat_wood)

    # 3. Crate Detail / Framing
    bpy.ops.mesh.primitive_cube_add(size=${crateSize * 1.03}, location=(0, 0, ${crateSize / 2}))
    crate_detail = bpy.context.active_object
    crate_detail.name = "Crate_Detail"
    crate_detail.scale = (1.02, 1.02, 0.15)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    if crate_detail.data.materials:
        crate_detail.data.materials[0] = mat_metal
    else:
        crate_detail.data.materials.append(mat_metal)

    bevel_mod = crate_detail.modifiers.new(name="Bevel", type='BEVEL')
    bevel_mod.width = 0.03
    bevel_mod.segments = 2

    # Apply all transforms
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.select_all(action='DESELECT')

    # 4. Lighting & Camera
    bpy.ops.object.light_add(type='SUN', location=(4, -4, 6))
    key_light = bpy.context.active_object
    key_light.name = "Light_Key"
    key_light.data.energy = 3.5
    key_light.rotation_euler = (math.radians(45), math.radians(15), math.radians(45))

    bpy.ops.object.light_add(type='POINT', location=(-3, 3, 2))
    fill_light = bpy.context.active_object
    fill_light.name = "Light_Fill"
    fill_light.data.energy = 50.0

    bpy.ops.object.camera_add(location=(3.2, -3.2, 2.6))
    camera = bpy.context.active_object
    camera.name = "Camera_Main"
    camera.rotation_euler = (math.radians(60), 0, math.radians(45))
    scene.camera = camera

    return scene, [crate_body, crate_detail]

def main():
    blend_path = "${blendPath}"
    png_path = "${pngPath}"
    glb_path = "${glbPath}"
    report_path = "${reportPath}"

    scene, mesh_objects = setup_scene()

    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print("Saved blend file:", blend_path)

    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'BLENDER_EEVEE_NEXT') else 'BLENDER_EEVEE'
    scene.render.resolution_x = ${previewWidth}
    scene.render.resolution_y = ${previewHeight}
    scene.render.filepath = png_path
    bpy.ops.render.render(write_still=True)
    print("Rendered preview image:", png_path)

    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    print("Exported GLB asset:", glb_path)

    objects_info = []
    total_vertices = 0
    total_edges = 0
    total_polygons = 0

    for obj in scene.objects:
        info = {
            "name": obj.name,
            "type": obj.type,
            "location": [round(v, 4) for v in obj.location],
            "dimensions": [round(v, 4) for v in obj.dimensions]
        }
        if obj.type == 'MESH' and obj.data:
            mesh = obj.data
            v_count = len(mesh.vertices)
            e_count = len(mesh.edges)
            p_count = len(mesh.polygons)
            info["vertices"] = v_count
            info["edges"] = e_count
            info["polygons"] = p_count
            total_vertices += v_count
            total_edges += e_count
            total_polygons += p_count
            info["materials"] = [m.name for m in obj.data.materials if m]
        objects_info.append(info)

    blend_size = os.path.getsize(blend_path) if os.path.exists(blend_path) else 0
    png_size = os.path.getsize(png_path) if os.path.exists(png_path) else 0
    glb_size = os.path.getsize(glb_path) if os.path.exists(glb_path) else 0

    report = {
        "blenderVersion": bpy.app.version_string,
        "timestamp": datetime.now().isoformat(),
        "activeScene": scene.name,
        "meshObjectsCount": len([o for o in scene.objects if o.type == 'MESH']),
        "materials": [m.name for m in bpy.data.materials],
        "totals": {
            "vertices": total_vertices,
            "edges": total_edges,
            "polygons": total_polygons
        },
        "artifacts": {
            "blendPath": blend_path,
            "blendSizeBytes": blend_size,
            "previewPngPath": png_path,
            "previewPngSizeBytes": png_size,
            "glbPath": glb_path,
            "glbSizeBytes": glb_size
        },
        "objects": objects_info,
        "success": os.path.exists(blend_path) and os.path.exists(png_path) and png_size > 0 and os.path.exists(glb_path) and glb_size > 0
    }

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print("Wrote inspection report:", report_path)

if __name__ == "__main__":
    main()
`;

  return { scriptPath, pythonCode };
}
