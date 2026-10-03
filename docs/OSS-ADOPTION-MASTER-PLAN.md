# Matterhorn OSS Adoption Master Plan

Date: 2026-10-03

This is the canonical plan for applying **adopt before build** to Matterhorn, Flyrail, Forge, Canvas, Foundry, Sentinel, Agent Foundry, Repo/Build, Character Studio, and future game-production specialists.

The goal is not to install every interesting repository. The goal is to take **every capability we need that can be safely reused**, avoid duplicating infrastructure already present, and finish the autonomous studio faster.

## Rules

1. Search existing Northern Step Studio branches and saved research before writing generic infrastructure.
2. Prefer mature permissively licensed OSS when it can replace or accelerate unfinished code.
3. Keep Matterhorn as orchestrator and final completion authority.
4. Keep Flyrail as the Godot specialist; editor backends such as Godot AI stay behind Flyrail.
5. Keep Sentinel independent from the builder.
6. Keep providers behind typed adapters so a provider can be swapped without changing the studio contract.
7. Preserve provenance, source license, model/license, cost, hashes, seeds and parent/reference lineage for generated assets.
8. Network, external-cost and destructive operations remain explicit opt-in.
9. Do not ship noncommercial-only weights/assets in a commercial product path.
10. Do not copy proprietary algorithms, private implementations or unlicensed example content.
11. Local compile/tests/live gates come before remote CI while GitHub Actions minutes are constrained.

## Status legend

- **ADOPTED** — already connected to the canonical autonomy line.
- **NEXT** — high-value missing capability that should be integrated after the local gate.
- **PACK** — optional game-production capability exposed as a typed specialist skill/provider, not a core dependency.
- **COVERED** — useful idea, but Matterhorn already has an equivalent; do not add another framework.
- **CONDITIONAL** — use only if a real project need justifies the dependency.
- **REFERENCE ONLY** — copy workflow/architecture ideas only.
- **REJECT** — unsuitable for the shipping path because of licensing, duplication, safety or architecture.

---

# 1. Core autonomous studio

## Aura / Coplay public workflow
Status: **ADOPTED / NEXT**

Already adopted:
- Ask -> Plan -> Build -> Verify -> Repair -> Complete
- explicit plan review
- specialist execution separated from validation
- Godot AI as editor tooling behind Flyrail

Still take:
- editable persistent plan document instead of plan text only
- durable task/thread history
- clear running/blocked/approval states
- resumable sessions
- headless/background execution experience where our local tools support it

Do not copy Aura branding/private assistant implementation.

## Builders Gate
Status: **ADOPTED / NEXT**

Already adopted:
- specialist separation
- queue instead of overlap rejection
- persisted safe queue recovery
- fail-closed uncertain recovery
- user approval boundaries
- clean-worktree protection in generic Flyrail execution

Still take:
- global emergency stop / stop-all control
- per-run watchdog and hard runtime ceilings at Matterhorn level
- explicit workspace/asset ownership records
- resource locks before parallel mutation
- richer live activity/dashboard data
- cross-run spend/usage ledger and ceilings using our existing budget/provider data
- dirty-tree/branch state surfaced in Plan Review before mutation

Do not replace Matterhorn with Builders Gate's control plane.

## LangGraph
Status: **COVERED**

Use its durable-state/checkpoint/retry concepts, but do not add a second orchestration framework unless Matterhorn's own run graph becomes insufficient.

Already covered by Studio run state, queue recovery, task dependencies and durable sessions.

## PydanticAI / typed-agent patterns
Status: **COVERED / SELECTIVE**

Already covered:
- typed handoffs
- structured task specs
- structured tool calls
- fail-closed validation
- provider-neutral model gateway

Still take selectively:
- reusable typed eval fixtures
- stricter schema validation at model boundaries where loose JSON still exists
- model/provider evaluation harness patterns

Do not replace the recovered Intelligence Layer.

## OpenCode / obra Superpowers
Status: **ADOPTED / NEXT**

Already adopted:
- explicit reusable workflow skills
- deterministic skill routing in Flyrail

Still take:
- plan-before-code workflow templates
- isolated worktree task execution for risky software/repo jobs
- test-first skill templates
- review-before-finish skill
- branch-finishing/release skill
- mandatory verification step in every mutating skill

Do not install a giant generic skill pack wholesale.

## OpenHands SDK / Mini-SWE-agent
Status: **COVERED**

Matterhorn PR #11 already supplies our engineering-agent runtime, provider routing, tool loop, approvals and durable sessions. Harvest useful benchmark/eval ideas only.

