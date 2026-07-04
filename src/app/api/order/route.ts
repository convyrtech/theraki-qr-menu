// Публичный приём заказа из корзины QR-меню. Валидирует, пересчитывает сумму
// на сервере (клиенту не доверяем), шлёт в чат персонала, пишет в orders_log.
import { logAndSendOrder, rateLimitReason, type OrderItem } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const b = body as { table?: unknown; comment?: unknown; items?: unknown };

  const rawItems = Array.isArray(b.items) ? b.items : [];
  if (!rawItems.length) return Response.json({ error: "Заказ пуст." }, { status: 400 });
  if (rawItems.length > 100) return Response.json({ error: "Слишком много позиций." }, { status: 400 });

  const items: OrderItem[] = [];
  for (const it of rawItems) {
    const o = it as { label?: unknown; qtyText?: unknown; sum?: unknown };
    const label = String(o.label ?? "").trim().slice(0, 200);
    const qtyText = String(o.qtyText ?? "").trim().slice(0, 40);
    const sum = Number(o.sum);
    if (!label || !Number.isFinite(sum) || sum < 0 || sum > 100_000_000) {
      return Response.json({ error: "Битая позиция в заказе." }, { status: 400 });
    }
    items.push({ label, qtyText, sum });
  }
  // Сумму считаем на сервере — не доверяем клиентскому total.
  const total = items.reduce((s, i) => s + i.sum, 0);
  const table = String(b.table ?? "").trim().slice(0, 20);
  const comment = String(b.comment ?? "").trim().slice(0, 500);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const reason = await rateLimitReason(table);
  if (reason) return Response.json({ error: reason }, { status: 429 });
  try {
    await logAndSendOrder({ table, comment, items, total }, ip);
  } catch (e) {
    console.error("[order] не удалось отправить:", e);
    return Response.json({ error: "Не удалось отправить заказ. Позовите официанта." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
