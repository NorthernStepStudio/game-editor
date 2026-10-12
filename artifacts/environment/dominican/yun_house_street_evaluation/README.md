# Temporary Yun House Street Evaluation

This evidence folder contains the disposable two-house visual/scale test and ten-house performance test requested for House 01 and House 02.

The test script is copied temporarily into the canonical `games/Yun` project so it uses Yun's real project settings and production character asset. Candidate GLBs are copied beside it, run headlessly, and the temporary project folder is removed after screenshots and the JSON report are archived here.

Nothing in a Yun map, environment provider, saved default, character design, or release asset is replaced by this test.

## Final measured run

- Godot 4.7.2, canonical Street Yun project, 1920×1080, 46° representative gameplay camera.
- GPU: AMD Radeon RX 7700 XT; Vulkan Forward+ desktop renderer. The project retains its `gl_compatibility` mobile setting.
- Two houses: 15,528 house triangles, 13 house mesh surfaces, 130 average draw calls, 16.520 ms average frame time and 60.5 observed FPS.
- Ten LOD0 houses: 77,640 house triangles, 65 house mesh surfaces, 185 average draw calls, 16.516 ms average frame time and 60.5 observed FPS.
- Runtime stderr was empty and no rendering warning was reported.
- House 01's 15 files matched their pre-test hashes; see `house01-integrity.json`.

This is desktop evidence, not mobile-hardware proof. The ten-house result makes the material reduction worthwhile, but 185 draw calls still warrants LOD switching, instancing/batching where appropriate and a real-device check before promotion.

See `visual-review.md` for the owner-readable visual findings.
