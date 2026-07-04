// Приём заказа из QR-меню: формат + отправка в Telegram-чат персонала + лог.
// Чат: TG_ORDERS_CHAT_ID (env), по умолчанию — первый из TG_ADMIN_IDS (личка владельца).
import { dbQuery } from "@/bot/db";

export type OrderItem = { label: string; qtyText: string; sum: number };
export type Order = { table: string; comment: string; items: OrderItem[]; total: number };

export function ordersChatId(): string {
  const explicit = (process.env.TG_ORDERS_CHAT_ID || "").trim();
  if (explicit) return explicit;
  return (process.env.TG_ADMIN_IDS || "").split(",")[0].trim();
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rub = (n: number) => n.toLocaleString("ru-RU") + " ₽";

/**
 * Лимит частоты: по IP и по столу — не больше 8/мин каждого (одно устройство/стол
 * не зафлудит); глобально до 60/мин (потолок объёма, но НЕ блокирует остальные столы,
 * как раньше глобальные 15). Возвращает причину отказа или null (ок).
 */
export async function rateLimitReason(table: string, ip: string): Promise<string | null> {
  const rows = (await dbQuery(
    `SELECT
       (SELECT count(*) FROM orders_log WHERE at > now() - interval '1 minute')::int AS total,
       (SELECT count(*) FROM orders_log WHERE at > now() - interval '1 minute' AND ip = $1)::int AS by_ip,
       (SELECT count(*) FROM orders_log WHERE at > now() - interval '1 minute' AND table_no = $2)::int AS by_table`,
    [ip || null, table || null],
  )) as unknown as { total: number; by_ip: number; by_table: number }[];
  const r = rows[0];
  if (r.by_ip >= 8 || r.by_table >= 8) return "Слишком часто с этого устройства. Подождите минуту.";
  if (r.total >= 60) return "Кухня перегружена заказами. Попробуйте через минуту или позовите официанта.";
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
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: orderText(order), parse_mode: "HTML" }),
  });
  if (!res.ok) {
    throw new Error(`Telegram sendMessage ${res.status}: ${(await res.text()).slice(0, 200)}`);
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
