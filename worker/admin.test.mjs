import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPosts,postStats} from '../assets/admin-utils.mjs';
const posts=Array.from({length:23},(_,i)=>({id:'post-'+i,title:'文章 '+i,summary:i===11?'特别摘要':'普通摘要',category:i%2?'随笔':'建站',published_at:new Date(Date.UTC(2026,0,i+1)).toISOString(),updated_at:new Date(Date.UTC(2026,1,23-i)).toISOString()}));
test('文章库跨页无丢失、搜索包含摘要，筛选后页码回到有效范围',()=>{
 const ids=[];for(let page=1;page<=3;page++)ids.push(...selectPosts(posts,{page}).items.map(p=>p.id));
 assert.equal(ids.length,23);assert.equal(new Set(ids).size,23);
 assert.deepEqual(selectPosts(posts,{query:'特别摘要',page:3}).items.map(p=>p.id),['post-11']);
 const filtered=selectPosts(posts,{category:'随笔',page:99});assert.equal(filtered.page,2);assert.equal(filtered.total,11);
 assert.equal(selectPosts(posts,{query:'不存在'}).total,0);
 assert.equal(selectPosts(posts,{order:'updated'}).items[0].id,'post-0');
 assert.equal(posts[0].id,'post-0');
});
test('统计区分未来发布日期，分类去重并处理空文章库',()=>{
 assert.deepEqual(postStats(posts,'2026-01-10T00:00:00.000Z'),{total:23,visible:10,drafts:0,categories:2});
 assert.deepEqual(postStats([]),{total:0,visible:0,drafts:0,categories:0});
});
test('普通列表和工作台排除回收站，回收站可独立搜索及分页',()=>{
 const rows=[...posts.map(p=>({...p,status:'published'})),{...posts[0],id:'trash-one',title:'回收记录',category:'归档',status:'draft',has_draft:1,deleted_at:'2026-01-01T00:00:00Z'}];
 assert.equal(selectPosts(rows).total,23);
 assert.equal(selectPosts(rows,{status:'draft'}).total,0);
 assert.equal(selectPosts(rows,{status:'trash',query:'回收',page:99}).page,1);
 assert.deepEqual(selectPosts(rows,{status:'trash'}).items.map(p=>p.id),['trash-one']);
 assert.deepEqual(postStats(rows,'2027-01-01'),{total:23,visible:23,drafts:0,categories:2});
});

test('草稿状态筛选与公开统计不把未发布文章计入前台',()=>{
 const rows=[{...posts[0],status:'draft',has_draft:1},{...posts[1],status:'published',has_draft:1},{...posts[2],status:'published',has_draft:0}];
 assert.equal(selectPosts(rows,{status:'draft'}).total,1);assert.equal(selectPosts(rows,{status:'pending'}).total,1);
 assert.equal(selectPosts(rows,{status:'published'}).total,2);
 assert.equal(postStats(rows,'2027-01-01').visible,2);assert.equal(postStats(rows).drafts,2);
});

import {readAdminRoute,adminRouteURL} from '../assets/admin-route.mjs';
test('后台刷新恢复栏目及已保存文章，非法路由安全回退',()=>{
 for(const view of ['overview','articles','editor','messages','comments','account','collections']){
  const url=adminRouteURL('https://itfetter.com/admin/?password=changed',view,null);
  assert.deepEqual(readAdminRoute('https://itfetter.com'+url),{view,id:null});
  assert.equal(url.includes('password'),false);
 }
 assert.deepEqual(readAdminRoute('https://itfetter.com/admin/?view=editor&id=hello'),{view:'editor',id:'hello'});
 assert.deepEqual(readAdminRoute('https://itfetter.com/admin/?view=editor&id=../secret'),{view:'articles',id:null});
 assert.deepEqual(readAdminRoute('https://itfetter.com/admin/?view=unknown&id=hello'),{view:'overview',id:null});
 assert.deepEqual(readAdminRoute('https://itfetter.com/admin/?view=messages&id=hello'),{view:'messages',id:null});
 assert.equal(adminRouteURL('https://itfetter.com/admin/?view=editor&id=hello','messages',null),'/admin/?view=messages');
 assert.equal(adminRouteURL('https://itfetter.com/admin/','editor','hello'),'/admin/?view=editor&id=hello');
});


