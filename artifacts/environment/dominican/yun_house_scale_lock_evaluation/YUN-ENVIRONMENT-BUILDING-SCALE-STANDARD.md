# Yun environment building scale standard

## Locked value

`0.55`

This is the shared Yun neighborhood-building scale selected from the required `0.55`, `0.60` and `0.65` runtime-transform comparison. It works for both House 01 and House 02 and for current roster characters Paco, Tito and Neno.

House 01 and House 02 were productionized against this standard on October 10, 2026. Their current Blender sources and GLBs contain native `0.55` geometry and import into Godot at scale `1.0`. Their byte-for-byte oversized predecessors remain archived under `../archive/yun_house_original_oversized_candidates_20261010/`.

This scale lock does not change Yun's shipping character scale and does not mount either house in a live map.

## Generator and export rule

For every new house in this family:

1. Use `yun_building_scale` with a default and locked value of `0.55`.
2. Build the same procedural forms and both LODs, then uniformly multiply mesh dimensions and object locations by `0.55` before export.
3. Apply the object transforms in Blender so the exported GLB root imports into Godot at scale `1.0`.
4. Recalculate and export bounds, collision geometry, door/navigation clearances and LOD distances from the scaled native geometry.
5. Keep the foundation minimum at Z=0 and rerun Blender, GLB, Godot import, collision and gameplay-camera validation.
6. Record the authoring scale and resulting native dimensions in each manifest so future houses do not depend on per-instance magic values.

The production validation scene must instantiate houses directly at `Vector3.ONE`; parent scaling is not acceptable. Current roster characters remain mounted through `scripts/mini_figure.gd` at their shipping scale `1.2`.

This preserves predictable collisions and LOD behavior while making `scale = 1.0` the production import standard. See `../YUN-HOUSE-GENERATOR-README.md` and `../yun_house_production_scale_validation/` for implementation and evidence.
