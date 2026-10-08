export function mountCommentManagement(api,articles=()=>[]){
 const root=document.querySelector('[data-panel="comments"]'),$=id=>document.getElementById('comment-'+id),list=$('list');
 let page=1,pages=1,busy=false,confirming=false,items=[],query='',observer,searchTimer,pendingSearch=false;
 const selected=new Map(),statusNames={pending:'待审核',approved:'已公开',hidden:'已隐藏'};
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
 const date=value=>new Date(value).toLocaleString('zh-CN');
 const trash=()=>$('filter').value==='trash';
 function sync(){
  root.querySelector('.comment-selection').hidden=!items.length;
  $('clear').disabled=busy||!(query||$('search').value||$('article').value||$('filter').value!=='all');
  const checked=items.filter(item=>selected.has(item.id)).length;
  $('selected').textContent='已选 '+checked+' 条';
  root.querySelector('.comment-selection').dataset.selected=String(checked>0);
  $('select-all').checked=items.length>0&&checked===items.length;
  $('select-all').indeterminate=checked>0&&checked<items.length;
  $('select-all').disabled=busy||!items.length;
  for(const action of ['approve','hide','trash','restore','purge']){
   const button=$('bulk-'+action);button.classList.toggle('hidden',(['restore','purge'].includes(action))!==trash());button.disabled=busy||!checked;
  }
  $('prev').disabled=busy||page<=1;$('next').disabled=busy||page>=pages;
 }
 function locked(value){
  busy=value;root.querySelectorAll('button,select,textarea,input').forEach(n=>n.disabled=value);sync();
 }
 function confirmTrash(count=1,permanent=false){
  const dialog=$('dialog');
  dialog.querySelector('h2').textContent=permanent?'彻底删除评论？':'移入回收站？';
  $('confirm').textContent=permanent?'彻底删除':'移入回收站';
  $('dialog-description').textContent=permanent?'彻底删除所选 '+count+' 条评论及其作者回复，无法从回收站恢复。删除原评论还会清除该讨论中的全部访客回复，包括未勾选的回复。已下载的离线备份不受影响。':'将所选 '+count+' 条评论移入回收站，评论及其作者回复停止公开显示。原评论移入回收站后，整条讨论不再公开。可在回收站恢复。';
  dialog.showModal();$('cancel').focus();
  return new Promise(resolve=>{
   const done=value=>{dialog.close();dialog.oncancel=null;$('confirm').onclick=$('cancel').onclick=null;resolve(value)};
   $('confirm').onclick=()=>done(true);$('cancel').onclick=()=>done(false);dialog.oncancel=event=>{event.preventDefault();done(false)};
  });
 }
 async function change(item,action,reply){
  if(busy||confirming)return;
  if(['trash','purge'].includes(action)){confirming=true;const ok=await confirmTrash(1,action==='purge');confirming=false;if(!ok)return}
  locked(true);$('notice').textContent='正在保存…';
  try{
   await api('/api/admin/comments',{method:'PATCH',body:JSON.stringify({id:item.id,version:item.version,action,...(action==='purge'?{confirm:true}:{}),...(reply===undefined?{}:{reply})})});
   busy=false;const refreshed=await load();if(refreshed)$('notice').textContent='操作已保存。';else $('notice').textContent='操作已保存，但列表刷新失败。请刷新评论。';
  }catch(error){$('notice').textContent=error.message;locked(false)}
 }
 async function bulk(action){
  if(busy||confirming||!selected.size)return;
  const snapshot=[...selected].map(([id,version])=>({id,version}));
  if(['trash','purge'].includes(action)){confirming=true;const ok=await confirmTrash(snapshot.length,action==='purge');confirming=false;if(!ok)return}
  locked(true);$('notice').textContent='正在保存所选评论…';
  try{
   const result=await api('/api/admin/comments/bulk',{method:'POST',body:JSON.stringify({action,items:snapshot,...(action==='purge'?{confirm:true}:{})})});
   busy=false;const refreshed=await load();$('notice').textContent='已处理 '+result.changed+' 条评论。'+(refreshed?'':'列表刷新失败，请刷新评论。');
  }catch(error){$('notice').textContent=error.message;locked(false)}
 }
 function renderArticles(){
  const value=$('article').value;$('article').replaceChildren(new Option('全部文章',''));
  for(const item of articles())$('article').add(new Option(item.title||item.id,item.id));
  $('article').value=value;
 }
 async function load(){
  if(busy||confirming)return false;
  locked(true);$('search').disabled=false;$('notice').textContent='正在加载评论…';selected.clear();
  try{
   renderArticles();
   const params=new URLSearchParams({status:$('filter').value,page:String(page)});
   if($('article').value)params.set('post_id',$('article').value);if(query)params.set('q',query);
   const data=await api('/api/admin/comments?'+params);pages=Math.max(1,Math.ceil(data.total/data.pageSize));
   if(page>pages){page=pages;busy=false;return load()}
   observer?.disconnect();observer=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{
    for(const {target} of entries){const button=target.nextElementSibling;if(target.classList.contains('collapsed'))button.hidden=target.scrollHeight<=target.clientHeight+1}
   }):null;
   items=data.items;list.replaceChildren();
   for(const item of items){
    const card=node('div',undefined,'comment-admin-item'),header=node('div',undefined,'row'),check=node('input');
    check.type='checkbox';check.setAttribute('aria-label','选择评论：'+item.name);
    check.onchange=()=>{if(check.checked)selected.set(item.id,item.version);else selected.delete(item.id);sync()};
    header.append(check,node('strong',item.name),node('span',item.deleted_at?'回收站':statusNames[item.status],'muted'),node('time',date(item.created_at),'muted'));
    const article=node('a','文章：'+item.post_title);article.href='/articles/'+encodeURIComponent(item.post_id)+'/';article.target='_blank';article.rel='noopener noreferrer';
    const content=node('p',item.content,'comment-admin-text collapsed'),expand=node('button','查看全文','comment-expand'),actions=node('div',undefined,'row');
    expand.type='button';expand.hidden=true;expand.setAttribute('aria-expanded','false');expand.onclick=()=>{
     const collapsed=content.classList.toggle('collapsed');expand.textContent=collapsed?'查看全文':'收起';expand.setAttribute('aria-expanded',String(!collapsed));
    };
    const action=(label,name,cls)=>{const b=node('button',label,cls);b.type='button';b.onclick=()=>void change(item,name);actions.append(b)};
    if(item.deleted_at){action('恢复','restore');action('彻底删除','purge','danger')}
    else{if(item.status!=='approved')action(item.status==='hidden'?'重新公开':'公开','approve');if(item.status!=='hidden')action('隐藏','hide');action('移入回收站','trash','danger')}
    card.append(header,article,node('p',item.root_id?'访客回复 → '+(item.target_name||'已移除的访客'):'原评论 · 隐藏或移入回收站后，整条讨论不再公开。','muted'),content,expand,actions);
    if(!item.deleted_at){
     const details=node('details'),summary=node('summary',item.reply?'编辑作者回复':'回复评论'),textarea=node('textarea'),save=node('button','保存回复');
     textarea.value=item.reply;textarea.maxLength=3000;textarea.rows=4;textarea.setAttribute('aria-label','作者回复');save.type='button';save.onclick=()=>void change(item,'reply',textarea.value);
     details.append(summary,node('p','公开状态下，评论和作者回复一起显示。清空回复后保存可移除回复。','muted'),textarea,save);card.append(details);
    }
    list.append(card);observer?.observe(content);
    requestAnimationFrame(()=>{if(content.isConnected&&content.classList.contains('collapsed'))expand.hidden=content.scrollHeight<=content.clientHeight+1});
   }
   if(!items.length)list.append(node('p',query||$('article').value||$('filter').value!=='all'?'没有符合筛选的评论，可清除筛选查看全部。':'还没有访客评论。','muted'));
   $('count').textContent=data.total+' 条符合筛选 · 全站 '+data.pending+' 条历史待审核';
   $('page').textContent=page+' / '+pages;$('page').parentElement.hidden=pages<=1;
   locked(false);$('notice').textContent='';return true;
  }catch(error){items=[];list.replaceChildren(node('p','评论未能加载，请刷新重试。','muted'));locked(false);$('prev').disabled=$('next').disabled=true;$('notice').textContent=error.message;return false}
  finally{if(pendingSearch&&!busy){pendingSearch=false;queueMicrotask(()=>{query=$('search').value.trim();page=1;void load()})}}
 }
 const resetPage=()=>{page=1;void load()};
 $('filter').onchange=resetPage;$('article').onchange=resetPage;$('refresh').onclick=()=>void load();
 const search=()=>{clearTimeout(searchTimer);if(busy){pendingSearch=true;return}query=$('search').value.trim();resetPage()};
 $('search').oninput=event=>{clearTimeout(searchTimer);if(event.isComposing)return;searchTimer=setTimeout(search,350);$('clear').disabled=busy};
 $('search').addEventListener('compositionstart',()=>clearTimeout(searchTimer));
 $('search').addEventListener('compositionend',()=>{searchTimer=setTimeout(search,350)});
 $('search-form').onsubmit=event=>{event.preventDefault();search()};
 $('clear').onclick=()=>{clearTimeout(searchTimer);pendingSearch=false;query='';$('search').value='';$('article').value='';$('filter').value='all';resetPage()};
 $('prev').onclick=()=>{if(!busy&&page>1){page--;void load()}};$('next').onclick=()=>{if(!busy&&page<pages){page++;void load()}};
 $('select-all').onchange=()=>{selected.clear();if($('select-all').checked)for(const item of items)selected.set(item.id,item.version);list.querySelectorAll('input[type=checkbox]').forEach(n=>n.checked=$('select-all').checked);sync()};
 for(const action of ['approve','hide','trash','restore','purge'])$('bulk-'+action).onclick=()=>void bulk(action);
 return {load};
}
