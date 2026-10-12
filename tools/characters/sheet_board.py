"""Side-by-side board: a character's four renders above the top row of its design sheet.
Usage: python sheet_board.py <render_dir> <sheet.png> <out.png>
"""
import sys

from PIL import Image

render_dir, sheet_path, out = sys.argv[1:4]
tiles = []
for view in ("front", "three_quarter", "side", "back"):
    im = Image.open(f"{render_dir}/render_{view}.png").convert("RGBA")
    bg = Image.new("RGB", im.size, (44, 48, 58))
    bg.paste(im, (0, 0), im)
    tiles.append(bg.resize((340, 340)))
sheet = Image.open(sheet_path).convert("RGB")
sx, sy = sheet.width / 1536, sheet.height / 1024
ref = sheet.crop((int(20 * sx), int(95 * sy), int(1080 * sx), int(490 * sy)))
ref = ref.resize((int(ref.width * 340 / ref.height), 340))
board = Image.new("RGB", (max(4 * 350, ref.width), 695), (30, 33, 40))
for i, tile in enumerate(tiles):
    board.paste(tile, (i * 350, 0))
board.paste(ref, (0, 355))
board.save(out)
print("board", board.size)
