# Yun house-scale lock evaluation

This isolated Godot test compares the unchanged House 01 and House 02 GLBs at runtime scales `0.55`, `0.60` and `0.65` against Yun's current shipping roster.

## Result

**The selected shared house scale is 0.55.**

At 0.55, the houses retain their intended silhouette and readable gameplay details while doors, window placement, balcony guards, stairs, floor height and the garage fit the current characters. Scale 0.60 is still usable but begins to restore the oversized floor and railing feel; 0.65 is visibly too large.

The final check uses:

- Paco — shortest measured current roster character, about 0.794 game units tall.
- Tito — primary reference, about 0.806 game units tall.
- Neno — tallest measured current roster character, about 0.951 game units tall.

All three are mounted through Yun's shipping `scripts/mini_figure.gd` path at the unchanged gameplay scale of `1.2`.

No house GLB, LOD, generator, gameplay file or character scale was changed. The value is documented for a later native-size generator conversion; the houses remain unpromoted candidates.

See `YUN-ENVIRONMENT-BUILDING-SCALE-STANDARD.md` for the future production rule and `visual-assessment.md` for the feature-by-feature decision.
