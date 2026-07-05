// Кэш-обёртка чтения меню для страницы (server component).
// Отдельно от menu-db.ts, потому что тянет next/cache (menu-db.ts должен
// оставаться чистым — его импортит CLI-скрипт паритета).
//
// ISR: результат кэшируется с тегом "menu"; бот после правки дёргает
// revalidateTag("menu") — страница пересобирается за секунды, оставаясь
// статически быстрой для гостей между правками.
import { unstable_cache } from "next/cache";
import { getChapters, getRakiBoard, type RakiBoard } from "./menu-db";
import { chapters as staticChapters, rakiChapter as staticRaki } from "@/data/menu";
import type { Chapter } from "@/data/menu";

export const MENU_TAG = "menu";

type MenuPayload = { chapters: Chapter[]; rakiChapter: RakiBoard; fallback: boolean };

const loadMenu = unstable_cache(
  async (): Promise<MenuPayload> => {
    // Главы — основа меню. Их сбой (после ретраев) → бросаем → весь фолбэк на menu.ts.
    const chapters = await getChapters();
    // Пустой список глав (случайный TRUNCATE / все скрыты / частичный сид) —
    // это НЕ валидное меню. Бросаем, чтобы сработал фолбэк на menu.ts и пустой
    // результат не закешировался как «правильное пустое меню».
    if (!chapters.length) throw new Error("БД вернула 0 глав — считаем меню недоступным.");
    // Раки-доска РАЗВЯЗАНА от глав: отсутствие/сбой/битая-форма одной jsonb-строки
    // не должны ронять всё меню в статику — берём статических раков, главы живые.
    let rakiChapter: RakiBoard;
    try {
      const board = await getRakiBoard();
      // Валидация формы: витрина делает raki.sizes.map/preparations.map — если jsonb
      // структурно битый (не массив), рендер бросил бы и увёл ВСЁ меню в error boundary
      // МИМО развязки. Битую форму → на статику раков (аудит L1).
      if (!board || !Array.isArray(board.sizes) || !Array.isArray(board.preparations)) {
        throw new Error("raki-board: битая форма (sizes/preparations не массивы)");
      }
      rakiChapter = board;
    } catch (e) {
      console.error("[menu] раки-доска недоступна/битая — статика только для раков, главы живые:", e);
      rakiChapter = staticRaki as RakiBoard;
    }
    return { chapters, rakiChapter, fallback: false };
  },
  ["menu-payload-v1"],
  // tags — мгновенная ревалидация ботом; revalidate 300с — страховка: если
  // revalidateTag однажды не сработает, сайт всё равно освежится за ≤5 мин.
  { tags: [MENU_TAG], revalidate: 300 },
);

/**
 * Меню для страницы. При недоступности БД — тихий фолбэк на статический
 * снапшот menu.ts (гость никогда не видит пустое меню). Фолбэк НЕ кэшируется,
 * чтобы следующий запрос повторил попытку к БД.
 */
export async function getMenuForPage(): Promise<MenuPayload> {
  try {
    return await loadMenu();
  } catch (err) {
    console.error("[menu] чтение БД упало, фолбэк на статический menu.ts:", err);
    // TODO (Фаза 5): алерт в админ-чат бота о работе на резерве.
    return { chapters: staticChapters, rakiChapter: staticRaki as RakiBoard, fallback: true };
  }
}
