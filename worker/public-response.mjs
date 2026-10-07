// 仅缓存公开内容；浏览器每次校验，边缘副本最多保留30秒。
const ttl=30;
export function publicCacheKey(request) {
 const url=new URL(request.url);
 if(!["GET","HEAD"].includes(request.method)||url.protocol!=="https:")return null;
 if(!["/posts.json","/posts.js","/sitemap.xml","/robots.txt"].includes(url.pathname)&&!/^\/articles\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(url.pathname))return null;
 url.search="?__blog_public_cache=20261007-multi-collections-v1";url.hash="";
 return new Request(url,{method:"GET"});
}
function outward(response,method,hit){
 const headers=new Headers(response.headers);headers.set("cache-control","public, max-age=0, must-revalidate");headers.set("x-blog-cache",hit?"HIT":"MISS");
 return new Response(method==="HEAD"?null:response.body,{status:response.status,statusText:response.statusText,headers});
}
export async function publicResponse(request,ctx,render,cache=globalThis.caches?.default){
 const key=publicCacheKey(request);if(!key)return render(request);
 if(cache){try{const hit=await cache.match(key);if(hit)return outward(hit,request.method,true)}catch{/* 缓存失效时正常读取源内容。 */}}
 const url=new URL(request.url);url.search="";url.hash="";
 const response=await render(new Request(url,{method:"GET"}));
 if(response.status!==200||response.headers.has("set-cookie"))return request.method==="HEAD"?new Response(null,response):response;
 if(cache&&ctx?.waitUntil){const stored=response.clone();stored.headers.set("cache-control","public, max-age="+ttl);ctx.waitUntil(cache.put(key,stored).catch(()=>{}))}
 return outward(response,request.method,false);
}
export function notFound(request){
 const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>页面未找到 — itfetter</title><style>body{margin:0;background:#f5f3ee;color:#242722;font:16px/1.8 system-ui,sans-serif}main{max-width:640px;padding:100px 24px;margin:auto}small{color:#ce603e;letter-spacing:.2em}h1{font-size:clamp(30px,6vw,48px);line-height:1.3}p{color:#626861}nav{display:flex;gap:14px;flex-wrap:wrap}a{display:inline-block;padding:10px 20px;border:1px solid #1f332d;border-radius:8px;color:#1f332d;text-decoration:none}a:first-child{background:#1f332d;color:white}a:focus-visible{outline:3px solid #ce603e;outline-offset:4px}</style></head><body><main><small>404 / PAGE NOT FOUND</small><h1>这页记录，暂时找不到了。</h1><p>链接可能有误，或者这篇文章已撤下。你可以回到首页，继续寻找感兴趣的内容。</p><nav aria-label="返回博客"><a href="/">返回首页</a><a href="/articles/">浏览文章</a><a href="/about/#contact">联系作者</a></nav></main></body></html>';
 return new Response(request.method==="HEAD"?null:html,{status:404,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-robots-tag":"noindex"}});
}

