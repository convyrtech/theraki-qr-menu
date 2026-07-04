// Запись правок меню из бота. Каждая операция атомарна: меняет данные и пишет
// строку в audit_log (кто/что/старое→новое). Ревалидацию сайта вызывает НЕ этот
// модуль, а хендлер бота через колбэк onMenuChanged (next/cache доступен только
// в Next-рантайме, не в dev-поллинге).
import { dbQuery } from "./db";

async function audit(
  actorId: number,
  action: string,
  entryId: number | null,
  details: Record<string, unknown>,
) {
  await dbQuery(
    `INSERT INTO audit_log (actor_tg_id, action, entry_id, details) VALUES ($1,$2,$3,$4::jsonb)`,
    [actorId, action, entryId, JSON.stringify(details)],
  );
}

/** Скрыть/вернуть позицию (стоп-лист). */
export async function setHidden(entryId: number, hidden: boolean, actorId: number): Promise<void> {
  const rows = (await dbQuery(`SELECT name, is_hidden FROM entries WHERE id=$1 AND NOT is_deleted`, [
    entryId,
  ])) as unknown as { name: string; is_hidden: boolean }[];
  if (!rows.length) throw new Error("Позиция не найдена.");
  await dbQuery(`UPDATE entries SET is_hidden=$2, updated_at=now() WHERE id=$1`, [entryId, hidden]);
  await audit(actorId, hidden ? "hide" : "unhide", entryId, {
    name: rows[0].name,
    old: rows[0].is_hidden,
    new: hidden,
  });
}

/** Изменить цену позиции. */
export async function setPrice(entryId: number, price: number, actorId: number): Promise<void> {
  if (!Number.isInteger(price) || price < 0) throw new Error("Цена — целое число ≥ 0.");
  const rows = (await dbQuery(`SELECT name, price FROM entries WHERE id=$1 AND NOT is_deleted`, [
    entryId,
  ])) as unknown as { name: string; price: number }[];
  if (!rows.length) throw new Error("Позиция не найдена.");
  await dbQuery(`UPDATE entries SET price=$2, updated_at=now() WHERE id=$1`, [entryId, price]);
  await audit(actorId, "price", entryId, { name: rows[0].name, old: rows[0].price, new: price });
}

/** Текстовые поля: name / note (развёрнутое) / note_short (краткое) / unit (грамовка). */
const TEXT_FIELDS = { name: "name", note: "note", noteShort: "note_short", unit: "unit" } as const;
export type TextField = keyof typeof TEXT_FIELDS;

export async function setText(
  entryId: number,
  field: TextField,
  value: string | null,
  actorId: number,
): Promise<void> {
  const col = TEXT_FIELDS[field];
  const rows = (await dbQuery(
    `SELECT name, ${col} AS old FROM entries WHERE id=$1 AND NOT is_deleted`,
    [entryId],
  )) as unknown as { name: string; old: string | null }[];
  if (!rows.length) throw new Error("Позиция не найдена.");
  await dbQuery(`UPDATE entries SET ${col}=$2, updated_at=now() WHERE id=$1`, [entryId, value]);
  await audit(actorId, "text", entryId, { name: rows[0].name, field, old: rows[0].old, new: value });
}

/** Метки-тумблеры: signature (◆) / spicy (🌶). */
const FLAG_FIELDS = { signature: "signature", spicy: "spicy" } as const;
export type FlagField = keyof typeof FLAG_FIELDS;

export async function setFlag(
  entryId: number,
  flag: FlagField,
  value: boolean,
  actorId: number,
): Promise<void> {
  const col = FLAG_FIELDS[flag];
  const rows = (await dbQuery(
    `SELECT name, ${col} AS old FROM entries WHERE id=$1 AND NOT is_deleted`,
    [entryId],
  )) as unknown as { name: string; old: boolean }[];
  if (!rows.length) throw new Error("Позиция не найдена.");
  await dbQuery(`UPDATE entries SET ${col}=$2, updated_at=now() WHERE id=$1`, [entryId, value]);
  await audit(actorId, "flag", entryId, { name: rows[0].name, field: flag, old: rows[0].old, new: value });
}

/** Мягкое удаление / восстановление. */
export async function softDelete(entryId: number, actorId: number): Promise<void> {
  const rows = (await dbQuery(`SELECT name FROM entries WHERE id=$1 AND NOT is_deleted`, [
    entryId,
  ])) as unknown as { name: string }[];
  if (!rows.length) throw new Error("Позиция не найдена или уже удалена.");
  await dbQuery(`UPDATE entries SET is_deleted=true, updated_at=now() WHERE id=$1`, [entryId]);
  await audit(actorId, "delete", entryId, { name: rows[0].name });
}

