# Corrected Yun character-scale evaluation

This isolated test corrects the earlier scale review, which used the unpromoted Yun Urban model. The replacement test mounts **Tito**, roster index 0, through Yun's shipping `scripts/mini_figure.gd` code at its normal `1.2` runtime scale. The exact production asset is `assets/kenney/mini_characters/character-male-a.glb`.

The camera matches the current match camera: 46° FOV, 0.12 near plane, 120 far plane and a 1920×1080 viewport.

## Plain-language result

Both houses are visibly too large beside the current gameplay roster. Tito measures about 0.806 game units tall in the mounted pose, while the house doors are about 2.14–2.15 units tall. A door is therefore roughly 2.67 Tito-heights. The window heights, balcony rails, stair risers and floor spacing show the same mismatch.

No house, LOD, generator, gameplay file or earlier validation report was changed. The recommended next step is a separate visual trial using a uniform runtime scale around `0.60–0.65` for both houses. That should be approved before any map promotion; it is not applied here.

See `scale-assessment.md` for the feature-by-feature review and `current-character-scale-report.json` for the runtime evidence.
