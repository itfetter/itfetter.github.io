import {digest} from './auth.js';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const slug=value=>typeof value==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)&&value.length<=70;
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const visible="status='published' AND published_at<=?";
export async function submitComment(request,env,data){
 if(!data||!slug(data.post_id)||!uuid(data.id)||typeof data.name!=='string'||!data.name.trim()||data.name.length>80||/[\u0000-\u001f\u007f]/.test(data.name)||typeof data.content!=='string'||!data.content.trim()||data.content.length>3000||typeof data.website!=='string'||data.website)return json({error:'请填写有效昵称和评论（最多3000字）。'},400);
 const now=new Date().toISOString();
 const post=await env.DB.prepare('SELECT id FROM posts WHERE id=? AND '+visible).bind(data.post_id,now).first();
 if(!post)return json({error:'文章不存在或尚未发布。'},404);
 // 提交ID支持人工重试；相同提交不重复写入或重复消耗额度。
 const previous=await env.DB.prepare('SELECT post_id,name,content FROM article_comments WHERE id=?').bind(data.id).first();
 if(previous)return previous.post_id===data.post_id&&previous.name===data.name.trim()&&previous.content===data.content.trim()?json({ok:true,pending:true},201):json({error:'提交标识已使用，请重新编辑评论后提交。'},409);
 const seconds=Math.floor(Date.now()/1000),window=Math.floor(seconds/3600),ip=request.headers.get('cf-connecting-ip')||'unknown';
 for(const [key,max] of [['ip:'+digest(ip),5],['global',100]]){
  const row=await env.DB.prepare('INSERT INTO comment_limits (key,window,attempts) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window=excluded.window THEN attempts+1 ELSE 1 END,window=excluded.window RETURNING attempts').bind(key,window).first();
  if(row.attempts>max)return json({error:'评论提交过于频繁，请稍后再试。'},429,{'retry-after':String(3600-seconds%3600)});
 }
 await env.DB.prepare('DELETE FROM comment_limits WHERE window<?').bind(window-1).run();
 const result=await env.DB.prepare("INSERT INTO article_comments(id,post_id,name,content,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM posts WHERE id=? AND "+visible+") ON CONFLICT DO NOTHING").bind(data.id,data.post_id,data.name.trim(),data.content.trim(),now,data.post_id,now).run();
 if(!result.meta.changes){
  const duplicate=await env.DB.prepare('SELECT post_id,name,content FROM article_comments WHERE id=?').bind(data.id).first();
  if(!duplicate)return json({error:'文章已移除，请刷新。'},404);
  if(duplicate.post_id!==data.post_id||duplicate.name!==data.name.trim()||duplicate.content!==data.content.trim())return json({error:'提交冲突，请重新编辑评论后提交。'},409);
 }
 return json({ok:true,pending:true},201);
}
export async function publicComments(env,url){
 const id=url.searchParams.get('post_id'),page=Number(url.searchParams.get('page')||1);
 if(!slug(id)||!Number.isSafeInteger(page)||page<1||page>100000)return json({error:'评论参数无效。'},400);
 const post=await env.DB.prepare('SELECT id FROM posts WHERE id=? AND '+visible).bind(id,new Date().toISOString()).first();
 if(!post)return json({error:'文章不存在。'},404);
 const condition="post_id=? AND status='approved' AND deleted_at IS NULL";
 const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM article_comments WHERE '+condition).bind(id).first();
 const rows=await env.DB.prepare('SELECT id,name,content,reply,created_at,replied_at FROM article_comments WHERE '+condition+' ORDER BY created_at DESC,id LIMIT 20 OFFSET ?').bind(id,(page-1)*20).all();
 return json({items:rows.results,total:count.total,page,pageSize:20});
}
export async function managedComments(env,url){
 const status=url.searchParams.get('status')||'pending',page=Number(url.searchParams.get('page')||1);
 if(!['pending','approved','hidden','all','trash'].includes(status)||!Number.isSafeInteger(page)||page<1||page>100000)return json({error:'评论筛选无效。'},400);
 const condition=status==='trash'?'c.deleted_at IS NOT NULL':'c.deleted_at IS NULL'+(status==='all'?'':' AND c.status=?'),args=['trash','all'].includes(status)?[]:[status];
 const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM article_comments c WHERE '+condition).bind(...args).first();
 const pending=await env.DB.prepare("SELECT COUNT(*) AS total FROM article_comments WHERE status='pending' AND deleted_at IS NULL").first();
 const rows=await env.DB.prepare('SELECT c.*,p.title AS post_title FROM article_comments c JOIN posts p ON p.id=c.post_id WHERE '+condition+' ORDER BY c.created_at DESC,c.id LIMIT 20 OFFSET ?').bind(...args,(page-1)*20).all();
 return json({items:rows.results,total:count.total,pending:pending.total,page,pageSize:20});
}
export async function moderateComment(env,data){
 if(!uuid(data?.id)||!Number.isSafeInteger(data.version)||data.version<1||!['approve','hide','trash','restore','reply'].includes(data.action))return json({error:'评论操作无效，请刷新重试。'},400);
 let set='',args=[],condition='deleted_at IS NULL';
 if(data.action==='approve')set="status='approved'";
 if(data.action==='hide')set="status='hidden'";
 if(data.action==='trash'){set='deleted_at=?';args=[new Date().toISOString()]}
 if(data.action==='restore'){set='deleted_at=NULL';condition='deleted_at IS NOT NULL'}
 if(data.action==='reply'){
  if(typeof data.reply!=='string'||data.reply.length>3000)return json({error:'回复最多3000字。'},400);
  set='reply=?,replied_at=?';args=[data.reply.trim(),data.reply.trim()?new Date().toISOString():null];
 }
 const result=await env.DB.prepare('UPDATE article_comments SET '+set+',version=version+1 WHERE id=? AND version=? AND '+condition).bind(...args,data.id,data.version).run();
 return result.meta.changes?json({ok:true}):json({error:'评论已变化，请刷新后重试。'},409);
}
