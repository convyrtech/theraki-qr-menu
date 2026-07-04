// Чтение меню из БД. Возвращает РОВНО ту же форму, что статически
// экспортирует src/data/menu.ts (chapters + rakiChapter) — чтобы менючная
// страница переключилась на БД без единого изменения в разметке, а
// паритет-скрипт мог сверить deep-diff.
//
// Конвенция формы (как в menu.ts): опциональные поля ОТСУТСТВУЮТ, когда
// пусты (никаких note: undefined / signature: false). Это важно для
// deepStrictEqual в паритете.
import { neon } from "@neondatabase/serverless";
import type { Chapter, MenuEntry } from "@/data/menu";

export type RakiBoard = {
  id: string;
  title: string;
  sizes: { tier: string; countPerKg: string; price: number }[];
  preparations: {
    id: string;
    title: string;
    recipesLabel: string;
    recipes: { name: string; surcharge?: string; extra?: number; spicy?: boolean }[];
  }[];
  footnotes: string[];
};

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задан.");
  return neon(url);
}

// Ретраи на сетевых сбоях — как в bot/db.ts, но самодостаточно (этот модуль
// импортит CLI-скрипт паритета на нативном node, без next/bot-зависимостей).
// Без ретрая одиночный ConnectTimeout к Neon роняет чтение → гость видит
// статический menu.ts (устаревшие цены). С ретраем фолбэк — только на реальный сбой.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function isRetriable(e: unknown): boolean {
  const s = String((e as { message?: string })?.message ?? e) + " " + String((e as { cause?: unknown })?.cause ?? "");
  return /fetch failed|ConnectTimeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network/i.test(s);
}
async function q<T>(text: string): Promise<T[]> {
  const sql = db();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return (await sql.query(text)) as unknown as T[];
    } catch (e) {
      lastErr = e;
      if (!isRetriable(e)) throw e; // не-сетевую (битый SQL/нет таблицы) не повторяем
      if (attempt === 2) break;
      await sleep(300 * (attempt + 1));
    }
  }
  throw lastErr;
}

type EntryRow = {
  name: string;
  note: string | null;
  note_short: string | null;
  price: number;
  unit: string | null;
  abv: string | null;
  variants: { label: string; price: number }[];
  signature: boolean;
  spicy: boolean;
  photo: string | null;
  group_label: string | null;
};

function rowToEntry(r: EntryRow): MenuEntry {
  const e: MenuEntry = { name: r.name, price: r.price };
  if (r.note != null) e.note = r.note;
  if (r.note_short != null) e.noteShort = r.note_short;
  if (r.unit != null) e.unit = r.unit;
  if (r.abv != null) e.abv = r.abv;
  if (Array.isArray(r.variants) && r.variants.length) e.variants = r.variants;
  if (r.signature) e.signature = true;
  if (r.spicy) e.spicy = true;
  if (r.photo != null) e.photo = r.photo;
  if (r.group_label != null) e.group = r.group_label;
  return e;
}

/** Обычные главы (без раковой доски), видимые гостю. */
export async function getChapters(): Promise<Chapter[]> {
  const chapterRows = await q<{
    id: string;
    title: string;
    lede: string | null;
    origin: string | null;
    footnotes: string[];
    layout: "cards" | "list";
  }>(
    `SELECT id, title, lede, origin, footnotes, layout
       FROM chapters
      WHERE NOT is_hidden
      ORDER BY sort_order`,
  );

  const entryRows = await q<EntryRow & { chapter_id: string }>(
    `SELECT chapter_id, name, note, note_short, price, unit, abv, variants, signature, spicy, photo, group_label
       FROM entries
      WHERE NOT is_hidden AND NOT is_deleted
      ORDER BY chapter_id, sort_order`,
  );

  const byChapter = new Map<string, MenuEntry[]>();
  for (const r of entryRows) {
    const list = byChapter.get(r.chapter_id) ?? [];
    list.push(rowToEntry(r));
    byChapter.set(r.chapter_id, list);
  }

  return chapterRows.map((c) => {
    const ch: Chapter = { id: c.id, title: c.title, entries: byChapter.get(c.id) ?? [] };
    if (c.lede != null) ch.lede = c.lede;
    if (c.origin != null) ch.origin = c.origin;
    if (Array.isArray(c.footnotes) && c.footnotes.length) ch.footnotes = c.footnotes;
    if (c.layout) ch.layout = c.layout;
    return ch;
  });
}

/** Раковая доска (jsonb-документ). */
export async function getRakiBoard(): Promise<RakiBoard> {
  const rows = await q<{ data: RakiBoard }>(`SELECT data FROM boards WHERE id = 'raki-board'`);
  if (!rows.length) throw new Error("boards: raki-board не найден (запусти seed).");
  return rows[0].data;
}

/** Всё меню одним вызовом — форма как у menu.ts. */
export async function getMenu(): Promise<{ chapters: Chapter[]; rakiChapter: RakiBoard }> {
  const [chapters, rakiChapter] = await Promise.all([getChapters(), getRakiBoard()]);
  return { chapters, rakiChapter };
}
