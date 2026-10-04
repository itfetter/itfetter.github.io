import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
function cleanHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    allowedAttributes: {
      a: ['href', 'title', 'rel'], img: ['src', 'alt', 'title'],
      div: ['class'], span: ['class'], code: ['class'], th: ['align'], td: ['align']
    },
    allowedClasses: { div: ['callout'], span: ['text-accent'], code: ['language-*'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', {rel: 'noopener noreferrer'}) }
  });
}

export function renderMarkdown(body) {return cleanHtml(marked.parse(body));}

// 保留原始区块与位置；未编辑的内容不经过 HTML→Markdown 重写。
export function editorBlocks(body) {
 const normal=body.replace(/\r\n?/g,'\n'),offsets=[];let original=0;
 for(let i=0;i<normal.length;i++){offsets.push(original);original+=body[original]==='\r'&&body[original+1]==='\n'?2:1}
 offsets.push(body.length);
 const tokens=marked.lexer(normal),blocks=[];let cursor=0;
 const hasHtml=t=>(t.type==='html'&&!/^<br\s*\/?\s*>$/i.test(t.raw.trim()))||t.task===true||(t.tokens||[]).some(hasHtml)||(t.items||[]).some(hasHtml)||(Array.isArray(t.header)?t.header:[]).some(hasHtml)||(Array.isArray(t.rows)?t.rows:[]).flat().some(hasHtml);
 const gap=(start,end)=>{if(end>start)blocks.push({type:'source',raw:body.slice(offsets[start],offsets[end]),html:'',editable:false})};
 for(const token of tokens){
  const at=normal.indexOf(token.raw,cursor);
  // 对无法精确映射的语法只读展示，原文始终保留。
  if(at<0)return [{type:'html',raw:body,html:renderMarkdown(body),editable:false}];
  gap(cursor,at);const end=at+token.raw.length;
  blocks.push({type:token.type,raw:body.slice(offsets[at],offsets[end]),html:cleanHtml(marked.parser(Object.assign([token],{links:tokens.links}))),editable:['paragraph','heading','blockquote','list','table','code'].includes(token.type)&&!hasHtml(token)});
  cursor=end;
 }
 gap(cursor,normal.length);
 return blocks;
}
