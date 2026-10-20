import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
const source=await readFile(new URL('../assets/comments.js',import.meta.url),'utf8');
class Node {
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.className='';this.value='';this.disabled=false;this.hidden=false;this.listeners={};}
 get classList(){return {contains:s=>this.className.split(' ').includes(s)}}
 get textContent(){return this.text||this.children.map(n=>n.textContent).join('')}
 set textContent(s){this.text=s;this.children=[]}
 move(n,i){if(n.parentElement)n.parentElement.children.splice(n.parentElement.children.indexOf(n),1);n.parentElement=this;this.children.splice(i,0,n)}
 append(...nodes){for(const n of nodes)this.move(n,this.children.length)}
 prepend(n){this.move(n,0)}
 before(n){this.parentElement.move(n,this.parentElement.children.indexOf(this))}
 after(n){this.parentElement.move(n,this.parentElement.children.indexOf(this)+1)}
 replaceChildren(...nodes){for(const n of this.children)n.parentElement=null;this.children=[];this.text='';this.append(...nodes)}
 setAttribute(k,v){this.attrs[k]=v}
 removeAttribute(k){delete this.attrs[k]}
 addEventListener(k,v){this.listeners[k]=v}
 focus(){this.focused=true}
 scrollIntoView(){this.scrolled=true}
 contains(n){return this===n||this.children.some(c=>c.contains(n))}
 querySelector(s){if(this.lookup?.[s])return this.lookup[s];const match=n=>s===':scope > button'?n.tag==='button':s.startsWith('.')?n.classList.contains(s.slice(1)):s.startsWith('[data-comment-id=')?n.dataset.commentId===s.split('"')[1]:false;for(const c of this.children){if(match(c))return c;const r=c.querySelector(s);if(r)return r}return null}
}
const settle=()=>new Promise(r=>setImmediate(r));
async function setup(fetch){
 const root=new Node(),form=new Node('form'),list=new Node(),notice=new Node('p'),submit=new Node('button'),prev=new Node('button'),next=new Node('button'),refresh=new Node('button'),pager=new Node(),pagination=new Node(),count=new Node(),length=new Node();
 root.dataset.articleId='fixture';form.elements={name:new Node('input'),content:new Node('textarea'),website:new Node('input')};form.append(...Object.values(form.elements),submit,notice);form.lookup={'[type=submit]':submit};pagination.append(prev,pager,next);root.append(form,list,pagination,refresh,count,length);
 root.lookup={'form':form,'[data-comments-list]':list,'[data-comment-notice]':notice,'[data-comments-prev]':prev,'[data-comments-next]':next,'[data-comments-page]':pager,'[data-comments-refresh]':refresh,'[data-comments-count]':count,'[data-comment-length]':length};
 vm.runInNewContext(source,{document:{getElementById:()=>root,createElement:t=>new Node(t)},fetch,AbortSignal,crypto:{randomUUID},Date,JSON,encodeURIComponent});await settle();
 return {root,form,list,notice,submit,refresh,pagination,count,length,prev,next};
}
const item={id:'root',name:'访客',content:'<script>安全的纯文本</script>',created_at:'2026-10-14T07:15:00Z',reply_count:0};
const response=data=>({ok:true,json:async()=>data});
test('评论为纯文本，单页隐藏分页，取消回复保留输入并回到表单位置',async()=>{
 const s=await setup(async()=>response({items:[item],total:1,pageSize:20}));
 assert.equal(s.pagination.hidden,true);assert.equal(s.count.textContent,'1');
 const card=s.list.children[0];assert.equal(card.children[2].textContent,item.content);
 s.form.elements.content.value='尚未发表';s.form.elements.content.listeners.input();assert.equal(s.length.textContent,'4 / 3000');
 card.querySelector('.comment-actions').children[0].onclick();assert.equal(s.form.parentElement,card);assert.equal(s.submit.textContent,'发表回复');
 s.form.children[0].children[1].onclick();assert.equal(s.form.parentElement,s.root);assert.equal(s.form.elements.content.value,'尚未发表');
});
test('刷新失败保留已加载评论和当前输入',async()=>{
 let fail=false;const s=await setup(async()=>{if(fail)throw Error('offline');return response({items:[item],total:1,pageSize:20})});
 s.form.elements.content.value='保留内容';const card=s.list.children[0];fail=true;s.refresh.onclick();await settle();
 assert.equal(s.list.children[0],card);assert.equal(s.form.elements.content.value,'保留内容');assert.match(s.notice.textContent,/已保留/);assert.equal(s.refresh.disabled,false);
});
test('提交期间锁定输入，失败不自动重试，人工同内容重试使用同一UUID',async()=>{
 const calls=[];let reject;const s=await setup(async(url,opts)=>{if(!opts)return response({items:[],total:0,pageSize:20});calls.push(JSON.parse(opts.body));return new Promise((resolve,r)=>{reject=r})});
 s.form.elements.name.value='测试';s.form.elements.content.value='内容';
 let p=s.form.onsubmit({preventDefault(){}});assert.equal(s.form.elements.content.readOnly,true);assert.equal(s.submit.disabled,true);reject(Error('offline'));await p;
 assert.equal(s.form.elements.content.value,'内容');assert.equal(s.form.elements.content.readOnly,false);assert.equal(calls.length,1);
 p=s.form.onsubmit({preventDefault(){}});assert.equal(calls[0].id,calls[1].id);reject(Error('offline'));await p;assert.equal(calls.length,2);
});

test('回复加载失败在原讨论提示，重试后分页追加并可收起',async()=>{
 let fail=true,call=0;const s=await setup(async url=>{if(!url.includes('root_id='))return response({items:[{...item,reply_count:11}],total:1,pageSize:20});if(fail)throw Error('offline');call++;return response({items:[{...item,id:'reply-'+call,name:'回复者',target_name:'访客'}],total:11,pageSize:10})});
 const card=s.list.children[0],toggle=card.querySelector('.comment-thread-toggle'),thread=card.querySelector('.comment-thread');
 toggle.onclick();await settle();assert.equal(thread.hidden,true);assert.match(card.querySelector('.comment-thread-notice').textContent,/无法加载/);assert.equal(toggle.disabled,false);
 fail=false;toggle.onclick();await settle();assert.equal(thread.hidden,false);assert.equal(toggle.attrs['aria-expanded'],'true');assert.equal(thread.querySelector('.comment-thread-rows').children.length,1);
 const more=thread.querySelector('.comment-thread-more');assert.equal(more.hidden,false);more.onclick();await settle();assert.equal(thread.querySelector('.comment-thread-rows').children.length,2);assert.equal(more.hidden,true);
 thread.querySelector('.comment-thread-close').onclick();assert.equal(thread.hidden,true);assert.equal(toggle.attrs['aria-expanded'],'false');
});
test('主评论换页后聚焦讨论列表并保留未发表输入',async()=>{
 const pages=[];const s=await setup(async url=>{pages.push(url);return response({items:[item],total:26,pageSize:20})});s.form.elements.content.value='未发表的想法';assert.equal(s.pagination.hidden,false);
 s.next.onclick();await settle();assert.match(pages[1],/page=2/);assert.equal(s.list.focused,true);assert.equal(s.list.scrolled,true);assert.equal(s.form.elements.content.value,'未发表的想法');assert.equal(s.next.disabled,true);
});
