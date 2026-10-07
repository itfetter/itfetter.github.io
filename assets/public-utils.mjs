// 公开列表状态和留言请求；不保存访客留言或后台凭据。
export function readListState(url) {
 const params=new URL(url).searchParams, raw=params.get("page")||"1";
 return {category:(params.get("category")||"全部").slice(0,80),query:(params.get("q")||"").slice(0,300),sort:params.get("sort")==="reads"?"reads":"recent",page:/^[1-9][0-9]{0,5}$/.test(raw)?Number(raw):1};
}
export function listStateUrl(url,state) {
 const result=new URL(url);for(const key of ["category","q","sort","page"])result.searchParams.delete(key);
 if(state.category&&state.category!=="全部")result.searchParams.set("category",state.category);
 if(state.query)result.searchParams.set("q",state.query);
 if(state.sort==="reads")result.searchParams.set("sort","reads");
 if(state.page>1)result.searchParams.set("page",String(state.page));
 return result.pathname+result.search+result.hash;
}
export async function sendContact(data,{fetcher=fetch,timeoutMs=15000}={}) {
 const controller=new AbortController();let expired=false;
 const timer=setTimeout(()=>{expired=true;controller.abort()},timeoutMs);
 try{
  const response=await fetcher("/api/contact",{method:"POST",credentials:"same-origin",signal:controller.signal,headers:{"content-type":"application/json"},body:JSON.stringify(data)});
  let result;try{result=await response.json()}catch{if(expired)throw Error("timeout");throw Error("服务暂时未返回有效结果，请稍后再试。")}
  if(!response.ok)throw Error(result?.error||"提交失败，请稍后再试。");
  if(result?.ok!==true)throw Error("未能确认留言是否收到，请稍后再试。");
  return result;
 }catch(error){if(expired)throw Error("请求超时，留言可能已收到。请稍后再确认，避免重复提交；你的输入已保留。");throw error}
 finally{clearTimeout(timer)}
}

export function legacyPageUrl(url) {
 const source=new URL(url),match=source.hash.match(/^#post\/([^/?#]+)/);
 if(match){let id;try{id=decodeURIComponent(match[1])}catch{return "/articles/"}
 return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)?"/articles/"+encodeURIComponent(id)+"/":"/articles/"}
 if(source.pathname!=="/")return null;
 const destinations={"#articles":"/articles/","#collections":"/collections/","#archive":"/archive/","#about":"/about/","#contact":"/about/#contact"};
 const target=destinations[source.hash];
 return target?(target+(["#articles","#collections"].includes(source.hash)?source.search:"")):null;
}
