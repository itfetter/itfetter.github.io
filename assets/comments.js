const root=document.getElementById('article-comments');
if(root){
 const id=root.dataset.articleId,list=root.querySelector('[data-comments-list]'),notice=root.querySelector('[data-comment-notice]'),form=root.querySelector('form'),submit=form.querySelector('[type=submit]'),prev=root.querySelector('[data-comments-prev]'),next=root.querySelector('[data-comments-next]'),pager=root.querySelector('[data-comments-page]'),refresh=root.querySelector('[data-comments-refresh]'),count=root.querySelector('[data-comments-count]'),length=root.querySelector('[data-comment-length]');
 let page=1,loading=false,submission=null,target=null;
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node};
 const home=el('div'),context=el('div',undefined,'comment-reply-context');form.before(home);form.prepend(context);
 function updateLength(){length.textContent=form.elements.content.value.length+' / 3000'}
 form.elements.content.addEventListener('input',updateLength);
 function resetTarget(){target=null;context.replaceChildren();home.after(form);submit.textContent='发表评论'}
 function replyTo(item,card){
  if(submit.disabled)return;target={id:item.id,name:item.name};
  const cancel=el('button','取消回复');cancel.type='button';cancel.onclick=()=>{resetTarget();form.elements.content.focus()};
  context.replaceChildren(el('span','正在回复 '+item.name),cancel);card.append(form);submit.textContent='发表回复';form.elements.content.focus();
 }
 function render(item,isReply=false){
  const card=el('div',undefined,isReply?'comment-item comment-thread-item':'comment-item'),head=el('div',undefined,'comment-meta');
  card.dataset.commentId=item.id;const avatar=el('span',Array.from(item.name||'访')[0],'comment-avatar');avatar.setAttribute('aria-hidden','true');
  head.append(el('strong',item.name));const timestamp=el('time',date(item.created_at));timestamp.dateTime=item.created_at;head.append(timestamp);
  if(isReply)head.append(el('span','回复 '+(item.target_name||'已隐藏的访客')));
  card.append(avatar,head,el('p',item.content,'comment-text'));
  const actions=el('div',undefined,'comment-actions'),button=el('button','回复');button.type='button';button.onclick=()=>replyTo(item,card);
  button.setAttribute('aria-label','回复 '+item.name);actions.append(button);card.append(actions);
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
 const date=value=>new Date(value).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
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
   count.textContent=data.total?'· '+data.total+' 个讨论':'';
   if(!data.items.length)list.append(el('p','还没有评论，来分享第一个想法吧。','comment-empty'));
   pager.textContent=page+' / '+pages+' · '+data.total+' 条公开评论';pager.parentElement.hidden=pages<=1;prev.disabled=page<=1;next.disabled=page>=pages;
  }catch(error){notice.textContent='评论加载失败，已有内容和输入已保留，请点击“刷新评论”重试。';if(!list.querySelector('.comment-item'))list.replaceChildren(el('p','暂时无法加载讨论，请稍后刷新。','comment-empty'))}
  finally{loading=false;refresh.disabled=false;list.removeAttribute('aria-busy')}
 }
 refresh.onclick=()=>void load();prev.onclick=()=>{page--;void load()};next.onclick=()=>{page++;void load()};
 form.onsubmit=async event=>{
  event.preventDefault();if(submit.disabled)return;
  const name=form.elements.name.value.trim(),content=form.elements.content.value.trim();
  if(!name||!content){notice.textContent='请填写昵称和评论。';return}
  const signature=JSON.stringify([name,content,target?.id??null]);
  if(!submission||submission.signature!==signature)submission={signature,id:crypto.randomUUID()};
  submit.disabled=true;for(const field of [form.elements.name,form.elements.content])field.readOnly=true;notice.dataset.state='';notice.textContent='正在提交…';
  try{
   const replyTarget=target,replyCard=form.parentElement;
   const result=await request('/api/comments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:submission.id,post_id:id,name,content,target_id:target?.id??null,website:form.elements.website.value})});
   const posted=result.item;
   form.elements.content.value='';updateLength();submission=null;resetTarget();notice.dataset.state='success';notice.textContent=posted?'已发表，谢谢你的分享。':'提交已接收，评论目前未公开。';
   if(replyTarget&&posted&&!list.querySelector('[data-comment-id="'+posted.id+'"]')){
    const fresh=render(posted,true);
    if(replyCard.classList.contains('comment-thread-item'))replyCard.after(fresh);
    else{let thread=replyCard.querySelector('.comment-thread');if(!thread){thread=el('div',undefined,'comment-thread');replyCard.append(thread)}thread.hidden=false;(thread.querySelector('.comment-thread-rows')||thread).append(fresh);const toggle=replyCard.querySelector(':scope > button');if(toggle)toggle.hidden=true}
   }else if(!replyTarget){page=1;submit.disabled=false;await load()}
  }catch(error){notice.dataset.state='error';notice.textContent=error.name==='TimeoutError'?'提交超时，内容已保留，可以再次点击提交。':error.message||'连接失败，内容已保留，请重试。'}
  finally{submit.disabled=false;for(const field of [form.elements.name,form.elements.content])field.readOnly=false;submit.textContent=target?'发表回复':'发表评论'}
 };
 void load();
}
