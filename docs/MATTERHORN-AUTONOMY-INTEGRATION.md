# Matterhorn autonomous Studio integration

## Goal

Finish the useful product loop now by adopting mature open-source execution plumbing instead of rebuilding it:

```text
Ask -> Plan -> Build -> Verify -> Repair -> Complete
```

Matterhorn remains the top-level orchestrator and final completion authority.

## Ownership

- **Matterhorn** — user intent, plans, routing, budgets, handoffs, retries and final completion.
- **Flyrail** — bounded Godot specialist.
- **Godot AI** — optional MIT-licensed Godot editor/MCP backend behind Flyrail.
- **Forge** — Blender/3D specialist.
- **Canvas** — 2D art specialist (provider integration pending).
- **Motion** — animation specialist (provider integration pending).
- **Sentinel** — independent validation boundary.
- **Repo / Build** — repository/CI/release delivery (planned).
- **Agent Foundry** — creates inert agent blueprints only.

Do not collapse agents, skills and adapters into one object.

## Adopt-before-build rule

Before implementing generic infrastructure, check whether a mature permissively licensed component already provides it. Prefer integration or replacement of unfinished custom code when it reduces risk and time.

For Godot editor control, use Godot AI where it fits rather than expanding a parallel generic editor API. Keep Flyrail-specific systems that are differentiated or already proven: Yun runtime probes, deterministic playtesting, autonomous repair, visual/runtime evidence, criterion results and engine-specific release gates.

Aura/Coplay is a product/UX reference only. Do not copy proprietary assistant code, private behavior, branding or assets. Public MIT components such as MCP for Unity and Godot AI may be studied and integrated under their licenses.

## Current implementation slice

The integration branch adds:

1. Runtime-visible logical Studio agent registry.
2. Active Sentinel independent validator using Matterhorn's fail-closed criterion evidence.
3. Final acceptance routed through Sentinel.
4. Automatic baseline acceptance criteria so a user can start from a plain-language goal.
5. Real Studio lifecycle visualization: Ask -> Plan -> Build -> Verify -> Repair -> Complete.
6. Flyrail backend readiness in Matterhorn health/settings, including Codex and Godot AI.
7. Autonomous Studio coverage for agent separation, Sentinel and workflow state.

Flyrail's companion integration branch adds the Godot AI execution backend and keeps the old bridge as a bounded fallback for unsupported operations.

## Completion semantics

A successful editor/MCP call is not completion.

Matterhorn may mark work complete only after:

1. The builder specialist reports execution complete.
2. Criterion-specific evidence exists.
3. Sentinel independently validates the evidence.
4. Final acceptance criteria are fully covered.
5. No failed evidence or unresolved repair remains.

Unknown/missing evidence stays blocked.

## Branches

- Matterhorn: `integration/studio-autonomy-20261003`
- Flyrail: `integration/godot-ai-backend-20261003`

These branches intentionally do not match the current `feat/**` push CI trigger. Do not open a pull request until local checks are run if GitHub Actions minutes are constrained.
