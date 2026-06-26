#!/usr/bin/env python3
"""Remove a UNIFORM studio background by edge-connected flood fill (magic wand from the borders).
Keeps the ENTIRE subject (bowl + plate + side bread + food) — unlike salient-object AI models,
which guess one object and drop the dish/sides. Best for clean shots on a near-uniform background.

Usage: python bg_flood.py <image_or_dir> [--out DIR] [--tol 40] [--ext jpg,jpeg,png,webp]
"""
import argparse
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage


def cut(path: Path, out_dir: Path, tol: float) -> str:
    rgb = np.asarray(Image.open(path).convert("RGB"))
    f = rgb.astype(np.int16)
    b = 8
    border = np.concatenate([
        f[:b, :, :].reshape(-1, 3), f[-b:, :, :].reshape(-1, 3),
        f[:, :b, :].reshape(-1, 3), f[:, -b:, :].reshape(-1, 3),
    ])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((f - bg) ** 2).sum(2))
    bgmask = dist < tol
    lbl, _ = ndimage.label(bgmask)            # connected bg-colored regions
    edge = set(lbl[0, :]) | set(lbl[-1, :]) | set(lbl[:, 0]) | set(lbl[:, -1])
    edge.discard(0)
    remove = np.isin(lbl, list(edge))         # only bg connected to the border
    alpha = np.where(remove, 0.0, 255.0).astype(np.float32)
    alpha = np.clip(ndimage.gaussian_filter(alpha, 1.2), 0, 255).astype(np.uint8)  # 1-2px feather
    out = np.dstack([rgb, alpha])
    dst = out_dir / (path.stem + ".png")
    Image.fromarray(out, "RGBA").save(dst)
    return f"{path.name}: bg={bg.astype(int).tolist()} removed={remove.mean():.0%} -> {dst.name}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--out", default=None)
    ap.add_argument("--tol", type=float, default=40.0, help="bg color tolerance (raise if bg remains, lower if subject eaten)")
    ap.add_argument("--ext", default="jpg,jpeg,png,webp,bmp,tif,tiff")
    a = ap.parse_args()
    p = Path(a.input).resolve()
    exts = {"." + e.strip().lower().lstrip(".") for e in a.ext.split(",")}
    files = [p] if p.is_file() else sorted(x for x in p.iterdir() if x.suffix.lower() in exts)
    base = (p.parent if p.is_file() else p)
    out_dir = Path(a.out).resolve() if a.out else base / "cutout"
    out_dir.mkdir(parents=True, exist_ok=True)
    for f in files:
        print(cut(f, out_dir, a.tol), flush=True)
    print(f"done -> {out_dir}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
