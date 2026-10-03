// 只复制公开前端文件，不把文章源文件、凭据或 Worker 源码发布为静态资源。
import { mkdir, rm, readFile, writeFile, cp } from 'node:fs/promises';
const root = new URL('../', import.meta.url), dist = new URL('dist/', root);
await rm(dist,{recursive:true,force:true}); await mkdir(dist,{recursive:true});
for (const name of ['index.html','admin/index.html','assets']) {
  const target=new URL(name,dist); await mkdir(new URL('./',target),{recursive:true});
  await cp(new URL(name,root),target,{recursive:true});
}
let template=await readFile(new URL('_layouts/post.html',root),'utf8');
const tokens = {'{{ page.summary | escape }}':'@@SUMMARY@@','{{ page.title | escape }}':'@@TITLE@@','{{ page.url | absolute_url }}':'@@URL@@','{{ page.category | escape }}':'@@CATEGORY@@','{{ page.date | date: "%Y.%m" }}':'@@DATE@@','{{ content }}':'@@BODY@@','{{ site.time | date: "%Y" }}':'@@YEAR@@'};
for(const [key,value] of Object.entries(tokens)) template=template.replaceAll(key,value);
template=template.replace('GitHub Pages','Cloudflare');
if (/\{[{%]/.test(template)) throw Error('文章模板存在未处理的 Liquid');
await writeFile(new URL('article-template.html',dist),template);
console.log('Cloudflare 静态资源已构建到 dist/（不包含文章数据）');
