#!/usr/bin/env python3
"""Contact sheet of all cutouts on a gray background (so any wrongly-cut areas are visible).
Tiles are numbered; the console prints index -> filename. Usage: python montage.py <cutout_dir>
"""
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw

d = Path(sys.argv[1]).resolve()
files = sorted(d.glob("*.png"))
cols, cell, lab, pad = 4, 360, 18, 10
rows = math.ceil(len(files) / cols)
W = pad + cols * (cell + pad)
H = pad + rows * (cell + lab + pad)
canvas = Image.new("RGB", (W, H), (205, 205, 205))
draw = ImageDraw.Draw(canvas)
for i, f in enumerate(files):
    tile = Image.new("RGBA", (cell, cell), (205, 205, 205, 255))
    im = Image.open(f).convert("RGBA")
    im.thumbnail((cell, cell))
    tile.alpha_composite(im, ((cell - im.width) // 2, (cell - im.height) // 2))
    r, c = divmod(i, cols)
    x = pad + c * (cell + pad)
    y = pad + r * (cell + lab + pad)
    canvas.paste(tile.convert("RGB"), (x, y))
    draw.text((x + 4, y + cell + 2), str(i + 1), fill=(0, 0, 0))
    print(f"{i + 1}={f.stem}", flush=True)
out = d.parent / "montage.png"
canvas.save(out)
print("montage ->", out, flush=True)
