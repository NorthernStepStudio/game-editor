# Northern Step Studio — Asset Production Toolchain Audit

**Date:** October 9, 2026  
**Host:** Northern Step Studio PC Workstation  
**Operating System:** Windows 10 Home (10.0.19045)  
**Security & Operational Posture:** 100% Local-first, perpetual-license/open-source preferred, zero third-party creative runtime assets in release builds.

---

## 1. System Hardware & Runtime Audit

| Subsystem | Specification / Configuration | Operational Impact |
|---|---|---|
| **CPU** | AMD Ryzen 5 3600 (6 Cores, 12 Threads @ 3.60 GHz) | Fast multi-threaded procedural generation, Godot compilation, and audio rendering. |
| **Installed RAM** | 32.0 GB DDR4 | Sufficient headroom for concurrent ComfyUI DirectML inference, Blender LTS modeling, Godot runtime, and Matterhorn services. |
| **GPU Model** | **AMD Radeon RX 7700 XT** | High rasterization and compute capability. |
| **Dedicated VRAM** | **12.0 GB GDDR6** | Capable of holding SD 1.5, SDXL, and audio diffusion models in VRAM simultaneously. |
| **CUDA Availability** | **NONE (AMD Hardware)** | **Critical constraint:** Native NVIDIA CUDA binaries and libraries fail. All neural network execution must target **DirectML (`torch_directml`, ONNX Runtime DirectML EP)** or optimized CPU execution. |
| **Storage: C:\\** | 27.06 GB Free (Total: 476.35 GB) | **Tight storage constraint.** No heavy models, weights, or build caches may be placed on C:. Cache paths (`HF_HOME`, `TORCH_HOME`, ComfyUI models) must strictly reside on D:\\ or L:\\. |
| **Storage: D:\\** | 312.41 GB Free (Total: 500.00 GB) | **Primary Development Drive.** Codebases, local models, tools, and build artifacts reside here. |
| **Storage: L:\\** | 919.38 GB Free (Total: 1363.00 GB) | Secondary large storage drive for raw audio recordings, model weights archives, and render backups. |
| **Node.js** | v25.2.1 | Modern ESM and native test runner operational for Matterhorn, Flyrail, and studio services. |
| **Python** | Python 3.11.9 (System & ComfyUI venv) | DirectML-compatible Python runtime environment. |
| **Git & GitHub CLI** | Git 2.52.0, GitHub CLI `gh` 2.92.0 | Authenticated as `NorthernStepStudio`. |
| **Package Manager**| Windows Package Manager `winget` v1.29.380 | Operational for package discovery. User-scope and portable archives prioritized to prevent UAC disruptions. |

---

## 2. Production Toolchain Compatibility Matrix

