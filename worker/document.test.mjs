import test from "node:test";
import assert from "node:assert/strict";
import {createDocumentEditor} from "../assets/document-editor.mjs";
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
