# Yun building kit v1 — design brief

Replaces the 17 Kenney buildings still on Yun's maps with studio-original Dominican street architecture. Built by
`build_kit.py` (Blender, scripted, no third-party assets), one design at a time through the Visible Creation Mode
checkpoints v01–v05. The owner asked for the whole kit to be taken to v04/v05 in one go and reviewed at the end.

## What a Dominican barrio street looks like (reference notes)

- **Concrete-block houses (casas de block)** — the most common. Flat concrete roofs with a low parapet, often with
  **rebar sticking up** at the corners (varillas: the owner plans another floor later) and a black or blue plastic
  **water tank (tinaco)** on a small stand. Walls plastered and painted in strong pastels; a contrasting band or base.
- **Iron everywhere** — window grilles (rejas) and door gates in decorative or plain bars, railings on balconies and
  roof edges, roll-up steel shutters on shops.
- **Front galería** — a covered porch with square columns and a low wall or railing, where people sit in the evening.
- **Zinc roofs** — older one-storey houses with corrugated zinc sheets on a low shed or hip roof, wooden shutters.
- **Victorian "gingerbread" houses** — wooden houses with gable roofs, fretwork trim and long porches (Puerto Plata,
  Santo Domingo's older barrios, Samaná). Bright two-tone paint.
- **Two- and three-storey infill** — shop or garage below, family above; exterior side stairs; balconies on the
  street side; apartment blocks with stacked balconies.
- **Colmados** — the corner store: roll-up shutters, a serving window, crates and coolers outside, a painted sign band.
  Also barbershops (glass front, striped pole), small pharmacies (green cross), car-repair garages (wide open door).
- **Utilities** — electric meters on the wall, conduit, rain pipes, the odd AC unit, satellite dishes.
- **Community buildings** — a small white church with a bell gable or tower, a one-storey school in blue and white.

## Designs (15)

| # | id | what |
|---|---|---|
| 1 | casa-galeria | one storey, front porch with columns, flat roof, rebar, water tank |
| 2 | casa-zinc | one storey, corrugated zinc shed roof, wooden shutters |
| 3 | casa-balcon | two storeys, full-width front balcony with iron railing |
| 4 | casa-escalera | two storeys, exterior side stair to the upper floor |
| 5 | casa-victoriana | wooden gingerbread house, gable roof, fretwork, long porch |
| 6 | casa-esquina | corner house with a small shop window on one side |
| 7 | colmado | corner store: roll-up shutter, serving window, crates, sign band |
| 8 | barberia | barbershop: glass front, striped pole, sign band |
| 9 | taller | car-repair garage: wide open door, tyre stack |
| 10 | farmacia | small pharmacy: glass door, green cross sign |
| 11 | tienda-2p | shop below, apartment with balcony above |
| 12 | apartamentos | three-storey block with stacked balconies |
| 13 | iglesia | small white church with a bell tower |
| 14 | escuela | one-storey school, long, blue and white, covered walkway |
| 15 | fondo | low-detail background block (houses/shops) for the far edges |

## Map colourways (v04)

Each design has four colourways, one per map:

- **Calle** — warm barrio pastels: mango, coral, pink, lime, cream, sky.
- **Malecón** — sea-washed: white, aqua, seafoam, sand, pale blue.
- **Parque** — leafy and earthy: sage, ochre, terracotta, olive, cream.
- **Noche** — the Calle colours with warm lit windows and a lit sign (the game darkens the map at night).

## Rules kept from the existing kit

- Authored in metres, then scaled by the locked Yun building scale **0.55**; roots at scale 1, ground at z = 0.
- Front faces −Y. Simple `-colonly` box collision.
- Few materials per building; nothing is mounted in a shipping map without owner approval.
