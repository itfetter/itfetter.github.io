// 仅处理列表视图；不改变文章关联或服务端版本。
export const postState=(p,now=Date.now())=>p.status==='draft'?'draft':Date.parse(p.published_at)>now?'scheduled':'published';
export const stateLabel={draft:'草稿',scheduled:'定时发布',published:'已发布'};
export function pageRows(rows,{query='',status='all',page=1,size=20}={}){
 const q=query.trim().toLocaleLowerCase();
 const filtered=rows.filter(p=>(status==='all'||postState(p)===status)&&(!q||[p.title,p.summary,p.name,p.description].some(v=>String(v??'').toLocaleLowerCase().includes(q))));
 const pages=Math.max(1,Math.ceil(filtered.length/size)),safe=Math.max(1,Math.min(pages,Number.isSafeInteger(page)?page:1));
 return {rows:filtered.slice((safe-1)*size,safe*size),total:filtered.length,page:safe,pages};
}
export function reorderRows(rows,source,target){
 const next=[...rows],from=next.findIndex(p=>p.id===source),to=next.findIndex(p=>p.id===target);
 if(from<0||to<0||from===to)return next;
 const [row]=next.splice(from,1);next.splice(to,0,row);return next;
}
export const availablePosts=(rows,members)=>{const ids=new Set(members.map(p=>p.id));return rows.filter(p=>!p.deleted_at&&!ids.has(p.id))};

