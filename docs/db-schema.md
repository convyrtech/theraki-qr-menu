# Схема БД меню (Этап A — TG-админка)

> Черновик Фазы 0. Принцип: структура БД = 1:1 типы `src/data/menu.ts`
> (`Chapter`/`MenuEntry`), чтобы сид и `getMenu()` были тривиальны и
> паритет-скрипт мог сверять deep-diff без маппинг-магии.

## Таблицы

### `chapters`
| поле | тип | примечание |
|---|---|---|
| `id` | text PK | slug из menu.ts (`raki`, `hot`, …) — стабильный, в боте = callback-ключ |
| `title` | text NOT NULL | |
| `lede` | text NULL | |
| `origin` | text NULL | провенанс-строка |
| `footnotes` | jsonb NOT NULL DEFAULT '[]' | массив строк |
| `sort_order` | int NOT NULL | порядок глав; римский номер вычисляется по нему |
| `is_hidden` | boolean NOT NULL DEFAULT false | скрыть главу целиком (на вырост) |

### `entries`
| поле | тип | примечание |
|---|---|---|
| `id` | serial PK | |
| `chapter_id` | text NOT NULL → chapters.id | ON DELETE RESTRICT |
| `name` | text NOT NULL | |
| `note` | text NULL | |
| `price` | int NOT NULL | рубли целиком (в карте цены целые) |
| `unit` | text NULL | «кг», «0,5 л», … |
| `abv` | text NULL | пиво |
| `variants` | jsonb NOT NULL DEFAULT '[]' | `[{label, price}]` |
| `signature` | boolean NOT NULL DEFAULT false | |
| `spicy` | boolean NOT NULL DEFAULT false | |
| `photo` | text NULL | путь `/images/…` (фото — вне Этапа A, поле переносим как есть) |
| `group` → `group_label` | text NULL | «Воды», «Соки»… (`group` — зарезервированное слово SQL) |
| `sort_order` | int NOT NULL | порядок внутри главы |
| `is_hidden` | boolean NOT NULL DEFAULT false | стоп-лист (🙈/♻️ в боте) |
| `is_deleted` | boolean NOT NULL DEFAULT false | soft-delete (🗑; восстановление командой) |
| `updated_at` | timestamptz NOT NULL DEFAULT now() | |

Индекс: `(chapter_id, sort_order)`.

### `audit_log`
| поле | тип | примечание |
|---|---|---|
| `id` | serial PK | |
| `at` | timestamptz DEFAULT now() | |
| `actor_tg_id` | bigint NOT NULL | кто (из whitelist) |
| `action` | text NOT NULL | `hide/unhide/price/text/add/delete/restore` |
| `entry_id` | int NULL | |
| `details` | jsonb NOT NULL | `{field, old, new, name}` — старое→новое |

## Особые куски данных (проверить в сиде и паритете!)

- **Доска раков** (размер→цена/кг + стили отварные/жареные): в `menu.ts` это
  отдельные структуры, НЕ `MenuEntry[]`. Решение: в БД Этапа A доску раков
  переносим как **jsonb-документ** в отдельной таблице `boards`
  (`id='raki-board'`, `data jsonb`, `updated_at`) — бот Этапа A умеет менять
  в ней ТОЛЬКО цены (кнопка «Цена» по размеру). Полный CRUD доски — не нужен:
  размеры/стили меняются раз в сезон, это правка данных руками.
- `MENU_URL` и прочие константы остаются в коде — это не контент.

## Чтение (`src/lib/menu-db.ts`)

`getMenu(): Chapter[]` — SELECT глав + позиций `WHERE NOT is_hidden AND NOT is_deleted`,
ORDER BY sort_order; собирает ровно ту же форму, что экспортирует `menu.ts`.
Кеш: `unstable_cache`/`"use cache"` с тегом `menu`; бот после правки дёргает
`revalidateTag('menu')`.

## Фолбэк

БД недоступна → `getMenu()` возвращает данные из `menu.ts` (сид = снапшот)
+ алерт в админ-чат. Гость никогда не видит пустое меню.
