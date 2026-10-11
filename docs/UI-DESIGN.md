# Matterhorn UI contract

Status: canonical. Redesign approved by the owner on 2026-10-11 (prototype: “Matterhorn Redesign” canvas, including its Button map board).

## The rule that matters most

**Every control does something real.** A control ships only when the backend behind it works. If a feature is not ready it is hidden; if it is ready but needs setup it shows one **How to fix / Set up** path that leads to the fix. `tests/web.test.mjs` clicks every button, link, select and checkbox on every screen and fails if any of them does nothing. Do not weaken that test to make a control pass — make the control work or remove it.

No made-up numbers: every status, score and pass/fail comes from a real check. No fake previews, progress percentages, rig claims or “ready” badges.

## Structure: four places plus one assistant

1. **Studio** (`#studio`, home) — one request box: “What do you want to make or change?”. Go routes the request: asset → a Blender Agent build in the Asset Library; game change → a plan the user approves before anything changes; question → an answer. Below: **Needs you**, **In progress**, **Recent**, all from live runs and builds.
2. **My Game** (`#game/changes|checks|files`) — one page per game with a game picker (**+ Add a game…** registers a Godot folder). **Play in Godot**, **Run checks**. Changes show Plan → Build → Check → Your OK, “What changed and why”, Approve & keep, Cancel, Try again, Download proof. Checks show real Godot/scenario/playtest criteria and configured project checks. Files: read, Explain, propose an edit (diff first, Apply/Discard, Undo).
3. **Assets** (`#assets`, `#assets/<id>`, `#assets/build/<jobId>`) — library grid, **+ Make an asset** (type, style, builder, 1–4 drafts, or a matching set), asset page (views, Change it → new version, Send to game, downloads, versions, keep-a-draft, rename, remove), failed builds explain why and offer Retry / Retry with Claude.
4. **Settings** (`#settings`) — **Connections** (Ollama, Claude Code, Blender, Godot + Flyrail, project memory, ComfyUI) each with real status, How to fix, Check again; **AI** (chat model, asset builder); **Advanced** (safety limits, readiness scorecard, services).

**Ask Matterhorn** is a side panel on every page and is told what the user is looking at.

Old links redirect: `#home`→Studio, `#runs`/`#pipeline`/`#output`→My Game, `#projects`→My Game › Files, `#validation`/`#evidence`→My Game › Checks, `#create`→Assets, `#specialists`→Settings, `#chat`→assistant.

## Not in the UI until real

- Character rigging/animation and the Character Studio cockpit: the server’s `/api/motion/*`, `/api/characters/*` and live-session landmark scores are placeholders. They come back only when backed by the real rigging pipeline in `core`.
- Timeline “Undo to here” for game changes (needs checkpoint restore).
- Styles with reference images (styles are text-only today).

## Look

Dark navy, calm: one obvious primary action per screen, big targets (≥44 px), plain words (“Make”, “Change my game”, “Check”, “Approve”), progress as clear steps, works at phone width. System font (Segoe UI on Windows); the server’s Content-Security-Policy forbids inline styles and third-party fonts, so all styling lives in `web/styles.css`.

## Code map

`web/index.html` (shell) · `web/app.js` (router, assistant, setup status) · `web/ui.js` (helpers) · `web/pageStudio.js` · `web/pageGame.js` · `web/pageAssets.js` · `web/pageSettings.js` · `web/styles.css`.
