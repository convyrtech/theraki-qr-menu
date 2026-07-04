// Применяет scripts/db/schema.sql к базе. Идемпотентно.
// Запуск: node --env-file=.env.local scripts/db/migrate.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neon } from "@neondatabase/serverless";

const here = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL не задан (node --env-file=.env.local …).");

const ddl = readFileSync(join(here, "schema.sql"), "utf8");

// Neon HTTP не глотает много стейтментов одним вызовом — режем по ';'
// (в DDL нет строк/функций с внутренними ';', так что простой split безопасен).
// Сначала вычищаем строки-комментарии, иначе стейтмент с шапкой-комментарием
// целиком выпадает из выборки.
const statements = ddl
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

const sql = neon(url);

for (const stmt of statements) {
  await sql.query(stmt);
  const head = stmt.split("\n")[0].slice(0, 68);
  console.log("  ok:", head);
}

console.log(`\nМиграция применена: ${statements.length} стейтментов.`);
