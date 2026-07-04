// Офлайн-проверка бот-логики (Фаза 3): без сети и без телефона.
// Перехватывает исходящие вызовы Telegram API и прогоняет синтетические
// апдейты, печатая, что бот ответил бы.
// Запуск: node --env-file=.env.local --import tsx scripts/bot/simulate.ts
import type { UserFromGetMe } from "grammy/types";
import { createBot } from "../../src/bot/bot";
import { listEntries } from "../../src/bot/menu-admin-db";

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

let uid = 1;
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

  console.log("\nСимуляция завершена.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
