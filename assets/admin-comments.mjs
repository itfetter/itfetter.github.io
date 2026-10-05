export function mountCommentManagement(api){
 const root=document.querySelector('[data-panel="comments"]'),$=id=>document.getElementById('comment-'+id),list=$('list');
 let page=1,busy=false;
 const statusNames={pending:'待审核',approved:'已公开',hidden:'已隐藏'};
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
 const date=value=>new Date(value).toLocaleString('zh-CN');
 const controls=()=>root.querySelectorAll('button,select,textarea');
 function locked(value){busy=value;controls().forEach(n=>n.disabled=value)}
 async function change(item,action,reply){
  if(busy)return;
  if(action==='trash'&&!await confirmTrash())return;
  locked(true);$('notice').textContent='正在保存…';
  try{await api('/api/admin/comments',{method:'PATCH',body:JSON.stringify({id:item.id,version:item.version,action,...(reply===undefined?{}:{reply})})});busy=false;await load();$('notice').textContent='操作已保存。'}
  catch(error){$('notice').textContent=error.message;locked(false)}
 }
 function confirmTrash(){
  const dialog=$('dialog');dialog.showModal();$('cancel').focus();
  return new Promise(resolve=>{
   const done=value=>{dialog.close();dialog.oncancel=null;$('confirm').onclick=$('cancel').onclick=null;resolve(value)};
   $('confirm').onclick=()=>done(true);$('cancel').onclick=()=>done(false);dialog.oncancel=event=>{event.preventDefault();done(false)};
  });
 }
 async function load(){
  if(busy)return;locked(true);$('notice').textContent='正在加载评论…';
  try{
   const data=await api('/api/admin/comments?status='+$('filter').value+'&page='+page),pages=Math.max(1,Math.ceil(data.total/data.pageSize));
   if(page>pages){page=pages;busy=false;return load()}
   list.replaceChildren();
   for(const item of data.items){
    const card=node('div',undefined,'comment-admin-item'),header=node('div',undefined,'row');
    header.append(node('strong',item.name),node('span',item.deleted_at?'回收站':statusNames[item.status],'muted'),node('time',date(item.created_at),'muted'));
    const article=node('a','文章：'+item.post_title);article.href='/articles/'+encodeURIComponent(item.post_id)+'/';article.target='_blank';article.rel='noopener noreferrer';
    const content=node('p',item.content,'comment-admin-text'),actions=node('div',undefined,'row');
    const action=(label,name,cls)=>{const b=node('button',label,cls);b.type='button';b.onclick=()=>void change(item,name);actions.append(b)};
    if(item.deleted_at)action('恢复','restore');
    else{if(item.status!=='approved')action('审核通过','approve');if(item.status!=='hidden')action('隐藏','hide');action('移入回收站','trash','danger')}
    card.append(header,article);
    card.append(node('p',item.root_id?'访客回复 → '+(item.target_name||'已移除的访客'):'原评论 · 隐藏或移入回收站后，整条讨论不再公开。','muted'),content,actions);
    if(!item.deleted_at){
     const details=node('details'),summary=node('summary',item.reply?'编辑作者回复':'回复评论'),textarea=node('textarea'),save=node('button','保存回复');
     textarea.value=item.reply;textarea.maxLength=3000;textarea.rows=4;textarea.setAttribute('aria-label','作者回复');save.type='button';save.onclick=()=>void change(item,'reply',textarea.value);
     details.append(summary,node('p','审核通过后，评论和作者回复一起公开。清空回复后保存可移除回复。','muted'),textarea,save);card.append(details);
    }
    list.append(card);
   }
   if(!data.items.length)list.append(node('p','当前没有符合条件的评论。','muted'));
   $('count').textContent=data.total+' 条符合筛选 · '+data.pending+' 条待审核';
   $('page').textContent=page+' / '+pages;
   locked(false);$('prev').disabled=page<=1;$('next').disabled=page>=pages;$('notice').textContent='';
  }catch(error){locked(false);$('prev').disabled=$('next').disabled=true;$('notice').textContent=error.message}
 }
 $('filter').onchange=()=>{page=1;void load()};$('refresh').onclick=()=>void load();$('prev').onclick=()=>{page--;void load()};$('next').onclick=()=>{page++;void load()};
 return {load};
}
