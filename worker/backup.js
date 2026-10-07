// 登录后可下载的内容备份；不含密码、会话、令牌或限速数据。
const error=message=>{throw Object.assign(new Error(message),{status:400})};
const fields=['id','title','category','summary','body','published_at','permalink','version','updated_at','status','draft_title','draft_category','draft_summary','draft_body','read_count','public_updated_at','deleted_at','collection_order'];
const imageKey=/^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/;
const iso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export async function exportBackup(env){
 // 聚合检查在取正文前执行，避免大数据库将整库内容载入 Worker 内存。
 const size=await env.DB.prepare(`SELECT
 (SELECT COUNT(*) FROM posts) AS posts,
 (SELECT COUNT(*) FROM post_versions) AS history,
 (SELECT COUNT(*) FROM contact_messages) AS messages,
 (SELECT COUNT(*) FROM categories) AS categories,
 (SELECT COUNT(*) FROM article_comments) AS comments,
 (SELECT COALESCE(SUM(length(body)+COALESCE(length(draft_body),0)),0) FROM posts)+
 (SELECT COALESCE(SUM(length(body)),0) FROM post_versions)+
 (SELECT COALESCE(SUM(length(message)),0) FROM contact_messages)+
 (SELECT COALESCE(SUM(length(content)+length(reply)),0) FROM article_comments) AS chars`).first();
 if(size.posts>1000||size.history>5000||size.messages>1000||size.categories>1000||size.comments>1000||size.chars>4000000)error('内容超过便捷备份上限，请使用 Cloudflare D1 导出。');
 const posts=(await env.DB.prepare('SELECT '+fields.join(',')+' FROM posts').all()).results;
 const categories=(await env.DB.prepare('SELECT name,slug,description,cover,sort_mode,hidden,version FROM categories').all()).results;
 const history=(await env.DB.prepare('SELECT * FROM post_versions').all()).results;
 const messages=(await env.DB.prepare('SELECT id,name,email,message,status,created_at,deleted_at,version FROM contact_messages').all()).results;
 const comments=(await env.DB.prepare('SELECT * FROM article_comments').all()).results;
 const memberships=(await env.DB.prepare('SELECT post_id,collection_slug,state,position FROM post_collections').all()).results;
 const data={memberships,format:'itfetter-content-v1',created_at:new Date().toISOString(),posts,categories,history,messages,comments,images:[]};
 if(posts.length>1000||history.length>5000||messages.length>1000||categories.length>1000||comments.length>1000||JSON.stringify(data).length>4000000)error('内容超过便捷备份上限，请使用 Cloudflare D1 导出。');
 let cursor,total=0;
 do{
  const page=await env.IMAGES.list({limit:100,...(cursor?{cursor}:{})});
  for(const item of page.objects){
   if(!imageKey.test(item.key))error('桶内有不支持的文件，请使用 R2 完整导出。');
   total+=item.size;if(total>12000000||data.images.length>=100)error('图片超过便捷备份上限（12 MB / 100 张），请使用 R2 完整导出。');
   const object=await env.IMAGES.get(item.key);if(!object)error('图片发生变化，请重新备份。');
   const bytes=new Uint8Array(await object.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   data.images.push({key:item.key,type:object.httpMetadata.contentType,base64:btoa(binary)});
  }
  cursor=page.truncated?page.cursor:undefined;
 }while(cursor);
 return data;
}
export async function restoreBackup(env,data){
 if(data?.format!=='itfetter-content-v1'||data.confirm!==true)error('请确认恢复有效的博客内容备份。');
 for(const name of ['posts','categories','history','messages','images'])if(!Array.isArray(data[name]))error('备份结构无效。');
 const memberships=data.memberships??null;
 if(memberships!==null&&(!Array.isArray(memberships)||memberships.length>40000))error('合集关联备份无效。');
 const comments=data.comments??[];if(!Array.isArray(comments)||comments.length>1000)error('评论备份无效或超过上限。');
 if(data.posts.length>1000||data.history.length>5000||data.messages.length>1000||data.categories.length>1000||data.images.length>100)error('备份条目超过便捷恢复上限。');
 if(JSON.stringify({...data,images:[]}).length>4000000)error('内容超过便捷恢复上限。');
 const ids=new Set();
 for(const p of data.posts){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id)||p.id.length>70||ids.has(p.id)||p.permalink!=='/articles/'+p.id+'/'||!['draft','published'].includes(p.status)||!iso(p.published_at)||!iso(p.updated_at)||!Number.isSafeInteger(p.version)||p.version<1||!Number.isSafeInteger(p.read_count)||p.read_count<0)error('文章备份无效。');
  ids.add(p.id);
  for(const [f,max] of [['title',160],['category',80],['summary',300],['body',300000]])if(typeof p[f]!=='string'||p[f].length>max||(p['draft_'+f]!==null&&(typeof p['draft_'+f]!=='string'||p['draft_'+f].length>max)))error('文章字段无效。');
  if(p.deleted_at!=null&&!iso(p.deleted_at))error('文章回收站日期无效。');
  if(p.public_updated_at!==null&&!iso(p.public_updated_at))error('公开日期无效。');
 }
 for(const c of data.categories)if(typeof c.name!=='string'||!c.name.trim()||c.name.length>80||/[\u0000-\u001f\u007f]/.test(c.name))error('分类无效。');
 for(const c of data.categories){
  if(c.slug!==undefined&&(typeof c.slug!=='string'||!/^[a-z0-9-]{1,70}$/.test(c.slug)))error('合集网址无效。');
  if(c.description!==undefined&&(typeof c.description!=='string'||c.description.length>500))error('合集简介无效。');
  if(c.cover!==undefined&&(typeof c.cover!=='string'||(c.cover!==''&&!/^\/images\/[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(c.cover))))error('合集封面无效。');
  if(c.sort_mode!==undefined&&!['newest','oldest','manual'].includes(c.sort_mode))error('合集排序无效。');
  if(c.hidden!==undefined&&![0,1].includes(c.hidden))error('合集状态无效。');
  if(c.version!==undefined&&(!Number.isSafeInteger(c.version)||c.version<1))error('合集版本无效。');
 }
 for(const p of data.posts)if(p.collection_order!==undefined&&(!Number.isSafeInteger(p.collection_order)||p.collection_order<0))error('文章合集顺序无效。');
 const slugs=new Set(data.categories.map(c=>c.slug)),keys=new Set();
 if(memberships)for(const m of memberships){const key=JSON.stringify([m.post_id,m.collection_slug,m.state]);if(!ids.has(m.post_id)||!slugs.has(m.collection_slug)||!['published','draft'].includes(m.state)||!Number.isSafeInteger(m.position)||m.position<0||keys.has(key))error('合集关联备份无效。');keys.add(key)}
 for(const h of data.history)if(h.collections_json!=null){let ids;try{ids=JSON.parse(h.collections_json)}catch{error('历史合集无效。')}if(!Array.isArray(ids)||ids.some(s=>typeof s!=='string'||!/^[a-z0-9-]{1,70}$/.test(s)))error('历史合集无效。')}
 for(const h of data.history){if(!ids.has(h.post_id)||!Number.isSafeInteger(h.version)||h.version<1||!iso(h.saved_at))error('历史版本无效。');for(const [f,max] of [['title',160],['category',80],['summary',300],['body',300000]])if(typeof h[f]!=='string'||h[f].length>max)error('历史字段无效。')}
 for(const m of data.messages)if(typeof m.id!=='string'||m.id.length>80||typeof m.name!=='string'||m.name.length>80||typeof m.message!=='string'||m.message.length>3000||typeof m.email!=='string'||m.email.length>254||!['unread','read'].includes(m.status)||!iso(m.created_at)||(m.deleted_at!=null&&!iso(m.deleted_at))||(m.version!==undefined&&(!Number.isSafeInteger(m.version)||m.version<1)))error('留言无效。');
 const commentIds=new Set();
 for(const c of comments){
  if(typeof c.id!=='string'||!(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/).test(c.id)||commentIds.has(c.id)||!ids.has(c.post_id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>80||/[\u0000-\u001f\u007f]/.test(c.name)||typeof c.content!=='string'||!c.content.trim()||c.content.length>3000||typeof c.reply!=='string'||c.reply.length>3000||!['pending','approved','hidden'].includes(c.status)||!iso(c.created_at)||(c.replied_at!==null&&!iso(c.replied_at))||(c.deleted_at!==null&&!iso(c.deleted_at))||!Number.isSafeInteger(c.version)||c.version<1)error('评论备份字段无效。');
  commentIds.add(c.id);
 }
 const byId=new Map(comments.map(c=>[c.id,c])),ordered=[],visited=new Set(),visiting=new Set();
 function visit(c){
  if(visited.has(c.id))return;
  if(visiting.has(c.id))error('评论回复存在循环。');
  visiting.add(c.id);
  for(const field of ['root_id','target_id']){
   const ref=c[field]??null;if(ref===null)continue;
   const parent=byId.get(ref);
   if(!parent||parent.id===c.id||parent.post_id!==c.post_id||(field==='root_id'&&parent.root_id!=null)||(field==='target_id'&&(parent.root_id??parent.id)!==c.root_id))error('评论回复关系无效。');
   visit(parent);
  }
  if(c.root_id==null&&c.target_id!=null)error('评论回复关系无效。');
  visiting.delete(c.id);visited.add(c.id);ordered.push(c);
 }
 for(const c of comments)visit(c);
 for(const c of comments){
  const existing=await env.DB.prepare('SELECT post_id,root_id,target_id FROM article_comments WHERE id=?').bind(c.id).first();
  if(existing&&(existing.post_id!==c.post_id||existing.root_id!==(c.root_id??null)||existing.target_id!==(c.target_id??null)))error('现有评论回复关系与备份冲突。');
 }
 let total=0;const images=[];
 for(const i of data.images){
  if(!imageKey.test(i.key)||!['image/png','image/jpeg','image/webp','image/gif'].includes(i.type)||typeof i.base64!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(i.base64))error('图片备份无效。');
  let bytes;try{bytes=Uint8Array.from(atob(i.base64),c=>c.charCodeAt(0))}catch{error('图片编码无效。')}
  total+=bytes.length;if(bytes.length>5242880||total>12000000)error('图片超过便捷恢复上限。');
  const type={'png':'image/png','jpg':'image/jpeg','webp':'image/webp','gif':'image/gif'}[i.key.split('.').pop()];
  if(type!==i.type)error('图片类型不匹配。');
  const start=(...x)=>x.every((v,n)=>bytes[n]===v);
  if(!(i.type==='image/png'?start(137,80,78,71,13,10,26,10):i.type==='image/jpeg'?start(255,216,255):i.type==='image/gif'?['GIF87a','GIF89a'].includes(new TextDecoder().decode(bytes.slice(0,6))):new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'))error('图片内容无效。');
  images.push({...i,bytes});
 }
 // 先补图片，SQL 失败时不删除已有图片；重试安全，跨服务不承诺原子事务。
 let imageCount=0;
 for(const i of images){const result=await env.IMAGES.put(i.key,i.bytes,{httpMetadata:{contentType:i.type},onlyIf:{etagDoesNotMatch:'*'}});if(result)imageCount++}
 const restoreToken=crypto.randomUUID(),missing=new Set();for(const p of data.posts)if(!await env.DB.prepare('SELECT id FROM posts WHERE id=?').bind(p.id).first())missing.add(p.id);
 const statements=[
 ...data.posts.map(p=>env.DB.prepare('INSERT INTO posts ('+fields.join(',')+',collection_token) VALUES ('+fields.map(()=>'?').join(',')+',?) ON CONFLICT DO NOTHING').bind(...fields.map(f=>f==='deleted_at'?p[f]??null:f==='collection_order'?p[f]??0:p[f]),restoreToken)),
 ...data.categories.map(c=>env.DB.prepare('INSERT INTO categories(name,slug,description,cover,sort_mode,hidden,version) VALUES(?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(c.name,c.slug??('collection-'+crypto.randomUUID()),c.description??'',c.cover??'',c.sort_mode??'newest',c.hidden??0,c.version??1)),
 ...data.history.map(h=>env.DB.prepare('INSERT INTO post_versions(post_id,version,title,category,summary,body,saved_at,collections_json) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(h.post_id,h.version,h.title,h.category,h.summary,h.body,h.saved_at,h.collections_json??null)),
 ...data.messages.map(m=>env.DB.prepare('INSERT INTO contact_messages(id,name,email,message,status,created_at,deleted_at,version) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(m.id,m.name,m.email,m.message,m.status,m.created_at,m.deleted_at??null,m.version??1)),
 ...ordered.map(c=>env.DB.prepare('INSERT INTO article_comments(id,post_id,name,content,status,reply,created_at,replied_at,deleted_at,version,root_id,target_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(c.id,c.post_id,c.name,c.content,c.status,c.reply,c.created_at,c.replied_at,c.deleted_at,c.version,c.root_id??null,c.target_id??null))
 ];
 // 分批仅追加；现有记录永不覆盖。中途失败可重新提交同一备份。
 let changed=0;for(let i=0;i<statements.length;i+=50){const result=await env.DB.batch(statements.slice(i,i+50));changed+=result.reduce((sum,r)=>sum+(r.meta.changes||0),0)}
  const relations=memberships??data.posts.flatMap(p=>['published','draft'].flatMap(state=>{if(state==='published'&&p.status!=='published'||state==='draft'&&p.draft_body===null&&p.status!=='draft')return [];const c=data.categories.find(c=>c.name===(state==='draft'?(p.draft_category??p.category):p.category));return c?[{post_id:p.id,collection_slug:c.slug,state,position:p.collection_order??0,legacyName:c.name}]:[]}));
 const relationWrites=[];for(const m of relations){if(!missing.has(m.post_id))continue;const name=memberships?data.categories.find(c=>c.slug===m.collection_slug)?.name:m.legacyName;const c=await env.DB.prepare('SELECT slug FROM categories WHERE name=?').bind(name).first();if(!c)error('合集恢复名称或网址冲突，请检查备份。');relationWrites.push(env.DB.prepare('INSERT INTO post_collections(post_id,collection_slug,state,position) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM posts WHERE id=? AND collection_token=?) ON CONFLICT DO NOTHING').bind(m.post_id,c.slug,m.state,m.position,m.post_id,restoreToken))}
 for(let i=0;i<relationWrites.length;i+=50)await env.DB.batch(relationWrites.slice(i,i+50));
 return {changed,images:imageCount};
}



