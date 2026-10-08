import test from "node:test";
import assert from "node:assert/strict";
import {publicCacheKey,publicResponse,notFound} from "./public-response.mjs";
import {readListState,listStateUrl,sendContact,legacyPageUrl} from "../assets/public-utils.mjs";
const origin="https://itfetter.com";
test("公开缓存命中减少源读取，查询参数共享缓存，HEAD无正文",async()=>{
 const data=new Map(),pending=[],ctx={waitUntil(p){pending.push(p)}},cache={async match(key){return data.get(key.url)?.clone()},async put(key,response){data.set(key.url,response)}};
 let reads=0;const render=async()=>{reads++;return new Response("公开内容",{headers:{"content-type":"text/html"}})};
 const first=await publicResponse(new Request(origin+"/articles/hello/?q=a"),ctx,render,cache);assert.equal(first.headers.get("x-blog-cache"),"MISS");await Promise.all(pending);
 const second=await publicResponse(new Request(origin+"/articles/hello/?q=b"),ctx,render,cache);assert.equal(second.headers.get("x-blog-cache"),"HIT");assert.equal(await second.text(),"公开内容");assert.equal(reads,1);
 const head=await publicResponse(new Request(origin+"/articles/hello/",{method:"HEAD"}),ctx,render,cache);assert.equal(await head.text(),"");assert.equal(reads,1);
 assert.equal(first.headers.get("cache-control"),"public, max-age=0, must-revalidate");
 assert.equal([...data.values()][0].headers.get("cache-control"),"public, max-age=30");
});
test("后台、写入、错误响应和会话响应绝不缓存，缓存故障可回源",async()=>{
 for(const [path,method] of [["/api/posts","GET"],["/admin/","GET"],["/api/contact","POST"],["/articles/hello/","POST"],["/articles/../admin/","GET"]])assert.equal(publicCacheKey(new Request(origin+path,{method})),null);
 let writes=0;const ctx={waitUntil(){}},cache={async match(){throw Error("offline")},async put(){writes++}};
 for(const status of [404,500]){const response=await publicResponse(new Request(origin+"/posts.json"),ctx,async()=>new Response("error",{status}),cache);assert.equal(response.status,status)}
 await publicResponse(new Request(origin+"/posts.json"),ctx,async()=>new Response("private",{headers:{"set-cookie":"session=example"}}),cache);assert.equal(writes,0);
 const fallback=await publicResponse(new Request(origin+"/posts.json"),null,async()=>new Response("[]"),cache);assert.equal(await fallback.text(),"[]");
});
test("404页面保留真实状态码、无脚本及安全返回入口",async()=>{
 const response=notFound(new Request(origin+"/articles/missing/"));assert.equal(response.status,404);assert.match(response.headers.get("content-type"),/text\/html/);const html=await response.text();assert.match(html,/返回首页/);assert.match(html,/浏览文章/);assert.doesNotMatch(html,/<script/);
 assert.equal(await notFound(new Request(origin+"/missing",{method:"HEAD"})).text(),"");
});
test("分类、搜索、排序、分页状态可往返并限制无效输入",()=>{
 const state={category:"建站记录",query:"D1 & R2",sort:"reads",page:3};const href=listStateUrl(origin+"/#articles",state);assert.deepEqual(readListState(origin+href),state);assert.match(href,/#articles$/);
 const invalid=readListState(origin+"/?page=-1&sort=unknown");assert.equal(invalid.page,1);assert.equal(invalid.sort,"recent");
 assert.equal(listStateUrl(origin+"/?page=9&q=test#articles",{category:"全部",query:"",sort:"recent",page:1}),"/#articles");
});
test("留言成功、服务错误、无效响应和请求超时分别处理",async()=>{
 assert.deepEqual(await sendContact({message:"test"},{fetcher:async()=>new Response('{"ok":true}')}),{ok:true});
 await assert.rejects(sendContact({},{fetcher:async()=>new Response('{"error":"限速"}',{status:429})}),/限速/);
 await assert.rejects(sendContact({},{fetcher:async()=>new Response("<html>error")}),/有效结果/);
 await assert.rejects(sendContact({},{fetcher:async()=>new Response("{}")}),/确认留言/);
 await assert.rejects(sendContact({},{timeoutMs:5,fetcher:async(_url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener("abort",()=>reject(new DOMException("aborted","AbortError"))))}),/可能已收到/);
});

test("旧栏目和文章链接迁移，保留列表条件且不劫持新页面章节",()=>{
 assert.equal(legacyPageUrl(origin+"/?category=tech&page=2#articles"),"/articles/?category=tech&page=2");
 assert.equal(legacyPageUrl(origin+"/#collections"),"/collections/");
 assert.equal(legacyPageUrl(origin+"/#archive"),"/archive/");
 assert.equal(legacyPageUrl(origin+"/#about"),"/about/");
 assert.equal(legacyPageUrl(origin+"/#contact"),"/about/#contact");
 assert.equal(legacyPageUrl(origin+"/#post/hello"),"/articles/hello/");
 assert.equal(legacyPageUrl(origin+"/#post/%3Cscript%3E"),"/articles/");
 assert.equal(legacyPageUrl(origin+"/#post/%E0"),"/articles/");
 assert.equal(legacyPageUrl(origin+"/about/#contact"),null);
 const state={category:"随笔",query:"hello",sort:"reads",page:2};
 const href=listStateUrl(origin+"/articles/",state);assert.deepEqual(readListState(origin+href),state);assert.match(href,/^\/articles\/\?/);
});

import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
test('合集搜索忽略迟到结果，失败保留列表并允许手动重试',async()=>{
 const listeners=new Map(),requests=[],pending=[],input={value:''},order={value:'newest'},clear={hidden:true},status={textContent:''};
 let displayed='原始列表';
 const result={setAttribute(){},removeAttribute(){},replaceWith(next){displayed=next.name},querySelectorAll(){return []}};
 const guide={replaceWith(){}};
 const form={elements:{q:input,order},querySelector:s=>s==='.collection-clear'?clear:status,addEventListener:(event,fn)=>listeners.set('form:'+event,fn)};
 for(const [name,element] of [['input',input],['order',order],['clear',clear]])element.addEventListener=(event,fn)=>listeners.set(name+':'+event,fn);
 const location={href:origin+'/collections/example/'};
 runInNewContext(readFileSync(new URL('../assets/collection-search.js',import.meta.url),'utf8'),{
  document:{querySelector:s=>s==='.collection-search'?form:s==='.collection-guide'?guide:result},location,
  window:{addEventListener(){}},URL,AbortController,setTimeout,clearTimeout,
  history:{replaceState(a,b,url){location.href=String(url)}},
  fetch(url){requests.push(String(url));return new Promise(resolve=>pending.push(resolve))},
  DOMParser:class{parseFromString(name){return {querySelector:s=>s==='[data-collection-results]'?{name,querySelectorAll:()=>[{}]}:guide}}}
 });
 const submit=()=>listeners.get('form:submit')({preventDefault(){}}),tick=()=>new Promise(resolve=>setImmediate(resolve));
 input.value='旧搜索';submit();input.value='新搜索';submit();
 pending[1]({ok:true,text:async()=>'新结果'});await tick();
 pending[0]({ok:true,text:async()=>'旧结果'});await tick();
 assert.equal(displayed,'新结果');assert.equal(new URL(location.href).searchParams.get('q'),'新搜索');assert.equal(clear.hidden,false);
 input.value='失败搜索';submit();pending[2]({ok:false});await tick();
 assert.equal(displayed,'新结果');assert.match(status.textContent,/重试/);
 submit();assert.equal(requests.length,4);pending[3]({ok:true,text:async()=>'重试结果'});await tick();assert.equal(displayed,'重试结果');
});
