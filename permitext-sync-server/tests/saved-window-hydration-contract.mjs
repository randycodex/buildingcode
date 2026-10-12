import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.indexOf(`async function ${name}(`);
  const plain = start < 0 ? source.indexOf(`function ${name}(`) : start;
  assert(plain >= 0); return source.slice(plain, source.indexOf('\n}', plain) + 2);
}
const chapter = { id: 'pc-6', bodyContract: 2, codeVersion: '2022', sections: Array.from({length:150}, (_,i) => ({id:i+1, title:`Section ${i+1}`})) };
let windows = new Map(), exactCalls = 0, fail = false, version = '2022';
const context = vm.createContext({
  fetchChapter: async () => ({...chapter,codeVersion:version}),
  fetchChapterBodyWindow: async (_id,start,limit) => {
    if(fail) throw Error('CHAPTER_WINDOW_MISMATCH');
    const key = `${start}:${limit}`;
    if(!windows.has(key)) windows.set(key, {sections:chapter.sections.slice(start,start+limit).map(item => ({...item,blocks:[{text:`Canonical ${item.id}`}]}))});
    return windows.get(key);
  },
  syncCodeVersion: value => value,
  resolveSectionDetail: async () => {exactCalls++; return {section:{id:'fallback'}};}
});
vm.runInContext(['sectionRecordMatchesRequestedEdition','readerSectionWithWindowBody','resolveSavedSectionDetail'].map(actual).join('\n'),context);
const resolve = id => context.resolveSavedSectionDetail({chapterID:chapter.id,sectionID:id,codeVersion:'2022'});
const first = await Promise.all(Array.from({length:49},(_,i)=>resolve(i+1)));
assert.equal(windows.size,1); assert.equal(exactCalls,0);
assert.equal(first[48].section.blocks[0].text,'Canonical 49');
await Promise.all(Array.from({length:97},(_,i)=>resolve(i+1)));
assert.equal(windows.size,2,'97 rows use two stable windows, including reopen reuse');
version='2014'; await resolve(1); assert.equal(exactCalls,1,'Wrong edition falls back to exact edition-checked resolution');
version='2022'; await resolve(999); assert.equal(exactCalls,2,'Missing manifest target retains exact resolution');
fail=true; await resolve(1); assert.equal(exactCalls,3,'Revision mismatch retains recovery');
console.log('Saved canonical window hydration: bounded shared windows, reopen reuse, exact text, edition and revision recovery passed.');
