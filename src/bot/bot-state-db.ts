// Состояние диалога бота в БД (переживает смену лямбд в serverless).
// TTL — незаконченный диалог протухает, чтобы старый «ввод цены» не поймал
// случайное сообщение через час.
import { dbQuery } from "./db";

const TTL_MS = 10 * 60 * 1000; // 10 минут

export type BotState = {
  action: string;
  entryId: number | null;
  payload: Record<string, unknown>;
};

export async function getState(userId: number): Promise<BotState | null> {
  const rows = (await dbQuery(
    `SELECT action, entry_id, payload, updated_at FROM bot_state WHERE user_id=$1`,
    [userId],
  )) as unknown as { action: string; entry_id: number | null; payload: Record<string, unknown>; updated_at: string }[];
  if (!rows.length) return null;
  const r = rows[0];
  if (Date.now() - new Date(r.updated_at).getTime() > TTL_MS) {
    await clearState(userId);
    return null;
  }
  return { action: r.action, entryId: r.entry_id, payload: r.payload ?? {} };
}

export async function setState(
  userId: number,
  action: string,
  entryId: number | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await dbQuery(
    `INSERT INTO bot_state (user_id, action, entry_id, payload, updated_at)
     VALUES ($1,$2,$3,$4::jsonb, now())
     ON CONFLICT (user_id) DO UPDATE
       SET action=EXCLUDED.action, entry_id=EXCLUDED.entry_id, payload=EXCLUDED.payload, updated_at=now()`,
    [userId, action, entryId, JSON.stringify(payload)],
  );
}

export async function clearState(userId: number): Promise<void> {
  await dbQuery(`DELETE FROM bot_state WHERE user_id=$1`, [userId]);
}
