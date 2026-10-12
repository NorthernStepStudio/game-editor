# Yun House 01 + House 02 production-scale validation

This folder contains the isolated Godot 4.7.2 production gate for the two locked-scale houses. The scene instantiates the production GLBs directly at scale `1.0`; it does not use a scaled parent and does not modify a live Yun map.

## Result

**PASS — ready for neighborhood-kit assembly, still unmounted.**

- Locked generator scale: `0.55`.
- Godot root and child scales: `1.0` for House 01, House 02 LOD0 and House 02 LOD1.
- Ground: aligned to zero for all three GLBs.
- Characters: current shipping Paco, Tito and Neno through `scripts/mini_figure.gd`, unchanged at runtime scale `1.2`.
- Camera: Yun gameplay reference, `46°` FOV, `0.12` near and `120` far at `1920 × 1080`.
- Collision: House 01 imported 20 collision shapes; House 02 imported five in each LOD. Shell, stair, garage and balcony ray probes all hit their intended colliders.
- Component contacts: House 01 passed `196` measured contacts; House 02 passed `161` at LOD0 and `122` at LOD1. The post-scale repair grounds both rooftop tank assemblies and corrects House 02's recessed upper-side window and balcony-door lower frame.

## Geometry retained

- House 01: `10,308` render triangles, nine mesh surfaces and nine materials.
- House 02 LOD0: `5,220` render triangles, four mesh surfaces and four materials.
- House 02 LOD1: `1,452` render triangles, four mesh surfaces and four materials.

## Performance

Measured on Godot Forward+ with an AMD Radeon RX 7700 XT. This is desktop evidence, not mobile-device proof.

- Two LOD0 houses: `15,528` render triangles, `13` surfaces, `67.0` average draw calls, `16.463 ms` average frame time and `60.7` observed FPS across 240 frames.
- Ten LOD0 houses: `77,640` render triangles, `65` surfaces, `106.0` average draw calls, `16.524 ms` average frame time and `60.5` observed FPS across 360 frames.

The ten-house scene remains a representative stress check; a shipping neighborhood should still use LOD switching, visibility management and real mobile-hardware validation.

## Evidence

- `production-scale-validation-report.json` — machine-readable full result.
- `production_scale_validation.gd` — reproducible isolated scene script.
- `house01-native-scale-tito.png` — House 01 with current Tito.
- `house02-native-scale-tito.png` — House 02 with current Tito.
- `two-house-native-scale-gameplay-camera.png` — both houses with Paco, Tito and Neno.
- `house01-native-scale-stair-side.png` — exterior stair side reference.
- `ten-house-native-scale-performance.png` — ten-house LOD0 scene.

The disposable test copy under `games/Yun/tests/` is removed after evidence collection. No Yun gameplay, map, character, or saved environment default is changed.

