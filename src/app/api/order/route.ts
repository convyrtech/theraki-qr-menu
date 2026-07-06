// Публичный приём заказа из корзины QR-меню. ЧЕСТНО: сервер валидирует формат,
// клампит суммы и АГРЕГИРУЕТ клиентские суммы позиций — он НЕ сверяет их с
// авторитетным меню (источник правды по деньгам — персонал/POS при расчёте за столом,
// оплаты на сайте нет). Защита от подделки/абьюза (аудит H1/H2): проверка Origin
// (запрос должен идти со страницы меню), строгая валидация стола, реальные потолки
// сумм и атомарный rate-limit ДО отправки. Криптоподпись стола — Этап 2, если появится абьюз.
import { logAndSendOrder, rateLimitReason, type OrderItem } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Отбиваем ЯВНО чужой источник (форма-форжинг с другого сайта), НЕ блокируя
// легитимных гостей: same-origin fetch-POST порой НЕ шлёт Origin, а Referrer-Policy
// срезает Referer — поэтому «нет заголовка» ≠ «злоумышленник» (иначе блокировали бы
// реальные заказы, проверено в браузере). Отказ только при доказанном cross-origin.
function originAllowed(req: Request): boolean {
  const host = req.headers.get("host") || "";
  const src = req.headers.get("origin") || req.headers.get("referer") || "";
  const hostOk = (h: string) =>
    h === host || /(^|\.)theraki\.ru$/.test(h) || h.endsWith(".vercel.app") || h.startsWith("localhost");
  if (src) {
    try {
      if (!hostOk(new URL(src).host)) return false; // Origin/Referer есть и ЧУЖОЙ → отказ
    } catch {
      return false;
    }
  }
  // Sec-Fetch-Site (браузер ставит сам, из JS не подделать): явный cross-site → отказ.
  const sfs = req.headers.get("sec-fetch-site");
  if (sfs && sfs === "cross-site") return false;
  return true; // остальное (same-origin, прямой заход, отсутствие заголовков) — пускаем; далее rate-limit
}

// Стол из QR (?t=): цифры/буквы/пробел/дефис, ≤16. Мусор/эмодзи (перелив
// callback_data > 64 байт, спам /столы) → трактуем как «без стола», заказ не рушим.
const TABLE_RE = /^[0-9A-Za-zА-Яа-яЁё \-]{1,16}$/;

export async function POST(req: Request): Promise<Response> {
  if (!originAllowed(req)) {
    return Response.json({ error: "Заказ принимается только со страницы меню." }, { status: 403 });
  }
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
    // Реальные потолки (раньше 100 млн — абсурд): позиция ≤ 500 000 ₽, всего ≤ 2 млн.
    if (!label || !Number.isFinite(sum) || sum < 0 || sum > 500_000) {
      return Response.json({ error: "Битая позиция в заказе." }, { status: 400 });
    }
    items.push({ label, qtyText, sum });
  }
  const total = items.reduce((s, i) => s + i.sum, 0);
  if (total > 2_000_000) return Response.json({ error: "Слишком большая сумма заказа." }, { status: 400 });

  const rawTable = String(b.table ?? "").trim();
  const table = TABLE_RE.test(rawTable) ? rawTable : ""; // невалидный стол → без стола
  const comment = String(b.comment ?? "").trim().slice(0, 500);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  // FAIL-OPEN: анти-спам не должен ронять ЛЕГИТИМНЫЙ заказ. Если запрос лимита
  // упал (миг БД), пропускаем заказ, а не отдаём 500 гостю.
  let reason: string | null = null;
  try {
    reason = await rateLimitReason(table);
  } catch (e) {
    console.error("[order] rate-limit сбой — пропускаем заказ (fail-open):", e);
  }
  if (reason) return Response.json({ error: reason }, { status: 429 });
  try {
    await logAndSendOrder({ table, comment, items, total }, ip);
  } catch (e) {
    console.error("[order] не удалось отправить:", e);
    return Response.json({ error: "Не удалось отправить заказ. Позовите официанта." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