export async function restoreEntry(entryId: number, actorId: number): Promise<void> {
  const rows = (await dbQuery(`SELECT name FROM entries WHERE id=$1 AND is_deleted`, [
    entryId,
  ])) as unknown as { name: string }[];
  if (!rows.length) throw new Error("Удалённая позиция не найдена.");
  await dbQuery(`UPDATE entries SET is_deleted=false, updated_at=now() WHERE id=$1`, [entryId]);
  await audit(actorId, "restore", entryId, { name: rows[0].name });
}

// --- Форматы подачи (variants: [{label, price}]) ------------------------
export type Variant = { label: string; price: number };

async function readVariants(entryId: number): Promise<{ name: string; variants: Variant[] }> {
  const rows = (await dbQuery(`SELECT name, variants FROM entries WHERE id=$1 AND NOT is_deleted`, [
    entryId,
  ])) as unknown as { name: string; variants: Variant[] }[];
  if (!rows.length) throw new Error("Позиция не найдена.");
  return { name: rows[0].name, variants: Array.isArray(rows[0].variants) ? rows[0].variants : [] };
}

async function writeVariants(entryId: number, variants: Variant[], actorId: number, details: Record<string, unknown>) {
  await dbQuery(`UPDATE entries SET variants=$2::jsonb, updated_at=now() WHERE id=$1`, [
    entryId,
    JSON.stringify(variants),
  ]);
  await audit(actorId, "variant", entryId, details);
}

export async function addVariant(entryId: number, label: string, price: number, actorId: number): Promise<void> {
  if (!label.trim()) throw new Error("Метка формата пустая.");
  if (!Number.isInteger(price) || price < 0) throw new Error("Цена — целое ≥ 0.");
  const { name, variants } = await readVariants(entryId);
  variants.push({ label: label.trim(), price });
  await writeVariants(entryId, variants, actorId, { name, op: "add", label: label.trim(), price });
}

export async function updateVariant(
  entryId: number,
  idx: number,
  label: string,
  price: number,
  actorId: number,
): Promise<void> {
  if (!label.trim()) throw new Error("Метка формата пустая.");
  if (!Number.isInteger(price) || price < 0) throw new Error("Цена — целое ≥ 0.");
  const { name, variants } = await readVariants(entryId);
  if (!variants[idx]) throw new Error("Формат не найден.");
  variants[idx] = { label: label.trim(), price };
  await writeVariants(entryId, variants, actorId, { name, op: "update", idx, label: label.trim(), price });
}

export async function deleteVariant(entryId: number, idx: number, actorId: number): Promise<void> {
  const { name, variants } = await readVariants(entryId);
  if (!variants[idx]) throw new Error("Формат не найден.");
  const [removed] = variants.splice(idx, 1);
  await writeVariants(entryId, variants, actorId, { name, op: "delete", removed });
}

/** Разбор строки «метка = цена» (например «0,5 кг = 1450»). */
export function parseVariant(text: string): { label: string; price: number } | null {
  const parts = text.split("=");
  if (parts.length !== 2) return null;
  const label = parts[0].trim();
  const price = Number(parts[1].replace(/\s/g, "").replace(",", "."));
  if (!label || !Number.isInteger(price) || price < 0) return null;
  return { label, price };
}

/** Добавить новую категорию (в конец). layout: 'cards' | 'list'. Возвращает id. */
export async function addChapter(
  title: string,
  layout: "cards" | "list",
  actorId: number,
): Promise<string> {
  const t = title.trim();
  if (!t) throw new Error("Название категории пустое.");
  if (layout !== "cards" && layout !== "list") throw new Error("Неверный стиль категории.");
  // Опаковый уникальный id (пользователь видит название, не id). Base36 времени.
  const id = "cat_" + Date.now().toString(36);
  const ord = (await dbQuery(`SELECT COALESCE(MAX(sort_order)+1, 0) AS next FROM chapters`)) as unknown as {
    next: number;
  }[];
  await dbQuery(`INSERT INTO chapters (id, title, sort_order, layout) VALUES ($1,$2,$3,$4)`, [
    id,
    t,
    Number(ord[0].next),
    layout,
  ]);
  await audit(actorId, "add_chapter", null, { id, title: t, layout });
  return id;
}

/** Добавить позицию в раздел (в конец). Возвращает id новой позиции. */
export async function addEntry(
  chapterId: string,
  data: { name: string; price: number; unit?: string | null; note?: string | null; noteShort?: string | null },
  actorId: number,
): Promise<number> {
  const ord = (await dbQuery(
    `SELECT COALESCE(MAX(sort_order)+1, 0) AS next FROM entries WHERE chapter_id=$1`,
    [chapterId],
  )) as unknown as { next: number }[];
  const rows = (await dbQuery(
    `INSERT INTO entries (chapter_id, name, price, unit, note, note_short, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [chapterId, data.name, data.price, data.unit ?? null, data.note ?? null, data.noteShort ?? null, Number(ord[0].next)],
  )) as unknown as { id: number }[];
  const id = rows[0].id;
  await audit(actorId, "add", id, { name: data.name, chapterId, price: data.price });
  return id;
}
