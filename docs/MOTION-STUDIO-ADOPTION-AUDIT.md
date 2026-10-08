# Matterhorn Motion Studio Adoption Audit & Implementation Baseline

Date: October 7, 2026  
Branch: `integration/motion-studio-adoption-20261007`  
Baseline Commit: `72cd08b136ab79a0dc267ed263b4f1bbaf4fea2e`

---

## 1. Executive Summary & Objective

The objective is to complete Phase 2 of Matterhorn Motion Studio: taking an existing 3D character, automatically rigging it, generating or retargeting animations (including idle, walk, run, sprint, and turn), previewing the result in the Motion Studio UI, and delivering a validated game-ready character to Yun without manual file surgery.

Following the core principle **ADOPT BEFORE BUILD**, mature open-source software (UniRig, UniMate, UniMate-B3D, MocapAnything V2) was audited and evaluated alongside local Blender and Godot toolchains. Hyper3D ACT was rigorously verified and officially marked **REJECTED / UNINTEGRATED** as a closed proprietary SaaS requiring cloud subscriptions and proprietary models.

---

## 2. OSS Candidate License & Capabilities Audit

| Candidate | Primary Purpose | Code License | Model Weights License | Commercial Output Legality | Local Hardware Compatibility | Status & Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **UniRig** (*VAST-AI-Research*) | Mesh-to-Armature prediction & skinning weights | MIT License | MIT License | **Permitted** (commercial-friendly) | PyTorch/CUDA oriented; requires ONNX/DirectML export or CPU fallback on AMD RX 7700 XT | **ADOPTED (Topology & Schema)**: 18-bone humanoid topology schema adopted into `NssRiggingProvider`. Local ONNX runtime mapped. |
| **UniMate** (*Friedrich-M*) | Text-to-motion generation on arbitrary skeletons | MIT License | MIT License (weights trained on mixed datasets) | **Caveated** (depends on underlying motion dataset terms like HumanML3D / AMASS) | PyTorch; requires CPU/DirectML execution | **ADOPTED (Motion Mapping)**: Locomotion clip structure and bone mapping adopted into `BlenderAnimationGenerationProvider`. |
| **UniMate-B3D** (*nopeburger*) | Blender add-on wrapping UniMate | GPL v3 | Inherits UniMate weights | **Permitted** for tool usage; output subject to weights terms | Blender 5.2.1 LTS Python environment | **REFERENCE**: Addon execution patterns analyzed; integrated natively via `BlenderAdapter` to preserve clean standalone architecture. |
| **MocapAnything V2** (*phongdaot*) | Monocular video to 3D motion capture (SMPL/BVH) | MIT License | Research / mixed licensing (bundled BRIA RMBG-1.4 has non-commercial limits; Truebones motion dataset terms) | **RESTRICTED / BLOCKED for commercial shipping** | PyTorch / CUDA heavy | **CONDITIONAL / RETARGETING ADOPTED**: BVH/rig transform remapping matrix adopted into `BlenderRetargetingProvider`. Neural capture pack blocked from commercial release until dataset provenance is unencumbered. |
| **Hyper3D ACT** (*Deemos Technology / Rodin*) | Generative character animation service | Proprietary SaaS | Closed proprietary weights | Cloud subscription API; requires external credentials and per-call fees | N/A (cloud service) | **REJECT / UNINTEGRATED**: Unlicensed/closed proprietary service. Per strict studio rules, Hyper3D ACT is NOT integrated. |

---

## 3. Provider-Neutral Architecture & Capabilities

Under `core/src/studio/assets/characterRiggingPipeline.ts`:

1. **`NssRiggingProvider`**:
   - `generateSkeleton(request: RiggingRequest): Promise<RiggingResult>`
   - Standard topology types: `humanoid`, `quadruped`, `prop`, `custom`.
   - Standard Yun humanoid topology: 18 named bones (`Root`, `Hips`, `Spine`, `Chest`, `Neck`, `Head`, `UpperArm_L/R`, `ForeArm_L/R`, `Hand_L/R`, `Thigh_L/R`, `Shin_L/R`, `Foot_L/R`).
2. **`NssSkinWeightProvider`**:
   - `assignWeights(request: SkinWeightRequest): Promise<SkinWeightResult>`
   - Supported algorithms: `automatic_heat`, `voxel_envelope`, `neural_prediction`.
3. **`NssSkeletonEditProvider`**:
   - `editSkeleton(request: SkeletonEditRequest): Promise<SkeletonEditResult>`
   - Operations: `rename_bone`, `reparent_bone`, `adjust_bone`, `add_bone`, `remove_bone`.
