// Narrow Cloudflare Worker relay for Telegram Bot API.
// Only API calls behind a random secret prefix are forwarded.
const relay = {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const prefix = `/${env.RELAY_KEY}/`;
    if (!incoming.pathname.startsWith(prefix)) {
      return new Response("Not found", { status: 404 });
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
