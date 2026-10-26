import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync,readFileSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {request as httpRequest} from 'node:http';
import {LocalDatabase,LocalImages,migrate} from './storage.mjs';
import {localAssets} from './assets.mjs';
import {configuration,clientIP,httpServer,requestURL,siteMetadata} from './runtime.mjs';
const migrations=fileURLToPath(new URL('../worker/migrations',import.meta.url));
function fixture(t,close=()=>{}){const dir=mkdtempSync(join(tmpdir(),'blog-runtime-'));t.after(()=>{close();rmSync(dir,{recursive:true,force:true});});return dir;}
test('all existing migrations run once and preserve data after reopening',async t=>{
  const dir=fixture(t,()=>db.close()),filename=join(dir,'blog.sqlite');let db=new LocalDatabase(filename);
  assert.equal(await migrate(db,migrations,join(dir,'backups')),14);
  await db.prepare('INSERT INTO site_settings VALUES(1,?,1)').bind('hello@example.com').run();db.close();
  db=new LocalDatabase(filename);
  assert.equal(await migrate(db,migrations,join(dir,'backups')),0);
  assert.equal(await db.prepare('SELECT contact_email FROM site_settings').first('contact_email'),'hello@example.com');
});
test('batch rollback, RETURNING and trigger change counts match application semantics',async t=>{
  const dir=fixture(t,()=>db.close()),db=new LocalDatabase(join(dir,'db'));
  db.native.exec('CREATE TABLE a(id INTEGER PRIMARY KEY,n INTEGER); CREATE TABLE audit(n INTEGER); CREATE TRIGGER a_log AFTER INSERT ON a BEGIN INSERT INTO audit VALUES(new.n); END;');
  await assert.rejects(db.batch([db.prepare('INSERT INTO a VALUES(1,2)'),db.prepare('INSERT INTO a VALUES(1,3)')]));
  assert.equal(await db.prepare('SELECT count(*) AS n FROM a').first('n'),0);
  const result=await db.prepare('INSERT INTO a VALUES(1,2) RETURNING n').all();
  assert.equal(result.meta.changes,2);assert.equal(result.results[0].n,2);
  assert.equal((await db.prepare('UPDATE a SET n=4 WHERE id=1 RETURNING n').first()).n,4);
});
test('applied SQL cannot silently change; pending failures roll back; upgrades create snapshots',async t=>{
  const dir=fixture(t,()=>db.close()),sql=join(dir,'migrations');mkdirSync(sql);writeFileSync(join(sql,'0001_first.sql'),'CREATE TABLE example(n);');
  const db=new LocalDatabase(join(dir,'db'));await migrate(db,sql,join(dir,'backups'));
  writeFileSync(join(sql,'0002_second.sql'),'INSERT INTO example VALUES(42); SELECT * FROM missing;');
  await assert.rejects(migrate(db,sql,join(dir,'backups')));
  assert.equal(await db.prepare('SELECT count(*) AS n FROM example').first('n'),0);
  writeFileSync(join(sql,'0002_second.sql'),'INSERT INTO example VALUES(42);');
  assert.equal(await migrate(db,sql,join(dir,'backups')),1);
  writeFileSync(join(sql,'0001_first.sql'),'CREATE TABLE changed(n);');
  await assert.rejects(migrate(db,sql,join(dir,'backups')),/changed/);
});
test('image writes are persistent and conditional creation never overwrites',async t=>{
  const dir=fixture(t),images=new LocalImages(dir),key='12345678-1234-1234-1234-123456789abc.png';
  await images.put(key,new Uint8Array([1,2,3]));
  assert.equal(await images.put(key,new Uint8Array([9]),{onlyIf:{etagDoesNotMatch:'*'}}),null);
  const object=await new LocalImages(dir).get(key);
  assert.deepEqual([...new Uint8Array(await object.arrayBuffer())],[1,2,3]);
  assert.equal(object.httpMetadata.contentType,'image/png');assert.match(object.httpEtag,/^"[a-f0-9]{64}"$/);
  assert.equal((await images.list()).objects[0].size,3);
  await assert.rejects(images.put('../private',new Uint8Array()));
  await assert.rejects(images.get('../../secret'));
});
test('assets serve only public files, support HEAD and reject private/traversal paths',async t=>{
  const dir=fixture(t);mkdirSync(join(dir,'dist'));writeFileSync(join(dir,'secret'),'private');writeFileSync(join(dir,'dist','index.html'),'hello');
  writeFileSync(join(dir,'dist','module.mjs'),'export const ready = true;');
  const assets=localAssets(join(dir,'dist'));
  const module=await assets.fetch(new Request('https://example.com/module.mjs'));
  assert.match(module.headers.get('content-type'),/^(text|application)\/javascript/);
  assert.equal(module.headers.get('x-content-type-options'),'nosniff');
  assert.equal(await module.text(),'export const ready = true;');
  assert.equal(await (await assets.fetch(new Request('https://example.com/'))).text(),'hello');
  assert.equal(await (await assets.fetch(new Request('https://example.com/',{method:'HEAD'}))).text(),'');
  for(const path of ['/.env','/%2e%2e%2fsecret','/..%5csecret'])assert.equal((await assets.fetch(new Request('https://example.com'+path))).status,404);
});
test('Proxy trust is explicit; forged forwarding headers are ignored',()=>{
  assert.throws(()=>configuration({TRUST_PROXY_IPS:'*'}));
  assert.equal(clientIP('::ffff:10.0.0.2',{'x-real-ip':'1.2.3.4'},[]),'10.0.0.2');
  assert.equal(clientIP('::ffff:10.0.0.2',{'x-real-ip':'1.2.3.4'},['10.0.0.2']),'1.2.3.4');
});
test('HTTP bridge preserves cookies, HEAD, dynamic host and trusted client IP',async t=>{
  const config=configuration({PORT:'0',HOST:'127.0.0.1'});
  const server=httpServer({async fetch(request){assert.equal(request.headers.get('cf-connecting-ip'),'127.0.0.1');assert.equal(request.headers.get('x-forwarded-proto'),null);return new Response(request.method==='POST'?await request.text():'hello',{headers:{'set-cookie':'session=secure; Secure'}});}}, {DB:{prepare(){return {async first(){return {ok:1};}};}}},config);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const base='http://127.0.0.1:'+server.address().port;
  assert.equal((await fetch(base+'/healthz')).status,200);
  assert.equal((await fetch(base+'/')).status,200);
  const response=await new Promise((resolve,reject)=>{const req=httpRequest(base+'/',{method:'POST',headers:{host:'blog.example','cf-connecting-ip':'8.8.8.8','x-forwarded-proto':'http'}},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({body,headers:res.headers}));});req.on('error',reject);req.end('hello body');});
  assert.equal(response.body,'hello body');assert.match(response.headers['set-cookie'][0],/Secure/);
});

