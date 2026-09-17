import {readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {definitionAuditProse,definitionAuditScopedPassages} from './definition-audit-prose.mjs';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
import {definitionsForReader,definitionSourceIdentity} from '../public/reader-definition-registry.js';
import {sharedChapterSlice} from './definition-audit-chapter-slice.mjs';
import {discoverDefinitionSections} from './definition-section-discovery.mjs';

// Read-only corpus inventory. Counts candidate matches, not rendered links or
// semantic applicability; existing citation links remain excluded by the UI.
const root=fileURLToPath(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/',import.meta.url));
const registryText=await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8');
const registry=JSON.parse(registryText);
const report={registrySHA256:createHash('sha256').update(registryText).digest('hex'),scope:'exact published terms and explicit aliases; candidate prose occurrences only',chapters:[],unmappedChapters:[],unmatchedTerms:[],unresolvedTerms:[]};
const hits=new Map();
for(const directory of await readdir(root,{withFileTypes:true})){
 if(!directory.isDirectory())continue;
 let bundle;
 try{bundle=JSON.parse(await readFile(path.join(root,directory.name,'bundle.json'),'utf8'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
 const matchers=new Map();
 for(const chapter of bundle.chapters){
  const context={bundle:directory.name,codeSectionID:chapter.codeSectionID,chapterNumber:chapter.chapterNumber};
  const key=`${chapter.codeSectionID}|${chapter.chapterNumber}`;
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
  const entries=definitionsForReader(registry,{...context,includeSectionScoped:true});
  const sourceRelative=path.relative(root,source);
  const isDefinitionChapter=registry.books.some(book=>book.excludeWholeChapter!==false&&book.bundle===context.bundle&&String(book.codeSectionID)===String(context.codeSectionID)&&String(book.definitionChapter)===String(context.chapterNumber));
  const sectionScoped=entries.some(e=>e.applicableSections||e.excludedSections||e.excludedExactSections||e.excludedOccurrences);
  const matches=isDefinitionChapter?[]:sectionScoped
    ? definitionAuditScopedPassages(html).flatMap(passage=>createDefinitionMatcher(definitionsForReader(registry,{...context,sectionNumber:passage.sectionNumber}),{sectionNumber:passage.sectionNumber})(passage.text))
    : matchers.get(key)(definitionAuditProse(html));
  let outside=0,unresolved=0;
  for(const match of matches){
   const applicable=match.entries;
   if(!applicable.length)continue;
   outside++;
   if(applicable.some(e=>['unresolved-reference','ambiguous-reference'].includes(e.resolution)))unresolved++;
   for(const entry of applicable)hits.set(entry.id,(hits.get(entry.id)||0)+1);
  }
  const indexedCode = registry.books.some(book => book.bundle === context.bundle && String(book.codeSectionID) === String(context.codeSectionID));
  const scopedCode = registry.books.some(book => book.bundle === context.bundle && String(book.codeSectionID) === String(context.codeSectionID)
   && book.entries.some(e=>e.applicableChapters));
  const coveredAnchors=new Set(registry.books.flatMap(b=>b.entries).filter(e=>e.source.file===sourceRelative).map(e=>e.source.anchor));
  const pendingScope = registry.books.some(book => book.bundle === context.bundle && String(book.codeSectionID) === String(context.codeSectionID)
   && book.entries.some(e=>e.applicability==='review-required'));
  const discoveryNeeded=!indexedCode||scopedCode||pendingScope;
  report.chapters.push({...context,code:code.name,source:sourceRelative,sharedChapter,indexedCode,discoveryNeeded,
   unindexedDefinitionSections:discoveryNeeded ? discoverDefinitionSections(html).filter(s=>!s.anchor||!coveredAnchors.has(s.anchor)) : [],
   eligibleDefinitions:entries.length,candidateOccurrences:outside,unresolvedOccurrences:unresolved});
 }
}
// A general reference and an appendix entry can identify the same source.
// Selection deliberately renders it once; both index records are represented.
const representedSources=new Map();
for(const book of registry.books)for(const entry of book.entries){
 const sourceIdentity=definitionSourceIdentity(entry);
 const identity=sourceIdentity ? JSON.stringify([book.bundle,book.codeSectionID,sourceIdentity]) : null;
 if(identity&&hits.has(entry.id))representedSources.set(identity,Math.max(representedSources.get(identity)||0,hits.get(entry.id)));
}
for(const book of registry.books)for(const entry of book.entries){
 const count=representedSources.get(JSON.stringify([book.bundle,book.codeSectionID,definitionSourceIdentity(entry)]));
 if(count&&!hits.has(entry.id))hits.set(entry.id,count);
}
for(const book of registry.books)for(const entry of book.entries){
 if(entry.applicability==='definition-chapter'&&!hits.has(entry.id))report.unmatchedTerms.push({bundle:book.bundle,code:book.code,term:entry.term,id:entry.id});
 if(entry.applicability==='definition-chapter'&&['unresolved-reference','ambiguous-reference'].includes(entry.resolution))report.unresolvedTerms.push({bundle:book.bundle,code:book.code,scope:book.scope,term:entry.term,id:entry.id,resolution:entry.resolution,candidateOccurrences:hits.get(entry.id)||0,referenceText:entry.referenceText||entry.text,source:entry.source});
}
report.unresolvedTerms.sort((a,b)=>b.candidateOccurrences-a.candidateOccurrences||a.id.localeCompare(b.id));
const output=process.argv[2]||'/tmp/permitext-definition-occurrences.json';
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,chapters:report.chapters.length,unmappedChapters:report.unmappedChapters.length,chaptersWithoutEligibleDefinitions:report.chapters.filter(c=>!c.eligibleDefinitions).length,candidateOccurrences:report.chapters.reduce((n,c)=>n+c.candidateOccurrences,0),unresolvedOccurrences:report.chapters.reduce((n,c)=>n+c.unresolvedOccurrences,0),unmatchedTerms:report.unmatchedTerms.length},null,2));