import {pageRows,reorderRows,availablePosts,postState} from '../assets/collection-ui.mjs';
test('合集文章选择排除已加入与回收站；筛选分页不丢失其他排序成员',()=>{
 const rows=Array.from({length:45},(_,i)=>({id:'p-'+i,title:'文章'+i,summary:i===42?'特殊关键词':'',status:i===2?'draft':'published',published_at:i===3?'2099-01-01':'2020-01-01'}));
 const before=structuredClone(rows),members=rows.slice(0,2);
 assert.equal(availablePosts([...rows,{id:'trash',deleted_at:'2026-01-01'}],members).length,43);
 assert.equal(pageRows(rows,{query:'特殊关键词',page:3}).rows[0].id,'p-42');
 assert.equal(pageRows(rows,{status:'draft'}).total,1);
 assert.equal(postState(rows[3]),'scheduled');
 assert.equal(pageRows(rows,{page:99}).page,3);
 assert.equal(pageRows([]).pages,1);
 const moved=reorderRows(rows,'p-44','p-0');
 assert.equal(moved[0].id,'p-44');assert.equal(moved.length,45);assert.equal(new Set(moved.map(p=>p.id)).size,45);
 assert.deepEqual(rows,before);assert.deepEqual(reorderRows(rows,'missing','p-0'),rows);
 assert.equal(adminRouteURL('https://itfetter.com/admin/?view=collections&collection=sample','articles',null).includes('collection='),false);
 assert.equal(adminRouteURL('https://itfetter.com/admin/?view=collections&collection=sample','collections',null).includes('collection=sample'),true);
});

import {publishChecklist} from '../assets/admin-utils.mjs';
import {mountCommentManagement} from '../assets/admin-comments.mjs';
test('发布检查按页面顺序指出缺项，草稿字段保持原样',()=>{
 const draft={title:'  ',collections:[],summary:' ',body:'\n'};
 const before=structuredClone(draft);
 assert.deepEqual(publishChecklist(draft).map(x=>x.id),['title','collections','summary','body']);
 assert.deepEqual(draft,before);
 assert.deepEqual(publishChecklist({title:'标题',collections:['one'],summary:'摘要',body:'正文'}),[]);
 assert.deepEqual(publishChecklist({title:'标题',collections:['one'],summary:'',body:'正文'}).map(x=>x.id),['summary']);
});
function commentFixture(){
 const elements=new Map();
 const node=()=>({value:'',disabled:false,hidden:false,textContent:'',dataset:{},children:[],parentElement:{hidden:false},classList:{toggle(){}},replaceChildren(...children){this.children=children},append(child){this.children.push(child)},add(){},addEventListener(){}});
 const selection=node(),root={querySelector:()=>selection,querySelectorAll:()=>[...elements.values()]};
 const document={querySelector:()=>root,getElementById:id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id)},createElement:()=>node()};
 const previous={document:globalThis.document,Option:globalThis.Option};
 globalThis.document=document;globalThis.Option=function(text,value){this.text=text;this.value=value};
 document.getElementById('comment-filter').value='all';
 return {get:id=>document.getElementById('comment-'+id),selection,restore(){Object.assign(globalThis,previous)}};
}
test('评论读取期间的新搜索排队更新，空列表隐藏批量和单页导航',async()=>{
 const fixture=commentFixture(),requests=[],respond=[];
 try{
  const management=mountCommentManagement(url=>{requests.push(url);return new Promise(resolve=>respond.push(resolve))});
  const reading=management.load();
  assert.equal(fixture.get('search').disabled,false);
  fixture.get('search').value='新关键词';fixture.get('search-form').onsubmit({preventDefault(){}});
  respond.shift()({items:[],total:0,pageSize:20,pending:0});await reading;
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,2);assert.match(requests[1],/q=/);assert.equal(new URL(requests[1],'https://example.com').searchParams.get('q'),'新关键词');
  respond.shift()({items:[],total:0,pageSize:20,pending:0});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fixture.selection.hidden,true);assert.equal(fixture.get('page').parentElement.hidden,true);
  assert.equal(fixture.get('clear').disabled,false);assert.match(fixture.get('list').children[0].textContent,/清除筛选/);
 }finally{fixture.restore()}
});
test('评论总页数收缩并重新读取时不提前消费最新搜索',async()=>{
 const fixture=commentFixture(),requests=[],respond=[],tick=()=>new Promise(resolve=>setImmediate(resolve));
 try{
  const management=mountCommentManagement(url=>{requests.push(url);return new Promise(resolve=>respond.push(resolve))});
  const initial=management.load();respond.shift()({items:[],total:41,pageSize:20,pending:0});await initial;
  fixture.get('next').onclick();fixture.get('search').value='最后查询';fixture.get('search-form').onsubmit({preventDefault(){}});
  respond.shift()({items:[],total:0,pageSize:20,pending:0});await tick();
  assert.equal(requests.length,3);assert.equal(new URL(requests[2],'https://example.com').searchParams.get('page'),'1');
  respond.shift()({items:[],total:0,pageSize:20,pending:0});await tick();
  assert.equal(requests.length,4);assert.equal(new URL(requests[3],'https://example.com').searchParams.get('q'),'最后查询');
  respond.shift()({items:[],total:0,pageSize:20,pending:0});await tick();
 }finally{fixture.restore()}
});

