# Перенос на новый ПК (Windows → Windows)

> Составлено 2026-06-13. Две независимые части: **код** (через GitHub) и **воркфлоу Claude** (копия `~/.claude` + переустановка MCP/плагинов).
> ⚠️ Сохрани тот же путь проектов `E:\1111111111111111111111111\` — это сохраняет привязку **авто-памяти Claude** (ключи проектов = пути; иначе память придётся перепривязывать вручную).

---

## 0. Поставить на новом ПК
- **Node.js LTS** (npm/npx) — nodejs.org
- **Git** — git-scm.com
- **GitHub CLI** — `winget install GitHub.cli`, затем `gh auth login` (аккаунт `convyrtech`)
- **Claude Code** — `npm i -g @anthropic-ai/claude-code`, затем `claude` → залогиниться
- **Python + uv** (для serena MCP) — `pip install uv`
- **Google Chrome** (для chrome-devtools MCP)

---

## 1. Код (GitHub)

Тот же путь:
```
mkdir E:\1111111111111111111111111
cd /d E:\1111111111111111111111111
git clone <URL_QR_MENU>            theraki-qr-menu     # репо заведём (см. ниже)
git clone https://github.com/convyrtech/12354.git theraki-repo
cd theraki-repo && git checkout feat/mobile-order-bar  # рабочая ветка с 40 коммитами
```
Потом в каждой папке: `npm install`.

### Секреты (НЕ через git — gitignored, переносить вручную)
- `theraki-repo\.env.local` — ключи **Yandex Router / DaData / MapTiler**. Перенести флешкой/менеджером паролей/зашифрованно. В git их НЕТ (проверено: в историю попадал только `.env.example`).
- `theraki-qr-menu` — секретов нет (статика), `.env` не нужен.

---

## 2. Воркфлоу Claude — скопировать `C:\Users\<СТАРОЕ_ИМЯ>\.claude\...` → `C:\Users\<НОВОЕ_ИМЯ>\.claude\...`

Перенести (копией файлов):
| Что | Путь | Зачем |
|---|---|---|
| Глобальные правила | `~/.claude/CLAUDE.md` | твои персональные правила всех проектов |
| Настройки/права/хуки | `~/.claude/settings.json` | permissions, env, hooks |
| Личные скиллы (21 шт) | `~/.claude/skills/` | grill-me, diagnose, qa, prototype, и т.д. |
| **АВТО-ПАМЯТЬ (23 файла)** | `~/.claude/projects/E--/memory/` | ⭐ САМОЕ ЦЕННОЕ: вся накопленная история Raki/VPN. Незаменимо. |
| Транскрипты сессий (опц.) | `~/.claude/projects/E--*` | история диалогов, если нужна |
| Плагины (опц.) | `~/.claude/plugins/` | можно скопировать или переустановить (шаг 4) |

⚠️ Если имя пользователя на новом ПК **другое** — открой скопированный `settings.json` и проверь абсолютные пути `C:\Users\...` внутри.
⚠️ `~/.claude.json` (рядом с папкой, не внутри) содержит токены MCP-аутентификации и историю — можно скопировать целиком (это твои данные), но токены могут протухнуть; проще не копировать, а заново добавить MCP (шаг 3) и перелогиниться.

---

## 3. MCP-серверы (переустановить — это локальные процессы, не файлы)

После установки Claude Code на новом ПК:
```
claude mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest
claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena-mcp-server
```
- `context7` и `vercel` приходят вместе с плагинами (шаг 4) — отдельно добавлять не нужно.
- Точные команды/аргументы можно подсмотреть в старом `~/.claude.json` → секция `"mcpServers"` (там сейчас: `serena`, `chrome-devtools`).
- serena требует Python+uv; chrome-devtools требует Chrome.

---

## 4. Плагины
`claude` → команда `/plugin` → marketplace → переустановить:
- **vercel** (vercel:* скиллы + MCP)
- **context7** (доки библиотек + MCP)
- think-through, playwright (если пользуешься)

Либо скопировать `~/.claude/plugins/` целиком со старого ПК.

---

## 5. Проверка (на новом ПК)
1. `cd E:\1111111111111111111111111\theraki-qr-menu` → `claude` → спросить «прочитай память» — должна подхватиться `MEMORY.md` (значит авто-память на месте).
2. `npm run dev` → http://localhost:3010 ; или `npm run build:clean` + `npx serve out -l 3011`.
3. В Claude: проверить, что `/grill-me`, `/qa` и пр. скиллы видны; chrome-devtools MCP подключается (нужен Chrome).
4. `theraki-repo`: `npm install`, положить `.env.local`, `npm run dev`, проверить карту/гео (ключи активны).

---

## Сводка «что где живёт»
- **theraki-qr-menu** — прейскурант-меню (Next.js static export), маршруты `/` и `/qr`. Remote: завести.
- **theraki-repo** — основной сайт The Raki. Remote: `github.com/convyrtech/12354`, рабочая ветка `feat/mobile-order-bar` (40 коммитов запушить!).
- **Память** — `~/.claude/projects/E--/memory/MEMORY.md` + 22 файла.
