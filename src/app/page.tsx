import { Fragment } from "react";
import { ChapterNav } from "@/components/chapter-nav";
import { RevealObserver } from "@/components/reveal-observer";
import {
  chapters,
  formatNumber,
  rakiChapter,
  type Chapter,
  type MenuEntry,
} from "@/data/menu";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

// Главы с тёмным фото-разворотом вместо кремового заголовка.
const DIVIDER_IMAGES: Record<string, { src: string; width: number; height: number }> = {
  raki: { src: "/images/chapter-raki.webp", width: 1400, height: 933 },
  crab: { src: "/images/chapter-crab.webp", width: 1400, height: 672 },
  mussels: { src: "/images/chapter-mussels.webp", width: 1400, height: 933 },
};

const NAV_LABELS: Record<string, string> = {
  raki: "Раки",
  shrimp: "Креветки",
  tails: "Шейки",
  crab: "Краб",
  mussels: "Мидии",
  vongole: "Вонголе",
  caviar: "Икра",
  desserts: "Десерты",
  drinks: "Напитки",
};

function ChapterHeading({
  numeral,
  title,
  origin,
  lede,
}: {
  numeral: string;
  title: string;
  origin?: string;
  lede?: string;
}) {
  return (
    <header className="reveal">
      <div className="chapter__header">
        <div>
          <span className="chapter__numeral">{numeral}</span>
          <h2 className="chapter__title">{title}</h2>
        </div>
        {origin ? <span className="chapter__origin">{origin}</span> : null}
      </div>
      {lede ? <p className="chapter__lede">{lede}</p> : null}
      <hr className="chapter__head-rule" />
    </header>
  );
}

function Divider({
  numeral,
  title,
  origin,
  image,
  chapterId,
  eager,
}: {
  numeral: string;
  title: string;
  origin?: string;
  image: { src: string; width: number; height: number };
  chapterId: string;
  eager?: boolean;
}) {
  return (
    <div className="divider" data-chapter={chapterId}>
      <div className="divider__media" aria-hidden>
        <img
          src={image.src}
          width={image.width}
          height={image.height}
          alt=""
          loading={eager ? "eager" : "lazy"}
        />
      </div>
      <div className="divider__inner reveal">
        <span className="divider__numeral">{numeral}</span>
        <h2 className="divider__title">{title}</h2>
        {origin ? <span className="divider__origin">{origin}</span> : null}
      </div>
    </div>
  );
}

