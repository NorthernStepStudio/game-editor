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
Phase 3G (this continuation) generalizes Blender into a structured operation pipeline, async execution, artifact confinement, execution manifests, humanoid rig/animation prototype, `YunCharacterContract`, and a real **Matterhorn → Blender → Flyrail → Godot** character validation path.

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

## Verification performed here

| Check | Result |
| --- | --- |
| Clean npm installation | PASS |
| Core and server TypeScript compilation | PASS |
| Existing core and server smoke checks | PASS |
| Controller, persistence, workspace, API, DOM, criterion, Blender, character, negative, Flyrail-slice tests | PASS — `npm run check` (deterministic suite; Flyrail live slice skips cleanly when daemon absent) |
| Existing Flyrail adapter unit checks | PASS — 28 checks (`node core/out/test/flyrailAdapter.test.js`) |
| Dedicated live Blender/Flyrail/Godot command | PASS — `npm run test:blender-live` (21/21) with Blender 5.2.1, Godot 4.7.2, Flyrail daemon live |
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
3. Run `npm run test:live` for the Studio Flyrail gate. Run `npm run test:blender-live` for Blender + Flyrail character pipeline proof. Missing prerequisites must exit nonzero (never a silent pass).
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
- Yun production character generation is **not** delivered by Phase 3G; the pipeline foundation and disposable humanoid proof are. Next: Yun character generation vertical slice using the Blender specialist.

## Concurrent Phase 3 integration

The upstream branch advanced during implementation. This change builds on `242de254` and keeps its public `StudioRunController({registry,...})`, `executeRun`, `cancelRun`, event, registry and injected-store interfaces. They delegate to the same execution engine used by the standalone API; there is no second scheduler. Snapshot events support the UI, while the existing event vocabulary and run shape remain available to callers. Required capabilities and output artifacts are enforced.

Intentional behavior changes: generic successful summaries cannot prove acceptance; unknown submission outcomes are never automatically replayed; unsupported cancellation cannot produce a terminal cancelled state. The earlier controller tests that accepted summary-only evidence or retried mutations are superseded by stronger engine and public-API regression tests. Custom validators may add stricter checks but cannot bypass the evidence gate. The injected legacy store is a snapshot mirror; it does not implement restart recovery.

## Workspace continuation validation

The prior commit `ccad4df440064b42b99fea3bc4bf43c361a697fb` passed GitHub Actions on both Ubuntu and Windows (run 35810822353). This continuation adds standalone file browsing/search, AI file assistance, persistent reviewed edits, safe restore, and interrupted-write reconciliation.

Latest CI verification: core/server compilation and smoke checks PASS on the deterministic suite. Cloud provider output is not validated by mock tests. Rendered visual QA and the real Flyrail/Godot gate remain pending PC checks when the daemon is not running in CI.
