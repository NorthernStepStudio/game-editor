# Yun neighborhood-house generator

`yun_house_generator.py` is the shared deterministic Blender generator for Yun's modular Caribbean concrete-house family. House-specific configuration lives beside each asset; House 02 is the current configuration-driven example.

## Locked scale

- `DEFAULT_YUN_BUILDING_SCALE = 0.55`.
- A configuration may state `yun_building_scale`, but validation rejects values other than `0.55`.
- The generator builds the authored form, uniformly scales mesh locations and dimensions, and applies the transforms before export.
- Render meshes, collision meshes and both House 02 LODs are produced from the same final native size.
- Blender and GLB roots remain at scale `1.0`; Godot instances must also remain at scale `1.0`.
- The foundation remains aligned to Z=0.

Do not compensate by changing character scale, applying a Godot parent scale, or changing individual building-instance transforms. The shipping roster remains at scale `1.2` through `games/Yun/scripts/mini_figure.gd`.

## Collision convention

Simple box meshes use Godot's `-colonly` import suffix. They have no render material and are hidden from Blender review renders. Godot imports them as `StaticBody3D`/`CollisionShape3D` nodes. Collision remains deliberately coarse: closed shell, major reachable surfaces and important boundaries, not per-detail collision.

## House 02 configuration

`yun_caribbean_house_02/house-config.json` controls the fixed seed, dimensions, facade options, utilities, palette and locked building scale. LOD0 and LOD1 preserve the four-material structure:

1. wall/plaster
2. dark metal
3. window/glass
4. detail/roof

Run from Blender 5.2.1 or newer:

```text
blender --background --factory-startup --python artifacts/environment/dominican/yun_caribbean_house_02/build_asset.py
```

House 01 retains its dedicated deterministic generator because its exterior stair and nine-material art treatment predate the shared configuration schema. It follows the same `0.55`, transform, origin and collision rules.

## Required validation

Every production rebuild must pass:

- fresh GLB bounds, ground, render-triangle, material and transform checks;
- Godot PackedScene import at scale `1.0` with no scaled parent;
- collision node inspection plus physics probes of representative surfaces;
- gameplay-camera comparison with current Paco, Tito and Neno assets;
- two-house and approximately ten-house performance checks before kit use.

Current evidence is in `yun_house_production_scale_validation/`. The oversized predecessors and original generator are preserved in `archive/yun_house_original_oversized_candidates_20261010/`.

