// 公开联系邮箱与登录账号无关，只允许管理员修改。
export const legacyContactEmail='Itfetterit@gmail.com';
export function validContactEmail(value){
 if(typeof value!=='string'||value.length>254)return false;
 if(value==='')return true;
 const [local]=value.split('@');
 return local.length<=64&&!local.startsWith('.')&&!local.endsWith('.')&&!local.includes('..')&&/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(value);
}
export async function readSiteSettings(env){
 const row=await env.DB.prepare('SELECT contact_email,version FROM site_settings WHERE id=1').first();
 return row||{contact_email:legacyContactEmail,version:0};
}
export async function saveSiteSettings(env,data){
 if(!data||!validContactEmail(data.contact_email)||!Number.isSafeInteger(data.version)||data.version<0)throw Object.assign(new Error('请输入有效的公开联系邮箱，留空可以隐藏。'),{status:400});
 const email=data.contact_email;
 const stmt=data.version===0?env.DB.prepare('INSERT INTO site_settings(id,contact_email,version) VALUES(1,?,1) ON CONFLICT(id) DO NOTHING').bind(email):
 env.DB.prepare('UPDATE site_settings SET contact_email=?,version=version+1 WHERE id=1 AND version=?').bind(email,data.version);
 const result=await stmt.run();
 if(result.meta.changes!==1)throw Object.assign(new Error('联系方式已在其他窗口修改，请重新读取后再保存。'),{status:409});
 return {contact_email:email,version:data.version+1};
}
