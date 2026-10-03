// 生成可审查的 D1 导入 SQL；不会连接线上数据库或删除原文件。
import {readdir, readFile, writeFile, mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../worker/package.json',import.meta.url));
const {parse}=require('yaml');
const root=new URL('../',import.meta.url), seen=new Set(), urls=new Set(), rows=[];
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
for(const file of (await readdir(new URL('_posts/',root))).filter(f=>f.endsWith('.md')).sort()) {
  const text=await readFile(new URL('_posts/'+file,root),'utf8');
  const match=/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if(!match) throw Error(file+' 缺少 front matter');
  const info=parse(match[1]), id=info.blog_id;
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||seen.has(id)||urls.has(info.permalink)||info.permalink!=='/articles/'+id+'/') throw Error(file+' 的标识或链接不合法/重复，禁止导入');
  for(const field of ['title','category','summary']) if(typeof info[field]!=='string'||!info[field].trim()) throw Error(file+' 缺少 '+field);
  // 仓库中的日期含显式 +0800；保留原发布日期。
  const date=new Date(String(info.date)); if(!Number.isFinite(date.getTime())) throw Error(file+' 日期无效');
  seen.add(id); urls.add(info.permalink);
  rows.push([id,info.title,info.category,info.summary,match[2],date.toISOString(),info.permalink,date.toISOString()]);
}
await mkdir(new URL('.migration/',root),{recursive:true});
const sql='-- 迁移前请备份 D1；重复执行不会覆盖已存在的文章。\n'+rows.map(row=>'INSERT INTO posts (id,title,category,summary,body,published_at,permalink,updated_at) VALUES ('+row.map(quote).join(',')+') ON CONFLICT DO NOTHING;').join('\n')+'\n';
await writeFile(new URL('.migration/posts.sql',root),sql);
console.log('生成 '+rows.length+' 篇文章的导入 SQL：.migration/posts.sql；原文件未改动。');
