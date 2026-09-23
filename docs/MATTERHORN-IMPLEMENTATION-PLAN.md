# Matterhorn implementation plan

## Main priority: build the standalone application

**Matterhorn is its own standalone AI assistant and Studio application. It is not a VS Code extension product.** All milestones below serve this direction. The primary implementation is `core/`, `server/` and `web/`; VS Code is not a runtime requirement. `extension/` is optional legacy integration retained for migration reference. Do not turn next-step recommendations into extension packaging, Marketplace publishing or VS Code command work unless the user explicitly requests that scope.

The standalone foundation, persistent Studio history/restart recovery, reviewed multi-file change sets, server-configured validation tasks, typed criterion-specific gameplay acceptance proof, the Blender 3D specialist bootstrap, and the Phase 3G generic Blender command / humanoid→Flyrail pipeline are delivered on the active draft PR #2. The real PC acceptance gate (`Matterhorn → Flyrail → Godot`) and Blender live character proof (`npm run test:blender-live`) have been verified on Windows.

Latest HEAD SHA: use `git rev-parse HEAD` on `feat/standalone-studio-20260923` (Phase 3G implementation through `55abbc5`; docs provenance commits follow). Phase 3G builds on PR #2 bootstrap head `d7e9ff2351c7312cc090260b032afe7d0bba155c` (correcting earlier docs that incorrectly cited `191240b…`). Canonical repository: NorthernStepStudio/matterhorn. Flyrail repository: NorthernStepStudio/flyrail (`feature/playtest-agent-v3-source-repair` @ `08eff88e045ad0cebfa64042316cd11d2979a838`). This plan covers the standalone Matterhorn/Flyrail/Blender milestone agreed September 23, 2026; unrelated Morning Hub and video-editor work is excluded.

## Delivery order and acceptance

1. **Standalone identity.** Rename root package and current setup instructions to Matterhorn. Core/server/web are the default build. Retain the existing extension as an optional compatibility package until its useful workspace features are migrated; VS Code must not be required to launch Matterhorn. Do not delete a user's PC checkout or rewrite history.
2. **Run model.** Add transport-neutral adapter registry, validated dependency scheduling, unique execution IDs, timestamps, bounded polling and timeouts, task/result/evidence storage, run events, and cancellation states. Dependency failure must block downstream execution. Never retry a possibly accepted mutation automatically. Retries are limited to explicitly recoverable read failures.
3. **Evidence validation.** Completed transport calls are not completed work. Require result identity, explicit criterion outcomes, inspectable evidence references, and final criteria support. Missing evidence blocks completion; failed evidence fails validation. Keep simulated checks separate from live proof.
4. **Server integration.** Expose create/list/get/cancel runs, event streaming, configured projects, connection health and safe provider settings. Keep Flyrail tokens and credential configuration on the server. Limit request sizes, static file access, cross-origin access, and run concurrency. Reject unknown projects and malformed plans.
5. **Standalone UI.** Deliver Chat, Studio, Projects, Evidence and Settings. Route internal specialists automatically. Let the user select a configured project, describe a goal, state acceptance criteria, review the plan, start a run, follow task state, request cancellation and inspect evidence. Show actionable empty/offline/error states. No invented completion, simulated production results, or dead controls.
6. **Automated verification.** Compile core/server; execute existing smoke and adapter tests plus controller/API regression tests for invalid DAGs, blocked dependencies, unique IDs, missing/failed evidence, bounded timeout and unsupported cancellation. Check UI in a browser when available. Correct existing live integration assertions and provide an explicit live gate that fails if required services are unavailable.
7. **PC validation handoff.** Run the live gate on a disposable Godot project through Matterhorn → Flyrail → Godot → returned evidence → validated Studio completion. Verify Windows paths with spaces, reconnect, genuine failure display, cancellation behavior, provider setup, actual screenshots/gameplay and restart behavior. Save exact commits, commands, exit codes and evidence.
8. **Blender specialist foundation (Phase 3F).** Non-interactive headless Blender execution, executable discovery, crate fixture via early adapter path, render/GLB evidence, and direct Godot import proof. Does not claim Flyrail ownership of the Godot stage.
9. **Blender specialist generalization (Phase 3G).** Structured `BlenderOperation` pipeline, validated task specs, async execution, manifests, artifact confinement, humanoid rig/animation prototype, `YunCharacterContract`, and Matterhorn → Blender → Flyrail → Godot character validation.
10. **Yun character candidate (Phase 3H).** First production-candidate `yun_player_base` via structured Blender ops (stylized street athlete, team-color `MAT_TeamShirt`, full limb hierarchy, idle/walk/run), multi-view evidence, Flyrail disposable import + YunMiniFigure-compatible wrapper motion probe. Candidate archived under `artifacts/yun-character-candidate/yun_player_base/`. **Not** integrated into production Yun (easy future rollback). Next: art iteration or gated production wiring.

## Boundaries

Matterhorn owns intent, plans, scheduling, durable local run state, approvals and final validation. Flyrail owns Godot execution/repair/playtesting/export. BlenderAdapter owns non-interactive 3D asset creation, render previews, and GLB exports. Browser never receives daemon tokens. Restart reconciliation is read-only for uncertain remote execution; Matterhorn does not automatically resume or resubmit a mutation. No automatic merges, force pushes or release promotion.

## Definition of done

Each implemented item has automated evidence, each unsupported operation is visible, and all remaining work is named honestly. A mock test is not real Godot/Blender proof. PC testing cannot silently substitute for unfinished implementation. Record actual delivered scope and any environment blockers in `docs/MATTERHORN-VALIDATION.md`.

Implementation rebased on the concurrent Phase 3 commit `242de254f92c74f5186e55b97cb35be3724a4afb`; see the validation report for API consolidation and intentional safety semantics.

## Continuation: standalone workspace migration

Delivered on the active draft PR: project browsing, bounded text search, file assistance and reviewed single-file changes in Projects. Backups and proposal state persist independently of Studio run state. Stale files and active known Studio executions block conflicting writes. Track the complete migration boundary in WORKSPACE-MIGRATION.md; keep the optional extension until its remaining features have replacements.

Delivered after the initial workspace migration: durable Studio history with read-only restart reconciliation, reviewed multi-file transactions, server-configured validation tasks, full Ubuntu/Windows CI green restoration, typed criterion-specific gameplay proof evidence contracts across Matterhorn and Flyrail, Blender specialist bootstrap (Phase 3F), Blender command/humanoid/Flyrail pipeline (Phase 3G), and first Yun character candidate `yun_player_base` (Phase 3H, disposable-validated only). Next: character art iteration or production integration behind the existing wrapper with rollback.
