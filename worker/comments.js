import {digest} from './auth.js';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const slug=value=>typeof value==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)&&value.length<=70;
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const visible="status='published' AND published_at<=?";
async function acceptedComment(env,id){
 const item=await env.DB.prepare("SELECT c.id,c.name,c.content,c.reply,c.created_at,c.replied_at,t.name AS target_name FROM article_comments c JOIN posts p ON p.id=c.post_id LEFT JOIN article_comments t ON t.id=c.target_id AND t.status='approved' AND t.deleted_at IS NULL WHERE c.id=? AND c.status='approved' AND c.deleted_at IS NULL AND p.status='published' AND p.published_at<=? AND (c.root_id IS NULL OR EXISTS (SELECT 1 FROM article_comments r WHERE r.id=c.root_id AND r.status='approved' AND r.deleted_at IS NULL))").bind(id,new Date().toISOString()).first();
 return json({ok:true,item},201);
}
export async function submitComment(request,env,data){
 if(!data||!slug(data.post_id)||!uuid(data.id)||typeof data.name!=='string'||!data.name.trim()||data.name.length>80||/[\u0000-\u001f\u007f]/.test(data.name)||typeof data.content!=='string'||!data.content.trim()||data.content.length>3000||typeof data.website!=='string'||data.website)return json({error:'请填写有效昵称和评论（最多3000字）。'},400);
 const target=data.target_id??null;
 if(target!==null&&!uuid(target))return json({error:'回复对象无效。'},400);
 const now=new Date().toISOString();
 const post=await env.DB.prepare('SELECT id FROM posts WHERE id=? AND '+visible).bind(data.post_id,now).first();
 if(!post)return json({error:'文章不存在或尚未发布。'},404);
 // 提交ID支持人工重试；相同提交不重复写入或重复消耗额度。
 const previous=await env.DB.prepare('SELECT post_id,name,content,target_id FROM article_comments WHERE id=?').bind(data.id).first();
 if(previous)return previous.post_id===data.post_id&&previous.name===data.name.trim()&&previous.content===data.content.trim()&&previous.target_id===target?acceptedComment(env,data.id):json({error:'提交标识已使用，请重新编辑评论后提交。'},409);
 let rootId=null;
 if(target){
  const parent=await env.DB.prepare("SELECT c.id,c.root_id FROM article_comments c JOIN article_comments r ON r.id=COALESCE(c.root_id,c.id) WHERE c.id=? AND c.post_id=? AND c.status='approved' AND c.deleted_at IS NULL AND r.post_id=c.post_id AND r.root_id IS NULL AND r.status='approved' AND r.deleted_at IS NULL").bind(target,data.post_id).first();
  if(!parent)return json({error:'回复对象已隐藏或不存在，请刷新评论。'},404);
  rootId=parent.root_id||parent.id;
 }
 const seconds=Math.floor(Date.now()/1000),window=Math.floor(seconds/3600),ip=request.headers.get('cf-connecting-ip')||'unknown';
 for(const [key,max] of [['ip:'+digest(ip),5],['global',100]]){
  const row=await env.DB.prepare('INSERT INTO comment_limits (key,window,attempts) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window=excluded.window THEN attempts+1 ELSE 1 END,window=excluded.window RETURNING attempts').bind(key,window).first();
  if(row.attempts>max)return json({error:'评论提交过于频繁，请稍后再试。'},429,{'retry-after':String(3600-seconds%3600)});
 }
 await env.DB.prepare('DELETE FROM comment_limits WHERE window<?').bind(window-1).run();
 const result=await env.DB.prepare("INSERT INTO article_comments(id,post_id,name,content,created_at,root_id,target_id,status) SELECT ?,?,?,?,?,?,?,'approved' WHERE (? IS NULL OR EXISTS (SELECT 1 FROM article_comments c JOIN article_comments r ON r.id=COALESCE(c.root_id,c.id) WHERE c.id=? AND c.post_id=? AND c.status='approved' AND c.deleted_at IS NULL AND r.id=? AND r.status='approved' AND r.deleted_at IS NULL)) AND EXISTS (SELECT 1 FROM posts WHERE id=? AND "+visible+") ON CONFLICT DO NOTHING").bind(data.id,data.post_id,data.name.trim(),data.content.trim(),now,rootId,target,target,target,data.post_id,rootId,data.post_id,now).run();
 if(!result.meta.changes){
  const duplicate=await env.DB.prepare('SELECT post_id,name,content,target_id FROM article_comments WHERE id=?').bind(data.id).first();
  if(!duplicate)return json({error:'文章已移除，请刷新。'},404);
  if(duplicate.post_id!==data.post_id||duplicate.name!==data.name.trim()||duplicate.content!==data.content.trim()||duplicate.target_id!==target)return json({error:'提交冲突，请重新编辑评论后提交。'},409);
 }
 return acceptedComment(env,data.id);
}
export async function publicComments(env,url){
 const id=url.searchParams.get('post_id'),page=Number(url.searchParams.get('page')||1);
 if(!slug(id)||!Number.isSafeInteger(page)||page<1||page>100000)return json({error:'评论参数无效。'},400);
 const post=await env.DB.prepare('SELECT id FROM posts WHERE id=? AND '+visible).bind(id,new Date().toISOString()).first();
 if(!post)return json({error:'文章不存在。'},404);
 const rootId=url.searchParams.get('root_id');
 if(rootId&&!uuid(rootId))return json({error:'回复参数无效。'},400);
 if(rootId&&!await env.DB.prepare("SELECT id FROM article_comments WHERE id=? AND post_id=? AND root_id IS NULL AND status='approved' AND deleted_at IS NULL").bind(rootId,id).first())return json({error:'原评论不存在或已隐藏。'},404);
 const condition="c.post_id=? AND c.status='approved' AND c.deleted_at IS NULL AND "+(rootId?'c.root_id=?':'c.root_id IS NULL'),args=rootId?[id,rootId]:[id],pageSize=rootId?10:20;
 const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM article_comments c WHERE '+condition).bind(...args).first();
 const fields=rootId?"t.name AS target_name":"(SELECT COUNT(*) FROM article_comments r WHERE r.root_id=c.id AND r.status='approved' AND r.deleted_at IS NULL) AS reply_count";
 const rows=await env.DB.prepare('SELECT c.id,c.name,c.content,c.reply,c.created_at,c.replied_at,'+fields+' FROM article_comments c LEFT JOIN article_comments t ON t.id=c.target_id AND t.status=\'approved\' AND t.deleted_at IS NULL WHERE '+condition+' ORDER BY c.created_at '+(rootId?'ASC':'DESC')+',c.id LIMIT ? OFFSET ?').bind(...args,pageSize,(page-1)*pageSize).all();
 return json({items:rows.results,total:count.total,page,pageSize});
}
export async function managedComments(env,url){
 const status=url.searchParams.get('status')||'all',page=Number(url.searchParams.get('page')||1),post=url.searchParams.get('post_id')||'',query=(url.searchParams.get('q')||'').trim();
 if(!['pending','approved','hidden','all','trash'].includes(status)||!Number.isSafeInteger(page)||page<1||page>100000||(post&&!slug(post))||query.length>120)return json({error:'评论筛选无效。'},400);
 let condition=status==='trash'?'c.deleted_at IS NOT NULL':'c.deleted_at IS NULL'+(status==='all'?'':' AND c.status=?');
 const args=['trash','all'].includes(status)?[]:[status];
 if(post){condition+=' AND c.post_id=?';args.push(post)}
 if(query){condition+=' AND (instr(lower(c.name),lower(?))>0 OR instr(lower(c.content),lower(?))>0 OR instr(lower(c.reply),lower(?))>0)';args.push(query,query,query)}
 const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM article_comments c WHERE '+condition).bind(...args).first();
 const pending=await env.DB.prepare("SELECT COUNT(*) AS total FROM article_comments WHERE status='pending' AND deleted_at IS NULL").first();
 const rows=await env.DB.prepare('SELECT c.*,p.title AS post_title,t.name AS target_name FROM article_comments c LEFT JOIN article_comments t ON t.id=c.target_id JOIN posts p ON p.id=c.post_id WHERE '+condition+' ORDER BY c.created_at DESC,c.id LIMIT 20 OFFSET ?').bind(...args,(page-1)*20).all();
 return json({items:rows.results,total:count.total,pending:pending.total,page,pageSize:20});
}
export async function moderateComment(env,data){
 if(!uuid(data?.id)||!Number.isSafeInteger(data.version)||data.version<1||!['approve','hide','trash','restore','reply','purge'].includes(data.action))return json({error:'评论操作无效，请刷新重试。'},400);
 if(data.action==='purge')return bulkComments(env,{action:'purge',items:[{id:data.id,version:data.version}],confirm:data.confirm});
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

export async function bulkComments(env,data){
 const items=data?.items,action=data?.action;
 if(!['approve','hide','trash','restore','purge'].includes(action)||!Array.isArray(items)||!items.length||items.length>20||new Set(items.map(i=>i?.id)).size!==items.length||items.some(i=>!uuid(i?.id)||!Number.isSafeInteger(i.version)||i.version<1))return json({error:'请选择本页有效评论，最多20条。'},400);
 if(action==='purge'&&data.confirm!==true)return json({error:'请明确确认彻底删除，删除后无法恢复。'},400);
 const condition='deleted_at IS '+(['restore','purge'].includes(action)?'NOT NULL':'NULL')+' AND ('+items.map(()=>'(id=? AND version=?)').join(' OR ')+')';
 const values=items.flatMap(i=>[i.id,i.version]);
 if(action==='purge'){
  // 固定整批版本快照后再删除；原评论的访客回复由已有外键级联清除。
  const result=await env.DB.prepare('WITH chosen AS MATERIALIZED (SELECT id FROM article_comments WHERE '+condition+') DELETE FROM article_comments WHERE id IN (SELECT id FROM chosen) AND (SELECT COUNT(*) FROM chosen)=? RETURNING id').bind(...values,items.length).all();
  return result.results.length?json({ok:true,changed:items.length}):json({error:'选中评论已变化，请刷新后重新选择。'},409);
 }
 const set={approve:"status='approved'",hide:"status='hidden'",trash:'deleted_at=?',restore:'deleted_at=NULL'}[action];
 // 单条条件更新校验全部版本；任意缺失/冲突时整批不写入。
 const result=await env.DB.prepare('UPDATE article_comments SET '+set+',version=version+1 WHERE '+condition+' AND (SELECT COUNT(*) FROM article_comments WHERE '+condition+')=?').bind(...(action==='trash'?[new Date().toISOString()]:[]),...values,...values,items.length).run();
 return result.meta.changes===items.length?json({ok:true,changed:result.meta.changes}):json({error:'选中评论已变化，请刷新后重新选择。'},409);
}
