// Telegram-бот админки меню The Raki. Один экземпляр обслуживает и webhook
// (прод, src/app/api/tg/route.ts), и long polling (dev, scripts/bot/dev.ts).
// Фаза 3: доступ по whitelist + read-only навигация глава→позиция→карточка.
// Операции правки — Фаза 4.
// NB: без `server-only` — гоняется CLI-раннерами (tsx); импортируется только
// серверным кодом (webhook route) и dev/simulate-скриптами.
import { Bot, InlineKeyboard, type Context } from "grammy";
import { listChapters, listEntries, getEntry, listDeleted, getChapterMeta } from "./menu-admin-db";
import {
  setHidden,
  setPrice,
  setText,
  setFlag,
  softDelete,
  restoreEntry,
  addEntry,
  addVariant,
  updateVariant,
  deleteVariant,
  parseVariant,
} from "./menu-write-db";
import { getState, setState, clearState } from "./bot-state-db";
import {
  getBoard,
  setSizePrice,
  addRecipe,
  renameRecipe,
  setRecipeSurcharge,
  toggleRecipeSpicy,
  deleteRecipe,
} from "./raki-write-db";

// --- Доступ -------------------------------------------------------------
function adminIds(): Set<number> {
  return new Set(
    (process.env.TG_ADMIN_IDS ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0),
  );
}

export function isAdmin(userId: number | undefined): boolean {
  return userId != null && adminIds().has(userId);
}

// Разделы-напитки (soft/tea/beer): для них острота не показывается.
const DRINK_CHAPTERS = new Set(["soft", "tea", "beer"]);

// --- Форматирование -----------------------------------------------------
const rub = (n: number) => n.toLocaleString("ru-RU") + " ₽";

// Экранирование для parse_mode:"HTML". ОБЯЗАТЕЛЬНО для любых значений из БД/
// ввода владельца (название/описание/грамовка/метка формата/рецепт): символы
// < > & иначе ломают разбор entities → Telegram 400 → карточка не открывается.
// Кнопкам (InlineKeyboard.text) экранирование НЕ нужно — это не HTML.
const esc = (s: string | null | undefined): string =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Экран /menu: список глав с числом позиций и скрытых. */
export async function renderChapterList(): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const chapters = await listChapters();
  const kb = new InlineKeyboard();
  // Раки — отдельная структура (доска в boards), не в таблице chapters. Выводим вручную.
  kb.text("🦞 Раки (размеры + рецепты)", "raki").row();
  for (const c of chapters) {
    const mark = c.hidden > 0 ? ` · ${c.hidden} ⛔` : "";
    kb.text(`${c.title} · ${c.total}${mark}`, `ch:${c.id}`).row();
  }
  const totalHidden = chapters.reduce((n, c) => n + c.hidden, 0);
  const text =
    `🦞 <b>Меню The Raki</b>\nВыберите раздел, чтобы посмотреть позиции.` +
    (totalHidden > 0 ? `\n\n⛔ Сейчас скрыто позиций: <b>${totalHidden}</b>` : "");
  return { text, keyboard: kb };
}

/** Экран раздела: позиции (скрытые помечены ⛔). */
export async function renderEntryList(
  chapterId: string,
): Promise<{ text: string; keyboard: InlineKeyboard } | null> {
  // Один лёгкий запрос за названием + один за позициями (раньше был тяжёлый
  // агрегат listChapters ради одного title — лишнее обращение к БД по хрупкой сети).
  const entries = await listEntries(chapterId);
  const meta = await getChapterMeta(chapterId);
  if (!meta) return null;
  const hidden = entries.filter((e) => e.isHidden).length;
  const kb = new InlineKeyboard();
  for (const e of entries) {
    const mark = e.isHidden ? "⛔ " : "";
    kb.text(`${mark}${e.name} — ${rub(e.price)}`, `e:${e.id}`).row();
  }
  kb.text("➕ Добавить позицию", `addentry:${chapterId}`).row();
  kb.text("◀️ К разделам", "menu");
  const text = `<b>${esc(meta.title)}</b>\nПозиций: ${entries.length}${hidden ? ` · скрыто ${hidden}` : ""}`;
  return { text, keyboard: kb };
}

