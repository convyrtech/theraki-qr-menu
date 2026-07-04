// Гейт 1: доказывает, что БД == src/data/menu.ts без потерь.
// Сверяет getMenu() (из БД) с статическим экспортом menu.ts по deepStrictEqual.
// Запуск: node --env-file=.env.local scripts/db/verify-parity.ts
import { deepStrictEqual } from "node:assert";
import { chapters as staticChapters, rakiChapter as staticRaki } from "../../src/data/menu.ts";
import { getMenu } from "../../src/lib/menu-db.ts";

const { chapters: dbRaw, rakiChapter: dbRaki } = await getMenu();

// noteShort — новое производное поле (краткое описание), которого нет в menu.ts.
// Для сверки ЯДРА миграции его убираем: сравниваем то, что реально пришло из дока.
const dbChapters = dbRaw.map((c) => ({
  ...c,
  entries: c.entries.map((e) => {
    const { noteShort: _drop, ...rest } = e;
    void _drop;
    return rest;
  }),
}));

const diffs: string[] = [];

function check(label: string, a: unknown, b: unknown) {
  try {
    deepStrictEqual(a, b);
  } catch (err) {
    diffs.push(`✗ ${label}\n    ${(err as Error).message.split("\n").slice(0, 6).join("\n    ")}`);
  }
}

// Счётчики
if (dbChapters.length !== staticChapters.length) {
  diffs.push(`✗ число глав: БД ${dbChapters.length} ≠ menu.ts ${staticChapters.length}`);
}

// Поглавно (по id, а не по индексу — чтобы поймать и порядок отдельно)
const byId = new Map(dbChapters.map((c) => [c.id, c]));
for (const [i, sc] of staticChapters.entries()) {
  const dc = byId.get(sc.id);
  if (!dc) {
    diffs.push(`✗ глава «${sc.id}» отсутствует в БД`);
    continue;
  }
  check(`глава «${sc.id}» (${sc.title})`, dc, sc);
  if (dbChapters[i]?.id !== sc.id) {
    diffs.push(`✗ порядок глав: позиция ${i} — БД «${dbChapters[i]?.id}» ≠ menu.ts «${sc.id}»`);
  }
}

// Раковая доска
check("доска раков (rakiChapter)", dbRaki, staticRaki);

const totalEntries = staticChapters.reduce((n, c) => n + c.entries.length, 0);
const dbEntries = dbChapters.reduce((n, c) => n + c.entries.length, 0);

if (diffs.length === 0) {
  console.log(
    `✓ ПАРИТЕТ: 0 расхождений. ${dbChapters.length} глав, ${dbEntries}/${totalEntries} позиций, доска раков совпала.`,
  );
  // Естественный выход (не process.exit): у neon-HTTP остаются keepalive-сокеты,
  // а форсированный exit роняет libuv-ассерт на Windows/Node 24.
  process.exitCode = 0;
} else {
  console.error(`✗ ПАРИТЕТ НАРУШЕН: ${diffs.length} расхождений:\n`);
  console.error(diffs.join("\n\n"));
  process.exitCode = 1;
}
