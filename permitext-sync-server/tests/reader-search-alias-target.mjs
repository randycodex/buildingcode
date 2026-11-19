import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('function savedReaderTarget('),end=source.indexOf('\n}',start);
const paragraph={textContent:'mixed on site if the total quantity of concrete is less than or equal to one and one half cubic yards (1.146 m 3 ), or'};
const block={querySelector:()=>paragraph};
const section={dataset:{sectionAliases:'114 115'},querySelector:()=>({textContent:'SECTION 202: Definitions'}),querySelectorAll:()=>[block]};
const content={querySelector:selector=>selector.includes('section-aliases')?section:null};
const c=vm.createContext({normalizeAnnotationBlockID:id=>id||'',CSS:{escape:value=>value},readerSectionTitleNode:()=>({textContent:'SECTION 202: Definitions'})});
vm.runInContext(source.slice(start,end+2),c);
const result={sectionID:'114',title:'1.1. '+paragraph.textContent};
assert.equal(c.savedReaderTarget(content,result),section,'Whole-section bookmarks keep their heading target');
assert.equal(c.savedReaderTarget(content,result,{preferPassage:true}),block,'Search reveals the exact numbered item inside Definitions');
assert.equal(c.savedReaderTarget(content,{...result,title:'1.1. An unrelated source clause that is not in the text'},{preferPassage:true}),section,'Missing exact passage falls back to its owning section');
assert.equal(c.savedReaderTarget(content,result,{preferPassage:true,wholeSection:true}),block,'A saved alias still selects only its own text');
const otherPermits = {sectionID:'11761',sectionNumber:'106.6',title:'106.6 Other permits.'};
const heading = {textContent:otherPermits.title};
const subsection = {dataset:{},querySelector:()=>heading,querySelectorAll:()=>[block]};
const plumbing = {querySelector:selector=>selector.includes('block-id') ? block :
  selector.includes('11761') || selector.includes('106.6') ? subsection : null};
c.readerSectionTitleNode = node => node?.querySelector('.reader-section-title');
assert.equal(c.savedReaderTarget(plumbing,otherPermits,{preferPassage:true}),heading);
assert.equal(c.savedReaderTarget(plumbing,otherPermits,{preferPassage:true,wholeSection:true}),subsection,
  'Whole Plumbing § 106.6 highlights the heading and all of its paragraphs');
assert.equal(c.savedReaderTarget(plumbing,{...otherPermits,blockID:'permit-list'},{preferPassage:true}),block,
  'An individually saved paragraph still highlights only its block');
console.log('Search alias targeting preserves bookmark behavior and reveals the complete matching passage.');
