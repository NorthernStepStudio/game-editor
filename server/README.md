# NStep Workspace AI Server

Local backend shell for the VS Code extension in `apps/nstep-workspace-ai`.

The shared NSS AI core now lives in:

- `core/` (@nss/m-core)

## What It Does

- exposes `GET /health`
- exposes `POST /ask`
- accepts the typed NSS workspace request payload
- delegates AI/runtime work to the shared `@nss/m-core` package
- supports `mock`, `off`, and `gemini` provider modes

## Run Locally

1. `npm install`
2. `npm run check`
3. `npm run start`

Default URL:

- `http://127.0.0.1:3001` when available

If `3001` is already in use, the server automatically falls back to a free port and writes the chosen port to `.nstep-workspace-ai-server-port.json` at the repo root. The extension reads that file when `nssWorkspaceAi.serverUrl` is left at its default.

## Provider Modes

- `mock`
- `off`
- `gemini`

Default behavior is `mock` unless a Gemini API key is present, or unless you explicitly set the provider mode.

## Optional Gemini Mode

Set these environment variables to let the server call Gemini:

- `M_CORE_PROVIDER_MODE=gemini`
- `M_CORE_GEMINI_API_KEY`
- `M_CORE_GEMINI_MODEL=gemini-2.5-flash`

Optional:

- `M_CORE_GEMINI_BASE_URL`
- `M_CORE_REQUEST_TIMEOUT_MS=30000`

Backward-compatible `RESPONSE_OS_*` and legacy NSS env names are still accepted, but `M_CORE_*` is now the preferred path.

The extension package now uses this bundled server during its live `npm run test:extension-host` verification path.
