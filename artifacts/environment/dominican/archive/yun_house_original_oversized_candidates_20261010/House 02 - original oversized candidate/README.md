# Yun Caribbean House 02

House 02 is an original, standalone environment candidate for Yun. It shares House 01's stylized Dominican/Caribbean concrete-home language, but uses a different silhouette and facade: no exterior stair, a left garage/storefront shutter, a right pedestrian entrance, paired upper windows, a recessed floor and a corner balcony.

It is not mounted in a Yun map and has not replaced any current environment asset.

## Deliverables

- `yun_caribbean_house_02.blend` and `.glb`: gameplay-detail model (LOD0).
- `yun_caribbean_house_02_lod1.blend` and `.glb`: Distance version of House 02 (LOD1).
- `house-config.json`: deterministic design configuration and fixed seed.
- `build_asset.py`: small entry point for the shared `../yun_house_generator.py` generator.
- `asset-manifest.json`: provenance, rights and file inventory.
- `validation-report.json`: Blender/export geometry validation.
- `godot-import-validation.json`: direct Yun-project import and PackedScene validation.
- Seven review renders covering the front, sides, rear, roof and LOD1.

## Verified result

- LOD0: 7.1075 × 11.1644 × 7.25 m, 5,220 triangles, 4 mesh nodes and 4 shared materials.
- LOD1: 1,452 triangles, 4 mesh nodes and the same 4 shared materials.
- Both GLBs import as PackedScenes in the canonical Yun Godot 4.7.2 project.
- Ground begins at Z=0; the building is complete on every side and uses no third-party creative asset.

## Rebuild

From Blender 5.2.1 or newer, run `blender --background --python build_asset.py` in this directory. The generator is configuration-driven and contains no random choices, so the same configuration and seed reproduce the same layout.

The material count is four because wall/plaster, dark metal, glazing and roof/detail surfaces need different shading behavior. Geometry that shares each material is batched into one mesh node.