/** Экран позиции: карточка с кнопками действий. */
export async function renderEntryCard(
  entryId: number,
): Promise<{ text: string; keyboard: InlineKeyboard } | null> {
  const e = await getEntry(entryId);
  if (!e) return null;
  const lines = [
    `${e.isHidden ? "⛔ <b>СКРЫТА (в стоп-листе)</b>\n" : ""}<b>${esc(e.name)}</b>`,
    ``,
    `💰 Цена: <b>${rub(e.price)}</b>${e.unit ? ` / ${esc(e.unit)}` : ""}`,
  ];
  if (e.variants.length) {
    lines.push(`📐 Форматы: ${e.variants.map((v) => `${esc(v.label)} — ${rub(v.price)}`).join(" · ")}`);
  }
  if (e.abv) lines.push(`🍺 Крепость: ${esc(e.abv)}`);
  // Острота у напитков — бессмысленна (замечание владельца): не показываем ни в
  // тексте, ни кнопкой для разделов напитков.
  const isDrink = DRINK_CHAPTERS.has(e.chapterId);
  const marks = `${e.signature ? "◆ фирменная " : ""}${!isDrink && e.spicy ? "🌶 острая" : ""}`.trimEnd();
  lines.push(`🏷 Метки: ${marks || "—"}`);
  if (e.noteShort) lines.push(``, `<b>Кратко:</b> <i>${esc(e.noteShort)}</i>`);
  if (e.note) lines.push(``, `<b>Подробно:</b> <i>${esc(e.note)}</i>`);

  const kb = new InlineKeyboard()
    .text(e.isHidden ? "♻️ Вернуть в меню" : "🙈 Скрыть (стоп-лист)", `${e.isHidden ? "unhide" : "hide"}:${e.id}`)
    .row()
    .text("💰 Цена", `price:${e.id}`)
    .text("⚖️ Грамовка", `unit:${e.id}`)
    .row()
    .text("✏️ Название", `name:${e.id}`)
    .row()
    .text("📝 Кратко", `short:${e.id}`)
    .text("📄 Подробно", `full:${e.id}`)
    .row()
    .text(`📐 Форматы (${e.variants.length})`, `vars:${e.id}`)
    .row();
  // Метки: ◆ всегда; 🌶 — только для не-напитков.
  kb.text(e.signature ? "◆ убрать" : "◆ фирменная", `flag:${e.id}:signature`);
  if (!isDrink) kb.text(e.spicy ? "🌶 убрать" : "🌶 острая", `flag:${e.id}:spicy`);
  kb.row().text("🗑 Удалить", `del:${e.id}`).row().text("◀️ Назад", `ch:${e.chapterId}`);
  return { text: lines.join("\n"), keyboard: kb };
}

/** Экран доски раков: размеры (цены/кг) + способы приготовления. */
export async function renderRakiBoard(): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const b = await getBoard();
  const kb = new InlineKeyboard();
  const lines = ["🦞 <b>Раки</b>", "", "<b>Размеры</b> (цена за кг) — тап, чтобы изменить:"];
  for (const s of b.sizes) {
    lines.push(`  ${s.tier} · ${s.countPerKg} шт/кг · <b>${rub(s.price)}</b>`);
    kb.text(`${s.tier} — ${rub(s.price)}/кг`, `rsize:${s.tier}`);
    if (b.sizes.indexOf(s) % 2 === 1) kb.row();
  }
  kb.row();
  lines.push("", "<b>Способы и рецепты</b> — тап, чтобы редактировать:");
  for (const p of b.preparations) {
    lines.push(`  ${p.title}: ${p.recipes.length} рец.`);
    kb.text(`${p.title} (${p.recipes.length})`, `rprep:${p.id}`).row();
  }
  kb.text("◀️ К разделам", "menu");
  return { text: lines.join("\n"), keyboard: kb };
}

