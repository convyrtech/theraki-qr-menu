// Серверный вход роута /menu: читает меню из БД (getMenuForPage — кэш с тегом
// "menu", ISR) и отдаёт данные в клиентское view. Между правками бота страница
// статически быстрая; после revalidateTag("menu") пересобирается за секунды.
import { getMenuForPage } from "@/lib/menu-cache";
import { MenuView } from "./menu-view";

export default async function MenuPage() {
  const { chapters, rakiChapter } = await getMenuForPage();
  return <MenuView chapters={chapters} rakiChapter={rakiChapter} />;
}
