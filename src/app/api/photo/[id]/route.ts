// Отдаёт фото позиции из БД. URL версионируется (?v=updated_at) при загрузке,
// поэтому кэш можно ставить вечный (immutable): новая картинка = новый URL.
import { getPhotoBytes } from "@/bot/photo-db";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return new Response("bad id", { status: 400 });
  const p = await getPhotoBytes(n);
  if (!p) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(p.buf), {
    headers: {
      "Content-Type": p.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
