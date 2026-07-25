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
  // AND NOT is_deleted + RETURNING: если позицию удалили между SELECT и UPDATE
  // (другой админ параллельно), правка не применится к удалённой (аудит L4).
  const upd = (await dbQuery(
    `UPDATE entries SET is_hidden=$2, updated_at=now() WHERE id=$1 AND NOT is_deleted RETURNING id`,
    [entryId, hidden],
  )) as unknown as { id: number }[];
  if (!upd.length) throw new Error("Позиция была удалена — правка отменена.");
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
  const upd = (await dbQuery(
    `UPDATE entries SET price=$2, updated_at=now() WHERE id=$1 AND NOT is_deleted RETURNING id`,
    [entryId, price],
  )) as unknown as { id: number }[];
  if (!upd.length) throw new Error("Позиция была удалена — правка отменена.");
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
  const upd = (await dbQuery(
    `UPDATE entries SET ${col}=$2, updated_at=now() WHERE id=$1 AND NOT is_deleted RETURNING id`,
    [entryId, value],
  )) as unknown as { id: number }[];
  if (!upd.length) throw new Error("Позиция была удалена — правка отменена.");
  await audit(actorId, "text", entryId, { name: rows[0].name, field, old: rows[0].old, new: value });
}

/** Фото позиции по ссылке (или null — убрать). URL должен быть https:// —
 *  иначе картинка не загрузится на https-сайте (mixed content). */
