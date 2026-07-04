import "server-only";
import { revalidateTag } from "next/cache";
import { MENU_TAG } from "./menu-cache";

/**
 * Сбросить кэш меню — вызывается ботом после любой правки (Фаза 4),
 * из контекста route handler / server action. Страница /menu пересоберётся
 * при следующем запросе.
 */
export function revalidateMenu() {
  revalidateTag(MENU_TAG);
}
