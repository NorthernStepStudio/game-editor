# Yun Caribbean House 02 — production native scale

House 02 is the cool garage-front member of Yun's Caribbean concrete-house kit. It keeps its asymmetric storefront, right pedestrian entry, recessed upper floor, corner balcony, paired windows, stepped parapet and squat tank.

It is ready for neighborhood-kit assembly, but it is not mounted in a live Yun map and is not a release promotion.

## Production contract

- Locked building scale: `0.55` from `house-config.json` and the shared generator default.
- Godot import and instance scale: `1.0`.
- LOD0 native bounds: `3.9091 × 6.1404 × 3.9875` units in Blender X/Y/Z.
- LOD0: `5,220` render triangles, `4` mesh nodes and `4` shared materials.
- LOD1: `1,452` render triangles, `4` mesh nodes and the same `4` materials.
- Ground alignment: minimum Z is `0` in both LODs.
- Collision: `5` collision-only primitive boxes in each LOD covering the closed shell, explicit garage obstruction and balcony boundaries.
- Contact audit: `161` required contacts at LOD0 and `122` at LOD1, with zero failures. The tank supports meet the roof and tank, upper side windows follow the recessed upper walls, and the balcony-door frame is continuous.

All object transforms are applied before GLB export. Both GLBs import into Godot 4.7.2 with root and child scales `1.0`, five `StaticBody3D`/`CollisionShape3D` pairs and no scaled parent workaround.

## Deliverables

- `yun_caribbean_house_02.blend` and `.glb` — production LOD0.
- `yun_caribbean_house_02_lod1.blend` and `.glb` — distance LOD1.
- `house-config.json` — deterministic design configuration, fixed seed and locked scale.
- `build_asset.py` — entry point for `../yun_house_generator.py`.
- `asset-manifest.json`, `validation-report.json` and `godot-import-validation.json` — production evidence.
- Seven review renders covering LOD0 and LOD1.

Rebuild with Blender 5.2.1 or newer using `blender --background --factory-startup --python build_asset.py`. The byte-for-byte pre-production version is preserved under `../archive/yun_house_original_oversized_candidates_20261010/House 02 - original oversized candidate`.

