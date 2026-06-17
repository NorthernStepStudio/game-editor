# Matterhorn — VS Code Extension + AI Agent

An AI-powered VS Code extension and local agent by Northern Step Studio. Provides workspace-aware assistance for coding, debugging, and project management with local AI execution capabilities.

## Project Structure

This is a **TypeScript monorepo** managed with **npm workspaces**:

- `core/` (`@nss/m-core`) — Shared AI runtime; supports Gemini, Mock, and local LLM providers
- `server/` (`nss-workspace-ai-server`) — Local HTTP backend exposing `/health` and `/ask` endpoints
- `extension/` (`nss-workspace-ai`) — The VS Code extension itself
- `bridges/synox-local-bridge/` — Bridge for local LLM providers (LM Studio / Ollama)
- `docs/` — Architecture and QA documentation

## Running in Replit

The **server** component runs as a local HTTP API on port 3001:

```
SERVER_HOST=0.0.0.0 node server/out/index.js
```

The server defaults to **Mock** provider mode. To use Gemini, set `GEMINI_API_KEY` (or any of the supported key env vars).

### Build

```bash
npm run compile        # compile all workspaces
npm run compile:core   # compile core only
npm run compile:server # compile server only
```

### API Endpoints

- `GET /health` — Returns status, provider mode, and timestamp
- `POST /ask` — Send a question payload to the AI runtime

### Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3001) |
| `SERVER_HOST` | Bind host (default: 127.0.0.1) |
| `GEMINI_API_KEY` | Gemini API key (enables Gemini provider) |
| `GEMINI_MODEL` | Gemini model name (default: gemini-2.5-flash) |
| `M_CORE_PROVIDER_MODE` | Force provider: `mock`, `gemini`, or `off` |

## User Preferences

- Keep the server binding configurable via `SERVER_HOST` env var
- Port state file is disabled in Replit (read-only filesystem constraint)
