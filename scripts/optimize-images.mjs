// One-time asset pipeline: pulls the editorial photography from the main
// theraki-repo and emits compressed WebP into public/images.
// Source PNGs are 2-2.6 MB each; the QR menu must load instantly on cellular.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SRC = "E:/1111111111111111111111111/theraki-repo/public/images";
const OUT = new URL("../public/images/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const ASSETS = [
  // hero / cover
  { from: "menu/editorial/hero-main.png", to: "hero-main.webp", width: 1600 },
  { from: "menu/editorial/hero-alt.png", to: "hero-alt.webp", width: 1600 },
  // chapter dividers (dark, wet-stone editorial)
  { from: "menu/editorial/triptych-raki.png", to: "chapter-raki.webp", width: 1400 },
  { from: "menu/editorial/triptych-mussels.png", to: "chapter-mussels.webp", width: 1400 },
  { from: "menu/editorial/triptych-crab.png", to: "chapter-crab.webp", width: 1400 },
  // cream item photography
  { from: "menu/editorial/cream-raki-boiled.png", to: "raki-boiled.webp", width: 1000 },
  { from: "menu/editorial/cream-raki-roasted.png", to: "raki-fried.webp", width: 1000 },
  { from: "menu/editorial/cream-raki-glaze.png", to: "raki-glaze.webp", width: 1000 },
  { from: "menu/editorial/cream-mussels.png", to: "mussels.webp", width: 1000 },
  { from: "menu/editorial/cream-crab.png", to: "crab.webp", width: 1000 },
  { from: "aquarium/crayfish-alive.png", to: "raki-live.webp", width: 1000 },
  // category photography (jpg)
  { from: "menu/categories/shrimp-tails.jpg", to: "shrimp-tails.webp", width: 900 },
  { from: "menu/categories/caviar-red.jpg", to: "caviar-red.webp", width: 900 },
  { from: "menu/categories/caviar-black.jpg", to: "caviar-black.webp", width: 900 },
  { from: "menu/categories/dessert-cherry.jpg", to: "dessert.webp", width: 900 },
  { from: "menu/categories/drink-mineral-water.jpg", to: "drinks.webp", width: 900 },
];

mkdirSync(OUT, { recursive: true });

for (const asset of ASSETS) {
  const input = path.join(SRC, asset.from);
  const output = path.join(OUT, asset.to);
  const image = sharp(input).resize({ width: asset.width, withoutEnlargement: true });
  const info = await image.webp({ quality: 80 }).toFile(output);
  console.log(`${asset.to}: ${(info.size / 1024).toFixed(0)} KB (${info.width}x${info.height})`);
}
console.log("done");
