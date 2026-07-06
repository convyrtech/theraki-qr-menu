// Приём заказа из QR-меню: формат + отправка в Telegram-чат персонала + лог.
// Чат: TG_ORDERS_CHAT_ID (env), по умолчанию — первый из TG_ADMIN_IDS (личка владельца).
import { dbQuery } from "@/bot/db";
import { escapeHtml } from "@/lib/text";

export type OrderItem = { label: string; qtyText: string; sum: number };
export type Order = { table: string; comment: string; items: OrderItem[]; total: number };

export function ordersChatId(): string {
  const explicit = (process.env.TG_ORDERS_CHAT_ID || "").trim();
  if (explicit) return explicit;
  return (process.env.TG_ADMIN_IDS || "").split(",")[0].trim();
}

const escHtml = escapeHtml; // единый источник экранирования (см. lib/text.ts)
const rub = (n: number) => n.toLocaleString("ru-RU") + " ₽";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Лимит частоты — АТОМАРНО и ДО отправки (аудит H1). Раньше счётчик читался из
 * orders_log ПЕРЕД отправкой, а писался ПОСЛЕ — окно гонки (TOCTOU): параллельный
 * флуд проскакивал весь, бот упирался в лимит Telegram и настоящие заказы падали.
 * Теперь каждая попытка атомарно ПИШЕТ hit и в том же запросе считает окно —
 * бёрст самоограничивается. Не по IP (зал за общим Wi-Fi = один IP → заблокировал бы всех).
 *  - по столу ≤8/мин; глобально ≤30/мин (ниже реального лимита Telegram на группу,
 *    чтобы самоограничиться раньше, чем Telegram начнёт 429-ить; смена table глобальный
 *    потолок не обходит). Возвращает причину отказа или null.
 */
export async function rateLimitReason(table: string): Promise<string | null> {
  const rows = (await dbQuery(
    `WITH ins AS (INSERT INTO rate_hits (table_no) VALUES ($1) RETURNING at)
     SELECT
       (SELECT count(*) FROM rate_hits WHERE at > now() - interval '1 minute')::int AS total,
       (SELECT count(*) FROM rate_hits WHERE table_no = $1 AND at > now() - interval '1 minute')::int AS by_table`,
    [table || null],
  )) as unknown as { total: number; by_table: number }[];
  // Периодическая уборка старых hit-ов (fire-and-forget) — под атакой таблица растёт.
  if (Math.random() < 0.03) {
    void dbQuery(`DELETE FROM rate_hits WHERE at < now() - interval '1 hour'`).catch(() => {});
  }
  const r = rows[0];
  if (table && r.by_table >= 8) return "С этого стола заказы идут слишком часто. Подождите минуту.";
  if (r.total >= 30) return "Слишком много заказов сейчас. Попробуйте через минуту или позовите официанта.";
  return null;
}

function orderText(order: Order): string {
  const lines = [
    `🧾 <b>НОВЫЙ ЗАКАЗ</b>${order.table ? ` · стол <b>${escHtml(order.table)}</b>` : ""}`,
    "──────────",
    ...order.items.map((i) => `• ${escHtml(i.label)} · ${escHtml(i.qtyText)} — ${rub(i.sum)}`),
    "──────────",
    `Итого: <b>${rub(order.total)}</b>`,
  ];
  if (order.comment) lines.push(`💬 ${escHtml(order.comment)}`);
  return lines.join("\n");
}

export async function logAndSendOrder(order: Order, ip: string): Promise<void> {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = ordersChatId();
  if (!token || !chatId) throw new Error("Заказы не настроены (нет бота/чата).");

  // 1) СНАЧАЛА отправка персоналу. Если она падает — заказ НЕ дошёл, бросаем
  //    (route вернёт ошибку, гость повторит — это правильно).
  // Кнопки для персонала: весь счёт стола + закрыть стол (только если стол известен).
  const reply_markup = order.table
    ? {
        inline_keyboard: [
          [
            { text: `🧾 Счёт стола ${order.table}`, callback_data: `bill:${order.table}` },
            { text: `✅ Закрыть`, callback_data: `close:${order.table}` },
          ],
        ],
      }
    : undefined;
  // Отправка с РЕТРАЯМИ на транзиентный сбой: Telegram при всплеске отвечает 429
  // (retry_after) — краткий лимит НЕ должен ронять заказ гостя в «не удалось
  // отправить». Ретраим 429/5xx (уважая retry_after, ≤4с) и сетевые сбои; 4xx
  // (битый запрос) — сразу бросаем. Провал ВСЕХ попыток → route вернёт 502.
  const payload = JSON.stringify({ chat_id: chatId, text: orderText(order), parse_mode: "HTML", reply_markup });
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response;
    try {
      res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
    } catch (e) {
      if (attempt < 3) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      throw new Error(`Telegram сеть: ${String(e).slice(0, 200)}`);
    }
    if (res.ok) break;
    const body = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      let waitMs = 500 * (attempt + 1);
      try {
        const ra = (JSON.parse(body) as { parameters?: { retry_after?: number } })?.parameters?.retry_after;
        if (ra) waitMs = Math.min(ra * 1000, 4000);
      } catch {}
      await sleep(waitMs);
      continue;
    }
    throw new Error(`Telegram sendMessage ${res.status}: ${body.slice(0, 200)}`);
  }
  // 2) Лог — best-effort: заказ уже у персонала, сбой записи журнала НЕ должен
  //    превращать доставленный заказ в ошибку гостю (иначе повтор → дубль).
  try {
    await dbQuery(
      `INSERT INTO orders_log (table_no, total, items, comment, ip) VALUES ($1,$2,$3::jsonb,$4,$5)`,
      [order.table || null, order.total, JSON.stringify(order.items), order.comment || null, ip || null],
    );
  } catch (e) {
    console.error("[order] заказ отправлен, но журнал не записался:", e);
  }
}
