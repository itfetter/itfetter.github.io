// 统一合集管理；访客/作者字段均用textContent，写请求不自动重试。
export function mountCollections(api,onChanged){
 const $=id=>document.getElementById(id);let all=[],current=null,items=[],busy=false,sequence=0,orderDirty=false;
 const say=text=>{$('collections-notice').textContent=text};
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el};
 const button=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b};
 const metadataDirty=()=>!!current&&($('collection-title').value!==current.name||$('collection-description').value!==current.description||$('collection-cover').value!==current.cover||$('collection-sort').value!==current.sort_mode||$('collection-hidden').checked!==!!current.hidden);
 const hasChanges=()=>busy||orderDirty||metadataDirty();
 function canLeave(){if(busy){say('正在处理合集，请稍候。');return false}return !hasChanges()||window.confirm('合集有尚未保存的修改，仍要离开？')}
 function lock(value){busy=value;for(const el of $('collections-panel').querySelectorAll('button,input,textarea,select'))el.disabled=value||el.dataset.boundary==='true'}
 function list(){
  const root=$('collections-list');root.replaceChildren();
  for(const c of all){const card=node('div',undefined,'collection-admin-card'),text=node('div');text.append(node('strong',c.name),node('p',c.description||'尚未填写简介','muted'),node('small',c.total_count+' 篇文章 · '+c.article_count+' 篇公开 · '+(c.hidden?'入口隐藏':'入口公开'),'muted'));card.append(text,button('管理',()=>void open(c.slug)));root.append(card)}
  if(!all.length)root.append(node('p','还没有合集，可以先新建一个。'));
 }
 async function load(){if(busy)return;const seq=++sequence;say('正在读取合集…');try{const rows=await api('/api/collections');if(seq!==sequence)return;all=rows;list();say('')}catch(e){say(e.message)}}
 async function open(slug){
  if(busy)return;if(hasChanges()&&!window.confirm('合集有尚未保存的修改，放弃并打开另一个合集？'))return;
  const seq=++sequence;say('正在读取…');
  try{const c=await api('/api/collections?slug='+encodeURIComponent(slug));if(seq!==sequence)return;current=c;items=c.posts;orderDirty=false;
   $('collection-edit').classList.remove('hidden');$('collection-edit-title').textContent='编辑合集：'+c.name;
   $('collection-title').value=c.name;$('collection-description').value=c.description;$('collection-cover').value=c.cover;$('collection-sort').value=c.sort_mode;$('collection-hidden').checked=!!c.hidden;
   $('collection-link').href='/collections/'+c.slug+'/';$('collection-link').textContent='查看合集 ↗';$('collection-link').classList.toggle('hidden',!!c.hidden);
   const target=$('collection-move-target');target.replaceChildren(new Option('选择目标合集',''));for(const row of all)if(row.slug!==slug)target.add(new Option(row.name,row.slug));
   renderItems();renderCover();say('');
  }catch(e){say(e.message)}
 }
 function renderCover(){const img=$('collection-cover-preview'),path=$('collection-cover').value;img.classList.toggle('hidden',!path);if(path)img.src=path;else img.removeAttribute('src')}
 function renderItems(){
  const root=$('collection-members');root.replaceChildren();$('collection-select-all').checked=false;
  items.forEach((p,index)=>{const row=node('div',undefined,'collection-member');const check=node('input');check.type='checkbox';check.value=p.id;check.setAttribute('aria-label','选择文章：'+p.title);
   const title=node('div');title.append(node('strong',p.title||'无标题'),node('small',p.status==='draft'?'草稿':'已发布','muted'));
   const up=button('↑',()=>move(index,-1)),down=button('↓',()=>move(index,1));up.setAttribute('aria-label','上移：'+p.title);down.setAttribute('aria-label','下移：'+p.title);up.dataset.boundary=String(index===0);down.dataset.boundary=String(index===items.length-1);up.disabled=index===0;down.disabled=index===items.length-1;
   row.append(check,title,up,down);root.append(row);
  });
  if(!items.length)root.append(node('p','这个合集还没有文章。','muted'));
  $('collection-order-state').textContent=orderDirty?'顺序有修改，请保存排序。':'↑ ↓ 调整顺序，保存后用于系列阅读。';
 }
 function move(index,step){if(busy||index+step<0||index+step>=items.length)return;[items[index],items[index+step]]=[items[index+step],items[index]];orderDirty=true;renderItems()}
 $('collection-select-all').onchange=()=>{for(const c of $('collection-members').querySelectorAll('input[type=checkbox]'))c.checked=$('collection-select-all').checked};
 $('collections-refresh').onclick=()=>void load();
 $('collection-create-form').onsubmit=async e=>{e.preventDefault();if(busy)return;lock(true);say('正在创建…');try{const c=await api('/api/collections',{method:'POST',body:JSON.stringify({name:$('collection-create-name').value})});$('collection-create-name').value='';await onChanged();lock(false);await load();await open(c.slug)}catch(e){say(e.message)}finally{lock(false)}};
 $('collection-form').onsubmit=async e=>{
  e.preventDefault();if(busy||!current)return;lock(true);say('正在保存…');
  try{current=await api('/api/collections',{method:'PATCH',body:JSON.stringify({slug:current.slug,version:current.version,name:$('collection-title').value,description:$('collection-description').value,cover:$('collection-cover').value,sort_mode:$('collection-sort').value,hidden:$('collection-hidden').checked})});$('collection-title').value=current.name;$('collection-description').value=current.description;$('collection-edit-title').textContent='编辑合集：'+current.name;$('collection-link').classList.toggle('hidden',!!current.hidden);await onChanged();lock(false);await load();say(orderDirty?'合集资料已保存，请继续保存系列排序。':'合集已保存。')}
  catch(e){say(e.message+' 保存结果以刷新后的内容为准，未自动重试。')}finally{lock(false)}
 };
 $('collection-order-save').onclick=async()=>{
  if(busy||!current)return;if(metadataDirty()){say('请先保存合集资料，再调整和保存排序。');return}lock(true);say('正在保存排序…');
  try{await api('/api/collections/order',{method:'POST',body:JSON.stringify({slug:current.slug,version:current.version,ids:items.map(p=>p.id)})});orderDirty=false;lock(false);await open(current.slug);say('系列顺序已保存。')}
  catch(e){say(e.message)}finally{lock(false)}
 };
 $('collection-move').onclick=async()=>{
  if(busy||!current)return;if(hasChanges()){say('请先保存合集资料和系列排序，再批量移动文章。');return}const chosen=new Set([...$('collection-members').querySelectorAll('input:checked')].map(c=>c.value)),target=$('collection-move-target').value;
  const action=$('collection-member-action').value;if(!chosen.size||(action!=='remove'&&!target)){say('请勾选文章并选择目标合集。');return}
  if(!window.confirm((action==='remove'?'从当前合集移除':action==='add'?'加入目标合集：':'从当前合集移到目标合集：')+chosen.size+' 篇文章？其他合集关联保留，文章和网址不变。'))return;
  lock(true);say('正在移动…');try{await api('/api/collections/members',{method:'POST',body:JSON.stringify({slug:action==='remove'?current.slug:target,source:current.slug,action,items:items.filter(p=>chosen.has(p.id)).map(p=>({id:p.id,version:p.version}))})});await onChanged();orderDirty=false;lock(false);await load();await open(current.slug);say('合集关联已更新，文章保留。')}catch(e){say(e.message)}finally{lock(false)}
 };
 $('collection-delete').onclick=()=>{if(busy||!current)return;$('collection-delete-text').textContent='删除空合集“'+current.name+'”？有文章（包括回收站）的合集不能删除。';$('collection-delete-modal').showModal();$('collection-delete-cancel').focus()};
 $('collection-delete-cancel').onclick=()=>{if(!busy)$('collection-delete-modal').close()};
 $('collection-delete-modal').addEventListener('cancel',e=>{if(busy)e.preventDefault()});
 $('collection-delete-confirm').onclick=async()=>{if(busy||!current)return;lock(true);$('collection-delete-confirm').disabled=true;try{await api('/api/collections',{method:'DELETE',body:JSON.stringify({slug:current.slug,version:current.version,confirm:true})});current=null;items=[];orderDirty=false;$('collection-edit').classList.add('hidden');$('collection-delete-modal').close();await onChanged();lock(false);await load();say('空合集已删除。')}catch(e){$('collection-delete-modal').close();say(e.message)}finally{lock(false);$('collection-delete-confirm').disabled=false}};
 $('collection-cover-upload').onclick=()=>{if(!busy)$('collection-cover-file').click()};
 $('collection-cover-clear').onclick=()=>{if(busy)return;$('collection-cover').value='';renderCover()};
 $('collection-cover-file').onchange=async()=>{
  const file=$('collection-cover-file').files[0];$('collection-cover-file').value='';if(!file||busy)return;
  if(file.size>5242880||!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)){say('请选择5 MB内的PNG、JPG、WebP或GIF图片。');return}
  lock(true);say('正在上传封面…');try{const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const result=await api('/api/image',{method:'POST',body:JSON.stringify({type:file.type,base64:btoa(binary),alt:'合集封面'})});$('collection-cover').value=result.path;renderCover();say('封面已上传，请保存合集后生效。')}catch(e){say(e.message)}finally{lock(false)}
 };
 return {load,canLeave,hasChanges};
}

