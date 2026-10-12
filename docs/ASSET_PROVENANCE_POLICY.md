# Northern Step Studio — Creative Asset Provenance & Originality Policy

**Effective Date:** October 9, 2026  
**Scope:** All shipped creative assets for Street Yun, Matterhorn Studio, and Northern Step Studio titles.  
**Authoritative Reference:** Street Yun Release Gate (Issue #18) & Real-Money Store Architecture (Issue #19).

---

## 1. Core Principle: 100% Studio-Original Creative Assets

Street Yun and subsequent Northern Step Studio commercial titles must ship with **100% original Northern Step Studio creative assets**.

1. **Zero Third-Party Creative Stock in Release Packages:**
   - Shipped game builds may contain **no third-party characters, 3D models, textures, animations, audio recordings, sample packs, UI icons, or font files**, even if released under CC0, public domain, or attribution-free permissive licenses.
   - All third-party assets currently in development repositories (e.g. Kenney mini-characters, Kenney textures, BigSoundBank sounds) are strictly **temporary development placeholders** and must never be included in release distributions.
2. **Third-Party Development Software vs. Creative Content:**
   - The use of properly licensed third-party development software (Blender, Godot Engine, ComfyUI, Krita, Inkscape, Material Maker, REAPER, Audacity) and open-source software libraries is permitted and encouraged.
   - Permitted software tools must not introduce stock creative assets, sample loops, or proprietary third-party character templates into final exported game files.

---

## 2. Mandatory Provenance Record Requirements

For every produced creative asset intended for production or release, Matterhorn and the production pipeline must capture and persist an immutable provenance record containing:

| Field | Description / Format | Example |
|---|---|---|
| **Asset ID** | Unique kebab-case or snake_case identifier | `yun_urban_adventurer` / `sfx_tag_hit` |
| **File Path** | Canonical path relative to game project root | `assets/matterhorn/yun_player_base.glb` |
| **Creation Tool & Version** | Primary authoring software and exact version | `Blender 5.2.1 LTS` / `Inkscape 1.3.2` |
| **AI Provider / Model & Version** | If AI-assisted, exact model, checkpoint hash, and provider | `ComfyUI v0.3.70 / v1-5-pruned-emaonly (hash: 6ce0161692)` |
| **Model License & Commercial Terms** | Exact commercial license governing the AI model | `CreativeML Open RAIL-M (permissive, commercial-eligible)` |
| **Input Prompts & Source References** | Full prompt string, negative prompt, seed, CFG, source reference hashes | `seed: 42, cfg: 7, ref: foundry-urban-front (hash: ...)` |
| **Creation Date** | ISO 8601 UTC timestamp | `2026-10-09T23:08:05.878Z` |
| **Source Project File** | Path to source project (`.blend`, `.svg`, `.rpp`, `.mmg`) | `artifacts/yun-character-candidate/.../yun_urban_adventurer.blend` |
| **Modification History** | Chronological record of human edits, cleanups, and retouches | `Human geometry cleanup, UV unwrapping, rig weight painting` |
| **Rights & Copyright Assessment** | Legal clearance classification (`original-internal`, `licensed-permissive`) | `original-internal` |
| **Human Approval Status** | Explicit sign-off by human creator/lead (`approved`, `rejected`, `pending`) | `approved (Lead Artist Review)` |

---

## 3. Generative AI Governance & Rights Management

1. **No Silent Fallbacks to Mock Data:**
   - Matterhorn and its specialist adapters must never fall back silently to mock outputs or placeholder images when an AI provider fails. Failures must fail closed with explicit diagnostic logs.
2. **Noncommercial Models Strictly Prohibited:**
   - Models trained on noncommercial-only datasets or licensed under noncommercial restrictions (e.g. Meta MusicGen / AudioGen CC-BY-NC 4.0, AudioLDM2 noncommercial weights) are **strictly forbidden** from generating release assets.
3. **Training & Copyright Hygiene:**
   - AI prompts and inputs must never request copies, parodies, or trademark infringements of third-party characters, real individuals, or copyrighted franchises.
   - Generated outputs must serve as raw concept or texture inputs subjected to human artistic direction, 3D modeling, synthesis, and review.
4. **No Assumption of Exclusive Copyright from Raw AI Output:**
   - Unaltered raw AI outputs do not confer exclusive statutory copyright protection in major jurisdictions. Originality and copyright ownership are established through studio-authored prompt recipes, Character DNA definitions, 3D mesh sculpting, custom rigging, texture hand-painting, and human editorial arrangement.

---

## 4. Preservation & Rollback Rules

1. **Non-Destructive Replacement:**
   - Never delete an existing working asset (e.g. Kenney fallback models or interim sounds) before its original replacement has been validated, imported into Godot, and confirmed functional in headless runtime tests.
2. **Immediate Rollback Mechanism:**
   - Every replacement asset must provide a zero-downtime rollback configuration (e.g. `character_id = 0` in `GameSettings` restores Kenney models without scene corruption).
3. **Persistent Production Tree:**
   - All source candidate files, turnaround sheets, multi-view renders, Blender projects, and diagnostic reports must be preserved in versioned project directories under `artifacts/` or `assets/` on disk.
