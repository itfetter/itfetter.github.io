import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {hashPassword,verifyPassword,identity,login,logout,digest} from './auth.js';
const password='test-only-long-password-42';
const encoded=await hashPassword(password);
function setup(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('migrations/0002_auth.sql',import.meta.url),'utf8'));
 const env={DB:{prepare(sql){let values=[];return {bind(...args){values=args;return this},async first(){return db.prepare(sql).get(...values)||null},async run(){return {meta:{changes:db.prepare(sql).run(...values).changes}}}}}}};
 db.prepare('INSERT INTO admin_users VALUES (1,?,?,?)').run('admin',encoded,new Date().toISOString());
 return {db,env,request(cookie='',ip='192.0.2.1'){return new Request('https://blog.example/api/login',{method:'POST',headers:{origin:'https://blog.example',cookie,'cf-connecting-ip':ip}})}};
}
test('密码使用随机盐，拒绝错误密码和无效哈希',async()=>{
 assert.notEqual(await hashPassword(password),encoded);assert.ok(await verifyPassword(password,encoded));
 assert.equal(await verifyPassword('wrong',encoded),false);assert.equal(await verifyPassword(password,'invalid'),false);
 await assert.rejects(()=>hashPassword('short'));
});
test('会话哈希存储、Cookie 安全属性、过期及退出撤销',async()=>{
 const s=setup();try{
 assert.equal(await identity(s.request(),s.env),null);
 const response=await login(s.request(),s.env,{username:'admin',password});assert.equal(response.status,200);
 const header=response.headers.get('set-cookie');for(const v of ['__Host-blog_session=','HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(header.includes(v));
 const cookie=header.split(';')[0],raw=cookie.split('=')[1];
 assert.equal(s.db.prepare('SELECT token_hash FROM admin_sessions').get().token_hash,digest(raw));
 assert.equal((await identity(s.request(cookie),s.env)).username,'admin');
 assert.equal(await identity(s.request(cookie+'; '+cookie),s.env),null);
 const rotated=await login(s.request(cookie),s.env,{username:'admin',password});assert.notEqual(rotated.headers.get('set-cookie'),header);
 assert.equal(await identity(s.request(cookie),s.env),null);
 const next=rotated.headers.get('set-cookie').split(';')[0];
 await logout(s.request(next),s.env);assert.equal(await identity(s.request(next),s.env),null);
 const expired=await login(s.request(),s.env,{username:'admin',password});
  s.db.exec("UPDATE admin_users SET updated_at='new-password-version'");
  assert.equal(await identity(s.request(expired.headers.get('set-cookie').split(';')[0]),s.env),null);
 s.db.exec('UPDATE admin_sessions SET expires_at=0');assert.equal(await identity(s.request(expired.headers.get('set-cookie').split(';')[0]),s.env),null);
 }finally{s.db.close();}
});
test('未知账号与错误密码统一拒绝，无管理员时不开放登录',async()=>{
 const s=setup();try{
 assert.equal((await login(s.request(),s.env,{username:'other',password})).status,401);
 assert.equal((await login(s.request(),s.env,{username:'admin',password:'wrong'})).status,401);
 s.db.exec('DELETE FROM admin_users');assert.equal((await login(s.request(),s.env,{username:'admin',password})).status,401);
 }finally{s.db.close();}
});
test('共享数据库限速原子计数，窗口重置、HTTP 与本地模式边界',async()=>{
 const s=setup();try{
 s.db.prepare('INSERT INTO login_limits VALUES (?,?,?)').run('ip:'+digest('192.0.2.1'),Math.floor(Date.now()/900000),10);
 assert.equal((await login(s.request(),s.env,{username:'admin',password})).status,429);
 s.db.exec('UPDATE login_limits SET window=0');assert.equal((await login(s.request(),s.env,{username:'admin',password})).status,200);
 s.env.ENVIRONMENT='development';assert.equal(await identity(new Request('http://blog.example/admin/'),s.env),null);
 const local=new Request('http://localhost/api/login',{method:'POST'});
 const result=await login(local,s.env,{username:'admin',password});assert.ok(result.headers.get('set-cookie').startsWith('blog_session_local='));
 assert.equal(await identity(new Request('http://localhost/admin/'),s.env),null);
 }finally{s.db.close();}
});
