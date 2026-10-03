# Matterhorn 100

`Matterhorn 100` is the canonical completion metric for the full Northern Step Studio autonomous game-development vision.

It answers two different questions:

- **Capability coverage** — how much of the required product surface currently exists in code.
- **Production readiness** — how much of that surface has progressed through implementation, local proof, live proof, and production hardening.

The two numbers must not be conflated.

## Current baseline

On 2026-10-03, before running the post-consolidation local/live gate:

- Capability coverage: **57.5 / 100**
- Production readiness: **33.4 / 100**

The canonical calculation lives in:
`server/src/services/completionScorecard.ts`

The public API is:
`GET /api/studio/completion`

The standalone UI renders it in:
`Settings -> Matterhorn 100`

## Stage factors

Each weighted requirement has one maturity stage:

| Stage | Readiness credit | Meaning |
| --- | ---: | --- |
| missing | 0% | Required capability is absent. |
| planned | 10% | Canonical design/adoption decision exists, but no working implementation. |
| implemented | 45% | Code is present on the canonical branch, but current local proof is incomplete. |
| local_verified | 65% | Focused deterministic/local tests have passed on the canonical branch. |
| live_verified | 85% | Real editor/runtime/end-to-end proof has passed on the canonical branch. |
| production_ready | 100% | Release-grade hardening, UX, rollback/operability and required target validation are complete. |

A requirement may only move forward when evidence supports the new stage.

## Pillar weights

- Intent & planning — 10
- Intelligence & project memory — 10
- Godot autonomy / Flyrail — 15
- Asset production — 15
- Gameplay systems & PvE — 10
- Sentinel & proof — 10
- Repo, build & release — 10
- Product UX — 8
- Reliability & scale — 7
- Safety, cost & provenance — 5

Total: **100**

## Anti-gaming rules

1. Writing code alone never counts as verified.
2. A historical pass on a diverged branch does not automatically make the canonical integration branch live-verified.
3. Mock/deterministic tests do not substitute for real Godot/Blender/provider/runtime proof when the requirement is inherently live.
4. A builder may not grade its own completion; Sentinel or another independent gate must verify acceptance.
5. Missing required proof is blocked, not passed.
6. Planned optional packs count only 10% until actually integrated; merely finding an OSS repo cannot inflate the score.
7. A new dependency must pass license/security/architecture review before it can advance beyond planned.
8. Removing a capability, breaking a gate, or invalidating prior evidence can reduce the score.

## What 100 means

Matterhorn reaches 100 only when it can reliably:

1. accept a high-level game-development goal;
2. understand the existing project and preserve durable context;
3. produce/edit a specialist-owned plan with measurable acceptance;
4. create or modify code, 2D, 3D, animation and audio assets through the appropriate specialists;
5. run the actual game and exercise gameplay;
6. run deterministic, unit, scenario, playtest, visual, performance and target-platform checks as applicable;
7. diagnose and repair failures within bounded budgets;
8. preserve provenance, cost, licensing, tool and run evidence;
9. have Sentinel independently verify required proof;
10. package/export/release through Repo/Build with rollback and explicit human release approval;
11. recover safely from restarts and prevent conflicting parallel mutations;
12. do all of the above from the standalone Matterhorn product without requiring VS Code/Cursor as the primary control surface.

## Updating the score

When a feature changes one of these requirements:

1. update its stage in `completionScorecard.ts`;
2. update its evidence and next-step text;
3. run `completionScorecard.test.ts`;
4. never promote to `local_verified` without current local evidence;
5. never promote to `live_verified` without a current real runtime/editor/end-to-end proof;
6. never promote to `production_ready` until the user-facing and release/operability requirements for that item are actually complete.

The score is an operating metric, not marketing copy.
