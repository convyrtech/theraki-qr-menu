// Сид: src/data/menu.ts → БД, без потерь. Идемпотентно (чистит контент и
// вставляет заново; audit_log не трогает).
// Запуск: node --env-file=.env.local scripts/db/seed.ts
import { neon } from "@neondatabase/serverless";
import { chapters, rakiChapter } from "../../src/data/menu.ts";
import { firstSentence } from "../../src/lib/text.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL не задан (node --env-file=.env.local …).");
const sql = neon(url);

// Чистим контент. RESTART IDENTITY — чтобы entry.id были стабильны между сидами.
await sql.query("TRUNCATE entries, chapters, boards RESTART IDENTITY CASCADE");

let chapterCount = 0;
let entryCount = 0;

for (const [ci, ch] of chapters.entries()) {
  await sql.query(
    `INSERT INTO chapters (id, title, lede, origin, footnotes, sort_order)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [ch.id, ch.title, ch.lede ?? null, ch.origin ?? null, JSON.stringify(ch.footnotes ?? []), ci],
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
