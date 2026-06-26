#!/usr/bin/env python3
"""Batch background removal for product photos (rembg + BiRefNet).

Outputs transparent PNGs (alpha) ready for Figma.

Examples:
  python remove_bg.py "D:/РАКИСВЕЖЕЕ/theraki-qr-menu/фото"
  python remove_bg.py ./фото --out ./cutout --model birefnet-general-lite
  python remove_bg.py ./фото --alpha-matting --overwrite

First run downloads the model automatically (BiRefNet is large, ~hundreds of MB).
birefnet-general = best quality (slow on CPU). birefnet-general-lite = faster, near-quality.
"""
import argparse
import sys
import time
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser(description="Batch background removal (rembg + BiRefNet).")
    ap.add_argument("input", nargs="?", default=".", help="folder with input images")
    ap.add_argument("--out", default=None, help="output folder (default: <input>/cutout)")
    # isnet-general-use keeps the WHOLE plated dish (bowl/plate). birefnet-general is a
    # salient-object model that crops the plate away and keeps only the food — wrong for product shots.
    ap.add_argument("--model", default="isnet-general-use", help="rembg session name")
    ap.add_argument("--ext", default="jpg,jpeg,png,webp,bmp,tif,tiff", help="comma-separated input extensions")
    ap.add_argument("--alpha-matting", action="store_true", help="extra edge refinement (slower)")
    ap.add_argument("--overwrite", action="store_true", help="reprocess even if output exists")
    args = ap.parse_args()

    in_dir = Path(args.input).expanduser().resolve()
    if not in_dir.is_dir():
        print(f"not a directory: {in_dir}", file=sys.stderr)
        return 2
    out_dir = Path(args.out).expanduser().resolve() if args.out else in_dir / "cutout"
    out_dir.mkdir(parents=True, exist_ok=True)

    exts = {"." + e.strip().lower().lstrip(".") for e in args.ext.split(",") if e.strip()}
    files = sorted(p for p in in_dir.iterdir() if p.is_file() and p.suffix.lower() in exts)
    if not files:
        print(f"no images {sorted(exts)} in {in_dir}", file=sys.stderr)
        return 2

    # Heavy imports are lazy so --help stays instant.
    from PIL import Image
    from rembg import remove, new_session

    print(f"model: {args.model} | images: {len(files)} | out: {out_dir}", flush=True)
    print("loading model (first run downloads it)...", flush=True)
    session = new_session(args.model)

    ok = skip = fail = 0
    for i, src in enumerate(files, 1):
        dst = out_dir / (src.stem + ".png")
        if dst.exists() and not args.overwrite:
            print(f"[{i}/{len(files)}] skip (exists): {src.name}", flush=True)
            skip += 1
            continue
        t = time.time()
        try:
            with Image.open(src) as im:
                cut = remove(
                    im,
                    session=session,
                    alpha_matting=args.alpha_matting,
                    post_process_mask=True,
                )
            cut.save(dst)
            ok += 1
            print(f"[{i}/{len(files)}] ok  {src.name} -> {dst.name}  ({time.time() - t:.1f}s)", flush=True)
        except Exception as e:  # noqa: BLE001 - report and continue per file
            fail += 1
            print(f"[{i}/{len(files)}] FAIL {src.name}: {e}", flush=True)

    print(f"\ndone: {ok} ok, {skip} skipped, {fail} failed -> {out_dir}", flush=True)
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