---

# 2. Intelligence, Chat and project understanding

## Matterhorn PR #11
Status: **ADOPTED**

Recovered:
- provider-neutral model gateway
- OpenAI / Anthropic / Gemini / Ollama / LM Studio adapters
- role/capability routing
- local/network/external-cost policy
- iterative tool-calling runtime
- approval/resume
- repetition/turn/tool ceilings
- durable sessions
- safe repository tools
- staged file proposals

## Durable Chat migration
Status: **NEXT — top priority after local gate**

Replace legacy one-shot /ask UI with Intelligence sessions.

Required UX:
- project-scoped session
- provider/model disclosure
- pending approval cards
- approve/deny per tool call
- continue previous session
- compacted context when limits are reached
- route a finished discussion directly into a Studio plan

## Project memory
Status: **NEXT, local-first first**

Before adding Graphiti/Cognee:
- build a project map from files/scenes/config
- remember accepted plans, decisions, repaired failures and successful patterns
- surface recent run/evidence history into planning
- keep project memory scoped to the project and auditable

Only evaluate Graphiti/Cognee or another graph-memory component if this local memory layer proves inadequate.

## OpenTelemetry-compatible tracing
Status: **NEXT after functional local gate**

Add trace IDs across:
Matterhorn plan -> specialist handoff -> provider/tool call -> Flyrail/Forge/Foundry -> Sentinel -> repair -> completion.

Existing evidence files remain authoritative; tracing is for observability, not acceptance.

---

# 3. Godot / Flyrail

## Godot AI
Status: **ADOPTED**

MIT editor/MCP backend behind Flyrail.

Keep:
- scene/node/script/editor operations
- run/test/screenshot/log feedback
- optional live-editor control

Flyrail keeps:
- project policy
- safe execution boundary
- deterministic playtesting
- probes
- repair loop
- evidence
- exports

## Godogen
Status: **NEXT — patterns + selected MIT components**

Take:
- deliberately thin runtime manifest
- short engine guide instead of giant per-task prompts
- asset-generation skill as a reusable capability
- live-game-first feedback
- choose live steering vs unattended proof recording from task intent
- final short proof recording that the agent watches back before completion
- proof from the running game instead of compile-only success

Do not replace Flyrail or Matterhorn with Godogen.

Paid image/3D provider examples in Godogen must remain optional adapters and obey Matterhorn cost policy.

## GdUnit4
Status: **NEXT**

Add a Flyrail test adapter that:
- detects an existing GdUnit4 installation
- can execute project unit/scene tests headlessly
- imports test failures as criterion evidence
- never forces GdUnit4 into a project that uses another test framework

Prefer GdUnit4 for new Godot 4 test packs; preserve existing Yun/Flyrail deterministic probes.

## GUT
Status: **CONDITIONAL**

Support existing projects that already use GUT. Do not install both GUT and GdUnit4 by default.

## MCPWorld / benchmark-style evaluation
Status: **NEXT for Agent Foundry**

Use benchmark scenarios to grade new agent/skill blueprints before activation:
- completion
- correctness
- retries
- cost
- tool count
- evidence quality
- regression rate

Agent Foundry should not activate a specialist merely because a prompt looks good.

---

# 4. PvE / gameplay capability packs

These are not Matterhorn-core dependencies. Flyrail exposes them as optional project capability packs when the selected game needs them.

## LimboAI
Status: **PACK — high value**

MIT Godot behavior trees + hierarchical state machines.

Use for:
- enemy PvE behavior
- modular NPC logic
- boss/state behavior
- behavior-tree debugging
- reusable AI tasks

For Godot 4.7, pin a compatible release/build and validate the exact GDExtension/module combination locally.

## Dialogic
Status: **PACK**

MIT Godot dialogue/character/timeline system.

Use for games needing:
- conversations
- branching dialogue
- narrative timelines
- character dialogue state

Do not make every project depend on it.

## Wave Function Collapse / constraint-solving addon
Status: **PACK**

Use an actively maintained Godot 4 MIT implementation for:
- procedural TileMap/GridMap layouts
- constraint-based level generation
- deterministic seeded generation

Wrap it behind a Flyrail procedural-generation skill and always validate reachability/navigation after generation.

## Terrain3D
Status: **PACK**

MIT high-performance Godot 4 GDExtension.

Use for projects needing:
- large editable terrain
- heightmaps
- world/landscape tooling

Do not add it to small/indoor games.

## Shader/VFX libraries
Status: **PACK with provenance rules**

Harvest permissively licensed Godot shader/source code through a source/provenance registry.

