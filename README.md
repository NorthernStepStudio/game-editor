# Matterhorn

Matterhorn is Northern Step Studio's standalone local AI assistant and Studio coordinator. Use **Chat** to discuss work and **Studio** to review and run Godot tasks through Flyrail. VS Code is not required.

## Main project direction: standalone Matterhorn

**Matterhorn is being built as its own standalone AI assistant and Studio application. It is not a VS Code extension product, and VS Code must not be required to use it.** This direction governs feature work, architecture and recommendations about what to do next.

Build the primary experience in `web/`, `server/` and `core/`: Chat, Studio, Projects, Evidence and Settings. The existing `extension/` is optional legacy integration and migration reference. Its age or feature count does not make extension development the project priority. Bring useful capabilities into the standalone app; do not make new core workflows depend on VS Code.

**Current state:** persistent Studio run/evidence history, fail-closed restart recovery, reviewed multi-file change sets, and server-configured validation tasks are implemented. **Next engineering milestone:** criterion-specific gameplay checks with inspectable evidence, followed by the real PC/Flyrail/Godot and visual acceptance gate. Blender follows that gate.

Agents should read [AGENTS.md](AGENTS.md) and the [current implementation plan](docs/MATTERHORN-IMPLEMENTATION-PLAN.md) before proposing next steps. Older extension-oriented material describes legacy context, not the current product direction.

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

Studio planning creates an ordered, reviewed specialist graph for supported work: Foundry for assets, Blender Engine for structured 3D tasks, Flyrail for Godot implementation, and Matterhorn for evidence aggregation. Godot work adds Flyrail and final QA; asset requests add Foundry; 3D game requests can add Blender; Blender-only work skips Flyrail. Task payloads and dependency evidence persist with Studio history. Provider selection follows server routing preferences, while per-request network and cost approvals remain off by default. Arbitrary Blender work still requires a supported fixture or a validated structured Blender task specification. The Create/Pipeline UI connection is tracked separately while its current UI work proceeds. General-purpose chat does not execute changes. Project generation, autonomous arbitrary feature implementation and visual correctness depend on Flyrail's supported capabilities and must not be inferred from this UI.

## Acceptance and evidence

The current Flyrail schema can prove these exact gate criteria from its persisted evidence bundle:

- `Godot validation passes`
- `Scenario checks pass`
- `QA checks pass`
- `Playtest passes` (requires a real playtest result)

Custom acceptance criteria remain **blocked** until the execution system supplies verifiable criterion-specific evidence. Passing generic gates does not prove arbitrary gameplay requirements. Matterhorn checks persisted bundle identity, matching gate values and confinement to the project's evidence directory. Missing evidence never produces a completed Studio run.

Cancellation stops further scheduling. Flyrail currently cannot stop an active `loop.run`; Matterhorn waits for it to settle. On uncertain timeout the run stays cancellation-requested and new runs are blocked. Studio snapshots persist under `MATTERHORN_DATA_DIR`; after restart Matterhorn reconciles remote status/result read-only and never resubmits an uncertain mutation.

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

## Standalone workspace tools

Open **Projects**, choose a configured project, then browse or search source files. Workspace tools support ordinary source projects as well as Godot projects; only Studio execution requires `project.godot`.

- Read a file and use **Explain**, **Plan change**, **Propose edit**, or **Diagnose error**. These actions send the saved file and up to 200 source filenames to the selected chat provider.
- Edit the text manually, then choose **Review this file** for a single-file proposal, or add edits from multiple existing files to a **change set**. Nothing is written until you approve the reviewed proposal or transaction.
- Review before/after content, reject a proposal, or restore an applied edit. A changed file version blocks apply/restore instead of overwriting newer work.
- Backups, single-file reviews, multi-file transaction journals, and Studio snapshots persist under `MATTERHORN_DATA_DIR` (default `.matterhorn`). Multi-file apply preflights every file, journals progress, rolls back known partial writes on immediate failure, and becomes `conflict` rather than guessing after an ambiguous restart.

The current workflow handles existing UTF-8 source files up to 32 KiB each; a reviewed multi-file transaction supports 2–20 files. New-file creation and delete/rename operations are not exposed yet. Hidden/generated paths, linked files and common credential patterns are excluded. This is not comprehensive secret detection; review file contents before sending them to a cloud provider. Search is literal and bounded, not a semantic index. AI tool-call output is never executed by these routes. Mock providers produce explanations but no concrete edits.

Apply/restore, multi-file transactions, and configured validation tasks are blocked while a known Studio run is active. Validation commands come only from server-side `MATTERHORN_VALIDATIONS` configuration and run without a shell; the browser can select an approved task ID but cannot submit a command. See `docs/WORKSPACE-MIGRATION.md` for delivered and remaining extension migrations.
