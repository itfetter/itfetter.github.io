const root=document.getElementById('article-comments');
if(root){
 const id=root.dataset.articleId,list=root.querySelector('[data-comments-list]'),notice=root.querySelector('[data-comment-notice]'),form=root.querySelector('form'),submit=form.querySelector('button'),prev=root.querySelector('[data-comments-prev]'),next=root.querySelector('[data-comments-next]'),pager=root.querySelector('[data-comments-page]'),refresh=root.querySelector('[data-comments-refresh]');
 let page=1,loading=false,submission=null;
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node};
 const date=value=>new Date(value).toLocaleString('zh-CN');
 async function request(url,options={}){
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'操作失败，请重试。');return data;
 }
 async function load(){
  if(loading)return;loading=true;prev.disabled=next.disabled=refresh.disabled=true;list.setAttribute('aria-busy','true');
  try{
   const data=await request('/api/comments?post_id='+encodeURIComponent(id)+'&page='+page);
   const pages=Math.max(1,Math.ceil(data.total/data.pageSize));
   if(page>pages){page=pages;loading=false;return load()}
   list.replaceChildren();
   for(const item of data.items){
    const card=el('div',undefined,'comment-item'),head=el('div',undefined,'comment-meta');
    head.append(el('strong',item.name),el('time',date(item.created_at)));card.append(head,el('p',item.content,'comment-text'));
    if(item.reply){const reply=el('div',undefined,'comment-reply');reply.append(el('strong','作者回复'),el('p',item.reply,'comment-text'));card.append(reply)}
    list.append(card);
   }
   if(!data.items.length)list.append(el('p','还没有公开评论，欢迎留下你的想法。','comment-muted'));
   pager.textContent=page+' / '+pages+' · '+data.total+' 条公开评论';prev.disabled=page<=1;next.disabled=page>=pages;
  }catch(error){list.replaceChildren(el('p','评论加载失败，请点击“刷新评论”重试。','comment-muted'));pager.textContent='加载失败'}
  finally{loading=false;refresh.disabled=false;list.removeAttribute('aria-busy')}
 }
 refresh.onclick=()=>void load();prev.onclick=()=>{page--;void load()};next.onclick=()=>{page++;void load()};
 form.onsubmit=async event=>{
  event.preventDefault();if(submit.disabled)return;
  const name=form.elements.name.value.trim(),content=form.elements.content.value.trim();
  if(!name||!content){notice.textContent='请填写昵称和评论。';return}
  const signature=JSON.stringify([name,content]);
  if(!submission||submission.signature!==signature)submission={signature,id:crypto.randomUUID()};
  submit.disabled=true;notice.textContent='正在提交…';
  try{
   await request('/api/comments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:submission.id,post_id:id,name,content,website:form.elements.website.value})});
   form.elements.content.value='';submission=null;notice.textContent='评论已提交，审核通过后公开显示。';
  }catch(error){notice.textContent=error.name==='TimeoutError'?'提交超时，内容已保留，可以再次点击提交。':error.message||'连接失败，内容已保留，请重试。'}
  finally{submit.disabled=false}
 };
 void load();
}
