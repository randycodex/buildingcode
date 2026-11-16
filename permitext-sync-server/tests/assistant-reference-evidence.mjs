import assert from 'node:assert/strict';
import {assistantEvidencePackage} from '../assistant-conversation-scope.mjs';
import {assistantExplicitReferences, expandAssistantReferenceEvidence} from '../assistant-reference-evidence.mjs';
import {assistantEvidenceForTurn, researchCorpusResources, resolveResearchAssemblySection} from '../app.mjs';
import {createResearchCorpusRegistry} from '../research-corpus-registry.mjs';
import {immutableEvidenceSnapshot} from '../project-foundation-contract.mjs';
import {createHash} from 'node:crypto';

globalThis.fetch=()=>{throw Error('No external search or provider calls are allowed');};
const source={sourceID:'selection',sectionID:'primary',codePrefix:'FGC',sectionNumber:'308.3.2',corpusID:'fixture',
 codeVersion:'edition-2022',codeEdition:'2022',jurisdiction:'New York City',text:'Use Table 308.2.',
 canonicalText:'Use Table 999.9. SECRET_UNSELECTED',crossReferences:[{sectionNumber:'999.9'}]};
const base=()=>assistantEvidencePackage({question:'Explain these.',pinnedEvidence:[source]});
const canonical=(number,text,extra={})=>({...source,sectionID:`canonical-${number}`,sectionNumber:number,title:'Canonical rule',
 text,canonicalText:text,body:{blocks:[{plainText:text}]},...extra});
const table=canonical('308.2','Table 308.2\nMaterial | Clearance\nShield | 6\na. Keep the air gap.\nb. Retain access.',{
 richSources:[{kind:'table',reference:'FGC Table 308.2',text:'Material | Clearance\nShield | 6\na. Keep the air gap.\nb. Retain access.',
 grids:[{rows:[{cells:[{text:'Material'},{text:'Clearance'}]},{cells:[{text:'Shield'},{text:'6'}]}]}]}]});
const reads=[];
const packet=await expandAssistantReferenceEvidence({evidencePackage:base(),resolveReference:async request=>{reads.push(request);return table;}});
assert.equal(reads.length,1);assert.equal(reads[0].sectionNumber,'308.2');
assert.equal(packet.sources[0].text,source.text,'The attached selection is never widened');
assert(!JSON.stringify(packet).includes('SECRET_UNSELECTED'));
assert.equal(packet.sources[1].text,table.text);assert.equal(packet.sources[1].tables[0].grids[0].rows.length,2);
assert.equal(packet.referenceLookup.added[0].citationID,'S2');
assert.equal(packet.sources[1].origin,'permitext_cross_reference');
const grids=[{rows:[{cells:[{text:'',rowSpan:1,columnSpan:1},{text:'Clearance',rowSpan:1,columnSpan:1}]}]}];
const reference='FGC Table 308.2',text='Clearance';
const blankHeader=immutableEvidenceSnapshot({source:{...source,text,richSourceID:'blank-header',richSourceKind:'table',
 richSourceReference:reference,richSourceText:text,richSourceGrids:grids,richSourceRowCount:1,
 richSourceContentHash:createHash('sha256').update(JSON.stringify({reference,text,grids})).digest('hex')}});
assert.equal(blankHeader.structuredSource.grids[0].rows[0].cells[0].text,'','Empty header cells retain their exact grid position');
for(const override of [{codeVersion:'edition-2014'},{codePrefix:'MC'},{jurisdiction:'Other'},
 {corpusID:'other'},{codeEdition:'2014'},{sectionNumber:'308.2.1'},{truncated:true},
 {authorityClass:'guidance'},{body:{blocks:[{plainText:'Only a fragment.'}]}},
 {richSources:[{...table.richSources[0],text:table.text+' Missing footnote.'}]}]){
 const rejected=await expandAssistantReferenceEvidence({evidencePackage:base(),resolveReference:async()=>({...table,...override})});
 assert.equal(rejected.sources.length,1,JSON.stringify(override));assert.equal(rejected.referenceLookup.unresolved.length,1);
}
let forbiddenReads=0;
for(const text of ['Use BC Table 308.2.','Use New York City Building Code Table 308.2.','Use Plumbing Code Section 308.2.']){
 const other=await expandAssistantReferenceEvidence({evidencePackage:assistantEvidencePackage({question:'Explain these.',pinnedEvidence:[{...source,text}]}),
  resolveReference:async()=>{forbiddenReads++;return table;}});
 assert.equal(other.sources.length,1);assert(other.referenceLookup.unresolved.length);
}
const strict=await expandAssistantReferenceEvidence({evidencePackage:base(),selectedOnly:true,resolveReference:async()=>forbiddenReads++});
assert.equal(strict.sources.length,1);assert.equal(forbiddenReads,0);
assert.deepEqual(assistantExplicitReferences({...source,text:'Allow 308.2 feet; the question is not a source reference.'}),[]);
assert.deepEqual(new Set(assistantExplicitReferences({...source,text:'Sections 308.3.1 through 308.3.4.'}).map(ref=>ref.sectionNumber)),
 new Set(['308.3.1','308.3.2','308.3.3','308.3.4']));
