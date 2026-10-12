# Street Yun — Mini Character Standard (v1)

The rules every playable Street Yun character follows, so all 12 look like they belong in the same game
without becoming copies of each other. The baseline is **Yun Urban Adventurer mini v02**
(`artifacts/yun-character-candidate/yun_urban_adventurer/checkpoints/mini-v02`), measured against the
game's Kenney mini characters (Nati). The machine-readable version is
[`mini-character-standard.json`](mini-character-standard.json); In Matterhorn, pick the **Street Yun mini character** style when making a character so these rules go to the builder, and use **Rig for the game** to rig it.

## 1. What stays the same for everyone (the family look)

### Size (model units; the game shows characters at ×1.2)

| | Model | In game |
|---|---|---|
| Total height (feet on the ground to top of hair) | **0.672 m** (±0.01) | 0.81 m |
| Arm span (T-pose) | 0.77 m (0.74–0.80) | 0.92 m |
| Facing | −Y, centred on X, feet at z = 0 | |

### Proportions (the chibi mini shape)

| Part | Size | Position |
|---|---|---|
| Head (rounded box) | ~0.44 wide × 0.33 deep × 0.30 tall | bottom at z ≈ 0.345 |
| Head + hair silhouette | ≤ 0.58 wide × 0.38 deep (ponytails and hats may trail behind) | top at 0.672 |
| Torso | ~0.26 wide × 0.18 deep | z 0.17 → 0.36 |
| Arms | thick, stubby, 0.08–0.09 thick, straight out in a **T-pose** | shoulder joint z ≈ 0.305, x ≈ ±0.13 |
| Hands | chunky mitten blocks, ~0.09 | ends of the arms |
| Legs | short and thick | z 0.04 → 0.17, hip joint z ≈ 0.176, x ≈ ±0.065 |
| Shoes | big and chunky, slightly wider than the legs, thick soles | z 0 → ~0.10 |

The head is about **half** the character's height. That is the Kenney mini look; do not make heads smaller
or bodies taller.

### Face (identical construction for everyone)

- Two dark vertical oval eyes with a small white highlight, eye centres at z ≈ 0.485, x ≈ ±0.085.
- Short eyebrows at z ≈ 0.54, a small smile line at z ≈ 0.42, soft blush ovals at z ≈ 0.44, x ≈ ±0.145.
- Small ears on the sides of the head box.

Expression can change (smirk, grin, determined brows), but the eye shape, size and placement do not.

### Construction

- Soft **beveled boxes** (bevel modifier, 2–3 segments) and rounded blobs, smooth shading.
- **Flat solid colours** only: no textures, no gradients, no fine detail smaller than ~1 cm.
- 15–30 clearly named parts, every part overlapping what it attaches to (one connected whole).
- ≤ 20,000 triangles.

### Materials (Principled BSDF)

| Use | Roughness | Metallic |
|---|---|---|
| Cloth, skin, shoes | 0.55–0.80 | 0 |
| Hair | 0.80 | 0 |
| Eyes | 0.30 | 0 |
| Metal accessories (gold, silver) | 0.30 | 1 |

Shared neutrals every character may use: black `#0F0F12`, charcoal `#29292B`, cream `#F2E8D1`,
sneaker white `#F5F5F2`, sole `#DBD9D1`, light grey `#C7C7BF`, blush `#CC7561`, mouth `#591F19`,
gold `#FFC24C`.

### Skeleton and animations

Every character uses the game's **Kenney mini skeleton** (7 bones: root, torso, head, arm-left,
arm-right, leg-left, leg-right) and its 32 shared animations (idle, walk, sprint, jump, attacks, emotes…).
Matterhorn's **Rig for the game** button does this; only the joint positions move to fit the character.

For automatic rigging, parts are named by where they belong:

| Name contains | Moves with |
|---|---|
| Head, Hair, Eye, Brow, Mouth, Cheek, Ear, Hat, Cap, Glasses, Scrunchie… | head |
| Arm / Hand / Glove / Sleeve / Cuff + `_L` or `_R` | that arm |
| Leg / Shoe / Sneaker / Boot / Sock + `_L` or `_R` | that leg |
| anything else (jacket, bag, belt…) | torso |
| shorts, skirts, trousers (cross the middle below the hips) | split: top on the torso, lower part on each leg |

If a joint lands in the wrong place, use **Place joints myself** and drag it.

## 2. What must be different (so nobody is a copy)

Every character is unique on **all five** of these. Check them against the roster before building.

