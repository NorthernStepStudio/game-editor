"""Measures the body silhouette (front view) of design sheets and of our renders, relative to the body height
(arm line to soles): neck width, chest/waist width, arm thickness and length, head bottom.
Usage: python measure_body.py [our_front_ortho.png ...]
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def rows_of(img, fg):
    w, h = img.size
    rows = {}
    for y in range(h):
        runs, start = [], None
        for x in range(w):
            if fg(x, y):
                if start is None:
                    start = x
            elif start is not None:
                runs.append((start, x - 1)); start = None
        if start is not None:
            runs.append((start, w - 1))
        if runs:
            rows[y] = runs
    return rows


def analyse(name, img, fg):
    rows = rows_of(img, fg)
    span = {y: r[-1][1] - r[0][0] for y, r in rows.items()}
    top, bottom = min(rows), max(rows)
    arm = max(range(top + (bottom - top) // 3, bottom - (bottom - top) // 4), key=lambda y: span[y])
    b = bottom - arm
    arm_rows = [y for y in rows if span[y] > 0.8 * span[arm]]
    arm_top, arm_bot = min(arm_rows), max(arm_rows)
    cx = (rows[arm][0][0] + rows[arm][-1][1]) / 2

    def centre_run(y):
        # width of the run that contains the centre line (torso/neck, not the arms)
        for a, c in rows.get(y, []):
            if a <= cx <= c:
                return c - a
        return 0

    # neck: the narrowest centre run between the arm band top and the head (scanning up)
    head_zone = range(arm_top - 1, top + (arm_top - top) // 3, -1)
    neck_y = min(head_zone, key=lambda y: centre_run(y) or 10 ** 6)
    jaw = max(centre_run(y) for y in range(neck_y - (arm_top - top) // 3, neck_y))
    chest = centre_run(arm_bot + max(2, b // 12))
    waist = centre_run(arm_bot + b // 3)
    print(f"{name:12s} neck {centre_run(neck_y) / b:.2f} (jaw {jaw / b:.2f}, neck at {(bottom - neck_y) / b:.2f})"
          f"  chest {chest / b:.2f}  waist {waist / b:.2f}  arm thick {(arm_bot - arm_top) / b:.2f}"
          f"  span {span[arm] / b:.2f}  shoulders->hand {(span[arm] - chest) / 2 / b:.2f}")


for entry in ["02-riko", "03-kai", "04-luna", "05-ace", "06-neo", "07-mika", "08-zen", "09-jet", "10-nami", "11-rae", "12-sol"]:
    s = Image.open(ROOT / "docs/yun/roster" / f"{entry}.png").convert("RGB")
    sx, sy = s.width / 1536, s.height / 1024
    c = s.crop((int(20 * sx), int(100 * sy), int(330 * sx), int(455 * sy)))
    px = c.load()
    bg = px[3, 3]
    analyse(entry, c, lambda x, y: sum(abs(p - q) for p, q in zip(px[x, y], bg)) > 55)
for path in sys.argv[1:]:
    im = Image.open(path).convert("RGBA")
    al = im.getchannel("A").load()
    analyse(Path(path).parent.name[:12], im, lambda x, y: al[x, y] > 40)
