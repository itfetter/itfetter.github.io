import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

const origin = "https://itfetter.com";
const token = "a".repeat(64);
function setup() {
  const records = new Map();
  const files = new Map();
  const session = { token: "mock-github-token", userId: 138357073, expires: Date.now() + 600000 };
  records.set("session:" + token, JSON.stringify(session));
  const env = {
    ADMIN_ORIGIN: origin,
    SESSIONS: {
      async get(key, mode) { const value = records.get(key); return mode === "json" && value ? JSON.parse(value) : value ?? null },
      async put(key, value) { records.set(key, value) },
      async delete(key) { records.delete(key) },
    },
  };
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    if (!path.startsWith("/repos/itfetter/itfetter.github.io/contents/")) throw Error("Unexpected upstream URL");
    const file = decodeURIComponent(path.split("/contents/")[1]);
    const method = options.method || "GET";
    if (method === "GET" && file === "_posts") {
      return new Response(JSON.stringify([...files.entries()].map(([name, data]) => ({ type: "file", name: name.split("/").at(-1), sha: data.sha }))), { status: 200 });
    }
    if (method === "GET") {
      if (!files.has(file)) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
      return new Response(JSON.stringify(files.get(file)), { status: 200 });
    }
    const body = JSON.parse(options.body);
    if (method === "PUT") {
      const sha = "b".repeat(40);
      files.set(file, { sha, content: body.content });
      return new Response(JSON.stringify({ content: { sha } }), { status: 201 });
    }
    if (method === "DELETE") {
      if (files.get(file)?.sha !== body.sha) return new Response(JSON.stringify({ message: "Conflict" }), { status: 409 });
      files.delete(file);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    throw Error("Unexpected method");
  };
  return { env, files, records, restore() { globalThis.fetch = previous } };
}
function request(path, method = "GET", body, key = token, requestOrigin = origin) {
  return new Request("https://blog-admin.example.workers.dev" + path, {
    method,
    headers: { origin: requestOrigin, authorization: "Bearer " + key, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}
test("未登录与其他站点不能操作文章", async () => {
  const { env, restore } = setup();
  try {
    assert.equal((await worker.fetch(request("/api/posts", "GET", null, "wrong"), env)).status, 401);
    assert.equal((await worker.fetch(request("/api/posts", "GET", null, token, "https://evil.example"), env)).status, 403);
  } finally { restore() }
});
test("创建、读取、冲突检查与删除只作用于 _posts", async () => {
  const { env, files, restore } = setup();
  try {
    const article = { title: "测试标题", category: "随笔", summary: "摘要", slug: "my-test", body: "## 正文\n\n内容" };
    const created = await worker.fetch(request("/api/post", "PUT", article), env);
    assert.equal(created.status, 200);
    const info = await created.json();
    assert.match(info.path, /^_posts\/\d{4}-\d{2}-\d{2}-my-test\.md$/);
    const read = await worker.fetch(request("/api/post?path=" + encodeURIComponent(info.path)), env);
    assert.equal((await read.json()).body.trim(), article.body);
    assert.equal((await worker.fetch(request("/api/post?path=README.md"), env)).status, 400);
    const conflict = await worker.fetch(request("/api/post", "PUT", { ...article, path: info.path, sha: "c".repeat(40) }), env);
    assert.equal(conflict.status, 409);
    assert.equal((await worker.fetch(request("/api/post", "DELETE", { path: "../README.md", sha: info.sha }), env)).status, 400);
    const deleted = await worker.fetch(request("/api/post", "DELETE", { path: info.path, sha: info.sha }), env);
    assert.equal(deleted.status, 200);
    assert.equal(files.size, 0);
  } finally { restore() }
});
test("GitHub 授权回调拒绝非仓库所有者", async () => {
  const { env, records, restore } = setup();
  const state = "d".repeat(64);
  env.GITHUB_CLIENT_ID = "client-id";
  env.GITHUB_CLIENT_SECRET = "test-only";
  records.set("state:" + state, "1");
  globalThis.fetch = async url => {
    if (String(url).endsWith("/login/oauth/access_token")) return new Response(JSON.stringify({ access_token: "other-user-token" }), { status: 200 });
    if (String(url).endsWith("/user")) return new Response(JSON.stringify({ id: 123, login: "other" }), { status: 200 });
    throw Error("Unexpected upstream URL");
  };
  try {
    const res = await worker.fetch(new Request("https://blog-admin.example.workers.dev/auth/callback?state=" + state + "&code=example"), env);
    assert.equal(res.status, 403);
    assert.equal([...records.keys()].filter(key => key.startsWith("ticket:")).length, 0);
  } finally { restore() }
});
