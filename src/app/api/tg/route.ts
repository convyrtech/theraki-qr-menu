// Webhook Telegram-бота. Telegram шлёт сюда апдейты (POST) с секретным
// заголовком X-Telegram-Bot-Api-Secret-Token — grammy его проверяет.
// Регистрация вебхука — scripts/bot/set-webhook.ts (или npm run bot:set-webhook).
import { webhookCallback } from "grammy";
import { createBot } from "@/bot/bot";
import { revalidateMenu } from "@/lib/revalidate-menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ленивая инициализация на первый запрос: bot.init() один раз за жизнь лямбды
// (getMe кэшируется), дальше — из памяти. Так надёжнее ручного botInfo-литерала.
type WebRequestHandler = (req: Request) => Promise<Response>;
let handlePromise: Promise<WebRequestHandler> | null = null;

function getHandle() {
  if (!handlePromise) {
    handlePromise = (async () => {
      const token = process.env.TG_BOT_TOKEN;
      if (!token) throw new Error("TG_BOT_TOKEN не задан.");
      // Fail-closed: без секрета grammy НЕ проверяет заголовок Telegram, и любой
      // может подделать апдейт с admin-id из TG_ADMIN_IDS. Секрет обязателен.
      const secretToken = process.env.TG_WEBHOOK_SECRET;
      if (!secretToken) throw new Error("TG_WEBHOOK_SECRET не задан — вебхук отклонён (fail-closed).");
      const bot = createBot(token, { onMenuChanged: () => revalidateMenu() });
      await bot.init();
      // Адаптер "std/http" даёт обработчик (Request) => Promise<Response>.
      return webhookCallback(bot, "std/http", { secretToken }) as WebRequestHandler;
    })();
  }
  return handlePromise;
}

export async function POST(req: Request): Promise<Response> {
  const handle = await getHandle();
  return handle(req);
}
