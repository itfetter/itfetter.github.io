// 可视化区块编辑：服务端清理 HTML；只转换实际改动的区块。
const BT=String.fromCharCode(96);
const escapeText=text=>String(text).replace(/\\/g,'\\\\').replace(/([\x60*_[\]<>])/g,'\\$1').replace(/^(\s*)([#>+-]|\d+\.)/gm,'$1\\$2');
const tag=node=>node.nodeType===1?node.tagName.toLowerCase():'';
const children=node=>Array.from(node.childNodes||[]);
const safeUrl=value=>{const url=String(value||'');return /^(https?:|mailto:|\/(?!\/)|#)/i.test(url)?url.replace(/[<>\s]/g,c=>encodeURIComponent(c)):''};
function plain(node){if(node.nodeType===3)return node.nodeValue||'';if(tag(node)==='br')return '\n';const value=children(node).map(plain).join('');return ['div','p'].includes(tag(node))?'\n'+value:value}
function inline(node){
 if(node.nodeType===3)return escapeText(node.nodeValue||'');
 const name=tag(node),text=children(node).map(inline).join('');
 if(['script','style','iframe','object'].includes(name))return '';
 if(['strong','b'].includes(name))return text?'**'+text+'**':'';
 if(['em','i'].includes(name))return text?'*'+text+'*':'';
 if(['del','s','strike'].includes(name))return text?'~~'+text+'~~':'';
 if(name==='code'){const value=plain(node),runs=value.match(/\x60+/g)||[],fence=BT.repeat(Math.max(0,...runs.map(x=>x.length))+1),pad=/^\x60|\x60$|^ | $/.test(value)?' ':'';return fence+pad+value+pad+fence}
 if(name==='a'){const url=safeUrl(node.getAttribute('href'));return url?'['+text+'](<'+url+'>)':text}
 if(name==='img'){const url=safeUrl(node.getAttribute('src'));return url?'!['+escapeText(node.getAttribute('alt')||'图片')+'](<'+url+'>)':''}
 if(name==='br')return '  \n';
 if(name==='div'||name==='p')return '\n'+text+'\n';
 return text;
}
function list(node){
 let number=Number(node.getAttribute('start')||1);
 return children(node).filter(n=>tag(n)==='li').map(item=>{
  const nested=children(item).filter(n=>['ul','ol'].includes(tag(n))),content=children(item).filter(n=>!nested.includes(n)).map(n=>['p','div'].includes(tag(n))?children(n).map(inline).join(''):inline(n)).join('').trim();
  const marker=tag(node)==='ol'?(number++)+'. ':'- ';
  return marker+content.replace(/\n/g,'\n  ')+(nested.length?'\n'+nested.map(list).join('\n').split('\n').map(line=>'  '+line).join('\n'):'');
 }).join('\n');
}
function table(node){
 const rows=Array.from(node.querySelectorAll('tr')).map(row=>Array.from(row.children).filter(c=>['th','td'].includes(tag(c))));
 if(!rows.length)return '';
 const width=Math.max(...rows.map(r=>r.length)),cell=c=>c?children(c).map(inline).join('').trim().replace(/\|/g,'\\|').replace(/(?: {2})?\n/g,'<br>'):'';
 const line=row=>'| '+Array.from({length:width},(_,i)=>cell(row[i])).join(' | ')+' |';
 const align=Array.from({length:width},(_,i)=>{const value=rows[0][i]?.getAttribute('align');return value==='center'?':---:':value==='right'?'---:':value==='left'?':---':'---'});
 return [line(rows[0]),'| '+align.join(' | ')+' |',...rows.slice(1).map(line)].join('\n');
}
function block(node){
 const name=tag(node);
 if(node.nodeType===3)return escapeText(node.nodeValue||'');
 if(/^h[1-6]$/.test(name))return '#'.repeat(Number(name[1]))+' '+children(node).map(inline).join('').trim();
 if(name==='pre'){const code=node.querySelector('code')||node,value=plain(code).replace(/\n$/,''),language=(code.getAttribute('class')||'').match(/language-([\w+-]+)/)?.[1]||'',fence=BT.repeat(Math.max(2,...(value.match(/\x60+/g)||[]).map(x=>x.length))+1);return fence+language+'\n'+value+'\n'+fence}
 if(name==='blockquote')return children(node).map(block).filter(Boolean).join('\n\n').split('\n').map(line=>'> '+line).join('\n');
 if(name==='ul'||name==='ol')return list(node);
 if(name==='table')return table(node);
 if(name==='hr')return '---';
 if(name==='div')return children(node).map(block).filter(Boolean).join('\n\n');
 return children(node).map(inline).join('').trim();
}
export function blockMarkdown(element){return children(element).map(block).filter(Boolean).join('\n\n').trim()}
export function combineBlocks(records){
 let result='';
 for(const record of records){
  let value=record.element&&record.element.innerHTML!==record.initial?blockMarkdown(record.element):record.raw;
  if(record.element&&record.element.innerHTML!==record.initial&&value)value+='\n\n';
  if(record.added&&value&&result&&!result.endsWith('\n\n'))result+='\n\n';
  result+=value;
 }
 return result;
}
export function createVisualEditor({root,getBody,request,onChange,onState,onImage}){
 let records=[],loaded=null,ticket=0,busy=false,loading=false;
 const changed=()=>{loaded=combineBlocks(records);onChange(loaded)};
 const lock=()=>{for(const record of records)if(record.element)record.element.contentEditable=record.editable&&!busy&&!loading?'true':'false'};
 const active=()=>{let node=document.getSelection()?.anchorNode;if(node?.nodeType===3)node=node.parentElement;const element=node?.closest?.('[data-visual-block]');return element&&root.contains(element)?element:null};
 const position=()=>{const element=active();let end=0;for(const record of records){end+=record.element&&record.element.innerHTML!==record.initial?blockMarkdown(record.element).length+2:record.raw.length;if(record.element===element)return end}return getBody().length};
 function add(record){
  const element=document.createElement('div');element.className='visual-block';element.dataset.visualBlock=String(records.length);element.innerHTML=record.html;
  record.element=element;record.initial=element.innerHTML;
  if(!record.editable){element.classList.add('visual-readonly');element.title='特殊语法保留原文，请切换 Markdown 修改。'}
  else{element.setAttribute('role','textbox');element.setAttribute('aria-label',record.type==='table'?'编辑表格':record.type==='code'?'编辑代码':'编辑正文区块');element.setAttribute('aria-multiline','true');element.spellcheck=false}
  if(!record.html){element.hidden=true;record.element=null}
  else root.append(element);
  records.push(record);lock();return element;
 }
 root.addEventListener('input',event=>{if(event.target.closest('[data-visual-block]')&&!busy&&!loading)changed()});
 root.addEventListener('click',event=>{if(event.target.closest('a'))event.preventDefault()});
 root.addEventListener('paste',event=>{
  event.preventDefault();if(busy||loading)return;
  const files=Array.from(event.clipboardData?.items||[]).filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);
  if(files.length){onImage(files,position());return}
  const text=event.clipboardData?.getData('text/plain')||'',selection=document.getSelection(),element=active();
  if(!element||element.contentEditable!=='true'||!selection?.rangeCount)return;
  // 不插入外部 HTML；优先保留浏览器撤销栈，不支持时用 Range 插入纯文本。
  if(typeof document.execCommand!=='function'||!document.execCommand('insertText',false,text)){const range=selection.getRangeAt(0);range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range)}
  changed();
 });
 root.addEventListener('dragover',event=>{if(Array.from(event.dataTransfer?.types||[]).includes('Files'))event.preventDefault()});
 root.addEventListener('drop',event=>{event.preventDefault();if(!busy&&!loading){const files=Array.from(event.dataTransfer?.files||[]);if(files.length&&files.every(file=>file.type.startsWith('image/')))onImage(files,position())}});
 return {
  async load(){
   const body=getBody();if(loaded===body)return;
   const id=++ticket;loading=true;lock();onState('正在准备可视化编辑…');
   try{
    const data=await request(body);if(id!==ticket||getBody()!==body)return;
    records=[];root.replaceChildren();for(const record of data.blocks)add({...record});
    if(!data.blocks.length)add({type:'paragraph',raw:'',html:'<p><br></p>',editable:true});
    loaded=body;onState('直接点击正文即可编辑');
   }catch(error){if(id===ticket){root.replaceChildren();records=[];loaded=null;onState('可视化加载失败：'+error.message+'，可切换 Markdown 继续编辑。')}}
   finally{if(id===ticket){loading=false;lock()}}
  },
  setBusy(value){busy=value;lock()},
  position,
  addParagraph(){if(busy||loading)return;const element=add({type:'paragraph',raw:'',html:'<p><br></p>',editable:true,added:true});element.focus();},
  format(command){if(busy||loading)return;const element=active();if(!element||element.contentEditable!=='true')return;if(element.querySelector('pre')&&command!=='undo'&&command!=='redo')return;const selection=document.getSelection(),range=selection?.rangeCount?selection.getRangeAt(0):null;if(!range||!element.contains(range.commonAncestorContainer))return;if(typeof document.execCommand!=='function'){onState('当前浏览器不支持此格式工具，请用 Markdown。');return}document.execCommand(command,false,null);changed()},
  invalidate(){loaded=null;ticket++;loading=false;records=[];root.replaceChildren()}
 };
}
