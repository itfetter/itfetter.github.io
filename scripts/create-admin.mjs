// 在可信终端交互输入密码；仅生成被忽略的 SQL，不连接线上数据库。
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {mkdir,writeFile} from 'node:fs/promises';
import {hashPassword} from '../worker/auth.js';
if(!process.stdin.isTTY)throw Error('请在交互终端执行，不要把密码写入命令行或环境变量。');
let hidden=false;
const output=new Writable({write(chunk,encoding,callback){if(!hidden)process.stdout.write(chunk,encoding);callback();}});
const rl=createInterface({input:process.stdin,output,terminal:true});
try {
 const username=(await rl.question('管理员账号（小写英文/数字/连字符，3–64 字符）：')).trim();
 if(!/^[a-z0-9][a-z0-9-]{2,63}$/.test(username))throw Error('账号格式无效。');
 process.stdout.write('密码（6–128 字符，输入不显示）：');hidden=true;
 const password=await rl.question('');hidden=false;process.stdout.write('\n');
 process.stdout.write('再次输入密码：');hidden=true;
 const confirmation=await rl.question('');hidden=false;process.stdout.write('\n');
 if(password!==confirmation)throw Error('两次密码不一致。');
 const hash=await hashPassword(password),quote=v=>"'"+v.replaceAll("'","''")+"'";
 const sql='-- 私密管理员初始化/重置 SQL，禁止提交；执行时撤销所有旧会话。\n'+
 'DELETE FROM admin_sessions;\nINSERT INTO admin_users (id,username,password_hash,updated_at) VALUES (1,'+[username,hash,new Date().toISOString()].map(quote).join(',')+') ON CONFLICT(id) DO UPDATE SET username=excluded.username,password_hash=excluded.password_hash,updated_at=excluded.updated_at;\n';
 const dir=new URL('../.migration/',import.meta.url);await mkdir(dir,{recursive:true});
 await writeFile(new URL('admin.sql',dir),sql,{mode:0o600});
 process.stdout.write('已生成 .migration/admin.sql；请在可信部署环境执行后删除该私密文件。\n');
}finally{hidden=false;rl.close();}
