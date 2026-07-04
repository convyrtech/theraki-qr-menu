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

/** Не больше 15 заказов в минуту глобально — простая защита от спама/флуда. */
export async function rateLimitOk(): Promise<boolean> {
  const rows = (await dbQuery(
    `SELECT count(*)::int AS n FROM orders_log WHERE at > now() - interval '1 minute'`,
  )) as unknown as { n: number }[];
  return rows[0].n < 15;
}

export async function logAndSendOrder(order: Order): Promise<void> {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = ordersChatId();
  if (!token || !chatId) throw new Error("Заказы не настроены (нет бота/чата).");

  const lines = [
    `🧾 <b>НОВЫЙ ЗАКАЗ</b>${order.table ? ` · стол <b>${escHtml(order.table)}</b>` : ""}`,
    "──────────",
    ...order.items.map((i) => `• ${escHtml(i.label)} · ${escHtml(i.qtyText)} — ${rub(i.sum)}`),
    "──────────",
    `Итого: <b>${rub(order.total)}</b>`,
  ];
  if (order.comment) lines.push(`💬 ${escHtml(order.comment)}`);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: lines.join("\n"), parse_mode: "HTML" }),
  });
  if (!res.ok) {
    throw new Error(`Telegram sendMessage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  await dbQuery(
    `INSERT INTO orders_log (table_no, total, items, comment) VALUES ($1,$2,$3::jsonb,$4)`,
    [order.table || null, order.total, JSON.stringify(order.items), order.comment || null],
  );
}
