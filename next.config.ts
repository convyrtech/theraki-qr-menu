import type { NextConfig } from "next";

// ⚠️ Ветка feat/tg-admin: сайт читает меню из БД (Neon) с ISR, поэтому
// output:"export" УБРАН (статик-экспорт не умеет серверные компоненты/ISR).
// Деплой этой версии — на Vercel по ОТДЕЛЬНОМУ адресу. Прод menu.theraki.ru
// на GitHub Pages собирается из ДРУГОЙ ветки (feat/site-aligned-menu) и не
// затронут. Изображения по-прежнему пред-оптимизированы в WebP
// (scripts/optimize-images.mjs), поэтому image-оптимизатор не нужен.
const nextConfig: NextConfig = {
  // trailingSlash сохранён: URL /menu/ стабилен (совпадает с прод-адресом QR)
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Без плавающего «N»-бейджа в dev — чистые скриншоты для владельцев
  devIndicators: false,
};

export default nextConfig;