1. **Hair silhouette** — a different shape class (curly volume + high ponytail, braids, buzz cut, afro puff,
   space buns, bob, cornrows, cap over hair, bandana, mohawk, long straight, twists…).
2. **Signature accent colour** — one bold colour nobody else has as their accent.
3. **Outfit archetype** — bomber jacket, hoodie, baseball jersey, tank top + overalls, guayabera,
   tracksuit, school uniform, vest + tee, dress, windbreaker…
4. **Hero accessory** — one readable item: headphones, cap, glasses, goggles, beanie, hair clip, cat-ear
   headset, earrings… (the **crossbody strap/bag is shared by the whole family** and does not count).
5. **Shoes** — high-tops, slides, boots, runners, sandals, skate shoes… (always chunky).

Allowed body variation stays small so silhouettes still match: head width ±0.02 m, torso width ±0.02 m,
height fixed. Skin tones vary across the roster (the game is set in a Dominican street; show that range).

## 3. Roster (owner's concept design v1)

Reference sheet: [`roster-concept-v1.png`](roster-concept-v1.png). Better views of each character are coming
from the owner; build each one from its own views when they arrive.

| # | Name | Hair | Accent | Outfit | Hero accessory | Shoes | Skin | Status |
|---|---|---|---|---|---|---|---|---|
| 01 | **Yun** | dark curly volume + high ponytail, orange scrunchie | orange | cropped cream/orange bomber, black crop top, olive cargo shorts, leggings | gold hoop earrings | white/orange high-tops | warm brown | **approved look**; rigged (`checkpoints/mini-v02-rigged`) |
| 02 | **Riko** | long brown hair, high ponytail with pink scrunchie, bangs | pink / rose | pink-and-black bomber with a star, black shorts | pink scrunchie | pink/white sneakers | light | concept |
| 03 | **Kai** | spiky black hair | royal blue | blue jacket with white collar, black shorts | headphones around the neck | blue/white sneakers | light | concept |
| 04 | **Luna** | long purple hair, twin space buns, star clip | purple / lavender | lavender jacket with white sleeves, grey shorts | star hair clip | purple sneakers | light | concept |
| 05 | **Ace** | short dark hair under a backwards cap | red | red-and-white varsity jacket, black shorts | backwards red cap | red/white sneakers | dark brown | concept |
| 06 | **Neo** | fluffy blond hair | green | green-and-white varsity jacket, black shorts | round glasses | green/black sneakers | light | concept |
| 07 | **Mika** | black hair, two buns with yellow ties, bangs | yellow | yellow jacket, brown shorts | yellow bun ties | yellow/white sneakers | light | concept |
| 08 | **Zen** | long dark hair under a beanie | sky blue | denim-blue jacket, dark shorts | light-blue beanie | blue/black sneakers | dark brown | concept |
| 09 | **Jet** | spiky orange hair | orange / black | orange-and-black jacket, black shorts | aviator goggles on the head | black/orange sneakers | light | concept |
| 10 | **Nami** | long teal hair with a star clip | teal / mint | black jacket over a teal top, yellow hip bag | star clip, yellow hip bag | green/white sneakers | light | concept |
| 11 | **Rae** | brown hair with a pink streak | hot pink | pink-and-black jacket, black shorts | pink cat-ear headphones | pink/white sneakers | medium | concept |
| 12 | **Sol** | spiky white/silver hair | cobalt blue | blue jacket with white collar, black shorts | — (hair is the signature) | blue/white sneakers | dark brown | concept |

**Accent clashes to settle (owner's call):** Yun and Jet are both orange; Riko and Rae are both pink; Kai and
Sol are both strong blue (Zen is a lighter blue). Suggested split if wanted: Jet → burnt orange/amber with
black, Yun keeps bright orange; Rae → magenta/hot pink, Riko keeps rose pink; Sol → cobalt with white,
Kai keeps royal blue, Zen keeps sky blue. Each pair also differs in hair, outfit and accessory, so they will
still read apart in game.

## 4. Checks before a character is accepted

- Height 0.672 ± 0.01, arm span 0.74–0.80, feet at z = 0, facing −Y (every Matterhorn build report records the size; compare it with these numbers).
- Line-up render beside Nati and the other finished characters at in-game size.
- Front, side, 3/4 and back views; no floating parts; ≤ 20k triangles.
- Rigged with **Rig for the game**; idle, walk, sprint and jump previews play without parts tearing off.
- The five differences in section 2 checked against every existing roster member.
- Owner approval at each checkpoint (Visible Creation Mode).
