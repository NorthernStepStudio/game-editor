"""Review boards: one tile per design (hero render) for a stage/colourway, with the design name under it."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
OUT = Path(__file__).parent / "out"
DESIGNS = ["casa-galeria", "casa-zinc", "casa-balcon", "casa-escalera", "casa-victoriana", "casa-esquina", "colmado", "barberia",
           "taller", "farmacia", "tienda-2p", "apartamentos", "iglesia", "escuela", "fondo"]
folder, dest, view = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else "hero")
T = 380
b = Image.new("RGB", (T * 5, (T + 30) * 3), (24, 26, 32))
d = ImageDraw.Draw(b)
for i, name in enumerate(DESIGNS):
    p = next((q for q in (OUT / name / folder / f"{view}.png", OUT / name / folder / f"{view}.jpg") if q.exists()), OUT / "missing")
    x, y = (i % 5) * T, (i // 5) * (T + 30)
    if p.exists():
        b.paste(Image.open(p).convert("RGB").resize((T, T)), (x, y))
    d.text((x + 8, y + T + 8), name, fill=(235, 220, 190))
b.save(dest)
