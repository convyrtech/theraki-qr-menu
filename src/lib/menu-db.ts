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

type RakiBoard = {
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

type EntryRow = {
  name: string;
  note: string | null;
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
  const sql = db();
  const chapterRows = (await sql.query(
    `SELECT id, title, lede, origin, footnotes
       FROM chapters
      WHERE NOT is_hidden
      ORDER BY sort_order`,
  )) as unknown as {
    id: string;
    title: string;
    lede: string | null;
    origin: string | null;
    footnotes: string[];
  }[];

  const entryRows = (await sql.query(
    `SELECT chapter_id, name, note, price, unit, abv, variants, signature, spicy, photo, group_label
       FROM entries
      WHERE NOT is_hidden AND NOT is_deleted
      ORDER BY chapter_id, sort_order`,
  )) as unknown as (EntryRow & { chapter_id: string })[];

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
    return ch;
  });
}

/** Раковая доска (jsonb-документ). */
export async function getRakiBoard(): Promise<RakiBoard> {
  const sql = db();
  const rows = (await sql.query(`SELECT data FROM boards WHERE id = 'raki-board'`)) as unknown as {
    data: RakiBoard;
  }[];
  if (!rows.length) throw new Error("boards: raki-board не найден (запусти seed).");
  return rows[0].data;
}

/** Всё меню одним вызовом — форма как у menu.ts. */
export async function getMenu(): Promise<{ chapters: Chapter[]; rakiChapter: RakiBoard }> {
  const [chapters, rakiChapter] = await Promise.all([getChapters(), getRakiBoard()]);
  return { chapters, rakiChapter };
}
