import test from "node:test";
import assert from "node:assert/strict";
import {createDocumentEditor,contextMenuPosition} from "../assets/document-editor.mjs";
globalThis.window={VditorI18n:{},getSelection:()=>null};
function setup(body="原文\r\n"){
 let value=body,changes=[],state=[],instance;
 const root={replaceChildren(){},contains(){return false}};
 class Fake{
  constructor(root,options){instance=this;this.options=options;this.markdown="";queueMicrotask(options.after)}
  setValue(md){this.markdown=md.replaceAll("\r\n","\n").trimEnd()+"\n";this.options.input()}
  getValue(){return this.markdown}
  disabled(){this.locked=true}enable(){this.locked=false}
  destroy(){this.destroyed=true}
  insertMD(md){this.markdown+=md;this.options.input()}
 }
 const editor=createDocumentEditor({root,getBody:()=>value,onChange:md=>{changes.push(md);value=md},onState:s=>state.push(s),onImage:async()=>{},loadEngine:async()=>Fake});
 return {editor,changes,state,setBody:md=>value=md,value:()=>value,instance:()=>instance,Fake};
}
test("初始化和模式切换保留原 Markdown，不把引擎规范化当成修改",async()=>{
 const h=setup();await h.editor.load();h.editor.flush();h.editor.setActive(false);h.editor.setActive(true);await h.editor.load();
 assert.equal(h.value(),"原文\r\n");assert.equal(h.changes.length,0);assert.equal(h.instance().options.cache.enable,false);assert.equal(h.instance().options.preview.markdown.sanitize,true);
});
test("连续编辑即时同步，保存前 flush 捕获尚未触发 input 的修改",async()=>{
 const h=setup();await h.editor.load();h.instance().markdown="# 标题\n\n新的正文\n";h.editor.flush();
 assert.equal(h.value(),"# 标题\n\n新的正文\n");assert.equal(h.changes.length,1);
 h.editor.setActive(false);h.instance().markdown="迟来的输入";h.instance().options.input();assert.equal(h.changes.length,1);
 h.setBody("源码修改");h.editor.setActive(true);await h.editor.load();assert.equal(h.changes.length,1);assert.equal(h.instance().getValue(),"源码修改\n");
});
test("保存与图片上传锁阻止迟到输入，图片插入显式同步并解锁",async()=>{
 const h=setup();await h.editor.load();h.editor.setBusy(true);assert.equal(h.instance().locked,true);
 h.instance().options.input();assert.equal(h.changes.length,0);
 h.editor.insertMarkdown("![图片](/images/test.png)");assert.match(h.value(),/images\/test.png/);assert.equal(h.instance().locked,true);
 h.editor.setBusy(false);assert.equal(h.instance().locked,false);
});
test("切换文章隔离旧回调，不覆盖新文章",async()=>{
 const h=setup("旧文章");await h.editor.load();const old=h.instance();h.editor.invalidate();h.setBody("新文章");await h.editor.load();
 old.markdown="旧回调";old.options.input();assert.equal(h.value(),"新文章");assert.equal(h.changes.length,0);assert.equal(old.destroyed,true);
});
test("资源失败可重试，未保存正文不丢失",async()=>{
 let attempts=0,value="未保存原文";const h=setup();
 const editor=createDocumentEditor({root:{replaceChildren(){}},getBody:()=>value,onChange:()=>assert.fail(),onState:()=>{},onImage:async()=>{},loadEngine:async()=>{if(!attempts++)throw Error("网络失败");return h.Fake}});
 await editor.load();await editor.load();assert.equal(attempts,2);assert.equal(value,"未保存原文");
});


