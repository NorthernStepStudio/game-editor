# Yun Caribbean House 01 — production native scale

House 01 is the warm stair-and-balcony member of Yun's Caribbean concrete-house kit. Its original design is unchanged; the production asset now has the locked Yun scale baked into its vertices and locations.

It is ready for neighborhood-kit assembly, but it is not mounted in a live Yun map and is not a release promotion.

## Production contract

- Locked building scale: `0.55`.
- Godot import and instance scale: `1.0`.
- Native bounds: `4.0339 × 6.4103 × 4.037` units in Blender X/Y/Z.
- Ground alignment: minimum Z is `0`.
- Render geometry: `10,308` triangles across `9` material-batched mesh nodes.
- Materials: `9` simple PBR materials; no external textures.
- Collision: `20` collision-only primitive boxes covering the closed shell, gate, twelve stair treads, stair landing, reachable landing guards and balcony boundaries.
- Contact audit: `196` required structural/detail contacts measured before batching, with zero failures. Tank supports and the tank pipe run continuously from the roof slab into the tank assembly.
- Front axis in Blender: `-Y`.

All object transforms are applied before GLB export. The GLB imports into Godot 4.7.2 with root scale `1.0`, all child node scales `1.0`, 20 `StaticBody3D`/`CollisionShape3D` pairs and no scaled parent workaround.

## Deliverables

- `yun_caribbean_house_01.blend` — production-native Blender source.
- `yun_caribbean_house_01.glb` — production-native real-time export with collision-only nodes.
- `yun_caribbean_house_01-*.png` — six Blender review views.
- `asset-manifest.json` — provenance, scale, collision and unmounted production status.
- `validation-report.json` — fresh-GLB bounds, geometry and transform validation.
- `godot-import-validation.json` — isolated Godot import, collision, character and camera result.
- `build_asset.py` — deterministic procedural source.

The byte-for-byte pre-production version is preserved under `../archive/yun_house_original_oversized_candidates_20261010/House 01 - original oversized candidate`.

