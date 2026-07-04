// Общий Neon-клиент для скриптов И для рантайма сайта/бота.
// Скрипты запускаются: node --env-file=.env.local scripts/db/<name>.ts
// В рантайме Next DATABASE_URL приходит из окружения Vercel.
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL не задан. Для скриптов: node --env-file=.env.local … ; " +
      "в Next — переменная окружения проекта Vercel.",
  );
}

/** Тегированный SQL-клиент Neon (HTTP). */
export const sql = neon(url);
