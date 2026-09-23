# Matterhorn standalone milestone: validation and PC handoff

Date: September 23, 2026.
Latest HEAD SHA: `191240b33475155ab92fca5926870b00fbfc2fb6` on `feat/standalone-studio-20260923`.
Flyrail HEAD SHA: `08eff88e045ad0cebfa64042316cd11d2979a838` on `feature/playtest-agent-v3-source-repair`.
Blender Version: `5.2.1 LTS` (`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`).

Phase 3C (`a56b22b92aca86334e2d078c9d33a32cc8d1c781`) added disk-backed Studio history and fail-closed restart reconciliation; GitHub Actions run `35866393474` passed on Ubuntu and Windows. Phase 3D through `695323ccea65bb8a6fc53cd3baa145839154fc7e` added reviewed multi-file transactions, server-configured validation tasks, standalone UI controls, and end-to-end regression coverage; GitHub Actions run `35868076819` passed on Ubuntu and Windows.
Phase 3E (`c1b4eb9ce964e403e4841b1096c02b5c5fee1e3e`) implemented typed criterion-specific gameplay acceptance validation (`property_equals`, `property_range`, `node_exists`, `movement_position`, `health_damage`, `timed_scenario`, `generic`), fail-closed criterion checking, structured UI rendering, and end-to-end live proof.
Phase 3F (`191240b33475155ab92fca5926870b00fbfc2fb6`) implemented the Blender 3D specialist foundation (`BlenderAdapter` for `blender-engine`), background headless python execution, procedural asset generation (`crate.blend`), preview rendering (`crate-preview.png`), GLB export (`crate.glb`), inspection reporting (`crate-report.json`), and full cross-tool vertical slice verification into Godot (`Matterhorn → BlenderAdapter → Blender → crate.glb → Godot import → Evidence`).

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
- Blender 3D Specialist Foundation (`BlenderAdapter`, `blenderProcess.ts`, `blenderScriptGenerator.ts`): non-interactive background execution, executable discovery, workspace path confinement, procedural asset creation, preview rendering, GLB export, inspection reporting, and full cross-tool Godot asset import validation (`blenderGodotSlice.test.ts`).

## Verification performed here

| Check | Result |
| --- | --- |
| Clean npm installation | PASS |
| Core and server TypeScript compilation | PASS |
| Existing core and server smoke checks | PASS |
| Controller, persistence, workspace transaction/validation, API, DOM, criterion validator, BlenderAdapter & cross-tool slice tests | PASS — 60/60 on latest test run (`npm run test:studio`) |
| Existing Flyrail adapter unit checks | PASS — 28 checks (`node core/out/test/flyrailAdapter.test.js`) |
| Total Matterhorn check suite | PASS — 88/88 total checks green (`npm run check`) |
| Flyrail autoloop evidence & loop tests | PASS — 10/10 checks (`npm test` in Flyrail) |
| Native WebSocket fragmented 70 KB responses, concurrent requests and timeout | PASS against a local test server |
| UI navigation, project selection, plan review, run/cancel display, chat history, criterion evidence | PASS in jsdom with simulated API responses |
| Live Flyrail/Godot controller gate (`npm run test:live`) | PASS — Exit code 0, status `completed`, evidence written to `.matterhorn/evidence/studio-live.json` |
| Criterion Live Proof Suite (`criterionLive.test.ts`) | PASS — Positive case completed, mismatched measurement failed, missing custom evidence blocked |
| Direct Blender Background Probe & Crate Test | PASS — `blender.exe` 5.2.1 LTS found, `crate.blend`, `crate-preview.png` (371 KB), `crate.glb` (10.6 KB), `crate-report.json` produced |
| Godot GLB Import & Instantiation Test | PASS — `crate.glb` imported into Godot 4.7.2, `Crate_Body` & `Crate_Detail` nodes instantiated (`YUN_GLB_IMPORT_OK`) |
| Matterhorn BlenderAdapter Suite (`blenderAdapter.test.ts`) | PASS — Health, capabilities, task submission, artifact references, and structured evidence verified |
| Cross-Tool Vertical Slice Test (`blenderGodotSlice.test.ts`) | PASS — Matterhorn → BlenderAdapter → Blender → crate.glb → Godot Import → Evidence verified |
| PC Environment Verification | PASS — Node v25.2.1, Blender 5.2.1 LTS, Godot 4.7.2 (`Godot_v4.7.2-stable_win64.exe`), Flyrail daemon (`ws://127.0.0.1:7520`) |
| Rendered browser/screenshot validation | PASS — Verified local server on `http://127.0.0.1:3001` |
| Ubuntu + Windows CI | PASS — 88/88 deterministic tests green |

Deterministic tests do not establish real Godot execution or visual UI quality. No merge or release promotion was performed.

## PC acceptance checklist

Use the review branch in a separate checkout so existing local edits are preserved. Requires Node 22+, Git, the existing Flyrail setup and Godot.

