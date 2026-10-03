// 后台列表计算；不保存凭据或文章内容。
export function selectPosts(posts,{query='',category='',order='published',page=1,pageSize=10}={}) {
 const term=query.trim().toLocaleLowerCase();
 const filtered=posts.filter(p=>(!category||p.category===category)&&(!term||[p.title,p.summary,p.id,p.category].some(v=>String(v||'').toLocaleLowerCase().includes(term))));
 filtered.sort((a,b)=>order==='title'?a.title.localeCompare(b.title,'zh-CN')||a.id.localeCompare(b.id):
 String(order==='updated'?b.updated_at:b.published_at).localeCompare(String(order==='updated'?a.updated_at:a.published_at))||a.id.localeCompare(b.id));
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),current=Math.min(pages,Math.max(1,page));
 return {total:filtered.length,pages,page:current,items:filtered.slice((current-1)*pageSize,current*pageSize)};
}
export function postStats(posts,now=new Date().toISOString()) {
 return {total:posts.length,visible:posts.filter(p=>p.published_at<=now).length,
 categories:new Set(posts.map(p=>p.category)).size};
}
