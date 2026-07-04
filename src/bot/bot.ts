// Telegram-бот админки меню The Raki. Один экземпляр обслуживает и webhook
// (прод, src/app/api/tg/route.ts), и long polling (dev, scripts/bot/dev.ts).
// Фаза 3: доступ по whitelist + read-only навигация глава→позиция→карточка.
// Операции правки — Фаза 4.
// NB: без `server-only` — гоняется CLI-раннерами (tsx); импортируется только
// серверным кодом (webhook route) и dev/simulate-скриптами.
import { Bot, InlineKeyboard, InputFile, type Context } from "grammy";
import sharp from "sharp";
import { savePhotoBytes, deletePhotoBytes } from "./photo-db";
import { firstSentence } from "@/lib/text";
import { listChapters, listEntries, getEntry, listDeleted, getChapterMeta, exportAll } from "./menu-admin-db";
import {
  setHidden,
  setPrice,
  setText,
  setPhoto,
  setFlag,
  softDelete,
  restoreEntry,
  addEntry,
  addChapter,
  addVariant,
  updateVariant,
  deleteVariant,
  parseVariant,
} from "./menu-write-db";
import { getState, setState, clearState, claimUpdate } from "./bot-state-db";
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

// Инструкция в самом боте (кнопка «❓ Инструкция» и команда /help).
// Только статический текст — валидный HTML, без данных из БД.
const HELP_TEXT = [
  "📖 <b>Как пользоваться ботом</b>",
  "",
  "Здесь вы меняете меню, которое гости видят по QR на столах. Правки выходят на сайт сами за несколько секунд.",
  "",
  "<b>Разделы</b>",
  "• /menu — список всех разделов.",
  "• «➕ Добавить категорию» — пишете название и выбираете вид на сайте: 🖼 карточки с фото или 📋 простой список.",
  "",
  "<b>Блюдо</b> (нажать раздел → блюдо):",
  "• 🙈 Скрыть / ♻️ Вернуть — стоп-лист (закончилось / снова есть). Скрытое помечено ⛔ и гостям не видно.",
  "• 💰 Цена · ⚖️ Грамовка · ✏️ Название",
  "• 📝 Кратко (строка на карточке) · 📄 Подробно (полный текст по нажатию гостя)",
  "• 📐 Форматы — доп. подача, пишется «метка = цена», например 0,5 кг = 1450",
  "• ◆ Фирменная · 🌶 Острая — метки-значки",
  "• 🖼 Фото — пришлите фото прямо в чат (можно как файл). Бот сам сожмёт его для сайта. «-» убирает фото.",
  "• 🗑 Удалить (с переспросом). Вернуть удалённое — команда /deleted",
  "• «➕ Добавить позицию» — название → цена → дальше дозаполняете кнопками.",
  "",
  "<b>Раки</b> (кнопка 🦞): цены по размерам S–XXL и рецепты (отварные/жареные).",
  "",
  "<b>Ещё</b>",
  "• /export — прислать бэкап всего меню файлом.",
  "• /cancel — отменить начатый ввод.",
].join("\n");

// --- Форматирование -----------------------------------------------------
const rub = (n: number) => n.toLocaleString("ru-RU") + " ₽";

