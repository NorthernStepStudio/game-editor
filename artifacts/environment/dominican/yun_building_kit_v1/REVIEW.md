# Yun building kit v1 — checkpoint review

**State: v05-final — AWAITING OWNER REVIEW.** Nothing is mounted in the shipping maps; the Kenney buildings stay
until the owner approves.

15 original designs (see DESIGN-BRIEF.md), built by `build_kit.py`, taken through every checkpoint in one pass at the
owner's request ("finish everything to v04/5"):

| Checkpoint | Where | What it shows |
|---|---|---|
| v01-blockout | `out/<design>/v01-blockout/` | massing, height, footprint (clay) |
| v02-structure | `out/<design>/v02-structure/` | doors, windows, roofs, porches, balconies, stairs (clay) |
| v03-details | `out/<design>/v03-details/` | grilles, rebar, water tanks, utilities, signs, shop props (clay) |
| v04-materials | `out/<design>/v04-materials-<map>/` + `out/board-v04-*.png` | colourways for Calle, Malecón, Parque, Noche (lit windows and signs at night) |
| v05-final | `out/v05-final/` | in the game, gameplay camera, every Kenney building on each map swapped for a kit building (review harness: `games/Yun/tests/_matterhorn_building_kit_review/review_kit.gd`) |

Each checkpoint folder has the editable `.blend`, the renders and `info.json` (triangles, materials, size).
Budget: 236–6,484 triangles per building (most 1,000–3,200); 60 game files total 6.5 MB.

Rebuild everything (about 2 minutes): `bash run_all.sh`.

## Known limits for the owner to judge

- Buildings are seen mostly from above at the gameplay camera: roofs, tanks and rebar carry the read; facades show
  on the near side.
- Shapes are clean and blocky (same family as the existing colmado and houses 01/02), not sculpted.
- Placement in the review reuses the Kenney spots with fronts lined up to the street; a final layout pass per map
  comes with mounting.
