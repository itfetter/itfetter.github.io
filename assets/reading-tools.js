(()=>{"use strict";
function init(){
 document.querySelectorAll(".reading-tools").forEach(el=>el.remove());
 const body=document.querySelector(".article-view.active .article-body")||document.querySelector("main > article");
 if(!body)return;
 const tools=document.createElement("div");tools.className="reading-tools";
 const headings=[...body.querySelectorAll("h2,h3")];
 if(headings.length){
 const details=document.createElement("details"),summary=document.createElement("summary"),nav=document.createElement("nav");
 summary.textContent="文章目录 · "+headings.length+" 个章节";nav.setAttribute("aria-label","文章目录");
 headings.forEach((heading,i)=>{heading.id="reading-section-"+i;const a=document.createElement("a");a.href="#"+heading.id;a.textContent=heading.textContent;if(heading.tagName==="H3")a.className="toc-sub";a.onclick=event=>{event.preventDefault();heading.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});heading.tabIndex=-1;heading.focus({preventScroll:true})};nav.append(a)});
 details.append(summary,nav);tools.append(details);
 }
 const copy=document.createElement("button");copy.type="button";copy.textContent="复制文章链接 ↗";copy.onclick=async()=>{try{await navigator.clipboard.writeText(location.href);copy.textContent="链接已复制"}catch{copy.textContent="复制失败，请复制浏览器地址"}};tools.append(copy);body.before(tools);
}
function update(){const article=document.querySelector(".article-view.active .article-body")||document.querySelector("main > article");const progress=document.getElementById("reading-progress"),top=document.getElementById("back-top");if(top)top.hidden=scrollY<450;if(progress){const total=article?article.offsetHeight-innerHeight:0;progress.style.width=article?Math.min(100,Math.max(0,(scrollY-article.getBoundingClientRect().top-scrollY)/Math.max(1,total)*100))+"%":"0%"}}
document.getElementById("back-top")?.addEventListener("click",()=>window.scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"}));
let scheduled=false;addEventListener("scroll",()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{update();scheduled=false})},{passive:true});addEventListener("resize",update);addEventListener("article-ready",()=>{init();update()});init();update();
})();
