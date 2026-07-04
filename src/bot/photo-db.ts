// Хранение фото позиций в БД (WebP как base64). Отдаёт роут /api/photo/[id].
import { dbQuery } from "./db";

/** Сохранить/заменить WebP-байты фото позиции. */
export async function savePhotoBytes(entryId: number, webp: Buffer): Promise<void> {
  await dbQuery(
    `INSERT INTO photos (entry_id, b64, content_type, updated_at)
     VALUES ($1, $2, 'image/webp', now())
     ON CONFLICT (entry_id) DO UPDATE SET b64=EXCLUDED.b64, content_type='image/webp', updated_at=now()`,
    [entryId, webp.toString("base64")],
  );
}

export async function deletePhotoBytes(entryId: number): Promise<void> {
  await dbQuery(`DELETE FROM photos WHERE entry_id=$1`, [entryId]);
}

/** Прочитать байты фото для отдачи роутом. null — нет фото. */
export async function getPhotoBytes(
  entryId: number,
): Promise<{ buf: Buffer; contentType: string } | null> {
  const rows = (await dbQuery(`SELECT b64, content_type FROM photos WHERE entry_id=$1`, [
    entryId,
  ])) as unknown as { b64: string; content_type: string }[];
  if (!rows.length) return null;
  return { buf: Buffer.from(rows[0].b64, "base64"), contentType: rows[0].content_type };
}
