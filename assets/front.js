const collectionNames=p=>p.collections?.map(c=>c.name)||[p.category];
import {readListState,listStateUrl,sendContact,legacyPageUrl} from "./public-utils.mjs";
"use strict";
let articles=[],loaded=false;
const escapeText=value=>String(value??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=document.getElementById("article-list"),search=document.getElementById("search"),filters=document.querySelector(".filters");
const pageKind=document.body.dataset.page||"home", archive=document.getElementById("archive-list");
let filter="全部",page=1;
const pageSize=5;
function syncState(){const href=listStateUrl(location.href,{category:filter,query:search.value.trim(),sort:document.getElementById("public-sort").value,page});history.replaceState(null,"",href);try{sessionStorage.setItem("blog-list-return",href.split("#")[0])}catch{}}
function restoreState(){const state=readListState(location.href);filter=articles.some(p=>collectionNames(p).includes(state.category))?state.category:"全部";page=state.page;search.value=state.query;document.getElementById("public-sort").value=state.sort;for(const b of filters.querySelectorAll("button")){const active=b.dataset.filter===filter;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active))}}


function postLink(p){return "/articles/"+encodeURIComponent(p.id)+"/"}
function readMeta(p){return Number(p.read_count||0).toLocaleString("zh-CN")+" 次阅读"}
function renderList(){
 if(!loaded||!search)return;
 const term=search.value.trim().toLocaleLowerCase();
 const found=articles.filter(p=>(filter==="全部"||collectionNames(p).includes(filter))&&(p.title+p.summary+collectionNames(p).join(" ")).toLocaleLowerCase().includes(term));
 if(document.getElementById("public-sort").value==="reads")found.sort((a,b)=>(b.read_count||0)-(a.read_count||0));
 document.getElementById("search-results").textContent=(filter==="全部"?"全部文章":filter)+" · "+found.length+" 篇"+(term?"匹配结果":"");
 const pageCount=Math.max(1,Math.ceil(found.length/pageSize));page=Math.max(1,Math.min(page,pageCount));syncState();
 const visible=found.slice((page-1)*pageSize,page*pageSize);
 const pager=document.getElementById("article-pagination");pager.hidden=found.length<=pageSize;
 document.getElementById("article-page-label").textContent=`第 ${page} / ${pageCount} 页`;
 document.getElementById("article-prev").disabled=page===1;document.getElementById("article-next").disabled=page===pageCount;
 list.innerHTML=found.length?visible.map((p,i)=>`<a class="article-row" href="${postLink(p)}"><time>${escapeText(p.date)}</time><div><span class="row-category">${escapeText(collectionNames(p).join(" · "))}</span><h3>${escapeText(p.title)}</h3><p>${escapeText(p.summary)}</p><small class="row-reads">${readMeta(p)}</small></div><span class="row-arrow" aria-hidden="true">↗</span></a>`).join(""):'<div class="empty"><strong>暂时没有匹配的文章</strong><p>试试其他关键词，或返回全部文章。</p><button class="button secondary" id="reset-search">清除筛选</button></div>';
 document.getElementById("reset-search")?.addEventListener("click",()=>{search.value="";setFilter("全部")});
}
function setFilter(name){filter=name;page=1;for(const b of filters.querySelectorAll("button")){const active=b.dataset.filter===name;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active))}renderList()}
filters?.addEventListener("click",e=>{const b=e.target.closest("button[data-filter]");if(b&&filters.contains(b))setFilter(b.dataset.filter)});
function resetPage(){page=1;renderList()}
search?.addEventListener("input",resetPage);document.getElementById("public-sort")?.addEventListener("change",resetPage);
function changePage(delta){page+=delta;renderList();document.querySelector(".article-controls").scrollIntoView({block:"start"})}
document.getElementById("article-prev")?.addEventListener("click",()=>changePage(-1));document.getElementById("article-next")?.addEventListener("click",()=>changePage(1));
function renderArticles(){
 const categories=[...new Set(articles.flatMap(collectionNames).filter(Boolean))];
 if(document.getElementById("public-posts"))document.getElementById("public-posts").textContent=articles.length;
 if(document.getElementById("public-categories"))document.getElementById("public-categories").textContent=categories.length;
 if(filters){filters.innerHTML='<button class="filter active" data-filter="全部" type="button" aria-pressed="true">全部</button>';
 for(const category of categories){const b=document.createElement("button");b.className="filter";b.type="button";b.dataset.filter=category;b.textContent=category;b.setAttribute("aria-pressed","false");filters.append(b)}
 }
 const featured=articles[0];
if(document.getElementById("featured-slot"))document.getElementById("featured-slot").innerHTML="";
if(featured&&document.getElementById("featured-slot"))document.getElementById("featured-slot").innerHTML=`<article class="featured"><div class="featured-visual" aria-hidden="true"><div><small>THE LATEST NOTE</small><span>Notes<br>& ideas.</span><b>ITFETTER / JOURNAL</b></div></div><div class="featured-text"><div class="meta">最新发布 · ${escapeText(collectionNames(featured).join(" · "))}</div><h3><a href="${postLink(featured)}">${escapeText(featured.title)}</a></h3><p>${escapeText(featured.summary)}</p><div class="row spread"><a class="read-link" href="${postLink(featured)}">开始阅读</a><small class="muted">${readMeta(featured)}</small></div></div></article>`;
const months=[...new Set(articles.map(p=>p.date))];
if(archive)archive.innerHTML=months.map((month,index)=>`<details class="archive-month" ${index===0?"open":""}><summary>${escapeText(month)} <span>${articles.filter(p=>p.date===month).length} 篇</span></summary><div>${articles.filter(p=>p.date===month).map(p=>`<a href="${postLink(p)}">${escapeText(p.title)}<span aria-hidden="true">↗</span></a>`).join("")}</div></details>`).join("")||'<p class="muted">还没有文章记录。</p>';

 if(search){restoreState();renderList()}else if(list){list.innerHTML=articles.slice(1,4).map(p=>`<a class="article-row" href="${postLink(p)}"><time>${escapeText(p.date)}</time><div><span class="row-category">${escapeText(collectionNames(p).join(" · "))}</span><h3>${escapeText(p.title)}</h3><p>${escapeText(p.summary)}</p></div><span class="row-arrow" aria-hidden="true">↗</span></a>`).join("")||(featured?"":'<p class="empty">还没有公开文章，欢迎稍后再来。</p>')}
}
let loading=false;
async function loadArticles(){
 if(loading)return;loading=true;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 const target=list||archive;if(!target)return;
 target.setAttribute("aria-busy","true");target.innerHTML='<div class="empty" role="status">正在加载文章…</div>';
 if(document.getElementById("article-pagination"))document.getElementById("article-pagination").hidden=true;
 if(search){search.disabled=true;document.getElementById("public-sort").disabled=true}
 try{
  const response=await fetch("/posts.json",{signal:controller.signal,credentials:"omit"});
  if(!response.ok)throw Error("文章列表暂时无法读取");
  const data=await response.json();
  if(!Array.isArray(data)||!data.every(p=>p&&typeof p.id==="string"&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id)&&["title","summary","category","date"].every(key=>typeof p[key]==="string")))throw Error("文章数据格式错误");
  articles=data;loaded=true;renderArticles();
 }catch{
  if(document.getElementById("search-results"))document.getElementById("search-results").textContent="文章加载失败";
  target.innerHTML='<div class="empty" role="alert"><strong>暂时无法加载文章</strong><p>请检查网络连接后重试。你仍可以通过关于我页面找到联系方式。</p><button id="retry-articles" class="button secondary" type="button">重新加载</button></div>';
  document.getElementById("retry-articles").addEventListener("click",loadArticles);
 }finally{clearTimeout(timeout);loading=false;target.setAttribute("aria-busy","false");if(search){search.disabled=false;document.getElementById("public-sort").disabled=false}}
}
function route(){const target=legacyPageUrl(location.href);if(target)location.replace(target)}
const form=document.getElementById("contact-form");
if(form){form.elements.message.addEventListener("input",()=>{document.getElementById("message-length").textContent=form.elements.message.value.length});
form.addEventListener("submit",async event=>{
 event.preventDefault();const button=document.getElementById("contact-submit"),notice=document.getElementById("contact-notice");
 if(button.disabled)return;button.disabled=true;button.textContent="正在提交…";notice.textContent="";
 try{await sendContact(Object.fromEntries(new FormData(form)));form.reset();document.getElementById("message-length").textContent="0";notice.classList.remove("error");notice.textContent="留言已收到，谢谢你的分享！"}
 catch(error){notice.classList.add("error");notice.textContent=error.message}
 finally{button.disabled=false;button.textContent="发送留言 ↗"}
});
}
document.getElementById("year").textContent=new Date().getFullYear();window.addEventListener("hashchange",route);window.addEventListener("popstate",()=>{if(loaded&&search){restoreState();renderList()}route()});route();

if(list||archive)loadArticles();
