// Narrow Cloudflare Worker relay for Telegram Bot API.
// Bot API calls and inbound Telegram webhooks are both gated by a random prefix.
const relay = {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const prefix = `/${env.RELAY_KEY}/`;
    if (!incoming.pathname.startsWith(prefix)) {
      return new Response("Not found", { status: 404 });
    }

    // Telegram cannot reliably reach the Selectel staging address directly.
    // Let Telegram reach Cloudflare, then forward the exact update to the origin
    // with the server-side webhook secret injected here (never exposed in the URL).
    if (incoming.pathname === `${prefix}webhook`) {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      if (!env.WEBHOOK_ORIGIN || !env.TG_WEBHOOK_SECRET) {
        return new Response("Webhook relay is not configured", { status: 503 });
      }
      return fetch(env.WEBHOOK_ORIGIN, {
        method: "POST",
        headers: {
          "content-type": request.headers.get("content-type") || "application/json",
          "x-telegram-bot-api-secret-token": env.TG_WEBHOOK_SECRET,
        },
        body: request.body,
      });
    }

    const telegramPath = incoming.pathname.slice(prefix.length - 1);
    if (!/^\/bot\d+:[A-Za-z0-9_-]+\/[A-Za-z0-9_]+$/.test(telegramPath)) {
      return new Response("Not found", { status: 404 });
    }

    const upstream = new URL(`https://api.telegram.org${telegramPath}${incoming.search}`);
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("content-length");
    return fetch(upstream, { method: request.method, headers, body: request.body });
  },
};

export default relay;
