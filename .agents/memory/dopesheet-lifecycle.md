---
name: Dopesheet panel lifecycle
description: How DopesheetPanel survives DOM re-renders and tracks playback without re-creating.
---

# Dopesheet panel lifecycle

## Rule
`DopesheetPanel` is a module-level singleton in `ControllerTimelinePanel.ts`. It must NOT be recreated on each `renderControllerTimeline` call; instead reattach its `.wrapper` div to the new `.ds-mount` placeholder after `container.innerHTML` is set.

**Why:** `renderControllerTimeline` is called on nearly every `onUpdate()`. Recreating the canvas panel would reset selection state, restart the RAF loop (leaking the old one), and flicker the dopesheet. Detach + reattach keeps state intact.

**How to apply:**
```typescript
// In renderControllerTimeline, after container.innerHTML = '...':
const dsMount = container.querySelector('.ds-mount') as HTMLElement;
if (_dopesheet) {
  dsMount.appendChild(_dopesheet.wrapper); // reattach — wrapper survived detach
  _dopesheet.setAnim(anim);
} else {
  _dopesheet = new DopesheetPanel(dsMount, onUpdate);
  _dopesheet.setAnim(anim);
}
```

## RAF loop pattern
The dopesheet's internal RAF loop polls `PlaybackState.time` via `getPlaybackTimeForAnimation(anim)` and only redraws when time changes or `_needsDraw` is set. This means playback scrubbing works without any external notification — no hook into the renderer's RAF loop needed.

## Orphaned module
`keyframeDrag.ts` is now exported but not imported anywhere. The per-card kf-strip drag it handled was replaced by the dopesheet's own pointer handling. Leave it in place until a cleanup pass; removing it is safe and just reduces bundle size.

## Selection state location
- `SelectionState.selectedLaneCtrlId: string | null` — which controller lane is highlighted
- `SelectionState.selectedKfKeys: Set<string>` — selected keyframes as `"ctrlIdx:kfIdx"` strings (indices into the ALL-controllers array, not the filtered array)
