// 同源 Cloudflare 博客；后台账号与会话由 D1 管理。
import { identity, login, logout, secureTransport, changePassword } from './auth.js';
import { escapeHtml, renderMarkdown } from './content.js';
const slug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 70;
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}});
const fail = (message, status = 400) => json({error: message}, status);
async function readJson(request, max = 400000) {
  if (Number(request.headers.get('content-length')) > max) throw Object.assign(new Error('请求过大。'), {status: 413});
  const reader = request.body?.getReader(), chunks = []; let length = 0;
  if (reader) {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > max) { await reader.cancel(); throw Object.assign(new Error('请求过大。'), {status: 413}); }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const raw = new TextDecoder().decode(bytes);
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('请求必须为 JSON。'), {status: 400}); }
}
function validate(data) {
  for (const [field, max] of [['title',160], ['category',80], ['summary',300], ['body',300000]]) {
    if (typeof data?.[field] !== 'string' || !data[field].trim() || data[field].length > max) throw Object.assign(new Error(field + ' 不能为空或超出长度限制。'), {status:400});
  }
}
function publicPost(post) {
  return {id: post.id, title: post.title, category: post.category, summary: post.summary,
    date: new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit'}).format(new Date(post.published_at)).replace('/', '.'),
    permalink: post.permalink, html: renderMarkdown(post.body)};
}
function validImage(bytes, type) {
  const start = (...values) => values.every((v,i) => bytes[i] === v);
  return type === 'image/png' ? start(137,80,78,71,13,10,26,10) :
    type === 'image/jpeg' ? start(255,216,255) :
    type === 'image/gif' ? ['GIF87a','GIF89a'].includes(new TextDecoder().decode(bytes.slice(0,6))) :
    type === 'image/webp' && new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP';
}
async function handle(request, env) {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  const authPath = path === '/api/login' || path === '/api/logout';
  if (authPath) {
    if (method !== 'POST') return fail('请使用 POST。',405);
    if (!secureTransport(request,env)) return fail('登录必须使用 HTTPS。',403);
    if (request.headers.get('origin') !== url.origin) return fail('来源未获允许。',403);
    if (path === '/api/logout') return logout(request,env);
    if (!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json')) return fail('请求必须为 JSON。',415);
    return login(request,env,await readJson(request,2048));
  }
  if (path === '/admin/login' || path === '/admin/login/') {
    if (!['GET','HEAD'].includes(method)) return fail('请使用 GET。',405);
    if (!secureTransport(request,env)) return fail('登录必须使用 HTTPS。',403);
    return env.ASSETS.fetch(new Request(url.origin+'/admin/',{method}));
  }
  const managed = path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/');
  if (managed) {
    // 每个管理请求均查询数据库中的有效会话。
    const user = await identity(request, env);
    if (!user) {
      if (path === '/admin' || path.startsWith('/admin/')) return Response.redirect(url.origin+'/admin/login/',302);
      return fail('请登录管理员账号。',401);
    }
    if (!['GET','HEAD'].includes(method) && request.headers.get('origin') !== url.origin) return fail('来源未获允许。',403);
    if (path === '/api/password' && method === 'POST') {
      if (!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json')) return fail('请求必须为 JSON。',415);
      return changePassword(request,env,await readJson(request,2048));
    }
    if (path === '/api/me' && method === 'GET') return json({login:user.username});
    if (path === '/api/posts' && method === 'GET') return json((await env.DB.prepare('SELECT id,title,category,summary,published_at,updated_at,permalink,version FROM posts ORDER BY published_at DESC,id').all()).results);
    if (path === '/api/preview' && method === 'POST') {
      if (!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json')) return fail('请求必须为 JSON。',415);
      const data=await readJson(request,400000);
      if(typeof data?.body!=='string'||data.body.length>300000)return fail('正文无效或超过长度限制。');
      return json({html:renderMarkdown(data.body)});
    }
    if (path === '/api/post' && method === 'GET') {
      const id = url.searchParams.get('id');
      if (!slug(id)) return fail('无效文章标识。');
      const post = await env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(id).first();
      return post ? json(post) : fail('文章不存在。',404);
    }
    if (path === '/api/post' && method === 'PUT') {
      const data = await readJson(request); validate(data);
      const now = new Date().toISOString();
      if (data.id) {
        if (!slug(data.id) || !Number.isSafeInteger(data.version) || data.version < 1) return fail('文章标识或版本无效。');
        const result = await env.DB.prepare('UPDATE posts SET title=?,category=?,summary=?,body=?,version=version+1,updated_at=? WHERE id=? AND version=?')
          .bind(data.title.trim(),data.category.trim(),data.summary.trim(),data.body,now,data.id,data.version).run();
        if (!result.meta.changes) return fail('文章已被修改或删除，请刷新后重试。',409);
        return json({id:data.id,version:data.version+1,url:url.origin+'/articles/'+data.id+'/'});
      }
      if (!slug(data.slug)) return fail('网址短名只能用小写英文、数字和连字符。');
      const result = await env.DB.prepare('INSERT INTO posts (id,title,category,summary,body,published_at,permalink,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING')
        .bind(data.slug,data.title.trim(),data.category.trim(),data.summary.trim(),data.body,now,'/articles/'+data.slug+'/',now).run();
      if (!result.meta.changes) return fail('网址短名已被使用。',409);
      return json({id:data.slug,version:1,url:url.origin+'/articles/'+data.slug+'/'},201);
    }
    if (path === '/api/post' && method === 'DELETE') {
      const data = await readJson(request);
      if (!slug(data.id) || !Number.isSafeInteger(data.version) || data.version < 1) return fail('删除请求无效。');
      const result = await env.DB.prepare('DELETE FROM posts WHERE id=? AND version=?').bind(data.id,data.version).run();
      return result.meta.changes ? json({ok:true}) : fail('文章已被修改或删除，请刷新后重试。',409);
    }
    if (path === '/api/image' && method === 'POST') {
      const data = await readJson(request, 7100000);
      const ext = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[data.type];
      if (!ext || typeof data.base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64)) return fail('图片格式无效。');
      let bytes;
      try { bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0)); } catch { return fail('图片编码无效。'); }
      if (bytes.length > 5*1024*1024 || !validImage(bytes,data.type)) return fail('仅支持 5 MB 内的有效 PNG、JPG、WebP 或 GIF。');
      const key = crypto.randomUUID()+'.'+ext;
      await env.IMAGES.put(key,bytes,{httpMetadata:{contentType:data.type}});
      const imagePath = '/images/'+key;
      return json({path:imagePath,markdown:'!['+String(data.alt||'图片').replace(/[\[\]\r\n]/g,'').slice(0,80)+']('+imagePath+')'},201);
    }
    if (path.startsWith('/api/')) return fail('不存在的接口。',404);
  }
  if (path.startsWith('/images/') && ['GET','HEAD'].includes(method)) {
    const key = path.slice(8);
    if (!/^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(key)) return fail('图片不存在。',404);
    const object = await env.IMAGES.get(key);
    if (!object) return fail('图片不存在。',404);
    const headers = new Headers({'cache-control':'public, max-age=31536000, immutable','x-content-type-options':'nosniff'});
    object.writeHttpMetadata(headers); headers.set('etag', object.httpEtag);
    return new Response(method==='HEAD'?null:object.body,{headers});
  }
  if (path === '/posts.js' && method === 'GET') {
    const {results} = await env.DB.prepare('SELECT * FROM posts WHERE published_at<=? ORDER BY published_at DESC,id').bind(new Date().toISOString()).all();
    // JSON 内的 < 转义，避免未来嵌入 HTML 时出现脚本边界。
    return new Response('const posts = '+JSON.stringify(results.map(publicPost)).replace(/</g,'\\u003c')+';', {headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'}});
  }
  if (path.startsWith('/articles/') && ['GET','HEAD'].includes(method)) {
    const article = await env.DB.prepare('SELECT * FROM posts WHERE permalink=? AND published_at<=?').bind(path,new Date().toISOString()).first();
    if (!article) return new Response('文章不存在。',{status:404,headers:{'content-type':'text/plain; charset=utf-8'}});
    const template = await env.ASSETS.fetch(new Request(url.origin+'/article-template.html'));
    if (!template.ok) throw new Error('缺少文章模板');
    const replacements = {TITLE:escapeHtml(article.title),SUMMARY:escapeHtml(article.summary),CATEGORY:escapeHtml(article.category),DATE:escapeHtml(publicPost(article).date),URL:escapeHtml(url.href),BODY:renderMarkdown(article.body),YEAR:String(new Date().getFullYear())};
    const html = (await template.text()).replace(/@@(TITLE|SUMMARY|CATEGORY|DATE|URL|BODY|YEAR)@@/g,(_,key)=>replacements[key]);
    return new Response(method==='HEAD'?null:html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
  }
  if (path === '/write' || path === '/write/') return Response.redirect(url.origin+'/admin/',302);
  if (path === '/article-template.html') return new Response('Not found',{status:404});
  return env.ASSETS.fetch(request);
}
export default {
  async fetch(request,env) {
    try {
      const original = await handle(request,env);
      const response = new Response(original.body, original);
      response.headers.set('x-content-type-options','nosniff');
      response.headers.set('referrer-policy','strict-origin-when-cross-origin');
      const pathname=new URL(request.url).pathname;
      if (pathname.startsWith('/admin') || pathname.startsWith('/api/')) {
        response.headers.set('cache-control','no-store');
        response.headers.set('x-frame-options','DENY');
        response.headers.set('content-security-policy',"frame-ancestors 'none'; form-action 'self'; base-uri 'none'");
      }
      return response;
    } catch(error) {
      if (error.status) return fail(error.message,error.status);
      console.error('博客请求失败',error);
      return fail('操作失败，请检查后台日志。',500);
    }
  }
};

