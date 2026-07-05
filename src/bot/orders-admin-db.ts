// Управление заказами для персонала: собрать счёт стола (все круги с последнего
// закрытия), список открытых столов, закрыть стол. Данные — из orders_log +
// table_closes. «Счёт стола» = заказы ПОСЛЕ последнего закрытия (или за 18ч —
// страховка, если забыли закрыть; сессия за столом не длится дольше).
import { dbQuery } from "./db";

export type OrderRound = { at: string; items: { label: string; qtyText: string; sum: number }[]; total: number };
export type TableBill = { table: string; rounds: OrderRound[]; total: number; itemCount: number };
export type OpenTable = { table: string; rounds: number; total: number; lastAt: string };

// Пол окна: max(последнее закрытие стола, now-18ч).
const FLOOR = (col: string) =>
  `GREATEST(COALESCE((SELECT max(c.at) FROM table_closes c WHERE c.table_no = ${col}), 'epoch'), now() - interval '18 hours')`;

/** Полный счёт стола: круги (заказы) с последнего закрытия + общий итог. */
export async function tableBill(table: string): Promise<TableBill> {
  const rows = await dbQuery<{ at: string; items: OrderRound["items"]; total: number }>(
    `SELECT at, items, total
       FROM orders_log
      WHERE table_no = $1 AND at > ${FLOOR("$1")}
      ORDER BY at`,
    [table],
  );
  const rounds: OrderRound[] = rows.map((r) => ({
    at: r.at,
    items: Array.isArray(r.items) ? r.items : [],
    total: r.total ?? 0,
  }));
  const total = rounds.reduce((s, r) => s + r.total, 0);
  const itemCount = rounds.reduce((s, r) => s + r.items.length, 0);
  return { table, rounds, total, itemCount };
}

/** Открытые столы смены: те, у кого есть заказы после последнего закрытия. */
export async function openTables(): Promise<OpenTable[]> {
  const rows = await dbQuery<{ table_no: string; rounds: number; total: number; last_at: string }>(
    `SELECT o.table_no,
            count(*)::int      AS rounds,
            sum(o.total)::int  AS total,
            max(o.at)          AS last_at
       FROM orders_log o
      WHERE o.table_no IS NOT NULL AND o.table_no <> ''
        AND o.at > ${FLOOR("o.table_no")}
      GROUP BY o.table_no
      ORDER BY max(o.at) DESC`,
  );
  return rows.map((r) => ({ table: r.table_no, rounds: r.rounds, total: r.total, lastAt: r.last_at }));
}

/** Закрыть стол: пишем границу — следующий заказ начнёт новый счёт. */
export async function closeTable(table: string, byTgId?: number): Promise<void> {
  await dbQuery(`INSERT INTO table_closes (table_no, by_tg_id) VALUES ($1, $2)`, [table, byTgId ?? null]);
}
