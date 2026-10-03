# Matterhorn: instructions for project agents

## Main product direction

Matterhorn is Northern Step Studio's **standalone AI assistant and Studio application**. It is not a VS Code extension product. This is the primary direction for architecture, implementation, planning and answers to “what next?”. VS Code must not be required to launch or use Matterhorn.

- Build the primary user experience in `web/`, backed by `server/` and shared logic in `core/`.
- The main surfaces are Chat, Studio, Projects, Evidence and Settings.
- Treat `extension/` as optional legacy integration and migration reference. Migrate useful capabilities into the standalone app. Do not prioritize extension commands, VSIX packaging, Marketplace releases or VS Code dependencies unless the user explicitly requests extension work.
- Older extension-oriented code and documents do not supersede this product direction. Preserve legacy code until its useful capabilities have replacements; standalone direction does not authorize blanket deletion.

## Before recommending or implementing next steps

Read `README.md`, `docs/MATTERHORN-IMPLEMENTATION-PLAN.md`, `docs/WORKSPACE-MIGRATION.md` and `docs/MATTERHORN-VALIDATION.md`. Check the current branch and implementation before labeling work complete or pending. Explain next steps in terms of the standalone application.

At this handoff (September 24, 2026), standalone Chat/Studio/Projects/Evidence/Settings, Flyrail orchestration, reviewed workspace transactions, persistent Studio history and restart reconciliation, the real Matterhorn → Flyrail → Godot gate, Blender, the Yun production character gate and roster v1 are on draft PR #2. The opt-in four-map environment set (Calle, Malecón, Parque, Noche) passed goal-routed Blender generation/evidence, visual sanity, Flyrail/Godot import, six-player route, physics-overlap tag/role swap and per-map Kenney fallback. A same-runtime main-menu switch passed Calle → Malecón → Parque → Noche → Kenney with no stale environment. Kenney remains default and immediate rollback. Detailed evidence and remaining visual limits are in docs/MATTERHORN-VALIDATION.md. Recovered active/unknown remote work is never resubmitted automatically.

Current continuation order:

1. Begin autonomous full-scene creation using the four-map generation/import/runtime gate as its first end-to-end proof. Keep Kenney as default until stakeholders promote Matterhorn assets; refine opt-in art from PC play feedback.
2. Continue broader workspace migration (new files, diagnostic/repair sessions, semantic project context) without making VS Code a dependency.

Broader workspace migrations remain tracked in `docs/WORKSPACE-MIGRATION.md`. Update this handoff and the implementation plan as milestones change, keeping the standalone direction explicit.

## Ownership and verification

Matterhorn owns intent, plans, coordination, approvals, state and final validation. Flyrail owns Godot execution, repair, playtesting and export. Keep credentials server-side. Missing or uncertain evidence must stay visible; deterministic or mock tests are not proof of real Godot or visual correctness.

Implement and verify work possible in this environment, including live PC checks when the required tools and services are available. Keep work on the draft PR. Do not merge, force-push or promote a release without explicit authorization.

## Latest standalone handoff: autonomous full-scene gate

On September 24, 2026, the autonomous full-scene Studio gate passed from high-level Noche and Malecón requests through `createYunAutonomousScenePlan`, `StudioExecutionEngine`, Blender, current-run GLB dependency handoff, Flyrail `loop.run`, Godot's production Yun match scene and measured criterion evidence. The expected-seven/actual-six criterion case fails; removing the current-run GLB blocks completion. Run `npm run test:yun-autonomous-scene-live` for the dedicated live gate. It requires Blender, Godot, the production Yun fixture and a Flyrail daemon in live runtime/bridge mode. The per-run plans, snapshots, GLBs, renders, evidence bundles and screenshots are in `artifacts/yun-autonomous-scene/`.

Environment fixture generation proves asset creation and import. Autonomous full-scene Studio execution additionally proves the dependent multi-specialist run and final Matterhorn acceptance. Continue with open-ended standalone scene generation and repair loops. Keep Kenney as the saved default and immediate rollback until stakeholders promote Matterhorn assets. Keep PR #2 draft; do not merge, force-push or promote a release without explicit authorization.


## October 3 autonomy integration

The active consolidation line is `integration/studio-autonomy-20261003`. Read `docs/MATTERHORN-AUTONOMY-INTEGRATION.md` and `docs/ADOPT-BEFORE-BUILD-LEDGER.md` before extending Studio autonomy.

Apply **adopt before build**: prefer mature permissively licensed infrastructure over duplicating unfinished generic plumbing. Godot AI is an optional editor/MCP backend behind Flyrail; Matterhorn must not bypass Flyrail to call Godot AI directly. Sentinel is the independent validator and Matterhorn remains final completion authority.

The primary user workflow is now `Ask -> Plan -> Build -> Verify -> Repair -> Complete`. Do not require users to author standard validation criteria manually; Matterhorn supplies baseline validation/scenario/QA gates and adds playtest evidence for gameplay work when the project supports it.

GitHub Actions minutes are constrained. The integration branch intentionally avoids the `feat/**` push trigger. Do not open a pull request or otherwise trigger remote CI merely to test this slice; run local compile/tests first.
