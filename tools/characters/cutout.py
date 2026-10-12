"""Cut a character out of a design-sheet crop: flood-fill the backdrop from the borders, matching only colours
that are close to the backdrop itself (sampled along the borders), then square it on a transparent canvas.
Usage: python cutout.py <sheet.png> <x0> <y0> <x1> <y1> <out.png> [tolerance]
"""
import sys
from collections import deque

from PIL import Image, ImageFilter

sheet, x0, y0, x1, y1, out_path = sys.argv[1], *map(int, sys.argv[2:6]), sys.argv[6]
tol = int(sys.argv[7]) if len(sys.argv) > 7 else 38
img = Image.open(sheet).convert("RGB")
sx, sy = img.width / 1536, img.height / 1024
crop = img.crop((int(x0 * sx), int(y0 * sy), int(x1 * sx), int(y1 * sy)))
w, h = crop.size
px = crop.load()
border = [px[x, y] for x in range(0, w, 3) for y in (0, 1, h - 2, h - 1)] + [px[x, y] for y in range(0, h, 3) for x in (0, 1, w - 2, w - 1)]
palette = []
for c in border:  # a compact set of backdrop colours
    if all(sum(abs(a - b) for a, b in zip(c, p)) > 10 for p in palette):
        palette.append(c)


def backdrop(c):
    # the sheets' backdrop and floor are blue-grey; dark clothing is neutral or warm, so it is never backdrop
    if c[2] - c[0] < 6:
        return False
    return min(sum(abs(a - b) for a, b in zip(c, p)) for p in palette) < tol


seen = [[False] * w for _ in range(h)]
q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
while q:
    x, y = q.popleft()
    if seen[y][x] or not backdrop(px[x, y]):
        continue
    seen[y][x] = True
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx]:
            q.append((nx, ny))
alpha = Image.new("L", (w, h))
ap = alpha.load()
for y in range(h):
    for x in range(w):
        ap[x, y] = 0 if seen[y][x] else 255
alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(0.7))
cut = crop.convert("RGBA")
cut.putalpha(alpha)
cut = cut.crop(alpha.getbbox())
side = int(max(cut.size) * 1.1)
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(cut, ((side - cut.width) // 2, (side - cut.height) // 2), cut)
canvas.resize((1024, 1024), Image.LANCZOS).save(out_path)
print("cutout", out_path, len(palette), "backdrop colours")
