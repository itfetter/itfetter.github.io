// Vditor 文档编辑适配：Markdown 为唯一保存格式，不缓存私密草稿。
const CDN="/assets/vendor/vditor";
let resources;
function script(path,id){
 return new Promise((resolve,reject)=>{
  if(document.getElementById(id)){resolve();return}
  const el=document.createElement("script");el.src=path;el.id=id;
  const timer=setTimeout(()=>{el.remove();reject(Error("编辑器资源加载超时，请重试或切换 Markdown。"))},20000);
  el.onload=()=>{clearTimeout(timer);resolve()};el.onerror=()=>{clearTimeout(timer);el.remove();reject(Error("编辑器资源加载失败，请重试或切换 Markdown。"))};
  document.head.append(el);
 });
}
async function engine(){
 if(!resources)resources=(async()=>{
  await script(CDN+"/dist/index.min.js","blog-vditor");
  await script(CDN+"/dist/js/i18n/zh_CN.js","vditorI18nScriptzh_CN");
  await script(CDN+"/dist/js/lute/lute.min.js","vditorLuteScript");
  await script(CDN+"/dist/js/icons/ant.js","vditorIconScript");
  return window.Vditor;
 })().catch(error=>{resources=null;throw error});
 return resources;
}
export function createDocumentEditor({root,getBody,onChange,onState,onImage,loadEngine=engine}){
 let editor=null,ready=false,busy=false,active=true,epoch=0,pending=null,display="",baseline="",syncing=false;
 const alive=(n)=>n===epoch;
 function lock(){if(ready)busy?editor.disabled():editor.enable()}
 function flush(){
  if(!ready||!active||busy||syncing)return;
  const value=editor.getValue();
  if(value!==baseline){baseline=value;display=value;onChange(value)}
 }
 function destroy(){ready=false;editor?.destroy();editor=null;pending=null;root.replaceChildren()}
 async function load(){
  if(!active)return;
  const body=getBody();
  if(ready){
   if(body!==display){display=body;syncing=true;try{editor.setValue(body,true);baseline=editor.getValue()}finally{syncing=false}lock()}
   return;
  }
  if(pending)return pending;
  const n=epoch;onState("正在加载文档编辑器…");
  pending=(async()=>{
   try{
    const Constructor=await loadEngine();if(!alive(n))return;
    root.replaceChildren();
    await new Promise((resolve,reject)=>{
     const timeout=setTimeout(()=>reject(Error("编辑器加载超时，可重试或使用 Markdown。")),20000);
     editor=new Constructor(root,{
      cdn:CDN,lang:"zh_CN",i18n:window.VditorI18n,mode:"wysiwyg",
      cache:{enable:false},value:getBody(),height:"auto",minHeight:520,
      placeholder:"从这里开始写作… 输入 # 加空格创建标题，- 加空格创建列表。",
      toolbar:["headings","bold","italic","strike","link","|","list","ordered-list","check","outdent","indent","|","quote","code","inline-code","table","upload","|","undo","redo","insert-after"],
      toolbarConfig:{pin:true},outline:{enable:false},link:{isOpen:false},image:{isPreview:false},
      preview:{maxWidth:860,hljs:{enable:false},markdown:{sanitize:true,codeBlockPreview:false,mathBlockPreview:false},theme:{current:"light",path:CDN+"/dist/css/content-theme"}},
      upload:{accept:"image/png,image/jpeg,image/webp,image/gif",max:5*1024*1024,handler:async files=>{if(ready&&!busy&&active)await onImage(files);return null}},
      input:()=>{if(alive(n)&&ready)flush()},
      after:()=>{clearTimeout(timeout);if(!alive(n)){resolve();return}
       ready=true;display=getBody();syncing=true;try{editor.setValue(display,true);baseline=editor.getValue()}finally{syncing=false}lock();onState("文档编辑 · 修改后请保存草稿");resolve();
      }
     });
    });
   }catch(error){if(alive(n)){epoch++;destroy();onState(error.message)}}
   finally{if(alive(n))pending=null}
  })();
  return pending;
 }
 return {
  load,flush,
  invalidate(){epoch++;destroy()},
  setBusy(value){if(value&&!busy)flush();busy=Boolean(value);lock()},
  setActive(value){if(!value)flush();active=Boolean(value)},
  rememberSelection(){const selection=window.getSelection();return selection?.rangeCount&&root.contains(selection.anchorNode)?selection.getRangeAt(0).cloneRange():null},
  insertMarkdown(markdown,range){
   if(!ready||!active)throw Error("请等待文档编辑器加载完成。");
   editor.enable();
   if(range&&root.contains(range.startContainer)){const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range)}
   editor.insertMD(markdown);
   // 上传期间由本次插入显式同步，不接受其他输入。
   const value=editor.getValue();baseline=value;display=value;onChange(value);lock();
  }
 };
}