export async function setPhoto(entryId: number, url: string | null, actorId: number): Promise<void> {
  // Разрешаем внутренний путь (/api/photo/… — загруженное фото) или внешний https-URL.
  if (url !== null && !/^(https:\/\/|\/)\S+$/i.test(url)) {
    throw new Error("Нужно фото или ссылка https://…");
  }
  const rows = (await dbQuery(`SELECT name, photo FROM entries WHERE id=$1 AND NOT is_deleted`, [
    entryId,
  ])) as unknown as { name: string; photo: string | null }[];
  if (!rows.length) throw new Error("Позиция не найдена.");
  const upd = (await dbQuery(
    `UPDATE entries SET photo=$2, updated_at=now() WHERE id=$1 AND NOT is_deleted RETURNING id`,
    [entryId, url],
  )) as unknown as { id: number }[];
  if (!upd.length) throw new Error("Позиция была удалена — правка отменена.");
  await audit(actorId, "photo", entryId, { name: rows[0].name, old: rows[0].photo, new: url });
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
  const upd = (await dbQuery(
    `UPDATE entries SET ${col}=$2, updated_at=now() WHERE id=$1 AND NOT is_deleted RETURNING id`,
    [entryId, value],
  )) as unknown as { id: number }[];
  if (!upd.length) throw new Error("Позиция была удалена — правка отменена.");
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

async function readVariants(
  entryId: number,
): Promise<{ name: string; variants: Variant[]; version: string }> {
  const rows = (await dbQuery(
    `SELECT name, variants, updated_at::text AS version FROM entries WHERE id=$1 AND NOT is_deleted`,
    [entryId],
  )) as unknown as { name: string; variants: Variant[]; version: string }[];
  if (!rows.length) throw new Error("Позиция не найдена.");
  return {
    name: rows[0].name,
    variants: Array.isArray(rows[0].variants) ? rows[0].variants : [],
    version: rows[0].version,
  };
}

async function writeVariants(
  entryId: number,
  variants: Variant[],
  version: string,
  actorId: number,
  details: Record<string, unknown>,
) {
  // Оптимистичная блокировка: применяем, только если позицию не изменили параллельно.
  const upd = (await dbQuery(
    `UPDATE entries SET variants=$2::jsonb, updated_at=now() WHERE id=$1 AND updated_at::text=$3 RETURNING id`,
    [entryId, JSON.stringify(variants), version],
  )) as unknown as { id: number }[];
  if (!upd.length) {
    throw new Error("Позицию изменили параллельно — откройте «📐 Форматы» заново и повторите.");
  }
  await audit(actorId, "variant", entryId, details);
}

export async function addVariant(entryId: number, label: string, price: number, actorId: number): Promise<void> {
  if (!label.trim()) throw new Error("Метка формата пустая.");
  if (!Number.isInteger(price) || price < 0) throw new Error("Цена — целое ≥ 0.");
  const { name, variants, version } = await readVariants(entryId);
  variants.push({ label: label.trim(), price });
  await writeVariants(entryId, variants, version, actorId, { name, op: "add", label: label.trim(), price });
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
  const { name, variants, version } = await readVariants(entryId);
  if (!variants[idx]) throw new Error("Формат не найден.");
  variants[idx] = { label: label.trim(), price };
  await writeVariants(entryId, variants, version, actorId, { name, op: "update", idx, label: label.trim(), price });
}

export async function deleteVariant(entryId: number, idx: number, actorId: number): Promise<void> {
  const { name, variants, version } = await readVariants(entryId);
  if (!variants[idx]) throw new Error("Формат не найден.");
  const [removed] = variants.splice(idx, 1);
  await writeVariants(entryId, variants, version, actorId, { name, op: "delete", removed });
}

/** Разбор строки «метка = цена» (например «0,5 кг = 1450»). */
export function parseVariant(text: string): { label: string; price: number } | null {
  const parts = text.split("=");
  if (parts.length !== 2) return null;
  const label = parts[0].trim();
  // Строгий паттерн как у parsePrice: только целые ≤ 7 цифр. Раньше Number()
  // принимал научную/hex-нотацию без предела («=1e9» → 1 млрд ₽) — аудит L11.
  const priceStr = parts[1].replace(/[\s,]/g, "");
  if (!label || !/^\d{1,7}$/.test(priceStr)) return null;
  return { label, price: Number(priceStr) };
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
  // Опаковый уникальный id (пользователь видит название, не id). Время + рандом-
  // суффикс: владелец и жена, добавив категорию в одну мс, иначе словили бы PK-конфликт (аудит L7).
  const id = "cat_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // Новая категория встаёт ПЕРЕД напитковым хвостом (напитки всегда в конце меню),
  // а не после него: иначе на сайте она оказалась бы после «Коллекции напитков».
  const ord = (await dbQuery(
    `SELECT COALESCE(MIN(sort_order), (SELECT COALESCE(MAX(sort_order)+1, 0) FROM chapters)) AS next
       FROM chapters WHERE id = ANY($1::text[])`,
    [[...FIXED_CHAPTERS]],
  )) as unknown as { next: number }[];
  const next = Number(ord[0].next);
  await dbQuery(`UPDATE chapters SET sort_order = sort_order + 1 WHERE sort_order >= $1`, [next]);
  await dbQuery(`INSERT INTO chapters (id, title, sort_order, layout) VALUES ($1,$2,$3,$4)`, [
    id,
    t,
    next,
    layout,
  ]);
  await audit(actorId, "add_chapter", null, { id, title: t, layout });
  return id;
}

// Разделы напитков: их порядок в хвосте меню фиксирован (сайт сливает их в одну
// секцию «Напитки»), перемещать их и вставлять после них — нельзя.
const FIXED_CHAPTERS = new Set(["soft", "tea", "beer"]);

/**
 * Переместить раздел: поставить после afterId (null = в самое начало).
 * Перенумерация всех разделов ОДНИМ атомарным UPDATE (unnest) — параллельная
 * правка второго админа не оставит дырок/дублей порядка.
 */
export async function moveChapterAfter(
  chapterId: string,
  afterId: string | null,
  actorId: number,
): Promise<{ title: string; afterTitle: string | null }> {
  if (chapterId === afterId) throw new Error("Раздел нельзя поставить после самого себя.");
  if (FIXED_CHAPTERS.has(chapterId)) throw new Error("Разделы напитков перемещать нельзя.");
  if (afterId && FIXED_CHAPTERS.has(afterId)) throw new Error("После напитков вставлять нельзя.");
  const rows = (await dbQuery(`SELECT id, title FROM chapters ORDER BY sort_order`)) as unknown as {
    id: string;
    title: string;
  }[];
  const moving = rows.find((r) => r.id === chapterId);
  if (!moving) throw new Error("Раздел не найден.");
  const after = afterId ? rows.find((r) => r.id === afterId) : null;
  if (afterId && !after) throw new Error("Целевой раздел не найден.");
  // Новый порядок: обычные главы без перемещаемой, вставка после цели (или в начало);
  // напитковые главы всегда остаются хвостом в своём текущем взаимном порядке.
  const normal = rows.filter((r) => r.id !== chapterId && !FIXED_CHAPTERS.has(r.id));
  const drinks = rows.filter((r) => r.id !== chapterId && FIXED_CHAPTERS.has(r.id));
  const at = afterId ? normal.findIndex((r) => r.id === afterId) + 1 : 0;
  normal.splice(at, 0, moving);
  const ids = [...normal, ...drinks].map((r) => r.id);
  await dbQuery(
    `UPDATE chapters c SET sort_order = v.ord - 1
       FROM (SELECT unnest($1::text[]) AS id, generate_subscripts($1::text[], 1) AS ord) v
      WHERE c.id = v.id`,
    [ids],
  );
  await audit(actorId, "chapter_move", null, { id: chapterId, title: moving.title, after: after?.title ?? "(в начало)" });
  return { title: moving.title, afterTitle: after?.title ?? null };
}

/**
 * Переместить позицию внутри её раздела: после afterEntryId (null = первой).
 * Та же атомарная перенумерация одним UPDATE.
 */
export async function moveEntryAfter(
  entryId: number,
  afterEntryId: number | null,
  actorId: number,
): Promise<{ name: string; afterName: string | null }> {
  if (entryId === afterEntryId) throw new Error("Позицию нельзя поставить после самой себя.");
  const cur = (await dbQuery(
    `SELECT chapter_id, name FROM entries WHERE id=$1 AND NOT is_deleted`,
    [entryId],
  )) as unknown as { chapter_id: string; name: string }[];
  if (!cur.length) throw new Error("Позиция не найдена.");
  const rows = (await dbQuery(
    `SELECT id, name FROM entries WHERE chapter_id=$1 AND NOT is_deleted ORDER BY sort_order`,
    [cur[0].chapter_id],
  )) as unknown as { id: number; name: string }[];
  const moving = rows.find((r) => r.id === entryId)!;
  const after = afterEntryId ? rows.find((r) => r.id === afterEntryId) : null;
  if (afterEntryId && !after) throw new Error("Целевая позиция не найдена (возможно, удалена).");
  const rest = rows.filter((r) => r.id !== entryId);
  const at = afterEntryId ? rest.findIndex((r) => r.id === afterEntryId) + 1 : 0;
  rest.splice(at, 0, moving);
  const ids = rest.map((r) => r.id);
  await dbQuery(
    `UPDATE entries e SET sort_order = v.ord - 1
       FROM (SELECT unnest($1::int[]) AS id, generate_subscripts($1::int[], 1) AS ord) v
      WHERE e.id = v.id`,
    [ids],
  );
  await audit(actorId, "entry_move", entryId, { name: moving.name, after: after?.name ?? "(первой)" });
  return { name: moving.name, afterName: after?.name ?? null };
}

/**
 * Удалить раздел. Разрешено только для ПУСТОГО раздела (без неудалённых блюд) —
 * чтобы Наталья не снесла полраздела случайно. Остатки «корзины» (soft-deleted
 * позиции) сносятся начисто вместе с разделом (фото уходят каскадом).
 */
export async function deleteChapter(chapterId: string, actorId: number): Promise<string> {
  if (FIXED_CHAPTERS.has(chapterId)) throw new Error("Разделы напитков удалять нельзя.");
  const ch = (await dbQuery(`SELECT title FROM chapters WHERE id=$1`, [chapterId])) as unknown as {
    title: string;
  }[];
  if (!ch.length) throw new Error("Раздел не найден.");
  const cnt = (await dbQuery(
    `SELECT count(*)::int AS n FROM entries WHERE chapter_id=$1 AND NOT is_deleted`,
    [chapterId],
  )) as unknown as { n: number }[];
  if (cnt[0].n > 0) {
    throw new Error(`В разделе ${cnt[0].n} блюд. Сначала удалите или перенесите их.`);
  }
  await dbQuery(`DELETE FROM entries WHERE chapter_id=$1`, [chapterId]);
  await dbQuery(`DELETE FROM chapters WHERE id=$1`, [chapterId]);
  await audit(actorId, "chapter_delete", null, { id: chapterId, title: ch[0].title });
  return ch[0].title;
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
