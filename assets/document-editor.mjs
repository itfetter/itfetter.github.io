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
 let blockHandle=null,panelBlock=null;
 const alive=(n)=>n===epoch;
 function closeBlockTools(){root.dataset&&(root.dataset.blockTools="closed");blockHandle?.setAttribute("aria-expanded","false")}
 function selectedBlock(){
  const canvas=root.querySelector(".vditor-wysiwyg>.vditor-reset"),selection=window.getSelection();
  let block=selection?.anchorNode?.nodeType===3?selection.anchorNode.parentElement:selection?.anchorNode;
  if(!canvas||!block||!canvas.contains(block))return null;
  while(block.parentElement&&block.parentElement!==canvas)block=block.parentElement;
  if(block===canvas||block.parentElement!==canvas)return null;
  return block;
 }
 function updateBlockHandle(){
  if(!blockHandle)return;
  blockHandle.hidden=true;
  if(!ready||busy||!active)return;
  const block=selectedBlock();
  if(!block||block!==panelBlock)return;
  const rect=block.getBoundingClientRect(),toolbar=root.querySelector(".vditor-toolbar").getBoundingClientRect();
  if(rect.bottom<=toolbar.bottom||rect.top>=window.innerHeight-32)return;
  blockHandle.style.left=Math.max(4,rect.left-38)+"px";
  blockHandle.style.top=Math.max(toolbar.bottom+4,rect.top+4)+"px";
  blockHandle.hidden=false;
 }
 function mountBlockHandle(){
  if(!root.ownerDocument)return;
  blockHandle=root.ownerDocument.createElement("button");blockHandle.type="button";blockHandle.className="blog-block-handle";
  blockHandle.dataset.type="block-tools";blockHandle.textContent="⠿";blockHandle.title="区块操作";
  blockHandle.setAttribute("aria-label","当前区块操作");blockHandle.setAttribute("aria-haspopup","true");blockHandle.setAttribute("aria-expanded","false");blockHandle.hidden=true;
  blockHandle.addEventListener("pointerdown",event=>event.preventDefault());
  blockHandle.addEventListener("click",toggleBlockTools);root.append(blockHandle);
 }
 function toggleBlockTools(event){
  if(!ready||busy||!active)return;
  if(root.dataset.blockTools==="open"){closeBlockTools();return}
  const panel=root.querySelector(".blog-block-panel");
  if(!panel||!panel.children.length||panel.style.display==="none"){onState("请先将光标放在要操作的标题、列表、表格或图片中。");return}
  const rect=blockHandle.getBoundingClientRect();
  root.dataset.blockTools="open";blockHandle.setAttribute("aria-expanded","true");
  const width=Math.min(panel.getBoundingClientRect().width,window.innerWidth-24);
  panel.style.setProperty("--block-menu-left",Math.max(12,Math.min(rect.right+8,window.innerWidth-width-12))+"px");
  panel.style.setProperty("--block-menu-top",Math.max(12,Math.min(rect.top,window.innerHeight-Math.min(panel.getBoundingClientRect().height,window.innerHeight/2)-12))+"px");
 }
 (globalThis.document||root).addEventListener?.("pointerdown",event=>{if(!event.target.closest(".blog-block-panel,[data-type='block-tools']"))closeBlockTools()});
 root.addEventListener?.("keydown",event=>{if(event.key==="Escape"||!event.target.closest(".blog-block-panel,[data-type='block-tools']"))closeBlockTools()});
 window.addEventListener?.("scroll",event=>{if(!event.target.closest?.(".blog-block-panel")){closeBlockTools();updateBlockHandle()}},true);
 globalThis.document?.addEventListener("selectionchange",()=>{if(root.dataset?.blockTools!=="open")updateBlockHandle()});
 window.addEventListener?.("resize",()=>{closeBlockTools();updateBlockHandle()});

 function lock(){if(busy)closeBlockTools();if(ready)busy?editor.disabled():editor.enable();updateBlockHandle()}
 function flush(){
  if(!ready||!active||busy||syncing)return;
  const value=editor.getValue();
  if(value!==baseline){baseline=value;display=value;onChange(value)}
 }
 function destroy(){closeBlockTools();ready=false;editor?.destroy();editor=null;pending=null;root.replaceChildren();blockHandle=null;panelBlock=null}
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
      toolbar:["headings","bold","italic","strike","link","|","list","ordered-list","check","outdent","indent","|","quote","code","inline-code","table","upload","|","undo","redo","insert-after"].map(item=>typeof item==="string"&&item!=="|"?{name:item,tipPosition:"s"}:item),
      toolbarConfig:{pin:true},outline:{enable:false},link:{isOpen:false},image:{isPreview:false},
      preview:{maxWidth:860,hljs:{enable:false},markdown:{sanitize:true,codeBlockPreview:false,mathBlockPreview:false},theme:{current:"light",path:CDN+"/dist/css/content-theme"}},
      upload:{accept:"image/png,image/jpeg,image/webp,image/gif",max:5*1024*1024,handler:async files=>{if(ready&&!busy&&active)await onImage(files);return null}},
      customWysiwygToolbar:(_type,panel)=>{panel.classList.add("blog-block-panel");panelBlock=selectedBlock();queueMicrotask(updateBlockHandle)},
      input:()=>{if(!globalThis.document?.activeElement?.closest(".blog-block-panel"))closeBlockTools();if(alive(n)&&ready)flush()},
      after:()=>{clearTimeout(timeout);if(!alive(n)){resolve();return}
       ready=true;mountBlockHandle();display=getBody();syncing=true;try{editor.setValue(display,true);baseline=editor.getValue()}finally{syncing=false}lock();onState("文档编辑 · 修改后请保存草稿");resolve();
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
  setActive(value){closeBlockTools();if(!value)flush();active=Boolean(value);updateBlockHandle()},
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