/** Экран рецептов одного способа (Отварные/Жареные). */
export async function renderRakiPrep(
  prepId: string,
): Promise<{ text: string; keyboard: InlineKeyboard } | null> {
  const b = await getBoard();
  const p = b.preparations.find((x) => x.id === prepId);
  if (!p) return null;
  const kb = new InlineKeyboard();
  const lines = [`🍳 <b>Раки ${esc(p.title.toLowerCase())}</b>`, "", "Рецепты — тап, чтобы редактировать:"];
  p.recipes.forEach((r, i) => {
    const marks = `${r.surcharge ? " " + esc(r.surcharge) : ""}${r.spicy ? " 🌶" : ""}`;
    lines.push(`  ${i + 1}. ${esc(r.name)}${marks}`);
    kb.text(`${i + 1}. ${r.name}`, `rrec:${prepId}:${i}`).row();
  });
  kb.text("➕ Добавить рецепт", `raddrec:${prepId}`).row();
  kb.text("◀️ К ракам", "raki");
  return { text: lines.join("\n"), keyboard: kb };
}

/** Экран одного рецепта: действия. */
export async function renderRakiRecipe(
  prepId: string,
  idx: number,
): Promise<{ text: string; keyboard: InlineKeyboard } | null> {
  const b = await getBoard();
  const p = b.preparations.find((x) => x.id === prepId);
  const r = p?.recipes[idx];
  if (!p || !r) return null;
  const lines = [
    `🍳 <b>${esc(r.name)}</b>`,
    `Способ: раки ${esc(p.title.toLowerCase())}`,
    `Надбавка: ${r.surcharge ? esc(r.surcharge) : "—"}`,
    `Острый: ${r.spicy ? "🌶 да" : "нет"}`,
  ];
  const kb = new InlineKeyboard()
    .text("✏️ Переименовать", `rrecname:${prepId}:${idx}`)
    .row()
    .text("💵 Надбавка", `rrecsur:${prepId}:${idx}`)
    .text(r.spicy ? "🌶 убрать" : "🌶 острый", `rrecspicy:${prepId}:${idx}`)
    .row()
    .text("🗑 Удалить рецепт", `rrecdel:${prepId}:${idx}`)
    .row()
    .text("◀️ Назад", `rprep:${prepId}`);
  return { text: lines.join("\n"), keyboard: kb };
}

/** Экран форматов подачи позиции (variants). */
export async function renderVariants(
  entryId: number,
): Promise<{ text: string; keyboard: InlineKeyboard } | null> {
  const e = await getEntry(entryId);
  if (!e) return null;
  const kb = new InlineKeyboard();
  const lines = [`📐 <b>Форматы подачи</b> — ${esc(e.name)}`, ""];
  if (e.variants.length) {
    e.variants.forEach((v, i) => {
      lines.push(`  ${i + 1}. ${esc(v.label)} — ${rub(v.price)}`);
      kb.text(`✏️ ${v.label}`, `varedit:${entryId}:${i}`).text("🗑", `vardel:${entryId}:${i}`).row();
    });
  } else {
    lines.push("<i>Форматов пока нет.</i>");
  }
  kb.text("➕ Добавить формат", `varadd:${entryId}`).row();
  kb.text("◀️ К позиции", `e:${entryId}`);
  return { text: lines.join("\n"), keyboard: kb };
}

// Подписи диалогов ввода: какое поле правим и как просим ввести.
const TEXT_PROMPTS: Record<string, { field: "name" | "unit" | "noteShort" | "note"; prompt: string; allowEmpty: boolean }> = {
  price: { field: "name", prompt: "", allowEmpty: false }, // price обрабатывается отдельно
  name: { field: "name", prompt: "✏️ Отправьте новое <b>название</b> позиции.", allowEmpty: false },
  unit: { field: "unit", prompt: "⚖️ Отправьте <b>грамовку</b> (напр. «180 г», «0,5 л», «кг»). «-» — убрать.", allowEmpty: true },
  short: { field: "noteShort", prompt: "📝 Отправьте <b>краткое описание</b> (одна строка для карточки). «-» — убрать.", allowEmpty: true },
  full: { field: "note", prompt: "📄 Отправьте <b>развёрнутое описание</b> (полный текст в детали). «-» — убрать.", allowEmpty: true },
};

