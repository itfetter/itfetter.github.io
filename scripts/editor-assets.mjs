// 固定 Vditor 4.0.0，只在云端构建取得必要浏览器资源；运行时全部同源。
import {mkdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
export const version="4.0.0";
export const integrity={"dist/index.min.js":"sha256-pkL+G6VfqDHe1EL1YTplXN0MTXYcKLTiMBlBFXVYYt0=","dist/index.css":"sha256-Kj2H7DeWTvBKRyabxss09b8Wvag9AtYLBZz4xslFYtA=","dist/js/lute/lute.min.js":"sha256-U7YbBRo9/Z7lpQEMhzIzZ54TnY5ixJ2gi0wvLBlVh8s=","dist/js/i18n/zh_CN.js":"sha256-agwH5sQPk0cVsL686iC9u/IMNLpwq56o0iM2ocR6sJw=","dist/js/icons/ant.js":"sha256-qR4U4J3Ne5n0m3uNzGMB/tZ3TWJUf89OlxdXqjqALDM=","dist/css/content-theme/light.css":"sha256-R7a+409kCzWBAPPRzmCZLJhmM0haox1RCynAmXSXySM=","LICENSE":"sha256-xQ1uGUTEwVWO8Spc+k8KToySelaQjBpYfJ1gQA7vZv4="};
export const paths=["dist/index.min.js","dist/index.css","dist/js/lute/lute.min.js","dist/js/i18n/zh_CN.js","dist/js/icons/ant.js","dist/css/content-theme/light.css","LICENSE"];
async function get(path){
 const url="https://unpkg.com/vditor@"+version+"/"+path;
 for(let attempt=0;attempt<3;attempt++){
  try{const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error("HTTP "+response.status);
   const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>10*1024*1024)throw Error("资源大小异常");return bytes;
  }catch(error){if(attempt===2)throw Error("Vditor 资源构建失败："+path+" "+error.message)}
 }
}
export async function buildDocumentEditor(dist){
 const manifest={version,files:[]};
 for(const path of paths){
  const bytes=await get(path),digest="sha256-"+createHash("sha256").update(bytes).digest("base64");
  if(digest!==integrity[path])throw Error("资源完整性不匹配："+path);
  const target=new URL("assets/vendor/vditor/"+path,dist);await mkdir(new URL("./",target),{recursive:true});await writeFile(target,bytes);
  manifest.files.push({path,integrity:digest,bytes:bytes.length});
 }
 await writeFile(new URL("assets/vendor/vditor/manifest.json",dist),JSON.stringify(manifest));
 console.log("Vditor 固定版本资源校验完成："+JSON.stringify(manifest));
}
