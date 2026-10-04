// 页面停留三秒且可见时提交；统计失败不影响阅读。
(()=>{
 let timer;
 window.trackArticleRead=(id,element)=>{
  clearTimeout(timer);
  if(!id||!element)return;
  timer=setTimeout(async()=>{
   if(document.visibilityState!=='visible'||!element.isConnected)return;
   try{
    const response=await fetch('/api/read',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({id})});
    if(!response.ok)return;
    const result=await response.json();if(element.isConnected&&Number.isSafeInteger(result.count))element.textContent=result.count.toLocaleString('zh-CN');
   }catch{}
  },3000);
 };
 const direct=document.getElementById('read-count');
 if(direct?.dataset.articleId)window.trackArticleRead(direct.dataset.articleId,direct);
})();