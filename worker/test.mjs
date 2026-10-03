import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import worker from './index.js';
const origin='https://itfetter.com';
const pair=await generateKeyPair('RS256',{extractable:true});
const jwk={...await exportJWK(pair.publicKey),kid:'test-key',alg:'RS256',use:'sig'};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>String(input)==='https://test-team.cloudflareaccess.com/cdn-cgi/access/certs'?new Response(JSON.stringify({keys:[jwk]}),{headers:{'content-type':'application/json'}}):originalFetch(input,options);
const token=async(email='owner@example.com',aud='blog',expires='1h')=>new SignJWT({email}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setIssuer('https://test-team.cloudflareaccess.com').setAudience(aud).setSubject('owner').setIssuedAt().setExpirationTime(expires).sign(pair.privateKey);
function setup(){
 const db=new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('migrations/0001_posts.sql',import.meta.url),'utf8'));
 const images=new Map();
 const env={ACCESS_TEAM_DOMAIN:'test-team.cloudflareaccess.com',ACCESS_AUD:'blog',ADMIN_EMAIL:'owner@example.com',
 DB:{prepare(sql){let values=[];return {bind(...args){values=args;return this},async first(){return db.prepare(sql).get(...values)||null},async all(){return {results:db.prepare(sql).all(...values)}},async run(){return {meta:{changes:db.prepare(sql).run(...values).changes}}}}}},
 IMAGES:{async put(key,bytes,options){images.set(key,{bytes,type:options.httpMetadata.contentType})},async get(key){const item=images.get(key);return item&&{body:item.bytes,httpEtag:'"test"',writeHttpMetadata(headers){headers.set('content-type',item.type)}}}},
 ASSETS:{async fetch(request){const path=new URL(request.url).pathname;return new Response(path==='/article-template.html'?'<title>@@TITLE@@</title><article>@@BODY@@</article>':path==='/admin/'?'admin':'home')}}};
 return {env,db,images,async request(path,method='GET',data,auth){return worker.fetch(new Request(origin+path,{method,headers:{...(auth?{'cf-access-jwt-assertion':auth}:{}),...(method!=='GET'?{origin,'content-type':'application/json'}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}),env)}};
}
const article={slug:'hello',title:'欢迎<script>alert(1)</script>',category:'随笔',summary:'测试摘要',body:'# 标题\n\n**正文**\n\n<script>alert(1)</script>\n<img src=x onerror="alert(1)">'};
test('管理页面和 API 必须验证签名、受众、有效期与管理员身份',async()=>{
 const s=setup();
 for(const path of ['/admin/','/api/me','/api/posts']) assert.equal((await s.request(path)).status,401);
 for(const jwt of ['forged',await token('other@example.com'),await token('owner@example.com','wrong'),await token('owner@example.com','blog','-1h')]) assert.equal((await s.request('/api/me','GET',undefined,jwt)).status,401);
 const forged=(await token()).split('.');forged[2]='A'.repeat(forged[2].length);assert.equal((await s.request('/api/me','GET',undefined,forged.join('.'))).status,401);
 assert.equal((await s.request('/api/me','GET',undefined,await token())).status,200);
 s.env.ENVIRONMENT='development'; assert.equal((await s.request('/api/me')).status,401);
 s.db.close();
});
test('D1 文章发布、读取、并发版本检查、删除和旧链接',async()=>{
 const s=setup(),jwt=await token();
 assert.equal((await s.request('/api/post','PUT',article,jwt)).status,201);
 assert.equal((await s.request('/api/post','PUT',article,jwt)).status,409);
 assert.equal((await s.request('/api/post?id=../secret','GET',undefined,jwt)).status,400);
 const post=await (await s.request('/api/post?id=hello','GET',undefined,jwt)).json();assert.equal(post.version,1);
 assert.equal((await s.request('/articles/hello/')).status,200);
 const script=await (await s.request('/posts.js')).text(); assert.match(script,/const posts/);assert.doesNotMatch(script,/<script>|onerror/);
 const html=await (await s.request('/articles/hello/')).text();assert.match(html,/&lt;script&gt;/);assert.match(html,/<strong>正文<\/strong>/);assert.doesNotMatch(html,/<script>|onerror/);
 assert.equal((await s.request('/api/post','PUT',{...article,id:'hello',version:1},jwt)).status,200);
 assert.equal((await s.request('/api/post','PUT',{...article,id:'hello',version:1},jwt)).status,409);
 assert.equal((await s.request('/api/post','DELETE',{id:'hello',version:1},jwt)).status,409);
 assert.equal((await s.request('/api/post','DELETE',{id:'hello',version:2},jwt)).status,200);
 assert.equal((await s.request('/articles/hello/')).status,404);s.db.close();
});
test('拒绝跨站写入、无效 JSON、非法图片；R2 上传与公开读取',async()=>{
 const s=setup(),jwt=await token();
 const request=new Request(origin+'/api/post',{method:'PUT',headers:{origin:'https://evil.example','cf-access-jwt-assertion':jwt},body:JSON.stringify(article)});
 assert.equal((await worker.fetch(request,s.env)).status,403);
 assert.equal((await worker.fetch(new Request(origin+'/api/post',{method:'PUT',headers:{origin,'cf-access-jwt-assertion':jwt},body:'{' }),s.env)).status,400);
 assert.equal((await s.request('/api/post','PUT',{...article,body:'a'.repeat(400001)},jwt)).status,413);
 assert.equal((await s.request('/api/image','POST',{type:'image/png',base64:btoa('not an image')},jwt)).status,400);
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5p8AAAAASUVORK5CYII=';
 const result=await s.request('/api/image','POST',{type:'image/png',base64:png,alt:'配图'},jwt);assert.equal(result.status,201);
 const saved=await result.json(),image=await s.request(saved.path);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.deepEqual(new Uint8Array(await image.arrayBuffer()),Uint8Array.from(atob(png),c=>c.charCodeAt(0)));s.db.close();
});
test('未来文章不公开；SQL 导入保留原日期和链接且不会覆盖已有内容',async()=>{
 const s=setup();s.db.exec(readFileSync(new URL('../.migration/posts.sql',import.meta.url),'utf8'));
 const rows=s.db.prepare('SELECT * FROM posts').all();assert.equal(rows.length,5);assert.equal(rows.find(p=>p.id==='hello').permalink,'/articles/hello/');
 s.db.exec("UPDATE posts SET title='已编辑' WHERE id='hello'");s.db.exec(readFileSync(new URL('../.migration/posts.sql',import.meta.url),'utf8'));assert.equal(s.db.prepare("SELECT title FROM posts WHERE id='hello'").get().title,'已编辑');
 s.db.exec("UPDATE posts SET published_at='2999-01-01T00:00:00.000Z' WHERE id='hello'");assert.equal((await s.request('/articles/hello/')).status,404);assert.doesNotMatch(await (await s.request('/posts.js')).text(),/"id":"hello"/);s.db.close();
});
