import type { NextConfig } from "next";

// Static export: the QR menu is a fully static artifact — deployable to any
// host, loads instantly on a phone over cellular. Images are pre-optimized
// to WebP at build time by scripts/optimize-images.mjs, so the Next image
// optimizer is not needed.
const nextConfig: NextConfig = {
  output: "export",
  // Статик-хостинг (GitHub Pages): menu/index.html вместо menu.html —
  // чистые URL со слэшем работают на любом файловом сервере
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Без плавающего «N»-бейджа в dev — чистые скриншоты для владельцев
  devIndicators: false,
};

export default nextConfig;
