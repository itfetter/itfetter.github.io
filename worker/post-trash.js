// 管理员文章回收站；版本检查防止跨窗口覆盖，图片不跟随删除。
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export async function movePost(env,data,action){
 if(typeof data?.id!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.id)||data.id.length>70||!Number.isSafeInteger(data.version)||data.version<1)return json({error:'文章标识或版本无效。'},400);
 if(!['trash','restore','purge'].includes(action))return json({error:'文章操作无效。'},400);
 if(action==='purge'&&data.confirm!==true)return json({error:'请确认彻底删除文章。'},400);
 const deletedAt=action==='trash'?new Date().toISOString():null;
 const sql=action==='purge'?'DELETE FROM posts WHERE id=? AND version=? AND deleted_at IS NOT NULL':action==='trash'?'UPDATE posts SET deleted_at=?,version=version+1 WHERE id=? AND version=? AND deleted_at IS NULL':'UPDATE posts SET deleted_at=?,version=version+1 WHERE id=? AND version=? AND deleted_at IS NOT NULL';
 const result=await env.DB.prepare(sql).bind(...(action==='purge'?[]:[deletedAt]),data.id,data.version).run();
 if(!result.meta.changes)return json({error:'文章已被修改、移入回收站或删除，请刷新后重试。'},409);
 return json({ok:true,...(action==='purge'?{}:{version:data.version+1,deleted_at:deletedAt})});
}
