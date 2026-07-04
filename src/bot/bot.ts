// Telegram-бот админки меню The Raki. Один экземпляр обслуживает и webhook
// (прод, src/app/api/tg/route.ts), и long polling (dev, scripts/bot/dev.ts).
// Фаза 3: доступ по whitelist + read-only навигация глава→позиция→карточка.
// Операции правки — Фаза 4.
// NB: без `server-only` — гоняется CLI-раннерами (tsx); импортируется только
// серверным кодом (webhook route) и dev/simulate-скриптами.
import { Bot, InlineKeyboard, type Context } from "grammy";
import { listChapters, listEntries, getEntry, listDeleted } from "./menu-admin-db";
import {
  setHidden,
  setPrice,
  setText,
  setFlag,
  softDelete,
  restoreEntry,
} from "./menu-write-db";
import { getState, setState, clearState } from "./bot-state-db";

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

// --- Форматирование -----------------------------------------------------
const rub = (n: number) => n.toLocaleString("ru-RU") + " ₽";

/** Экран /menu: список глав с числом позиций и скрытых. */
export async function renderChapterList(): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const chapters = await listChapters();
  const kb = new InlineKeyboard();
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
  const entries = await listEntries(chapterId);
  const chapters = await listChapters();
  const ch = chapters.find((c) => c.id === chapterId);
  if (!ch) return null;
  const kb = new InlineKeyboard();
  for (const e of entries) {
    const mark = e.isHidden ? "⛔ " : "";
    kb.text(`${mark}${e.name} — ${rub(e.price)}`, `e:${e.id}`).row();
  }
  kb.text("◀️ К разделам", "menu");
  const text = `<b>${ch.title}</b>\nПозиций: ${ch.total}${ch.hidden ? ` · скрыто ${ch.hidden}` : ""}`;
  return { text, keyboard: kb };
}

/** Экран позиции: карточка с кнопками действий. */
export async function renderEntryCard(
  entryId: number,
): Promise<{ text: string; keyboard: InlineKeyboard } | null> {
  const e = await getEntry(entryId);
  if (!e) return null;
  const lines = [
    `${e.isHidden ? "⛔ <b>СКРЫТА (в стоп-листе)</b>\n" : ""}<b>${e.name}</b>`,
    ``,
    `💰 Цена: <b>${rub(e.price)}</b>${e.unit ? ` / ${e.unit}` : ""}`,
  ];
  if (e.variants.length) {
    lines.push(`📐 Форматы: ${e.variants.map((v) => `${v.label} — ${rub(v.price)}`).join(" · ")}`);
  }
  if (e.abv) lines.push(`🍺 Крепость: ${e.abv}`);
  lines.push(`🏷 Метки: ${e.signature ? "◆ фирменная " : ""}${e.spicy ? "🌶 острая" : ""}`.trimEnd());
  if (e.noteShort) lines.push(``, `<b>Кратко:</b> <i>${e.noteShort}</i>`);
  if (e.note) lines.push(``, `<b>Подробно:</b> <i>${e.note}</i>`);

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
    .text(e.signature ? "◆ убрать" : "◆ фирменная", `flag:${e.id}:signature`)
    .text(e.spicy ? "🌶 убрать" : "🌶 острая", `flag:${e.id}:spicy`)
    .row()
    .text("🗑 Удалить", `del:${e.id}`)
    .row()
    .text("◀️ Назад", `ch:${e.chapterId}`);
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

  // Единственный обработчик текста: если у пользователя открыт диалог — применяем.
  bot.on("message:text", async (ctx) => {
    const st = await getState(ctx.from!.id);
    if (!st || st.entryId == null) {
      return void ctx.reply("Не понял. /menu — открыть разделы меню.");
    }
    const value = ctx.message.text.trim();
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

/** Правит текущее сообщение (навигация «на месте»), с фолбэком на новое. */
async function editTo(ctx: Context, text: string, keyboard: InlineKeyboard) {
  try {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  }
}
