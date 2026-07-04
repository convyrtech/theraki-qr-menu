// Telegram-бот админки меню The Raki. Один экземпляр обслуживает и webhook
// (прод, src/app/api/tg/route.ts), и long polling (dev, scripts/bot/dev.ts).
// Фаза 3: доступ по whitelist + read-only навигация глава→позиция→карточка.
// Операции правки — Фаза 4.
// NB: без `server-only` — гоняется CLI-раннерами (tsx); импортируется только
// серверным кодом (webhook route) и dev/simulate-скриптами.
import { Bot, InlineKeyboard, type Context } from "grammy";
import { listChapters, listEntries, getEntry } from "./menu-admin-db";

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

/** Экран позиции: карточка. Фаза 3 — read-only (кнопки правки в Фазе 4). */
export async function renderEntryCard(
  entryId: number,
): Promise<{ text: string; keyboard: InlineKeyboard } | null> {
  const e = await getEntry(entryId);
  if (!e) return null;
  const lines = [
    `${e.isHidden ? "⛔ <b>СКРЫТА</b> · " : ""}<b>${e.name}</b>`,
    ``,
    `Цена: <b>${rub(e.price)}</b>${e.unit ? ` / ${e.unit}` : ""}`,
  ];
  if (e.variants.length) {
    lines.push(`Форматы: ${e.variants.map((v) => `${v.label} — ${rub(v.price)}`).join(" · ")}`);
  }
  if (e.abv) lines.push(`Крепость: ${e.abv}`);
  if (e.signature) lines.push(`◆ Фирменная`);
  if (e.spicy) lines.push(`🌶 Острая`);
  if (e.note) lines.push(``, `<i>${e.note}</i>`);
  const kb = new InlineKeyboard().text("◀️ Назад", `ch:${e.chapterId}`);
  return { text: lines.join("\n"), keyboard: kb };
}

// --- Сборка бота --------------------------------------------------------
export function createBot(token: string): Bot {
  const bot = new Bot(token);

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
    const { text, keyboard } = await renderChapterList();
    await ctx.reply(
      "Привет! Это бот управления меню The Raki.\nКоманда /menu — открыть разделы.\n\n" + text,
      { parse_mode: "HTML", reply_markup: keyboard },
    );
  });

  bot.command("menu", async (ctx) => {
    const { text, keyboard } = await renderChapterList();
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  });

  bot.callbackQuery("menu", async (ctx) => {
    const { text, keyboard } = await renderChapterList();
    await editTo(ctx, text, keyboard);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^ch:(.+)$/, async (ctx) => {
    const chapterId = ctx.match![1];
    const res = await renderEntryList(chapterId);
    if (!res) return void ctx.answerCallbackQuery({ text: "Раздел не найден." });
    await editTo(ctx, res.text, res.keyboard);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^e:(\d+)$/, async (ctx) => {
    const entryId = Number(ctx.match![1]);
    const res = await renderEntryCard(entryId);
    if (!res) return void ctx.answerCallbackQuery({ text: "Позиция не найдена." });
    await editTo(ctx, res.text, res.keyboard);
    await ctx.answerCallbackQuery();
  });

  bot.catch((err) => {
    console.error("[bot] ошибка обработки апдейта:", err.error);
  });

  return bot;
}

/** Правит текущее сообщение (навигация «на месте»), с фолбэком на новое. */
async function editTo(ctx: Context, text: string, keyboard: InlineKeyboard) {
  try {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  }
}
