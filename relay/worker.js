// thyncSource の中継役（Cloudflare Worker）
// GitHub Pages の thyncSource から来た呼び出しだけを、Workflowy API にそのまま渡す。
// APIキーは呼び出しに付いてくるものを渡すだけで、ここには保存しない。

const ALLOWED_ORIGINS = ["https://ntrllymindbrain.github.io"];

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": allowed ? origin : "null",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (!allowed) return new Response("forbidden", { status: 403, headers: cors });

    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/v1/")) return new Response("not found", { status: 404, headers: cors });

    const init = {
      method: request.method,
      headers: {
        "Authorization": request.headers.get("Authorization") || "",
        "Content-Type": request.headers.get("Content-Type") || "application/json",
      },
    };
    if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.text();

    const res = await fetch("https://workflowy.com" + url.pathname + url.search, init);
    const headers = new Headers(cors);
    headers.set("Content-Type", res.headers.get("Content-Type") || "application/json");
    return new Response(res.body, { status: res.status, headers });
  },
};
