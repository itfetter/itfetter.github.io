import {escapeHtml} from './content.js';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
export const validCollectionName=v=>typeof v==='string'&&!!v.trim()&&v.length<=80&&!/[\u0000-\u001f\u007f]/.test(v);
export const validCollectionCover=v=>typeof v==='string'&&(v===''||/^\/images\/[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(v));
export const collectionFields='name,slug,description,cover,sort_mode,hidden,version';
const visible="deleted_at IS NULL AND status='published' AND published_at<=?";
// 已发布文章只按公开合集管理；未发布草稿按草稿合集，避免同一排序影响两个合集。
const membership="EXISTS(SELECT 1 FROM post_collections m WHERE m.post_id=posts.id AND m.collection_slug=? AND m.state=CASE WHEN posts.status='draft' THEN 'draft' ELSE 'published' END)";
function sort(mode){return mode==='manual'?'collection_order ASC,published_at ASC,id':mode==='oldest'?'published_at ASC,id':'published_at DESC,id'}
export async function listCollections(env,managed=false){
 const now=new Date().toISOString();
 const rows=(await env.DB.prepare(`SELECT ${collectionFields},(SELECT COUNT(*) FROM posts WHERE ${visible} AND EXISTS(SELECT 1 FROM post_collections m WHERE m.post_id=posts.id AND m.collection_slug=categories.slug AND m.state='published')) AS article_count,(SELECT COALESCE(SUM(read_count),0) FROM posts WHERE ${visible} AND EXISTS(SELECT 1 FROM post_collections m WHERE m.post_id=posts.id AND m.collection_slug=categories.slug AND m.state='published')) AS reads,(SELECT MAX(public_updated_at) FROM posts WHERE ${visible} AND EXISTS(SELECT 1 FROM post_collections m WHERE m.post_id=posts.id AND m.collection_slug=categories.slug AND m.state='published')) AS updated_at,(SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL AND EXISTS(SELECT 1 FROM post_collections m WHERE m.post_id=posts.id AND m.collection_slug=categories.slug AND m.state=CASE WHEN posts.status='draft' THEN 'draft' ELSE 'published' END)) AS total_count FROM categories ORDER BY name`).bind(now,now,now).all()).results;
 return managed?rows:rows.filter(c=>!c.hidden&&c.article_count>0).map(({name,slug,description,cover,sort_mode,article_count,reads,updated_at})=>({name,slug,description,cover,sort_mode,article_count,reads,updated_at}));
}
export async function manageCollection(env,method,data,url){
 if(method==='GET'){
  if(!url.searchParams.get('slug'))return json(await listCollections(env,true));
  const item=await env.DB.prepare(`SELECT ${collectionFields} FROM categories WHERE slug=?`).bind(url.searchParams.get('slug')).first();
  if(!item)fail('合集不存在。',404);
  const posts=(await env.DB.prepare(`SELECT id,COALESCE(draft_title,title) AS title,category,draft_category,status,version,published_at,(SELECT position FROM post_collections m WHERE m.post_id=posts.id AND m.collection_slug=? AND m.state=CASE WHEN posts.status='draft' THEN 'draft' ELSE 'published' END) AS collection_order FROM posts WHERE deleted_at IS NULL AND ${membership} ORDER BY ${sort(item.sort_mode)}`).bind(item.slug,item.slug).all()).results;
  return json({...item,posts});
 }
 if(method==='POST'){
  if(!validCollectionName(data?.name))fail('合集名称须为1–80个字符。');
  const result=await env.DB.prepare('INSERT INTO categories(name) VALUES(?) ON CONFLICT DO NOTHING').bind(data.name.trim()).run();
  if(!result.meta.changes)fail('已有同名合集。',409);
  return json(await env.DB.prepare(`SELECT ${collectionFields} FROM categories WHERE name=?`).bind(data.name.trim()).first(),201);
 }
 if(method==='DELETE'){
  if(data?.confirm!==true||!Number.isSafeInteger(data.version))fail('请确认删除空合集。');
  const result=await env.DB.prepare(`DELETE FROM categories WHERE slug=? AND version=? AND NOT EXISTS(SELECT 1 FROM post_collections WHERE collection_slug=categories.slug)`).bind(data.slug,data.version).run();
  if(!result.meta.changes)fail('合集已变化或仍有文章（含回收站），请先移动文章。',409);
  return json({deleted:true});
 }
 if(method!=='PATCH')fail('请使用GET、POST、PATCH或DELETE。',405);
 if(!validCollectionName(data?.name)||typeof data.description!=='string'||data.description.length>500||!validCollectionCover(data.cover)||!['newest','oldest','manual'].includes(data.sort_mode)||typeof data.hidden!=='boolean'||!Number.isSafeInteger(data.version)||data.version<1)fail('合集名称、简介、封面或版本无效。');
 const old=await env.DB.prepare(`SELECT ${collectionFields} FROM categories WHERE slug=?`).bind(data.slug).first();
 if(!old)fail('合集不存在。',404);
 const name=data.name.trim(),nonce=crypto.randomUUID();
 try{
  const results=await env.DB.batch([
   env.DB.prepare('UPDATE categories SET name=?,description=?,cover=?,sort_mode=?,hidden=?,version=version+1,mutation_token=? WHERE slug=? AND version=? AND NOT EXISTS(SELECT 1 FROM posts WHERE (trim(category)=? OR trim(draft_category)=?) AND ?<>?)').bind(name,data.description.trim(),data.cover,data.sort_mode,Number(data.hidden),nonce,data.slug,data.version,name,name,name,old.name),
   env.DB.prepare(`UPDATE posts SET category=CASE WHEN trim(category)=? THEN ? ELSE category END,draft_category=CASE WHEN trim(draft_category)=? THEN ? ELSE draft_category END,version=version+1 WHERE (trim(category)=? OR trim(draft_category)=?) AND ?<>? AND EXISTS(SELECT 1 FROM categories WHERE slug=? AND mutation_token=?)`).bind(old.name,name,old.name,name,old.name,old.name,old.name,name,data.slug,nonce)
  ]);
  if(!results[0].meta.changes)fail('合集已被修改或名称重复，请刷新后重试。',409);
 }catch(e){if(/UNIQUE constraint/.test(String(e)))fail('已有同名合集。',409);throw e}
 return json(await env.DB.prepare(`SELECT ${collectionFields} FROM categories WHERE slug=?`).bind(data.slug).first());
}
export async function reorderCollection(env,data){
 if(typeof data?.slug!=='string'||!Number.isSafeInteger(data.version)||data.version<1||!Array.isArray(data.ids)||data.ids.length>500||new Set(data.ids).size!==data.ids.length||data.ids.some(v=>typeof v!=='string'||v.length>70||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)))fail('排序数据无效，最多500篇。');
 const nonce=crypto.randomUUID(),ids=JSON.stringify(data.ids);
 const members="SELECT p.id FROM posts p JOIN post_collections m ON p.id=m.post_id WHERE p.deleted_at IS NULL AND m.collection_slug=categories.slug AND m.state=CASE WHEN p.status='draft' THEN 'draft' ELSE 'published' END";
 const results=await env.DB.batch([
  env.DB.prepare(`UPDATE categories SET sort_mode='manual',version=version+1,mutation_token=? WHERE slug=? AND version=? AND (SELECT COUNT(*) FROM (${members}))=? AND (SELECT COUNT(*) FROM (${members}) WHERE id IN(SELECT value FROM json_each(?)))=?`).bind(nonce,data.slug,data.version,data.ids.length,ids,data.ids.length),
  env.DB.prepare("UPDATE post_collections SET position=(SELECT CAST(key AS INTEGER) FROM json_each(?) WHERE value=post_collections.post_id) WHERE collection_slug=? AND post_id IN(SELECT value FROM json_each(?)) AND EXISTS(SELECT 1 FROM categories WHERE slug=? AND mutation_token=?)").bind(ids,data.slug,ids,data.slug,nonce)
 ]);
 if(!results[0].meta.changes)fail('合集或文章列表已变化，请刷新后重新排序。',409);
 return json({version:data.version+1});
}
export async function moveCollectionPosts(env,data){
 if(typeof data?.slug!=='string'||!Array.isArray(data.items)||!data.items.length||data.items.length>50||data.items.some(x=>!x||typeof x.id!=='string'||x.id.length>70||!Number.isSafeInteger(x.version)||x.version<1)||new Set(data.items.map(x=>x.id)).size!==data.items.length||!['add','remove','move'].includes(data.action??'move'))fail('请选择有效文章，单次最多50篇。');
 const action=data.action??'move',target=await env.DB.prepare('SELECT name FROM categories WHERE slug=?').bind(data.slug).first();if(!target)fail('目标合集不存在。',404);
 if(action==='move'&&(typeof data.source!=='string'||data.source===data.slug))fail('请提供不同的来源合集。');
 const entries=JSON.stringify(data.items),nonce=crypto.randomUUID(),guard="EXISTS(SELECT 1 FROM posts WHERE id=post_collections.post_id AND collection_token=?)";
 const checks=action==='add'?"AND NOT EXISTS(SELECT 1 FROM posts p WHERE p.id IN(SELECT json_extract(value,'$.id') FROM json_each(?)) AND (SELECT COUNT(*) FROM post_collections m WHERE m.post_id=p.id AND m.state=CASE WHEN p.status='draft' THEN 'draft' ELSE 'published' END)>=20 AND NOT EXISTS(SELECT 1 FROM post_collections m WHERE m.post_id=p.id AND m.collection_slug=?))":"AND (SELECT COUNT(*) FROM posts p JOIN post_collections m ON m.post_id=p.id AND m.state=CASE WHEN p.status='draft' THEN 'draft' ELSE 'published' END WHERE p.id IN(SELECT json_extract(value,'$.id') FROM json_each(?)) AND m.collection_slug=?)=?";
 const args=action==='add'?[entries,data.slug]:[entries,action==='move'?data.source:data.slug,data.items.length];
 const stmts=[env.DB.prepare(`UPDATE posts SET version=version+1,collection_token=? WHERE deleted_at IS NULL AND id IN(SELECT json_extract(value,'$.id') FROM json_each(?)) AND (SELECT COUNT(*) FROM posts p JOIN json_each(?) j ON p.id=json_extract(j.value,'$.id') AND p.version=json_extract(j.value,'$.version') WHERE p.deleted_at IS NULL)=? AND EXISTS(SELECT 1 FROM categories WHERE slug=? AND name=?) ${checks}`).bind(nonce,entries,entries,data.items.length,data.slug,target.name,...args)];
 if(action!=='add')stmts.push(env.DB.prepare(`DELETE FROM post_collections WHERE collection_slug=? AND ${guard}`).bind(action==='move'?data.source:data.slug,nonce));
 if(action!=='remove')for(const state of ['published','draft'])stmts.push(env.DB.prepare(`INSERT INTO post_collections(post_id,collection_slug,state) SELECT id,?,? FROM posts WHERE collection_token=? AND ${state==='published'?"status='published'":"(draft_body IS NOT NULL OR status='draft')"} ON CONFLICT DO NOTHING`).bind(data.slug,state,nonce));
 // 保留首个名称兼容旧列表与旧客户端；其他关联始终保留。
 stmts.push(env.DB.prepare("UPDATE posts SET category=COALESCE((SELECT c.name FROM post_collections m JOIN categories c ON c.slug=m.collection_slug WHERE m.post_id=posts.id AND m.state='published' ORDER BY c.name LIMIT 1),''),draft_category=CASE WHEN draft_body IS NOT NULL THEN COALESCE((SELECT c.name FROM post_collections m JOIN categories c ON c.slug=m.collection_slug WHERE m.post_id=posts.id AND m.state='draft' ORDER BY c.name LIMIT 1),'') ELSE draft_category END WHERE collection_token=?").bind(nonce));
 stmts.push(env.DB.prepare('SELECT COUNT(*) AS changed FROM posts WHERE collection_token=?').bind(nonce));
 const results=await env.DB.batch(stmts);
 const changed=Number(results.at(-1).results[0].changed);
 if(changed!==data.items.length)fail('文章或合集已变化，请刷新后重试。',409);
 return json({changed});
}
const href=c=>'/collections/'+encodeURIComponent(c.slug)+'/';
function layout(title,description,path,body){return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(title)+' — itfetter</title><meta name="description" content="'+escapeHtml(description)+'"><link rel="canonical" href="https://itfetter.com'+path+'"><link rel="stylesheet" href="/assets/site.css"><link rel="stylesheet" href="/assets/front.css"><link rel="stylesheet" href="/assets/collections.css"></head><body><a class="skip-link" href="#main">跳到正文</a><header class="shell topbar"><a class="brand" href="/" aria-label="回到首页"><span class="brandmark">i</span><span>itfetter<span style="color:var(--accent)">.</span></span></a><nav class="nav" aria-label="主导航"><a href="/">首页</a><a href="/articles/">文章</a><a href="/collections/" aria-current="page">合集</a><a href="/archive/">归档</a><a href="/about/">关于我</a></nav></header><main id="main" class="shell collections-main">'+body+'</main><footer class="shell footer">© '+new Date().getFullYear()+' itfetter</footer></body></html>'}
export async function collectionPage(env,request){
 const url=new URL(request.url),collections=await listCollections(env),slug=url.pathname.split('/')[2];
 if(!slug){
  // 一次读取各可见合集的起读文章；与各自默认阅读顺序一致，不泄漏草稿。
  const starts=(await env.DB.prepare(`SELECT collection_slug,id,title FROM (SELECT m.collection_slug,p.id,p.title,ROW_NUMBER() OVER(PARTITION BY m.collection_slug ORDER BY CASE WHEN c.sort_mode='manual' THEN m.position END ASC,CASE WHEN c.sort_mode IN('manual','oldest') THEN p.published_at END ASC,CASE WHEN c.sort_mode='newest' THEN p.published_at END DESC,p.id) AS chapter FROM post_collections m JOIN posts p ON p.id=m.post_id JOIN categories c ON c.slug=m.collection_slug WHERE m.state='published' AND c.hidden=0 AND p.deleted_at IS NULL AND p.status='published' AND p.published_at<=?) WHERE chapter=1`).bind(new Date().toISOString()).all()).results;
  const firstBySlug=new Map(starts.map(p=>[p.collection_slug,p]));
  const cards=collections.map(c=>'<article class="collection-card"><a class="collection-card-main" href="'+href(c)+'">'+(c.cover?'<img src="'+escapeHtml(c.cover)+'" alt="" loading="lazy">':'<div class="collection-cover">'+escapeHtml(c.name.slice(0,1))+'</div>')+'<div class="collection-card-body"><h2>'+escapeHtml(c.name)+'</h2><p>'+escapeHtml(c.description||'围绕「'+c.name+'」整理的文章，按合集阅读顺序探索。')+'</p><small>'+c.article_count+' 篇文章 · '+c.reads+' 次阅读</small><span class="collection-directory-link">查看主题目录 →</span></div></a>'+(firstBySlug.has(c.slug)?'<div class="collection-start"><small>推荐从这里开始</small><a href="/articles/'+encodeURIComponent(firstBySlug.get(c.slug).id)+'/">'+escapeHtml(firstBySlug.get(c.slug).title)+' <span aria-hidden="true">→</span></a></div>':'')+'</article>').join('');
  return new Response(request.method==='HEAD'?null:layout('文章合集','按主题阅读，按顺序探索。','/collections/','<div class="collection-intro"><div><div class="eyebrow">COLLECTIONS</div><h1 class="page-title">按主题探索</h1><p>选一个感兴趣的主题，从起读文章进入，再沿着目录继续阅读。</p></div><a class="collection-all-articles" href="/articles/">只想看最新内容？浏览全部文章 →</a></div><div class="collection-grid">'+(cards||'<p>暂时没有公开合集。</p>')+'</div>'),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
 }
 const c=collections.find(c=>c.slug===slug);if(!c)return null;
 const order=['newest','oldest','manual'].includes(url.searchParams.get('order'))?url.searchParams.get('order'):c.sort_mode;
 const query=(url.searchParams.get('q')||'').trim().slice(0,120);
 const allPosts=(await env.DB.prepare(`SELECT id,title,summary,published_at,read_count,(SELECT position FROM post_collections m WHERE m.post_id=posts.id AND m.collection_slug=? AND m.state='published') AS collection_order FROM posts WHERE ${visible} AND EXISTS(SELECT 1 FROM post_collections m WHERE m.post_id=posts.id AND m.collection_slug=? AND m.state='published') ORDER BY ${sort(order)}`).bind(c.slug,new Date().toISOString(),c.slug).all()).results;
 const posts=allPosts.filter(p=>!query||(p.title+' '+p.summary).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const pages=Math.max(1,Math.ceil(posts.length/10)),page=Math.max(1,Math.min(pages,Number.parseInt(url.searchParams.get('page'),10)||1));
 const pageLink=n=>href(c)+'?'+new URLSearchParams({order,q:query,page:String(n)});
 const start=allPosts[0];
 const readingIntro='<section class="collection-guide"><div><h2>主题阅读目录</h2><p>默认'+({'newest':'最近发布优先','oldest':'最早发布优先','manual':'按作者编排的系列顺序'}[c.sort_mode])+'，可搜索本合集或切换顺序。</p></div>'+(start&&!query&&page===1?'<a class="collection-start-button" href="/articles/'+encodeURIComponent(start.id)+'/">从当前目录第一篇读起 →</a>':'')+'</section>';
 const body='<a href="/collections/">← 全部合集</a><div class="collection-heading">'+(c.cover?'<img src="'+escapeHtml(c.cover)+'" alt="">':'')+'<div><div class="eyebrow">COLLECTION</div><h1 class="page-title">'+escapeHtml(c.name)+'</h1><p>'+escapeHtml(c.description||'这一主题下的记录与思考。')+'</p><small>'+c.article_count+' 篇文章 · '+c.reads+' 次阅读</small></div></div>'+readingIntro+'<form class="collection-search" method="get"><input name="q" maxlength="120" aria-label="搜索合集文章" placeholder="搜索本合集…" value="'+escapeHtml(query)+'"><select name="order" aria-label="文章顺序">'+[['manual','系列顺序'],['newest','最近发布'],['oldest','最早发布']].map(([v,t])=>'<option value="'+v+'"'+(v===order?' selected':'')+'>'+t+'</option>').join('')+'</select><button>查找</button></form><ol class="collection-posts" start="'+((page-1)*10+1)+'">'+posts.slice((page-1)*10,page*10).map(p=>'<li><h2><a href="/articles/'+encodeURIComponent(p.id)+'/">'+escapeHtml(p.title)+'</a></h2><p>'+escapeHtml(p.summary)+'</p><small>'+escapeHtml(p.published_at.slice(0,10))+' · '+p.read_count+' 次阅读</small></li>').join('')+'</ol>'+(posts.length?'':'<p>没有匹配的文章。</p>')+'<nav class="collection-pagination" aria-label="合集分页">'+(page>1?'<a href="'+escapeHtml(pageLink(page-1))+'">← 上一页</a>':'')+'<span>'+page+' / '+pages+'</span>'+(page<pages?'<a href="'+escapeHtml(pageLink(page+1))+'">下一页 →</a>':'')+'</nav>';
 return new Response(request.method==='HEAD'?null:layout(c.name,c.description,href(c),body),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}
export async function collectionNavigation(env,article){
 const collections=(await env.DB.prepare(`SELECT ${collectionFields} FROM categories WHERE hidden=0 AND slug IN(SELECT collection_slug FROM post_collections WHERE post_id=? AND state='published') ORDER BY name`).bind(article.id).all()).results;
 const tags=[],sections=[];for(const c of collections){
 const posts=(await env.DB.prepare(`SELECT id,title,(SELECT position FROM post_collections m WHERE m.post_id=posts.id AND m.collection_slug=? AND m.state='published') AS collection_order FROM posts WHERE ${visible} AND EXISTS(SELECT 1 FROM post_collections m WHERE m.post_id=posts.id AND m.collection_slug=? AND m.state='published') ORDER BY ${sort(c.sort_mode)}`).bind(c.slug,new Date().toISOString(),c.slug).all()).results;
 const at=posts.findIndex(p=>p.id===article.id);if(at<0)continue;
 tags.push('<a class="collection-membership" href="'+href(c)+'">'+escapeHtml(c.name)+'</a>');
 const link=(p,label)=>'<a href="/articles/'+encodeURIComponent(p.id)+'/"><small>'+label+'</small><span>'+escapeHtml(p.title)+'</span></a>';
 // 仅显示相邻的其他文章；单篇合集只保留入口，不重复当前标题。
 if(posts.length>1)sections.push('<nav class="collection-neighbors" aria-label="'+escapeHtml(c.name)+'继续阅读"><div class="collection-neighbors-heading">'+escapeHtml(c.name)+' <small>第 '+(at+1)+' / '+posts.length+' 篇</small></div><div class="collection-neighbors-links">'+(posts[at-1]?link(posts[at-1],'← 上一篇'):'')+(posts[at+1]?link(posts[at+1],'下一篇 →'):'')+'</div></nav>');
 }
 return tags.length?'<aside class="article-collections" aria-label="所属合集"><div class="collection-memberships"><span>所属合集</span>'+tags.join('')+'</div>'+sections.join('')+'</aside>':'';
}
