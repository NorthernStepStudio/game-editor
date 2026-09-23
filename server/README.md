# Matterhorn Server

Local HTTP shell for standalone Matterhorn. Serves the web UI from `web/` and exposes chat plus Studio APIs. VS Code is not required.

Shared runtime lives in `core/` (`@nss/m-core`). The optional VS Code extension under `extension/` can still target this server.

## What It Does

- Serves Chat / Studio / Projects / Evidence / Settings at `http://127.0.0.1:<port>/`
- `GET /health` — status and provider mode
- `GET /providers` — safe provider availability (no secrets)
- `POST /ask` — chat against the configured provider
- `GET /api/projects` — configured Godot projects
- `GET /api/studio/health` — Flyrail daemon connection (tokens stay server-side)
- `POST /api/studio/plan` — validate/review a Studio plan
- `POST /api/studio/runs` — start a run
- `GET /api/studio/runs` / `GET /api/studio/runs/:id` — list and detail
- `POST /api/studio/runs/:id/cancel` — request cancellation
- `GET /api/studio/runs/:id/events` — SSE run updates
- `GET /api/studio/runs/:id/evidence` — inspectable task results/evidence refs

Security controls: loopback bind, same-origin checks, 64 KiB body limit, static path confinement, CSP, no CORS ACAO, one active Studio run at a time. Unknown projects and malformed plans are rejected. Studio snapshots and evidence metadata persist under `MATTERHORN_DATA_DIR` (default `.matterhorn`) and are reconciled read-only after restart; uncertain mutations are never resubmitted automatically.

## Run Locally

From the repo root:

```sh
npm ci
npm run compile
npm start
```

Or `npm run dev:server` to compile and launch together. Default URL: `http://127.0.0.1:3001`. If that port is taken, the server picks a free port and may write `.nstep-workspace-ai-server-port.json` for the optional extension.

## Provider Modes

`mock` (default without credentials), `off`, `gemini`, `openai`, `anthropic`, `ollama`, `lmstudio`.

Set `M_CORE_PROVIDER_MODE` and matching credentials/model env vars on the server. Mock chat is labeled and does not execute or validate Studio work.

## Flyrail / projects

```text
MATTERHORN_PROJECTS=[{"id":"my-game","name":"My Game","path":"/absolute/path/to/project"}]
FLYRAIL_REPO_ROOT=/absolute/path/to/flyrail
```

Or `FLYRAIL_DAEMON_URL` + `FLYRAIL_DAEMON_TOKEN`. Never put the daemon token in browser code.

## Checks

```sh
npm run check
npm run test:live
```

See `docs/MATTERHORN-VALIDATION.md` for delivered scope and the PC acceptance checklist.
