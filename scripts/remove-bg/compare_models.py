#!/usr/bin/env python3
"""Run several rembg models on ONE image to compare which keeps the whole dish (plate included).
Usage: python compare_models.py <image> <model1,model2,...>
Outputs <image_dir>/cutout-compare/<stem>__<model>.png
"""
import sys
import time
from pathlib import Path
from PIL import Image
from rembg import remove, new_session

src = Path(sys.argv[1]).resolve()
models = sys.argv[2].split(",") if len(sys.argv) > 2 else ["u2net", "isnet-general-use"]
out = src.parent / "cutout-compare"
out.mkdir(exist_ok=True)

im = Image.open(src)
for m in models:
    m = m.strip()
    t = time.time()
    try:
        r = remove(im, session=new_session(m), post_process_mask=True)
        p = out / f"{src.stem}__{m}.png"
        r.save(p)
        print(f"{m:24s} -> {p.name}  ({time.time() - t:.1f}s)", flush=True)
    except Exception as e:  # noqa: BLE001
        print(f"{m:24s} FAILED: {e}", flush=True)
print(f"done -> {out}", flush=True)
