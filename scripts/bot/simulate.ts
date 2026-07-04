// Офлайн-проверка бот-логики (Фаза 3): без сети и без телефона.
// Перехватывает исходящие вызовы Telegram API и прогоняет синтетические
// апдейты, печатая, что бот ответил бы.
// Запуск: node --env-file=.env.local --import tsx scripts/bot/simulate.ts
import type { UserFromGetMe } from "grammy/types";
import { createBot } from "../../src/bot/bot";
import { neon } from "@neondatabase/serverless";
import { listEntries, getEntry } from "../../src/bot/menu-admin-db";
import { getBoard } from "../../src/bot/raki-write-db";
import { getChapters } from "../../src/lib/menu-db";

const BOT_INFO: UserFromGetMe = {
  id: 8323960341,
  is_bot: true,
  first_name: "therakiadmin",
  username: "therakiadmin_bot",
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
};

const ADMIN = 272887795;
const STRANGER = 999000999;

type Rec = { method: string; text?: string; buttons?: string[]; toChat?: number };
const calls: Rec[] = [];

const bot = createBot(process.env.TG_BOT_TOKEN!);
bot.botInfo = BOT_INFO;

// Перехват всех вызовов API: ничего не уходит в Telegram, всё пишется в calls.
bot.api.config.use(async (_prev, method, payload) => {
  const p = payload as Record<string, unknown>;
  const kb = (p.reply_markup as { inline_keyboard?: { text: string }[][] } | undefined)?.inline_keyboard;
  const buttons = kb ? kb.flat().map((b) => b.text) : undefined;
  calls.push({
    method,
    text: typeof p.text === "string" ? p.text.replace(/\n/g, " ⏎ ") : undefined,
    buttons,
    toChat: typeof p.chat_id === "number" ? p.chat_id : undefined,
  });
  // Фейковый успешный ответ (структура не важна — возвраты не используются).
  return { ok: true, result: { message_id: calls.length, date: 0, chat: { id: ADMIN, type: "private" } } } as never;
});

// База update_id уникальна на запуск: processed_updates (дедуп) персистентна,
// иначе повторный прогон принял бы старые id за дубли и всё пропустил.
let uid = Math.floor(Date.now() / 1000) * 100;
function msg(fromId: number, text: string) {
  // Telegram помечает команды сущностью bot_command — grammy по ней их и ловит.
  const entities = text.startsWith("/")
    ? [{ type: "bot_command" as const, offset: 0, length: text.split(/\s/)[0].length }]
    : undefined;
  return {
    update_id: uid++,
    message: {
      message_id: uid,
      date: 0,
      chat: { id: fromId, type: "private" as const },
      from: { id: fromId, is_bot: false, first_name: "Test" },
      text,
      ...(entities ? { entities } : {}),
    },
  };
}
function cb(fromId: number, data: string) {
  return {
    update_id: uid++,
    callback_query: {
      id: String(uid),
      from: { id: fromId, is_bot: false, first_name: "Test" },
      message: {
        message_id: uid,
        date: 0,
        chat: { id: fromId, type: "private" as const },
        from: BOT_INFO,
        text: "prev",
      },
      chat_instance: "ci",
      data,
    },
  };
}

function dump(label: string) {
  console.log(`\n=== ${label} ===`);
  for (const c of calls) {
    const btns = c.buttons ? `  [${c.buttons.join(" | ")}]` : "";
    console.log(`  → ${c.method}${c.text ? ": " + c.text : ""}${btns}`);
  }
  calls.length = 0;
}

