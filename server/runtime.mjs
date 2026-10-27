import {firstRun,localSetupConnection} from './setup.mjs';
import {createServer} from 'node:http';
import {isIP} from 'node:net';
import {Readable, Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
const maximum=25*1024*1024;
export function configuration(env=process.env) {
  const port=Number(env.PORT||3000);
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid PORT');
  const trusted=(env.TRUST_PROXY_IPS||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(trusted.some(ip=>!isIP(ip)))throw Error('TRUST_PROXY_IPS accepts exact IP addresses only');
  return {port,host:env.HOST||'0.0.0.0',trusted};
}
export function clientIP(socketIP, headers, trusted) {
  const peer=socketIP?.replace(/^::ffff:/,'')||'';
  if(trusted.includes(peer)) {
    const forwarded=headers['x-real-ip'];
    if(typeof forwarded==='string'&&isIP(forwarded))return forwarded;
  }
  return peer;
}
export function requestURL(req, config) {
  const host=req.headers.host;
  if(typeof host!=='string'||!host||/[\s/\\@?#%,]/.test(host))throw Object.assign(Error('Invalid Host'),{status:400});
  let protocol=req.socket.encrypted?'https':'http';
  const peer=req.socket.remoteAddress?.replace(/^::ffff:/,'');
  const forwarded=req.headers['x-forwarded-proto'];
  if(config.trusted.includes(peer)&&forwarded!==undefined) {
    if(!['http','https'].includes(forwarded))throw Object.assign(Error('Invalid proxy protocol'),{status:400});
    protocol=forwarded;
  }
  let origin,url;
  try {origin=new URL(protocol+'://'+host);url=new URL(req.url,origin);}catch{throw Object.assign(Error('Invalid URL'),{status:400});}
  if(origin.username||origin.password||origin.pathname!=='/'||!req.url.startsWith('/')||url.origin!==origin.origin)throw Object.assign(Error('Invalid request target'),{status:400});
  return url;
}
export function siteMetadata(html, origin) {
  const end=html.toLowerCase().indexOf('</head>');if(end<0)return html;
  return html.slice(0,end).replace(/<(?:link|meta)\b[^>]*>/gi,tag=>tag.replace(/(["'])https:\/\/itfetter\.com(?=\/)/g,(_,quote)=>quote+origin))+html.slice(end);
}
export function httpServer(handler, env, config) {
  const server=createServer(async(req,res)=>{
    try {
      if(req.url==='/healthz'&&['GET','HEAD'].includes(req.method)) {
        await env.DB.prepare('SELECT 1 AS ok').first();
        res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(req.method==='HEAD'?undefined:'{"ok":true}');return;
      }
      const url=requestURL(req,config);
      if(Number(req.headers['content-length'])>maximum){res.writeHead(413,{'connection':'close'});res.end('Request too large');return;}
      const headers=new Headers();
      for(const [key,value] of Object.entries(req.headers))if(value!==undefined&&!['host','connection','transfer-encoding','cf-connecting-ip','x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-real-ip','forwarded'].includes(key))headers.set(key,Array.isArray(value)?value.join(', '):value);
      headers.set('cf-connecting-ip',clientIP(req.socket.remoteAddress,req.headers,config.trusted));
      let size=0;
      const limiter=new Transform({transform(chunk,encoding,callback){size+=chunk.length;callback(size>maximum?Object.assign(Error('Request too large'),{status:413}):null,chunk);}});
      const body=['GET','HEAD'].includes(req.method)?undefined:Readable.toWeb(req.pipe(limiter));
      // Pipe does not forward source errors automatically.
      req.on('error',error=>limiter.destroy(error));
      const request=new Request(url,{method:req.method,headers,body,...(body?{duplex:'half'}:{})});
      const runtimeEnv={...env,ENVIRONMENT:url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)?'development':'production'};
      let response=await firstRun(request,runtimeEnv,localSetupConnection(req,config,url));
      if(!response)response=await handler.fetch(request,runtimeEnv,{waitUntil(p){Promise.resolve(p).catch(()=>console.error('Background task failed'));}});
      if(response.body&&(response.headers.get('content-type')||'').includes('text/html')) {
        const html=siteMetadata(await response.text(),url.origin);
        const next=new Headers(response.headers);next.delete('content-length');next.delete('etag');
        response=new Response(html,{status:response.status,headers:next});
      }
      res.statusCode=response.status;
      for(const [key,value] of response.headers)if(key!=='set-cookie')res.setHeader(key,value);
      const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
      if(response.body&&req.method!=='HEAD')await pipeline(Readable.fromWeb(response.body),res);else res.end();
    }catch(error){if(!res.headersSent){res.writeHead([400,413].includes(error.status)?error.status:500,{'content-type':'text/plain','cache-control':'no-store'});res.end('Request failed');}else res.destroy();console.error('HTTP request failed:',error.code||error.status||'internal');}
  });
  server.requestTimeout=60000;server.headersTimeout=15000;server.keepAliveTimeout=5000;
  return server;
}
