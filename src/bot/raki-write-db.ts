// Правки доски раков (таблица boards, jsonb-документ). Раки — не MenuEntry:
// размеры S–XXL (цена/кг) + рецепты по способам (Отварные/Жареные).
// Мутации = read-modify-write документа + запись в audit_log. Ревалидацию
// вызывает хендлер бота через onMenuChanged.
import { dbQuery } from "./db";

const BOARD_ID = "raki-board";

export type RakiSize = { tier: string; countPerKg: string; price: number };
export type RakiRecipe = { name: string; surcharge?: string; extra?: number; spicy?: boolean };
export type RakiPrep = { id: string; title: string; recipesLabel: string; recipes: RakiRecipe[] };
export type RakiBoardData = {
  id: string;
  title: string;
  sizes: RakiSize[];
  preparations: RakiPrep[];
  footnotes: string[];
};


export async function getBoard(): Promise<RakiBoardData> {
  const rows = (await dbQuery(`SELECT data FROM boards WHERE id=$1`, [BOARD_ID])) as unknown as {
    data: RakiBoardData;
  }[];
  if (!rows.length) throw new Error("Доска раков не найдена (запусти seed).");
  return rows[0].data;
}

// Чтение для правки: помимо данных берём версию (updated_at) для оптимистичной
// блокировки — save применится, только если доску никто не изменил параллельно.
async function loadForEdit(): Promise<{ data: RakiBoardData; version: string }> {
  // updated_at::text — каноничная текстовая форма, точно сравнимая в WHERE
  // (timestamptz через драйвер сериализуется неоднозначно).
  const rows = (await dbQuery(`SELECT data, updated_at::text AS version FROM boards WHERE id=$1`, [
    BOARD_ID,
  ])) as unknown as { data: RakiBoardData; version: string }[];
  if (!rows.length) throw new Error("Доска раков не найдена (запусти seed).");
  return { data: rows[0].data, version: rows[0].version };
}

async function save(
  data: RakiBoardData,
  version: string,
  actorId: number,
  action: string,
  details: Record<string, unknown>,
) {
  const upd = (await dbQuery(
    `UPDATE boards SET data=$2::jsonb, updated_at=now() WHERE id=$1 AND updated_at::text=$3 RETURNING id`,
    [BOARD_ID, JSON.stringify(data), version],
  )) as unknown as { id: string }[];
  if (!upd.length) {
    throw new Error("Доску раков изменили параллельно — откройте «🦞 Раки» заново и повторите.");
  }
  await dbQuery(
    `INSERT INTO audit_log (actor_tg_id, action, entry_id, details) VALUES ($1,$2,NULL,$3::jsonb)`,
    [actorId, action, JSON.stringify(details)],
  );
}

/** Цена за кг для размера (tier: S/M/L/XL/XXL). */
export async function setSizePrice(tier: string, price: number, actorId: number): Promise<void> {
  if (!Number.isInteger(price) || price < 0) throw new Error("Цена — целое число ≥ 0.");
  const { data, version } = await loadForEdit();
  const s = data.sizes.find((x) => x.tier === tier);
  if (!s) throw new Error(`Размер «${tier}» не найден.`);
  const old = s.price;
  s.price = price;
  await save(data, version, actorId, "raki_price", { tier, old, new: price });
}

/** «шт/кг» размера (например «14–20») — сезонная величина, гость видит её в доске. */
export async function setSizeCount(tier: string, countPerKg: string, actorId: number): Promise<void> {
  const v = countPerKg.trim();
  if (!v || v.length > 12) throw new Error("Формат: короткая строка, например 14–20.");
  const { data, version } = await loadForEdit();
  const s = data.sizes.find((x) => x.tier === tier);
  if (!s) throw new Error(`Размер «${tier}» не найден.`);
  const old = s.countPerKg;
  s.countPerKg = v;
  await save(data, version, actorId, "raki_count", { tier, old, new: v });
}

function prep(data: RakiBoardData, prepId: string): RakiPrep {
  const p = data.preparations.find((x) => x.id === prepId);
  if (!p) throw new Error(`Способ «${prepId}» не найден.`);
  return p;
}

export async function addRecipe(prepId: string, name: string, actorId: number): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error("Название рецепта не может быть пустым.");
  const { data, version } = await loadForEdit();
  prep(data, prepId).recipes.push({ name: clean });
  await save(data, version, actorId, "raki_recipe_add", { prepId, name: clean });
}

export async function renameRecipe(
  prepId: string,
  idx: number,
  name: string,
  actorId: number,
): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error("Название рецепта не может быть пустым.");
  const { data, version } = await loadForEdit();
  const p = prep(data, prepId);
  if (!p.recipes[idx]) throw new Error("Рецепт не найден.");
  const old = p.recipes[idx].name;
  p.recipes[idx].name = clean;
  await save(data, version, actorId, "raki_recipe_rename", { prepId, idx, old, new: clean });
}

/** Надбавка рецепта: строка вроде «+1 000 ₽» или null (убрать). */
export async function setRecipeSurcharge(
  prepId: string,
  idx: number,
  surcharge: string | null,
  actorId: number,
): Promise<void> {
  const { data, version } = await loadForEdit();
  const p = prep(data, prepId);
  if (!p.recipes[idx]) throw new Error("Рецепт не найден.");
  const old = p.recipes[idx].surcharge ?? null;
  if (surcharge) {
    // Храним и строку-ярлык, и ЧИСЛО extra (его читает витрина). Парсим ПЕРВУЮ
    // группу цифр; нет числа → понятная ошибка, а не тихая надбавка 0 ₽ (аудит M1).
    const trimmed = surcharge.trim();
    const m = trimmed.replace(/\s/g, "").match(/\d+/);
    const n = m ? Number(m[0]) : NaN;
    if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) {
      throw new Error("Не вижу сумму надбавки. Укажите числом, например: +1 000 ₽ (от 1 до 1 000 000).");
    }
    p.recipes[idx].surcharge = trimmed;
    p.recipes[idx].extra = n;
  } else {
    delete p.recipes[idx].surcharge;
    delete p.recipes[idx].extra;
  }
  await save(data, version, actorId, "raki_recipe_surcharge", { prepId, idx, old, new: surcharge });
}

export async function toggleRecipeSpicy(prepId: string, idx: number, actorId: number): Promise<boolean> {
  const { data, version } = await loadForEdit();
  const p = prep(data, prepId);
  if (!p.recipes[idx]) throw new Error("Рецепт не найден.");
  const next = !p.recipes[idx].spicy;
  if (next) p.recipes[idx].spicy = true;
  else delete p.recipes[idx].spicy;
  await save(data, version, actorId, "raki_recipe_spicy", { prepId, idx, new: next });
  return next;
}

export async function deleteRecipe(prepId: string, idx: number, actorId: number): Promise<void> {
  const { data, version } = await loadForEdit();
  const p = prep(data, prepId);
  if (!p.recipes[idx]) throw new Error("Рецепт не найден.");
  const [removed] = p.recipes.splice(idx, 1);
  await save(data, version, actorId, "raki_recipe_delete", { prepId, idx, name: removed.name });
}
