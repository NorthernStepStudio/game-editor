"""Crop the Yun Urban Adventurer turnaround sheets into per-view reference images.

Inputs: sheet_clean.jpg (gray background turnaround), sheet_dark.jpg (dark turnaround).
Outputs: views/<sheet>_<view>.png, upscaled 4x (Lanczos) for image-to-3D / Blender ref planes.
"""
from pathlib import Path
from PIL import Image

HERE = Path(__file__).parent
OUT = HERE / "views"
OUT.mkdir(exist_ok=True)

VIEWS = ["front", "left", "right", "back", "three_quarter", "a_pose"]
# Six equal columns across the top band of each 1024x768 sheet.
SHEETS = {
    "sheet_clean.jpg": (0, 490),   # y range of the figure band (above labels)
    "sheet_dark.jpg": (0, 445),
}

for name, (y0, y1) in SHEETS.items():
    img = Image.open(HERE / name).convert("RGB")
    w = img.width
    col = w / 6
    for i, view in enumerate(VIEWS):
        box = (int(i * col), y0, int((i + 1) * col), y1)
        crop = img.crop(box)
        crop = crop.resize((crop.width * 4, crop.height * 4), Image.LANCZOS)
        crop.save(OUT / f"{Path(name).stem}_{view}.png")
    print(name, img.size, "->", len(VIEWS), "views")
