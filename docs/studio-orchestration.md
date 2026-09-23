# Matterhorn Studio Orchestration Foundation

Matterhorn is the Northern Step Studio director. Specialist systems execute domain-specific work behind typed contracts.

## Stable ownership boundaries

- **Matterhorn** owns intent understanding, planning, coordination, cross-system state, evidence aggregation, approval gates, and final validation.
- **Flyrail** owns Godot-specific implementation, playtesting, repair loops, Godot QA, and Godot exports.
- **Blender Engine** will own Blender-specific modeling, procedural generation, materials, rigging, animation, rendering, visual QA, optimization, and asset export.
- Matterhorn must not bypass a specialist for a domain that the specialist owns once that integration is available.

This keeps the studio from becoming one giant agent with direct knowledge of every external application's implementation details.

## Core contract

The first orchestration layer lives in `core/src/studio` and contains:

- `types.ts` — specialist, capability, task, artifact, evidence, plan, handoff, and execution-result contracts.
- `specialistRegistry.ts` — canonical specialist ownership and current integration availability.
- `orchestrator.ts` — deterministic plan construction, ownership validation, dependency-cycle checks, and v1 handoff creation.

The contract is intentionally transport-neutral. A specialist may later be reached through MCP, a local bridge, CLI, socket, HTTP API, or another process without changing the studio-level task model.

## Current availability

| Specialist | Role | Availability |
| --- | --- | --- |
| Matterhorn | Studio director/orchestrator | available |
| Flyrail | Godot executor | integration-pending |
| Blender Engine | Blender executor | planned |

`integration-pending` means the specialist exists conceptually or separately, but Matterhorn does not yet have a production handoff adapter in this repository. `planned` means its execution service has not been implemented yet.

## Handoff protocol v1

Every execution handoff includes:

- a protocol version
- task id
- source specialist
- target specialist
- goal
- acceptance criteria
- input artifact references

Execution results return status, summary, output artifacts, and inspectable evidence. Matterhorn should treat a task as complete only after its acceptance criteria can be supported by returned evidence.

## Target studio loop

```
USER GOAL
   |
   v
MATTERHORN
 understand -> plan -> assign -> coordinate
   |
   +----> FLYRAIL --------> Godot work / tests / builds
   |
   +----> BLENDER ENGINE -> 3D work / renders / exports
   |
   +----> future specialists
   |
   v
aggregate evidence -> validate -> repair/retry if needed -> complete
```

## Next implementation phases

1. **Flyrail adapter** — define the actual transport and map `nss.studio-handoff.v1` to Flyrail's task protocol.
2. **Studio run state** — persist task transitions, attempts, timestamps, specialist results, evidence, and cancellation.
3. **Blender control service** — build the Blender Python/add-on or bridge with structured commands rather than free-form scripts.
4. **Visual validation** — render/capture outputs, inspect them, record evidence, and route repair tasks.
5. **Cross-tool asset pipeline** — Blender export -> artifact manifest -> Flyrail import -> Godot validation.
6. **Policy gates** — permission levels, destructive-operation approval, budgets, retry limits, and rollback.
7. **Studio UI** — expose the task graph, specialist status, evidence, and approvals through Matterhorn's existing Studio dashboard.

## Non-goals for this foundation

This layer does not yet control Blender or Flyrail. It does not claim autonomous completion. It establishes the contracts and validation rules required before those integrations are allowed to execute work.
