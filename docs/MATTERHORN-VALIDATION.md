# Matterhorn standalone milestone: validation and PC handoff

Date: September 23, 2026.
Latest HEAD SHA: record branch tip with `git rev-parse HEAD` on `feat/standalone-studio-20260923` (currently advanced past Phase 3G implementation commits below).
Previous verified PR #2 head before this continuation: `d7e9ff2351c7312cc090260b032afe7d0bba155c`.
Phase 3G commits: `8ae1c94` (pipeline), `fe0ce87` (rig/animation foundation), `55abbc5` (Flyrail/Godot tests), `990f3fd`/`ecd13c9` (docs + provenance).
Flyrail HEAD SHA: `08eff88e045ad0cebfa64042316cd11d2979a838` on `feature/playtest-agent-v3-source-repair`.
Blender Version: `5.2.1 LTS` (`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`).

Phase 3C (`a56b22b92aca86334e2d078c9d33a32cc8d1c781`) added disk-backed Studio history and fail-closed restart reconciliation; GitHub Actions run `35866393474` passed on Ubuntu and Windows. Phase 3D through `695323ccea65bb8a6fc53cd3baa145839154fc7e` added reviewed multi-file transactions, server-configured validation tasks, standalone UI controls, and end-to-end regression coverage; GitHub Actions run `35868076819` passed on Ubuntu and Windows.
Phase 3E (`c1b4eb9ce964e403e4841b1096c02b5c5fee1e3e`) implemented typed criterion-specific gameplay acceptance validation (`property_equals`, `property_range`, `node_exists`, `movement_position`, `health_damage`, `timed_scenario`, `generic`), fail-closed criterion checking, structured UI rendering, and end-to-end live proof.
Phase 3F (`d7e9ff2351c7312cc090260b032afe7d0bba155c`) implemented the Blender 3D specialist bootstrap (`BlenderAdapter` for `blender-engine`), headless execution, procedural crate fixture (`crate.blend` / `crate-preview.png` / `crate.glb`), and **direct Godot** import validation (`Matterhorn → BlenderAdapter → Blender → crate.glb → Godot`). That crate slice did **not** invoke Flyrail.
Phase 3G generalizes Blender into a structured operation pipeline, async execution, artifact confinement, execution manifests, humanoid rig/animation prototype, `YunCharacterContract`, and a real **Matterhorn → Blender → Flyrail → Godot** character validation path.
Phase 3H delivers the first Yun production-candidate `yun_player_base` (structured Blender ops, multi-view renders, animated GLB, Flyrail disposable import + YunMiniFigure-compatible wrapper motion probe). Candidate archived at `artifacts/yun-character-candidate/yun_player_base/`.
The production character gate refines that candidate to `yun_player_base_v2` and installs it as an **opt-in** production model (`games/yun/assets/matterhorn/yun_player_base.glb`, `YunMiniFigure` index 12 / display name `Yun`). Kenney models 0–11 remain; default `character_id = 0`. Rollback requires no asset deletion.
Roster v1 adds three CharacterVariantSpec-generated players (`yun_player_02` Raya, `yun_player_03` Kade, `yun_player_04` Mira) at indexes 13–15 on the same contract. Archive: `artifacts/yun-character-candidate/yun_roster_v1/`.

## Delivered in this change

