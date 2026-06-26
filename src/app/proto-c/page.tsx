import "../proto/proto.css";
import { chapters, rakiChapter } from "@/data/menu";
import {
  ChapterHead,
  ChapterNav,
  Colophon,
  CompactRow,
  EditorialCard,
  Intro,
  MusselsDark,
  RakiHero,
  SheetProvider,
  ShrimpHero,
  VongoleLight,
  WaveDivider,
} from "../proto/components";

// Главы с собственными фото-секциями (спец-кейсы ниже). Краб — БЕЗ фото
// в наборе 13, поэтому он не герой, а текст-глава (Tier B).
const PHOTO_HEROES = new Set(["shrimp", "mussels", "vongole"]);

// Короткие ярлыки навигации (полные заголовки длинны для чипов).
const NAV_LABELS: Record<string, string> = {
  raki: "Раки",
  crab: "Краб",
  shrimp: "Креветки",
  starters: "Закуски",
  salads: "Салаты",
  hot: "Горячее",
  soups: "Супы",
  mussels: "Мидии",
  vongole: "Вонголе",
  mains: "Основные",
  garnish: "Гарниры",
  sauces: "Соусы",
  desserts: "Десерты",
  tea: "Чай",
  soft: "Воды",
  beer: "Пиво",
};

// Вариант C — scan-first editorial: кремовая карта с тёмным разворотом «Раки»
// и фото-карточками у морских героев. Единственное направление (B ретайрнут).
export default function ProtoC() {
  const navItems = [
    { id: "raki", label: NAV_LABELS.raki },
    ...chapters.map((c) => ({ id: c.id, label: NAV_LABELS[c.id] ?? c.title })),
  ];

  return (
    <SheetProvider>
      <Intro />
      <div className="pt">
        <header className="pt__masthead">
          <span className="pt__masthead-eyebrow">Раковарня · Москва</span>
          <span className="pt__masthead-word">
            The <em>Raki</em>
          </span>
          <span className="pt__masthead-lede">Карта раковарни · MMXXVI</span>
          <WaveDivider edge="bottom" variant="hero" />
        </header>
        <ChapterNav items={navItems} />

        <main className="pt__catalog">
          {/* РАКИ — тёмный гравюрный разворот: доска размеров + стили */}
          <RakiHero
            sizes={rakiChapter.sizes}
            preps={rakiChapter.preparations}
          />

          {chapters.map((ch) => {
            const isHero = PHOTO_HEROES.has(ch.id);
            const [first, ...rest] = ch.entries;

            // Мидии — тёмная секция-близнец «Раки» (фото-соусы на чёрном фоне).
            if (ch.id === "mussels") {
              return <MusselsDark key={ch.id} entry={first} />;
            }
            // Вонголе — светлая секция-зеркало мидий (фото-соусы на белом).
            if (ch.id === "vongole") {
              return <VongoleLight key={ch.id} entry={first} />;
            }
            // Креветки — светлая секция-герой: 2 фото-подноса + список позиций.
            if (ch.id === "shrimp") {
              return (
                <ShrimpHero
                  key={ch.id}
                  title={ch.title}
                  lede={ch.lede}
                  entries={ch.entries}
                />
              );
            }

            return (
              <section key={ch.id} id={`pt-${ch.id}`} className="pt__chapter">
                <ChapterHead title={ch.title} origin={ch.origin} />
                {ch.lede && !isHero ? (
                  <p className="pt__chapter-lede">{ch.lede}</p>
                ) : null}

                {isHero ? (
                  <>
                    <EditorialCard
                      reason={ch.origin ?? ch.lede}
                      name={first.name}
                      price={first.price}
                      unit={first.unit}
                      detail={first}
                      signature={first.signature}
                      spicy={first.spicy}
                      desc={first.note}
                    />
                    {rest.length ? (
                      <div className="pt__rows">
                        {rest.map((e) => (
                          <CompactRow key={e.name} entry={e} />
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="pt__rows">
                    {ch.entries.map((e) => (
                      <CompactRow key={e.name} entry={e} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </main>

        <Colophon />
      </div>
    </SheetProvider>
  );
}
