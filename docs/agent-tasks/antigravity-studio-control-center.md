# Antigravity Studio Control Center — Implementation Brief

Branch: `feat/studio-control-center-ui-20260924`
Issue: #5 · PR: #6

## Goal

Turn Matterhorn's existing web UI into the unified **Studio Control Center** —
a premium, dark-themed command surface for Matterhorn, Flyrail, Blender Engine,
QA/evidence, assets, and routing/settings.

## Primary requirements

| # | Feature | Section |
|---|---------|---------|
| 1 | Visual Create screen | Studio → Create |
| 2 | Live specialist pipeline | Studio → Pipeline |
| 3 | Live output / preview area | Studio → Output |
| 4 | Asset gallery + lineage | Studio → Assets |
| 5 | Specialist status center | Studio → Specialists |
| 6 | Visual QA / evidence | Evidence page |
| 7 | Routing / provider settings | Settings page |
| 8 | Preserve Workspace / File Review tools | Projects page |
| 9 | No secrets in browser | Security constraint |
| 10 | Do not fake backend support | Honesty constraint |
| 11 | `npm run compile` green | CI gate |
| 12 | `npm run check` green | CI gate |

## Design direction

- Premium dark Studio aesthetic (glassmorphism, smooth gradients, micro-animations)
- Responsive layout (sidebar nav + main content)
- Green accent palette consistent with existing brand (`#bdeb87` / `#b8dd8e`)
- Typography: Inter (already in use)
- All pages must work without JavaScript build tools — vanilla JS modules served
  by the existing Node HTTP server

## Architecture constraints

- Web files live in `web/` — static HTML + CSS + JS modules
- Server at `server/` — Node HTTP, no framework
- Core logic in `core/` — TypeScript, compiled to `core/out/`
- New server routes for specialist registry: `GET /api/studio/specialists`
- All existing API routes remain unchanged
- Tests in `tests/` must continue to pass

## Implementation plan

### 1. Server: add `/api/studio/specialists` route
Return the specialist registry data so the UI can show live availability.

### 2. CSS: redesign `web/styles.css`
Full rewrite with premium design tokens, glassmorphism panels, smooth transitions,
micro-animations, and responsive breakpoints.

### 3. HTML: rebuild `web/index.html`
- Restructure Studio page into tabbed sub-sections (Create, Pipeline, Output, Assets, Specialists)
- Enhance Evidence page with visual cards
- Enhance Settings with specialist health display
- Preserve all Projects page DOM (workspace tools depend on element IDs)

### 4. JS: add `web/specialists.js`
New module to fetch and render specialist status, capabilities, and health.

### 5. JS: update `web/studio.js`
Add pipeline visualization, output preview rendering, asset gallery stubs.

### 6. JS: update `web/main.js`
Wire new specialist module and Studio sub-navigation.

### 7. Tests
- Update `tests/web.test.mjs` for new DOM elements
- All existing workspace tests must pass unchanged

## Non-goals

- No React/Vue/build tooling — keep vanilla JS
- No new npm dependencies for the web layer
- No Blender or Flyrail execution changes
- No secret exposure to browser
