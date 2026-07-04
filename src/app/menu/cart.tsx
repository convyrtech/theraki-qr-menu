"use client";

// Корзина заказа (Этап B, фаза B1): состояние + localStorage + номер стола из QR,
// кнопка «+ в заказ» со счётчиком, нижняя панель, окно отправки.
// B1 — обычные позиции (фикс-цена, шаг 1). Весовые/варианты/раки — B2/B3.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartLine = {
  key: string;
  label: string; // как показать в заказе
  unitPrice: number; // цена за единицу (за шт / за кг)
  step: number; // шаг количества (1 для штук, 0.5 для кг — B2)
  unit: "шт" | "кг"; // как считать/подписывать
  qty: number;
};

type CartCtx = {
  lines: Record<string, CartLine>;
  table: string;
  add: (item: Omit<CartLine, "qty">) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  count: number; // число позиций
  total: number;
};

const Ctx = createContext<CartCtx | null>(null);
const LS_KEY = "raki-cart-v1";

export function lineSum(l: { unitPrice: number; qty: number }): number {
  return Math.round(l.unitPrice * l.qty);
}
export function qtyText(l: { unit: "шт" | "кг"; qty: number }): string {
  return l.unit === "кг" ? `${l.qty} кг`.replace(".", ",") : `×${l.qty}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<Record<string, CartLine>>({});
  const [table, setTable] = useState("");

  // Загрузка из localStorage + номер стола из адреса (?t=5 или ?стол=5).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {}
    const p = new URLSearchParams(window.location.search);
    setTable((p.get("t") || p.get("стол") || p.get("table") || "").slice(0, 20));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(lines));
    } catch {}
  }, [lines]);

  const add = useCallback((item: Omit<CartLine, "qty">) => {
    setLines((l) => ({ ...l, [item.key]: { ...item, qty: (l[item.key]?.qty ?? 0) + item.step } }));
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((l) => {
      const cur = l[key];
      if (!cur) return l;
      const q = Math.max(0, Math.round(qty / cur.step) * cur.step);
      if (q <= 0) {
        const { [key]: _drop, ...rest } = l;
        void _drop;
        return rest;
      }
      return { ...l, [key]: { ...cur, qty: q } };
    });
  }, []);

  const clear = useCallback(() => setLines({}), []);

  const arr = Object.values(lines);
  const total = arr.reduce((s, l) => s + lineSum(l), 0);
  const count = arr.length;

  const value = useMemo(
    () => ({ lines, table, add, setQty, clear, count, total }),
    [lines, table, add, setQty, clear, count, total],
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
  if (count === 0 && !done) return null;

  async function submit() {
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
      setErr(e instanceof Error ? e.message : "Ошибка отправки.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="mn-cart-toast" role="status" onClick={() => setDone(false)}>
        ✓ Заказ отправлен{table ? ` · стол ${table}` : ""}. Официант скоро подойдёт.
      </div>
    );
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
