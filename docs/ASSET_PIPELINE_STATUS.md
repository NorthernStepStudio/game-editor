# Northern Step Studio — Asset Pipeline Production Status

**Date:** October 9, 2026  
**Project:** Street Yun (Offline PvE Priority Release)  
**Orchestration Engine:** Matterhorn v0.1.0 (`http://127.0.0.1:3456`)  
**Pipeline Policy:** Adopt-before-build for tools; 100% Studio-original for runtime creative assets.

---

## 1. Executive Status Overview

| Pipeline Track | Current Status | Primary Toolchain | Evidence / Artifact Verification |
|---|---|---|---|
| **1. Character Studio** | **PASS / OPERATIONAL** | Matterhorn + ComfyUI DirectML | Golden character `yun-urban-adventurer` cleared release eligibility. Canonical 7-slot turnaround sheet, 3D GLB, animations, landmark charts, and provenance verified. |
| **2. 3D Forge & Rigging** | **PASS / OPERATIONAL** | Blender 5.2.1 LTS + Python Automation | Rigged 18-bone humanoid skeletons, skin weights, materials (`MAT_TeamShirt`), animations (`idle`, `walk`, `run`), polygon count optimization (5,328 verts / 4,912 quads). |
| **3. Gameplay Runtime Mount** | **PASS / OPERATIONAL** | Godot 4.7.2 Headless + Flyrail Probes | `yunCharacterSlice.test.js` & `yunCharacterV2Slice.test.js` pass with 0 errors. Mounts cleanly to `YunMiniFigure`, dynamic team-color modulation verified. |
| **4. Environment Production** | **PARTIAL / IN PROGRESS** | Blender 5.2.1 + Material Maker 1.7 | Opt-in 4-map set (Calle, Malecón, Parque, Noche) generated and validated via headless scene transitions. Modular Dominican street props in production. |
| **5. Audio Studio** | **PARTIAL / IN PROGRESS** | Audacity 4.0.1 + REAPER Evaluation | Audacity portable operational. REAPER evaluation ready. Target track/SFX specifications defined. AI synthesis mapped for DirectML/CPU. |
| **6. UI, Skins & Vector Art** | **PARTIAL / IN PROGRESS** | Inkscape 1.3.2 + Krita 4.4.2 | Portable Inkscape and Krita operational. 2D asset replacement matrix created for buttons, stars, HUD, and Dominican typography. |

---

## 2. Track Details & Evidence Audit

### Track 1: Character Studio
- **Status:** **PASS**
- **Production Art Style:** Promoted official production style profile `yun-character-style-v1` (*Yun Dominican Street-Sport Style v1*, `shippable: true`, `status: "production"`).
- **Candidate Clearance:** `yun-urban-adventurer` cleared release gate blockers in Matterhorn (`eligible: true`, `reasons: []`).
- **Identity & Provenance:**
  - Character DNA locked: warm tan skin, messy dark ponytail with orange tie, cropped cream/orange jacket, utility shorts over leggings, chunky sneakers, gold hoop earrings.
  - Provenance: `original-internal` (100% studio-owned, no third-party stock).
  - Turnaround Views: Full 7-slot coverage (`front`, `back`, `left`, `right`, `three-quarter`, `face`, `a-pose`) located at `artifacts/yun-character-candidate/yun_urban_adventurer/reference/`.
  - 3D Model: `yun_urban_adventurer.glb` (510 KB, 18-bone skeleton, 5,328 vertices, 4,912 quads/tris).
  - Visual Sanity & Comparison: Passed automated landmark comparison tests against 2D turnaround views (`Crown`, `Eyes`, `Shoulders`, `Waist`, `Hips`, `Knees`, `Feet`).

### Track 2: 3D Forge & Blender Rigging
- **Status:** **PASS**
- **Execution Proof:** Verified via native test runner:
  - `core/out/test/yunCharacterSlice.test.js`: 5/5 tests passed in 12.7s.
  - `core/out/test/yunCharacterV2Slice.test.js`: 2/2 tests passed in 7.8s.
  - `core/out/test/yunRosterSlice.test.js`: 3/3 tests passed in 21.7s.
- **Contract Adherence:** Humanoid bone mapping, loopable `idle`, `walk`, and `run` animation tracks, non-destructive team shirt color tinting (`MAT_TeamShirt`), and 1.2x scale match with gameplay camera.

### Track 3: Street Yun Runtime Mount & Opt-in Mechanics
- **Status:** **PASS**
- **Architecture:** Opt-in character model slot (`YunMiniFigure.MODEL_YUN_PLAYER_BASE = 12`) coexists with Kenney models.
- **Fail-Closed Safety:** Default game settings maintain Kenney model fallback (`character_id = 0`) to prevent breaking existing game builds until full replacement sign-off.
- **Integrity Rule:** `tests/yun_character_integrity.gd` in `games/Yun` enforces zero synthetic box/capsule fallback geometry and blocks unauthorized asset naming drifts.

### Track 4: Environment Production
- **Status:** **PARTIAL**
- **Current Baseline:** Four distinct Dominican court environments generated via Blender adapter:
  1. *Calle* (Dominican residential street court with colonial facades and roadside curbs).
  2. *Malecón* (Coastal boulevard with sea wall and ocean horizon).
  3. *Parque* (Public park with trees, benches, and perimeter fences).
  4. *Noche* (Evening match under warm sodium streetlights and string lighting).
- **Next Milestone:** Authoring modular reusable assets (storefronts, utility poles, balconies, street signs, motorcycles) using Material Maker procedural shaders to replace placeholder props.

### Track 5: Audio Studio
- **Status:** **PARTIAL**
- **Installed Tools:** Audacity 4.0.1 (portable 64-bit) operational on D:\\ for waveform/spectrogram inspection, editing, and trim.
- **Sequencing Tool:** REAPER 7.82 evaluation configured.
- **Target Asset Matrix:**
  1. `menu_theme.ogg` (Warm Dominican acoustic percussion / Afro-Caribbean rhythm).
  2. `gameplay_match.ogg` (Dynamic street-sport tempo, driving beat, seamless loop).
  3. `match_end_victory.ogg` / `match_end_defeat.ogg` (Short match resolution stings).
  4. `sfx_tag.wav` (Clean, crisp physical contact cue).
  5. `sfx_footstep_pavement.wav` (Sneaker friction and ground contact).
  6. `ambience_street_day.ogg` / `ambience_street_night.ogg` (Distant traffic, breeze, city murmur).
  7. `sfx_dog_bark.wav` (Original Dominican neighborhood dog bark replacement for BigSoundBank sample).

### Track 6: UI, Skins & Vector Art
- **Status:** **PARTIAL**
- **Installed Tools:** Inkscape 1.3.2 x64 (portable vector editor) and Krita 4.4.2 (raster painting) operational on D:\\.
- **Target Deliverables:**
  - 100% original SVG vector icons: difficulty stars, play button, pause button, settings gear, audio sliders.
  - HUD overlays: defense meter, score indicators, match clock banner.
  - In-game character skins: cosmetic palette variants (`Street Stealth Black`, `Tropical Mango Yellow`, `Caribbean Azure Blue`).
  - Studio-owned lettering / typography: Custom display numbers and titles avoiding external font files.
