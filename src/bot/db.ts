// Общий доступ к БД для бот-модулей + ретраи на сетевых сбоях. Локально бот
// ходит в Neon (AWS us-east-1) через капризную сеть — одиночный ConnectTimeout
// иначе валит всю операцию. На Vercel сеть надёжна, но ретраи не мешают.
// NB: только для кода под tsx/Next (bot). Витринный src/lib/menu-db.ts свой —
// его импортит паритет-скрипт на нативном node.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;
function raw(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задан.");
  _sql = neon(url);
  return _sql;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetriable(e: unknown): boolean {
  const s = String((e as { message?: string })?.message ?? e) + " " + String((e as { cause?: unknown })?.cause ?? "");
  return /fetch failed|ConnectTimeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network/i.test(s);
}

/** Запрос к БД с ретраями на сетевых сбоях (3 попытки, бэкоф 0.3/0.6с). */
export async function dbQuery<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return (await raw().query(text, params)) as unknown as T[];
    } catch (e) {
      lastErr = e;
      // Не-сетевую ошибку (нет таблицы, битый SQL, ограничение) пробрасываем
      // как есть — её не лечит повтор, и маскировать под «сеть» нельзя.
      if (!isRetriable(e)) throw e;
      if (attempt === 2) break;
      await sleep(300 * (attempt + 1));
    }
  }
  console.error("[db] сетевой сбой после ретраев:", lastErr);
  // Понятная ошибка только для исчерпанных СЕТЕВЫХ ретраев.
  throw new Error("База недоступна (сеть). Попробуйте ещё раз через пару секунд.");
}
