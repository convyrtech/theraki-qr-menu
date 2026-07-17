// Удаление тестовой главы «Какиши» из БД зала (мусор бот-админки; юзер в курсе).
// Запуск: node --env-file=.env.local scripts/db/remove-kakishi.ts
import { neon } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL не задан.");
const sql = neon(url);
const trash = await sql`SELECT id, title FROM chapters WHERE title = ${"Какиши"}`;
if (trash.length === 1) {
  await sql`DELETE FROM entries WHERE chapter_id = ${trash[0].id}`;
  await sql`DELETE FROM chapters WHERE id = ${trash[0].id}`;
  console.log(`✓ глава «Какиши» удалена (id=${trash[0].id})`);
} else {
  console.log(`⚠ найдено ${trash.length} глав «Какиши» — не трогаю`);
}
