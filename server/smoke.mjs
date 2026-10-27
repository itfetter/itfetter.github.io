// GitHub-hosted Linux runner only. Never run Docker or download images on the editing PC.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,chmodSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import assert from 'node:assert/strict';
const image=process.env.TEST_IMAGE;if(!image)throw Error('TEST_IMAGE required');
const root=mkdtempSync(join(tmpdir(),'blog-container-')),name='blog-smoke-'+process.pid;
for(const path of ['data','uploads']){mkdirSync(join(root,path));chmodSync(join(root,path),0o777);}
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',timeout:120000}).trim();
function get(port,path,host='itfetter.com'){return new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path,headers:{host}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));});req.on('error',reject);req.end();});}
async function start(){
 const gateway=docker('network','inspect','bridge','--format','{{(index .IPAM.Config 0).Gateway}}');
 docker('run','-d','--name',name,'--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--tmpfs','/tmp:size=32m','-e','TRUST_PROXY_IPS='+gateway,'-p','127.0.0.1::3000','--mount','type=bind,src='+join(root,'data')+',dst=/data','--mount','type=bind,src='+join(root,'uploads')+',dst=/uploads',image);
 const port=Number(docker('inspect','--format','{{(index (index .NetworkSettings.Ports "3000/tcp") 0).HostPort}}',name));
 for(let i=0;i<30;i++){try{if((await get(port,'/healthz')).status===200)return port;}catch{}await new Promise(r=>setTimeout(r,1000));}
 throw Error('Container did not become ready');
}
try {
 let port=await start();
 assert.notEqual(docker('exec',name,'id','-u'),'0');
 assert.equal((await get(port,'/','localhost:'+port)).status,200);
 const setupPage=await get(port,'/admin/login/','localhost:'+port);
 assert.equal(setupPage.status,200);assert.match(setupPage.body,/id="admin-setup-form"/);
 assert.match((await get(port,'/','replacement.example')).body,/rel="canonical" href="http:\/\/replacement.example\//);
 assert.match((await get(port,'/robots.txt','replacement.example')).body,/http:\/\/replacement.example\/sitemap.xml/);
 for(const path of ['/','/articles/','/about/','/posts.json','/collections/','/assets/logo.svg'])assert.equal((await get(port,path)).status,200,path);
 for(const file of readdirSync('assets',{recursive:true}).filter(name=>name.endsWith('.mjs'))) {
  const response=await get(port,'/assets/'+file);
  assert.equal(response.status,200,file);
  assert.match(response.headers['content-type'],/^(text|application)\/javascript/,file);
 }
 assert.equal((await get(port,'/.env')).status,404);
 assert.equal((await get(port,'/article-template.html')).status,404);
 assert.equal((await get(port,'/api/posts')).status,401);
 assert.equal((await get(port,'/admin/login/')).status,403);
 docker('exec',name,'node','--input-type=module','-e',"import {LocalDatabase,LocalImages} from './server/storage.mjs';const db=new LocalDatabase('/data/blog.sqlite');await db.prepare('INSERT INTO site_settings VALUES(1,?,1)').bind('smoke@example.com').run();db.close();await new LocalImages('/uploads').put('12345678-1234-1234-1234-123456789abc.png',new Uint8Array([137,80,78,71,13,10,26,10]));");
 docker('stop','--time','15',name);docker('rm',name);
 port=await start();
 assert.match((await get(port,'/about/')).body,/smoke@example.com/);
 assert.equal((await get(port,'/images/12345678-1234-1234-1234-123456789abc.png')).status,200);
 console.log('Container smoke passed: HTTP routes, non-root/read-only runtime and database/upload persistence across replacement.');
}catch(error){try{console.error(docker('logs','--tail','50',name));}catch{}throw error;}
finally{try{docker('rm','-f',name);}catch{}rmSync(root,{recursive:true,force:true});}