Do not automatically copy demo art assets with noncommercial licenses.

---

# 5. Canvas / 2D / Character Studio

## Foundry + ComfyUI + Sprite Fusion
Status: **ADOPTED**

Already provides:
- provider routing
- local-first option
- per-request network/cost approval
- provenance
- hashes
- lineage
- concept/sprite/texture asset types

## Character Studio consistency workflow
Status: **NEXT after autonomy local gate**

Use saved phiiiiiiii / ComfyUI workflow ideas:
- locked Character DNA
- canonical front/side/back/expression/reference sheets
- deterministic seeds/workflow versions
- variant generation
- consistency wall
- automatic comparison against canonical reference
- human promotion of a golden reference
- Sentinel visual consistency gate
- no release asset without provenance/license status

## Pixelorama
Status: **PACK / evaluate automation surface**

MIT pixel-art editor.

Potential Canvas uses:
- sprite cleanup
- sprite-sheet editing
- palette normalization
- pixel-art animation
- manual handoff/review UI

Only integrate as an automated backend if its current project/file/extension interfaces support deterministic local automation. Otherwise use it as a user-facing/manual editor and keep automated pixel operations in Foundry/Canvas.

## pixscii and small pixel tools
Status: **CONDITIONAL**

Adopt only operations that improve deterministic cleanup/export and are permissively licensed. Do not add multiple overlapping sprite editors.

---

# 6. Forge / Blender / 3D

## Existing Forge / Blender typed task spec
Status: **ADOPTED**

This already covers the Studio Foundation/bforge typed/whitelisted-operation lesson. Do not add a competing Blender control plane.

## godot-create-3d-assets
Status: **ADOPTED as workflow skill**

Keep:
reference/style inspection -> build/import -> scale/orientation -> collision -> navigation -> saved-scene reload -> multi-angle visual evidence -> runtime proof.

## ai-game-mcp-lab
Status: **ADOPTED / SELECTIVE**

Already took local MCP safety lesson.

Still take where useful:
- explicit Blender -> GLB -> Godot artifact handoff recipe
- local-only service assumptions
- deterministic artifact locations
- proof that the imported asset is the same artifact Forge produced

## TRELLIS
Status: **PACK — evaluate for local Forge provider**

The project/models are largely MIT, but submodule licenses must be recorded.

Potential use:
- single/multi-view reference -> initial 3D candidate

Never treat TRELLIS output as shipping-ready. Route:
reference -> TRELLIS candidate -> Forge cleanup -> retopo/decimate -> UV/material -> rig if needed -> optimization -> Sentinel -> Flyrail import/runtime validation.

Only enable when suitable local GPU/runtime is available.

## Tripo / Hunyuan3D
Status: **CONDITIONAL provider adapters**

Use only when the user already has access or a local model/provider is available within budget.

All external-cost generation must be disabled by default and pass Foundry budget approval.

## CozyBlanket Pro
Status: **REFERENCE ONLY**

Use only the public production-stage lesson:
high poly -> assisted retopo -> UV -> bake -> optimized low poly -> export -> engine validation.

Do not copy proprietary algorithms.

## Blender MCP projects
Status: **COVERED / selective**

Existing Forge adapter owns Blender. Borrow missing operations only if they improve the typed Blender spec; do not introduce a second competing Blender authority.

---

# 7. Audio

## Foundry audio asset types
Status: **ADOPTED contract, provider missing**

Foundry already models SFX/music/voice assets. Add providers behind this boundary instead of creating an unrelated system first.

## Stable Audio 3
Status: **PACK / license-gated provider candidate**

Potential use:
- SFX
- background music
- musical variations

The code is MIT, but model use is governed by Stability's model/community license. Provider activation must record model/license version and keep commercial-use policy enforcement.

## AudioCraft / MusicGen / AudioGen
Status: **REJECT for commercial shipping models**

Code is MIT, but published model weights are CC-BY-NC. They may be useful for isolated noncommercial experiments, but must not become the default commercial game-audio path.

---

# 8. Repo / Build / delivery

Status: **NEXT**

Create the planned Repo/Build specialist from capabilities we already have rather than inventing a monolith.

Take from Builders Gate / Superpowers / engineering-agent research:
- isolated git worktree for risky changes
- branch ownership
- dirty-tree refusal
- deterministic validation command allowlist
- package/export manifest
- release evidence
- rollback point
- human-only release/publish approval

Because CI minutes are constrained, local gates are first-class and remote CI is a deliberate release-stage action.

---

# 9. Parallel agents and locking