export type BotOptions = {
  /** Вызывается после успешной правки — в проде дёргает revalidateTag('menu'). */
  onMenuChanged?: () => void | Promise<void>;
};

// --- Сборка бота --------------------------------------------------------
export function createBot(token: string, opts: BotOptions = {}): Bot {
  const bot = new Bot(token);
  const changed = async () => {
    try {
      await opts.onMenuChanged?.();
    } catch (e) {
      console.error("[bot] onMenuChanged упал:", e);
    }
  };

  // Whitelist: всё, кроме админов, вежливо отбиваем.
  bot.use(async (ctx, next) => {
    if (!isAdmin(ctx.from?.id)) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: "Доступ только для персонала." });
      else if (ctx.message) await ctx.reply("Этот бот управляет меню The Raki и доступен только персоналу.");
      return; // не передаём дальше
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    await clearState(ctx.from!.id);
    const { text, keyboard } = await renderChapterList();
    await ctx.reply(
      "Привет! Это бот управления меню The Raki.\nКоманда /menu — открыть разделы.\n\n" + text,
      { parse_mode: "HTML", reply_markup: keyboard },
    );
  });

  bot.command("menu", async (ctx) => {
    await clearState(ctx.from!.id);
    const { text, keyboard } = await renderChapterList();
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  });

  bot.command("cancel", async (ctx) => {
    const st = await getState(ctx.from!.id);
    await clearState(ctx.from!.id);
    if (st?.entryId) await showCard(ctx, st.entryId, "Отменено.");
    else await ctx.reply("Отменено. /menu — разделы.");
  });

  bot.callbackQuery("menu", async (ctx) => {
    const { text, keyboard } = await renderChapterList();
    await editTo(ctx, text, keyboard);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^ch:(.+)$/, async (ctx) => {
    const res = await renderEntryList(ctx.match![1]);
    if (!res) return void ctx.answerCallbackQuery({ text: "Раздел не найден." });
    await editTo(ctx, res.text, res.keyboard);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^e:(\d+)$/, async (ctx) => {
    const res = await renderEntryCard(Number(ctx.match![1]));
    if (!res) return void ctx.answerCallbackQuery({ text: "Позиция не найдена." });
    await editTo(ctx, res.text, res.keyboard);
    await ctx.answerCallbackQuery();
  });

  // --- Операции «в один тап» ---------------------------------------------
  bot.callbackQuery(/^(hide|unhide):(\d+)$/, async (ctx) => {
    const hide = ctx.match![1] === "hide";
    const id = Number(ctx.match![2]);
    try {
      await setHidden(id, hide, ctx.from!.id);
      await changed();
      await rerenderCard(ctx, id);
      await ctx.answerCallbackQuery({ text: hide ? "Скрыта — в стоп-листе." : "Возвращена в меню." });
    } catch (e) {
      await ctx.answerCallbackQuery({ text: errText(e) });
    }
  });

  bot.callbackQuery(/^flag:(\d+):(signature|spicy)$/, async (ctx) => {
    const id = Number(ctx.match![1]);
    const flag = ctx.match![2] as "signature" | "spicy";
    try {
      const cur = await getEntry(id);
      if (!cur) return void ctx.answerCallbackQuery({ text: "Позиция не найдена." });
      const next = flag === "signature" ? !cur.signature : !cur.spicy;
      await setFlag(id, flag, next, ctx.from!.id);
      await changed();
      await rerenderCard(ctx, id);
      await ctx.answerCallbackQuery({ text: "Метка обновлена." });
    } catch (e) {
      await ctx.answerCallbackQuery({ text: errText(e) });
    }
  });

  bot.callbackQuery(/^del:(\d+)$/, async (ctx) => {
    const id = Number(ctx.match![1]);
    const kb = new InlineKeyboard()
      .text("🗑 Да, удалить", `delyes:${id}`)
      .text("Отмена", `e:${id}`);
    await editTo(ctx, "Удалить позицию? Её можно будет восстановить командой /deleted.", kb);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^delyes:(\d+)$/, async (ctx) => {
    const id = Number(ctx.match![1]);
    try {
      const cur = await getEntry(id);
      await softDelete(id, ctx.from!.id);
      await changed();
      await ctx.answerCallbackQuery({ text: "Удалено." });
      if (cur) {
        const res = await renderEntryList(cur.chapterId);
        if (res) await editTo(ctx, res.text, res.keyboard);
      }
    } catch (e) {
      await ctx.answerCallbackQuery({ text: errText(e) });
    }
  });

  // Восстановление удалённых
  bot.command("deleted", async (ctx) => {
    const rows = await listDeleted();
    if (!rows.length) return void ctx.reply("Удалённых позиций нет.");
    const kb = new InlineKeyboard();
    for (const r of rows) kb.text(`♻️ ${r.name}`, `restore:${r.id}`).row();
    await ctx.reply("Удалённые позиции — тап, чтобы восстановить:", { reply_markup: kb });
  });

  bot.callbackQuery(/^restore:(\d+)$/, async (ctx) => {
    const id = Number(ctx.match![1]);
    try {
      await restoreEntry(id, ctx.from!.id);
      await changed();
      await ctx.answerCallbackQuery({ text: "Восстановлено." });
      await showCard(ctx, id, "♻️ Восстановлено.");
    } catch (e) {
      await ctx.answerCallbackQuery({ text: errText(e) });
    }
  });

  // --- Диалоги ввода: цена и текстовые поля ------------------------------
  bot.callbackQuery(/^(price|unit|name|short|full):(\d+)$/, async (ctx) => {
    const action = ctx.match![1];
    const id = Number(ctx.match![2]);
    await setState(ctx.from!.id, action, id);
    const kb = new InlineKeyboard().text("Отмена", `e:${id}`);
    const prompt =
      action === "price"
        ? "💰 Отправьте новую <b>цену</b> числом (например 2500)."
        : TEXT_PROMPTS[action].prompt;
    await editTo(ctx, prompt + "\n\nИли /cancel.", kb);
    await ctx.answerCallbackQuery();
  });

  // --- Раки: доска, размеры, рецепты ------------------------------------
  bot.callbackQuery("raki", async (ctx) => {
    const res = await renderRakiBoard();
    await editTo(ctx, res.text, res.keyboard);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^rsize:(.+)$/, async (ctx) => {
    const tier = ctx.match![1];
    await setState(ctx.from!.id, "rprice", null, { tier });
    const kb = new InlineKeyboard().text("Отмена", "raki");
    await editTo(ctx, `💰 Отправьте новую <b>цену за кг</b> для размера <b>${tier}</b> (число).\n\nИли /cancel.`, kb);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^rprep:(.+)$/, async (ctx) => {
    const res = await renderRakiPrep(ctx.match![1]);
    if (!res) return void ctx.answerCallbackQuery({ text: "Способ не найден." });
    await editTo(ctx, res.text, res.keyboard);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^rrec:(.+):(\d+)$/, async (ctx) => {
    const res = await renderRakiRecipe(ctx.match![1], Number(ctx.match![2]));
    if (!res) return void ctx.answerCallbackQuery({ text: "Рецепт не найден." });
    await editTo(ctx, res.text, res.keyboard);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^rrecspicy:(.+):(\d+)$/, async (ctx) => {
    const prepId = ctx.match![1];
    const idx = Number(ctx.match![2]);
    try {
      await toggleRecipeSpicy(prepId, idx, ctx.from!.id);
      await changed();
      const res = await renderRakiRecipe(prepId, idx);
      if (res) await editTo(ctx, res.text, res.keyboard);
      await ctx.answerCallbackQuery({ text: "Обновлено." });
    } catch (e) {
      await ctx.answerCallbackQuery({ text: errText(e) });
    }
  });

  bot.callbackQuery(/^rrecdel:(.+):(\d+)$/, async (ctx) => {
    const prepId = ctx.match![1];
    const idx = Number(ctx.match![2]);
    try {
      await deleteRecipe(prepId, idx, ctx.from!.id);
      await changed();
      const res = await renderRakiPrep(prepId);
      if (res) await editTo(ctx, res.text, res.keyboard);
      await ctx.answerCallbackQuery({ text: "Рецепт удалён." });
    } catch (e) {
      await ctx.answerCallbackQuery({ text: errText(e) });
    }
  });

  bot.callbackQuery(/^rrecname:(.+):(\d+)$/, async (ctx) => {
    const prepId = ctx.match![1];
    const idx = Number(ctx.match![2]);
    await setState(ctx.from!.id, "rrecname", null, { prepId, idx });
    const kb = new InlineKeyboard().text("Отмена", `rrec:${prepId}:${idx}`);
    await editTo(ctx, "✏️ Отправьте новое <b>название рецепта</b>.\n\nИли /cancel.", kb);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^rrecsur:(.+):(\d+)$/, async (ctx) => {
    const prepId = ctx.match![1];
    const idx = Number(ctx.match![2]);
    await setState(ctx.from!.id, "rrecsur", null, { prepId, idx });
    const kb = new InlineKeyboard().text("Отмена", `rrec:${prepId}:${idx}`);
    await editTo(ctx, "💵 Отправьте <b>надбавку</b> рецепта (например «+1 000 ₽»). «-» — убрать.\n\nИли /cancel.", kb);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^raddrec:(.+)$/, async (ctx) => {
    const prepId = ctx.match![1];
    await setState(ctx.from!.id, "raddrec", null, { prepId });
    const kb = new InlineKeyboard().text("Отмена", `rprep:${prepId}`);
    await editTo(ctx, "➕ Отправьте <b>название нового рецепта</b>.\n\nИли /cancel.", kb);
    await ctx.answerCallbackQuery();
  });

  // --- Форматы подачи (variants) ----------------------------------------
  bot.callbackQuery(/^vars:(\d+)$/, async (ctx) => {
    const res = await renderVariants(Number(ctx.match![1]));
    if (!res) return void ctx.answerCallbackQuery({ text: "Позиция не найдена." });
    await editTo(ctx, res.text, res.keyboard);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^varadd:(\d+)$/, async (ctx) => {
    const id = Number(ctx.match![1]);
    await setState(ctx.from!.id, "varadd", id);
    const kb = new InlineKeyboard().text("Отмена", `vars:${id}`);
    await editTo(ctx, "➕ Отправьте формат как <b>метка = цена</b>\nНапример: <code>0,5 кг = 1450</code>\n\nИли /cancel.", kb);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^varedit:(\d+):(\d+)$/, async (ctx) => {
    const id = Number(ctx.match![1]);
    const idx = Number(ctx.match![2]);
    await setState(ctx.from!.id, "varedit", id, { idx });
    const kb = new InlineKeyboard().text("Отмена", `vars:${id}`);
    await editTo(ctx, "✏️ Отправьте новый формат как <b>метка = цена</b> (например <code>0,5 кг = 1450</code>).\n\nИли /cancel.", kb);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^vardel:(\d+):(\d+)$/, async (ctx) => {
    const id = Number(ctx.match![1]);
    const idx = Number(ctx.match![2]);
    try {
      await deleteVariant(id, idx, ctx.from!.id);
      await changed();
      const res = await renderVariants(id);
      if (res) await editTo(ctx, res.text, res.keyboard);
      await ctx.answerCallbackQuery({ text: "Формат удалён." });
    } catch (e) {
      await ctx.answerCallbackQuery({ text: errText(e) });
    }
  });

  // --- Добавить позицию (2 шага: название → цена) ------------------------
  bot.callbackQuery(/^addentry:(.+)$/, async (ctx) => {
    const chapterId = ctx.match![1];
    await setState(ctx.from!.id, "addname", null, { chapterId });
    const kb = new InlineKeyboard().text("Отмена", `ch:${chapterId}`);
    await editTo(ctx, "➕ <b>Новая позиция.</b>\nШаг 1/2 — отправьте <b>название</b>.\n\nИли /cancel.", kb);
    await ctx.answerCallbackQuery();
  });

  // Единственный обработчик текста: если у пользователя открыт диалог — применяем.
  bot.on("message:text", async (ctx) => {
    const st = await getState(ctx.from!.id);
    if (!st) {
      return void ctx.reply("Не понял. /menu — открыть разделы меню.");
    }
    const value = ctx.message.text.trim();

    // Раки-диалоги (данные в payload, entryId=null) — обрабатываем отдельно.
    if (["rprice", "rrecname", "rrecsur", "raddrec"].includes(st.action)) {
      try {
        await applyRakiInput(ctx, st, value, changed);
      } catch (e) {
        await ctx.reply(errText(e) + " Попробуйте ещё раз или /cancel.");
      }
      return;
    }

    // Форматы подачи (variants) — entryId = позиция.
    if (st.action === "varadd" || st.action === "varedit") {
      try {
        await applyVariantInput(ctx, st, value, changed);
      } catch (e) {
        await ctx.reply(errText(e) + " Попробуйте ещё раз или /cancel.");
      }
      return;
    }

    // Добавление позиции (2 шага, payload) — entryId=null до создания.
    if (st.action === "addname" || st.action === "addprice") {
      try {
        await applyAddEntryInput(ctx, st, value, changed);
      } catch (e) {
        await ctx.reply(errText(e) + " Попробуйте ещё раз или /cancel.");
      }
      return;
    }

    if (st.entryId == null) {
      await clearState(ctx.from!.id);
      return void ctx.reply("Диалог сброшен. /menu.");
    }
    try {
      if (st.action === "price") {
        const price = Number(value.replace(/\s/g, "").replace(",", "."));
        if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) {
          return void ctx.reply("Нужно целое число, например 2500. Ещё раз или /cancel.");
        }
        await setPrice(st.entryId, price, ctx.from!.id);
      } else {
        const cfg = TEXT_PROMPTS[st.action];
        if (!cfg) {
          await clearState(ctx.from!.id);
          return void ctx.reply("Диалог сброшен. /menu.");
        }
        const v = value === "-" && cfg.allowEmpty ? null : value;
        if (v === "" || (v === null && !cfg.allowEmpty)) {
          return void ctx.reply("Пустое значение недопустимо. Ещё раз или /cancel.");
        }
        await setText(st.entryId, cfg.field, v, ctx.from!.id);
      }
      await clearState(ctx.from!.id);
      await changed();
      await showCard(ctx, st.entryId, "✓ Сохранено.");
    } catch (e) {
      await ctx.reply(errText(e) + " Попробуйте ещё раз или /cancel.");
    }
  });

  bot.catch((err) => {
    console.error("[bot] ошибка обработки апдейта:", err.error);
  });

  return bot;
}

/** Перерисовать карточку на месте (после one-tap правки). */
async function rerenderCard(ctx: Context, entryId: number) {
  const res = await renderEntryCard(entryId);
  if (res) await editTo(ctx, res.text, res.keyboard);
}

/** Показать карточку новым сообщением (после диалога/восстановления). */
async function showCard(ctx: Context, entryId: number, prefix?: string) {
  const res = await renderEntryCard(entryId);
  if (!res) return void ctx.reply((prefix ? prefix + " " : "") + "Позиция не найдена.");
  if (prefix) await ctx.reply(prefix);
  await ctx.reply(res.text, { parse_mode: "HTML", reply_markup: res.keyboard });
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : "Ошибка. Попробуйте ещё раз.";
}

/** Применить текстовый ввод раки-диалога (цена размера / рецепты). */
async function applyRakiInput(
  ctx: Context,
  st: { action: string; payload: Record<string, unknown> },
  value: string,
  changed: () => Promise<void>,
) {
  const uid = ctx.from!.id;
  const p = st.payload as { tier?: string; prepId?: string; idx?: number };
  const reply = (r: { text: string; keyboard: InlineKeyboard } | null, ok: string) => {
    void ctx.reply(ok);
    if (r) return ctx.reply(r.text, { parse_mode: "HTML", reply_markup: r.keyboard });
  };

  if (st.action === "rprice") {
    const price = Number(value.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) {
      return void ctx.reply("Нужно целое число, например 4900. Ещё раз или /cancel.");
    }
    await setSizePrice(p.tier!, price, uid);
    await clearState(uid);
    await changed();
    return void reply(await renderRakiBoard(), "✓ Цена размера обновлена.");
  }
  if (st.action === "raddrec") {
    await addRecipe(p.prepId!, value, uid);
    await clearState(uid);
    await changed();
    return void reply(await renderRakiPrep(p.prepId!), "✓ Рецепт добавлен.");
  }
  if (st.action === "rrecname") {
    await renameRecipe(p.prepId!, p.idx!, value, uid);
    await clearState(uid);
    await changed();
    return void reply(await renderRakiRecipe(p.prepId!, p.idx!), "✓ Переименовано.");
  }
  if (st.action === "rrecsur") {
    await setRecipeSurcharge(p.prepId!, p.idx!, value === "-" ? null : value, uid);
    await clearState(uid);
    await changed();
    return void reply(await renderRakiRecipe(p.prepId!, p.idx!), "✓ Надбавка обновлена.");
  }
}

type Dlg = { action: string; entryId: number | null; payload: Record<string, unknown> };

/** Применить ввод формата подачи (varadd/varedit). */
async function applyVariantInput(ctx: Context, st: Dlg, value: string, changed: () => Promise<void>) {
  const uid = ctx.from!.id;
  const parsed = parseVariant(value);
  if (!parsed) {
    return void ctx.reply("Формат: «метка = цена», например «0,5 кг = 1450». Ещё раз или /cancel.");
  }
  if (st.action === "varadd") await addVariant(st.entryId!, parsed.label, parsed.price, uid);
  else await updateVariant(st.entryId!, Number(st.payload.idx), parsed.label, parsed.price, uid);
  await clearState(uid);
  await changed();
  const res = await renderVariants(st.entryId!);
  await ctx.reply("✓ Форматы обновлены.");
  if (res) await ctx.reply(res.text, { parse_mode: "HTML", reply_markup: res.keyboard });
}

/** Применить ввод добавления позиции (addname → addprice → создать). */
async function applyAddEntryInput(ctx: Context, st: Dlg, value: string, changed: () => Promise<void>) {
  const uid = ctx.from!.id;
  const chapterId = String(st.payload.chapterId);
  if (st.action === "addname") {
    const name = value.trim();
    if (!name) return void ctx.reply("Название пустое. Ещё раз или /cancel.");
    await setState(uid, "addprice", null, { chapterId, name });
    return void ctx.reply(`Шаг 2/2 — отправьте <b>цену</b> числом для «${esc(name)}».\n\nИли /cancel.`, {
      parse_mode: "HTML",
    });
  }
  // addprice
  const price = Number(value.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) {
    return void ctx.reply("Нужно целое число, например 650. Ещё раз или /cancel.");
  }
  const id = await addEntry(chapterId, { name: String(st.payload.name), price }, uid);
  await clearState(uid);
  await changed();
  await ctx.reply("✓ Позиция добавлена. Заполните остальное кнопками:");
  await showCard(ctx, id);
}

/** Правит текущее сообщение (навигация «на месте»), с фолбэком на новое. */
async function editTo(ctx: Context, text: string, keyboard: InlineKeyboard) {
  try {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  }
}
