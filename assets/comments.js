const root=document.getElementById('article-comments');
if(root){
 const id=root.dataset.articleId,list=root.querySelector('[data-comments-list]'),notice=root.querySelector('[data-comment-notice]'),form=root.querySelector('form'),submit=form.querySelector('button'),prev=root.querySelector('[data-comments-prev]'),next=root.querySelector('[data-comments-next]'),pager=root.querySelector('[data-comments-page]'),refresh=root.querySelector('[data-comments-refresh]');
 let page=1,loading=false,submission=null,target=null;
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node};
 const home=el('div'),context=el('div',undefined,'comment-reply-context');form.before(home);form.prepend(context);
 function resetTarget(){target=null;context.replaceChildren();home.after(form)}
 function replyTo(item,card){
  if(submit.disabled)return;target={id:item.id,name:item.name};
  const cancel=el('button','取消回复');cancel.type='button';cancel.onclick=resetTarget;
  context.replaceChildren(el('span','回复 '+item.name),cancel);card.append(form);form.elements.content.focus();
 }
 function render(item,isReply=false){
  const card=el('div',undefined,isReply?'comment-item comment-thread-item':'comment-item'),head=el('div',undefined,'comment-meta');
  card.dataset.commentId=item.id;head.append(el('strong',item.name));
  if(isReply)head.append(el('span','回复 '+(item.target_name||'已隐藏的访客')));
  card.append(head,el('p',item.content,'comment-text'));
  const actions=el('div',undefined,'comment-actions'),button=el('button','回复');button.type='button';button.onclick=()=>replyTo(item,card);
  actions.append(el('time',date(item.created_at)),button);card.append(actions);
  if(item.reply){const author=el('div',undefined,'comment-reply');author.append(el('strong','作者回复'),el('p',item.reply,'comment-text'));card.append(author)}
  if(!isReply&&item.reply_count){
   const thread=el('div',undefined,'comment-thread'),toggle=el('button','展开 '+item.reply_count+' 条回复'),more=el('button','查看更多回复'),rows=el('div',undefined,'comment-thread-rows'),close=el('button','收起回复');
   for(const b of [toggle,more,close])b.type='button';
   let nextPage=1,busy=false;
   async function loadReplies(){
    if(busy)return;busy=true;more.disabled=toggle.disabled=true;
    try{
     const data=await request('/api/comments?post_id='+encodeURIComponent(id)+'&root_id='+item.id+'&page='+nextPage);
     for(const reply of data.items)if(!list.querySelector('[data-comment-id="'+reply.id+'"]'))rows.append(render(reply,true));nextPage++;more.hidden=(nextPage-1)*data.pageSize>=data.total;
     thread.hidden=false;toggle.hidden=true;
    }catch(error){notice.textContent=error.message}
    finally{busy=false;more.disabled=toggle.disabled=false}
   }
   toggle.onclick=()=>void loadReplies();more.onclick=()=>void loadReplies();
   close.onclick=()=>{if(submit.disabled)return;if(thread.contains(form))resetTarget();rows.replaceChildren();nextPage=1;thread.hidden=true;toggle.hidden=false};
   thread.hidden=true;thread.append(rows,more,close);card.append(toggle,thread);
  }
  return card;
 }
 const date=value=>new Date(value).toLocaleString('zh-CN');
 async function request(url,options={}){
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'操作失败，请重试。');return data;
 }
 async function load(){
  if(loading||submit.disabled)return;loading=true;prev.disabled=next.disabled=refresh.disabled=true;list.setAttribute('aria-busy','true');
  try{
   const data=await request('/api/comments?post_id='+encodeURIComponent(id)+'&page='+page);
   const pages=Math.max(1,Math.ceil(data.total/data.pageSize));
   if(page>pages){page=pages;loading=false;return load()}
   resetTarget();list.replaceChildren();
   for(const item of data.items)list.append(render(item));
   if(!data.items.length)list.append(el('p','还没有公开评论，欢迎留下你的想法。','comment-muted'));
   pager.textContent=page+' / '+pages+' · '+data.total+' 条公开评论';prev.disabled=page<=1;next.disabled=page>=pages;
  }catch(error){resetTarget();list.replaceChildren(el('p','评论加载失败，请点击“刷新评论”重试。','comment-muted'));pager.textContent='加载失败'}
  finally{loading=false;refresh.disabled=false;list.removeAttribute('aria-busy')}
 }
 refresh.onclick=()=>void load();prev.onclick=()=>{page--;void load()};next.onclick=()=>{page++;void load()};
 form.onsubmit=async event=>{
  event.preventDefault();if(submit.disabled)return;
  const name=form.elements.name.value.trim(),content=form.elements.content.value.trim();
  if(!name||!content){notice.textContent='请填写昵称和评论。';return}
  const signature=JSON.stringify([name,content,target?.id??null]);
  if(!submission||submission.signature!==signature)submission={signature,id:crypto.randomUUID()};
  submit.disabled=true;notice.textContent='正在提交…';
  try{
   const replyTarget=target,replyCard=form.parentElement;
   const result=await request('/api/comments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:submission.id,post_id:id,name,content,target_id:target?.id??null,website:form.elements.website.value})});
   const posted=result.item;
   form.elements.content.value='';submission=null;resetTarget();notice.textContent=posted?'评论或回复已发布。':'提交已接收，评论目前未公开。';
   if(replyTarget&&posted&&!list.querySelector('[data-comment-id="'+posted.id+'"]')){
    const fresh=render(posted,true);
    if(replyCard.classList.contains('comment-thread-item'))replyCard.after(fresh);
    else{let thread=replyCard.querySelector('.comment-thread');if(!thread){thread=el('div',undefined,'comment-thread');replyCard.append(thread)}thread.hidden=false;(thread.querySelector('.comment-thread-rows')||thread).append(fresh);const toggle=replyCard.querySelector(':scope > button');if(toggle)toggle.hidden=true}
   }else if(!replyTarget){page=1;submit.disabled=false;await load()}
  }catch(error){notice.textContent=error.name==='TimeoutError'?'提交超时，内容已保留，可以再次点击提交。':error.message||'连接失败，内容已保留，请重试。'}
  finally{submit.disabled=false}
 };
 void load();
}
