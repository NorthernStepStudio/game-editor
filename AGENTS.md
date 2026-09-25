# Matterhorn: instructions for project agents

## Main product direction

Matterhorn is Northern Step Studio's **standalone AI assistant and Studio application**. It is not a VS Code extension product. This is the primary direction for architecture, implementation, planning and answers to “what next?”. VS Code must not be required to launch or use Matterhorn.

- Build the primary user experience in `web/`, backed by `server/` and shared logic in `core/`.
- The main surfaces are Chat, Studio, Projects, Evidence and Settings.
- Treat `extension/` as optional legacy integration and migration reference. Migrate useful capabilities into the standalone app. Do not prioritize extension commands, VSIX packaging, Marketplace releases or VS Code dependencies unless the user explicitly requests extension work.
- Older extension-oriented code and documents do not supersede this product direction. Preserve legacy code until its useful capabilities have replacements; standalone direction does not authorize blanket deletion.

## Before recommending or implementing next steps

Read `README.md`, `docs/MATTERHORN-IMPLEMENTATION-PLAN.md`, `docs/WORKSPACE-MIGRATION.md` and `docs/MATTERHORN-VALIDATION.md`. Check the current branch and implementation before labeling work complete or pending. Explain next steps in terms of the standalone application.

At this handoff (September 25, 2026), standalone Chat/Studio/Projects/Evidence/Settings, workspace transactions, persistent Studio run history and restart reconciliation, the real Matterhorn -> Flyrail -> Godot acceptance gate, Blender, Yun character and roster gates, and the four-map environment set are on draft PR #2. Multi-domain Studio planning is implemented on `feat/multidomain-studio-planner-20260925`, based on `feat/studio-routing-preferences-20260925` at `5d0fb40e248b8ab326e21713901d8f1023091124`; local verification and CI status are recorded in `docs/MATTERHORN-VALIDATION.md`. The standalone UI is under active user work and is outside this branch. Existing generated Blender/Yun artifacts are user data and must not be committed. Kenney remains the default game content and immediate rollback. Recovered active/unknown remote work is never resubmitted automatically.

Current continuation order:

1. Finish the multi-domain planner handoff: keep UI wiring in the active UI change, and record exact final local and GitHub CI results for this branch. Keep Foundry, Blender and QA evidence-gated.
2. Continue autonomous full-scene creation using the four-map generation/import/runtime gate as its first end-to-end proof. Keep Kenney as default until stakeholders promote Matterhorn assets; refine opt-in art from PC play feedback. Continue broader workspace migration without making VS Code a dependency.

Broader workspace migrations remain tracked in `docs/WORKSPACE-MIGRATION.md`. Update this handoff and the implementation plan as milestones change, keeping the standalone direction explicit.

## Ownership and verification

Matterhorn owns intent, plans, coordination, approvals, state and final validation. Flyrail owns Godot execution, repair, playtesting and export. Keep credentials server-side. Missing or uncertain evidence must stay visible; deterministic or mock tests are not proof of real Godot or visual correctness.

Implement and verify work possible in this environment, including live PC checks when the required tools and services are available. Keep work on the draft PR. Do not merge, force-push or promote a release without explicit authorization.
