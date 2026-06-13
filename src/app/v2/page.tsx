import { ChapterNav } from "@/components/chapter-nav";
import {
  chapters,
  formatNumber,
  rakiChapter,
  type Chapter,
} from "@/data/menu";
import { ExpandRow, RakiPrepRow } from "./expandable";
import "./ledger.css";

// Направление «Прейскурантъ» + тап-модель плотности.
// По умолчанию только название · размер · цена; всё остальное — под тап.
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

function ChapterHead({
  numeral,
  title,
  origin,
}: {
  numeral: string;
  title: string;
  origin?: string;
}) {
  return (
    <div className="led__chapter-head">
      <span className="led__numeral">№ {numeral}</span>
      <h2 className="led__chapter-title">{title}</h2>
      {origin ? <span className="led__origin">{origin}</span> : <span />}
    </div>
  );
}

function RakiSection() {
  return (
    <section className="led__chapter" id="ch-raki" aria-label="Раки">
      <ChapterHead numeral={ROMAN[0]} title={rakiChapter.title} origin={rakiChapter.origin} />

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
                Размер · <span className="led__nowrap">шт/кг</span>
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

      <div className="led__rows led__rows--prep">
        {rakiChapter.preparations.map((prep) => (
          <RakiPrepRow key={prep.id} prep={prep} />
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
      <ChapterHead numeral={numeral} title={chapter.title} origin={chapter.origin} />
      <div className="led__rows">
        {chapter.entries.map((entry) => (
          <ExpandRow key={entry.name} entry={entry} />
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
