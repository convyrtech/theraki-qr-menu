// Регистрация/снятие вебхука Telegram (для прод-деплоя на Vercel).
// Регистрация:  node --env-file=.env.local --import tsx scripts/bot/set-webhook.ts https://<домен>/api/tg
// Снятие:       node --env-file=.env.local --import tsx scripts/bot/set-webhook.ts --delete
// Секрет берётся из TG_WEBHOOK_SECRET (тот же, что проверяет route.ts).
import { Bot } from "grammy";

const token = process.env.TG_BOT_TOKEN;
const secret = process.env.TG_WEBHOOK_SECRET;
if (!token) throw new Error("TG_BOT_TOKEN не задан.");

const arg = process.argv[2];

async function main() {
  const apiRoot = process.env.TG_API_ROOT;
  const bot = new Bot(token!, apiRoot ? { client: { apiRoot } } : undefined);
  if (arg === "--delete") {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    console.log("Вебхук снят.");
  } else if (arg && /^https:\/\//.test(arg)) {
    await bot.api.setWebhook(arg, {
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
    });
    console.log(`Вебхук установлен: ${arg}`);
  } else {
    throw new Error("Укажите URL вебхука (https://…/api/tg) или --delete.");
  }
  const info = await bot.api.getWebhookInfo();
  console.log("getWebhookInfo:", JSON.stringify(info, null, 2));
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exitCode = 1;
});