Status: **DEFER until serial pipeline is green**

Before parallel mutating specialists:
- project/file/asset ownership
- resource locks with leases/timeouts
- conflict detection
- no two agents own the same mutation target
- independent cancellation/watchdog
- deterministic merge/handoff points

Read-only specialists may parallelize earlier.

Do not enable uncontrolled concurrent editors.

---

# 10. Sentinel / validation

Status: **ADOPTED / NEXT**

Already:
- fail-closed criterion evidence
- independent validator
- deterministic + visual evidence structure
- exact artifact identity checks

Next:
- executable image baseline/similarity criteria
- multi-view 3D visual criteria
- performance/memory budgets
- GdUnit4 results
- video-proof review
- same-seed regression comparison
- mobile/export validation when those targets are enabled

Visual AI judgment may supplement evidence; it may not override deterministic failures.

---

# 11. Research/source harvesting

Status: **NEXT**

Build a lightweight Source Harvester so future Reddit/GitHub finds do not get lost again.

For each candidate, record:
- source URL/repo
- exact license
- code vs model/data/art licenses separately
- last reviewed commit/version
- capability tags
- overlap with Matterhorn
- adoption type: direct dependency / vendor / adapter / reimplement public pattern / reference / reject
- security/network requirements
- external cost
- local hardware requirement
- target specialist
- tests needed before activation
- provenance notice requirements

The Harvester should produce/update this master plan or a machine-readable registry; it must never auto-install arbitrary code.

---

# 12. Canonical implementation order

## Gate 0 — local validation now
1. Compile Matterhorn canonical autonomy branch.
2. Run recovered planner/Foundry/Intelligence tests.
3. Compile Flyrail Godot-AI branch.
4. Run Flyrail tests.
5. Run one live Yun end-to-end feature through Matterhorn -> Flyrail -> Godot -> Sentinel.
6. Fix regressions before adding more dependencies.

## Phase 1 — finish the product loop
1. Move Chat to durable Intelligence sessions.
2. Add approval UI.
3. Persist/edit Plan documents.
4. Add Matterhorn global watchdog + stop-all.
5. Add trace IDs/usage/cost ledger.
6. Make visual-target verification executable, not prompt-only.
7. Add Godogen-style final proof recording/watch-back.

## Phase 2 — improve Godot creation quality
1. GdUnit4 adapter.
2. Agent Foundry benchmark/evaluation harness.
3. LimboAI capability pack.
4. WFC/procedural-generation capability pack.
5. Terrain3D pack.
6. Dialogic pack.
7. shader/VFX provenance pack.

## Phase 3 — finish asset production
1. Character Studio real ComfyUI consistency loop.
2. Canvas pixel-art cleanup/editor integration; evaluate Pixelorama automation.
3. TRELLIS local 3D candidate provider evaluation.
4. Forge cleanup/retopo/UV/bake/rig/optimization gates.
5. audio provider evaluation, starting with commercially compatible Stable Audio options.
6. end-to-end asset identity/provenance across Canvas/Foundry -> Forge -> Flyrail.

## Phase 4 — delivery and scale
1. Repo/Build specialist.
2. mobile/export gates.
3. resource locks.
4. parallel specialist lanes.
5. project-memory expansion only if local project memory proves insufficient.
6. OpenTelemetry-compatible operations dashboard.

---

# 13. Projects/ideas we should not blindly install

- Aura private implementation — proprietary.
- CozyBlanket algorithm — proprietary.
- AudioCraft model weights — noncommercial for shipping.
- GDQuest/demo art marked noncommercial — source code/shaders may be usable under their separate license, art is not automatically usable.
- OpenHands/Mini-SWE/PydanticAI/LangGraph as replacement frameworks — duplicate our recovered control plane.
- multiple Godot MCPs at once — Godot AI stays the editor backend behind Flyrail.
- multiple Blender authorities — Forge remains the Blender owner.
- uncontrolled parallel editors/agents.
- unlicensed Glitch/example prompt text — use only the public workflow idea, not copied content.

---

# Completion definition

The adoption program is complete when Matterhorn can take a high-level game request and, using the appropriate reusable packs/providers:

1. understand the existing project,
2. produce/edit an explicit plan,
3. generate or modify code/assets through the correct specialist,
4. run the actual game,
5. execute unit/scenario/playtest/visual/performance checks,
6. repair failures within bounded budgets,
7. preserve provenance/cost/license/trace evidence,
8. show the user what happened and any approvals used,
9. package/export through Repo/Build,
10. and refuse completion whenever required proof is missing.