async function main() {
  // 1) /start от админа
  await bot.handleUpdate(msg(ADMIN, "/start"));
  dump("/start (админ)");

  // 2) /menu от админа
  await bot.handleUpdate(msg(ADMIN, "/menu"));
  dump("/menu (админ)");

  // 3) открыть раздел «Краб»
  await bot.handleUpdate(cb(ADMIN, "ch:crab"));
  dump("callback ch:crab");

  // 4) открыть первую позицию краба
  const crab = await listEntries("crab");
  await bot.handleUpdate(cb(ADMIN, `e:${crab[0].id}`));
  dump(`callback e:${crab[0].id} (${crab[0].name})`);

  // 5) назад к разделам
  await bot.handleUpdate(cb(ADMIN, "menu"));
  dump("callback menu (назад к разделам)");

  // 6) чужой пользователь — должен быть отбит
  await bot.handleUpdate(msg(STRANGER, "/menu"));
  dump("/menu (ЧУЖОЙ — ожидаем отказ)");

  // === Операции записи (self-cleaning: возвращаем всё в исходное) ===
  const id = crab[0].id;
  const before = (await getEntry(id))!;
  const check = async (label: string, cond: boolean) =>
    console.log(`  [${cond ? "OK" : "FAIL"}] ${label}`);

  console.log("\n=== ОПЕРАЦИИ (позиция id " + id + ", «" + before.name + "») ===");

  // Скрыть → вернуть
  await bot.handleUpdate(cb(ADMIN, `hide:${id}`));
  await check("после hide: is_hidden=true", (await getEntry(id))!.isHidden === true);
  await bot.handleUpdate(cb(ADMIN, `unhide:${id}`));
  await check("после unhide: is_hidden=false", (await getEntry(id))!.isHidden === false);

  // Метка ◆ (toggle туда-обратно)
  await bot.handleUpdate(cb(ADMIN, `flag:${id}:signature`));
  await check("после flag signature: инвертирован", (await getEntry(id))!.signature === !before.signature);
  await bot.handleUpdate(cb(ADMIN, `flag:${id}:signature`));
  await check("после повторного flag: вернулся", (await getEntry(id))!.signature === before.signature);
  calls.length = 0;

  // Диалог цены: тап «Цена» → ввод «12345» → проверка → вернуть
  await bot.handleUpdate(cb(ADMIN, `price:${id}`));
  await bot.handleUpdate(msg(ADMIN, "12345"));
  await check("после диалога цены: price=12345", (await getEntry(id))!.price === 12345);
  await bot.handleUpdate(cb(ADMIN, `price:${id}`));
  await bot.handleUpdate(msg(ADMIN, String(before.price)));
  await check("цена возвращена", (await getEntry(id))!.price === before.price);

  // Невалидная цена — не должна примениться
  await bot.handleUpdate(cb(ADMIN, `price:${id}`));
  calls.length = 0;
  await bot.handleUpdate(msg(ADMIN, "абв"));
  await check("невалидная цена отклонена (price не изменилась)", (await getEntry(id))!.price === before.price);
  console.log("    ответ на 'абв': " + (calls.find((c) => c.text)?.text ?? "—"));
  await bot.handleUpdate(msg(ADMIN, "/cancel"));

  // Диалог названия: тап → ввод → проверка → вернуть
  await bot.handleUpdate(cb(ADMIN, `name:${id}`));
  await bot.handleUpdate(msg(ADMIN, "ТЕСТ-ИМЯ"));
  await check("после диалога названия: name=ТЕСТ-ИМЯ", (await getEntry(id))!.name === "ТЕСТ-ИМЯ");

  // Название с HTML-символами: карточка должна отрендериться без сбоя (экранирование)
  calls.length = 0;
  await bot.handleUpdate(cb(ADMIN, `name:${id}`));
  await bot.handleUpdate(msg(ADMIN, "Раки <XL> & острее"));
  await bot.handleUpdate(cb(ADMIN, `e:${id}`)); // открыть карточку — не должно упасть
  const cardText = calls.find((c) => c.text && c.text.includes("острее"))?.text ?? "";
  await check("HTML-символы экранированы в карточке (&lt;XL&gt; &amp;)", cardText.includes("&lt;XL&gt;") && cardText.includes("&amp;"));
  await bot.handleUpdate(cb(ADMIN, `name:${id}`));
  await bot.handleUpdate(msg(ADMIN, before.name));
  await check("название возвращено", (await getEntry(id))!.name === before.name);

  // Удалить → восстановить
  await bot.handleUpdate(cb(ADMIN, `del:${id}`));
  await bot.handleUpdate(cb(ADMIN, `delyes:${id}`));
  await check("после delete: getEntry=null (скрыт из витрины)", (await getEntry(id)) === null);
  await bot.handleUpdate(cb(ADMIN, `restore:${id}`));
  await check("после restore: снова доступна", (await getEntry(id)) !== null);

  // === Напитки: у 🌶 не должно быть кнопки flag:*:spicy ===
  console.log("\n=== НАПИТКИ: острота скрыта ===");
  const soft = await listEntries("soft");
  calls.length = 0;
  await bot.handleUpdate(cb(ADMIN, `e:${soft[0].id}`));
  const drinkBtns = calls.find((c) => c.buttons)?.buttons ?? [];
  await check("у напитка НЕТ кнопки остроты", !drinkBtns.some((b) => b.includes("остр")));
  await check("у напитка ЕСТЬ ◆ фирменная", drinkBtns.some((b) => b.includes("◆")));
  const food = await listEntries("hot");
  calls.length = 0;
  await bot.handleUpdate(cb(ADMIN, `e:${food[0].id}`));
  const foodBtns = calls.find((c) => c.buttons)?.buttons ?? [];
  await check("у горячего ЕСТЬ кнопка остроты", foodBtns.some((b) => b.includes("остр")));

  // === РАКИ (self-cleaning) ===
  console.log("\n=== РАКИ (доска boards) ===");
  const board0 = await getBoard();
  const mPrice0 = board0.sizes.find((s) => s.tier === "M")!.price;
  const boiledLen0 = board0.preparations.find((p) => p.id === "boiled")!.recipes.length;

  // Открыть доску
  calls.length = 0;
  await bot.handleUpdate(cb(ADMIN, "raki"));
  await check("доска раков открывается (есть кнопки размеров/способов)", (calls[0]?.buttons?.length ?? 0) >= 5);

  // Цена размера M: 9999 → откат
  await bot.handleUpdate(cb(ADMIN, "rsize:M"));
  await bot.handleUpdate(msg(ADMIN, "9999"));
  await check("цена M = 9999", (await getBoard()).sizes.find((s) => s.tier === "M")!.price === 9999);
  await bot.handleUpdate(cb(ADMIN, "rsize:M"));
  await bot.handleUpdate(msg(ADMIN, String(mPrice0)));
  await check("цена M возвращена", (await getBoard()).sizes.find((s) => s.tier === "M")!.price === mPrice0);

  // Добавить рецепт в Отварные → удалить
  await bot.handleUpdate(cb(ADMIN, "raddrec:boiled"));
  await bot.handleUpdate(msg(ADMIN, "ТЕСТ-РЕЦЕПТ"));
  const afterAdd = await getBoard();
  const boiled = afterAdd.preparations.find((p) => p.id === "boiled")!;
  await check("рецепт добавлен (+1)", boiled.recipes.length === boiledLen0 + 1);
  await check("новый рецепт последний = ТЕСТ-РЕЦЕПТ", boiled.recipes[boiled.recipes.length - 1].name === "ТЕСТ-РЕЦЕПТ");
  await bot.handleUpdate(cb(ADMIN, `rrecdel:boiled:${boiled.recipes.length - 1}`));
  await check("рецепт удалён (обратно)", (await getBoard()).preparations.find((p) => p.id === "boiled")!.recipes.length === boiledLen0);

  // Метка острый на рецепте 0 → откат
  const sp0 = (await getBoard()).preparations.find((p) => p.id === "boiled")!.recipes[0].spicy ?? false;
  await bot.handleUpdate(cb(ADMIN, "rrecspicy:boiled:0"));
  await check("острый инвертирован", ((await getBoard()).preparations.find((p) => p.id === "boiled")!.recipes[0].spicy ?? false) === !sp0);
  await bot.handleUpdate(cb(ADMIN, "rrecspicy:boiled:0"));
  await check("острый возвращён", ((await getBoard()).preparations.find((p) => p.id === "boiled")!.recipes[0].spicy ?? false) === sp0);

  // === ФОРМАТЫ ПОДАЧИ (variants) на позиции id (self-cleaning) ===
  console.log("\n=== ФОРМАТЫ (variants, позиция id " + id + ") ===");
  const vlen0 = before.variants.length;
  await bot.handleUpdate(cb(ADMIN, `varadd:${id}`));
  await bot.handleUpdate(msg(ADMIN, "0,5 кг = 1450"));
  let v = (await getEntry(id))!.variants;
  await check("формат добавлен (+1)", v.length === vlen0 + 1);
  await check("значения формата верны", v[v.length - 1].label === "0,5 кг" && v[v.length - 1].price === 1450);
  await bot.handleUpdate(cb(ADMIN, `varedit:${id}:${v.length - 1}`));
  await bot.handleUpdate(msg(ADMIN, "1 кг = 3000"));
  v = (await getEntry(id))!.variants;
  await check("формат отредактирован", v[v.length - 1].label === "1 кг" && v[v.length - 1].price === 3000);
  await bot.handleUpdate(cb(ADMIN, `vardel:${id}:${v.length - 1}`));
  await check("формат удалён (обратно)", (await getEntry(id))!.variants.length === vlen0);

  // === ДОБАВИТЬ ПОЗИЦИЮ (2 шага) в «Гарниры», затем жёстко удалить ===
  console.log("\n=== ДОБАВИТЬ ПОЗИЦИЮ (garnish) ===");
  const g0 = (await listEntries("garnish")).length;
  await bot.handleUpdate(cb(ADMIN, "addentry:garnish"));
  await bot.handleUpdate(msg(ADMIN, "ТЕСТ-БЛЮДО"));
  await bot.handleUpdate(msg(ADMIN, "777"));
  const gAfter = await listEntries("garnish");
  const created = gAfter.find((e) => e.name === "ТЕСТ-БЛЮДО");
  await check("позиция создана (+1)", gAfter.length === g0 + 1);
  await check("название и цена верны", !!created && created.price === 777);
  // Жёсткая очистка тестовой позиции (не soft-delete — чтобы не копить мусор)
  const sql = neon(process.env.DATABASE_URL!);
  await sql.query("DELETE FROM entries WHERE name='ТЕСТ-БЛЮДО'");
  await check("позиция удалена начисто", (await listEntries("garnish")).length === g0);

  // === ДОБАВИТЬ КАТЕГОРИЮ с выбором стиля (self-cleaning) ===
  console.log("\n=== ДОБАВИТЬ КАТЕГОРИЮ (стиль list) ===");
  const catSql = neon(process.env.DATABASE_URL!);
  await bot.handleUpdate(cb(ADMIN, "addchapter"));
  calls.length = 0;
  await bot.handleUpdate(msg(ADMIN, "ТЕСТ-КАТЕГОРИЯ")); // → предложение выбрать стиль
  const styleBtns = calls.find((c) => c.buttons)?.buttons ?? [];
  await check("после названия предложены кнопки стиля", styleBtns.some((b) => b.includes("Карточки")) && styleBtns.some((b) => b.includes("список")));
  await bot.handleUpdate(cb(ADMIN, "addcatgo:list")); // выбрать «список»
  const vit = await getChapters();
  const cat = vit.find((c) => c.title === "ТЕСТ-КАТЕГОРИЯ");
  await check("категория на витрине с layout=list", !!cat && cat.layout === "list");
  // Очистка: удалить категорию (и её позиции, если были) начисто
  await catSql.query("DELETE FROM entries WHERE chapter_id IN (SELECT id FROM chapters WHERE title='ТЕСТ-КАТЕГОРИЯ')");
  await catSql.query("DELETE FROM chapters WHERE title='ТЕСТ-КАТЕГОРИЯ'");
  await check("категория удалена начисто", !(await getChapters()).some((c) => c.title === "ТЕСТ-КАТЕГОРИЯ"));

  // === ИДЕМПОТЕНТНОСТЬ: повтор ТОГО ЖЕ апдейта не срабатывает дважды ===
  console.log("\n=== ИДЕМПОТЕНТНОСТЬ (дубль-доставка) ===");
  const sigBefore = (await getEntry(id))!.signature;
  const flagUpd = cb(ADMIN, `flag:${id}:signature`); // фиксированный update_id
  await bot.handleUpdate(flagUpd); // переключит → !sigBefore
  await bot.handleUpdate(flagUpd); // ТОТ ЖЕ update_id → дедуп пропустит
  await check("дубль callback не откатил метку (сработал 1 раз)", (await getEntry(id))!.signature === !sigBefore);
  await bot.handleUpdate(cb(ADMIN, `flag:${id}:signature`)); // свежий апдейт — вернуть
  await check("метка возвращена в исходное", (await getEntry(id))!.signature === sigBefore);

  // === ФОТО по ссылке (self-cleaning) ===
  console.log("\n=== ФОТО ===");
  const photoBefore = (await getEntry(id))!.photo;
  const testUrl = "https://example.com/krab.jpg";
  await bot.handleUpdate(cb(ADMIN, `photo:${id}`));
  await bot.handleUpdate(msg(ADMIN, testUrl));
  await check("фото-ссылка сохранена", (await getEntry(id))!.photo === testUrl);
  const vitPhoto = (await getChapters())
    .find((c) => c.id === "crab")
    ?.entries.find((e) => e.name.startsWith("Камчатский краб с"))?.photo;
  await check("витрина отдаёт e.photo", vitPhoto === testUrl);
  // http-ссылка должна быть отклонена (не https)
  await bot.handleUpdate(cb(ADMIN, `photo:${id}`));
  await bot.handleUpdate(msg(ADMIN, "http://плохо.jpg"));
  await check("http-ссылка отклонена (фото не изменилось)", (await getEntry(id))!.photo === testUrl);
  await bot.handleUpdate(msg(ADMIN, "/cancel"));
  // убрать фото (вернуть исходное)
  await bot.handleUpdate(cb(ADMIN, `photo:${id}`));
  await bot.handleUpdate(msg(ADMIN, "-"));
  await check("фото убрано (вернулись к исходному)", (await getEntry(id))!.photo === (photoBefore ?? null));

  // === Инструкция: /help и кнопка «Инструкция» ===
  console.log("\n=== ИНСТРУКЦИЯ ===");
  calls.length = 0;
  await bot.handleUpdate(msg(ADMIN, "/help"));
  await check("/help присылает инструкцию", calls.some((c) => (c.text ?? "").includes("Как пользоваться")));
  calls.length = 0;
  await bot.handleUpdate(cb(ADMIN, "help"));
  await check("кнопка «Инструкция» показывает текст", calls.some((c) => (c.text ?? "").includes("Как пользоваться")));

  // === /export: бэкап приходит документом ===
  console.log("\n=== /export ===");
  calls.length = 0;
  await bot.handleUpdate(msg(ADMIN, "/export"));
  await check("/export отправляет документ (sendDocument)", calls.some((c) => c.method === "sendDocument"));

  console.log("\nСимуляция завершена (БД возвращена в исходное состояние).");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
