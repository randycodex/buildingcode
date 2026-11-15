import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {constructionHTMLBodyStatusForSection} from '../construction-html-content.mjs';

const baseline = process.argv[process.argv.indexOf('--baseline') + 1];
assert(process.argv.includes('--baseline') && baseline, 'Pass --baseline <commit>.');
const repo = fileURLToPath(new URL('../../', import.meta.url));
const contentPath = 'NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2022-construction-codes/';
const root = new URL(`../../${contentPath}`, import.meta.url);
const git = args => execFileSync('git', args, {cwd:repo,maxBuffer:64*1024*1024});
const oldJSON = path => JSON.parse(git(['show',`${baseline}:${path}`]).toString());
const readJSON = async path => JSON.parse(await readFile(path,'utf8'));
const oldCompact = oldJSON(contentPath+'prepared/chapterCatalog.json');
const compact = await readJSON(new URL('prepared/chapterCatalog.json',root));
const sectionMap = catalog => new Map(catalog.chapters.flatMap(([chapterID,groups]) =>
  groups.flatMap(group => group[5].map(section => [section[0],{chapterID,section}]))));
const oldSections = sectionMap(oldCompact), sections = sectionMap(compact);
for (const [id,value] of oldSections) assert.deepEqual(sections.get(id),value,`Existing section ${id} changed identity or metadata.`);
const oldIDs = oldJSON('permitext-sync-server/config/canonical-section-ids.json');
const ids = await readJSON(new URL('../config/canonical-section-ids.json',import.meta.url));
for (const [key,id] of Object.entries(oldIDs.byCodeChapterSection)) assert.equal(ids.byCodeChapterSection[key],id,`Existing canonical ID changed: ${key}.`);
assert.deepEqual(ids.legacyWebSectionID,oldIDs.legacyWebSectionID,'Legacy citations must keep their identities.');
const sourceChanges = git(['diff','--name-only',baseline,'--',contentPath+'chapters',contentPath+'code-sections']).toString().trim();
assert.equal(sourceChanges,'','Authoritative chapter HTML must remain unchanged.');
assert.equal(git(['diff','--name-only',baseline,'--','NYC CC APP/NYCCCApp/Resources/CodeContent']).toString().trim(),'','Legacy source content must remain unchanged.');

