import { Fragment } from "react";
import { ChapterNav } from "@/components/chapter-nav";
import {
  chapters,
  formatNumber,
  rakiChapter,
  type Chapter,
  type MenuEntry,
} from "@/data/menu";
import "./ledger.css";

// Прототип-направление «Прейскурантъ»: те же данные, другой язык.
// Без полноэкранной обложки, без фото — один типографический объект.
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

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

function LedgerRow({ entry }: { entry: MenuEntry }) {
  return (
    <div className="led__row">
      <div className="led__row-line">
        <span className="led__row-name">
          {entry.name}
          {entry.signature ? (
            <span className="led__sig" title="Фирменная позиция">
              ◆
            </span>
          ) : null}
        </span>
        <span className="led__leader" aria-hidden />
        <span className="led__price">
          {formatNumber(entry.price)}
          {entry.unit ? <span className="led__unit">{entry.unit}</span> : null}
        </span>
      </div>
      {entry.note ? <p className="led__note">{entry.note}</p> : null}
      {entry.variants?.length ? (
        <div className="led__variants">
          {entry.variants.map((v) => (
            <span key={v.label}>
              {v.label} — {formatNumber(v.price)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RakiSection() {
  return (
    <section className="led__chapter" id="ch-raki" aria-label="Раки">
      <div className="led__chapter-head">
        <span className="led__numeral">№ {ROMAN[0]}</span>
        <h2 className="led__chapter-title">{rakiChapter.title}</h2>
        <span className="led__origin">{rakiChapter.origin}</span>
      </div>
      {rakiChapter.lede ? <p className="led__lede">{rakiChapter.lede}</p> : null}

      <div className="led__matrix">
        <p className="led__matrix-caption">Цена за килограмм</p>
        <table>
          <colgroup>
            <col className="led__col-tier" />
            <col span={3} />
          </colgroup>
          <thead>
            <tr>
              <th className="led__tier" scope="col">
                Размер · шт/кг
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
                <th className="led__tier" scope="row">
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

      <div>
        {rakiChapter.preparations.map((prep) => (
          <div className="led__prep" key={prep.id}>
            <h3 className="led__prep-title">{prep.title}</h3>
            <p className="led__recipes">
              <span className="led__recipes-label">{prep.recipesLabel}</span>
              {prep.recipes.map((recipe, index) => (
                <Fragment key={recipe.name}>
                  <span className="led__recipe-unit">
                    {recipe.name}
                    {recipe.extra ? (
                      <>
                        {" "}
                        <span className="led__recipe-extra">
                          +{formatNumber(recipe.extra)}
                        </span>
                      </>
                    ) : null}
                    {index < prep.recipes.length - 1 ? (
                      <span className="led__sep"> ·</span>
                    ) : null}
                  </span>{" "}
                </Fragment>
              ))}
            </p>
          </div>
        ))}
      </div>

      {rakiChapter.footnotes.map((note) => (
        <p className="led__footnote" key={note}>
          {note}
        </p>
      ))}
    </section>
  );
}

function StandardSection({
  chapter,
  numeral,
}: {
  chapter: Chapter;
  numeral: string;
}) {
  return (
    <section className="led__chapter" id={`ch-${chapter.id}`} aria-label={chapter.title}>
      <div className="led__chapter-head">
        <span className="led__numeral">№ {numeral}</span>
        <h2 className="led__chapter-title">{chapter.title}</h2>
        {chapter.origin ? (
          <span className="led__origin">{chapter.origin}</span>
        ) : (
          <span />
        )}
      </div>
      {chapter.lede ? <p className="led__lede">{chapter.lede}</p> : null}

      <div className="led__rows">
        {chapter.entries.map((entry) => (
          <LedgerRow key={entry.name} entry={entry} />
        ))}
      </div>

      {chapter.footnotes?.map((note) => (
        <p className="led__footnote" key={note}>
          {note}
        </p>
      ))}
    </section>
  );
}

export default function LedgerMenuPage() {
  const allChapters = [
    { id: rakiChapter.id, label: NAV_LABELS[rakiChapter.id] ?? rakiChapter.title },
    ...chapters.map((c) => ({ id: c.id, label: NAV_LABELS[c.id] ?? c.title })),
  ];

  return (
    <div className="led">
      <header className="led__masthead">
        <span className="led__kicker">Раковарня · Москва</span>
        <span className="led__wordmark">
          The <em>Raki</em>
        </span>
        <div className="led__masthead-row">
          <span>Карта</span>
          <span aria-hidden />
          <span>MMXXVI</span>
        </div>
      </header>

      <ChapterNav
        chapters={allChapters}
        classes={{
          nav: "led__nav",
          inner: "led__nav-inner",
          link: "led__nav-link",
        }}
      />

      <main className="led__body">
        <RakiSection />
        {chapters.map((chapter, index) => (
          <StandardSection
            key={chapter.id}
            chapter={chapter}
            numeral={ROMAN[index + 1]}
          />
        ))}
      </main>

      <footer className="led__colophon">
        <p className="led__colophon-mark">
          The <em>Raki</em>
        </p>
        <p className="led__colophon-line">Заказ примет ваш официант.</p>
        <p className="led__colophon-meta">
          Ростов-на-Дону · Магадан · Камчатка · Мурманск
          <br />
          Цены указаны в рублях · ◆ — фирменные позиции
        </p>
      </footer>
    </div>
  );
}