test('domains and IP ports are dynamic; only trusted proxy may supply protocol',()=>{
 const req=(host,extra={},peer='192.0.2.1',url='/admin/')=>({headers:{host,...extra},socket:{remoteAddress:peer},url});
 const config=configuration({TRUST_PROXY_IPS:'192.0.2.1'});
 assert.equal(requestURL(req('first.example',{'x-forwarded-proto':'https'}),config).origin,'https://first.example');
 assert.equal(requestURL(req('second.example:8443',{'x-forwarded-proto':'https'}),config).origin,'https://second.example:8443');
 assert.equal(requestURL(req('127.0.0.1:3100'),config).origin,'http://127.0.0.1:3100');
 assert.equal(requestURL(req('localhost:3100',{'x-forwarded-proto':'https'},'198.51.100.1'),config).protocol,'http:');
 assert.throws(()=>requestURL(req('valid.example',{'x-forwarded-proto':'https,http'}),config));
 for(const host of ['user@evil.example','good.example/evil','a,b','bad host','example.com?foo'])assert.throws(()=>requestURL(req(host),config));
 assert.throws(()=>requestURL(req('good.example',{},'192.0.2.1','//evil.example/path'),config));
});
test('only site metadata is rebound; authored article links are preserved',()=>{
 const html='<head><link rel="canonical" href="https://itfetter.com/"><meta property="og:image" content="https://itfetter.com/assets/share-card.png"></head><body><a href="https://itfetter.com/article/">original</a></body>';
 const result=siteMetadata(html,'https://new.example');
 assert.match(result,/href="https:\/\/new.example\/"/);
 assert.match(result,/content="https:\/\/new.example\/assets/);
 assert.match(result,/<a href="https:\/\/itfetter.com\/article\/">/);
});
