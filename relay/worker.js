// thyncSource の中継役（Cloudflare Worker）
// 1) GitHub Pages の thyncSource から来た呼び出しだけを、Workflowy API にそのまま渡す。
//    APIキーは呼び出しに付いてくるものを渡すだけで、ここには保存しない。
// 2) 画像置き場（Workers KV。バインド名 IMAGES）
//    POST /img  … 合言葉（Worker の秘密の値 UPLOAD_TOKEN）が合うときだけ保存し、URL を返す
//    GET  /img/<id> … 画像を返す（誰でも見られるが、id は推測できないランダムな文字列）

const ALLOWED_ORIGINS = ["https://ntrllymindbrain.github.io"];
const MAX_BYTES = 20 * 1024 * 1024;
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/avif": "avif" };

function randomId() {
  const b = new Uint8Array(18); crypto.getRandomValues(b);
  return Array.from(b, x => "abcdefghijklmnopqrstuvwxyz234567"[x & 31]).join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": allowed ? origin : "null",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Upload-Token",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };

    // 画像を見る（<img> からの読み込みには Origin が付かないので、ここは誰でも通す）
    if (request.method === "GET" && url.pathname.startsWith("/img/")) {
      if (!env.IMAGES) return new Response("image store not set up", { status: 501 });
      const id = url.pathname.slice(5).replace(/\.[a-z0-9]+$/i, "");
      const { value, metadata } = await env.IMAGES.getWithMetadata(id, { type: "arrayBuffer" });
      if (!value) return new Response("not found", { status: 404 });
      return new Response(value, { headers: { "Content-Type": (metadata && metadata.type) || "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable", "Access-Control-Allow-Origin": "*" } });
    }

    if (request.method === "OPTIONS") return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (!allowed) return new Response("forbidden", { status: 403, headers: cors });

    // 画像を置く
    if (request.method === "POST" && url.pathname === "/img") {
      const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
      if (!env.IMAGES) return json({ message: "画像置き場（KV の IMAGES）がまだ設定されていません" }, 501);
      if (!env.UPLOAD_TOKEN || request.headers.get("X-Upload-Token") !== env.UPLOAD_TOKEN) return json({ message: "合言葉が違います" }, 401);
      const type = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
      if (!EXT[type]) return json({ message: "画像のファイルではありません" }, 415);
      const body = await request.arrayBuffer();
      if (body.byteLength > MAX_BYTES) return json({ message: "画像が大きすぎます（20MBまで）" }, 413);
      const id = randomId();
      await env.IMAGES.put(id, body, { metadata: { type, at: Date.now(), size: body.byteLength } });
      return json({ url: `${url.origin}/img/${id}.${EXT[type]}` });
    }

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
