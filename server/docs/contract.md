# NSS Workspace AI Server Contract

## Health

`GET /health`

Example response:

```json
{
  "status": "ok",
  "mode": "mock",
  "detail": "NSS Master Core (M-CORE) mock mode. Deterministic local responses, no external model required.",
  "checkedAt": "2026-03-13T21:00:00.000Z"
}
```

## Ask

`POST /ask`

Example request:

```json
{
  "prompt": "Explain this file clearly.",
  "intent": "explain-file",
  "workspace": {
    "name": "Northern Step Studio",
    "rootPath": "D:\\dev\\Northern Step Studio"
  },
  "mode": "coding",
  "presetId": "general-nss-studio",
  "studioProjectId": "general-nss-studio",
  "activeFile": {
    "path": "apps/nstep-workspace-ai/src/extension.ts",
    "languageId": "typescript",
    "content": "import * as vscode from 'vscode';\nexport function test() {}\n"
  }
}
```

Example response:

```json
{
  "title": "Explain extension.ts",
  "response": "Intent: explain-file\nPrompt: Explain this file clearly.\nWorkspace: Northern Step Studio (D:\\dev\\Northern Step Studio)\nAgent: General NSS Studio Agent\nAgent focus: Local-first studio operating help for coding, debugging, planning, and safe review flows.\nMode/Preset/Project: coding / general-nss-studio / general-nss-studio\n\nActive file:\n- Path: apps/nss-workspace-ai/src/extension.ts\n- Language: typescript\n- Size: 2 lines\n- Imports: 1\n- Exports: 1\n- Functions: 1\n\nRecommended next steps:\n- Confirm the file's role against nearby related files before editing.\n- Check whether the current selection contains the riskiest logic path.\n- Use a review proposal before applying any broad rewrite.",
  "preview": "Intent: explain-file\nPrompt: Explain this file clearly.\nWorkspace: Northern Step Studio (D:\\dev\\Northern Step Studio)\nAgent: General NSS Studio Agent"
}
```

## Proposal Behavior

When the server runs in `mock` mode through `@nss/m-core`:

- proposal intents return reviewable summaries
- proposal intents do not include `proposedText`

When the server runs in `gemini` mode:

- the server attempts to return `title`, `response`, optional `preview`, and optional `proposedText`

When the server runs in `off` mode:

- the server returns a transparent disabled response
- no proposal text is generated
