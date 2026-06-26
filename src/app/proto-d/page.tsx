import "../proto/proto.css";
import "../proto/menu.css";
import { chapters, rakiChapter } from "@/data/menu";
import { Intro } from "../proto/components";
import {
  Banner,
  BottomNav,
  MenuHero,
  MenuRow,
  RakiBlock,
  SheetProvider,
} from "../proto/menu-ui";

// Пути к реальным фото (объявлены в серверном модуле — строки безопасно
// уходят пропсами в клиентские компоненты).
const RAKI_PHOTO = "/images/raki-boiled.webp";
// Главы с большим фото-баннером (есть реальное фото). Остальные — строками.
const BANNER: Record<string, string> = {
  crab: "/images/crab.webp",
  shrimp: "/images/shrimp-tails.webp",
  mussels: "/images/mussels.webp",
  desserts: "/images/dessert.webp",
};

// Вариант 21 + нижняя навигация: тёмный фото-герой → волна → кремовые секции
// (баннер у героев, строки у хвоста), фикс нижняя таб-навигация. Интро — текущее.
export default function ProtoD() {
  return (
    <SheetProvider>
      <Intro />
      <div className="mn">
        <MenuHero />

        {/* РАКИ — баннер + размерная лестница + стили варки */}
        <section id="mn-raki" data-mn-section="raki" className="mn__section">
          <div className="mn__section-head">
            <h2 className="mn__section-title">{rakiChapter.title}</h2>
          </div>
          <Banner photo={RAKI_PHOTO} alt="Варёные раки" />
          <RakiBlock sizes={rakiChapter.sizes} preps={rakiChapter.preparations} />
        </section>

        {chapters.map((ch) => {
          const banner = BANNER[ch.id];
          return (
            <section
              key={ch.id}
              id={`mn-${ch.id}`}
              data-mn-section={ch.id}
              className="mn__section"
            >
              <div className="mn__section-head">
                <h2 className="mn__section-title">{ch.title}</h2>
                {ch.origin ? (
                  <span className="mn__section-origin">{ch.origin}</span>
                ) : null}
              </div>
              {ch.lede ? <p className="mn__section-sub">{ch.lede}</p> : null}
              {banner ? <Banner photo={banner} alt={ch.title} /> : null}
              <div>
                {ch.entries.map((e) => (
                  <MenuRow key={e.name} entry={e} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <BottomNav />
    </SheetProvider>
  );
}