const cycleSource={...source,text:'See Section 309.1.'};let cycleReads=0;
const cycle=await expandAssistantReferenceEvidence({evidencePackage:assistantEvidencePackage({question:'Explain these.',pinnedEvidence:[cycleSource]}),resolveReference:async request=>{
 cycleReads++;return canonical(request.sectionNumber,request.sectionNumber==='309.1'?'See Section 309.2.':'See Section 309.1.');}});
assert.equal(cycle.sources.length,3);assert.equal(cycleReads,2,'Cycles cannot cause unbounded retrieval');
const oversized=await expandAssistantReferenceEvidence({evidencePackage:assistantEvidencePackage({question:'Explain these.',pinnedEvidence:[cycleSource]}),
 resolveReference:async request=>canonical(request.sectionNumber,'Entire rule. '.repeat(2000))});
assert.equal(oversized.sources.length,1);assert.equal(oversized.referenceLookup.unresolved[0].reason,'complete_source_exceeds_budget');
const cancelled=new AbortController();cancelled.abort();
await assert.rejects(expandAssistantReferenceEvidence({evidencePackage:base(),signal:cancelled.signal,resolveReference:async()=>table}),{name:'AbortError'});

// Reproduce the reported passage against the real canonical 2022 library.
const corpus=createResearchCorpusRegistry().find(item=>item.id==='nyc-2022-construction-codes');
const {catalog}=await researchCorpusResources({selected:[corpus],passageSearch:false});
const selected=await resolveResearchAssemblySection({codePrefix:'FGC',sectionNumber:'308.3.2',corpusID:corpus.id,
 codeVersion:corpus.codeVersion,codeEdition:corpus.codeEdition},catalog);
const actual=await assistantEvidenceForTurn({question:'Explain these rules.',pinnedEvidence:[{...selected,sourceID:'actual-selection'}]});
assert.equal(actual.sources.length,2);assert.equal(actual.sources[1].sectionNumber,'308.2');
assert.equal(actual.sources[1].codeVersion,selected.codeVersion);assert.equal(actual.sources[1].codePrefix,'FGC');
assert.equal(actual.sources[0].text,selected.text);assert(actual.sources[1].tables.length);
assert.equal(actual.sources[1].tables[0].grids.reduce((sum,grid)=>sum+grid.rows.length,0),18);
for(const marker of 'abcdefghijk')assert(new RegExp(`\\b${marker}\\.\\s`).test(actual.sources[1].text),`Footnote ${marker} remains complete`);
const only=await assistantEvidenceForTurn({question:'Using only the selected passage, explain its wording.',pinnedEvidence:[{...selected,sourceID:'actual-selection'}]});
assert.equal(only.sources.length,1);assert.equal(only.referenceLookup.attemptedReads,0);
const noLookup=await assistantEvidenceForTurn({question:'Do not look up additional sources; explain this passage.',pinnedEvidence:[{...selected,sourceID:'actual-selection'}]});
assert.equal(noLookup.sources.length,1);assert.equal(noLookup.referenceLookup.attemptedReads,0);
console.log('PASS explicit reference evidence: real FGC table/18 grid rows/notes a–k, exact selections and editions, cross-code refusal, no broad search, completeness, cycles, budgets, cancellation and selected-only requests; paid calls: 0.');