- Canonical Matterhorn package identity, standalone README/start path and default core/server build. Optional extension retained but excluded from default workspaces.
- Modular adapter registry, dependency scheduler, run store, timestamps, unique execution IDs, bounded polling/read retries, mutation retry prohibition, cancellation tracking and events.
- Task and final acceptance checks. Flyrail evidence is read from the persisted bundle, confined to the selected project's evidence directory and matched to the execution ID and report gate values.
- Real local server routes for plan review, start/list/detail/cancel/evidence, SSE updates, configured projects and safe health/provider information. Same-origin/loopback checks, body limits, static path confinement and CSP.
- Standalone Chat/Studio/Projects/Evidence/Settings. No internal-agent selector. Project/goal/criteria → review → run → live status → evidence download. Mock chat and missing connections are visible.
- Native Node WebSocket transport, shared connection, report requestId correction and uncertain-timeout handling.
- An explicit live controller gate and corrected legacy integration assertions. Missing prerequisites fail rather than create a green skipped gate.
- Full Ubuntu and Windows deterministic CI workflow restored to 100% GREEN (fixed workspace transaction timing race condition in `web/workspace.js`).
- Typed Criterion-Specific Gameplay Acceptance Proof System (`criterionValidator.ts`): structured acceptance criteria contract, check type classification (`property_equals`, `property_range`, `node_exists`, `movement_position`, `health_damage`, `timed_scenario`, `generic`), deterministic measurement validation, fail-closed handling for missing or unmeasured criteria, and Studio UI rendering.
- Extended Flyrail evidence schema (`EvidenceBundle` & `LoopReport`) to transmit structured `criterionResults`.
- End-to-end live proof tests (`criterionLive.test.ts`) covering positive completion, measurement mismatches (failure), and missing custom evidence (blocked).
- Blender specialist generalization: bounded `BlenderOperation` commands, validated `BlenderTaskSpec`, controlled Python compiler (no arbitrary user Python), crate/humanoid fixtures composed from primitives, async child-process lifecycle, `blender-task.json` / `blender-result.json` manifests with execution identity, artifact confinement, character/rig/animation capabilities, `YunCharacterContract`, and Flyrail-owned Godot GLB validation (`validateGlbThroughFlyrail`).
- Yun character candidate `yun_player_base`: street-sports stylized figure, `MAT_TeamShirt` team-color surface, 18-bone armature, idle/walk/run, multi-view evidence, `npm run test:yun-character-live`, disposable Flyrail/Godot validation.
- Yun production character gate (`yun_player_base_v2`): art/animation refinement, visual sanity checks, gameplay-camera + team-color probes, opt-in production path + Kenney fallback, production integration test `yunProductionCharacterIntegration.test.ts`.

## Yun candidate snapshot (Phase 3H)

| Item | Value |
| --- | --- |
| Asset | `yun_player_base` |
| Archive | `artifacts/yun-character-candidate/yun_player_base/` |
| Geometry | 1042 vertices, 820 polygons |
| Materials | `MAT_Skin`, `MAT_TeamShirt` (team), `MAT_Shorts`, `MAT_Shoes`, `MAT_Accent` |
| Bones | 18 |
| Animations | `idle`, `walk`, `run` |
| GLB size | ~269 KB |
| Wrapper AABB height @1.2 | ~1.74 |
| Production Yun integration | disposable validation only (superseded by v2 opt-in below) |

## Yun production character gate snapshot (`yun_player_base_v2`)

| Item | Value |
| --- | --- |
| Asset / revision | `yun_player_base_v2` / `2.0.0` |
| Archive | `artifacts/yun-character-candidate/yun_player_base_v2/` |
| Geometry | ~6488 vertices, ~6532 polygons |
| Materials | `MAT_Skin`, `MAT_TeamShirt` (team), `MAT_Shorts`, `MAT_Shoes`, `MAT_Accent`, `MAT_Hair`, `MAT_Eyes` |
| Bones | 18 (unchanged contract) |
| Animations | `idle`, `walk`, `run` (art pass) |
| GLB size | ~1.5 MB |
| Production asset | `games/yun/assets/matterhorn/yun_player_base.glb` |
| Model selector | `YunMiniFigure.MODELS[12]` / `MODEL_YUN_PLAYER_BASE` / name `Yun` |
| Team color | tint materials containing `TeamShirt`; sash unchanged |
| Default | Kenney (`character_id = 0`) |
| Rollback | picker/config to 0–11; no asset deletion |
| Playable PC | PASS — 6-player team-color mount, idle/walk/run, Kenney fallback remount |
| Known limitations | Still modular/low-poly; hands/face are indications not final art; not promoted as global default |

## Yun Matterhorn roster v1 snapshot

| Item | Value |
| --- | --- |
| Revision | `1.0.0` |
| Archive | `artifacts/yun-character-candidate/yun_roster_v1/` |
| Indexes | 12 Yun · 13 Raya · 14 Kade · 15 Mira (`CHAR_MAX = 15`) |
| Contract | 18 bones, idle/walk/run, `MAT_TeamShirt`, wrapper scale 1.2 |
| Geometry budget | ≤8000 verts/polys (v2 reference ~6488/6532) |
| Live command | `npm run test:yun-roster-live` |
| Production mix | PASS — lineup + 6-player Matterhorn mix + Kenney fallback remount |
| Team color | Per-instance TeamShirt tint; isolation shot captured |
| Performance | ~30 animation-advance loops over ~1.5s (~20 loops/s); not a GPU FPS claim |
| Rollback | `character_id` 0–11; assets retained |
| Known limitations | Hair/jersey differences read at distance; face/hands still schematic; default Kenney |

## Yun environment Calle v1 snapshot

