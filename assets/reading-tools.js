import {headingEntries,findChapter} from "./heading-links.mjs";
(()=>{"use strict";
// 恢复本标签页最后一次公开列表筛选；只接受本站文章列表地址，兼容旧首页列表。
try{const saved=sessionStorage.getItem("blog-list-return");if(saved&&saved.length<2000){const target=new URL(saved,location.origin);if(target.origin===location.origin&&(target.pathname==="/articles/"||target.pathname==="/"&&target.hash==="#articles"))document.querySelectorAll('.post-topbar a[href="/articles/"]').forEach(a=>a.href=target.pathname+target.search+target.hash)}}catch{}
let chapters=[],chapterLinks=[],copyLink=null,tocButton=null;
function syncChapter(scroll=false){const entry=findChapter(location.hash,chapters);chapterLinks.forEach((a,i)=>{if(chapters[i]===entry)a.setAttribute("aria-current","location");else a.removeAttribute("aria-current")});if(copyLink)copyLink.textContent=entry?"复制当前章节链接 ↗":"复制文章链接 ↗";if(scroll&&entry){entry.heading.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});if(!entry.heading.hasAttribute("tabindex"))entry.heading.tabIndex=-1;entry.heading.focus({preventScroll:true})}}
addEventListener("hashchange",()=>syncChapter(true));
function init(){
 chapters=[];chapterLinks=[];copyLink=null;
 document.querySelectorAll(".reading-tools,.reading-toc-dialog,.reading-toc-trigger").forEach(el=>el.remove());tocButton=null;
 const body=document.querySelector(".article-view.active .article-body")||document.querySelector("main > article");
 if(!body)return;
 const tools=document.createElement("div");tools.className="reading-tools";
 const headings=[...body.querySelectorAll("h1,h2,h3,h4,h5,h6")];
 chapters=headingEntries(headings,[...document.querySelectorAll("[id]")].filter(el=>!headings.includes(el)).map(el=>el.id));
 if(headings.length){
 const details=document.createElement("details"),summary=document.createElement("summary"),nav=document.createElement("nav");
 summary.textContent="文章目录 · "+headings.length+" 个章节";nav.setAttribute("aria-label","文章目录");
 chapters.forEach(entry=>{const heading=entry.heading;heading.id=entry.id;const a=document.createElement("a");a.href="#"+encodeURIComponent(entry.id);a.textContent=heading.textContent||"未命名章节";a.style.setProperty("--toc-depth",Math.min(entry.depth,3));a.onclick=event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();if(findChapter(location.hash,chapters)!==entry)location.hash=encodeURIComponent(entry.id);else syncChapter(true)};nav.append(a);chapterLinks.push(a)});
 details.append(summary,nav);tools.append(details);
 // 独立弹层复用同一章节地址，不把读者带回页面顶部。
 const dialog=document.createElement("dialog");dialog.className="reading-toc-dialog";dialog.setAttribute("aria-label","文章章节目录");
 const bar=document.createElement("div");bar.className="reading-toc-header";
 const title=document.createElement("strong");title.textContent="文章目录";
 const close=document.createElement("button");close.type="button";close.textContent="关闭";close.onclick=()=>dialog.close();bar.append(title,close);
 const floatingNav=document.createElement("nav");floatingNav.setAttribute("aria-label","跳转到章节");
 chapters.forEach(entry=>{const a=document.createElement("a");a.href="#"+encodeURIComponent(entry.id);a.textContent=entry.heading.textContent||"未命名章节";a.style.setProperty("--toc-depth",Math.min(entry.depth,3));
 a.onclick=event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();dialog.close();if(findChapter(location.hash,chapters)!==entry)location.hash=encodeURIComponent(entry.id);else syncChapter(true)};floatingNav.append(a)});
 dialog.append(bar,floatingNav);document.body.append(dialog);
 tocButton=document.createElement("button");tocButton.type="button";tocButton.className="reading-toc-trigger";tocButton.textContent="目录 ☷";tocButton.setAttribute("aria-haspopup","dialog");tocButton.hidden=true;
 tocButton.onclick=()=>{const current=findChapter(location.hash,chapters);[...floatingNav.children].forEach((a,i)=>{if(chapters[i]===current)a.setAttribute("aria-current","location");else a.removeAttribute("aria-current")});dialog.showModal();close.focus()};
 dialog.addEventListener("click",event=>{if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close()});
 document.body.append(tocButton);
 }
 body.querySelectorAll("pre").forEach(pre=>{if(pre.nextElementSibling?.classList.contains("code-copy"))return;const button=document.createElement("button");button.type="button";button.className="code-copy";button.textContent="复制代码";button.onclick=async()=>{try{await navigator.clipboard.writeText(pre.querySelector("code")?.textContent||pre.textContent);button.textContent="已复制"}catch{button.textContent="复制失败，请手动选择代码"}};pre.after(button)});
 const copy=document.createElement("button");copyLink=copy;copy.type="button";copy.textContent="复制文章链接 ↗";copy.onclick=async()=>{try{await navigator.clipboard.writeText(location.href);copy.textContent="链接已复制"}catch{copy.textContent="复制失败，请复制浏览器地址"}};tools.append(copy);body.before(tools);syncChapter();if(findChapter(location.hash,chapters))requestAnimationFrame(()=>syncChapter(true));
}
function update(){const article=document.querySelector(".article-view.active .article-body")||document.querySelector("main > article");const progress=document.getElementById("reading-progress"),top=document.getElementById("back-top");if(top)top.hidden=scrollY<450;if(tocButton)tocButton.hidden=scrollY<450;if(progress){const total=article?article.offsetHeight-innerHeight:0;progress.style.width=article?Math.min(100,Math.max(0,(scrollY-article.getBoundingClientRect().top-scrollY)/Math.max(1,total)*100))+"%":"0%"}}
document.getElementById("back-top")?.addEventListener("click",()=>window.scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"}));
let scheduled=false;addEventListener("scroll",()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{update();scheduled=false})},{passive:true});addEventListener("resize",update);addEventListener("article-ready",()=>{init();update()});init();update();
})();
