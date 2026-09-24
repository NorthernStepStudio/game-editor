# Yun character candidate: yun_player_base_v2

Art / animation refinement of Phase 3H `yun_player_base`.

## Lineage

`yun_player_base` (Phase 3H) → `yun_player_base_v2` (this revision) → production opt-in `games/yun/assets/matterhorn/yun_player_base.glb`

Phase 3H archive is preserved at `../yun_player_base/`.

## Revision

| Field | Value |
| --- | --- |
| Revision | 2.0.0 |
| Bones | 18 (same contract) |
| Animations | idle, walk, run |
| Team color | `MAT_TeamShirt` (primary) |
| Accent | `MAT_Accent` (collar / soles) |
| Geometry | ~6488 vertices / ~6532 polygons (Phase 3H: ~1042 / ~820) |
| GLB size | ~1.5 MB (Phase 3H: ~275 KB) |

Geometry growth is from overlapping joint fills, hair/eyes, collar, shoe soles, and bevels — still stylized low-poly, under the 8k soft cap.

## Production opt-in

- Asset: `res://assets/matterhorn/yun_player_base.glb`
- Selector: `YunMiniFigure.MODELS[12]` / `MODEL_YUN_PLAYER_BASE` / display name `Yun`
- Default remains Kenney (`character_id = 0`)
- Rollback: pick any Kenney (0–11); do not delete the Matterhorn asset

## Evidence

- Multi-view renders: `yun_player_base_v2-*.png`
- Visual sanity: `visual-sanity.json`
- Flyrail disposable + gameplay camera: `flyrail-yun-v2-validation.json`, `flyrail-gameplay/`
- Production playable: `production/`
