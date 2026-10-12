# House scale assessment against current Tito

## Corrected reference

- Character: Tito, current roster index 0.
- Runtime loader: `games/Yun/scripts/mini_figure.gd`.
- Asset: `games/Yun/assets/kenney/mini_characters/character-male-a.glb`.
- Gameplay mount scale: 1.2.
- Mounted visual height: approximately 0.806 game units.
- Match-camera settings: 46° FOV, 0.12 near, 120 far, 1920×1080.

## Visual findings

- **House 01 scale — Fail:** the 2.14-unit front door is about 2.66 Tito-heights. The whole two-story facade reads like architecture made for a much taller character.
- **House 02 scale — Fail:** the 2.15-unit pedestrian door is about 2.67 Tito-heights, and the 2.30-unit garage opening is about 2.86 Tito-heights.
- **Doors — Fail:** both pedestrian doors are conspicuously oversized next to the shipping character.
- **Windows — Fail:** ground-floor sills sit above Tito's head and the openings read much larger than the gameplay character requires.
- **Balconies — Fail:** the approximately 0.86–0.93-unit balcony guards are at or above Tito's full mounted height.
- **Exterior stair — Fail:** House 01's 0.26-unit risers are about 32% of Tito's height per step, which looks too steep and large for the current character.
- **Floor-to-floor height — Fail:** roughly 3.1 game units is about 3.8 Tito-heights, making both floors read oversized.
- **Sidewalk/ground relationship — Pass:** Tito and both foundations contact the intended surfaces without floating or sinking.
- **Rooftop proportions — Pass within each house:** parapets and tanks remain coherent parts of the buildings, but the complete buildings are oversized relative to Tito.
- **Gameplay camera — Pass as evidence:** the 46° camera makes the mismatch clear and keeps the relevant architectural features readable.

## Recommendation

Do not rebuild either house. Test a shared runtime transform around `0.60–0.65` first; `0.60` would reduce a 2.15-unit door to 1.29 units, or about 1.60 Tito-heights. This is a minor implementation change but a visually significant correction, so it needs a new comparison and approval before promotion.
