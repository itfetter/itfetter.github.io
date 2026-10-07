import {manageCollection,reorderCollection,moveCollectionPosts,collectionPage,collectionNavigation,listCollections} from './collections.js';
import {publicResponse,notFound} from './public-response.mjs';
// 同源 Cloudflare 博客；后台账号与会话由 D1 管理。
import { identity, login, logout, secureTransport, changePassword } from './auth.js';
import {submitMessage,listMessages,markMessage,unreadMessages,readAllMessages,moveMessage,bulkMessages} from './contact.js';
import {exportBackup,restoreBackup} from './backup.js';
import {submitComment,publicComments,managedComments,moderateComment,bulkComments} from './comments.js';
import {recordRead} from './reads.js';
import {movePost} from './post-trash.js';
import { escapeHtml, renderMarkdown, editorBlocks } from './content.js';
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
function validate(data, draft = false) {
  for (const [field, max] of [['title',160], ['category',80], ['summary',300], ['body',300000]]) {
    if (typeof data?.[field] !== 'string' || (!draft && !data[field].trim()) || data[field].length > max) throw Object.assign(new Error(field + ' 不能为空或超出长度限制。'), {status:400});
  }
}
function publicPost(post) {
  return {id: post.id, title: post.title, category: post.category, summary: post.summary,
    date: new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit'}).format(new Date(post.published_at)).replace('/', '.'),
    published_at:post.published_at,public_updated_at:post.public_updated_at||post.published_at,permalink: post.permalink, read_count:post.read_count||0};
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
  if(path==='/api/comments'){
    if(method==='GET')return publicComments(env,url);
    if(method!=='POST')return fail('请使用 GET 或 POST。',405);
    if(!secureTransport(request,env)||request.headers.get('origin')!==url.origin)return fail('来源未获允许。',403);
    if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return fail('请求必须为 JSON。',415);
    return submitComment(request,env,await readJson(request,16000));
  }
  if(path==='/api/contact'){
    if(method!=='POST')return fail('请使用 POST。',405);
    if(!secureTransport(request,env)||request.headers.get('origin')!==url.origin)return fail('来源未获允许。',403);
    if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return fail('请求必须为 JSON。',415);
    return submitMessage(request,env,await readJson(request,16000));
  }
  if(path==='/api/read'){
    if(method!=='POST')return fail('请使用 POST。',405);
    if(!secureTransport(request,env)||request.headers.get('origin')!==url.origin)return fail('来源未获允许。',403);
    if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return fail('请求必须为 JSON。',415);
    return recordRead(request,env,await readJson(request,1024));
  }
  if(path==='/collections/'||/^\/collections\/[a-z0-9-]+\/$/.test(path)){
    if(!['GET','HEAD'].includes(method))return fail('请使用GET。',405);
    return await collectionPage(env,request)||notFound(request);
  }
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
    if(path==='/api/admin/comments/bulk'){
      if(method!=='POST')return fail('请使用 POST。',405);
      if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return fail('请求必须为 JSON。',415);
      return bulkComments(env,await readJson(request,4096));
    }
    if(path==='/api/admin/comments'){
      if(method==='GET')return managedComments(env,url);
      if(method==='PATCH'){
        if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return fail('请求必须为 JSON。',415);
        return moderateComment(env,await readJson(request,16000));
      }
      return fail('请使用 GET 或 PATCH。',405);
    }
    if(path==='/api/messages/bulk'&&method==='POST'){
      if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return fail('请求必须为 JSON。',415);
      return bulkMessages(env,await readJson(request,4096));
    }
    if(path==='/api/messages/count'&&method==='GET')return json(await unreadMessages(env));
    if(path==='/api/messages/read-all'&&method==='POST'){
      if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return fail('请求必须为 JSON。',415);
      return readAllMessages(env,await readJson(request,2048));
    }
    if(path==='/api/messages'&&method==='GET')return listMessages(env,url);
    if((path==='/api/messages'&&method==='DELETE')||(path==='/api/messages/restore'&&method==='POST')){
      if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return fail('请求必须为 JSON。',415);
      return moveMessage(env,await readJson(request,2048),path==='/api/messages/restore');
    }
    if(path==='/api/messages'&&method==='PATCH'){
      if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return fail('请求必须为 JSON。',415);
      return markMessage(env,await readJson(request,2048));
    }
    if(path==='/api/collections'||path==='/api/collections/order'||path==='/api/collections/move'){
      let data;
      if(method!=='GET'){
        if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return fail('请求必须为JSON。',415);
        data=await readJson(request,64000);
      }
      if(path==='/api/collections/order'){if(method!=='POST')return fail('请使用POST。',405);return reorderCollection(env,data)}
      if(path==='/api/collections/move'){if(method!=='POST')return fail('请使用POST。',405);return moveCollectionPosts(env,data)}
      return manageCollection(env,method,data,url);
    }
    if(path==='/api/categories'){
      if(method==='GET'){
        const {results}=await env.DB.prepare("SELECT name FROM categories UNION SELECT trim(category) AS name FROM posts WHERE trim(category)<>'' UNION SELECT trim(draft_category) AS name FROM posts WHERE trim(draft_category)<>'' ORDER BY name").all();
        return json(results.map(row=>row.name));
      }
      if(method==='POST'){
        if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return fail('请求必须为 JSON。',415);
        const data=await readJson(request,2048);
        if(typeof data?.name!=='string'||!data.name.trim()||data.name.length>80||/[\u0000-\u001f\u007f]/.test(data.name))return fail('分类名称须为 1–80 个字符，不能包含控制字符。');
        const name=data.name.trim();
        const result=await env.DB.prepare('INSERT INTO categories (name) VALUES (?) ON CONFLICT DO NOTHING').bind(name).run();
        return json({name,created:result.meta.changes>0},result.meta.changes?201:200);
      }
      if(method==='PATCH'){
        if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return fail('请求必须为 JSON。',415);
        const data=await readJson(request,2048);
        const valid=value=>typeof value==='string'&&value.trim()&&value.length<=80&&!/[\u0000-\u001f\u007f]/.test(value);
        if(!valid(data?.oldName)||!valid(data?.name))return fail('分类名称须为 1–80 个字符，不能包含控制字符。');
        const oldName=data.oldName.trim(),name=data.name.trim();
        if(oldName===name)return json({name,unchanged:true});
        const exists=await env.DB.prepare("SELECT name FROM categories WHERE name=? UNION SELECT category FROM posts WHERE trim(category)=? UNION SELECT draft_category FROM posts WHERE trim(draft_category)=?").bind(name,name,name).first();
        if(exists)return fail('已有同名分类，请使用其他名称。',409);
        try{
          const results=await env.DB.batch([
            env.DB.prepare("INSERT INTO categories(name) SELECT ? WHERE EXISTS(SELECT 1 FROM posts WHERE trim(category)=? OR trim(draft_category)=?) ON CONFLICT DO NOTHING").bind(oldName,oldName,oldName),
            env.DB.prepare("UPDATE categories SET name=?,version=version+1 WHERE name=? AND NOT EXISTS(SELECT 1 FROM posts WHERE trim(category)=? OR trim(draft_category)=?)").bind(name,oldName,name,name),
            env.DB.prepare("UPDATE posts SET category=CASE WHEN trim(category)=? THEN ? ELSE category END,draft_category=CASE WHEN trim(draft_category)=? THEN ? ELSE draft_category END,version=version+1 WHERE (trim(category)=? OR trim(draft_category)=?) AND EXISTS(SELECT 1 FROM categories WHERE name=?) AND NOT EXISTS(SELECT 1 FROM categories WHERE name=?)").bind(oldName,name,oldName,name,oldName,oldName,name,oldName)
          ]);
          if(!results[1].meta.changes)return fail('分类已被修改或名称冲突，请刷新后重试。',409);
          return json({name,oldName});
        }catch(error){
          if(/UNIQUE constraint failed/.test(String(error)))return fail('已有同名分类，请刷新后重试。',409);
          throw error;
        }
      }
      return fail('请使用 GET、POST 或 PATCH。',405);
    }
    if(path==='/api/backup'&&method==='GET')return json(await exportBackup(env));
    if(path==='/api/backup/restore'&&method==='POST'){
      if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return fail('请求必须为 JSON。',415);
      return json(await restoreBackup(env,await readJson(request,24000000)));
    }
    if(path==='/api/history'&&method==='GET'){
      const id=url.searchParams.get('id');if(!slug(id))return fail('文章标识无效。');
      const v=url.searchParams.get('version');
      if(v!==null){if(!/^[1-9][0-9]*$/.test(v))return fail('版本无效。');const row=await env.DB.prepare('SELECT title,category,summary,body,saved_at,version FROM post_versions WHERE post_id=? AND version=?').bind(id,Number(v)).first();return row?json(row):fail('历史版本不存在。',404)}
      return json((await env.DB.prepare('SELECT version,title,saved_at FROM post_versions WHERE post_id=? ORDER BY version DESC LIMIT 50').bind(id).all()).results);
    }
    if (path === '/api/me' && method === 'GET') return json({login:user.username});
    if (path === '/api/posts' && method === 'GET') return json((await env.DB.prepare('SELECT id,COALESCE(draft_title,title) AS title,COALESCE(draft_category,category) AS category,COALESCE(draft_summary,summary) AS summary,published_at,updated_at,permalink,version,status,deleted_at,read_count,(SELECT COUNT(*) FROM article_comments c WHERE c.post_id=posts.id AND c.deleted_at IS NULL) AS comment_count,(draft_body IS NOT NULL) AS has_draft FROM posts ORDER BY updated_at DESC,id').all()).results);
    if (path === '/api/preview' && method === 'POST') {
      if (!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json')) return fail('请求必须为 JSON。',415);
      const data=await readJson(request,400000);
      if(typeof data?.body!=='string'||data.body.length>300000)return fail('正文无效或超过长度限制。');
      return json(data.visual===true?{blocks:editorBlocks(data.body)}:{html:renderMarkdown(data.body)});
    }
    if(path==='/api/post/restore'||path==='/api/post/purge'||(path==='/api/post'&&method==='DELETE')){
      if(method!==(path==='/api/post'?'DELETE':'POST'))return fail('请求方法无效。',405);
      if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return fail('请求必须为 JSON。',415);
      return movePost(env,await readJson(request,2048),path==='/api/post'?'trash':path.endsWith('/restore')?'restore':'purge');
    }
    if (path === '/api/post' && method === 'GET') {
      const id = url.searchParams.get('id');
      if (!slug(id)) return fail('无效文章标识。');
      const post = await env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(id).first();
      if(!post)return fail('文章不存在。',404);
      if(post.deleted_at)return fail('文章已移入回收站，请先恢复。',404);
      const editable={...post,has_draft:post.draft_body!==null};
      for(const field of ['title','category','summary','body']){editable[field]=post['draft_'+field]??post[field];delete editable['draft_'+field];}
      return json(editable);
    }
    if (path === '/api/post' && method === 'PUT') {
      const data = await readJson(request);
      if (data.status !== undefined && !['draft','published'].includes(data.status)) return fail('保存状态无效。');
      const draft=data.status==='draft'; validate(data,draft);
      const now = new Date().toISOString();
      if (data.id) {
        if (!slug(data.id) || !Number.isSafeInteger(data.version) || data.version < 1) return fail('文章标识或版本无效。');
        const sql=draft
          ? 'UPDATE posts SET draft_title=?,draft_category=?,draft_summary=?,draft_body=?,version=version+1,updated_at=? WHERE id=? AND version=? AND deleted_at IS NULL'
          : "UPDATE posts SET title=?,category=?,summary=?,body=?,status='published',published_at=CASE WHEN status='draft' THEN ? ELSE published_at END,draft_title=NULL,draft_category=NULL,draft_summary=NULL,draft_body=NULL,version=version+1,updated_at=?,public_updated_at=? WHERE id=? AND version=? AND deleted_at IS NULL";
        const values=[data.title.trim(),data.category.trim(),data.summary.trim(),data.body,...(draft?[]:[now]),now,...(draft?[]:[now]),data.id,data.version];
        const result=await env.DB.prepare(sql).bind(...values).run();
        if (!result.meta.changes) return fail('文章已被修改或删除，请刷新后重试。',409);
        return json({id:data.id,version:data.version+1,url:url.origin+'/articles/'+data.id+'/',savedAs:draft?'draft':'published'});
      }
      const newSlug = data.slug === undefined || (typeof data.slug === 'string' && !data.slug.trim()) ? 'article-'+crypto.randomUUID() : typeof data.slug === 'string' ? data.slug.trim() : data.slug;
      if (!slug(newSlug)) return fail('网址短名只能用小写英文、数字和连字符。');
      const result = await env.DB.prepare('INSERT INTO posts (id,title,category,summary,body,published_at,permalink,updated_at,status,draft_title,draft_category,draft_summary,draft_body) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING')
        .bind(newSlug,draft?'':data.title.trim(),draft?'':data.category.trim(),draft?'':data.summary.trim(),draft?'':data.body,now,'/articles/'+newSlug+'/',now,draft?'draft':'published',draft?data.title.trim():null,draft?data.category.trim():null,draft?data.summary.trim():null,draft?data.body:null).run();
      if (!result.meta.changes) return fail('网址短名已被使用。',409);
      return json({id:newSlug,version:1,url:url.origin+'/articles/'+newSlug+'/',savedAs:draft?'draft':'published'},201);
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
  if (['/posts.json','/posts.js','/sitemap.xml','/robots.txt'].includes(path)) {
    if (!['GET','HEAD'].includes(method)) return fail('请使用 GET。',405);
    if(path==='/robots.txt')return new Response(method==='HEAD'?null:'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: https://itfetter.com/sitemap.xml\n',{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
    // 显式选择公开字段，不查询正文或草稿；日期、排序仍以首次发布为准。
    const {results}=await env.DB.prepare("SELECT id,title,category,summary,published_at,public_updated_at,permalink,read_count FROM posts WHERE deleted_at IS NULL AND status='published' AND published_at<=? ORDER BY published_at DESC,id").bind(new Date().toISOString()).all();
    const entries=results.filter(post=>slug(post.id));
    if(path==='/sitemap.xml'){
      const locations=['https://itfetter.com/','https://itfetter.com/articles/','https://itfetter.com/archive/','https://itfetter.com/about/','https://itfetter.com/collections/',...(await listCollections(env)).map(c=>'https://itfetter.com/collections/'+c.slug+'/'),...entries.map(post=>'https://itfetter.com/articles/'+post.id+'/')];
      const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+locations.map(location=>'<url><loc>'+escapeHtml(location)+'</loc></url>').join('')+'</urlset>';
      return new Response(method==='HEAD'?null:xml,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'no-store'}});
    }
    const data=JSON.stringify(entries.map(publicPost)).replace(/</g,'\\u003c');
    return new Response(method==='HEAD'?null:(path==='/posts.js'?'const posts = '+data+';':data),{headers:{'content-type':path==='/posts.js'?'text/javascript; charset=utf-8':'application/json; charset=utf-8','cache-control':'no-store'}});
  }
  if (path.startsWith('/articles/') && path !== '/articles/' && ['GET','HEAD'].includes(method)) {
    const article = await env.DB.prepare("SELECT * FROM posts WHERE deleted_at IS NULL AND status='published' AND permalink=? AND published_at<=?").bind(path,new Date().toISOString()).first();
    if (!article) return notFound(request);
    const template = await env.ASSETS.fetch(new Request(url.origin+'/article-template.html'));
    if (!template.ok) throw new Error('缺少文章模板');
    const peers=(await env.DB.prepare("SELECT id,title,category,published_at FROM posts WHERE deleted_at IS NULL AND status='published' AND published_at<=? ORDER BY published_at DESC,id").bind(new Date().toISOString()).all()).results;
    const at=peers.findIndex(p=>p.id===article.id),link=p=>'<a href="/articles/'+encodeURIComponent(p.id)+'/">'+escapeHtml(p.title)+'</a>';
    const related=peers.filter(p=>p.id!==article.id&&p.category===article.category).slice(0,3);
    const navigation=await collectionNavigation(env,article)+'<nav class="post-neighbors" aria-label="继续阅读">'+(peers[at+1]?'<div><small>上一篇</small>'+link(peers[at+1])+'</div>':'')+(peers[at-1]?'<div><small>下一篇</small>'+link(peers[at-1])+'</div>':'')+'</nav>'+(related.length?'<section class="post-related"><h2>同合集，继续读</h2>'+related.map(link).join('')+'</section>':'');
    const dateLabel=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
    const dates='<time datetime="'+escapeHtml(article.published_at)+'">发布于 '+dateLabel(article.published_at)+'</time>'+((article.public_updated_at||article.published_at)!==article.published_at?' · <time datetime="'+escapeHtml(article.public_updated_at)+'">更新于 '+dateLabel(article.public_updated_at)+'</time>':'');
    const replacements = {NAVIGATION:navigation,DATES:dates,ID:escapeHtml(article.id),READS:String(article.read_count||0),TITLE:escapeHtml(article.title),SUMMARY:escapeHtml(article.summary),CATEGORY:escapeHtml(article.category),DATE:escapeHtml(publicPost(article).date),URL:escapeHtml(url.href),BODY:renderMarkdown(article.body),YEAR:String(new Date().getFullYear())};
    const html = (await template.text()).replace(/@@(NAVIGATION|DATES|ID|READS|TITLE|SUMMARY|CATEGORY|DATE|URL|BODY|YEAR)@@/g,(_,key)=>replacements[key]);
    return new Response(method==='HEAD'?null:html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
  }
  if (path === '/write' || path === '/write/') return Response.redirect(url.origin+'/admin/',302);
  if (path === '/article-template.html') return new Response('Not found',{status:404});
  const asset=await env.ASSETS.fetch(request);
  if(asset.status===404&&['GET','HEAD'].includes(method)&&(request.headers.get('accept')||'').includes('text/html'))return notFound(request);
  return asset;
}
export default {
  async fetch(request,env,ctx) {
    try {
      const original = await publicResponse(request,ctx,r=>handle(r,env));
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


