import type { NextConfig } from "next";

// Static export: the QR menu is a fully static artifact — deployable to any
// host, loads instantly on a phone over cellular. Images are pre-optimized
// to WebP at build time by scripts/optimize-images.mjs, so the Next image
// optimizer is not needed.
const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
