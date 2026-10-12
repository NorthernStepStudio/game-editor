# Yun Caribbean House 01

Original stylized Caribbean urban house candidate for Yun.

## Deliverables

- `yun_caribbean_house_01.blend` — clean Blender source in meters.
- `yun_caribbean_house_01.glb` — material-batched real-time export.
- `yun_caribbean_house_01-*.png` — front, sides, rear, roof, and hero review views.
- `asset-manifest.json` — provenance, dimensions, and candidate status.
- `validation-report.json` — fresh-GLB geometry/bounds/budget validation.
- `godot-import-validation.json` — direct Godot 4.7.2 import/instantiation evidence.
- `build_asset.py` — deterministic procedural source.

## Runtime profile

- Bounds: 7.3343 m wide × 11.6551 m deep × 7.34 m high, including attached stair/AC/awning and rooftop tank.
- Ground alignment: minimum Z = 0.
- Render geometry: 10,308 triangles across 9 material-batched mesh nodes.
- Materials: 9 simple PBR materials; no external textures.
- Animations/skins: none.
- Front axis in Blender: `-Y`.

## Godot use

Copy the GLB into the Yun project and instantiate it as a `PackedScene`. The direct headless probe passed in Godot 4.7.2. Collision is intentionally not baked into the visual GLB; add the project's preferred simple `StaticBody3D` collision during scene assembly so gameplay lanes and placement rules remain authoritative.

This asset is a candidate only. It has not been mounted, made default, or promoted in Yun, and its manifest keeps human approval at `pending`.