// Экранирование для parse_mode:"HTML". ОБЯЗАТЕЛЬНО для любых значений из БД/
// ввода владельца (название/описание/грамовка/метка формата/рецепт): символы
// < > & иначе ломают разбор entities → Telegram 400 → карточка не открывается.
// Кнопкам (InlineKeyboard.text) экранирование НЕ нужно — это не HTML.
const esc = (s: string | null | undefined): string =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Обрезка длинного текста для показа в карточке: очень длинное описание иначе
// может перевалить лимит сообщения Telegram (4096) → карточка не откроется.
// В БД и на сайте текст остаётся полным.
const trunc = (s: string, n = 500): string => (s.length > n ? s.slice(0, n) + "…" : s);

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
  kb.text("➕ Добавить категорию", "addchapter").row();
  kb.text("❓ Инструкция", "help").row();
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
  lines.push(`🖼 Фото: ${e.photo ? "есть" : "нет"}`);
  if (e.noteShort) lines.push(``, `<b>Кратко:</b> <i>${esc(trunc(e.noteShort))}</i>`);
  if (e.note) lines.push(``, `<b>Подробно:</b> <i>${esc(trunc(e.note))}</i>`);

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
    .row()
    .text(e.photo ? "🖼 Заменить фото" : "🖼 Добавить фото", `photo:${e.id}`)
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

  // Идемпотентность (первым): дубль-доставку того же апдейта пропускаем, чтобы
  // повтор не создал вторую позицию/рецепт. При сбое дедупа — обрабатываем
  // (fail-open: доступность важнее редкого дубля).
  bot.use(async (ctx, next) => {
    const uid = ctx.update.update_id;
    try {
      if (!(await claimUpdate(uid))) return; // уже обработан — молча выходим
    } catch (e) {
      console.error("[bot] dedup не сработал, обрабатываем как есть:", e);
    }
    await next();
  });

  // Whitelist: всё, кроме админов, вежливо отбиваем.
  bot.use(async (ctx, next) => {
    if (!isAdmin(ctx.from?.id)) {
      if (ctx.callbackQuery) await ack(ctx, { text: "Доступ только для персонала." });
      else if (ctx.message) await ctx.reply("Этот бот управляет меню The Raki и доступен только персоналу.");
      return; // не передаём дальше
    }
    await next();
  });

  // Навигация сбрасывает незавершённый диалог ввода: тап по экрану-списку/карточке
  // означает «я перешёл к другому», иначе следующее введённое число/текст молча
  // ушло бы в позицию, где диалог был открыт. Action-кнопки (правки) сюда не входят.
  bot.on("callback_query:data", async (ctx, next) => {
    if (/^(menu|raki|help|ch:|e:|vars:|rprep:|rrec:)/.test(ctx.callbackQuery.data)) {
      await clearState(ctx.from!.id);
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    await clearState(ctx.from!.id);
    const { text, keyboard } = await renderChapterList();
    await ctx.reply(
      "Привет! Это бот управления меню The Raki.\nКоманда /menu — открыть разделы, /help — инструкция.\n\n" +
        text,
      { parse_mode: "HTML", reply_markup: keyboard },
    );
  });

  bot.command("menu", async (ctx) => {
    await clearState(ctx.from!.id);
    const { text, keyboard } = await renderChapterList();
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(HELP_TEXT, { parse_mode: "HTML" });
  });

  bot.callbackQuery("help", async (ctx) => {
    const kb = new InlineKeyboard().text("◀️ К разделам", "menu");
    await editTo(ctx, HELP_TEXT, kb);
    await ack(ctx);
  });

  bot.command("export", async (ctx) => {
    try {
      const data = await exportAll();
      const json = JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2);
      const stamp = new Date().toISOString().slice(0, 10);
      await ctx.replyWithDocument(new InputFile(Buffer.from(json, "utf8"), `menu-backup-${stamp}.json`), {
        caption: "Бэкап меню (все категории, позиции, доска раков).",
      });
    } catch (e) {
      await ctx.reply("Не удалось сделать бэкап: " + errText(e));
    }
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
    await ack(ctx);
  });

  bot.callbackQuery(/^ch:(.+)$/, async (ctx) => {
    const res = await renderEntryList(ctx.match![1]);
    if (!res) return void ack(ctx, { text: "Раздел не найден." });
    await editTo(ctx, res.text, res.keyboard);
    await ack(ctx);
  });

  bot.callbackQuery(/^e:(\d+)$/, async (ctx) => {
    const res = await renderEntryCard(Number(ctx.match![1]));
    if (!res) return void ack(ctx, { text: "Позиция не найдена." });
    await editTo(ctx, res.text, res.keyboard);
    await ack(ctx);
  });

  // --- Операции «в один тап» ---------------------------------------------
  bot.callbackQuery(/^(hide|unhide):(\d+)$/, async (ctx) => {
    const hide = ctx.match![1] === "hide";
    const id = Number(ctx.match![2]);
    try {
      await setHidden(id, hide, ctx.from!.id);
      await changed();
      await rerenderCard(ctx, id);
      await ack(ctx, { text: hide ? "Скрыта — в стоп-листе." : "Возвращена в меню." });
    } catch (e) {
      await ack(ctx, { text: errText(e) });
    }
  });

  bot.callbackQuery(/^flag:(\d+):(signature|spicy)$/, async (ctx) => {
    const id = Number(ctx.match![1]);
    const flag = ctx.match![2] as "signature" | "spicy";
    try {
      const cur = await getEntry(id);
      if (!cur) return void ack(ctx, { text: "Позиция не найдена." });
      const next = flag === "signature" ? !cur.signature : !cur.spicy;
      await setFlag(id, flag, next, ctx.from!.id);
      await changed();
      await rerenderCard(ctx, id);
      await ack(ctx, { text: "Метка обновлена." });
    } catch (e) {
      await ack(ctx, { text: errText(e) });
    }
  });

  bot.callbackQuery(/^del:(\d+)$/, async (ctx) => {
    const id = Number(ctx.match![1]);
    const kb = new InlineKeyboard()
      .text("🗑 Да, удалить", `delyes:${id}`)
      .text("Отмена", `e:${id}`);
    await editTo(ctx, "Удалить позицию? Её можно будет восстановить командой /deleted.", kb);
    await ack(ctx);
  });

  bot.callbackQuery(/^delyes:(\d+)$/, async (ctx) => {
    const id = Number(ctx.match![1]);
    try {
      const cur = await getEntry(id);
      await softDelete(id, ctx.from!.id);
      await changed();
      await ack(ctx, { text: "Удалено." });
      if (cur) {
        const res = await renderEntryList(cur.chapterId);
        if (res) await editTo(ctx, res.text, res.keyboard);
      }
    } catch (e) {
      await ack(ctx, { text: errText(e) });
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
      await ack(ctx, { text: "Восстановлено." });
      await showCard(ctx, id, "♻️ Восстановлено.");
    } catch (e) {
      await ack(ctx, { text: errText(e) });
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
    await ack(ctx);
  });

  // --- Раки: доска, размеры, рецепты ------------------------------------
  bot.callbackQuery("raki", async (ctx) => {
    const res = await renderRakiBoard();
    await editTo(ctx, res.text, res.keyboard);
    await ack(ctx);
  });

  bot.callbackQuery(/^rsize:(.+)$/, async (ctx) => {
    const tier = ctx.match![1];
    await setState(ctx.from!.id, "rprice", null, { tier });
    const kb = new InlineKeyboard().text("Отмена", "raki");
    await editTo(ctx, `💰 Отправьте новую <b>цену за кг</b> для размера <b>${tier}</b> (число).\n\nИли /cancel.`, kb);
    await ack(ctx);
  });

  bot.callbackQuery(/^rprep:(.+)$/, async (ctx) => {
    const res = await renderRakiPrep(ctx.match![1]);
    if (!res) return void ack(ctx, { text: "Способ не найден." });
    await editTo(ctx, res.text, res.keyboard);
    await ack(ctx);
  });

  bot.callbackQuery(/^rrec:(.+):(\d+)$/, async (ctx) => {
    const res = await renderRakiRecipe(ctx.match![1], Number(ctx.match![2]));
    if (!res) return void ack(ctx, { text: "Рецепт не найден." });
    await editTo(ctx, res.text, res.keyboard);
    await ack(ctx);
  });

  bot.callbackQuery(/^rrecspicy:(.+):(\d+)$/, async (ctx) => {
    const prepId = ctx.match![1];
    const idx = Number(ctx.match![2]);
    try {
      await toggleRecipeSpicy(prepId, idx, ctx.from!.id);
      await changed();
      const res = await renderRakiRecipe(prepId, idx);
      if (res) await editTo(ctx, res.text, res.keyboard);
      await ack(ctx, { text: "Обновлено." });
    } catch (e) {
      await ack(ctx, { text: errText(e) });
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
      await ack(ctx, { text: "Рецепт удалён." });
    } catch (e) {
      await ack(ctx, { text: errText(e) });
    }
  });

  bot.callbackQuery(/^rrecname:(.+):(\d+)$/, async (ctx) => {
    const prepId = ctx.match![1];
    const idx = Number(ctx.match![2]);
    const rec = (await getBoard()).preparations.find((p) => p.id === prepId)?.recipes[idx];
    if (!rec) return void ack(ctx, { text: "Рецепт не найден (обновите экран)." });
    await setState(ctx.from!.id, "rrecname", null, { prepId, idx });
    const kb = new InlineKeyboard().text("Отмена", `rrec:${prepId}:${idx}`);
    await editTo(ctx, `✏️ Новое <b>название</b> для рецепта «${esc(rec.name)}».\n\nИли /cancel.`, kb);
    await ack(ctx);
  });

  bot.callbackQuery(/^rrecsur:(.+):(\d+)$/, async (ctx) => {
    const prepId = ctx.match![1];
    const idx = Number(ctx.match![2]);
    const rec = (await getBoard()).preparations.find((p) => p.id === prepId)?.recipes[idx];
    if (!rec) return void ack(ctx, { text: "Рецепт не найден (обновите экран)." });
    await setState(ctx.from!.id, "rrecsur", null, { prepId, idx });
    const kb = new InlineKeyboard().text("Отмена", `rrec:${prepId}:${idx}`);
    await editTo(ctx, `💵 <b>Надбавка</b> для рецепта «${esc(rec.name)}» (например «+1 000 ₽»). «-» — убрать.\n\nИли /cancel.`, kb);
    await ack(ctx);
  });

  bot.callbackQuery(/^raddrec:(.+)$/, async (ctx) => {
    const prepId = ctx.match![1];
    await setState(ctx.from!.id, "raddrec", null, { prepId });
    const kb = new InlineKeyboard().text("Отмена", `rprep:${prepId}`);
    await editTo(ctx, "➕ Отправьте <b>название нового рецепта</b>.\n\nИли /cancel.", kb);
    await ack(ctx);
  });

  // --- Фото по ссылке ----------------------------------------------------
  bot.callbackQuery(/^photo:(\d+)$/, async (ctx) => {
    const id = Number(ctx.match![1]);
    await setState(ctx.from!.id, "photo", id);
    const kb = new InlineKeyboard().text("Отмена", `e:${id}`);
    await editTo(
      ctx,
      "🖼 Пришлите <b>фото</b> блюда прямо сюда (можно как файл — качество лучше).\n" +
        "Бот сам сожмёт его для сайта. Чтобы <b>убрать</b> фото — отправьте «-».\n\nИли /cancel.",
      kb,
    );
    await ack(ctx);
  });

  // --- Форматы подачи (variants) ----------------------------------------
  bot.callbackQuery(/^vars:(\d+)$/, async (ctx) => {
    const res = await renderVariants(Number(ctx.match![1]));
    if (!res) return void ack(ctx, { text: "Позиция не найдена." });
    await editTo(ctx, res.text, res.keyboard);
    await ack(ctx);
  });

  bot.callbackQuery(/^varadd:(\d+)$/, async (ctx) => {
    const id = Number(ctx.match![1]);
    await setState(ctx.from!.id, "varadd", id);
    const kb = new InlineKeyboard().text("Отмена", `vars:${id}`);
    await editTo(ctx, "➕ Отправьте формат как <b>метка = цена</b>\nНапример: <code>0,5 кг = 1450</code>\n\nИли /cancel.", kb);
    await ack(ctx);
  });

  bot.callbackQuery(/^varedit:(\d+):(\d+)$/, async (ctx) => {
    const id = Number(ctx.match![1]);
    const idx = Number(ctx.match![2]);
    const v = (await getEntry(id))?.variants[idx];
    if (!v) return void ack(ctx, { text: "Формат не найден (обновите экран)." });
    await setState(ctx.from!.id, "varedit", id, { idx });
    const kb = new InlineKeyboard().text("Отмена", `vars:${id}`);
    await editTo(
      ctx,
      `✏️ Меняем формат «${esc(v.label)} — ${rub(v.price)}». Отправьте новый как <b>метка = цена</b> (например <code>0,5 кг = 1450</code>).\n\nИли /cancel.`,
      kb,
    );
    await ack(ctx);
  });

  bot.callbackQuery(/^vardel:(\d+):(\d+)$/, async (ctx) => {
    const id = Number(ctx.match![1]);
    const idx = Number(ctx.match![2]);
    try {
      await deleteVariant(id, idx, ctx.from!.id);
      await changed();
      const res = await renderVariants(id);
      if (res) await editTo(ctx, res.text, res.keyboard);
      await ack(ctx, { text: "Формат удалён." });
    } catch (e) {
      await ack(ctx, { text: errText(e) });
    }
  });

  // --- Добавить категорию (название → выбор стиля) -----------------------
  bot.callbackQuery("addchapter", async (ctx) => {
    await setState(ctx.from!.id, "addcatname", null);
    const kb = new InlineKeyboard().text("Отмена", "menu");
    await editTo(ctx, "➕ <b>Новая категория.</b>\nОтправьте <b>название</b>.\n\nИли /cancel.", kb);
    await ack(ctx);
  });

  bot.callbackQuery(/^addcatgo:(cards|list)$/, async (ctx) => {
    const layout = ctx.match![1] as "cards" | "list";
    const st = await getState(ctx.from!.id);
    if (st?.action !== "addcatlayout" || !st.payload.name) {
      return void ack(ctx, { text: "Диалог устарел, начните заново." });
    }
    try {
      const id = await addChapter(String(st.payload.name), layout, ctx.from!.id);
      await clearState(ctx.from!.id);
      await changed();
      await ack(ctx, { text: "Категория создана." });
      const res = await renderEntryList(id);
      if (res) await editTo(ctx, "✓ Категория создана. Добавьте позиции:\n\n" + res.text, res.keyboard);
    } catch (e) {
      await ack(ctx, { text: errText(e) });
    }
  });

  // --- Добавить позицию (2 шага: название → цена) ------------------------
  bot.callbackQuery(/^addentry:(.+)$/, async (ctx) => {
    const chapterId = ctx.match![1];
    await setState(ctx.from!.id, "addname", null, { chapterId });
    const kb = new InlineKeyboard().text("Отмена", `ch:${chapterId}`);
    await editTo(
      ctx,
      "➕ <b>Новая позиция.</b>\nШаг 1/5 — отправьте <b>название</b>.\n" +
        "(дальше: цена, грамовка, описание, фото — необязательное можно пропустить)\n\nИли /cancel.",
      kb,
    );
    await ack(ctx);
  });

  // «⏭ Пропустить» шаг мастера: продвигаем на следующий шаг по текущему действию.
  bot.callbackQuery("addskip", async (ctx) => {
    const st = await getState(ctx.from!.id);
    if (!st || st.entryId == null) return void ack(ctx, { text: "Мастер уже завершён." });
    const eid = st.entryId;
    await ack(ctx);
    if (st.action === "addunit") {
      await setState(ctx.from!.id, "adddesc", eid, {});
      return void askWiz(ctx, "adddesc", eid);
    }
    if (st.action === "adddesc") {
      await setState(ctx.from!.id, "addphoto", eid, {});
      return void askWiz(ctx, "addphoto", eid);
    }
    // addphoto — последний шаг: завершаем, показываем карточку.
    await clearState(ctx.from!.id);
    await showCard(ctx, eid, "✓ Позиция добавлена.");
  });

  // Приём фото/файла: работает, когда открыт диалог «🖼 Фото». Бот скачивает,
  // сжимает в WebP и кладёт в БД; entry.photo = внутренний версионированный URL.
  bot.on(["message:photo", "message:document"], async (ctx) => {
    const st = await getState(ctx.from!.id);
    const isPhotoStep = st?.action === "photo" || st?.action === "addphoto";
    if (!isPhotoStep || st!.entryId == null) {
      return void ctx.reply("Чтобы поставить фото — откройте блюдо → «🖼 Фото», затем пришлите картинку.");
    }
    const eid = st!.entryId;
    const wizard = st!.action === "addphoto"; // фото-шаг мастера добавления
    try {
      await ctx.reply("Загружаю фото…");
      await applyPhotoUpload(ctx, eid);
      await clearState(ctx.from!.id);
      await changed();
      await showCard(ctx, eid, wizard ? "✓ Позиция добавлена (с фото)." : "✓ Фото обновлено.");
    } catch (e) {
      await ctx.reply(
        "Не получилось: " + errText(e) + "\nПришлите картинку ещё раз" + (wizard ? " или «⏭ Пропустить»." : " или /cancel."),
      );
    }
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

    // Название новой категории → предложить выбор стиля кнопками.
    if (st.action === "addcatname") {
      const name = value.trim();
      if (!name) return void ctx.reply("Название пустое. Ещё раз или /cancel.");
      await setState(ctx.from!.id, "addcatlayout", null, { name });
      const kb = new InlineKeyboard()
        .text("🖼 Карточки с фото", "addcatgo:cards")
        .text("📋 Простой список", "addcatgo:list")
        .row()
        .text("Отмена", "menu");
      return void ctx.reply(`Категория «${esc(name)}». Как показывать на сайте?`, {
        parse_mode: "HTML",
        reply_markup: kb,
      });
    }

    // Мастер добавления позиции (название→цена→грамовка→описание→фото).
    if (["addname", "addprice", "addunit", "adddesc", "addphoto"].includes(st.action)) {
      try {
        await applyAddWizard(ctx, st, value, changed);
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
        const price = parsePrice(value);
        if (price == null) {
          return void ctx.reply("Нужно целое число, например 2500. Ещё раз или /cancel.");
        }
        await setPrice(st.entryId, price, ctx.from!.id);
      } else if (st.action === "photo") {
        // Текстом: «-» убирает фото, либо внешняя https-ссылка.
        // ВАЖНО: сначала setPhoto (он ВАЛИДИРУЕТ и бросает на кривом вводе,
        // например http:// вместо https://), и ТОЛЬКО при успехе чистим старые
        // байты. Иначе кривая ссылка стёрла бы фото и оставила 404 на сайте.
        const url = value === "-" ? null : value;
        await setPhoto(st.entryId, url, ctx.from!.id);
        await deletePhotoBytes(st.entryId);
        // Превью: показываем присланное фото, чтобы владелец видел, что ссылка
        // рабочая (не вставлял вслепую). Если Telegram не загрузил — предупреждаем.
        if (url) {
          try {
            await ctx.replyWithPhoto(url, { caption: "Так фото будет на сайте." });
          } catch {
            await ctx.reply(
              "⚠️ Превью не загрузилось. Проверьте, что ссылка открывает саму картинку в браузере — иначе на сайте она тоже не покажется.",
            );
          }
        }
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
    const price = parsePrice(value);
    if (price == null) {
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

/** Скачать присланное фото/файл, сжать в WebP, сохранить в БД, привязать к позиции. */
async function applyPhotoUpload(ctx: Context, entryId: number) {
  const token = process.env.TG_BOT_TOKEN;
  if (!token) throw new Error("нет токена бота.");
  const file = await ctx.getFile(); // работает и для photo, и для document
  if (!file.file_path) throw new Error("не удалось получить файл.");
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  if (!res.ok) throw new Error("не удалось скачать файл из Telegram.");
  const input = Buffer.from(await res.arrayBuffer());
  // rotate() — учесть EXIF-ориентацию телефона; ресайз до 1000px; WebP q80.
  const webp = await sharp(input)
    .rotate()
    .resize({ width: 1000, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  await savePhotoBytes(entryId, webp);
  // Версионируем URL (?v=…), чтобы новая картинка не бралась из кэша по старому.
  await setPhoto(entryId, `/api/photo/${entryId}/?v=${Date.now()}`, ctx.from!.id);
}

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

// Парсинг цены: только цифры (пробелы игнорируем), 0…9 999 999. Отвергает
// «1e9», «0x10», дробные, отрицательные, мусор. null — невалидно.
function parsePrice(value: string): number | null {
  const cleaned = value.replace(/\s/g, "");
  if (!/^\d{1,7}$/.test(cleaned)) return null;
  return Number(cleaned);
}

// Мастер добавления позиции. Обязательны название+цена; грамовка/описание/фото —
// со «Пропустить». Клавиатура шага и подсказки:
const WIZ_PROMPT: Record<string, string> = {
  addunit: "Шаг 3/5 — <b>грамовка</b> (например «180 г», «0,5 л», «кг»). Или пропустите.",
  adddesc: "Шаг 4/5 — <b>описание</b> блюда одним текстом (короткое для карточки бот возьмёт из первой фразы). Или пропустите.",
  addphoto: "Шаг 5/5 — пришлите <b>фото</b> блюда (можно файлом). Или пропустите.",
};
function wizKb(entryId: number): InlineKeyboard {
  return new InlineKeyboard().text("⏭ Пропустить", "addskip").row().text("Отмена", `e:${entryId}`);
}
async function askWiz(ctx: Context, step: keyof typeof WIZ_PROMPT | string, entryId: number) {
  await ctx.reply(WIZ_PROMPT[step] + "\n\n/cancel — отменить.", {
    parse_mode: "HTML",
    reply_markup: wizKb(entryId),
  });
}

/** Текстовые шаги мастера добавления: название → цена → грамовка → описание. */
async function applyAddWizard(ctx: Context, st: Dlg, value: string, changed: () => Promise<void>) {
  const uid = ctx.from!.id;
  if (st.action === "addname") {
    const name = value.trim();
    if (!name) return void ctx.reply("Название пустое. Ещё раз или /cancel.");
    await setState(uid, "addprice", null, { chapterId: String(st.payload.chapterId), name });
    return void ctx.reply(`Шаг 2/5 — <b>цена</b> числом для «${esc(name)}».\n\n/cancel — отменить.`, {
      parse_mode: "HTML",
    });
  }
  if (st.action === "addprice") {
    const price = parsePrice(value);
    if (price == null) return void ctx.reply("Нужно целое число, например 650. Ещё раз или /cancel.");
    const entryId = await addEntry(
      String(st.payload.chapterId),
      { name: String(st.payload.name), price },
      uid,
    );
    await changed();
    // Дальше id позиции держим в поле entryId состояния.
    await setState(uid, "addunit", entryId, {});
    return void askWiz(ctx, "addunit", entryId);
  }
  if (st.action === "addunit") {
    await setText(st.entryId!, "unit", value.trim() || null, uid);
    await changed();
    await setState(uid, "adddesc", st.entryId, {});
    return void askWiz(ctx, "adddesc", st.entryId!);
  }
  if (st.action === "adddesc") {
    const text = value.trim();
    await setText(st.entryId!, "note", text || null, uid);
    await setText(st.entryId!, "noteShort", text ? firstSentence(text) : null, uid);
    await changed();
    await setState(uid, "addphoto", st.entryId, {});
    return void askWiz(ctx, "addphoto", st.entryId!);
  }
  if (st.action === "addphoto") {
    // На фото-шаге ждём картинку, а не текст.
    return void ctx.reply("Пришлите фото блюда, либо нажмите «⏭ Пропустить».");
  }
}

/** Ответ на callback (всплывашка) — best-effort: НИКОГДА не бросает. Просроченный
 *  или битый callback иначе валит обработчик → вебхук 500 → Telegram ретраит и
 *  при многих 500 отключает вебхук. Сам ack некритичен, его провал глотаем. */
async function ack(ctx: Context, opts?: { text?: string }) {
  try {
    await ctx.answerCallbackQuery(opts);
  } catch (e) {
    console.error("[bot] answerCallbackQuery не прошёл (некритично):", e);
  }
}

/** Правит текущее сообщение (навигация «на месте»), с фолбэком на новое. */
async function editTo(ctx: Context, text: string, keyboard: InlineKeyboard) {
  try {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
  } catch {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  }
}