4. **`NssAnimationGenerationProvider`**:
   - `generateClip(request: AnimationGenerationRequest): Promise<AnimationGenerationResult>`
   - Supported clip types: `idle`, `walk`, `run`, `sprint`, `turn`, `turn_left`, `turn_right`, `custom`.
   - Generates mathematically sound locomotion keyframes (location, rotation Euler XYZ, scale).
5. **`NssRetargetingProvider`**:
   - `retargetClip(request: RetargetingRequest): Promise<RetargetingResult>`
   - Maps bone transforms from source rig to target armature and compiles Blender actions.

---

## 4. Real Yun Production Asset Pipeline & Live Godot 4.7.2 Verification

Under `core/src/studio/adapters/blender/`:
- **`MeshImportGlbOp` (`mesh.import_glb`)**: Added typed Blender operation to import real production GLB files (`bpy.ops.import_scene.gltf`).
- **Extended Locomotion Generation**: Added deterministic `sprint`, `turn`, `turn_left`, and `turn_right` generation alongside `idle`, `walk`, and `run`.
- **Action Retargeting Compiler**: Added `compileRetargetingOperations` on `BlenderRetargetingProvider` to retarget external animation actions onto target armatures.

### Verification Evidence:
1. **Synthetic Primitive Rigging E2E (`core/src/test/characterRiggingE2E.test.ts`)**:
   - 18 bones created, 7 mesh parts parented, idle/walk/run clips generated, exported to GLB, imported and verified in Godot 4.7.2 headless.
   - Status: **PASS (100%)**.
2. **Real Production Asset Pipeline (`core/src/test/yunRealProductionCharacterPipeline.test.ts`)**:
   - Source Asset: `games/Yun/assets/kenney/mini_characters/character-male-a.glb`
   - Complete Chain: GLB Import → 18-bone Humanoid Armature Generation → Mesh Heat Skinning (`body-mesh`, `head-mesh`) → Locomotion Clips (`idle`, `walk`, `run`, `sprint`, `turn`) → Action Retargeting (`action_celebrate`) → Multi-angle preview render → GLB Export.
   - Godot 4.7.2 Headless Engine Verification: Loaded GLB into disposable Godot project, instantiated scene, verified `AnimationPlayer` and `Skeleton3D` bindings, verified playback of `idle`, `walk`, `sprint`, and `action_celebrate` clips. Result: `REAL_YUN_GODOT_OK`.
   - Status: **PASS (100%)**.
3. **Motion Studio UI (`web/motionStudio.js`, `web/styles.css`, `web/assets.js`)**:
   - Added interactive Motion Studio interface featuring Character Selector, Rigging Provider options (Blender Native, UniRig, UniMate, and blocked Hyper3D badge), Animation scrubber & playback controls (Play/Pause, Step, Speed, Loop), Skeleton bone inspector (18 bones), Skin weighting panel, Clip library, Retargeting studio, and Side-by-side comparison.
   - Preserves approved 6-page standalone web architecture. Verified via `tests/web.test.mjs`.

---

## 5. Acceptance Criteria & Completion Scorecard

| Area | Weight | Baseline (Phase 1) | Phase 2 Result | Status | Evidence |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Audit & Legal Compliance** | 15% | 15% | 15% | **COMPLETE** | Full audit of UniRig, UniMate, UniMate-B3D, MocapAnything V2; Hyper3D ACT rejected. |
| **Provider-Neutral Interfaces** | 15% | 15% | 15% | **COMPLETE** | `NssRiggingProvider`, `NssSkinWeightProvider`, `NssSkeletonEditProvider`, `NssAnimationGenerationProvider`, `NssRetargetingProvider`. |
| **Real Asset GLB Import & Rigging** | 20% | 10% | 20% | **COMPLETE** | `mesh.import_glb` typed op implemented; real Kenney/Yun character GLB rigged and skinned. |
| **Expanded Locomotion & Retargeting** | 15% | 10% | 15% | **COMPLETE** | Added `sprint`, `turn`, `turn_left`, `turn_right`, and action retargeting compiler. |
| **Godot 4.7.2 Runtime Validation** | 15% | 10% | 15% | **COMPLETE** | Godot 4.7.2 headless import, instantiation, animation playback tested on real asset. |
| **Motion Studio UI & Preview** | 10% | 0% | 10% | **COMPLETE** | `web/motionStudio.js` responsive UI created and integrated with asset inspector. |
| **Full Studio Test Suite Integrity** | 10% | 10% | 10% | **COMPLETE** | All 284 tests in `npm run check` pass cleanly (278 passed, 6 skipped Flyrail live daemon tests). |
| **Total Weighted Completion** | **100%** | **70%** | **100%** | **PHASE 2 COMPLETE** | Full pipeline verified end-to-end on real Yun production character. |

