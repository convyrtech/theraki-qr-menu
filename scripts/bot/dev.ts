// Локальная отладка бота через long polling (без вебхука/публичного URL).
// Запуск: node --env-file=.env.local --import tsx scripts/bot/dev.ts
// Остановка: Ctrl+C. В проде вместо этого работает вебхук (api/tg/route.ts).
import { createBot } from "../../src/bot/bot";

const token = process.env.TG_BOT_TOKEN;
if (!token) throw new Error("TG_BOT_TOKEN не задан (node --env-file=.env.local …).");

const bot = createBot(token);

async function main() {
  // Снимаем возможный вебхук, чтобы long polling не конфликтовал с ним.
  await bot.api.deleteWebhook({ drop_pending_updates: false });
  console.log("Бот запущен в режиме long polling. Напишите ему в Telegram. Ctrl+C — стоп.");
  await bot.start({
    onStart: (info) => console.log(`Online: @${info.username} (id ${info.id})`),
  });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
