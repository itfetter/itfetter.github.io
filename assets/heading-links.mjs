export function headingEntries(headings,reserved=[]){
 const used=new Set(reserved),base=Math.min(...headings.map(h=>Number(h.tagName.slice(1))));
 return headings.map(h=>{
 const stem="section-"+(h.textContent.normalize("NFKC").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-|-$/g,"")||"chapter");
 let id=stem,n=2;while(used.has(id))id=stem+"-"+n++;used.add(id);
 return {heading:h,id,depth:Math.max(0,Number(h.tagName.slice(1))-base)};
 });
}
export function findChapter(hash,entries){
 let id;try{id=decodeURIComponent(hash.replace(/^#/,""))}catch{return null}
 const legacy=/^reading-section-(\d+)$/.exec(id);
 return legacy?entries.filter(e=>/^H[23]$/.test(e.heading.tagName))[Number(legacy[1])]||null:entries.find(e=>e.id===id)||null;
}
