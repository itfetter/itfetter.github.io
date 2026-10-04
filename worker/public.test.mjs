import test from "node:test";
import assert from "node:assert/strict";
import {publicCacheKey,publicResponse,notFound} from "./public-response.mjs";
import {readListState,listStateUrl,sendContact} from "../assets/public-utils.mjs";
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
