import test from 'node:test';
import assert from 'node:assert/strict';
import {blockMarkdown,combineBlocks,createVisualEditor} from '../assets/visual-editor.mjs';
const text=value=>({nodeType:3,nodeValue:value});
function el(name,items=[],attrs={}){
 const node={nodeType:1,tagName:name.toUpperCase(),childNodes:items.map(x=>typeof x==='string'?text(x):x),getAttribute:key=>attrs[key]||null};
 node.children=node.childNodes.filter(x=>x.nodeType===1);
 node.querySelectorAll=selector=>node.children.flatMap(child=>[...(child.tagName.toLowerCase()===selector?[child]:[]),...child.querySelectorAll(selector)]);
 node.querySelector=selector=>node.querySelectorAll(selector)[0]||null;
 return node;
}
test('可视化文字、标题、链接与图片转Markdown；危险协议不保留',()=>{
 const node=el('div',[el('h2',['标题']),el('p',['文字 ',el('b',['加粗']),' ',el('i',['斜体']),' ',el('a',['网站'],{href:'https://example.com/a b'}),' ',el('img',[],{src:'/images/test.png',alt:'示例'})])]);
 const md=blockMarkdown(node);assert.match(md,/## 标题/);assert.match(md,/\*\*加粗\*\*/);assert.match(md,/\*斜体\*/);assert.match(md,/\[网站\]\(<https:\/\/example.com\/a%20b>\)/);assert.match(md,/!\[示例\]\(<\/images\/test.png>\)/);
 assert.doesNotMatch(blockMarkdown(el('div',[el('p',[el('a',['危险'],{href:'javascript:alert(1)'})])])),/javascript:/);
});
test('表格编辑保留列和对齐、竖线转义；列表与代码保留结构',()=>{
 const table=el('table',[el('thead',[el('tr',[el('th',['服务'],{align:'left'}),el('th',['用途'],{align:'right'})])]),el('tbody',[el('tr',[el('td',['R2']),el('td',['图片 | 文件'])])])]);
 assert.equal(blockMarkdown(el('div',[table])),'| 服务 | 用途 |\n| :--- | ---: |\n| R2 | 图片 \\| 文件 |');
 const list=el('ul',[el('li',['一级',el('ul',[el('li',['二级'])])])]);
 assert.equal(blockMarkdown(el('div',[list])),'- 一级\n  - 二级');
 const bt=String.fromCharCode(96),code=el('pre',[el('code',['const a = '+bt.repeat(3)+';\n'],{class:'language-js'})]);
 assert.ok(blockMarkdown(el('div',[code])).startsWith(bt.repeat(4)+'js\n'));
 assert.match(blockMarkdown(el('div',[el('pre',[el('code',['line1',el('div',['line2'])])])])),/line1\nline2/);
});
test('未修改区块逐字保留；修改局部不会重写其他Markdown',()=>{
 const original=el('div',[el('p',['旧正文'])]);original.innerHTML='same';
 const edited=el('div',[el('p',['新正文'])]);edited.innerHTML='changed';
 const records=[{raw:'# 标题\r\n\r\n',initial:'same',element:original},{raw:'旧正文\n\n',initial:'before',element:edited},{raw:'[ref]: https://example.com\n',element:null}];
 assert.equal(combineBlocks(records),'# 标题\r\n\r\n新正文\n\n[ref]: https://example.com\n');
 edited.innerHTML='before';assert.equal(combineBlocks(records),'# 标题\r\n\r\n旧正文\n\n[ref]: https://example.com\n');
});

test('可视化异步结果不覆盖新正文；输入同步与保存锁保持稳定DOM',async()=>{
 const previous=globalThis.document,requests=[],states=[];let body='one';
 const make=()=>({childNodes:[],children:[],dataset:{},innerHTML:'',classList:{add(){}},setAttribute(){},focus(){},append(node){this.children.push(node)},replaceChildren(){this.children=[]},contains(node){return this.children.includes(node)}});
 const root=make(),listeners={};root.addEventListener=(name,fn)=>{listeners[name]=fn};
 globalThis.document={createElement:make,getSelection:()=>null};
 try{
 const editor=createVisualEditor({root,getBody:()=>body,request:source=>new Promise(resolve=>requests.push({source,resolve})),onChange:value=>{body=value},onState:value=>states.push(value),onImage(){}});
 const first=editor.load();body='two';const second=editor.load();
 requests[1].resolve({blocks:[{type:'paragraph',raw:'two',html:'<p>two</p>',editable:true}]});await second;
 const element=root.children[0];
 requests[0].resolve({blocks:[{type:'paragraph',raw:'one',html:'<p>one</p>',editable:true}]});await first;
 assert.equal(root.children[0],element);assert.equal(element.contentEditable,'true');
 element.innerHTML='<p>中文修改</p>';element.childNodes=[el('p',['中文修改'])];
 listeners.input({target:{closest:()=>element}});assert.equal(body,'中文修改\n\n');
 await editor.load();assert.equal(root.children[0],element);
 editor.setBusy(true);assert.equal(element.contentEditable,'false');
 editor.setBusy(false);assert.equal(element.contentEditable,'true');
 }finally{globalThis.document=previous}
});
