"""Cut each pose cleanly out of the Yun Urban Adventurer turnaround sheet.

The equal-width crops in views/ include slices of neighbouring poses, and the poses touch
(hair, floor shadows), so this separates them by connected regions instead, keeps only each
pose's own pixels, and pads it onto a square neutral background — the input image-to-3D expects.

Output: views_isolated/<view>.png (1024x1024), in sheet order:
front, left, right, back, three_quarter, a_pose.
"""
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
OUT = HERE / "views_isolated"
OUT.mkdir(exist_ok=True)

VIEWS = ["front", "left", "right", "back", "three_quarter", "a_pose"]
SHEET = HERE / "sheet_clean.jpg"
BAND = (0, 486)  # figure band, above the text labels
BG_TOLERANCE = 30
LABEL_X = [96, 268, 393, 547, 720, 902]  # centre of each label under the poses
MIN_REGION = 40  # ignore specks
BG = (205, 205, 207)  # neutral backdrop for the padded views
SIZE = 1024


def main() -> None:
    sheet = Image.open(SHEET).convert("RGB")
    band = sheet.crop((0, BAND[0], sheet.width, BAND[1]))
    w, h = band.size
    px = band.load()

    # The background is a soft vertical gradient: compare each pixel with its row's edge colour.
    def is_bg(x: int, y: int) -> bool:
        ref = px[2, y]
        return all(abs(c - b) <= BG_TOLERANCE for c, b in zip(px[x, y], ref))

    figure = [[not is_bg(x, y) for x in range(w)] for y in range(h)]

    # Connected regions of figure pixels (poses touch, so gaps alone cannot separate them).
    label = [[0] * w for _ in range(h)]
    regions = []
    for sy in range(h):
        for sx in range(w):
            if not figure[sy][sx] or label[sy][sx]:
                continue
            regions.append([])
            ident = len(regions)
            label[sy][sx] = ident
            stack = [(sx, sy)]
            while stack:
                x, y = stack.pop()
                regions[-1].append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and figure[ny][nx] and not label[ny][nx]:
                        label[ny][nx] = ident
                        stack.append((nx, ny))

    # Each region goes to the pose whose label sits nearest; a region spanning two
    # labels (touching hair) is split halfway between them.
    owned = {view: [] for view in VIEWS}
    splits = [(a + b) / 2 for a, b in zip(LABEL_X, LABEL_X[1:])]
    nearest = lambda x: min(range(len(VIEWS)), key=lambda i: abs(LABEL_X[i] - x))
    for pixels in regions:
        if len(pixels) < MIN_REGION:
            continue
        xs = [x for x, _ in pixels]
        inside = [i for i, cx in enumerate(LABEL_X) if min(xs) <= cx <= max(xs)]
        if len(inside) >= 2:
            for x, y in pixels:
                owned[VIEWS[sum(x > s for s in splits)]].append((x, y))
        else:
            owned[VIEWS[nearest(sum(xs) / len(xs))]].extend(pixels)

    for view in VIEWS:
        pixels = owned[view]
        x0, x1 = min(x for x, _ in pixels), max(x for x, _ in pixels)
        y0, y1 = min(y for _, y in pixels), max(y for _, y in pixels)
        cut = Image.new("RGB", (x1 - x0 + 13, y1 - y0 + 13), BG)
        cpx = cut.load()
        for x, y in pixels:
            cpx[x - x0 + 6, y - y0 + 6] = px[x, y]
        scale = (SIZE * 0.86) / max(cut.width, cut.height)
        cut = cut.resize((round(cut.width * scale), round(cut.height * scale)), Image.LANCZOS)
        canvas = Image.new("RGB", (SIZE, SIZE), BG)
        canvas.paste(cut, ((SIZE - cut.width) // 2, (SIZE - cut.height) // 2))
        canvas.save(OUT / f"{view}.png")
        print(f"{view}: x {x0}-{x1}, y {y0}-{y1}, {len(pixels)} px")


if __name__ == "__main__":
    main()
