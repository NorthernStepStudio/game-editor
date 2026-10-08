# Matterhorn Motion Studio Adoption Audit & Implementation Baseline

Date: October 7, 2026  
Branch: `integration/motion-studio-adoption-20261007`  
Baseline Commit: `a1e7ecd21086556ed6143d79254a4cfa9b8efec5`

---

## 1. Executive Summary & Objective

The objective is to complete the 3D character rigging, skin weighting, skeletal editing, animation generation, and retargeting pipeline for Matterhorn Motion Studio using mature, legally reusable open-source software (OSS) rather than rebuilding capabilities from scratch.

This audit evaluates candidate OSS solutions (UniRig, UniMate, UniMate-B3D, MocapAnything V2, and Hyper3D ACT) across code licensing, model weights licensing, commercial output rights, and local hardware compatibility (specifically Windows PC with AMD Radeon RX 7700 XT GPU).

---

## 2. OSS Candidate License & Capabilities Audit

| Candidate | Primary Purpose | Code License | Model Weights License | Commercial Output Legality | Local Hardware Compatibility | Status & Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **UniRig** (*VAST-AI-Research*) | Mesh-to-Armature prediction & skinning weights | MIT License | MIT License | **Permitted** (commercial-friendly) | PyTorch/CUDA oriented; requires ONNX/DirectML export or CPU fallback on AMD | **ADOPT (Candidate Pack)**: Model architectures and rigging topology schema adopted into neutral interfaces. |
| **UniMate** (*Friedrich-M*) | Text-to-motion generation on arbitrary skeletons | MIT License | MIT License (weights trained on mixed datasets) | **Caveated** (depends on underlying motion dataset terms like HumanML3D / AMASS) | PyTorch; requires CPU/DirectML execution | **ADOPT (Pack / Selective)**: Schema compatible with neutral animation generator interface. |
| **UniMate-B3D** (*nopeburger*) | Blender add-on wrapping UniMate | GPL v3 | Inherits UniMate weights | **Permitted** for tool usage; output subject to weights terms | Blender 4.x/5.x Python environment | **REFERENCE**: Workflow patterns referenced; direct dependency avoided to preserve clean standalone architecture. |
| **MocapAnything V2** (*phongdaot*) | Monocular video to 3D motion capture (SMPL/BVH) | MIT License | Research / mixed licensing (bundled BRIA RMBG-1.4 has non-commercial limits; Truebones motion dataset terms) | **RESTRICTED / BLOCKED for commercial shipping** | PyTorch / CUDA heavy | **CONDITIONAL / RESEARCH ONLY**: Core BVH retargeting mapping adopted into `NssRetargetingProvider`. Neural capture pack blocked from commercial release until dataset provenance is unencumbered. |
| **Hyper3D ACT** (*Deemos Technology / Rodin*) | Generative character animation service | Proprietary SaaS | Closed proprietary weights | Cloud subscription API; requires external credentials and per-call fees | N/A (cloud service) | **REJECT / UNINTEGRATED**: Unlicensed/closed proprietary service. Per strict studio rules, Hyper3D ACT is NOT integrated. |

---

## 3. Provider-Neutral Architecture

To avoid vendor lock-in and enable swapping local mathematical engines and neural AI models without modifying the Studio contract, provider-neutral interfaces were designed and integrated under `core/src/studio/assets/characterRiggingPipeline.ts`:

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
   - Clip types: `idle`, `walk`, `run`, `sprint`, `action`, `custom`.
   - Emits keyframed transforms (location, rotation Euler, scale) per bone.
5. **`NssRetargetingProvider`**:
   - `retargetClip(request: RetargetingRequest): Promise<RetargetingResult>`
   - Maps bone transforms from source rig to target armature.

---

## 4. Blender-Native Implementation & Flyrail / Godot Validation

Under `core/src/studio/adapters/blender/blenderRiggingAdapter.ts`, the highest-value local components have been implemented using Blender's native rigging and animation operators:
- `BlenderRiggingProvider`: Assembles and scales the 18-bone humanoid armature.
- `BlenderSkinWeightProvider`: Binds meshes with automatic heat skinning (`ARMATURE_AUTO`).
- `BlenderSkeletonEditProvider`: Applies bone transformations and hierarchy restructuring.
- `BlenderAnimationGenerationProvider`: Generates Yun-compliant looping locomotion keyframes (`idle`, `walk`, `run`).
- `BlenderRetargetingProvider`: Remaps bone naming conventions.

### End-to-End Character Verification
Verified via `core/src/test/characterRiggingE2E.test.ts`:
1. Generated skeleton and animations via neutral providers.
2. Compiled into typed `BlenderOperation` batch and executed through Blender 5.2.1 LTS.
3. Exported character GLB with embedded skins and action tracks.
4. Imported into Godot 4.7.2 headless (`Godot_v4.7.2-stable_win64.exe`).
5. Verified scene instantiation: `Skeleton3D` (18 bones), `AnimationPlayer` with required `idle`, `walk`, `run` tracks matching the Yun character contract. Result: **100% PASS**.

---

## 5. Acceptance Criteria & Completion Scorecard

| Area | Weight | Baseline | Post-Implementation | Status | Evidence |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Audit & Legal Compliance** | 20% | 0% | 20% | **COMPLETE** | Full license audit of UniRig, UniMate, UniMate-B3D, MocapAnything V2; Hyper3D ACT rejected. |
| **Provider-Neutral Interfaces** | 25% | 0% | 25% | **COMPLETE** | `NssRiggingProvider`, `NssSkinWeightProvider`, `NssSkeletonEditProvider`, `NssAnimationGenerationProvider`, `NssRetargetingProvider` implemented and exported. |
| **Blender Engine Implementation** | 25% | 10% (raw ops) | 25% | **COMPLETE** | `BlenderRiggingProvider`, `BlenderSkinWeightProvider`, `BlenderAnimationGenerationProvider`, `BlenderSkeletonEditProvider` compile high-level requests into deterministic Blender ops. |
| **E2E GLB → Rig → Godot Flow** | 20% | 0% | 20% | **COMPLETE** | Real character GLB rigged, skinned, animated, and verified in Godot 4.7.2 headless with 0 errors. |
| **Motion AI Local Packs** | 10% | 0% | 5% | **PARTIAL** | UniRig / UniMate neural weights identified for optional pack integration; blocked on direct AMD GPU acceleration until ONNX export is finalized. |
| **Total Weighted Completion** | **100%** | **10%** | **95%** | **PRODUCTION READY BASELINE** | All unit tests and full studio gates passing locally. |
