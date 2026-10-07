// 管理接口的文章合集集合；collection_token 把关联写入绑定到成功的文章 CAS。
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
export async function selectedCollections(env,data,draft){
 let ids=data.collections;
 if(ids===undefined){
  const name=data.category?.trim();
  if(name)await env.DB.prepare('INSERT INTO categories(name) VALUES(?) ON CONFLICT DO NOTHING').bind(name).run();
  ids=name?[(await env.DB.prepare('SELECT slug FROM categories WHERE name=?').bind(name).first()).slug]:[];
 }
 if(!Array.isArray(ids)||ids.length>20||new Set(ids).size!==ids.length||ids.some(x=>typeof x!=='string'||!/^[a-z0-9-]{1,70}$/.test(x))||(!draft&&!ids.length))fail('请选择1–20个有效合集；草稿可暂不选择。');
 const rows=(await env.DB.prepare('SELECT slug,name FROM categories WHERE slug IN(SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all()).results;
 if(rows.length!==ids.length)fail('合集已变化，请刷新后重新选择。',409);
 return {ids,json:JSON.stringify(ids),category:ids.length?rows.find(x=>x.slug===ids[0]).name:''};
}
export async function postCollections(env,id,draft=false){
 return (await env.DB.prepare('SELECT c.slug,c.name FROM post_collections m JOIN categories c ON c.slug=m.collection_slug WHERE m.post_id=? AND m.state=? ORDER BY c.name').bind(id,draft?'draft':'published').all()).results;
}
export function collectionWrites(env,id,nonce,selection,draft){
 const state=draft?'draft':'published',guard='EXISTS(SELECT 1 FROM posts WHERE id=? AND collection_token=?)';
 const writes=[
  env.DB.prepare(`DELETE FROM post_collections WHERE post_id=? AND state=? AND collection_slug NOT IN(SELECT value FROM json_each(?)) AND ${guard}`).bind(id,state,selection.json,id,nonce),
  env.DB.prepare(`INSERT INTO post_collections(post_id,collection_slug,state,position) SELECT ?,c.slug,?,COALESCE((SELECT position FROM post_collections WHERE post_id=? AND collection_slug=c.slug AND state='published'),0) FROM categories c WHERE c.slug IN(SELECT value FROM json_each(?)) AND ${guard} ON CONFLICT DO NOTHING`).bind(id,state,id,selection.json,id,nonce)
 ];
 if(!draft)writes.push(env.DB.prepare(`DELETE FROM post_collections WHERE post_id=? AND state='draft' AND ${guard}`).bind(id,id,nonce));
 return writes;
}

