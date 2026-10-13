# Yun vehicle family — v04-materials / v05

Status: **v05 in game (0.2.8-beta); AWAITING OWNER REVIEW** (mounted because the owner asked to finish the asset
groups to v04/v05 and reviews them in the APK).

- `build_v04_materials.py` (run on `v03-details-r2.blend`, which is never overwritten) gives each vehicle its own
  paint: silver sedan, yellow taxi, dark-green SUV, white van, red delivery cab with white box, blue sport sedan,
  red sport hatch; plus glass, tyres, wheel metal, trim and emissive head/tail lamps.
- Exported one GLB per vehicle, re-centred as one piece (the cabin's window cut-outs are tied to the scene, so moving
  the root left the cabin behind).
- In the game they replace the Kenney cars at the same spots and scale (1.15); footprints match within ~10 %.
