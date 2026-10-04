import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {digest} from './auth.js';
import worker from './index.js';
const origin='https://itfetter.com';
const sessionToken='a'.repeat(64);
const token=async()=> '__Host-blog_session='+sessionToken;
function setup(){
 const db=new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('migrations/0001_posts.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('migrations/0002_auth.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('migrations/0003_drafts.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('migrations/0004_contact.sql',import.meta.url),'utf8'));
 db.prepare('INSERT INTO admin_users VALUES (1,?,?,?)').run('admin','not-used-in-this-test','test-version');
 db.prepare('INSERT INTO admin_sessions VALUES (?,1,?,?)').run(digest(sessionToken),'test-version',Math.floor(Date.now()/1000)+3600);
 const images=new Map();
 const env={
 DB:{prepare(sql){let values=[];return {bind(...args){values=args;return this},async first(){return db.prepare(sql).get(...values)||null},async all(){return {results:db.prepare(sql).all(...values)}},async run(){return {meta:{changes:db.prepare(sql).run(...values).changes}}}}}},
 IMAGES:{async put(key,bytes,options){images.set(key,{bytes,type:options.httpMetadata.contentType})},async get(key){const item=images.get(key);return item&&{body:item.bytes,httpEtag:'"test"',writeHttpMetadata(headers){headers.set('content-type',item.type)}}}},
 ASSETS:{async fetch(request){const path=new URL(request.url).pathname;return new Response(path==='/article-template.html'?'<title>@@TITLE@@</title><article>@@BODY@@</article>':path==='/admin/'?'admin':'home')}}};
 return {env,db,images,async request(path,method='GET',data,auth){return worker.fetch(new Request(origin+path,{method,headers:{...(auth?{cookie:auth}:{}),...(method!=='GET'?{origin,'content-type':'application/json'}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}),env)}};
}
const article={slug:'hello',title:'欢迎<script>alert(1)</script>',category:'随笔',summary:'测试摘要',body:'# 标题\n\n**正文**\n\n<script>alert(1)</script>\n<img src=x onerror="alert(1)">'};
test('管理路由拒绝伪造、过期会话与跨站登录，本地模式也需要登录',async()=>{
 const s=setup();
 assert.equal((await s.request('/admin/')).status,302);
 for(const path of ['/api/me','/api/posts']) assert.equal((await s.request(path)).status,401);
 assert.equal((await s.request('/admin/login/')).status,200);
 assert.equal((await s.request('/api/login')).status,405);
 const cross=new Request(origin+'/api/login',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'});
 assert.equal((await worker.fetch(cross,s.env)).status,403);
 const http=new Request('http://itfetter.com/api/login',{method:'POST',headers:{origin:'http://itfetter.com'},body:'{}'});
 assert.equal((await worker.fetch(http,s.env)).status,403);
 assert.equal((await s.request('/api/me','GET',undefined,'__Host-blog_session='+'b'.repeat(64))).status,401);
 assert.equal((await s.request('/api/me','GET',undefined,await token())).status,200);
 s.db.exec('UPDATE admin_sessions SET expires_at=0');
 assert.equal((await s.request('/api/me','GET',undefined,await token())).status,401);
 s.env.ENVIRONMENT='development';assert.equal((await s.request('/api/me')).status,401);
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
 const request=new Request(origin+'/api/post',{method:'PUT',headers:{origin:'https://evil.example',cookie:jwt},body:JSON.stringify(article)});
 assert.equal((await worker.fetch(request,s.env)).status,403);
 assert.equal((await worker.fetch(new Request(origin+'/api/post',{method:'PUT',headers:{origin,cookie:jwt},body:'{' }),s.env)).status,400);
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


test('改密接口拒绝未登录、跨站及非 JSON 请求，并限制请求大小',async()=>{
 const s=setup(),cookie=await token();try{
 assert.equal((await s.request('/api/password','POST',{})).status,401);
 assert.equal((await worker.fetch(new Request(origin+'/api/password',{method:'POST',headers:{origin:'https://evil.example',cookie,'content-type':'application/json'},body:'{}'}),s.env)).status,403);
 assert.equal((await worker.fetch(new Request(origin+'/api/password',{method:'POST',headers:{origin,cookie,'content-type':'text/plain'},body:'{}'}),s.env)).status,415);
 assert.equal((await s.request('/api/password','POST',{currentPassword:'a'.repeat(2100)},cookie)).status,413);
 }finally{s.db.close()}
});

test('后台文章目录完整返回摘要和旧链接，预览使用正式清理规则',async()=>{
 const s=setup(),cookie=await token();try{
 s.db.exec(readFileSync(new URL('../.migration/posts.sql',import.meta.url),'utf8'));
 const rows=await (await s.request('/api/posts','GET',undefined,cookie)).json();
 assert.equal(rows.length,5);assert.ok(rows.every(p=>p.summary&&p.updated_at&&p.permalink==='/articles/'+p.id+'/'));
 assert.equal((await s.request('/api/preview','POST',{body:'test'})).status,401);
 const cross=new Request(origin+'/api/preview',{method:'POST',headers:{origin:'https://evil.example',cookie,'content-type':'application/json'},body:'{"body":"test"}'});
 assert.equal((await worker.fetch(cross,s.env)).status,403);
 const preview=await (await s.request('/api/preview','POST',{body:'**正文**\n<script>alert(1)</script><img src=x onerror="alert(1)">'},cookie)).json();
 assert.match(preview.html,/<strong>正文<\/strong>/);assert.doesNotMatch(preview.html,/<script>|onerror/);
 assert.equal((await s.request('/api/preview','POST',{body:3},cookie)).status,400);
 }finally{s.db.close()}
});

test('不完整草稿不可公开；已发布文章草稿保留公开版本，发布和删除检查版本',async()=>{
 const s=setup(),cookie=await token();try{
 const incomplete={slug:'draft-note',title:'未完成',category:'',summary:'',body:'草稿秘密',status:'draft'};
 assert.equal((await s.request('/api/post','PUT',incomplete)).status,401);
 const cross=new Request(origin+'/api/post',{method:'PUT',headers:{origin:'https://evil.example',cookie,'content-type':'application/json'},body:JSON.stringify(incomplete)});
 assert.equal((await worker.fetch(cross,s.env)).status,403);
 assert.equal((await s.request('/api/post','PUT',incomplete,cookie)).status,201);
 assert.equal((await s.request('/articles/draft-note/')).status,404);
 assert.doesNotMatch(await(await s.request('/posts.js')).text(),/草稿秘密|draft-note/);
 let editing=await(await s.request('/api/post?id=draft-note','GET',undefined,cookie)).json();
 assert.equal(editing.body,'草稿秘密');assert.equal(editing.status,'draft');
 assert.equal((await s.request('/api/post','PUT',{...incomplete,id:'draft-note',version:1,status:'published'},cookie)).status,400);
 const complete={...article,id:'draft-note',version:1,status:'published',title:'公开版本',body:'公开正文'};
 assert.equal((await s.request('/api/post','PUT',complete,cookie)).status,200);
 assert.match(await(await s.request('/articles/draft-note/')).text(),/公开正文/);
 assert.equal((await s.request('/api/post','PUT',{...complete,version:2,status:'draft',title:'私密改动',body:'未发布的新正文'},cookie)).status,200);
 let publicHtml=await(await s.request('/articles/draft-note/')).text();assert.match(publicHtml,/公开正文/);assert.doesNotMatch(publicHtml,/私密改动|未发布的新正文/);
 const publicList=await(await s.request('/posts.js')).text();assert.doesNotMatch(publicList,/私密改动|未发布的新正文|draft_body/);
 editing=await(await s.request('/api/post?id=draft-note','GET',undefined,cookie)).json();assert.equal(editing.body,'未发布的新正文');assert.equal(editing.version,3);assert.equal(editing.has_draft,true);
 const catalog=await(await s.request('/api/posts','GET',undefined,cookie)).json();assert.equal(catalog[0].has_draft,1);
 assert.equal((await s.request('/api/post','PUT',{...complete,version:2},cookie)).status,409);
 assert.equal((await s.request('/api/post','DELETE',{id:'draft-note',version:2},cookie)).status,409);
 assert.equal((await s.request('/api/post','PUT',{...complete,version:3,body:editing.body},cookie)).status,200);
 editing=await(await s.request('/api/post?id=draft-note','GET',undefined,cookie)).json();assert.equal(editing.has_draft,false);
 assert.match(await(await s.request('/articles/draft-note/')).text(),/未发布的新正文/);
 assert.equal((await s.request('/api/post','PUT',{...incomplete,slug:'remove-draft'},cookie)).status,201);
 assert.equal((await s.request('/api/post','DELETE',{id:'remove-draft',version:1},cookie)).status,200);
 assert.equal((await s.request('/api/post?id=remove-draft','GET',undefined,cookie)).status,404);
 }finally{s.db.close()}
});

test('访客留言私密保存、校验、防跨站及管理员已读管理',async()=>{
 const s=setup(),data={name:'访客<script>',email:'visitor@example.com',message:'建议\n<script>alert(1)</script>',website:''};
 assert.equal((await s.request('/api/contact','GET')).status,405);
 assert.equal((await s.request('/api/messages')).status,401);
 assert.equal((await s.request('/api/messages','PATCH',{id:'x',status:'read'})).status,401);
 assert.equal((await s.request('/api/contact','POST',{...data,website:'spam'})).status,400);
 assert.equal((await s.request('/api/contact','POST',{...data,email:'bad'})).status,400);
 assert.equal((await s.request('/api/contact','POST',{...data,message:'x'.repeat(3001)})).status,400);
 const cross=new Request(origin+'/api/contact',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify(data)});
 assert.equal((await worker.fetch(cross,s.env)).status,403);
 const wrongType=new Request(origin+'/api/contact',{method:'POST',headers:{origin,'content-type':'text/plain'},body:JSON.stringify(data)});
 assert.equal((await worker.fetch(wrongType,s.env)).status,415);
 assert.equal((await s.request('/api/contact','POST',data)).status,201);
 const catalog=await (await s.request('/api/messages','GET',undefined,await token())).json();
 assert.equal(catalog.total,1);assert.equal(catalog.unread,1);assert.equal(catalog.items[0].message,data.message);
 const item=catalog.items[0];
 assert.equal((await s.request('/api/messages','PATCH',{id:item.id,status:'read'},await token())).status,200);
 assert.equal((await (await s.request('/api/messages?status=unread','GET',undefined,await token())).json()).total,0);
 assert.equal((await s.request('/api/messages?page=-1','GET',undefined,await token())).status,400);
 assert.equal((await s.request('/api/messages','PATCH',{id:item.id,status:'public'},await token())).status,400);
 assert.equal((await s.request('/api/contact','POST',{...data,email:''})).status,201);
 assert.equal((await s.request('/api/contact','POST',data)).status,201);
 const limited=await s.request('/api/contact','POST',data);assert.equal(limited.status,429);assert.ok(limited.headers.get('retry-after'));
 assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM contact_messages').get().n,3);
});
test('留言目录分页及跨站状态修改保护',async()=>{
 const s=setup();for(let i=0;i<21;i++)s.db.prepare('INSERT INTO contact_messages (id,name,message,created_at) VALUES (?,?,?,?)').run(crypto.randomUUID(),'访客','留言',new Date().toISOString());
 const second=await (await s.request('/api/messages?page=2','GET',undefined,await token())).json();assert.equal(second.items.length,1);assert.equal(second.total,21);
 const request=new Request(origin+'/api/messages',{method:'PATCH',headers:{origin:'https://evil.example',cookie:await token(),'content-type':'application/json'},body:JSON.stringify({id:second.items[0].id,status:'read'})});
 assert.equal((await worker.fetch(request,s.env)).status,403);
});

test('未读数量与批量已读鉴权、范围保护、重复执行和新留言保留',async()=>{
 const s=setup(),cookie=await token();
 assert.equal((await s.request('/api/messages/count')).status,401);
 assert.equal((await s.request('/api/messages/read-all','POST',{through:100})).status,401);
 const ids=[crypto.randomUUID(),crypto.randomUUID()];
 for(const id of ids)s.db.prepare('INSERT INTO contact_messages (id,name,message,created_at) VALUES (?,?,?,?)').run(id,'访客','私密留言',new Date().toISOString());
 const stats=await (await s.request('/api/messages/count','GET',undefined,cookie)).json();
 assert.equal(stats.unread,2);assert.equal(stats.readThrough,2);assert.equal(stats.items,undefined);
 const newId=crypto.randomUUID();s.db.prepare('INSERT INTO contact_messages (id,name,message,created_at) VALUES (?,?,?,?)').run(newId,'新访客','刚到的留言',new Date().toISOString());
 assert.equal((await s.request('/api/messages/read-all','POST',{through:-1},cookie)).status,400);
 const cross=new Request(origin+'/api/messages/read-all',{method:'POST',headers:{origin:'https://evil.example',cookie,'content-type':'application/json'},body:JSON.stringify({through:stats.readThrough})});
 assert.equal((await worker.fetch(cross,s.env)).status,403);
 const result=await (await s.request('/api/messages/read-all','POST',{through:stats.readThrough},cookie)).json();
 assert.equal(result.changed,2);assert.equal(result.unread,1);
 assert.equal(s.db.prepare('SELECT status FROM contact_messages WHERE id=?').get(newId).status,'unread');
 assert.equal((await (await s.request('/api/messages/read-all','POST',{through:stats.readThrough},cookie)).json()).changed,0);
 assert.equal((await s.request('/api/messages','PATCH',{id:ids[0],status:'unread'},cookie)).status,200);
 assert.equal((await (await s.request('/api/messages/count','GET',undefined,cookie)).json()).unread,2);
});