| Item | Value |
| --- | --- |
| Asset ID | `yun_street_block_calle_v1` |
| Archive | `artifacts/yun-environment-candidate/yun_street_block_calle_v1/` |
| Production GLB | `games/yun/assets/matterhorn/yun_street_block_calle_v1.glb` in Flyrail |
| Generator | Reusable `YunEnvironmentAssetSpec` + structured Blender operations |
| Geometry | 4,050 vertices; 3,524 polygons; 77 meshes / 79 scene objects; 10 materials; GLB 559,840 bytes |
| Evidence | Blender `.blend`, `.glb`, JSON task/result/report, logs, six preview renders; Flyrail/Godot runtime report and start/walk/turn/return screenshots |
| Live command | `npm run test:yun-environment-live` (Blender 5.2, Godot 4.7.2, running Flyrail daemon, `FLYRAIL_REPO_ROOT`) |
| Disposable import | PASS — Flyrail opens a Yun project copy, Godot imports 77 environment meshes, and the procedural YunCourt remains unchanged |
| Camera + six-player route + tag | PASS — all 77 environment mesh origins project into the active game camera; six players visible; attackers walk, cross a tube, turn at TURN and return toward YUN; then the production `Area3D` tag resolves and swaps roles |
| Production selector | Opt-in `matterhorn_calle`; Kenney remains default. The fallback clone starts with six visible players and no Matterhorn scene; Kenney Calle assets are retained |
| Court and collision policy | Environment is visual-only; no gameplay markings or play-area intrusions. YunCourt/actors retain gameplay geometry and collision ownership |
| Runtime observation | Opt-in match scene runs for at least 20 seconds and records elapsed observation time in `godot/matterhorn-runtime.json`; route and tag screenshots include the game HUD |
| Performance | Mesh/object/material/GLB counts recorded above. No sustained frame-time or FPS claim was collected |
| Known limits | Defender AI is paused during the scripted route, then the real tag area/role-swap path is exercised at a tube. This automated run does not replace a human keyboard playtest. Calle is the only Matterhorn map in this milestone; other maps remain on existing dressing |

## Verification performed here

| Check | Result |
| --- | --- |
| Clean npm installation | PASS |
| Core and server TypeScript compilation | PASS |
| Existing core and server smoke checks | PASS |
| Controller, persistence, workspace, API, DOM, criterion, Blender, character, negative, Flyrail-slice tests | PASS — `npm run check` (deterministic suite; Flyrail live slice skips cleanly when daemon absent) |
| Existing Flyrail adapter unit checks | PASS — 28 checks (`node core/out/test/flyrailAdapter.test.js`) |
| Dedicated live Blender/Flyrail/Godot command | PASS — `npm run test:blender-live` |
| Dedicated Yun character live command | PASS — `npm run test:yun-character-live` (includes v2 + production integration) |
| Yun `yun_player_base` Blender + Flyrail + wrapper motion | PASS — session + Skeleton3D + AnimationPlayer + idle/walk/run + motion sequence |
| Yun `yun_player_base_v2` art + visual sanity + gameplay camera | PASS — archive + team A/B shots |
| Yun production opt-in + Kenney fallback | PASS — mount index 12, remount 0, 6-player team colors |
| Yun Matterhorn roster v1 (Raya/Kade/Mira) | PASS — `npm run test:yun-roster-live` (generate + Flyrail + production lineup/mix) |
| Direct Blender crate fixture | PASS — structured ops → `crate.blend` / preview / `crate.glb` |
| Direct Godot crate import (not Flyrail) | PASS — `blenderGodotSlice.test.ts` |
| Humanoid prototype (Blender) | PASS — armature, idle/walk/run, multi-view previews, animated `humanoid.glb` |
| Matterhorn → Blender → Flyrail → Godot humanoid | PASS — Flyrail `project.open` / list / validate / probe; fail-closed on missing animations |
| Negative cases | PASS — unsupported op, unsafe path, missing/empty artifacts, timeout, crash, mismatched execution ID, Flyrail downstream failure |
| PC Environment Verification | PASS — Node v25.2.1, Blender 5.2.1 LTS, Godot 4.7.2, Flyrail daemon (`ws://127.0.0.1:7520`) |

Deterministic tests do not establish real Godot execution or visual UI quality unless the dedicated live command is run. No merge or release promotion was performed.

## PC acceptance checklist

Use the review branch in a separate checkout so existing local edits are preserved. Requires Node 22+, Git, the existing Flyrail setup and Godot.

