"use client";

// Корзина заказа (Этап B, фаза B1): состояние + localStorage + номер стола из QR,
// кнопка «+ в заказ» со счётчиком, нижняя панель, окно отправки.
// B1 — обычные позиции (фикс-цена, шаг 1). Весовые/варианты/раки — B2/B3.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type CartLine = {
  key: string;
  label: string; // как показать в заказе
  unitPrice: number; // цена за единицу (за шт / за кг)
  step: number; // шаг количества (1 для штук, 0.5 для кг)
  min: number; // минимум (1 шт / 1 кг); ниже — позиция убирается
  unit: "шт" | "кг"; // как считать/подписывать
  extra?: number; // фикс. надбавка к строке (раки: рецепт «+1 000 ₽»)
  qty: number;
};

type CartCtx = {
  lines: Record<string, CartLine>;
  table: string;
  add: (item: Omit<CartLine, "qty">) => void;
  put: (line: CartLine) => void; // положить готовую строку (раки: с выбранным весом)
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  count: number; // число позиций
  total: number;
};

const Ctx = createContext<CartCtx | null>(null);
const LS_KEY = "raki-cart-v1";

export function lineSum(l: { unitPrice: number; qty: number; extra?: number }): number {
  return Math.round(l.unitPrice * l.qty) + (l.extra ?? 0);
}
export function qtyText(l: { unit: "шт" | "кг"; qty: number }): string {
  return l.unit === "кг" ? `${l.qty} кг`.replace(".", ",") : `×${l.qty}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<Record<string, CartLine>>({});
  const [table, setTable] = useState("");

  const loadedRef = useRef(false);

  // Загрузка из localStorage + номер стола из адреса (?t=5 / ?стол=5).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const urlTable = (p.get("t") || p.get("стол") || p.get("table") || "").slice(0, 20);
    setTable(urlTable);
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { table?: string; lines?: Record<string, CartLine> };
        // Смена стола: старую корзину НЕ переносим на новый стол (сброс сессии).
        if (saved.table && urlTable && saved.table !== urlTable) {
          localStorage.removeItem(LS_KEY);
        } else if (saved.lines) {
          // Валидируем каждую строку — битые (truncated write / старая схема) дропаем,
          // иначе lineSum даёт NaN и «NaN ₽» залипает в панели.
          const clean: Record<string, CartLine> = {};
          for (const [k, l] of Object.entries(saved.lines)) {
            if (
              l &&
              Number.isFinite(l.unitPrice) &&
              Number.isFinite(l.qty) &&
              Number.isFinite(l.step) &&
              Number.isFinite(l.min) &&
              l.qty > 0 &&
              typeof l.label === "string"
            ) {
              clean[k] = l;
            }
          }
          setLines(clean);
        }
      }
    } catch {}
    loadedRef.current = true;
  }, []);

  // Сохраняем ТОЛЬКО после загрузки (иначе пустой стейт затрёт корзину до чтения).
  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ table, lines }));
    } catch {}
  }, [lines, table]);

  const add = useCallback((item: Omit<CartLine, "qty">) => {
    setLines((l) => {
      const cur = l[item.key]?.qty ?? 0;
      // первый раз — сразу минимум (весовым это 1 кг, а не 0,5); дальше по шагу
      const qty = cur > 0 ? cur + item.step : item.min;
      return { ...l, [item.key]: { ...item, qty } };
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((l) => {
      const cur = l[key];
      if (!cur) return l;
      const q = Math.round(qty / cur.step) * cur.step;
      if (q < cur.min) {
        // ниже минимума — убираем позицию из заказа
        const { [key]: _drop, ...rest } = l;
        void _drop;
        return rest;
      }
      return { ...l, [key]: { ...cur, qty: q } };
    });
  }, []);

  const put = useCallback((line: CartLine) => {
    setLines((l) => ({ ...l, [line.key]: line }));
  }, []);

  const clear = useCallback(() => setLines({}), []);

  const arr = Object.values(lines);
  const total = arr.reduce((s, l) => s + lineSum(l), 0);
  const count = arr.length;

  const value = useMemo(
    () => ({ lines, table, add, put, setQty, clear, count, total }),
    [lines, table, add, put, setQty, clear, count, total],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart вне CartProvider");
  return c;
}

/** Кнопка «+ в заказ» / счётчик у позиции. */
export function AddToCart({ item }: { item: Omit<CartLine, "qty"> }) {
  const { lines, add, setQty } = useCart();
  const qty = lines[item.key]?.qty ?? 0;
  if (qty <= 0) {
    return (
      <button
        type="button"
        className="mn-cart-add"
        onClick={(e) => {
          e.stopPropagation();
          add(item);
        }}
      >
        + в заказ
      </button>
    );
  }
  return (
    <div className="mn-cart-step" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="mn-cart-step-btn" onClick={() => setQty(item.key, qty - item.step)} aria-label="Меньше">
        −
      </button>
      <span className="mn-cart-step-q">{qtyText({ unit: item.unit, qty })}</span>
      <button type="button" className="mn-cart-step-btn" onClick={() => setQty(item.key, qty + item.step)} aria-label="Больше">
        +
      </button>
    </div>
  );
}

const rub = (n: number) => n.toLocaleString("ru-RU") + " ₽";

/** Нижняя панель + окно отправки заказа. */
export function CartBar() {
  const { lines, table, count, total, setQty, clear } = useCart();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const arr = Object.values(lines);

  // Повторные заказы: как только гость начал добавлять новое после отправки —
  // прячем «отправлено» и показываем панель нового заказа.
  useEffect(() => {
    if (done && count > 0) setDone(false);
  }, [done, count]);
  // Тост «отправлено» гаснет сам через 6с.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 6000);
    return () => clearTimeout(t);
  }, [done]);

  if (done && count === 0)
    return (
      <div className="mn-cart-toast" role="status" onClick={() => setDone(false)}>
        ✓ Заказ отправлен{table ? ` · стол ${table}` : ""}. Официант скоро подойдёт.
        <span className="mn-cart-toast-more"> Захотите ещё — просто добавьте в заказ.</span>
      </div>
    );
  if (count === 0) return null;

  async function submit() {
    if (sending) return; // защита от двойной отправки (быстрый повторный тап)
    setSending(true);
    setErr("");
    try {
      const res = await fetch("/api/order/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table,
          comment,
          items: arr.map((l) => ({ label: l.label, qtyText: qtyText(l), sum: lineSum(l) })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Не удалось отправить.");
      clear();
      setDone(true);
      setOpen(false);
    } catch (e) {
      // Обрыв связи fetch бросает TypeError («Failed to fetch») — гостю по-русски.
      const offline = e instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);
      setErr(offline ? "Нет связи. Проверьте интернет и повторите." : e instanceof Error ? e.message : "Ошибка отправки.");
    } finally {
      setSending(false);
    }
  }


  return (
    <>
      <button type="button" className="mn-cart-bar" onClick={() => setOpen(true)}>
        <span className="mn-cart-bar-count">{count}</span>
        <span>Ваш заказ</span>
        <span className="mn-cart-bar-total">{rub(total)}</span>
      </button>

      {open ? (
        <div className="mn-cart-sheet-bg" onClick={() => setOpen(false)}>
          <div className="mn-cart-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mn-cart-sheet-head">
              <b>Ваш заказ{table ? ` · стол ${table}` : ""}</b>
              <button type="button" className="mn-cart-x" onClick={() => setOpen(false)} aria-label="Закрыть">
                ✕
              </button>
            </div>
            <div className="mn-cart-list">
              {arr.map((l) => (
                <div className="mn-cart-row" key={l.key}>
                  <span className="mn-cart-row-name">{l.label}</span>
                  <div className="mn-cart-step">
                    <button type="button" className="mn-cart-step-btn" onClick={() => setQty(l.key, l.qty - l.step)}>
                      −
                    </button>
                    <span className="mn-cart-step-q">{qtyText(l)}</span>
                    <button type="button" className="mn-cart-step-btn" onClick={() => setQty(l.key, l.qty + l.step)}>
                      +
                    </button>
                  </div>
                  <span className="mn-cart-row-sum">{rub(lineSum(l))}</span>
                </div>
              ))}
            </div>
            <input
              className="mn-cart-comment"
              placeholder="Комментарий (например: без лука)"
              value={comment}
              maxLength={500}
              onChange={(e) => setComment(e.target.value)}
            />
            {!table ? (
              <div className="mn-cart-note">Номер стола не определён — назовите его официанту.</div>
            ) : null}
            {err ? <div className="mn-cart-err">{err}</div> : null}
            <button type="button" className="mn-cart-send" disabled={sending || count === 0} onClick={submit}>
              {sending ? "Отправляю…" : `Заказать · ${rub(total)}`}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
