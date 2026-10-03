# Matterhorn agent startup — mandatory

Every coding agent working in this repository must consume this brief before making changes, pushing commits, opening a PR, rerunning CI, or recommending the next implementation step.

## First actions

1. Read `AGENTS.md`.
2. Run `npm run agent:start`.
3. Read `docs/GATE-0-AUTONOMY-VALIDATION.md` and determine whether the mandatory local gate has passed on the current canonical branch.
4. Read the files printed by the preflight that are relevant to the task.
5. Inspect the current branch, recent implementation, and any failed validation before changing code.
6. Only then plan or implement.

Do not skip this sequence because the requested change looks small.

## CI budget rule

GitHub Actions currently runs the Matterhorn deterministic matrix on:

- pushes to `master`;
- pushes to `feat/**`;
- pull requests.

That matrix uses both Ubuntu and Windows. A chain of small pushes to a `feat/**` branch can therefore burn CI twice per push.

Default development behavior:

- use `integration/**` for iterative autonomous work;
- batch related changes before intentionally triggering CI;
- do not open a PR until the batch is review-ready;
- inspect the exact failed job/log before making another fix;
- do not rerun a failed workflow just to see whether it passes;
- do not push speculative one-line fixes repeatedly;
- do not move work onto `feat/**` merely because the task is a feature.

An intentional CI-triggering branch is allowed only for a review-ready validation batch or when the user explicitly asks for it.

## Mandatory Gate 0

The current autonomy integration line requires the canonical local gate in `docs/GATE-0-AUTONOMY-VALIDATION.md` before adding another autonomy feature.

- Matterhorn: `npm run gate:autonomy-local`
- Flyrail companion branch: `npm run gate:autonomy-local`
- Do not substitute remote CI for this local gate.
- Do not open a PR merely to obtain validation.
- After both local gates pass, use the Yun timer/tie/difficulty-star request described in the Gate 0 document as the real live end-to-end proof.

If Gate 0 has not passed on the current canonical integration branch, validation/fix work takes priority over new autonomy features.

## Build strategy

Matterhorn follows **reuse → integrate → customize → build only when needed**.

Before implementing generic infrastructure such as memory, browser control, sandboxing, telemetry, evaluation, workflow durability, or agent-runtime plumbing, check `docs/OSS-ACCELERATION.md` and evaluate mature permissively licensed open source first.

Reuse must remain behind Matterhorn-owned interfaces. Keep Matterhorn's product identity, Studio UX, agent names, specialist architecture, evidence model, policies, and game-development workflows. Upstream names belong only in internal diagnostics, provenance, and required license notices.

## Product direction

Matterhorn is a standalone Northern Step Studio AI assistant and Studio application. VS Code is optional legacy integration, not the product runtime.

Primary implementation:

- `web/` — Matterhorn product UI;
- `server/` — local APIs and services;
- `core/` — shared runtime/orchestration contracts.

Core architecture remains:

`Matterhorn orchestrator → specialist agent → skill → adapter → execution → evidence → Sentinel → repair/acceptance`

Do not create a competing orchestration control plane beside Matterhorn.

## Safety and delivery

- Never fabricate successful execution or evidence.
- Missing or uncertain evidence remains blocked/visible.
- Do not automatically resubmit an uncertain remote mutation after restart.
- Do not merge, force-push, release, or promote assets automatically.
- Do not expose secrets/tokens to browser code.
- Keep real Godot/Blender/Flyrail PC gates separate from deterministic CI.
- Preserve current working gates while swapping underlying generic infrastructure.

## Canonical context

Read as needed:

- `AGENTS.md`
- `README.md`
- `docs/MATTERHORN-IMPLEMENTATION-PLAN.md`
- `docs/AGENT-ARCHITECTURE.md`
- `docs/MATTERHORN-VALIDATION.md`
- `docs/WORKSPACE-MIGRATION.md`
- `docs/OSS-ACCELERATION.md`

If these documents conflict, verify current code/branch state and update stale documentation rather than silently following an old handoff.
