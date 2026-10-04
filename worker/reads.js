import {digest,identity} from './auth.js';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export async function recordRead(request,env,data){
 if(typeof data?.id!=='string'||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.id)||data.id.length>70)return reply({error:'文章标识无效。'},400);
 const post=await env.DB.prepare("SELECT read_count FROM posts WHERE id=? AND status='published' AND published_at<=?").bind(data.id,new Date().toISOString()).first();
 if(!post)return reply({error:'文章不存在。'},404);
 const ua=(request.headers.get('user-agent')||'').slice(0,500);
 if(/bot|crawler|spider|headless|preview/i.test(ua)||await identity(request,env))return reply({count:post.read_count,counted:false});
 const now=Math.floor(Date.now()/1000),window=Math.floor(now/3600),ip=request.headers.get('cf-connecting-ip')||'unknown';
 for(const [key,max] of [['ip:'+digest(ip),60],['global',2000]]){
  const row=await env.DB.prepare('INSERT INTO read_limits (key,window,attempts) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window=excluded.window THEN attempts+1 ELSE 1 END,window=excluded.window RETURNING attempts').bind(key,window).first();
  if(row.attempts>max)return reply({count:post.read_count,counted:false},429);
 }
 await env.DB.prepare('DELETE FROM article_reads WHERE expires_at<=?').bind(now).run();
 await env.DB.prepare('DELETE FROM read_limits WHERE window<?').bind(window-1).run();
 const key=digest(JSON.stringify([ip,ua,data.id,window]));
 const recorded=await env.DB.prepare("INSERT INTO article_reads (key,post_id,expires_at) SELECT ?,id,? FROM posts WHERE id=? AND status='published' AND published_at<=? ON CONFLICT(key) DO NOTHING RETURNING key").bind(key,(window+1)*3600,data.id,new Date().toISOString()).first();
 const updated=await env.DB.prepare('SELECT read_count FROM posts WHERE id=?').bind(data.id).first();
 return reply({count:updated?.read_count??post.read_count,counted:!!recorded});
}
