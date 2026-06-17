# 🏔️ Matterhorn VS Code Extension

**Matterhorn** is an AI-powered VS Code extension and local agent built by [Northern Step Studio](https://northernstepstudio.com). It provides workspace-aware AI assistance for coding, debugging, planning, and project management — all running locally.

## Repository Structure

```
matterhorn-vscode/
├── extension/              VS Code extension (sidebar, commands, review center)
├── server/                 Local HTTP backend (/health, /ask)
├── core/                   @nss/m-core — shared AI runtime (agents, providers, policies)
├── bridges/
│   └── synox-local-bridge/ Local reasoning bridge (LM Studio / Ollama)
├── docs/                   Architecture, QA checklists, naming specs
└── .vscode/                Debug launch configs (F5)
```

## Components

| Package | Name | Description |
|---------|------|-------------|
| `extension/` | `nss-workspace-ai` | VS Code extension — sidebar, 50+ commands, review center, diagnostic sessions |
| `server/` | `nss-workspace-ai-server` | Local HTTP server exposing `/health` and `/ask` endpoints |
| `core/` | `@nss/m-core` | Master Core — shared AI runtime with agents, providers, policies, and tools |
| `bridges/synox-local-bridge/` | `@nstep/synox-local-bridge` | Local reasoning bridge for LM Studio / Ollama |

## Quick Start

### Prerequisites

- Node.js >= 18
- VS Code >= 1.85.0

### Install & Build

```bash
npm install
npm run compile
```

### Run in VS Code

1. Open this repo in VS Code
2. Press `F5` and select **Matterhorn (Full)** to launch both the server and extension
3. Or select **Matterhorn Extension** / **Matterhorn Server** individually

### Run Server Standalone

```bash
npm run dev:server
```

Default: `http://127.0.0.1:3001`

## Extension Features

### Core AI Commands
- **Ask Matterhorn** — workspace-aware AI chat
- **Explain This File** — AI-powered file explanation
- **Search Codebase** — semantic codebase search
- **Plan Change** — AI-assisted change planning
- **Propose Edit / Multi-File Change** — review-first code proposals

### Diagnostics & Debugging
- **Start Diagnostic Session** — structured debugging from task failures
- **Find Likely Error Files** — AI-assisted error location
- **Compare Last Two Results** — diff task outcomes
- **Save Repair Pattern** — learn from fixes

### Studio & Project Management
- **Switch Mode** (coding, debugging, product, marketing, research)
- **Switch Preset** — workspace-specific configurations
- **Run Workflow** — multi-step guided workflows
- **Knowledge Packs** — rebuild and search workspace knowledge
- **Review Center** — approve/reject/apply proposed changes
- **Studio Dashboard** — cross-project overview
- **Roadmap Notes** — track project roadmap items

## Provider Modes

The server supports multiple AI provider backends:

| Mode | Description |
|------|-------------|
| `mock` | Returns mock responses (default, no API key needed) |
| `off` | Disables AI responses |
| `gemini` | Connects to Google Gemini API |

### Gemini Setup

```bash
M_CORE_PROVIDER_MODE=gemini
M_CORE_GEMINI_API_KEY=your-key-here
M_CORE_GEMINI_MODEL=gemini-2.5-flash
```

## Development

```bash
# Compile all packages
npm run compile

# Compile individually
npm run compile:core
npm run compile:server
npm run compile:extension

# Watch mode
npm run watch:core
npm run watch:server
npm run watch:extension

# Run checks (compile + smoke tests)
npm run check
```

## Branding

- **Matterhorn** — user-facing agent name (UI labels, commands)
- **Synox** — core intelligence engine / runtime references
- **NStep AI** — ecosystem umbrella term
- **M-CORE / @nss/m-core** — shared runtime package

## License

Private — Northern Step Studio. All rights reserved.