import {editorSaveState} from '../assets/editor-save-state.mjs';
test('保存提示覆盖修改、失败重试和草稿发布转换',()=>{
 assert.equal(editorSaveState(), '尚未保存');
 const current={status:'published',has_draft:false};
 assert.equal(editorSaveState({current}), '已保存并发布');
 assert.equal(editorSaveState({current,dirty:true}), '有未保存的修改');
 assert.equal(editorSaveState({current,dirty:true,failed:true}), '保存失败 · 请重试');
 assert.equal(editorSaveState({current,dirty:true,failed:true,saving:true}), '正在保存草稿…');
 assert.equal(editorSaveState({current:{...current,has_draft:true}}), '草稿已保存');
 assert.equal(editorSaveState({current:{status:'draft'}}), '草稿已保存');
 assert.equal(editorSaveState({saving:true,kind:'published'}), '正在发布…');
});

import {createDraftAutosave} from '../assets/draft-autosave.mjs';
test('自动保存默认关闭、首次手动保存前不写入、空闲合并且不并发',async()=>{
 let eligible=false,calls=0,pending,clock=0,delay;const queue=new Map();let id=0;
 const auto=createDraftAutosave({ready:()=>eligible,save:async()=>{calls++;await new Promise(r=>pending=r);eligible=false},now:()=>clock,setTimer:(fn,ms)=>{delay=ms;queue.set(++id,fn);return id},clearTimer:id=>queue.delete(id)});
 auto.changed();assert.equal(queue.size,0);auto.setEnabled(true);auto.changed();assert.equal(queue.size,0);
 eligible=true;auto.changed();clock=1000;auto.changed();assert.equal(queue.size,1);assert.equal(delay,3000);
 const run=[...queue.values()][0];queue.clear();const saving=run();assert.equal(calls,1);auto.changed();assert.equal(calls,1);pending();await saving;
 auto.setEnabled(false);assert.equal(queue.size,0);
});
test('自动保存写入失败暂停，输入不触发重试，用户重新开启才恢复',async()=>{
 let task,calls=0,paused=0;const auto=createDraftAutosave({ready:()=>true,save:async()=>{calls++;throw Object.assign(Error('conflict'),{status:409})},onPause:()=>paused++,setTimer:fn=>(task=fn,1),clearTimer:()=>task=null});
 auto.setEnabled(true);const run=task;task=null;await run();assert.equal(auto.paused,true);assert.equal(paused,1);auto.changed();assert.equal(calls,1);assert.equal(task,null);
 auto.setEnabled(true);assert.equal(auto.paused,false);assert.equal(typeof task,'function');auto.setEnabled(false);
});
test('连续输入最多等待30秒，关闭选项取消计划',()=>{
 let clock=0,delay;const auto=createDraftAutosave({ready:()=>true,save:async()=>{},now:()=>clock,setTimer:(_fn,ms)=>(delay=ms,1),clearTimer:()=>{}});
 auto.setEnabled(true);clock=29000;auto.changed();assert.equal(delay,1000);clock=31000;auto.changed();assert.equal(delay,0);auto.setEnabled(false);
});
