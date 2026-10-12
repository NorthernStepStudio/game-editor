"""Roster overview: every character's front render (top) above the front view from its design sheet (bottom).
Usage: python roster_overview.py <out.png> [view]   (view: front | three_quarter | back; default front)
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ROSTER = ["01-yun", "02-riko", "03-kai", "04-luna", "05-ace", "06-neo", "07-mika", "08-zen", "09-jet", "10-nami", "11-rae", "12-sol"]
out = sys.argv[1]
view = sys.argv[2] if len(sys.argv) > 2 else "front"
# where each view sits in a sheet's top row (x range in a 1536-wide sheet)
SHEET_X = {"front": (20, 330), "three_quarter": (20, 330), "back": (560, 850)}
TILE = 230
cols = []
for entry in ROSTER:
    nn, cid = entry.split("-")
    if cid == "yun":
        render = ROOT / "artifacts/yun-character-candidate/yun_urban_adventurer/checkpoints/chibi-v10" / f"render_{view}.png"
        sheet = ROOT / "docs/yun/roster/12-sol.png"  # Yun appears in every sheet's in-game panel
        crop = (1290, 740, 1510, 960)
    else:
        render = ROOT / "artifacts/yun-character-candidate/roster" / cid / f"render_{view}.png"
        sheet = ROOT / "docs/yun/roster" / f"{entry}.png"
        x0, x1 = SHEET_X[view]
        crop = (x0, 95, x1, 490)
    top = Image.new("RGB", (TILE, TILE), (44, 48, 58))
    if render.exists():
        im = Image.open(render).convert("RGBA").resize((TILE, TILE))
        top.paste(im, (0, 0), im)
    s = Image.open(sheet).convert("RGB")
    sx, sy = s.width / 1536, s.height / 1024
    ref = s.crop((int(crop[0] * sx), int(crop[1] * sy), int(crop[2] * sx), int(crop[3] * sy)))
    ref.thumbnail((TILE, TILE))
    bottom = Image.new("RGB", (TILE, TILE), (30, 33, 40))
    bottom.paste(ref, ((TILE - ref.width) // 2, (TILE - ref.height) // 2))
    cols.append((cid.capitalize(), top, bottom))
board = Image.new("RGB", (TILE * 6 + 50, (TILE * 2 + 30) * 2 + 10), (24, 26, 32))
d = ImageDraw.Draw(board)
for i, (name, top, bottom) in enumerate(cols):
    x = (i % 6) * (TILE + 10)
    y = (i // 6) * (TILE * 2 + 40)
    board.paste(top, (x, y))
    board.paste(bottom, (x, y + TILE))
    d.text((x + 6, y + 2 * TILE + 6), name, fill=(235, 220, 190))
board.save(out)
print("overview", board.size)
