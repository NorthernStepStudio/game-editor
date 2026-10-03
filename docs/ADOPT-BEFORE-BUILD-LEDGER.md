# Adopt-before-build ledger — 2026-10-03

This file records which saved research ideas have been adopted into the canonical autonomy integration line and which should not be rebuilt. The complete future adoption order and remaining candidate set are tracked in `docs/OSS-ADOPTION-MASTER-PLAN.md`.

## Canonical branches

- Matterhorn: `integration/studio-autonomy-20261003`
- Flyrail: `integration/godot-ai-backend-20261003`

Local compile/live gates are required before opening PRs because GitHub Actions minutes are constrained.

## Adopted now

### Aura / Coplay product pattern
Status: **adopted as product workflow, not proprietary code**

Matterhorn Studio now presents the lifecycle:
`Ask -> Plan -> Build -> Verify -> Repair -> Complete`.

Aura branding/private implementation is not copied.

### Godot AI (MIT)
Status: **integrated behind Flyrail**

Flyrail can use Godot AI as an optional editor/MCP backend and retain the legacy Flyrail bridge for explicitly unmapped operations. Ambiguous mutation failures do not fall back/replay.

### Builders Gate (MIT) patterns
Status: **partially adopted**

Adopted:
- queued work instead of rejecting every overlapping request
- persisted queued-run recovery after restart when no mutation began
- fail-closed recovery when remote mutation may have begun
- specialist/role separation
- explicit approval boundaries already present for network/external-cost providers

Not adopted yet:
- per-resource locks, because Studio currently serializes execution; add them only when parallel mutation is enabled
- its Python/MCP control plane, because Matterhorn already owns the orchestration layer
- a spend ledger/ceiling was not copied because current Builders Gate does not provide one; Matterhorn already has explicit Foundry per-request budgets

### Matterhorn PR #10
Status: **recovered and activated**

Recovered instead of rewritten:
- deterministic multi-domain planner
- Foundry asset catalog/execution/provenance
- ComfyUI and Sprite Fusion provider adapters
- routing preferences
- explicit network/cost disclosures
- Foundry -> Forge/Blender -> Flyrail dependency graphs
- evidence aggregation
- Foundry Criterion V2 bridge and tests

Canvas is now backed by the recovered Foundry execution adapter.

### Matterhorn PR #11
Status: **recovered and API-activated**

Recovered instead of rewritten:
- provider-neutral model gateway
- model roles/capability routing
- local/network/external-cost policy
- OpenAI Responses, Anthropic, Gemini, Ollama and LM Studio adapters
- iterative model/tool agent runtime
- repeated-tool/turn/tool-call ceilings
- approval/resume state
- durable local intelligence sessions
- safe workspace read/search tools
- staged file-edit proposals through Matterhorn review storage

The legacy Chat UI is not yet replaced by this runtime; the Intelligence APIs are available for the next UI migration.

### LangGraph-style durable workflow lesson
Status: **adopted without adding a second workflow framework**

Studio run snapshots already provide the needed state boundary. Queued jobs that provably never started now resume after restart. Jobs that may have mutated remotely remain fail-closed and are never blindly replayed.

### OpenCode / Superpowers skill lesson
Status: **adopted in Flyrail runtime**

Reusable production workflows are explicit code-level skills selected from task intent, not free-floating prompt snippets.

### Dream Loop (MIT) visual-target pattern
Status: **adopted as Flyrail visual-target skill**

Visual/reference work receives a target -> capture -> compare -> repair workflow and rejects hero-view-only reasoning.

### godot-create-3d-assets (MIT) workflow
Status: **adopted as Flyrail 3D evidence skill**

3D/environment work receives capability/style inspection, scale/orientation, collision, navigation, saved-scene verification, runtime evidence and multi-angle inspection guidance.

### ai-game-mcp-lab (MIT) safety lesson
Status: **adopted at transport boundary**

Flyrail's legacy Godot WebSocket bridge now enforces loopback-only ws/wss endpoints with no embedded credentials. Godot AI is attached through local stdio.

## Already covered; do not duplicate

- Typed execution/handoff/evidence contracts: Matterhorn Studio contracts + Intelligence Layer types.
- Independent acceptance: Sentinel + fail-closed criterion evidence.
- Provider routing/cost gates: Foundry routing preferences + per-request approvals/budgets.
- Project/run persistence: Studio history + durable Intelligence sessions.
- Godot editor primitives: Godot AI behind Flyrail.
- Godot playtest/runtime evidence: Flyrail.
- Blender/3D execution: Forge/Blender adapter.
- Asset provenance: Foundry manifests/content hashes/lineage.

## High-value next adoptions after local gate

1. Move the standalone Chat UI from legacy `/ask` to durable Intelligence sessions, retaining explicit cloud/cost approval controls.
2. Add resource locks only when Matterhorn enables parallel mutating specialist runs.
3. Connect visual target artifacts to executable screenshot/baseline comparison evidence, so the visual-target skill is enforced by Sentinel rather than only guiding the worker.
4. Add persistent project knowledge/memory only if run history + Intelligence sessions prove insufficient; prefer a mature graph/memory component over another custom database.
5. Add OpenTelemetry-compatible tracing at the Matterhorn/Flyrail boundary if operational debugging needs exceed the existing evidence/trace files.

## Deliberately not adopted

- Proprietary CozyBlanket retopology algorithms. Only its public workflow pattern may inform Forge stages.
- Aura/Coplay private assistant implementation or branding.
- Another generic agent/workflow framework merely to replace working Matterhorn control logic.
- Parallel mutation before locking/conflict controls are present.
