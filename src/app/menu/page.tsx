// Серверный вход роута /menu: читает меню из БД (getMenuForPage — кэш с тегом
// "menu", ISR) и отдаёт данные в клиентское view. Между правками бота страница
// статически быстрая; после revalidateTag("menu") пересобирается за секунды.
import { getMenuForPage } from "@/lib/menu-cache";
import { ordersEnabled } from "@/lib/orders";
import { MenuView } from "./menu-view";

// Безусловный TTL на кэш роута: даже если тегированный кэш (revalidateTag "menu")
// однажды не сработает или страница застрянет на фолбэке (миг БД во время сборки),
// сайт освежится за ≤5 мин, а не «замёрзнет» на статике до передеплоя. (аудит H3)
export const revalidate = 300;

export default async function MenuPage() {
  const { chapters, rakiChapter } = await getMenuForPage();
  return <MenuView chapters={chapters} rakiChapter={rakiChapter} ordersEnabled={ordersEnabled()} />;
}
