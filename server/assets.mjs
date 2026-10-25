import {readFile, realpath, stat} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.ico':'image/x-icon'};
export function localAssets(directory) {
  const root=resolve(directory);
  return {async fetch(request) {
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
    let path;
    try {path=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response('Bad path',{status:400});}
    if(path.includes('\\')||path.includes('\0')||path.split('/').some(p=>p.startsWith('.')))return new Response('Not found',{status:404});
    let filename=resolve(root,'.'+path);
    if(!filename.startsWith(root+sep)&&filename!==root)return new Response('Not found',{status:404});
    try {
      if((await stat(filename)).isDirectory()) {
        if(!path.endsWith('/'))return Response.redirect(new URL(path+'/'+new URL(request.url).search,request.url),308);
        filename=resolve(filename,'index.html');
      }
      filename=await realpath(filename);
      if(!filename.startsWith(root+sep))return new Response('Not found',{status:404});
      const data=await readFile(filename);
      return new Response(request.method==='HEAD'?null:data,{headers:{'content-type':mime[extname(filename)]??'application/octet-stream','cache-control':'public, max-age=0, must-revalidate','x-content-type-options':'nosniff'}});
    }catch(error){if(['ENOENT','ENOTDIR','EISDIR'].includes(error.code))return new Response('Not found',{status:404});throw error;}
  }};
}
