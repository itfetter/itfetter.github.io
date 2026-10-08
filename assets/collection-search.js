// 渐进增强：无 JavaScript 时仍可用 GET 表单搜索；只请求公开页面。
(() => {
 const form=document.querySelector('.collection-search');
 if(!form)return;
 const input=form.elements.q,order=form.elements.order,clear=form.querySelector('.collection-clear'),status=form.querySelector('[role="status"]');
 let timer,controller,sequence=0,composing=false;
 const cancel=()=>{clearTimeout(timer);controller?.abort();sequence++;document.querySelector('[data-collection-results]').removeAttribute('aria-busy');status.textContent=''};
 async function search(url){
  cancel();const current=sequence;controller=new AbortController();
  const target=url||new URL(location.href);
  if(!url){target.search='';if(input.value.trim())target.searchParams.set('q',input.value.trim());target.searchParams.set('order',order.value)}
  const results=document.querySelector('[data-collection-results]');results.setAttribute('aria-busy','true');status.textContent='正在搜索…';
  try{
   const response=await fetch(target,{signal:controller.signal,headers:{Accept:'text/html'}});
   if(!response.ok)throw new Error('搜索失败');
   const documentResult=new DOMParser().parseFromString(await response.text(),'text/html'),next=documentResult.querySelector('[data-collection-results]');
   if(!next)throw new Error('搜索失败');
   if(current!==sequence)return;
   results.replaceWith(next);
   document.querySelector('.collection-guide').replaceWith(documentResult.querySelector('.collection-guide'));
   clear.hidden=!target.searchParams.get('q');const clearURL=new URL(target);clearURL.searchParams.delete('q');clearURL.searchParams.delete('page');clear.href=clearURL.href;
   history.replaceState(null,'',target);
   status.textContent=next.querySelectorAll('.collection-posts li').length?'搜索结果已更新':'没有匹配的文章，请试试其他关键词。';
  }catch(error){if(current===sequence&&error.name!=='AbortError')status.textContent='搜索未能完成，请点击搜索重试。'}
  finally{if(current===sequence)document.querySelector('[data-collection-results]').removeAttribute('aria-busy')}
 }
 input.addEventListener('input',event=>{cancel();if(!event.isComposing&&!composing)timer=setTimeout(()=>void search(),350)});
 input.addEventListener('compositionstart',()=>{composing=true;cancel()});
 input.addEventListener('compositionend',()=>{composing=false;timer=setTimeout(()=>void search(),350)});
 order.addEventListener('change',()=>void search());
 form.addEventListener('submit',event=>{event.preventDefault();void search()});
 clear.addEventListener('click',event=>{if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();input.value='';void search();input.focus()});
 window.addEventListener('popstate',()=>{const url=new URL(location.href);input.value=url.searchParams.get('q')||'';order.value=url.searchParams.get('order')||order.value;void search(url)});
})();
