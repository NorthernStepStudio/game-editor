---
name: Multi-renderer shared global state
description: Why any second MotionCanvasRenderer instance must be gated by setActive(), or it double-drives global state.
---

# Multiple MotionCanvasRenderer instances

`MotionCanvasRenderer` starts a `requestAnimationFrame` loop in its **constructor**. That loop both:
- mutates **global** `PlaybackState.time` / `PlaybackState.playing` (via `advance()`), and
- writes shared DOM (`#zoom-badge`).

So a page that wants its own renderer (e.g. the Rigging page has its own canvas + renderer reading the same global `ProjectState`/`SelectionState`) MUST gate it.

**Rule:** exactly one renderer may be "active" at a time. Use `renderer.setActive(boolean)`; the loop skips `advance()`/`render()`/`updateZoomBadge()` when inactive. Boot keeps this invariant via an `applyPageActivation(page)` helper called from every navigation path (router, cutter back, rigging back).

**Why:** two live loops advanced `PlaybackState.time` twice per frame → timeline ran at ~2× when playing; the hidden renderer also overwrote the editor's `#zoom-badge`. Caught in code review.

**How to apply:** if you ever add a third page/renderer, give it `setActive(false)` right after construction and extend `applyPageActivation` so only the visible page's renderer is active.
