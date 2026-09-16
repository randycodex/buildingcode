import {readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {sharedChapterSlice} from './definition-audit-chapter-slice.mjs';

// Read-only corpus inventory. Counts candidate matches, not rendered links or
// semantic applicability; existing citation links remain excluded by the UI.
const root=fileURLToPath(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/',import.meta.url));
const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
const report={scope:'exact published terms and explicit aliases; candidate prose occurrences only',chapters:[],unmappedChapters:[],unmatchedTerms:[]};
const hits=new Map();
const excluded=new Set(['script','style','head','h1','h2','h3','h4','h5','h6','annotationdrawer','codeoptions']);
function prose(node){
 if(excluded.has(node.tagName))return '';
 if(node.nodeName==='#text')return node.value;
 return (node.childNodes||[]).map(prose).join(['p','li','td','th','div','section'].includes(node.tagName)?'\n':'');
}
for(const directory of await readdir(root,{withFileTypes:true})){
 if(!directory.isDirectory())continue;
 let bundle;
 try{bundle=JSON.parse(await readFile(path.join(root,directory.name,'bundle.json'),'utf8'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
 const matchers=new Map();
 for(const chapter of bundle.chapters){
  const context={bundle:directory.name,codeSectionID:chapter.codeSectionID,chapterNumber:chapter.chapterNumber};
  const key=`${chapter.codeSectionID}|${String(chapter.chapterNumber).match(/^[A-Z]/)?.[0]||'general'}`;
  if(!matchers.has(key))matchers.set(key,createDefinitionMatcher(definitionsForReader(registry,context)));
  const code=bundle.codeSections.find(c=>c.id===chapter.codeSectionID);
  const slug=code.slug||code.name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const prefix={'BUILDING CODE':'bc','PLUMBING CODE':'pc','MECHANICAL CODE':'mc','FUEL GAS CODE':'fgc','ADMINISTRATIVE PROVISIONS':'ac'}[code.name.toUpperCase()];
  const base=path.join(root,directory.name);
  const nested=path.join(base,'code-sections',slug,'chapters');
  let hasNested=false;
  try{await readdir(nested);hasNested=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  const candidates=[...[''+chapter.chapterNumber,'Chapter '+chapter.chapterNumber,'Appendix '+chapter.chapterNumber].map(n=>path.join(nested,n+'.html')),
   ...(!hasNested?(prefix?[path.join(base,'chapters',`${prefix}-${chapter.chapterNumber}.html`)]:[path.join(base,'chapters',chapter.id+'.html'),path.join(base,'chapters',chapter.chapterNumber+'.html')]):[])];
  let html,source;
  for(const file of candidates){try{html=await readFile(file,'utf8');source=file;break;}catch(error){if(error.code!=='ENOENT')throw error;}}
  let sharedChapter=false;
  if(!source&&hasNested&&/^[A-Z]+\d*$/i.test(String(chapter.chapterNumber))){
   const group=String(chapter.chapterNumber).match(/^([A-Z]+)\d+$/i);
   const file=path.join(nested,group?`${group[1].toUpperCase()}.html`:'Appendices.html');
   try{
    const slice=sharedChapterSlice(await readFile(file,'utf8'),chapter.chapterNumber);
    if(slice!==null){html=slice;source=file;sharedChapter=true;}
   }catch(error){if(error.code!=='ENOENT')throw error;}
  }
  if(!source){report.unmappedChapters.push({...context,code:code.name});continue;}
  // Exclude the definition chapter itself when measuring occurrences elsewhere.
  const entries=definitionsForReader(registry,context);
  const sourceRelative=path.relative(root,source);
  const isDefinitionChapter=registry.books.some(book=>book.bundle===context.bundle&&String(book.codeSectionID)===String(context.codeSectionID)&&String(book.definitionChapter)===String(context.chapterNumber));
  const matches=isDefinitionChapter?[]:matchers.get(key)(prose(parse(html)));
  let outside=0,unresolved=0;
  for(const match of matches){
   const applicable=match.entries.filter(e=>e.source.file!==sourceRelative);
   if(!applicable.length)continue;
   outside++;
   if(applicable.some(e=>['unresolved-reference','ambiguous-reference'].includes(e.resolution)))unresolved++;
   for(const entry of applicable)hits.set(entry.id,(hits.get(entry.id)||0)+1);
  }
  report.chapters.push({...context,code:code.name,source:sourceRelative,sharedChapter,eligibleDefinitions:entries.length,candidateOccurrences:outside,unresolvedOccurrences:unresolved});
 }
}
for(const book of registry.books)for(const entry of book.entries){
 if(entry.applicability==='definition-chapter'&&!hits.has(entry.id))report.unmatchedTerms.push({bundle:book.bundle,code:book.code,term:entry.term,id:entry.id});
}
const output=process.argv[2]||'/tmp/permitext-definition-occurrences.json';
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,chapters:report.chapters.length,unmappedChapters:report.unmappedChapters.length,chaptersWithoutEligibleDefinitions:report.chapters.filter(c=>!c.eligibleDefinitions).length,candidateOccurrences:report.chapters.reduce((n,c)=>n+c.candidateOccurrences,0),unresolvedOccurrences:report.chapters.reduce((n,c)=>n+c.unresolvedOccurrences,0),unmatchedTerms:report.unmatchedTerms.length},null,2));
