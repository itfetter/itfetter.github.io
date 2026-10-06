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
 for(const view of ['overview','articles','editor','messages','comments','account']){
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