1. Run `npm ci` and `npm run check`. Both must finish successfully.
2. Start Flyrail using its existing instructions (`flyrail daemon start --live`). Configure `FLYRAIL_REPO_ROOT` (daemon discovery) or `FLYRAIL_DAEMON_URL` plus `FLYRAIL_DAEMON_TOKEN` in Matterhorn's server environment. Do not paste tokens into the browser.
3. Run `npm run test:live` for the Studio Flyrail gate. Run `npm run test:blender-live` for Blender + Flyrail character pipeline proof. Run `npm run test:yun-character-live` for the Yun candidate. Missing prerequisites must exit nonzero (never a silent pass).
4. Set `MATTERHORN_PROJECTS` to an array of `{id,name,path}` entries for a disposable local Godot project. Use forward slashes or correctly escaped Windows paths in JSON. Start `npm run dev:server`, then open the printed loopback URL.
5. Inspect all five screens on your display. Check text, scrolling, keyboard focus, window resizing and readable errors. Chat must show mock mode unless a real provider is configured. Verify a real provider reply when your credentials are available.
6. Review and run a supported Godot request. For baseline gate validation use the exact criteria `Godot validation passes`, `Scenario checks pass`, and `QA checks pass`. Add `Playtest passes` only when the project has a genuine supported playtest. Read the returned evidence; generic gates do not prove requested gameplay behavior.
7. Confirm failure cases: daemon offline, missing project, unsupported/custom criterion and deliberately failing disposable validation. None may show completed.
8. Request cancellation mid-run. The UI must state pending cancellation while Flyrail continues; downstream tasks must not start. On unconfirmed timeout the controller must prevent another run. Stop/check remote work before restarting.
9. Refresh the browser during a run and reopen its activity. Download evidence. Restart Matterhorn and confirm saved run history returns. If Flyrail still reports recovered work active/unknown, Matterhorn must remain fail-closed and block overlapping work; it must not resubmit the mutation.
10. Record Matterhorn/Flyrail commit IDs, Godot/Node versions, exact commands, exit codes, screenshots and evidence paths. Do not merge until this gate passes.

## Explicit limitations and later work

- The UI plans one Godot execution task; the core scheduler supports DAGs. An autonomous multi-domain natural-language planner is not implemented by this change.
- The current Flyrail evidence schema proves four named gate checks only for `loop.run` gameplay. Character GLB validation uses Flyrail session/runtime APIs plus disposable probe evidence; it does **not** use `loop.run` (benchmark-only / can rewrite projects).
- Flyrail does not provide active loop cancellation. Matterhorn cannot safely manufacture that capability; it exposes the limitation and blocks unsafe overlapping runs.
- Studio snapshot/evidence metadata is durable on disk and restart reconciliation is implemented. Matterhorn deliberately does not resume an uncertain mutation. Multi-user service hosting and true remote cancellation remain later work.
- Existing extension-only workspace editing/review tools are not all migrated into the standalone UI. The extension stays optional as migration reference.
- Yun production character and roster v1 gates are complete: the character and Raya/Kade/Mira variants are integrated as opt-in production choices, with Kenney defaults and rollback retained. The Calle environment gate is live-validated as opt-in, including the scripted route and production tag/role-swap path. Human keyboard match play and frame-time/FPS measurement remain open checks.

## Concurrent Phase 3 integration

The upstream branch advanced during implementation. This change builds on `242de254` and keeps its public `StudioRunController({registry,...})`, `executeRun`, `cancelRun`, event, registry and injected-store interfaces. They delegate to the same execution engine used by the standalone API; there is no second scheduler. Snapshot events support the UI, while the existing event vocabulary and run shape remain available to callers. Required capabilities and output artifacts are enforced.

Intentional behavior changes: generic successful summaries cannot prove acceptance; unknown submission outcomes are never automatically replayed; unsupported cancellation cannot produce a terminal cancelled state. The earlier controller tests that accepted summary-only evidence or retried mutations are superseded by stronger engine and public-API regression tests. Custom validators may add stricter checks but cannot bypass the evidence gate. The injected legacy store is a snapshot mirror; it does not implement restart recovery.

## Workspace continuation validation

The prior commit `ccad4df440064b42b99fea3bc4bf43c361a697fb` passed GitHub Actions on both Ubuntu and Windows (run 35810822353). This continuation adds standalone file browsing/search, AI file assistance, persistent reviewed edits, safe restore, and interrupted-write reconciliation.

Latest CI verification: core/server compilation and smoke checks PASS on the deterministic suite. Cloud provider output is not validated by mock tests. Rendered visual QA and the real Flyrail/Godot gate remain pending PC checks when the daemon is not running in CI.
