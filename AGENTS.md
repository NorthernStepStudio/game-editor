# Matterhorn: instructions for project agents

## Main product direction

Matterhorn is Northern Step Studio's **standalone AI assistant and Studio application**. It is not a VS Code extension product. This is the primary direction for architecture, implementation, planning and answers to “what next?”. VS Code must not be required to launch or use Matterhorn.

- Build the primary user experience in `web/`, backed by `server/` and shared logic in `core/`.
- The main surfaces are Chat, Studio, Projects, Evidence and Settings.
- Treat `extension/` as optional legacy integration and migration reference. Migrate useful capabilities into the standalone app. Do not prioritize extension commands, VSIX packaging, Marketplace releases or VS Code dependencies unless the user explicitly requests extension work.
- Older extension-oriented code and documents do not supersede this product direction. Preserve legacy code until its useful capabilities have replacements; standalone direction does not authorize blanket deletion.

## Before recommending or implementing next steps

Read `README.md`, `docs/MATTERHORN-IMPLEMENTATION-PLAN.md`, `docs/WORKSPACE-MIGRATION.md` and `docs/MATTERHORN-VALIDATION.md`. Check the current branch and implementation before labeling work complete or pending. Explain next steps in terms of the standalone application.

At this handoff (September 24, 2026), standalone Chat/Studio/Projects/Evidence/Settings, Flyrail orchestration, source browsing/search, reviewed single-file edits, reviewed 2–20 file transactions, server-configured validation tasks, disk-backed Studio run history, fail-closed restart reconciliation, the real Matterhorn → Flyrail → Godot acceptance gate, Blender bootstrap, the production Yun character gate, and roster v1 (`yun_player_base` + Raya/Kade/Mira through reusable `CharacterVariantSpec`, indexes 12–15, Kenney 0–11 intact) are on draft PR #2. The first opt-in Calle environment slice (`yun_street_block_calle_v1`) is generated and has passed its live Blender/Flyrail/Godot import, six-player route, and tube tag/role-swap probe; defender AI is paused during the scripted route. Detailed evidence and remaining limits are in `docs/MATTERHORN-VALIDATION.md`. Kenney remains the default and immediate rollback. Recovered active/unknown remote work is never resubmitted automatically.

Current continuation order:

1. Extend the reusable Matterhorn environment fixture to Malecón, Parque and Noche; refine the opt-in Calle art from PC play feedback. Keep Kenney as the default until stakeholders promote Matterhorn assets.
2. Continue broader workspace migration (new files, diagnostic/repair sessions, semantic project context) without making VS Code a dependency.

Broader workspace migrations remain tracked in `docs/WORKSPACE-MIGRATION.md`. Update this handoff and the implementation plan as milestones change, keeping the standalone direction explicit.

## Ownership and verification

Matterhorn owns intent, plans, coordination, approvals, state and final validation. Flyrail owns Godot execution, repair, playtesting and export. Keep credentials server-side. Missing or uncertain evidence must stay visible; deterministic or mock tests are not proof of real Godot or visual correctness.

Implement and verify work possible in this environment, including live PC checks when the required tools and services are available. Keep work on the draft PR. Do not merge, force-push or promote a release without explicit authorization.
