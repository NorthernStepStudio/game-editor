---
name: Animation phase units
description: The phase param in evaluateController is in cycle fractions (0.0–1.0), NOT radians. Using Math.PI causes a ~52° offset instead of 180°.
---

# Phase Parameter is in Cycle Fractions, Not Radians

## The Rule
`evaluateController` computes `t = time * speed + phase`, then `sin(t * TAU)`.
This means **phase is in cycle fractions**: `0.5 = 180° = half cycle`, `1.0 = 360°`.

## Why
`sin((time*speed + phase) * TAU)` — phase scales by TAU internally.
Using `phase: Math.PI ≈ 3.14` gives `sin(t*TAU + 3.14*TAU) = sin(t*TAU + 19.7rad)`.
`19.7 mod 2π ≈ 0.89 rad ≈ 52°` — completely wrong for alternating limbs.

## How to Apply
- Alternating legs/arms (180° apart): **`phase: 0.5`** for the trailing limb, **`phase: 0`** for the lead.
- Quarter-cycle offset: `phase: 0.25`
- Never use `Math.PI`, `3.14`, or radian values as phase.

## What Was Fixed
- Walk/Run templates: `phase: isRight ? Math.PI : 0` → `phase: isRight ? 0.5 : 0`
- All sample rigs (heroes, enemies, creatures): `phase: 3.14` → `phase: 0.5` for the trailing leg/arm
- Also switched walk arm detection from `isLeft` to `isRight` to match leg logic; armSwing uses -sin so phase 0 = natural counter-swing.
