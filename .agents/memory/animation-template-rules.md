---
name: Animation Template Rules
description: Critical rules for NStep Code Motion animation templates — displacement, formula wrapping, and start-pose bugs.
---

## Rule 1: Displacement only on root bones
Applying `x` or `y` controllers to parent AND child bones causes **double-displacement** — the child
is already carried by its parent through the hierarchy, so any additional y/x controller stacks on top.

**Fix pattern:** Always filter to root-only for positional controllers:
```ts
const roots = bodies.filter((p: any) => !p.parentId);
roots.forEach(p => addControllerSafe(..., 'y', 'jumpArc', ...));
```
Rotation and scale are safe to apply to any bone (relative to pivot, doesn't cascade displacement).

## Rule 2: tWrapped wraps at t = 1/speed — one-shot animations glitch
`tWrapped = (time * speed) % 1`. For one-shot animations (loop=false), if `duration * speed ≥ 1`,
tWrapped resets to 0 before the animation ends. Clamped formulas (deathSlump, deathDrop, deathFade)
snap back to their t=0 values at that moment — visible glitch.

**Fix:** Use `speed < 1/duration`. For death (duration=2.5s): `speed = 0.38` (< 0.4). tWrapped
reaches max 0.95 at end — no wrap, formulas plateau at final value.

## Rule 3: springDecay starts at amplitude at t=0 — causes weird start pose
`hitRebound = springDecay(n,2,5)*amplitude = exp(-n*5)*cos(n*TAU*2)*amplitude`.
At n=0: `1*1*amplitude = amplitude`. Arms/limbs are already at max rotation at frame 0.

**Fix:** Use `hitStagger` instead for hit arms — `sin(t*TAU*5)*amplitude*exp(-t*4)`, which is 0 at t=0.

## Rule 4: hitFlash old behavior — invisible at t=0
Old hitFlash returned `offset=0` for n<0.05, making character invisible at animation start.
New hitFlash: starts at 1 (visible), dips twice after impact, settles at 1.
`dim = max(0, 1-amplitude)` — amplitude controls depth of each dip.

## Rule 5: legCycle vs walkCycle
`walkCycle = sin(t*TAU)` — pure sine, mechanical-looking.
`legCycle = sin(t*TAU) - 0.15*sin(t*TAU*2)` — secondary harmonic creates natural knee-pause at apex.
Use `legCycle` for all walk/locomotion; `walkCycle` only for simpler non-leg parts.

## Rule 6: Templates never replaced — the "still the same" bug
`addControllerSafe` checked for existing controllers and prompted "Add another?" per duplicate.
Re-clicking a template on an animation that already had controllers showed N dialogs and added nothing.
**Fix:** `applyTemplate` now does `targetAnim.controllers = []` before adding anything.
Templates are starting points — wipe and replace is the correct behavior.

## Rule 7: Sample rig JSON has hardcoded stale animation data
Sample rigs (heroes.ts, enemies.ts) bake animation controller data inline.
Formula/param improvements to `applyTemplate` do NOT backfill sample data.
Must update sample JSON alongside template changes, or the samples keep showing old behavior.

## Rule 8: Image-bone pivot — auto-center on assign
When an image is assigned to a part, `part.origin` must be set to
`{x: asset.width/2, y: asset.height/2}` or the bone pivot lands ~20px from the
image top-left (old default), making all animation pivots wrong.
Fixed in `InspectorPanel.ts` assetSel.onchange AND `assetActions.ts` attachAssetToPart.
"⊕ Fit Asset" button also does this + resets scale to 1×.

## Rule 9: Canvas drag pick — prefer selected part over topmost
When all bones pile up at position (0,0), topmost z-index bone always wins pick.
Fix: in mousedown, check if the already-selected part is also under cursor first —
if yes, drag it instead of the topmost. Users select via hierarchy list, then drag canvas.
Location: MotionCanvasRenderer.ts setupInteraction mousedown.

## Rule 10: Shift+drag = move bone only, children stay in world space
Normal drag moves bone + all children (hierarchy-correct).
Shift+drag snapshots world matrices at drag start, then on each mousemove calls
preserveDescendantWorldTransforms so child world positions stay fixed.
Cursor changes to crosshair while Shift+drag mode is active.
