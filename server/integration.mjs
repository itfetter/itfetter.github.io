// Runs only in CI, where worker dependencies already exist. Temporary data only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from '../worker/index.js';
import {httpServer,configuration} from './runtime.mjs';
import {request as httpRequest} from 'node:http';
import {hashPassword} from '../worker/auth.js';
import {LocalDatabase,LocalImages,migrate} from './storage.mjs';
import {localAssets} from './assets.mjs';
test('real SQLite: login, draft, publish, stale version, comments and JSON backup',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'blog-integration-')),db=new LocalDatabase(join(dir,'blog.sqlite'));
 t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
 await migrate(db,fileURLToPath(new URL('../worker/migrations/',import.meta.url)));
 await db.prepare('INSERT INTO admin_users VALUES(1,?,?,?)').bind('test-admin',await hashPassword('temporary-test-password'),new Date().toISOString()).run();
 const env={DB:db,IMAGES:new LocalImages(join(dir,'images')),ASSETS:localAssets(fileURLToPath(new URL('../dist/',import.meta.url))),ENVIRONMENT:'production'};
 let cookie='';
 const request=async(path,method='GET',data)=>worker.fetch(new Request('https://itfetter.com'+path,{method,headers:{origin:'https://itfetter.com','content-type':'application/json','cf-connecting-ip':'192.0.2.1',...(cookie?{cookie}:{})},...(data?{body:JSON.stringify(data)}:{})}),env,{});
 assert.equal((await request('/api/posts')).status,401);
 const login=await request('/api/login','POST',{username:'test-admin',password:'temporary-test-password'});
 assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];assert.match(cookie,/^__Host-blog_session=/);
 assert.equal((await request('/api/posts')).status,200);
 assert.equal((await request('/posts.json')).status,200);
 const content={title:'Container test',category:'Runtime tests',summary:'Integration test',body:'Test body'};
 const draft=await request('/api/post','PUT',{...content,slug:'container-test',status:'draft'});
 assert.equal(draft.status,201,await draft.clone().text());
 assert.equal((await db.prepare("SELECT status FROM posts WHERE id='container-test'").first()).status,'draft');
 assert.equal((await request('/articles/container-test/')).status,404);
 const publish=await request('/api/post','PUT',{...content,id:'container-test',version:1,status:'published'});
 assert.equal(publish.status,200,await publish.clone().text());
 assert.equal((await request('/api/post','PUT',{...content,id:'container-test',version:1,status:'draft'})).status,409);
 assert.equal((await request('/articles/container-test/')).status,200);
 const comment=await request('/api/comments','POST',{id:crypto.randomUUID(),post_id:'container-test',name:'Test visitor',content:'A comment',website:''});
 assert.equal(comment.status,201,await comment.clone().text());
 const exported=await request('/api/backup');assert.equal(exported.status,200);
 assert.equal((await exported.json()).format,'itfetter-content-v1');
 const cross=await worker.fetch(new Request('https://itfetter.com/api/post',{method:'POST',headers:{origin:'https://evil.example',cookie,'content-type':'application/json'},body:'{}'}),env,{});
 assert.equal(cross.status,403);
 const server=httpServer(worker,env,configuration({TRUST_PROXY_IPS:'127.0.0.1',HOST:'127.0.0.1',PORT:'0'}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
   const loginAt=(host,protocol,origin)=>new Promise((resolve,reject)=>{
     const req=httpRequest({hostname:'127.0.0.1',port:server.address().port,path:'/api/login',method:'POST',headers:{host,'x-forwarded-proto':protocol,origin,'content-type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,cookie:res.headers['set-cookie']?.[0]}));});
     req.on('error',reject);req.end(JSON.stringify({username:'test-admin',password:'temporary-test-password'}));
   });
   const first=await loginAt('first.example','https','https://first.example');
   assert.equal(first.status,200);assert.match(first.cookie,/__Host-blog_session=/);assert.match(first.cookie,/Secure/);
   const second=await loginAt('replacement.example','https','https://replacement.example');assert.equal(second.status,200);
   const local=await loginAt('127.0.0.1:3100','http','http://127.0.0.1:3100');
   assert.equal(local.status,200);assert.match(local.cookie,/blog_session_local=/);assert.doesNotMatch(local.cookie,/Secure/);
   assert.equal((await loginAt('replacement.example','https','https://evil.example')).status,403);
   assert.equal((await loginAt('replacement.example','http','http://replacement.example')).status,403);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}

});

test('first browser setup through real HTTP bridge signs in and then permanently closes bootstrap',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'blog-setup-http-')),db=new LocalDatabase(join(dir,'blog.sqlite'));
 const env={DB:db,IMAGES:new LocalImages(join(dir,'images')),ASSETS:localAssets(fileURLToPath(new URL('../dist/',import.meta.url))),ENVIRONMENT:'production'};
 await migrate(db,fileURLToPath(new URL('../worker/migrations/',import.meta.url)));
 const server=httpServer(worker,env,configuration({PORT:'0',HOST:'127.0.0.1'}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true,force:true});});
 const origin='http://127.0.0.1:'+server.address().port;
 const send=(path,method='GET',data,headers={})=>new Promise((resolve,reject)=>{
  const req=httpRequest(origin+path,{method,headers:{origin,'content-type':'application/json',...headers}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});req.on('error',reject);req.end(data?JSON.stringify(data):undefined);
 });
 const page=await send('/admin/');assert.equal(page.status,200);assert.match(page.body,/id="admin-setup-form"/);
 const input={username:'admin',password:'temporary-browser-setup',confirmPassword:'temporary-browser-setup'};
 assert.equal((await send('/api/setup','POST',input,{'x-real-ip':'198.51.100.2'})).status,403);
 const result=await send('/api/setup','POST',input);assert.equal(result.status,201,result.body);
 const cookie=result.headers['set-cookie'][0].split(';')[0];assert.match(cookie,/blog_session_local=/);
 const me=await send('/api/me','GET',null,{cookie});assert.equal(me.status,200);assert.equal(JSON.parse(me.body).login,'admin');
 assert.equal((await send('/api/setup','POST',input)).status,409);
 const normal=await send('/admin/','GET',null,{cookie});assert.equal(normal.status,200);assert.doesNotMatch(normal.body,/id="admin-setup-form"/);
 assert.equal((await send('/admin/')).status,302);
});
