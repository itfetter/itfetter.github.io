// 后台列表计算；不保存凭据或文章内容。
export function selectPosts(posts,{query='',category='',status='',order='published',page=1,pageSize=10}={}) {
 const term=query.trim().toLocaleLowerCase();
 const filtered=posts.filter(p=>(status==='trash'?!!p.deleted_at:!p.deleted_at)&&(!category||(p.collections?.some(c=>c.name===category)||(!p.collections&&p.category===category)))&&(!status||status==='trash'||(status==='pending'?p.status==='published'&&!!p.has_draft:p.status===status))&&(!term||[p.title,p.summary,p.id,p.collections?.map(c=>c.name).join(" ")||p.category].some(v=>String(v||'').toLocaleLowerCase().includes(term))));
 filtered.sort((a,b)=>order==='reads'?(Number(b.read_count||0)-Number(a.read_count||0)||a.id.localeCompare(b.id)):order==='title'?a.title.localeCompare(b.title,'zh-CN')||a.id.localeCompare(b.id):
 String(order==='updated'?b.updated_at:b.published_at).localeCompare(String(order==='updated'?a.updated_at:a.published_at))||a.id.localeCompare(b.id));
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),current=Math.min(pages,Math.max(1,page));
 return {total:filtered.length,pages,page:current,items:filtered.slice((current-1)*pageSize,current*pageSize)};
}
export function postStats(posts,now=new Date().toISOString()) {
 posts=posts.filter(p=>!p.deleted_at);
 return {total:posts.length,visible:posts.filter(p=>(p.status||'published')==='published'&&p.published_at<=now).length,
 drafts:posts.filter(p=>p.status==='draft'||p.has_draft).length,
 categories:new Set(posts.flatMap(p=>p.collections?.map(c=>c.name)||[p.category]).filter(Boolean)).size};
}

