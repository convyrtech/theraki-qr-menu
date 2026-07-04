// Сид: src/data/menu.ts → БД. ПЕРВОНАЧАЛЬНАЯ загрузка. ⚠️ TRUNCATE стирает ВСЁ
// (в т.ч. правки владельца через бота — БД теперь единственный источник меню).
// Поэтому: отказ, если в БД уже есть позиции, без явного флага --force.
// Запуск: node --env-file=.env.local scripts/db/seed.ts [--force]
import { neon } from "@neondatabase/serverless";
import { chapters, rakiChapter } from "../../src/data/menu.ts";
import { firstSentence } from "../../src/lib/text.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL не задан (node --env-file=.env.local …).");
const sql = neon(url);

// Страж потери данных: не пересеивать заполненную БД без --force.
const force = process.argv.includes("--force");
const existing = (await sql.query(
  `SELECT (SELECT count(*) FROM entries)::int AS entries,
          (SELECT count(*) FROM audit_log)::int AS edits`,
)) as unknown as { entries: number; edits: number }[];
if (!force && (existing[0].entries > 0 || existing[0].edits > 0)) {
  throw new Error(
    `ОТКАЗ: в БД уже есть данные (${existing[0].entries} позиций, ${existing[0].edits} записей в журнале).\n` +
      `Повторный сид СОТРЁТ все правки владельца и перенумерует id.\n` +
      `Если это точно нужно (первичная переналадка) — запусти с флагом --force.`,
  );
}

// Чистим контент. RESTART IDENTITY — чтобы entry.id были стабильны между сидами.
await sql.query("TRUNCATE entries, chapters, boards RESTART IDENTITY CASCADE");

let chapterCount = 0;
let entryCount = 0;

// Стиль отображения: соусы = простой список; напитки (soft/tea/beer) тоже
// список, но они сливаются в виртуальную секцию «Напитки» на фронте. Остальное —
// карточки. (Совпадает с прежним зашитым LIST_CATEGORIES = {drinks, sauces}.)
const LIST_CHAPTERS = new Set(["sauces", "soft", "tea", "beer"]);
for (const [ci, ch] of chapters.entries()) {
  await sql.query(
    `INSERT INTO chapters (id, title, lede, origin, footnotes, sort_order, layout)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
    [
      ch.id,
      ch.title,
      ch.lede ?? null,
      ch.origin ?? null,
      JSON.stringify(ch.footnotes ?? []),
      ci,
      LIST_CHAPTERS.has(ch.id) ? "list" : "cards",
    ],
  );
  chapterCount++;

  for (const [ei, e] of ch.entries.entries()) {
    await sql.query(
      `INSERT INTO entries
         (chapter_id, name, note, note_short, price, unit, abv, variants, signature, spicy, photo, group_label, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13)`,
      [
        ch.id,
        e.name,
        e.note ?? null,
        // Начальное краткое = первое предложение развёрнутого (как на карточке
        // сегодня) — визуально сайт не меняется; дальше владелец правит вручную.
        e.note ? firstSentence(e.note) : null,
        e.price,
        e.unit ?? null,
        e.abv ?? null,
        JSON.stringify(e.variants ?? []),
        e.signature ?? false,
        e.spicy ?? false,
        e.photo ?? null,
        e.group ?? null,
        ei,
      ],
    );
    entryCount++;
  }
}

// Доска раков — целиком как jsonb-документ.
await sql.query(`INSERT INTO boards (id, data) VALUES ($1, $2::jsonb)`, [
  "raki-board",
  JSON.stringify(rakiChapter),
]);

console.log(`Сид готов: ${chapterCount} глав, ${entryCount} позиций, доска раков.`);
