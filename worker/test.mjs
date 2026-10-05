import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {digest} from './auth.js';
import worker from './index.js';
import {editorBlocks,renderMarkdown} from './content.js';
const origin='https://itfetter.com';
const sessionToken='a'.repeat(64);
const token=async()=> '__Host-blog_session='+sessionToken;
function setup(){
 const db=new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('migrations/0001_posts.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('migrations/0002_auth.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('migrations/0003_drafts.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('migrations/0004_contact.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('migrations/0005_reads.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('migrations/0006_categories.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('migrations/0007_history.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('migrations/0008_message_trash.sql',import.meta.url),'utf8'));
 db.prepare('INSERT INTO admin_users VALUES (1,?,?,?)').run('admin','not-used-in-this-test','test-version');
 db.prepare('INSERT INTO admin_sessions VALUES (?,1,?,?)').run(digest(sessionToken),'test-version',Math.floor(Date.now()/1000)+3600);
 const images=new Map();
 const env={
 DB:{prepare(sql){let values=[];return {bind(...args){values=args;return this},async first(){return db.prepare(sql).get(...values)||null},async all(){return {results:db.prepare(sql).all(...values)}},async run(){return {meta:{changes:db.prepare(sql).run(...values).changes}}}}}},
 IMAGES:{async list(){return {objects:[...images].map(([key,item])=>({key,size:item.bytes.length})),truncated:false}},async put(key,bytes,options){if(options.onlyIf&&images.has(key))return null;images.set(key,{bytes,type:options.httpMetadata.contentType});return {key}},async get(key){const item=images.get(key);return item&&{arrayBuffer:async()=>item.bytes.buffer.slice(item.bytes.byteOffset,item.bytes.byteOffset+item.bytes.byteLength),httpMetadata:{contentType:item.type},body:item.bytes,httpEtag:'"test"',writeHttpMetadata(headers){headers.set('content-type',item.type)}}}},
 ASSETS:{async fetch(request){const path=new URL(request.url).pathname;return new Response(path==='/article-template.html'?'<title>@@TITLE@@</title>@@DATES@@<article>@@BODY@@</article>@@NAVIGATION@@':path==='/admin/'?'admin':'home')}}};
 env.DB.batch=async statements=>{db.exec("BEGIN");try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec("COMMIT");return results}catch(e){db.exec("ROLLBACK");throw e}};
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

test('阅读量同源校验、短期去重、并发防重复及后台机器人排除',async()=>{
 const s=setup(),cookie=await token();
 await s.request('/api/post','PUT',article,cookie);
 const read=(ip='1.2.3.4',ua='Browser',auth='')=>worker.fetch(new Request(origin+'/api/read',{method:'POST',headers:{origin,'content-type':'application/json','cf-connecting-ip':ip,'user-agent':ua,...(auth?{cookie:auth}:{})},body:JSON.stringify({id:'hello'})}),s.env);
 await Promise.all(Array.from({length:5},()=>read()));
 assert.equal(s.db.prepare('SELECT read_count FROM posts WHERE id=?').get('hello').read_count,1);
 assert.equal((await (await read()).json()).counted,false);
 assert.equal((await (await read('2.3.4.5')).json()).count,2);
 assert.equal((await (await read('3.4.5.6','Googlebot')).json()).counted,false);
 assert.equal((await (await read('3.4.5.6','Browser',cookie)).json()).counted,false);
 assert.equal(s.db.prepare('SELECT version FROM posts WHERE id=?').get('hello').version,1);
 const listing=await (await s.request('/api/posts','GET',undefined,cookie)).json();assert.equal(listing[0].read_count,2);
 const publicScript=await (await s.request('/posts.js')).text();assert.match(publicScript,/"read_count":2/);assert.doesNotMatch(publicScript,/article_reads|expires_at|token_hash/);
 const cross=new Request(origin+'/api/read',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{"id":"hello"}'});
 assert.equal((await worker.fetch(cross,s.env)).status,403);
 assert.equal((await s.request('/api/read','POST',{id:'missing'})).status,404);
 await s.request('/api/post','PUT',{...article,slug:'private',status:'draft'},cookie);
 assert.equal((await s.request('/api/read','POST',{id:'private'})).status,404);
 for(let i=0;i<60;i++)await read();
 assert.equal((await read()).status,429);
});

test('分类仅管理员可管理，新建去重并保留空合集与历史草稿分类',async()=>{
 const s=setup(),cookie=await token();try{
 assert.equal((await s.request('/api/categories')).status,401);
 assert.equal((await s.request('/api/categories','POST',{name:'新分类'})).status,401);
 const cross=new Request(origin+'/api/categories',{method:'POST',headers:{origin:'https://evil.example',cookie,'content-type':'application/json'},body:'{"name":"新分类"}'});
 assert.equal((await worker.fetch(cross,s.env)).status,403);
 for(const name of ['', ' ', 'x'.repeat(81), '坏\n名称'])assert.equal((await s.request('/api/categories','POST',{name},cookie)).status,400);
 assert.equal((await s.request('/api/categories','POST',{name:' 新合集 '},cookie)).status,201);
 assert.equal((await s.request('/api/categories','POST',{name:'新合集'},cookie)).status,200);
 assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM posts').get().n,0);
 await s.request('/api/post','PUT',{...article,category:'旧分类'},cookie);
 await s.request('/api/post','PUT',{...article,id:'hello',version:1,category:'草稿分类',status:'draft'},cookie);
 const names=await(await s.request('/api/categories','GET',undefined,cookie)).json();
 for(const name of ['随笔','新合集','旧分类','草稿分类'])assert.ok(names.includes(name));
 assert.equal(s.db.prepare("SELECT category,version FROM posts WHERE id='hello'").get().category,'旧分类');
 }finally{s.db.close()}
});

test('公开摘要不含正文或草稿；独立正文与实时站点地图只包含已发布文章',async()=>{
 const s=setup(),cookie=await token();try{
 await s.request('/api/post','PUT',{...article,title:'公开标题',body:'公开正文标记 '+ 'x'.repeat(20000)},cookie);
 await s.request('/api/post','PUT',{...article,slug:'private',status:'draft',title:'私密标题',body:'私密正文标记'},cookie);
 await s.request('/api/post','PUT',{...article,slug:'future'},cookie);
 s.db.exec("UPDATE posts SET published_at='2999-01-01T00:00:00.000Z' WHERE id='future'");
 await s.request('/api/post','PUT',{...article,id:'hello',version:1,status:'draft',title:'未发布修改',body:'私密修订标记'},cookie);
 const response=await s.request('/posts.json');assert.equal(response.status,200);
 const raw=await response.text(),data=JSON.parse(raw);assert.equal(data.length,1);assert.equal(data[0].title,'公开标题');
 assert.equal(data[0].permalink,'/articles/hello/');
 for(const field of ['html','body','draft_body','draft_title','version','updated_at'])assert.equal(data[0][field],undefined);
 assert.doesNotMatch(raw,/公开正文标记|私密正文标记|私密修订标记|未发布修改|future|private/);
 assert.ok(raw.length<1000);
 const html=await(await s.request('/articles/hello/')).text();assert.match(html,/公开正文标记/);assert.doesNotMatch(html,/私密修订标记/);assert.match(html,/发布于/);assert.doesNotMatch(html,/@@DATES@@|@@NAVIGATION@@|私密标题/);
 const sitemap=await s.request('/sitemap.xml');assert.equal(sitemap.headers.get('content-type'),'application/xml; charset=utf-8');
 const xml=await sitemap.text();assert.match(xml,/<loc>https:\/\/itfetter.com\/articles\/hello\/<\/loc>/);
 assert.doesNotMatch(xml,/private|future|未发布修改/);
 const head=await s.request('/sitemap.xml','HEAD');assert.equal(head.status,200);assert.equal(await head.text(),'');
 assert.equal((await s.request('/posts.json','POST',{})).status,405);
 assert.match(await(await s.request('/robots.txt')).text(),/Sitemap: https:\/\/itfetter.com\/sitemap.xml/);
 await s.request('/api/post','DELETE',{id:'hello',version:2},cookie);
 assert.doesNotMatch(await(await s.request('/sitemap.xml')).text(),/articles\/hello/);
 assert.deepEqual(await(await s.request('/posts.json')).json(),[]);
 }finally{s.db.close()}
});

test('历史快照和公开更新时间分离；备份鉴权、验证与缺失数据恢复',async()=>{
 const s=setup(),cookie=await token();try{
 assert.equal((await s.request('/api/backup')).status,401);assert.equal((await s.request('/api/history?id=hello')).status,401);
 await s.request('/api/post','PUT',{...article,title:'最初',body:'最初正文'},cookie);
 const first=s.db.prepare("SELECT published_at FROM posts WHERE id='hello'").get().published_at;
 await s.request('/api/post','PUT',{...article,id:'hello',version:1,status:'draft',title:'草稿标题',body:'草稿正文'},cookie);
 let rows=await(await s.request('/api/history?id=hello','GET',undefined,cookie)).json();assert.equal(rows.length,1);
 assert.equal((await(await s.request('/api/history?id=hello&version=1','GET',undefined,cookie)).json()).body,'最初正文');
 assert.equal(s.db.prepare("SELECT public_updated_at FROM posts WHERE id='hello'").get().public_updated_at,null);
 await s.request('/api/post','PUT',{...article,id:'hello',version:2,title:'发布新版',body:'发布正文'},cookie);
 const row=s.db.prepare("SELECT * FROM posts WHERE id='hello'").get();assert.equal(row.published_at,first);assert.ok(row.public_updated_at);
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5p8AAAAASUVORK5CYII=';
 await s.request('/api/image','POST',{type:'image/png',base64:png},cookie);
 const backup=await(await s.request('/api/backup','GET',undefined,cookie)).json();
 assert.equal(backup.images.length,1);assert.equal(backup.history.length,2);assert.equal(backup.posts.length,1);
 assert.doesNotMatch(JSON.stringify(backup),/token_hash|test-version|admin_users|password_hash/);
 assert.equal((await s.request('/api/backup/restore','POST',backup,cookie)).status,400);
 assert.equal((await s.request('/api/backup/restore','POST',{...backup,confirm:true,posts:[{...backup.posts[0],id:'../bad'}]},cookie)).status,400);
 const cross=new Request(origin+'/api/backup/restore',{method:'POST',headers:{origin:'https://evil.example',cookie,'content-type':'application/json'},body:JSON.stringify({...backup,confirm:true})});assert.equal((await worker.fetch(cross,s.env)).status,403);
 const unchanged=await(await s.request('/api/backup/restore','POST',{...backup,confirm:true},cookie)).json();assert.equal(unchanged.changed,0);assert.equal(unchanged.images,0);
 await s.request('/api/post','DELETE',{id:'hello',version:3},cookie);s.images.clear();
 assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM post_versions').get().n,0);
 const restore=await s.request('/api/backup/restore','POST',{...backup,confirm:true},cookie);assert.equal(restore.status,200);
 assert.equal(s.db.prepare("SELECT body FROM posts WHERE id='hello'").get().body,'发布正文');assert.equal(s.images.size,1);
 assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM post_versions').get().n,2);
 assert.equal((await s.request('/api/me','GET',undefined,cookie)).status,200);
 }finally{s.db.close()}
});

test('历史保留50份，阅读计数不会创建版本，草稿不改变公开日期',async()=>{
 const s=setup(),cookie=await token();try{
 await s.request('/api/post','PUT',article,cookie);
 s.db.exec("UPDATE posts SET public_updated_at='2026-01-01T00:00:00.000Z' WHERE id='hello'");
 for(let version=1;version<=55;version++)assert.equal((await s.request('/api/post','PUT',{...article,id:'hello',version,status:'draft',body:'draft '+version},cookie)).status,200);
 const history=s.db.prepare("SELECT version FROM post_versions WHERE post_id='hello' ORDER BY version").all();
 assert.equal(history.length,50);assert.equal(history[0].version,6);assert.equal(history[49].version,55);
 s.db.exec("UPDATE posts SET read_count=read_count+1 WHERE id='hello'");
 assert.equal(s.db.prepare('SELECT count(*) AS n FROM post_versions').get().n,50);
 assert.equal((await(await s.request('/posts.json')).json())[0].public_updated_at,'2026-01-01T00:00:00.000Z');
 }finally{s.db.close()}
});

test('超出便捷备份容量时明确拒绝，而非返回不完整备份',async()=>{
 const s=setup(),cookie=await token();try{
 await s.request('/api/post','PUT',article,cookie);
 s.db.prepare("UPDATE posts SET body=? WHERE id='hello'").run('x'.repeat(4000001));
 const response=await s.request('/api/backup','GET',undefined,cookie);
 assert.equal(response.status,400);assert.match((await response.json()).error,/超过便捷备份上限/);
 }finally{s.db.close()}
});

test('可视化区块保持原始Markdown与引用定义，渲染安全且仅管理员可用',async()=>{
 const bodies=[
 '# 标题\r\n\r\n正文 **加粗** [官网][ref]\r\n\r\n[ref]: https://example.com\r\n',
 '| 服务 | 用途 |\n| :--- | ---: |\n| D1 | 文章 |\n\n- 一级\n  - 二级\n',
 '\x60\x60\x60js\nconst a = "<script>";\n\x60\x60\x60\n\n> 引用\n\n<div class="callout">提示</div>\n',
 '[图片](javascript:alert(1))\n\n<script>alert(1)</script>\n'
 ];
 for(const body of bodies){
  const blocks=editorBlocks(body);assert.equal(blocks.map(b=>b.raw).join(''),body);
  assert.doesNotMatch(blocks.map(b=>b.html).join(''),/<script|href="javascript:|onerror=/i);
 }
 const ref=editorBlocks(bodies[0]);assert.match(ref.map(b=>b.html).join(''),/href="https:\/\/example.com"/);
 assert.ok(editorBlocks(bodies[1]).some(b=>b.type==='table'&&b.editable));
 assert.ok(editorBlocks(bodies[2]).some(b=>b.type==='html'&&!b.editable));
 const s=setup(),cookie=await token();try{
 assert.equal((await s.request('/api/preview','POST',{body:bodies[0],visual:true})).status,401);
 const data=await(await s.request('/api/preview','POST',{body:bodies[1],visual:true},cookie)).json();
 assert.ok(Array.isArray(data.blocks));assert.equal(data.blocks.map(b=>b.raw).join(''),bodies[1]);
 assert.match((await(await s.request('/api/preview','POST',{body:'**正文**'},cookie)).json()).html,/<strong>正文<\/strong>/);
 }finally{s.db.close()}
});

test('留言回收站鉴权、同源、版本冲突、全文保留与备份恢复',async()=>{
 const s=setup(),cookie=await token(),id=crypto.randomUUID(),text='长留言\n'.repeat(200);
 s.db.prepare('INSERT INTO contact_messages(id,name,message,created_at) VALUES(?,?,?,?)').run(id,'访客',text,new Date().toISOString());
 const data={id,version:1};
 assert.equal((await s.request('/api/messages','DELETE',data)).status,401);
 assert.equal((await s.request('/api/messages/restore','POST',data)).status,401);
 const cross=new Request(origin+'/api/messages',{method:'DELETE',headers:{origin:'https://evil.example',cookie,'content-type':'application/json'},body:JSON.stringify(data)});
 assert.equal((await worker.fetch(cross,s.env)).status,403);
 assert.equal((await s.request('/api/messages','DELETE',{id,version:0},cookie)).status,400);
 assert.equal((await s.request('/api/messages','DELETE',data,cookie)).status,200);
 assert.equal((await (await s.request('/api/messages','GET',undefined,cookie)).json()).total,0);
 assert.equal((await (await s.request('/api/messages/count','GET',undefined,cookie)).json()).unread,0);
 const trash=await (await s.request('/api/messages?status=trash','GET',undefined,cookie)).json();
 assert.equal(trash.items[0].message,text);assert.equal(trash.items[0].version,2);
 assert.equal((await s.request('/api/messages','PATCH',{id,status:'read'},cookie)).status,404);
 assert.equal((await s.request('/api/messages/restore','POST',data,cookie)).status,409);
 const backup=await (await s.request('/api/backup','GET',undefined,cookie)).json();
 assert.ok(backup.messages[0].deleted_at);assert.equal(backup.messages[0].version,2);
 const copy=setup();assert.equal((await copy.request('/api/backup/restore','POST',{...backup,confirm:true},cookie)).status,200);
 assert.equal((await (await copy.request('/api/messages?status=trash','GET',undefined,cookie)).json()).total,1);copy.db.close();
 assert.equal((await s.request('/api/messages/restore','POST',{id,version:2},cookie)).status,200);
 assert.equal((await (await s.request('/api/messages/count','GET',undefined,cookie)).json()).unread,1);
 assert.equal((await s.request('/api/messages','DELETE',data,cookie)).status,409);
 assert.equal(s.db.prepare('SELECT message FROM contact_messages WHERE id=?').get(id).message,text);s.db.close();
});

test('批量留言删除恢复与永久删除只操作选中版本、冲突时全部保留',async()=>{
 const s=setup(),cookie=await token(),ids=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
 for(const id of ids)s.db.prepare('INSERT INTO contact_messages(id,name,message,created_at) VALUES(?,?,?,?)').run(id,'测试','保留全文',new Date().toISOString());
 const items=ids.slice(0,2).map(id=>({id,version:1}));
 assert.equal((await s.request('/api/messages/bulk','POST',{action:'trash',items})).status,401);
 const cross=new Request(origin+'/api/messages/bulk',{method:'POST',headers:{origin:'https://evil.example',cookie,'content-type':'application/json'},body:JSON.stringify({action:'trash',items})});
 assert.equal((await worker.fetch(cross,s.env)).status,403);
 assert.equal((await s.request('/api/messages/bulk','POST',{action:'trash',items:[...items,items[0]]},cookie)).status,400);
 assert.equal((await s.request('/api/messages/bulk','POST',{action:'purge',items},cookie)).status,400);
 assert.equal((await s.request('/api/messages/bulk','POST',{action:'trash',items:[items[0],{...items[1],version:2}]},cookie)).status,409);
 assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM contact_messages WHERE deleted_at IS NULL').get().n,3);
 assert.equal((await s.request('/api/messages/bulk','POST',{action:'trash',items},cookie)).status,200);
 assert.equal((await s.request('/api/messages/bulk','POST',{action:'purge',items:[{id:ids[2],version:1}],confirm:true},cookie)).status,409);
 assert.equal((await s.request('/api/messages/bulk','POST',{action:'restore',items:items.map(i=>({...i,version:2}))},cookie)).status,200);
 assert.equal((await s.request('/api/messages/bulk','POST',{action:'trash',items:items.map(i=>({...i,version:3}))},cookie)).status,200);
 assert.equal((await s.request('/api/messages/bulk','POST',{action:'purge',items:items.map(i=>({...i,version:4})),confirm:true},cookie)).status,200);
 assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM contact_messages').get().n,1);assert.equal(s.db.prepare('SELECT id FROM contact_messages').get().id,ids[2]);s.db.close();
});