test("菜单定位保持在手机视口内，顶部选区菜单自动向下",()=>{
 assert.deepEqual(contextMenuPosition({left:330,right:350,top:590,bottom:600},{width:320,height:220},{width:360,height:600}),{left:28,top:368});
 assert.deepEqual(contextMenuPosition({left:10,right:90,top:4,bottom:25,width:80},{width:240,height:70},{width:360,height:600},true),{left:12,top:33});
});
test("悬停不移动选区，点击后生成目标区块菜单，选字显示文字菜单",async()=>{
 const priorWindow=globalThis.window,priorDocument=globalThis.document,priorMouse=globalThis.MouseEvent;
 const events={},made=[];let selectionChanges=0;
 function node(tag){
  const item={tagName:tag,dataset:{},style:{},handlers:{},children:[],hidden:false,isConnected:true,classList:{add(){}},
   setAttribute(k,v){this[k]=v},addEventListener(k,v){this.handlers[k]=v},
   append(child){child.parentElement=this;this.children.push(child)},
   querySelector(){return null},querySelectorAll(){return []},
   closest(selector){return this.className==="blog-document-menu"&&selector.includes(".blog-document-menu")?this:null},
   getBoundingClientRect(){return {left:Number.parseFloat(this.style.left)||12,right:(Number.parseFloat(this.style.left)||12)+46,top:Number.parseFloat(this.style.top)||100,bottom:128,width:320,height:220}}
  };return item;
 }
 const doc={addEventListener:(k,v)=>events[k]=v,createElement:tag=>{const n=node(tag.toUpperCase());made.push(n);return n},
  createRange:()=>({selectNodeContents(block){this.block=block},collapse(){},getBoundingClientRect:()=>({left:70,right:150,top:100,bottom:125,width:80})})};
 const body=node("PRE");body.focus=()=>{};body.contains=b=>b===one||b===two;
 const one=node("H2"),two=node("P");one.parentElement=body;two.parentElement=body;
 one.getBoundingClientRect=()=>({left:70,top:96,bottom:150});two.getBoundingClientRect=()=>({left:70,top:200,bottom:260});
 const selection={anchorNode:one,focusNode:one,rangeCount:1,isCollapsed:true,
  getRangeAt:()=>({getBoundingClientRect:()=>({left:70,right:150,top:100,bottom:125,width:80})}),
  removeAllRanges(){selectionChanges++},addRange(range){selectionChanges++;this.anchorNode=this.focusNode=range.block}};
 const toolbar=node("DIV"),panel=node("DIV");
 const root=node("DIV");root.ownerDocument=doc;root.replaceChildren=()=>{};root.contains=b=>body.contains(b);
 root.querySelector=selector=>selector===".vditor-toolbar"?toolbar:selector===".blog-block-panel"?panel:body;
 globalThis.document=doc;globalThis.MouseEvent=class{constructor(type,options){this.type=type;Object.assign(this,options)}};
 globalThis.window={VditorI18n:{},innerWidth:360,innerHeight:600,addEventListener(){},getSelection:()=>selection};
 class Fake{constructor(root,options){Fake.last=this;this.options=options;queueMicrotask(options.after)}setValue(){}getValue(){return ""}enable(){}disabled(){}destroy(){}}
 two.dispatchEvent=()=>Fake.last.options.customWysiwygToolbar("block",panel);
 try{
  const editor=createDocumentEditor({root,getBody:()=>"",onChange(){},onState(){},onImage:async()=>{},loadEngine:async()=>Fake});await editor.load();
  const menu=made.find(n=>n.className==="blog-document-menu"),button=made.find(n=>n.className==="blog-block-handle");
  assert.equal(menu.hidden,true);assert.equal(toolbar.parentElement,menu); // 没有常驻顶栏，仍保留原按钮事件。
  root.handlers.pointermove({target:two,pointerType:"mouse"});
  assert.equal(button.textContent,"T ⠿");assert.equal(selection.anchorNode,one);assert.equal(selectionChanges,0);
  let prevented=false;button.handlers.pointerdown({preventDefault:()=>prevented=true});assert.equal(prevented,true);
  button.handlers.click();await Promise.resolve();
  assert.equal(selection.anchorNode,two);assert.equal(selectionChanges,2);
  assert.equal(menu.hidden,false);assert.equal(menu.dataset.mode,"block");assert.equal(menu.dataset.native,"true");
  assert.equal(panel.parentElement,menu);
  root.handlers.keydown({key:"Escape",target:body});assert.equal(menu.hidden,true);
  selection.isCollapsed=false;events.selectionchange();await Promise.resolve();
  assert.equal(menu.dataset.mode,"inline");assert.equal(menu.dataset.native,"false");
  root.handlers.compositionstart();assert.equal(menu.hidden,true);assert.equal(button.hidden,true);
  events.selectionchange();await Promise.resolve();assert.equal(menu.hidden,true);
  root.handlers.compositionend();editor.setBusy(true);assert.equal(button.hidden,true);
  editor.setBusy(false);editor.setActive(false);assert.equal(button.hidden,true);
 }finally{globalThis.window=priorWindow;globalThis.document=priorDocument;globalThis.MouseEvent=priorMouse}
});
