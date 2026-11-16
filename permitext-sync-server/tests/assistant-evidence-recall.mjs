import assert from 'node:assert/strict';
import {restoreAssistantEvidence} from '../assistant-evidence-recall.mjs';
const snapshot={sourceLibraryVersion:'edition-1',sourceID:'prior-source',passageText:'First complete definition.\n\nThird complete definition.'};
const canonical={codeVersion:'edition-1',canonicalText:'First complete definition. Second definition. Third complete definition.',text:'Truncated first definition.',visualSources:[{id:'unselected-diagram'}]};
const restored=await restoreAssistantEvidence(snapshot,canonical,{loadVisual:()=>assert.fail('Unselected metadata must not be hydrated')});
assert.equal(restored.text,snapshot.passageText);assert.deepEqual(restored.visualSources,[]);
assert.equal(await restoreAssistantEvidence(snapshot,{...canonical,codeVersion:'edition-2'}),null);
assert.equal(await restoreAssistantEvidence(snapshot,{...canonical,canonicalText:'First changed definition. Third complete definition.'}),null);
const visual={id:'selected',contentHash:'hash'};let loaded=0;
const result=await restoreAssistantEvidence({...snapshot,visualSources:[visual]},{...canonical,visualSources:[visual]},{loadVisual:async v=>{loaded++;return {...v,dataBase64:'actual-binary'};}});
assert.equal(loaded,1);assert.equal(result.visualSources[0].dataBase64,'actual-binary');
assert.equal(await restoreAssistantEvidence({...snapshot,visualSources:[visual]},canonical),null);
console.log('Assistant recall: exact composite excerpts, edition/content checks, selected binary hydration and unselected diagram exclusion passed.');
// A recalled standards table must remain a valid immutable grid, including
// blank/spanning headers and footnotes, rather than a flattened replacement.
const {createHash}=await import('node:crypto');
const {immutableEvidenceSnapshot}=await import('../project-foundation-contract.mjs');
const text='Protection table. Footnote a: maintain a ventilated air gap.';
const grids=[{rows:[{cells:[{text:'',rowSpan:2,columnSpan:1},{text:'Clearance',rowSpan:1,columnSpan:2}]},{cells:[{text:'Above',rowSpan:1,columnSpan:1},{text:'Side',rowSpan:1,columnSpan:1}]}]}];
const rich={id:'table-1',kind:'table',reference:'Table example',text,grids,rowCount:2,contentHash:createHash('sha256').update(JSON.stringify({reference:'Table example',text,grids})).digest('hex')};
const tableSource={...canonical,sectionID:'section-1',codeEdition:'Test edition',codePrefix:'TEST',text,canonicalText:text,visualSources:[],richSources:[rich]};
const table=await restoreAssistantEvidence({...snapshot,passageText:text,structuredSource:rich},tableSource);
const frozen=immutableEvidenceSnapshot({source:table,sourceLibraryVersion:'edition-1'});
assert.deepEqual(frozen.structuredSource.grids,grids);assert.match(frozen.structuredSource.text,/Footnote a/);
assert.equal(await restoreAssistantEvidence({...snapshot,passageText:text,structuredSource:{...rich,contentHash:'changed'}},tableSource),null);
console.log('Assistant recall: table grids, blank/spanning headers, footnotes and structured integrity passed.');
