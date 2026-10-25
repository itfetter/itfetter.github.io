import {createServer} from 'node:http';
import {isIP} from 'node:net';
import {Readable, Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
const maximum=25*1024*1024;
export function configuration(env=process.env) {
  const origin=new URL(env.PUBLIC_ORIGIN||'https://itfetter.com');
  const development=env.ENVIRONMENT==='development';
  if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||
    (origin.protocol!=='https:'&&!(development&&origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname))))throw Error('PUBLIC_ORIGIN must be a canonical HTTPS origin');
  const port=Number(env.PORT||3000);
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid PORT');
  const trusted=(env.TRUST_PROXY_IPS||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(trusted.some(ip=>!isIP(ip)))throw Error('TRUST_PROXY_IPS accepts exact IP addresses only');
  return {origin:origin.origin,port,host:env.HOST||'0.0.0.0',trusted,development};
}
export function clientIP(socketIP, headers, trusted) {
  const peer=socketIP?.replace(/^::ffff:/,'')||'';
  if(trusted.includes(peer)) {
    const forwarded=headers['x-real-ip'];
    if(typeof forwarded==='string'&&isIP(forwarded))return forwarded;
  }
  return peer;
}
export function httpServer(handler, env, config) {
  const server=createServer(async(req,res)=>{
    try {
      if(req.url==='/healthz'&&['GET','HEAD'].includes(req.method)) {
        await env.DB.prepare('SELECT 1 AS ok').first();
        res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(req.method==='HEAD'?undefined:'{"ok":true}');return;
      }
      if(req.headers.host!==new URL(config.origin).host){res.writeHead(421);res.end('Unexpected host');return;}
      const url=new URL(req.url,config.origin);
      if(!req.url.startsWith('/')||url.origin!==config.origin){res.writeHead(400);res.end('Invalid request target');return;}
      if(Number(req.headers['content-length'])>maximum){res.writeHead(413,{'connection':'close'});res.end('Request too large');return;}
      const headers=new Headers();
      for(const [key,value] of Object.entries(req.headers))if(value!==undefined&&!['host','connection','transfer-encoding','cf-connecting-ip','x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-real-ip'].includes(key))headers.set(key,Array.isArray(value)?value.join(', '):value);
      headers.set('cf-connecting-ip',clientIP(req.socket.remoteAddress,req.headers,config.trusted));
      let size=0;
      const limiter=new Transform({transform(chunk,encoding,callback){size+=chunk.length;callback(size>maximum?Object.assign(Error('Request too large'),{status:413}):null,chunk);}});
      const body=['GET','HEAD'].includes(req.method)?undefined:Readable.toWeb(req.pipe(limiter));
      // Pipe does not forward source errors automatically.
      req.on('error',error=>limiter.destroy(error));
      const request=new Request(url,{method:req.method,headers,body,...(body?{duplex:'half'}:{})});
      const response=await handler.fetch(request,env,{waitUntil(p){Promise.resolve(p).catch(()=>console.error('Background task failed'));}});
      res.statusCode=response.status;
      for(const [key,value] of response.headers)if(key!=='set-cookie')res.setHeader(key,value);
      const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
      if(response.body&&req.method!=='HEAD')await pipeline(Readable.fromWeb(response.body),res);else res.end();
    }catch(error){if(!res.headersSent){res.writeHead(error.status===413?413:500,{'content-type':'text/plain','cache-control':'no-store'});res.end('Request failed');}else res.destroy();console.error('HTTP request failed:',error.code||error.status||'internal');}
  });
  server.requestTimeout=60000;server.headersTimeout=15000;server.keepAliveTimeout=5000;
  return server;
}
