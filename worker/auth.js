// 单管理员认证；不保存密码原文或会话令牌原文。
import { scrypt, timingSafeEqual, randomBytes, createHash } from 'node:crypto';
const OPTIONS = {N:16384, r:8, p:5, maxmem:32*1024*1024};
const derive = (password,salt) => new Promise((resolve,reject) => scrypt(password,salt,32,OPTIONS,(error,key)=>error?reject(error):resolve(key)));
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) throw Error('密码长度须为 6–128 个字符。');
  const salt=randomBytes(16).toString('hex');
  return 'scrypt$16384$8$5$'+salt+'$'+(await derive(password,salt)).toString('hex');
}
export async function verifyPassword(password,encoded) {
  if (typeof password !== 'string' || password.length > 128) return false;
  if (!/^scrypt\$16384\$8\$5\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(encoded||'')) return false;
  const parts=encoded.split('$'),key=await derive(password,parts[4]);
  return timingSafeEqual(key,Buffer.from(parts[5],'hex'));
}
export const digest = value => createHash('sha256').update(value).digest('hex');
const DUMMY='scrypt$16384$8$5$'+'0'.repeat(32)+'$'+'0'.repeat(64);
const ttl=8*60*60;
function local(request,env) {
  const url=new URL(request.url);
  return env.ENVIRONMENT==='development' && url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname);
}
export function secureTransport(request,env) {return new URL(request.url).protocol==='https:' || local(request,env);}
function name(request,env) {return local(request,env)?'blog_session_local':'__Host-blog_session';}
function cookie(request,env,value,age) {
  return `${name(request,env)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}`+(local(request,env)?'':'; Secure');
}
function token(request,env) {
  const matches=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name(request,env)+'='));
  if(matches.length!==1) return null;
  const value=matches[0].slice(name(request,env).length+1);
  return /^[a-f0-9]{64}$/.test(value)?value:null;
}
export async function identity(request,env) {
  if(!secureTransport(request,env))return null;
  const value=token(request,env);if(!value)return null;
  return env.DB.prepare('SELECT u.username,u.updated_at FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND s.auth_version=u.updated_at')
    .bind(digest(value),Math.floor(Date.now()/1000)).first();
}
const response=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
async function limitAttempts(request,env) {
  const now=Math.floor(Date.now()/1000),window=Math.floor(now/900);
  // 每次尝试先原子计数；无需先读取再更新，多个实例共享限制。
  const ip=request.headers.get('cf-connecting-ip') || (local(request,env)?'localhost':'unknown');
  for(const [key,maximum] of [['global',100],['ip:'+digest(ip),10]]) {
    const row=await env.DB.prepare('INSERT INTO login_limits (key,window,attempts) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window=excluded.window THEN attempts+1 ELSE 1 END,window=excluded.window RETURNING attempts').bind(key,window).first();
    if(row.attempts>maximum)return response({error:'登录尝试过多，请稍后再试。'},429,{'retry-after':String(900-now%900)});
  }
  await env.DB.prepare('DELETE FROM login_limits WHERE window<?').bind(window-1).run();
  return null;
}
export async function login(request,env,data) {
  const limited=await limitAttempts(request,env);if(limited)return limited;
  const now=Math.floor(Date.now()/1000);
  if(typeof data?.username!=='string'||data.username.length>100||typeof data.password!=='string'||data.password.length>128)return response({error:'账号或密码错误。'},401);
  const user=await env.DB.prepare('SELECT id,username,password_hash,updated_at FROM admin_users WHERE id=1').first();
  const valid=await verifyPassword(data.password,user?.password_hash||DUMMY);
  if(!valid||data.username!==user?.username)return response({error:'账号或密码错误。'},401);
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').bind(now).run();
  // 换发全新随机会话；登录前 Cookie 不参与新会话生成。
  const previous=token(request,env);
  if(previous)await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(digest(previous)).run();
  const value=randomBytes(32).toString('hex');
  await env.DB.prepare('INSERT INTO admin_sessions (token_hash,user_id,auth_version,expires_at) VALUES (?,?,?,?)').bind(digest(value),user.id,user.updated_at,now+ttl).run();
  return response({ok:true},200,{'set-cookie':cookie(request,env,value,ttl)});
}
export async function logout(request,env) {
  const value=token(request,env);
  if(value)await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(digest(value)).run();
  return response({ok:true},200,{'set-cookie':cookie(request,env,'',0)});
}

export async function changePassword(request,env,data) {
  const session=await identity(request,env);
  if(!session)return response({error:'请重新登录。'},401);
  const limited=await limitAttempts(request,env);if(limited)return limited;
  if(typeof data?.currentPassword!=='string'||data.currentPassword.length>128 ||
     typeof data.newPassword!=='string'||data.newPassword.length<6||data.newPassword.length>128)
    return response({error:'新密码须为 6–128 个字符。'},400);
  if(data.newPassword!==data.confirmPassword)return response({error:'两次新密码不一致。'},400);
  const user=await env.DB.prepare('SELECT id,username,password_hash,updated_at FROM admin_users WHERE id=1').first();
  if(!user||user.updated_at!==session.updated_at)return response({error:'会话已失效，请重新登录。'},401);
  if(!await verifyPassword(data.currentPassword,user.password_hash))return response({error:'当前密码错误。'},400);
  const hash=await hashPassword(data.newPassword);
  // 唯一版本避免同毫秒更新；条件更新防止并发改密覆盖。
  const version=new Date().toISOString()+':'+randomBytes(16).toString('hex');
  const result=await env.DB.prepare('UPDATE admin_users SET password_hash=?,updated_at=? WHERE id=1 AND updated_at=?')
    .bind(hash,version,user.updated_at).run();
  if(!result.meta.changes)return response({error:'密码已被修改，请重新登录。'},409);
  // 版本更新即刻使所有旧会话失效，随后清理旧记录。
  await env.DB.prepare('DELETE FROM admin_sessions WHERE auth_version<>?').bind(version).run();
  return response({ok:true},200,{'set-cookie':cookie(request,env,'',0)});
}
