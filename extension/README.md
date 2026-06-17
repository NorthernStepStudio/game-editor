# NSS Workspace AI

Local-first VS Code extension for Northern Step Studio.

This extension lives in the `matterhorn-vscode` repo:

- `extension/` — this package
- `server/` — local HTTP backend
- `core/` — @nss/m-core shared runtime

## What It Does

- asks the local backend for workspace-aware responses
- gathers current file, selection, project, memory, knowledge, and workflow context
- stores latest responses, review items, tasks, diagnostics, and roadmap notes locally
- proposes edits with review-first apply flows
- runs safe local workspace tasks
- tracks diagnostic sessions, repair patterns, and project rules
- supports modes, presets, workflows, knowledge packs, and studio project switching
- exposes a compact NSS sidebar plus command-palette entry points

## Run Locally

1. Open the `matterhorn-vscode` repo in VS Code.
2. Run `npm install` at the repo root.
3. Press `F5` and choose **Matterhorn (Full)** to launch the server and extension together.
4. Leave `nssWorkspaceAi.serverUrl` at its default to follow the server's port file automatically.
5. Open the **Matterhorn** sidebar in the Extension Development Host.

## Useful Commands

- `NSS: Ask Workspace AI`
- `NSS: Explain This File`
- `NSS: Search Codebase`
- `NSS: Run Workspace Task`
- `NSS: Ask About This Error File`
- `NSS: Propose Fix For This Error File`
- `NSS: Propose Multi-File Change`
- `NSS: Propose Edit for Current File`
- `NSS: Start Diagnostic Session From Last Failure`
- `NSS: Switch Mode`
- `NSS: Switch Preset`
- `NSS: Run Workflow`
- `NSS: Rebuild Knowledge Packs`
- `NSS: Open Review Center`
- `NSS: Show Studio Dashboard`
- `NSS: Show Quick Start`

## Settings

- `nssWorkspaceAi.serverUrl`
- `nssWorkspaceAi.autoSuggestPresetForWorkspace`
- `nssWorkspaceAi.defaultMode`

## Development

- `npm run compile`
- `npm run check`
- `npm run test:extension-host`
- `npm run verify:runtime`
- `npm run watch`

`npm run test:extension-host` compiles and starts the bundled server from `server/`, launches an Extension Development Host, points the extension at the live temporary server URL, and verifies a real `POST /ask` roundtrip.

## Folder Shape

This app is organized around:

- `src/commands`
- `src/sidebar`
- `src/api`
- `src/state`
- `src/models`
- `src/services`
- `src/helpers`
- `src/storage`
- `src/config`
- `src/test`
- `docs`

## Backend Contract

The extension currently expects:

- `POST /ask`

The client accepts plain-text responses and JSON responses that expose values through fields such as:

- `response`
- `answer`
- `text`
- `message`
- `content`
- `body`
- `output`
- `result`

Proposal bodies can be returned separately through:

- `proposedText`
- `fileContent`
- `updatedFileContent`
- `replacement`
- `newFileContent`

If the backend returns only a proposal body plus a `summary` or `preview`, NSS treats that summary as the readable response and keeps the proposal body reviewable/applyable.

Runtime coverage now comes from:

- shared runtime compile and smoke validation in `core/`
- extension compile, smoke, and extension-host validation in `extension/`
- backend compile and `/health` + `/ask` smoke validation in `server/`
- a live extension-host roundtrip against the bundled server during `npm run test:extension-host`

## Current Integration Notes

- command registration now runs through a typed registry in `src/commands`
- sidebar quick actions change based on mode, review state, workflow state, and task-failure state
- likely error files can now flow directly into "Ask About This Error File" and "Propose Fix For This Error File"
- multi-file proposal review queues start from the active file plus related files
- `core/` holds NSS Master Core (M-CORE), the shared NSS runtime, agents, providers, policies, and model-facing logic
- `.vscode/launch.json` and `.vscode/tasks.json` support running the server and extension together
