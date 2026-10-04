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
export function contextMenuPosition(anchor,size,viewport,inline=false){
 const margin=12,width=Math.min(size.width,Math.max(0,viewport.width-margin*2)),height=Math.min(size.height,Math.max(0,viewport.height-margin*2));
 let left=inline?anchor.left+(anchor.width||0)/2-width/2:anchor.right+8;
 let top=inline?anchor.top-height-8:anchor.top;
 if(inline&&top<margin)top=anchor.bottom+8;
 return {left:Math.max(margin,Math.min(left,viewport.width-width-margin)),top:Math.max(margin,Math.min(top,viewport.height-height-margin))};
}
export function createDocumentEditor({root,getBody,onChange,onState,onImage,loadEngine=engine}){
 let editor=null,ready=false,busy=false,active=true,epoch=0,pending=null,display="",baseline="",syncing=false;
 let blockHandle=null,panelBlock=null,hoverBlock=null,menu=null,toolbar=null,pendingBlock=null,composing=false;
 const alive=(n)=>n===epoch;
 function closeBlockTools(){
  root.dataset&&(root.dataset.blockTools="closed");pendingBlock=null;
  if(menu)menu.hidden=true;
  blockHandle?.setAttribute("aria-expanded","false");
 }
 function canvas(){return root.querySelector(".vditor-wysiwyg>.vditor-reset")}
 function topBlock(node){
  const body=canvas();
  let block=node?.nodeType===3?node.parentElement:node;
  if(!body||!block||!body.contains(block))return null;
  while(block.parentElement&&block.parentElement!==body)block=block.parentElement;
  return block===body||block.parentElement!==body?null:block;
 }
 function selectedBlock(){return topBlock(window.getSelection()?.anchorNode)}
 function updateBlockHandle(){
  if(!blockHandle)return;
  blockHandle.hidden=true;
  if(!ready||busy||!active||composing)return;
  const block=hoverBlock?.isConnected===false?selectedBlock():hoverBlock||selectedBlock();
  if(!block)return;
  const rect=block.getBoundingClientRect();
  if(rect.bottom<=8||rect.top>=window.innerHeight-32)return;
  const type=/^H[1-6]$/.test(block.tagName)?block.tagName:
   ({P:"T",UL:"列表",OL:"列表",BLOCKQUOTE:"引用",TABLE:"表格",PRE:"代码"})[block.tagName]||"块";
  blockHandle.textContent=type+" ⠿";
  blockHandle.style.left=Math.max(4,rect.left-54)+"px";
  blockHandle.style.top=Math.max(8,rect.top+4)+"px";
  blockHandle.hidden=false;
 }
 function positionMenu(rect,inline=false){
  if(!menu)return;
  const size=menu.getBoundingClientRect(),position=contextMenuPosition(rect,size,{width:window.innerWidth,height:window.innerHeight},inline);
  menu.style.left=position.left+"px";menu.style.top=position.top+"px";
 }
 function syncFormatAvailability(){
  const heading=toolbar?.querySelector("[data-type='headings']");
  toolbar?.querySelectorAll?.("[data-tag]").forEach(button=>{button.disabled=Boolean(heading?.classList.contains("vditor-menu--disabled"));button.setAttribute("aria-pressed",String(selectedBlock()?.tagName?.toLowerCase()===button.dataset.tag))});
 }
 function showMenu(mode,rect){
  if(!menu||!ready||busy||!active||composing)return;
  menu.dataset.mode=mode;menu.dataset.native=String(mode==="block"&&panelBlock===pendingBlock);
  menu.hidden=false;syncFormatAvailability();root.dataset.blockTools="open";
  blockHandle.setAttribute("aria-expanded",String(mode==="block"));
  positionMenu(rect,mode==="inline");
 }
 function syncNativePanel(panel){
  panel.classList.add("blog-block-panel");panelBlock=selectedBlock();
  if(menu&&panel.parentElement!==menu)menu.append(panel);
  panel.querySelectorAll?.("button[aria-label]").forEach(button=>{
   button.title=button.getAttribute("aria-label");
   if(!button.querySelector(".blog-operation-label")){
    const label=root.ownerDocument.createElement("span");label.className="blog-operation-label";label.textContent=button.title.split("<")[0];
    button.append(label);
   }
  });
  queueMicrotask(()=>{
   if(!ready||!active||busy)return;
   syncFormatAvailability();
   if(menu&&!menu.hidden&&menu.dataset.mode==="block"){
    menu.dataset.native=String(panelBlock===pendingBlock);
    positionMenu(blockHandle.getBoundingClientRect());
   }
   updateBlockHandle();
  });
 }
 function toggleBlockTools(){
  if(!ready||busy||!active||composing)return;
  if(menu&&!menu.hidden&&menu.dataset.mode==="block"){closeBlockTools();return}
  const block=hoverBlock||selectedBlock();
  if(!block||block.isConnected===false)return;
  // 悬停不改变选区；仅明确点击另一块入口时定位光标。
  if(block!==selectedBlock()){
   const target=block.querySelector?.("td,th,li,p,code")||block;
   const range=root.ownerDocument.createRange();range.selectNodeContents(target);range.collapse(true);
   canvas().focus({preventScroll:true});
   const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
   // 使用引擎自己的 click 路径生成本区块菜单，禁止复用旧区块操作。
   target.dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:block.getBoundingClientRect().left+1,clientY:block.getBoundingClientRect().top+1}));
  }
  pendingBlock=block;hoverBlock=block;updateBlockHandle();
  showMenu("block",blockHandle.getBoundingClientRect());
 }
 function selectionMenu(){
  if(!menu||busy||!active||composing||!ready)return;
  if(!menu.hidden&&menu.dataset.mode==="block")return;
  const selection=window.getSelection(),body=canvas();
  if(selection?.isCollapsed===false&&selection.rangeCount&&body?.contains(selection.anchorNode)&&body.contains(selection.focusNode)){
   const rect=selection.getRangeAt(0).getBoundingClientRect();
   showMenu("inline",rect);
  }else{if(!menu.hidden&&menu.dataset.mode==="inline")closeBlockTools();updateBlockHandle()}
 }
 function mountBlockHandle(){
  if(!root.ownerDocument)return;
  toolbar=root.querySelector(".vditor-toolbar");
  menu=root.ownerDocument.createElement("div");menu.className="blog-document-menu";menu.hidden=true;
  menu.setAttribute("role","group");menu.setAttribute("aria-label","正文编辑操作");
  menu.addEventListener("pointerdown",event=>{if(!event.target.closest("input,textarea,select"))event.preventDefault()});
  toolbar.querySelectorAll?.("[aria-label]").forEach(button=>button.title=button.getAttribute("aria-label"));
  const headings=toolbar.querySelector("[data-type='headings']");
  if(headings){headings.textContent="正文";headings.title="将标题恢复为正文"}
  toolbar.querySelectorAll?.("[data-tag]").forEach(button=>{button.title=button.textContent;button.textContent=button.dataset.tag.toUpperCase()});
  menu.append(toolbar);root.append(menu);
  blockHandle=root.ownerDocument.createElement("button");blockHandle.type="button";blockHandle.className="blog-block-handle";
  blockHandle.dataset.type="block-tools";blockHandle.textContent="T ⠿";blockHandle.title="区块格式与操作";
  blockHandle.setAttribute("aria-label","打开区块格式与操作");blockHandle.setAttribute("aria-haspopup","true");blockHandle.setAttribute("aria-expanded","false");blockHandle.hidden=true;
  blockHandle.addEventListener("pointerdown",event=>event.preventDefault());
  blockHandle.addEventListener("click",toggleBlockTools);root.append(blockHandle);
  const panel=root.querySelector(".blog-block-panel");
  if(panel)menu.append(panel);
 }
 (globalThis.document||root).addEventListener?.("pointerdown",event=>{
  if(!event.target.closest(".blog-document-menu,[data-type='block-tools']"))closeBlockTools();
 });
 root.addEventListener?.("pointermove",event=>{
  if(event.pointerType==="touch"||!ready||busy||composing||root.dataset?.blockTools==="open")return;
  const block=topBlock(event.target);if(block){hoverBlock=block;updateBlockHandle()}
 });
 root.addEventListener?.("pointerleave",()=>{if(root.dataset?.blockTools!=="open"){hoverBlock=null;if(blockHandle)blockHandle.hidden=true}});
 root.addEventListener?.("compositionstart",()=>{composing=true;closeBlockTools();updateBlockHandle()});
 root.addEventListener?.("compositionend",()=>{composing=false;hoverBlock=null;updateBlockHandle()});
 root.addEventListener?.("keydown",event=>{
  if(event.key==="Escape"){closeBlockTools();return}
  if(event.altKey&&event.shiftKey&&event.code==="KeyB"){event.preventDefault();hoverBlock=null;toggleBlockTools();return}
  if(!event.target.closest(".blog-document-menu,[data-type='block-tools']")){closeBlockTools();hoverBlock=null}
 });
 root.addEventListener?.("pointerup",()=>queueMicrotask(selectionMenu));
 window.addEventListener?.("scroll",event=>{
  if(!event.target.closest?.(".blog-document-menu")){closeBlockTools();hoverBlock=null;updateBlockHandle()}
 },true);
 globalThis.document?.addEventListener("selectionchange",()=>{if(root.dataset?.blockTools!=="open")queueMicrotask(selectionMenu)});
 window.addEventListener?.("resize",()=>{closeBlockTools();hoverBlock=null;updateBlockHandle()});
 function lock(){if(busy)closeBlockTools();if(ready)busy?editor.disabled():editor.enable();updateBlockHandle()}
 function flush(){
  if(!ready||!active||busy||syncing)return;
  const value=editor.getValue();
  if(value!==baseline){baseline=value;display=value;onChange(value)}
 }
 function destroy(){closeBlockTools();ready=false;editor?.destroy();editor=null;pending=null;root.replaceChildren();blockHandle=null;panelBlock=null;hoverBlock=null;menu=null;toolbar=null;pendingBlock=null;composing=false}
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
      toolbarConfig:{pin:false},outline:{enable:false},link:{isOpen:false},image:{isPreview:false},
      preview:{maxWidth:860,hljs:{enable:false},markdown:{sanitize:true,codeBlockPreview:false,mathBlockPreview:false},theme:{current:"light",path:CDN+"/dist/css/content-theme"}},
      upload:{accept:"image/png,image/jpeg,image/webp,image/gif",max:5*1024*1024,handler:async files=>{if(ready&&!busy&&active)await onImage(files);return null}},
      customWysiwygToolbar:(_type,panel)=>syncNativePanel(panel),
      input:()=>{if(!globalThis.document?.activeElement?.closest(".blog-document-menu"))closeBlockTools();if(alive(n)&&ready)flush()},
      after:()=>{clearTimeout(timeout);if(!alive(n)){resolve();return}
       ready=true;mountBlockHandle();display=getBody();syncing=true;try{editor.setValue(display,true);baseline=editor.getValue()}finally{syncing=false}lock();onState("文档编辑 · 悬停左侧打开区块菜单，选中文字设置格式 · 修改后请保存草稿");resolve();
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
