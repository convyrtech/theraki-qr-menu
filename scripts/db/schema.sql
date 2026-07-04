-- Схема меню The Raki (Этап A — TG-админка).
-- Структура 1:1 с типами src/data/menu.ts, чтобы сид и getMenu() были
-- тривиальны, а паритет-скрипт сверял deep-diff без маппинг-магии.
-- Идемпотентно: можно гонять повторно (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS chapters (
  id          text PRIMARY KEY,               -- slug из menu.ts (raki, hot, …)
  title       text NOT NULL,
  lede        text,
  origin      text,
  footnotes   jsonb NOT NULL DEFAULT '[]',     -- string[]
  sort_order  int  NOT NULL,
  is_hidden   boolean NOT NULL DEFAULT false,
  -- Стиль отображения на сайте: 'cards' (плитки с фото, как краб) | 'list'
  -- (простые строки, как напитки/соусы). Выбирается при создании категории.
  layout      text NOT NULL DEFAULT 'cards'
);
-- Идемпотентно для уже засеянной базы:
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS layout text NOT NULL DEFAULT 'cards';

CREATE TABLE IF NOT EXISTS entries (
  id           serial PRIMARY KEY,
  chapter_id   text NOT NULL REFERENCES chapters(id) ON DELETE RESTRICT,
  name         text NOT NULL,
  note         text,
  price        int  NOT NULL,                  -- рубли целиком
  unit         text,
  abv          text,
  variants     jsonb NOT NULL DEFAULT '[]',    -- [{label, price}]
  signature    boolean NOT NULL DEFAULT false,
  spicy        boolean NOT NULL DEFAULT false,
  photo        text,
  group_label  text,                           -- MenuEntry.group («group» — reserved в SQL)
  sort_order   int  NOT NULL,
  is_hidden    boolean NOT NULL DEFAULT false, -- стоп-лист
  is_deleted   boolean NOT NULL DEFAULT false, -- soft-delete
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entries_chapter_order ON entries (chapter_id, sort_order);

-- Описание разделено на краткое (карточка) и развёрнутое (деталь) — решение
-- владельца 2026-07-04. `note` = развёрнутое (full), note_short = краткое.
-- ADD COLUMN IF NOT EXISTS — идемпотентно для уже засеянной базы.
ALTER TABLE entries ADD COLUMN IF NOT EXISTS note_short text;

-- Доска раков (rakiChapter) — не MenuEntry, хранится как jsonb-документ.
-- Бот Этапа A правит внутри только цены размеров.
CREATE TABLE IF NOT EXISTS boards (
  id          text PRIMARY KEY,               -- 'raki-board'
  data        jsonb NOT NULL,                 -- {sizes, preparations, footnotes, title, id}
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id           serial PRIMARY KEY,
  at           timestamptz NOT NULL DEFAULT now(),
  actor_tg_id  bigint NOT NULL,
  action       text NOT NULL,                 -- hide/unhide/price/text/add/delete/restore
  entry_id     int,
  details      jsonb NOT NULL DEFAULT '{}'    -- {field, old, new, name}
);

-- Состояние диалога бота (многошаговый ввод: «пришлите новую цену…»).
-- В БД, а не в памяти — чтобы переживало смену лямбд в serverless.
CREATE TABLE IF NOT EXISTS bot_state (
  user_id     bigint PRIMARY KEY,
  action      text NOT NULL,                  -- price/unit/name/short/full/add:<chapter>…
  entry_id    int,
  payload     jsonb NOT NULL DEFAULT '{}',    -- промежуточные данные (для многошаговых)
  updated_at  timestamptz NOT NULL DEFAULT now()
);
