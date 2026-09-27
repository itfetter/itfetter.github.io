// Cloudflare Worker：GitHub App OAuth + 文章管理 API。所有仓库写操作只在这里执行。
const REPO = "itfetter/itfetter.github.io";
const OWNER_ID = 138357073;
const GITHUB = "https://api.github.com";
const textEncoder = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
function cors(origin, env) {
  return origin === env.ADMIN_ORIGIN ? {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
    "vary": "Origin",
  } : {};
}
function fail(message, status = 400) { return json({ error: message }, status); }
async function github(path, token, method = "GET", body, accept = "application/vnd.github+json") {
  const response = await fetch(GITHUB + path, {
    method,
    headers: {
      "authorization": "Bearer " + token,
      "accept": accept,
      "x-github-api-version": "2022-11-28",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  if (!response.ok) {
    const error = new Error(typeof data === "object" && data?.message ? data.message : "GitHub 请求失败");
    error.status = response.status;
    throw error;
  }
  return data;
}
function base64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
function decode64(source) {
  const binary = atob(source.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, ch => ch.charCodeAt(0)));
}
function yamlString(value) { return JSON.stringify(value); }
function readFrontMatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(content);
  if (!match) throw new Error("文章缺少有效 front matter，请在 GitHub 检查原文件。");
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    let value = pair[2];
    if (value.startsWith('"')) {
      try { value = JSON.parse(value); } catch { throw new Error("文章元信息无法解析。"); }
    }
    fields[pair[1]] = value;
  }
  return { fields, body: match[2] };
}
function validSlug(value) { return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 70; }
function validInfo(data) {
  if (!data || typeof data !== "object") throw new Error("文章信息格式不正确。");
  for (const [key, max] of [["title", 160], ["category", 80], ["summary", 300], ["body", 300000]]) {
    if (typeof data[key] !== "string" || !data[key].trim() || data[key].length > max) throw new Error(key + " 不能为空或超出长度限制。");
  }
}
function documentFor(data, stable) {
  return "---\nlayout: post\n" +
    "title: " + yamlString(data.title.trim()) + "\n" +
    "category: " + yamlString(data.category.trim()) + "\n" +
    "summary: " + yamlString(data.summary.trim()) + "\n" +
    "blog_id: " + stable.id + "\n" +
    "date: " + stable.date + "\n" +
    "permalink: /articles/" + stable.id + "/\n" +
    "---\n\n" + data.body.trim() + "\n";
}
function postPath(path) { return typeof path === "string" && /^_posts\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(path); }
function contentPath(path) { return "/repos/" + REPO + "/contents/" + path.split("/").map(encodeURIComponent).join("/"); }
async function authorize(request, env) {
  const bearer = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get("authorization") || "");
  if (!bearer) return null;
  const session = await env.SESSIONS.get("session:" + bearer[1], "json");
  if (!session || session.userId !== OWNER_ID || session.expires < Date.now()) return null;
  return session;
}
async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/auth/login" && request.method === "GET") {
    const state = randomId();
    await env.SESSIONS.put("state:" + state, "1", { expirationTtl: 600 });
    const callback = new URL("/auth/callback", url.origin).href;
    const target = new URL("https://github.com/login/oauth/authorize");
    target.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
    target.searchParams.set("redirect_uri", callback);
    target.searchParams.set("state", state);
    target.searchParams.set("login", "itfetter");
    return Response.redirect(target.href, 302);
  }
  if (path === "/auth/callback" && request.method === "GET") {
    const state = url.searchParams.get("state") || "";
    const code = url.searchParams.get("code") || "";
    if (!/^[a-f0-9]{64}$/.test(state) || !code || !await env.SESSIONS.get("state:" + state)) return fail("授权状态无效，请重新登录。", 403);
    await env.SESSIONS.delete("state:" + state);
    const exchange = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "accept": "application/json", "content-type": "application/json" },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: new URL("/auth/callback", url.origin).href }),
    });
    const auth = await exchange.json();
    if (!exchange.ok || !auth.access_token) return fail("GitHub 授权未完成，请重新登录。", 403);
    const user = await github("/user", auth.access_token);
    if (user.id !== OWNER_ID) return fail("只有 itfetter 账号能管理文章。", 403);
    // URL 中只放一次性票据，不放 GitHub token；session token 只发给页面 JS。
    const ticket = randomId();
    await env.SESSIONS.put("ticket:" + ticket, JSON.stringify({ token: auth.access_token, userId: user.id, expires: Date.now() + Math.min((auth.expires_in || 28800) * 1000, 28800000) }), { expirationTtl: 120 });
    return Response.redirect(env.ADMIN_ORIGIN + "/admin/?ticket=" + ticket, 302);
  }
  if (path === "/api/session" && request.method === "POST") {
    const body = await request.json();
    const ticket = String(body.ticket || "");
    if (!/^[a-f0-9]{64}$/.test(ticket)) return fail("登录票据无效。", 403);
    const session = await env.SESSIONS.get("ticket:" + ticket, "json");
    if (!session) return fail("登录票据已过期，请重新登录。", 403);
    await env.SESSIONS.delete("ticket:" + ticket);
    const key = randomId();
    await env.SESSIONS.put("session:" + key, JSON.stringify(session), { expirationTtl: Math.max(60, Math.floor((session.expires - Date.now()) / 1000)) });
    return json({ session: key, expires: session.expires });
  }
  if (!path.startsWith("/api/")) return fail("不存在的接口。", 404);
  const session = await authorize(request, env);
  if (!session) return fail("请重新登录。", 401);
  if (path === "/api/me" && request.method === "GET") return json({ login: "itfetter" });
  if (path === "/api/logout" && request.method === "POST") {
    const key = request.headers.get("authorization").slice(7);
    await env.SESSIONS.delete("session:" + key);
    return json({ ok: true });
  }
  if (path === "/api/posts" && request.method === "GET") {
    const files = await github(contentPath("_posts"), session.token);
    return json(files.filter(file => file.type === "file" && postPath("_posts/" + file.name)).map(file => ({ path: "_posts/" + file.name, sha: file.sha })));
  }
  if (path === "/api/post" && request.method === "GET") {
    const file = url.searchParams.get("path");
    if (!postPath(file)) return fail("无效文章路径。");
    const data = await github(contentPath(file), session.token);
    const article = readFrontMatter(decode64(data.content));
    return json({ path: file, sha: data.sha, ...article.fields, body: article.body });
  }
  if (path === "/api/post" && request.method === "PUT") {
    const data = await request.json();
    validInfo(data);
    let file, stable, sha;
    if (data.path) {
      if (!postPath(data.path) || !/^[a-f0-9]{40}$/.test(data.sha || "")) return fail("文章路径或版本无效。");
      const existing = await github(contentPath(data.path), session.token);
      if (existing.sha !== data.sha) return fail("文章已在其他地方修改，请刷新后再编辑。", 409);
      const original = readFrontMatter(decode64(existing.content));
      stable = { id: original.fields.blog_id, date: original.fields.date };
      if (!validSlug(stable.id) || !stable.date || original.fields.permalink !== "/articles/" + stable.id + "/") return fail("原文章元信息异常，暂不允许覆盖。", 400);
      file = data.path;
      sha = existing.sha;
    } else {
      if (!validSlug(data.slug)) return fail("网址短名只能用小写英文、数字和连字符。");
      const files = await github(contentPath("_posts"), session.token);
      if (files.some(item => item.name.endsWith("-" + data.slug + ".md"))) return fail("网址短名已被使用。", 409);
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
      const value = type => parts.find(part => part.type === type).value;
      const day = [value("year"), value("month"), value("day")].join("-");
      stable = { id: data.slug, date: day + " " + [value("hour"), value("minute"), value("second")].join(":") + " +0800" };
      file = "_posts/" + day + "-" + data.slug + ".md";
    }
    const markdown = documentFor(data, stable);
    const result = await github(contentPath(file), session.token, "PUT", {
      message: (sha ? "修改文章：" : "发布文章：") + data.title.trim(),
      content: base64(textEncoder.encode(markdown)),
      branch: "main",
      ...(sha ? { sha } : {}),
    });
    return json({ path: file, sha: result.content.sha, url: "https://itfetter.com/articles/" + stable.id + "/" });
  }
  if (path === "/api/post" && request.method === "DELETE") {
    const data = await request.json();
    if (!postPath(data.path) || !/^[a-f0-9]{40}$/.test(data.sha || "")) return fail("删除请求无效。");
    await github(contentPath(data.path), session.token, "DELETE", { message: "删除文章：" + data.path, sha: data.sha, branch: "main" });
    return json({ ok: true });
  }
  if (path === "/api/image" && request.method === "POST") {
    const data = await request.json();
    const match = /^(image\/(?:png|jpeg|webp|gif))$/.exec(data.type || "");
    if (!match || typeof data.base64 !== "string" || data.base64.length > 7000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64)) return fail("仅支持 5 MB 内的 PNG、JPG、WebP 或 GIF。");
    const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" }[match[1]];
    const name = "assets/uploads/" + new Date().toISOString().slice(0, 10) + "-" + randomId().slice(0, 12) + "." + ext;
    await github(contentPath(name), session.token, "PUT", { message: "上传文章图片：" + name, content: data.base64, branch: "main" });
    return json({ markdown: "![" + String(data.alt || "图片").replace(/[\[\]\r\n]/g, "").slice(0, 80) + "](/" + name + ")", path: name });
  }
  return fail("不存在的接口。", 404);
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin");
    const headers = cors(origin, env);
    if (request.method === "OPTIONS") return new Response(null, { status: origin === env.ADMIN_ORIGIN ? 204 : 403, headers });
    if (new URL(request.url).pathname.startsWith("/api/") && origin && origin !== env.ADMIN_ORIGIN) return json({ error: "来源未获允许。" }, 403);
    try {
      const response = await handle(request, env);
      for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      return response;
    } catch (error) {
      const status = error.status === 404 ? 404 : error.status === 409 ? 409 : error.status === 401 ? 401 : 500;
      return json({ error: status === 500 ? "操作失败，请检查后台日志。" : error.message }, status, headers);
    }
  },
};
