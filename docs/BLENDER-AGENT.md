# Blender Agent and the Asset Library

Describe an asset in words; Matterhorn builds it in Blender on this PC. Assets do not need a game project.

## Start everything

```powershell
npm run studio
```

`tools/start-matterhorn.ps1` starts Ollama (if needed), the Flyrail daemon in live Godot mode (if `FLYRAIL_REPO_ROOT` is set), then the Matterhorn server, and opens the browser. Logs go to `.matterhorn/logs/`.

## How a build works

1. A **script author** writes Blender Python for the description:
   - `blender-agent-claude` — headless Claude Code with every tool disabled (`--tools ""`); it can only answer with text. Needs a one-time `claude` sign-in and network providers allowed in routing settings.
   - `blender-agent-local` — the local Ollama model (`MATTERHORN_ASSET_AGENT_OLLAMA_MODEL`, else `OLLAMA_MODEL`). Free and offline; quality is basic.
2. The **script guard** (`core/src/foundry/assets/providers/blenderAgent/scriptGuard.ts`) rejects imports outside `bpy, bmesh, mathutils, math, random, colorsys`, file/process/network calls, introspection escapes, and harness-reserved operators.
3. The **Matterhorn harness** runs the script in a background Blender (`--factory-startup --disable-autoexec`) with restricted builtins and an import allowlist, then validates the scene: visible meshes, faces, plausible size, triangle budget, and **connectivity** (no floating parts unless the request is deliberately scattered).
4. The harness — never the model — centers the asset on the ground, saves the `.blend`, exports the GLB, and renders front / three-quarter / side / back views. Sprite kinds also render an 8-direction sheet (`sprite_sheet`) or a pixel-art sprite (`pixel_sprite`).
5. Any failure (guard, Blender traceback, validation) goes back to the author with the failing line quoted, up to 3 attempts. Attempts are recorded in `attempts.json`.

The guard and harness narrow what a well-meaning model can do; they are not a hostile-code sandbox.

## Where files go

- Asset Library (default target): `asset-library/` in this repo (gitignored), or `MATTERHORN_ASSET_LIBRARY`.
- Each asset folder holds the GLB/PNG, `.blend`, the generator script, renders, `report.json` and `attempts.json`.
- **Send to game** copies the deliverables into `<project>/assets/matterhorn/<assetId>/` with `matterhorn-provenance.json`.

## Versions and packs

- **Iterate**: the asset inspector's "Iterate on this asset" creates `<id>_v2`, `_v3`, … The previous script is given to the author with the requested change; earlier versions stay in the catalog with lineage.
- **Packs**: one style + up to 12 items; each item becomes `<packId>_<item>` and shares the style text. Builds run one after another.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/foundry/projects` | Asset Library + configured game projects |
| POST | `/api/foundry/jobs` | Queue a build (same body as `/api/foundry/generate`) |
| GET | `/api/foundry/jobs`, `/api/foundry/jobs/:id` | Build status and progress |
| POST | `/api/foundry/packs` | `{projectId, packId, style, items:[{name, prompt?}], kind, providerId}` |
| GET | `/api/foundry/assets/:id/files/:name` | Download a file belonging to the asset |
| POST | `/api/foundry/assets/:id/send` | `{projectId}` — copy into a game project |

Jobs are held in memory; restarting the server forgets in-flight builds (finished assets persist in the catalog).
