# Matterhorn

Matterhorn is Northern Step Studio's standalone local AI assistant and Studio coordinator. Use **Chat** to discuss work and **Studio** to review and run Godot tasks through Flyrail. VS Code is not required.

## Start

Requires Node.js 22 or newer and npm.

```sh
npm ci
npm run compile
npm start
```

Open `http://127.0.0.1:3001`. If that port is occupied, the server reports a free port. Run `npm run dev:server` to compile and launch together.

## Configure a Godot project

Set `MATTERHORN_PROJECTS` to a JSON array in your server environment or root `.env` file:

```text
MATTERHORN_PROJECTS=[{"id":"my-game","name":"My Game","path":"D:/dev/My Game"}]
FLYRAIL_REPO_ROOT=D:/dev/Northern Step Studio/apps/flyrail
```

The project must already contain `project.godot`. Flyrail must be running on the same machine with access to Godot and the project. The adapter discovers `.flyrail-daemon.json` from `FLYRAIL_REPO_ROOT`. You may instead configure `FLYRAIL_DAEMON_URL` and `FLYRAIL_DAEMON_TOKEN` on the server. Never put the daemon token in browser code or commit it.

Studio currently creates a single reviewed Godot task from your goal. The core controller also supports multi-task dependency plans. General-purpose chat does not execute changes. Project generation, autonomous arbitrary feature implementation and visual correctness depend on Flyrail's supported capabilities and must not be inferred from this UI.

## Acceptance and evidence

The current Flyrail schema can prove these exact gate criteria from its persisted evidence bundle:

- `Godot validation passes`
- `Scenario checks pass`
- `QA checks pass`
- `Playtest passes` (requires a real playtest result)

Custom acceptance criteria remain **blocked** until the execution system supplies verifiable criterion-specific evidence. Passing generic gates does not prove arbitrary gameplay requirements. Matterhorn checks persisted bundle identity, matching gate values and confinement to the project's evidence directory. Missing evidence never produces a completed Studio run.

Cancellation stops further scheduling. Flyrail currently cannot stop an active `loop.run`; Matterhorn waits for it to settle. On uncertain timeout the run stays cancellation-requested and new runs are blocked. Inspect/stop remote work before restarting the server. Run history is in memory; export evidence before restart.

## Providers

Chat uses the existing server-side provider configuration: Gemini, OpenAI, Anthropic, Ollama or LM Studio. Set `M_CORE_PROVIDER_MODE` and the matching provider credentials/model on the server. The default without credentials is mock mode and is explicitly labeled. Settings shows provider availability without exposing secrets.

## Verification

```sh
npm run check
npm run test:live
```

`check` compiles and runs deterministic tests. `test:live` requires the real daemon and Godot, creates a disposable project in a path with spaces, initializes its Git baseline, and checks controller completion against persisted evidence. Missing prerequisites fail the live gate rather than pass through a skip. Reports are written to `.matterhorn/evidence/`.

## Structure

- `core/src/studio/`: contracts, adapter registry, scheduler, run store and evidence validator.
- `core/src/studio/adapters/flyrail/`: daemon protocol and persisted evidence checks.
- `server/`: local HTTP APIs, project configuration and event streams.
- `web/`: standalone Chat, Studio, Projects, Evidence and Settings.
- `extension/`: optional legacy VS Code integration, excluded from the default installation/build; retained for migration reference.
- `docs/MATTERHORN-IMPLEMENTATION-PLAN.md`: scope, order and acceptance.
- `docs/MATTERHORN-VALIDATION.md`: actual verification and PC checklist.

Blender remains a subsequent milestone after the Matterhorn/Flyrail live gate passes. No automatic merges or release promotion.