| Tool | Version / Path | Role | Status | License & Operational Notes |
|---|---|---|---|---|
| **Blender** | 5.2.1 LTS (`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`) | 3D modeling, rigging, skinning, animation, materials, GLB export | **PASS / OPERATIONAL** | GNU GPL v3+. Fully integrated with Matterhorn `BlenderAdapter`. Headless script generation and visual sanity passes verified. |
| **Godot Engine** | 4.7.2-stable official (`D:\dev\Northern Step Studio\apps\flyrail\tools\godot\bin\Godot_v4.7.2-stable_win64.exe`) | Street Yun runtime, headless asset import, motion validation | **PASS / OPERATIONAL** | MIT License. Headless execution verified via `godot-version.mjs` and Flyrail asset probes. (Note: Non-console binary used to avoid Win32 error 193). |
| **ComfyUI** | Version 0.3.70 (`D:\dev\ComfyUI`, port 8188) | Local image generation, Character Studio turnarounds, concept art | **PASS / OPERATIONAL** | GPL-3.0. Running as background daemon with `--directml --listen 127.0.0.1 --port 8188`. Verified on AMD RX 7700 XT (`privateuseone:0`), generating 512x512 images in 12.4s. |
| **Matterhorn Server** | v0.1.0 (`http://127.0.0.1:3456`) | Local AI orchestration, Character Studio, Foundry, Asset catalog | **PASS / OPERATIONAL** | Studio-owned. Running as background daemon, loaded with review dataset, connected to ComfyUI (`comfyui-local`) and Street Yun. |
| **Krita** | 4.4.2 (`C:\Program Files\Krita (x64)\bin\krita.exe`) | Concept art, texture raster painting, touch-ups | **PASS / OPERATIONAL** | GNU GPL v3+. Verified present on disk. |
| **Inkscape** | 1.3.2 x64 (`D:\dev\Northern Step Studio\tools\inkscape`) | 2D vector art, UI icons, HUD graphics, difficulty stars | **PASS / OPERATIONAL** | GNU GPL v3+. Portable x64 distribution installed on D:\\ to avoid admin elevation and prevent ARM architecture conflicts. |
| **Material Maker** | 1.7 (`D:\dev\Northern Step Studio\tools\material_maker_1_7_windows\material_maker.exe`) | Procedural PBR textures and material graphs | **PASS / OPERATIONAL** | MIT License. Godot 4.7-based procedural material authoring tool installed portably on D:\\. |
| **Audacity** | 4.0.1 (`D:\dev\Northern Step Studio\tools\audacity\...\bin\Audacity4.exe`) | Audio inspection, spectral analysis, cleanup, trim | **PASS / OPERATIONAL** | GNU GPL v3+. Portable 64-bit edition installed on D:\\. |
| **REAPER** | Cockos REAPER 7.82 (`Cockos.REAPER`) | Music sequencing, stem arrangement, mixing, mastering, automation | **EVALUATION READY** | 60-day fully functional trial. Discounted license ($60 for gross revenue <$20k) / Commercial license ($225). Requires owner purchase approval before commercial deployment. |
| **ACE-Step 1.5** | Python AI music generation | Local instrumental loops and track generation | **EVALUATED** | Open code. Evaluated for CPU / DirectML compatibility on Windows. |
| **Stable Audio 3.0 / Open**| Open weights diffusion model | Local AI sound effects and Foley generation | **EVALUATED** | Stability Community License. Permissive for qualifying developers; DirectML/ONNX implementation mapped. |
| **UltraTex** | AI mesh texture generation | 3D texture synthesis | **INCOMPATIBLE / BLOCKED** | Requires NVIDIA CUDA tensor cores; incompatible with AMD Radeon RX 7700 XT hardware. Procedural texture workflow assigned to Material Maker and Blender. |
| **Hyper3D ACT** | Automated rigging and animation | Rigging pipeline | **REJECTED** | Formally rejected per studio policy: proprietary closed cloud service with recurring fees and uncertain provenance. Replaced with Blender Rigify and studio Python rigging automation. |
| **Rokoko Studio Starter**| Motion capture processing | Mocap cleanup | **OPTIONAL / EVALUATED** | Evaluated for future opt-in mocap animation passes. Offline keyframe/procedural animation in Blender remains primary. |

---

## 3. Operational Constraints & Boundaries

1. **AMD GPU / DirectML Mandate:**
   - Any AI model, node, or package requiring CUDA fails on this PC.
   - All PyTorch execution must use `torch_directml` with device `privateuseone:0` or fall back to high-speed CPU multi-threading.
   - ComfyUI is pinned to `--directml`.
2. **Drive Capacity Guardrail:**
   - `C:\` has ~27 GB remaining. Never download large weights, caches, or virtualenvs to `C:\Users\...\.cache` or `%APPDATA%`.
   - Models must be stored on `D:\` (e.g. `D:\dev\ComfyUI\models`) or `L:\`.
3. **Zero Third-Party Runtime Asset Rule:**
   - Per Yun Issue #18, release builds of Street Yun must contain **100% original Northern Step Studio creative assets**.
   - Kenney models and BigSoundBank audio files remain active solely as non-shipped development fallbacks until original replacements pass all verification gates.
4. **Licensing & Cost Governance:**
   - No recurring software subscriptions are authorized.
   - Perpetual, open-source, or royalty-free tools are mandatory.
   - REAPER commercial license purchase requires explicit user sign-off after evaluation.
