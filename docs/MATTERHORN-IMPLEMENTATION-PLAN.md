# Matterhorn implementation plan

## Main priority: build the standalone application

**Matterhorn is its own standalone AI assistant and Studio application. It is not a VS Code extension product.** All milestones below serve this direction. The primary implementation is `core/`, `server/` and `web/`; VS Code is not a runtime requirement. `extension/` is optional legacy integration retained for migration reference. Do not turn next-step recommendations into extension packaging, Marketplace publishing or VS Code command work unless the user explicitly requests that scope.

The standalone foundation and single-file workspace migration are delivered on the active draft PR. The next coding milestone is **persistent Studio run/evidence history and safe restart recovery**. Then come multi-file reviewed edits, configured validation tasks and criterion-specific gameplay proof. PC acceptance is still pending, and Blender remains after that gate. Read [AGENTS.md](../AGENTS.md) for agent handoff guidance.

Baseline inspected: `c350263afbb371a63ddd421fdb5c7e81054af1c3`, branch `feat/studio-orchestration-foundation`. Canonical repository: NorthernStepStudio/matterhorn. This plan covers the standalone Matterhorn/Flyrail milestone agreed September 23, 2026; unrelated Morning Hub and video-editor work is excluded.

## Delivery order and acceptance

1. **Standalone identity.** Rename root package and current setup instructions to Matterhorn. Core/server/web are the default build. Retain the existing extension as an optional compatibility package until its useful workspace features are migrated; VS Code must not be required to launch Matterhorn. Do not delete a user's PC checkout or rewrite history.
2. **Run model.** Add transport-neutral adapter registry, validated dependency scheduling, unique execution IDs, timestamps, bounded polling and timeouts, task/result/evidence storage, run events, and cancellation states. Dependency failure must block downstream execution. Never retry a possibly accepted mutation automatically. Retries are limited to explicitly recoverable read failures.
3. **Evidence validation.** Completed transport calls are not completed work. Require result identity, explicit criterion outcomes, inspectable evidence references, and final criteria support. Missing evidence blocks completion; failed evidence fails validation. Keep simulated checks separate from live proof.
4. **Server integration.** Expose create/list/get/cancel runs, event streaming, configured projects, connection health and safe provider settings. Keep Flyrail tokens and credential configuration on the server. Limit request sizes, static file access, cross-origin access, and run concurrency. Reject unknown projects and malformed plans.
5. **Standalone UI.** Deliver Chat, Studio, Projects, Evidence and Settings. Route internal specialists automatically. Let the user select a configured project, describe a goal, state acceptance criteria, review the plan, start a run, follow task state, request cancellation and inspect evidence. Show actionable empty/offline/error states. No invented completion, simulated production results, or dead controls.
6. **Automated verification.** Compile core/server; execute existing smoke and adapter tests plus controller/API regression tests for invalid DAGs, blocked dependencies, unique IDs, missing/failed evidence, bounded timeout and unsupported cancellation. Check UI in a browser when available. Correct existing live integration assertions and provide an explicit live gate that fails if required services are unavailable.
7. **PC validation handoff.** Run the live gate on a disposable Godot project through Matterhorn → Flyrail → Godot → returned evidence → validated Studio completion. Verify Windows paths with spaces, reconnect, genuine failure display, cancellation behavior, provider setup, actual screenshots/gameplay and restart behavior. Save exact commits, commands, exit codes and evidence. This is the manual acceptance gate, not a claim that code tests prove the real system.
8. **Later Blender milestone.** Only after the Matterhorn/Flyrail milestone passes: structured Blender service, capability discovery, modeling/material/rig/animation/render operations, visual validation, artifact manifests, Blender export → Flyrail import → Godot validation. Apply the same bounded execution and evidence contracts. This is explicitly deferred per the prior sequencing decision.

## Boundaries

Matterhorn owns intent, plans, scheduling, state, approvals and final validation. Flyrail owns Godot execution/repair/playtesting/export. Browser never receives the daemon token. In-memory run state is acceptable for this phase but restart loss must be visible; durable recovery and resuming remote work require a later state-store migration. No automatic merges, force pushes or release promotion.

## Definition of done

Each implemented item has automated evidence, each unsupported operation is visible, and all remaining work is named honestly. A mock test is not real Godot proof. PC testing cannot silently substitute for unfinished implementation. Record actual delivered scope and any environment blockers in `docs/MATTERHORN-VALIDATION.md`.

Implementation rebased on the concurrent Phase 3 commit `242de254f92c74f5186e55b97cb35be3724a4afb`; see the validation report for API consolidation and intentional safety semantics.

## Continuation: standalone workspace migration

Delivered on the active draft PR: project browsing, bounded text search, file assistance and reviewed single-file changes in Projects. Backups and proposal state persist independently of Studio run state. Stale files and active known Studio executions block conflicting writes. Track the complete migration boundary in WORKSPACE-MIGRATION.md; keep the optional extension until its remaining features have replacements.

After this: durable Studio history with restart reconciliation (interrupted execution must remain unconfirmed); multi-file review transactions and configured validation tasks; criterion-specific gameplay proof; then the real PC acceptance gate. Blender remains after that gate.
