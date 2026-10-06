export function mountCommentManagement(api,articles=()=>[]){
 const root=document.querySelector('[data-panel="comments"]'),$=id=>document.getElementById('comment-'+id),list=$('list');
 let page=1,pages=1,busy=false,confirming=false,items=[],query='',observer;
 const selected=new Map(),statusNames={pending:'待审核',approved:'已公开',hidden:'已隐藏'};
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
 const date=value=>new Date(value).toLocaleString('zh-CN');
 const trash=()=>$('filter').value==='trash';
 function sync(){
  const checked=items.filter(item=>selected.has(item.id)).length;
  $('selected').textContent='已选 '+checked+' 条';
  $('select-all').checked=items.length>0&&checked===items.length;
  $('select-all').indeterminate=checked>0&&checked<items.length;
  $('select-all').disabled=busy||!items.length;
  for(const action of ['approve','hide','trash','restore']){
   const button=$('bulk-'+action);button.classList.toggle('hidden',(action==='restore')!==trash());button.disabled=busy||!checked;
  }
  $('prev').disabled=busy||page<=1;$('next').disabled=busy||page>=pages;
 }
 function locked(value){
  busy=value;root.querySelectorAll('button,select,textarea,input').forEach(n=>n.disabled=value);sync();
 }
 function confirmTrash(count=1){
  const dialog=$('dialog');
  $('dialog-description').textContent='将所选 '+count+' 条评论移入回收站，评论及其作者回复停止公开显示。原评论移入回收站后，整条讨论不再公开。可在回收站恢复。';
  dialog.showModal();$('cancel').focus();
  return new Promise(resolve=>{
   const done=value=>{dialog.close();dialog.oncancel=null;$('confirm').onclick=$('cancel').onclick=null;resolve(value)};
   $('confirm').onclick=()=>done(true);$('cancel').onclick=()=>done(false);dialog.oncancel=event=>{event.preventDefault();done(false)};
  });
 }
 async function change(item,action,reply){
  if(busy||confirming)return;
  if(action==='trash'){confirming=true;const ok=await confirmTrash();confirming=false;if(!ok)return}
  locked(true);$('notice').textContent='正在保存…';
  try{
   await api('/api/admin/comments',{method:'PATCH',body:JSON.stringify({id:item.id,version:item.version,action,...(reply===undefined?{}:{reply})})});
   busy=false;const refreshed=await load();if(refreshed)$('notice').textContent='操作已保存。';else $('notice').textContent='操作已保存，但列表刷新失败。请刷新评论。';
  }catch(error){$('notice').textContent=error.message;locked(false)}
 }
 async function bulk(action){
  if(busy||confirming||!selected.size)return;
  const snapshot=[...selected].map(([id,version])=>({id,version}));
  if(action==='trash'){confirming=true;const ok=await confirmTrash(snapshot.length);confirming=false;if(!ok)return}
  locked(true);$('notice').textContent='正在保存所选评论…';
  try{
   const result=await api('/api/admin/comments/bulk',{method:'POST',body:JSON.stringify({action,items:snapshot})});
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
  locked(true);$('notice').textContent='正在加载评论…';selected.clear();
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
    if(item.deleted_at)action('恢复','restore');
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
   if(!items.length)list.append(node('p','当前没有符合条件的评论。','muted'));
   $('count').textContent=data.total+' 条符合筛选 · 全站 '+data.pending+' 条历史待审核';
   $('page').textContent=page+' / '+pages;
   locked(false);$('notice').textContent='';return true;
  }catch(error){items=[];list.replaceChildren(node('p','评论未能加载，请刷新重试。','muted'));locked(false);$('prev').disabled=$('next').disabled=true;$('notice').textContent=error.message;return false}
 }
 const resetPage=()=>{page=1;void load()};
 $('filter').onchange=resetPage;$('article').onchange=resetPage;$('refresh').onclick=()=>void load();
 $('search-form').onsubmit=event=>{event.preventDefault();if(busy)return;query=$('search').value.trim();resetPage()};
 $('clear').onclick=()=>{query='';$('search').value='';$('article').value='';$('filter').value='all';resetPage()};
 $('prev').onclick=()=>{if(!busy&&page>1){page--;void load()}};$('next').onclick=()=>{if(!busy&&page<pages){page++;void load()}};
 $('select-all').onchange=()=>{selected.clear();if($('select-all').checked)for(const item of items)selected.set(item.id,item.version);list.querySelectorAll('input[type=checkbox]').forEach(n=>n.checked=$('select-all').checked);sync()};
 for(const action of ['approve','hide','trash','restore'])$('bulk-'+action).onclick=()=>void bulk(action);
 return {load};
}
