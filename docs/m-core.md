# NSS Master Core (M-CORE)

`packages/m-core` is the shared NSS AI runtime layer.

It is intentionally separate from the VS Code extension and the HTTP server:

- `apps/nss-workspace-ai` is the VS Code client and control surface
- `apps/nss-workspace-ai-server` is the thin HTTP transport shell
- `packages/m-core` is the reusable runtime, agent routing, provider selection, shared policy layer, and shared response logic

Current package shape:

- `src/core`
- `src/agents`
- `src/providers`
- `src/policies`
- `src/tools`

Current provider modes:

- `mock`
- `off`
- `gemini`

Current built-in agents:

- `general`
- `neuromoves`

Public package name:

- `@nss/m-core`

Example import:

```ts
import { runAgent } from "@nss/m-core";
```
