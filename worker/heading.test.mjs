import test from "node:test";
import assert from "node:assert/strict";
import {headingEntries,findChapter} from "../assets/heading-links.mjs";
const h=(level,text)=>({tagName:"H"+level,textContent:text});
test("all heading levels retain relative hierarchy and safe unique identifiers",()=>{
 const entries=headingEntries([h(1,"标题"),h(2,"章节"),h(3,"子节"),h(4,"详情"),h(5,"细节"),h(6,"补充"),h(2,"章节"),h(2,"!!!")],["section-标题"]);
 assert.deepEqual(entries.map(e=>e.depth),[0,1,2,3,4,5,1,1]);
 assert.equal(entries[0].id,"section-标题-2");assert.equal(entries[6].id,"section-章节-2");assert.equal(entries[7].id,"section-chapter");
 assert.equal(new Set(entries.map(e=>e.id)).size,8);
});
test("links survive unrelated insertion and support encoded Chinese and legacy H2/H3 indices",()=>{
 const original=headingEntries([h(2,"开始"),h(3,"用法")]);
 const entries=headingEntries([h(1,"文档"),h(2,"开始"),h(4,"其他"),h(3,"用法")]);
 assert.equal(original[1].id,entries[3].id);
 assert.equal(findChapter("#"+encodeURIComponent(entries[3].id),entries),entries[3]);
 assert.equal(findChapter("#reading-section-1",entries),entries[3]);
 assert.equal(findChapter("#reading-section-999",entries),null);
 assert.equal(findChapter("#%broken",entries),null);assert.equal(findChapter("#contact",entries),null);
});
test("reinitialization stays deterministic; Unicode normalization handles equivalent titles",()=>{
 const headings=[h(2,"Ａ B"),h(3,"a b")];const a=headingEntries(headings);
 assert.deepEqual(a.map(e=>e.id),["section-a-b","section-a-b-2"]);
 assert.deepEqual(headingEntries(headings).map(e=>e.id),a.map(e=>e.id));
 assert.deepEqual(headingEntries([]),[]);
});