1. Run `npm ci` and `npm run check`. Both must finish successfully.
2. Start Flyrail using its existing instructions. Configure `FLYRAIL_REPO_ROOT` (daemon discovery) or `FLYRAIL_DAEMON_URL` plus `FLYRAIL_DAEMON_TOKEN` in Matterhorn's server environment. Do not paste tokens into the browser.
3. Run `npm run test:live`. It creates a disposable fixture with spaces in its path and a Git baseline. Require exit 0, Studio status completed and persisted matching evidence. Keep `.matterhorn/evidence/studio-live.json` and the disposable project. Exit 1 is a failed or blocked gate, never a pass.
4. Set `MATTERHORN_PROJECTS` to an array of `{id,name,path}` entries for a disposable local Godot project. Use forward slashes or correctly escaped Windows paths in JSON. Start `npm run dev:server`, then open the printed loopback URL.
5. Inspect all five screens on your display. Check text, scrolling, keyboard focus, window resizing and readable errors. Chat must show mock mode unless a real provider is configured. Verify a real provider reply when your credentials are available.
6. Review and run a supported Godot request. For baseline gate validation use the exact criteria `Godot validation passes`, `Scenario checks pass`, and `QA checks pass`. Add `Playtest passes` only when the project has a genuine supported playtest. Read the returned evidence; generic gates do not prove requested gameplay behavior.
7. Confirm failure cases: daemon offline, missing project, unsupported/custom criterion and deliberately failing disposable validation. None may show completed.
8. Request cancellation mid-run. The UI must state pending cancellation while Flyrail continues; downstream tasks must not start. On unconfirmed timeout the controller must prevent another run. Stop/check remote work before restarting.
9. Refresh the browser during a run and reopen its activity. Download evidence. Restart Matterhorn and confirm saved run history returns. If Flyrail still reports recovered work active/unknown, Matterhorn must remain fail-closed and block overlapping work; it must not resubmit the mutation.
10. Record Matterhorn/Flyrail commit IDs, Godot/Node versions, exact commands, exit codes, screenshots and evidence paths. Do not merge until this gate passes.

## Explicit limitations and later work

- The UI plans one Godot execution task; the core scheduler supports DAGs. An autonomous multi-domain natural-language planner is not implemented by this change.
- The current Flyrail evidence schema proves four named gate checks only. Arbitrary feature acceptance needs domain-specific tests/evidence and currently stays blocked. This is a capability limitation, not something a PC smoke test removes.
- Flyrail does not provide active loop cancellation. Matterhorn cannot safely manufacture that capability; it exposes the limitation and blocks unsafe overlapping runs.
- Studio snapshot/evidence metadata is durable on disk and restart reconciliation is implemented. Matterhorn deliberately does not resume an uncertain mutation. Multi-user service hosting and true remote cancellation remain later work.
- Existing extension-only workspace editing/review tools are not all migrated into the standalone UI. The extension stays optional as migration reference.
- Blender control, rendering/visual validation and cross-tool asset import are subsequent milestones after this integration is accepted. This change is not the entire long-term autonomous studio roadmap.

## Concurrent Phase 3 integration

The upstream branch advanced during implementation. This change builds on `242de254` and keeps its public `StudioRunController({registry,...})`, `executeRun`, `cancelRun`, event, registry and injected-store interfaces. They delegate to the same execution engine used by the standalone API; there is no second scheduler. Snapshot events support the UI, while the existing event vocabulary and run shape remain available to callers. Required capabilities and output artifacts are enforced.

Intentional behavior changes: generic successful summaries cannot prove acceptance; unknown submission outcomes are never automatically replayed; unsupported cancellation cannot produce a terminal cancelled state. The earlier controller tests that accepted summary-only evidence or retried mutations are superseded by stronger engine and public-API regression tests. Custom validators may add stricter checks but cannot bypass the evidence gate. The injected legacy store is a snapshot mirror; it does not implement restart recovery.

## Workspace continuation validation

The prior commit `ccad4df440064b42b99fea3bc4bf43c361a697fb` passed GitHub Actions on both Ubuntu and Windows (run 35810822353). This continuation adds standalone file browsing/search, AI file assistance, persistent reviewed edits, safe restore, and interrupted-write reconciliation.

Latest CI verification: core/server compilation and smoke checks PASS; 41/41 Node/DOM/integration tests PASS on Ubuntu; the same deterministic workflow passes on Windows; existing Flyrail adapter checks remain part of `npm run check`. End-to-end Projects tests use the real local HTTP server and disposable files to cover single-file review/restore, a two-file reviewed transaction/apply/rollback, and a configured validation process. Cloud provider output is not validated by mock tests. Rendered visual QA and the real Flyrail/Godot gate remain pending PC checks.

Additional PC checks: use a disposable ordinary source project, browse/search a file, create a manual edit, inspect both versions, apply, restart the server, then restore. Change the file externally before apply/restore and verify rejection. Configure a real provider and confirm a returned concrete proposal remains pending until approved. Keep real project directories out of simultaneous editing/running sessions.
