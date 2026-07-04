// Чтение меню для БОТА-админки: в отличие от src/lib/menu-db.ts (витрина),
// показывает СКРЫТЫЕ позиции (стоп-лист) — чтобы их можно было вернуть.
// Удалённые (is_deleted) в обычных списках не показываются (отдельная команда
// восстановления — Фаза 4).
// NB: без `server-only` — файл гоняется и CLI-раннерами бота (tsx), где этот
// пакет-страж бросает исключение. Импортируется только серверным кодом.
import { neon } from "@neondatabase/serverless";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задан.");
  return neon(url);
}

export type ChapterBrief = {
  id: string;
  title: string;
  total: number; // позиций всего (не удалённых)
  hidden: number; // из них скрытых
};

export type EntryBrief = {
  id: number;
  name: string;
  price: number;
  unit: string | null;
  isHidden: boolean;
};

export type EntryFull = EntryBrief & {
  chapterId: string;
  note: string | null;
  abv: string | null;
  variants: { label: string; price: number }[];
  signature: boolean;
  spicy: boolean;
  groupLabel: string | null;
};

/** Список глав с числом позиций и скрытых (для экрана /menu). */
export async function listChapters(): Promise<ChapterBrief[]> {
  const sql = db();
  const rows = (await sql.query(
    `SELECT c.id, c.title,
            COUNT(e.id)                            AS total,
            COUNT(e.id) FILTER (WHERE e.is_hidden) AS hidden
       FROM chapters c
       LEFT JOIN entries e
         ON e.chapter_id = c.id AND NOT e.is_deleted
      GROUP BY c.id, c.title, c.sort_order
      ORDER BY c.sort_order`,
  )) as unknown as { id: string; title: string; total: string; hidden: string }[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    total: Number(r.total),
    hidden: Number(r.hidden),
  }));
}

/** Позиции главы (включая скрытые, без удалённых). */
export async function listEntries(chapterId: string): Promise<EntryBrief[]> {
  const sql = db();
  const rows = (await sql.query(
    `SELECT id, name, price, unit, is_hidden
       FROM entries
      WHERE chapter_id = $1 AND NOT is_deleted
      ORDER BY sort_order`,
    [chapterId],
  )) as unknown as { id: number; name: string; price: number; unit: string | null; is_hidden: boolean }[];
  return rows.map((r) => ({ id: r.id, name: r.name, price: r.price, unit: r.unit, isHidden: r.is_hidden }));
}

/** Полная карточка позиции (для экрана позиции в боте). */
export async function getEntry(id: number): Promise<EntryFull | null> {
  const sql = db();
  const rows = (await sql.query(
    `SELECT id, chapter_id, name, note, price, unit, abv, variants,
            signature, spicy, group_label, is_hidden
       FROM entries
      WHERE id = $1 AND NOT is_deleted`,
    [id],
  )) as unknown as {
    id: number;
    chapter_id: string;
    name: string;
    note: string | null;
    price: number;
    unit: string | null;
    abv: string | null;
    variants: { label: string; price: number }[];
    signature: boolean;
    spicy: boolean;
    group_label: string | null;
    is_hidden: boolean;
  }[];
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id,
    chapterId: r.chapter_id,
    name: r.name,
    note: r.note,
    price: r.price,
    unit: r.unit,
    abv: r.abv,
    variants: Array.isArray(r.variants) ? r.variants : [],
    signature: r.signature,
    spicy: r.spicy,
    groupLabel: r.group_label,
    isHidden: r.is_hidden,
  };
}