const manifest = await readJSON(new URL('prepared/manifest.json',root));
const prefixes = {1:'BC',3:'AC',4:'FGC',5:'PC',6:'MC'};
const rows = new Map();
for (const chapter of manifest.chapters) {
  const data = await readJSON(new URL(`prepared/chapters/${chapter.chapterID}.json`,root));
  for (const section of data.groups.flatMap(group=>group.sections)) rows.set(section.id,{...section,chapterID:chapter.chapterID,chapterNumber:chapter.chapterNumber,codePrefix:prefixes[chapter.codeSectionID]});
}
const ranges = new Map(), currentTables = new Set();
const hash = text => createHash('sha256').update(text).digest('hex');
function tables(html) {
  const stack=[],out=[];
  for (const match of html.matchAll(/<\/?table\b[^>]*>/gi)) {
    if (/^<table/i.test(match[0])) stack.push(match.index);
    else {const start=stack.pop();assert.notEqual(start,undefined,'Unbalanced table close.');out.push(html.slice(start,match.index+match[0].length));}
  }
  assert.equal(stack.length,0,'Unbalanced table open.');return out;
}
for (const name of await readdir(new URL('prepared/sections/',root))) {
  if (!/^\d+\.json$/.test(name)) continue;
  const body = await readJSON(new URL(`prepared/sections/${name}`,root));
  if (!body.sourceHTMLPath) continue;
  const status = await constructionHTMLBodyStatusForSection(rows.get(body.sectionID),{includeOfficialSourceBinding:true});
  assert(status.body,`Missing fresh body ${body.sectionID}.`);
  const {officialSourceBinding:binding,...fresh} = status.body;
  assert.deepEqual(body,fresh,`Derived body ${body.sectionID} is stale.`);
  const intervals = ranges.get(body.sourceHTMLPath) || [];
  intervals.push(binding.sourceHTMLRange);ranges.set(body.sourceHTMLPath,intervals);
  for (const block of body.blocks) for (const table of tables(block.html || '')) currentTables.add(hash(table));
}
for (const intervals of ranges.values()) intervals.sort((left,right)=>left.start-right.start);
const changed = git(['diff','--name-only','--diff-filter=MD',baseline,'--',contentPath+'prepared/sections']).toString().trim().split('\n').filter(Boolean);
const changedIDs = new Set(changed.map(path => Number(path.match(/\/(\d+)\.json$/)[1])));
const originalBodyFiles = new Set(git(['ls-tree','-r','--name-only',baseline,'--',contentPath+'prepared/sections']).toString().trim().split('\n'));
for (const name of await readdir(new URL('prepared/sections/',root))) {
  if (/^\d+\.json$/.test(name) && !originalBodyFiles.has(contentPath+'prepared/sections/'+name)) changedIDs.add(Number.parseInt(name));
}
let preservedTables = 0;
for (const path of changed) {
  const old = oldJSON(path);assert(old.sourceHTMLPath,`Hand-authored body changed: ${path}.`);
  const source = await readFile(new URL(old.sourceHTMLPath,root),'utf8');
  for (const block of old.blocks) {
    const html = block.html || '';if (!html) continue;
    const start = source.indexOf(html);assert(start>=0,`Original body ${old.sectionID} is not an exact bundled-source slice.`);
    const end = start+html.length;let cursor=start;const gaps=[];
    for (const interval of ranges.get(old.sourceHTMLPath) || []) {
      if(interval.end<=cursor || interval.start>=end)continue;
      if(interval.start>cursor)gaps.push(source.slice(cursor,Math.min(interval.start,end)));
      cursor=Math.max(cursor,interval.end);if(cursor>=end)break;
    }
    if(cursor<end)gaps.push(source.slice(cursor,end));
    const missingText=gaps.join('').replace(/<h6\b[^>]*>[\s\S]*?<\/h6>/gi,' ')
      .replace(/<!--[\s\S]*?-->/g,' ').replace(/<[^>]+>/g,' ').replace(/&#160;|&nbsp;/gi,' ').replace(/\s+/g,' ').trim();
    assert.equal(missingText,'',`Code text was removed from ${old.sectionID}: ${missingText.slice(0,200)}`);
    for (const table of tables(html)) {assert(currentTables.has(hash(table)),`A table from ${old.sectionID} was lost or changed.`);preservedTables++;}
  }
}
const oldTextIndex = oldJSON(contentPath+'prepared/searchTextIndex.json');
const oldText = git(['show',`${baseline}:${contentPath}prepared/searchText.utf8`]);
const textIndex = await readJSON(new URL('prepared/searchTextIndex.json',root));
const text = await readFile(new URL('prepared/searchText.utf8',root));
let unchangedNativeTexts = 0;
for (const [id,[start,length]] of Object.entries(oldTextIndex.sections)) {
  const range = textIndex.sections[id];
  assert(range,`Native search lost existing section ${id}.`);
  if (!changedIDs.has(Number(id))) {
    assert(oldText.subarray(start,start+length).equals(text.subarray(range[0],range[0]+range[1])),`Unrelated native text changed for ${id}.`);
    unchangedNativeTexts++;
  }
}
console.log(JSON.stringify({baseline,existingSectionIdentitiesPreserved:oldSections.size,newSections:sections.size-oldSections.size,
  refreshedDerivedBodies:changed.length,originalTablesPreservedByteForByte:preservedTables,
  unrelatedNativeTextsPreservedByteForByte:unchangedNativeTexts,authoritativeSourceFilesChanged:0,codeTextLost:false},null,2));
