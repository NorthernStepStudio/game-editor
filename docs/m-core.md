# NSS Master Core (M-CORE)

`core/` is the shared Matterhorn runtime package published internally as `@nss/m-core`.

It is intentionally separate from the VS Code extension and HTTP server:

- `extension/` is the VS Code client and control surface.
- `server/` is the thin HTTP transport shell.
- `core/` owns shared runtime behavior, agent routing, provider selection, policies, studio orchestration contracts, and reusable response logic.

## Current package shape

- `src/core`
- `src/agents`
- `src/providers`
- `src/policies`
- `src/tools`
- `src/studio`

## Current provider modes

- `mock`
- `off`
- `gemini`
- `openai`
- `anthropic`
- `ollama`
- `lmstudio`

## Current built-in agents

- `general`
- `workspace-ops`
- `stack-expert`
- `architect`

All are user-facing as Matterhorn. Agent IDs describe internal routing roles, not separate assistant identities.

## Studio orchestration

The `src/studio` layer defines transport-neutral contracts for Matterhorn to coordinate specialist execution systems such as Flyrail and the planned Blender Engine.

See `docs/studio-orchestration.md` for ownership boundaries, handoff protocol, availability states, and the implementation roadmap.

## Public package name

`@nss/m-core`

Example import:

```ts
import { runAgent } from "@nss/m-core";
```
