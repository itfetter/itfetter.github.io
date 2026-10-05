import {digest} from './auth.js';
const response=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});
export async function submitMessage(request,env,data){
 if(!data||typeof data.name!=='string'||!data.name.trim()||data.name.length>80||
 typeof data.email!=='string'||data.email.length>254||
 (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))||
 typeof data.message!=='string'||!data.message.trim()||data.message.length>3000||
 typeof data.website!=='string'||data.website)return response({error:'请检查称呼、邮箱和留言内容。'},400);
 const now=Math.floor(Date.now()/1000),window=Math.floor(now/3600);
 const ip=request.headers.get('cf-connecting-ip')||'unknown';
 for(const [key,max] of [['ip:'+digest(ip),3],['global',100]]){
  const row=await env.DB.prepare('INSERT INTO contact_limits (key,window,attempts) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window=excluded.window THEN attempts+1 ELSE 1 END,window=excluded.window RETURNING attempts').bind(key,window).first();
  if(row.attempts>max)return response({error:'留言提交过于频繁，请稍后再试，或直接通过邮箱联系。'},429,{'retry-after':String(3600-now%3600)});
 }
 await env.DB.prepare('DELETE FROM contact_limits WHERE window<?').bind(window-1).run();
 await env.DB.prepare('INSERT INTO contact_messages (id,name,email,message,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),data.name.trim(),data.email.trim(),data.message.trim(),new Date().toISOString()).run();
 return response({ok:true},201);
}
export async function listMessages(env,url){
 const page=Number(url.searchParams.get('page')||1),status=url.searchParams.get('status')||'';
 if(!Number.isSafeInteger(page)||page<1||page>100000||!['','unread','read','trash'].includes(status))return response({error:'筛选参数无效。'},400);
 const condition=status==='trash'?' WHERE deleted_at IS NOT NULL':' WHERE deleted_at IS NULL'+(status?' AND status=?':''),values=status&&status!=='trash'?[status]:[];
 const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM contact_messages'+condition).bind(...values).first();
 const stats=await unreadMessages(env);
 const rows=await env.DB.prepare('SELECT id,name,email,message,status,created_at,deleted_at,version FROM contact_messages'+condition+' ORDER BY created_at DESC,id LIMIT 20 OFFSET ?').bind(...values,(page-1)*20).all();
 return response({items:rows.results,total:count.total,unread:stats.unread,readThrough:stats.readThrough,page,pageSize:20});
}
export async function markMessage(env,data){
 if(typeof data?.id!=='string'||! /^[a-f0-9-]{36}$/.test(data.id)||!['read','unread'].includes(data.status))return response({error:'留言参数无效。'},400);
 const result=await env.DB.prepare('UPDATE contact_messages SET status=?,version=version+1 WHERE id=? AND deleted_at IS NULL').bind(data.status,data.id).run();
 return result.meta.changes?response({ok:true}):response({error:'留言不存在。'},404);
}

export async function unreadMessages(env){
 const result=await env.DB.prepare("SELECT COUNT(CASE WHEN status='unread' THEN 1 END) AS unread,COALESCE(MAX(rowid),0) AS readThrough FROM contact_messages WHERE deleted_at IS NULL").first();
 return {unread:result.unread,readThrough:result.readThrough};
}
export async function readAllMessages(env,data){
 if(!Number.isSafeInteger(data?.through)||data.through<0)return response({error:'留言范围无效，请刷新后重试。'},400);
 const result=await env.DB.prepare("UPDATE contact_messages SET status='read',version=version+1 WHERE status='unread' AND deleted_at IS NULL AND rowid<=?").bind(data.through).run();
 return response({ok:true,changed:result.meta.changes,...await unreadMessages(env)});
}

export async function moveMessage(env,data,restore=false){
 if(typeof data?.id!=='string'||! /^[a-f0-9-]{36}$/.test(data.id)||!Number.isSafeInteger(data.version)||data.version<1)return response({error:'留言参数无效，请刷新后重试。'},400);
 const result=await env.DB.prepare('UPDATE contact_messages SET deleted_at=?,version=version+1 WHERE id=? AND version=? AND deleted_at IS '+(restore?'NOT NULL':'NULL')).bind(restore?null:new Date().toISOString(),data.id,data.version).run();
 return result.meta.changes?response({ok:true,...await unreadMessages(env)}):response({error:'留言已被其他操作修改，请刷新后重试。'},409);
}