function CarteRow({ entry }: { entry: MenuEntry }) {
  return (
    <div className="carte__row">
      <div>
        <h3 className="carte__name">
          {entry.name}
          {entry.signature ? (
            <span className="carte__signature" title="Фирменная позиция">
              {" "}
              ◆
            </span>
          ) : null}
        </h3>
        {entry.note ? <p className="carte__note">{entry.note}</p> : null}
      </div>
      <div>
        <span className="carte__price">{formatNumber(entry.price)}</span>
        {entry.unit ? <span className="carte__unit">{entry.unit}</span> : null}
      </div>
      {entry.variants?.length ? (
        <div className="carte__variants">
          {entry.variants.map((variant) => (
            <span key={variant.label}>
              {variant.label} — {formatNumber(variant.price)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RakiContent() {
  return (
    <div className="chapter chapter--after-divider" id="ch-raki-content">
      {rakiChapter.lede ? (
        <p className="chapter__lede reveal">{rakiChapter.lede}</p>
      ) : null}

      <div className="matrix reveal">
        <p className="matrix__caption">Цена за килограмм</p>
        <table>
          <colgroup>
            <col className="matrix__col-tier" />
            <col span={3} className="matrix__col-price" />
          </colgroup>
          <thead>
            <tr>
              <th className="matrix__tier" scope="col">
                Размер · <span className="no-break">шт/кг</span>
              </th>
              {rakiChapter.preparations.map((prep) => (
                <th key={prep.id} scope="col">
                  {prep.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rakiChapter.sizes.map((size) => (
              <tr key={size.tier}>
                <th className="matrix__tier" scope="row">
                  <b>{size.tier}</b>
                  <span>{size.countPerKg}</span>
                </th>
                {size.prices.map((price, index) => (
                  <td key={rakiChapter.preparations[index].id}>
                    {formatNumber(price)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "var(--space-lg)" }}>
        {rakiChapter.preparations.map((prep) => (
          <div className="raki__prep reveal" key={prep.id}>
            <div className="raki__prep-head">
              <h3 className="raki__prep-title">{prep.title}</h3>
            </div>
            <p className="raki__recipes">
              <span className="raki__recipes-label">{prep.recipesLabel}</span>
              {prep.recipes.map((recipe, index) => (
                <Fragment key={recipe.name}>
                  {/* Юнит «рецепт + надбавка + ·» неразрывен; перенос —
                      только на пробеле между юнитами */}
                  <span className="raki__unit">
                    {recipe.name}
                    {recipe.extra ? (
                      <>
                        {" "}
                        <span className="raki__recipe-extra">
                          +{formatNumber(recipe.extra)}
                        </span>
                      </>
                    ) : null}
                    {index < prep.recipes.length - 1 ? (
                      <span className="raki__sep"> ·</span>
                    ) : null}
                  </span>{" "}
                </Fragment>
              ))}
            </p>
          </div>
        ))}
      </div>

      {rakiChapter.footnotes.map((note) => (
        <p className="chapter__footnote" key={note}>
          {note}
        </p>
      ))}
    </div>
  );
}

function StandardChapter({
  chapter,
  numeral,
  withDivider,
}: {
  chapter: Chapter;
  numeral: string;
  withDivider: boolean;
}) {
  return (
    <div className={withDivider ? "chapter chapter--after-divider" : "chapter"}>
      {!withDivider ? (
        <ChapterHeading
          numeral={numeral}
          title={chapter.title}
          origin={chapter.origin}
          lede={chapter.lede}
        />
      ) : chapter.lede ? (
        <p className="chapter__lede reveal">{chapter.lede}</p>
      ) : null}

      <div className="carte reveal">
        {chapter.entries.map((entry) => (
          <CarteRow key={entry.name} entry={entry} />
        ))}
      </div>

      {chapter.id === "tails" ? (
        <figure className="arch reveal">
          <img
            src="/images/shrimp-tails.webp"
            width={900}
            height={900}
            alt="Раковые шейки премиум"
            loading="lazy"
          />
          <figcaption>ручная разделка</figcaption>
        </figure>
      ) : null}

      {chapter.id === "caviar" ? (
        <div className="arch-duo reveal">
          <figure className="arch arch--small">
            <img
              src="/images/caviar-red.webp"
              width={900}
              height={900}
              alt="Красная икра горбуши"
              loading="lazy"
            />
          </figure>
          <figure className="arch arch--small">
            <img
              src="/images/caviar-black.webp"
              width={900}
              height={900}
              alt="Чёрная икра русского осетра"
              loading="lazy"
            />
          </figure>
        </div>
      ) : null}

      {chapter.footnotes?.map((note) => (
        <p className="chapter__footnote" key={note}>
          {note}
        </p>
      ))}
    </div>
  );
}

export default function MenuPage() {
  const allChapters = [
    { id: rakiChapter.id, label: NAV_LABELS[rakiChapter.id] ?? rakiChapter.title },
    ...chapters.map((chapter) => ({
      id: chapter.id,
      label: NAV_LABELS[chapter.id] ?? chapter.title,
    })),
  ];

  return (
    <>
      <header className="cover">
        <div className="cover__media" aria-hidden>
          <img
            src="/images/hero-main.webp"
            width={1600}
            height={854}
            alt=""
            fetchPriority="high"
          />
        </div>
        <div className="cover__inner">
          <span className="cover__eyebrow">Раковарня · Москва</span>
          <h1 className="cover__wordmark">
            The <em>Raki</em>
          </h1>
          <span className="cover__rule" aria-hidden />
          <span className="cover__sub">Меню</span>
          <span className="cover__year">MMXXVI</span>
        </div>
        <span className="cover__hint">
          <span>листайте</span>
        </span>
        <span className="cover__arch" aria-hidden />
      </header>

      <ChapterNav chapters={allChapters} />

      <main className="book">
        <section id="ch-raki" aria-label="Раки">
          <Divider
            numeral={ROMAN[0]}
            title={rakiChapter.title}
            origin={rakiChapter.origin}
            image={DIVIDER_IMAGES.raki}
            chapterId="raki"
            eager
          />
          <RakiContent />
        </section>

        {chapters.map((chapter, index) => {
          const numeral = ROMAN[index + 1];
          const dividerImage = DIVIDER_IMAGES[chapter.id];
          return (
            <section key={chapter.id} id={`ch-${chapter.id}`} aria-label={chapter.title}>
              {dividerImage ? (
                <Divider
                  numeral={numeral}
                  title={chapter.title}
                  origin={chapter.origin}
                  image={dividerImage}
                  chapterId={chapter.id}
                />
              ) : null}
              <StandardChapter
                chapter={chapter}
                numeral={numeral}
                withDivider={Boolean(dividerImage)}
              />
            </section>
          );
        })}
      </main>

      <footer className="colophon">
        <p className="colophon__wordmark">
          The <em>Raki</em>
        </p>
        <p className="colophon__est">Москва · с 2017</p>
        <p className="colophon__service">Заказ примет ваш официант.</p>
        <p className="colophon__origins">
          Ростов-на-Дону · Магадан · Камчатка
          <br />
          Мурманск · Средиземноморье
        </p>
        <p className="colophon__currency">
          Цены указаны в рублях
          <br />◆ — фирменные позиции
        </p>
      </footer>

      <RevealObserver />
    </>
  );
}
