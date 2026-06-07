---
name: Locomotion template orientation
description: Why walk/run templates come in side-view and front-view variants, and how each animates legs
---

Walk/Run animation templates exist in two orientations because a single leg-motion style cannot serve both camera angles.

- **Side-view (`walk`, `run`)**: legs animate via `rotation` (swing forward/back around the hip). Correct for a character drawn in profile.
- **Front-view (`walkFront`, `runFront`)**: legs animate via `y` translation (march up/down) plus a subtle `scaleX` pulse for depth. Rotation looks wrong head-on (legs splay sideways like doing splits).

**Why:** a user reported front-facing characters had "weird" leg movement — rotation on a front-facing rig swings legs left/right instead of stepping. Y-translation reads as marching from the front.

**How to apply:** when adding or tweaking locomotion templates, keep both orientations in sync (same arm/body secondary motion, same speed/duration), and only differ in the leg channel (rotation vs y+scaleX). Arms can stay rotation-based in both.
