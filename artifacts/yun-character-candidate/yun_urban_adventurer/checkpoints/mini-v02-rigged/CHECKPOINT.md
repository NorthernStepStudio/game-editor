# Yun Urban Adventurer — mini v02, rigged

**Status: AWAITING OWNER REVIEW** (look and animation)

Rigged in Matterhorn with **Rig for the game** (automatic joints), from `../mini-v02`.

| | |
|---|---|
| Skeleton | Kenney mini, 7 bones: root, torso, head, arm-left, arm-right, leg-left, leg-right |
| Animations | all 32 shared clips (idle, walk, sprint, jump, attacks, emotes, …) |
| Joints (x, z in metres) | neck (0, 0.345) · shoulders (±0.13, 0.305) · hips (±0.065, 0.176) |
| Pieces | 25, each on one bone; the shorts are split between torso and legs |
| In-game height | 0.81 m (same as Nati) |

Checked: the GLB holds one skin with the same 7 joint names as Nati and all 32 animations; idle keeps the feet
on the ground; walk, sprint and jump play with no pieces tearing off (`rigged-animation-sheet.png`,
rows: idle, walk, sprint, jump).

## Files

- `yun_urban_mini_v02_rigged.glb` — the game-ready rigged character with every animation
- `yun_urban_mini_v02_rigged.blend` — editable Blender file
- `yun_urban_mini_v02_rigged-rig-report.json` — joints, bone of every piece, clip list
- `anim_<clip>_NN.png` — preview frames; `rigged-animation-sheet.png` — overview

Next (after approval): add her to the game as a selectable character at the same ×1.2 scale and test her in a match.
