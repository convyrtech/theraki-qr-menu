// Временный QA-помощник: шлёт апдейт в боевой вебхук (cb | msg | user:<id> префикс).
const SECRET = process.env.TG_WEBHOOK_SECRET;
let from = 272887795;
let args = process.argv.slice(2);
if (args[0].startsWith("user:")) { from = Number(args[0].slice(5)); args = args.slice(1); }
const [kind, payload] = args;
const uid = Date.now();
const update =
  kind === "cb"
    ? { update_id: uid, callback_query: { id: String(uid), from: { id: from, is_bot: false, first_name: "QA" }, message: { message_id: 1, date: 0, chat: { id: from, type: "private" }, text: "x" }, chat_instance: "qa", data: payload } }
    : { update_id: uid, message: { message_id: uid, date: 0, chat: { id: from, type: "private" }, from: { id: from, is_bot: false, first_name: "QA" }, text: payload, ...(payload.startsWith("/") ? { entities: [{ type: "bot_command", offset: 0, length: payload.split(/\s/)[0].length }] } : {}) } };
const r = await fetch("https://theraki-qr-menu.vercel.app/api/tg/", { method: "POST", headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": SECRET }, body: JSON.stringify(update) });
console.log((from !== 272887795 ? "[чужой] " : "") + kind + " " + (payload ?? "").slice(0, 40) + " → " + r.status);
if (r.status !== 200) process.exit(1);
