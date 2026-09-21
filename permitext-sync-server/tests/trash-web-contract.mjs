import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as identity from '../public/sync-identity.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const between=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const preflightSource=between('async function prepareRecoverableDeletion()', 'function attachSettingsTrash(');
async function preflight(state, post=async()=>({entries:[]})) {
 const values={state,requirePrivateWorkspaceWritable(){},captureAccountRequest(){return 'owner';},activeAccount(){return {userID:'owner'};},flushSyncOutbox:async()=>{},requireCurrentAccountRequest(){},loadSyncedContent:async()=>{},postResearch:post};
 return new Function(...Object.keys(values),preflightSource+';return prepareRecoverableDeletion();')(...Object.values(values));
}
await assert.rejects(preflight({syncOutbox:[{accountUserID:'owner'}]}),/Finish syncing/);
await assert.rejects(preflight({syncConflicts:[{accountUserID:'owner'}]}),/resolve sync conflicts/);
await assert.rejects(preflight({},async()=>{throw new Error('Recovery service unavailable')}),/unavailable/);
await preflight({syncOutbox:[{accountUserID:'other'}]});
const allCodesSource=between('function enqueueSettingsClearForAllCodes(', 'let openTrashAfterSettingsDeletion');
const notesSource=between('async function clearSettingsNotes()', 'async function performSettingsClearAction(');
const annotations=[
 {id:'2022-note',sectionID:545,codeVersion:identity.defaultSyncCodeVersion,noteBody:'One',tags:['Keep']},
 {id:'2014-note',sectionID:545,codeVersion:identity.historicalConstructionSyncCodeVersion,noteBody:'Two',tags:['Keep']},
 {id:'tag-only',sectionID:2,codeVersion:identity.defaultSyncCodeVersion,noteBody:'',tags:['Keep']}
];
const state={localAnnotations:structuredClone(annotations),sectionNotes:{545:'One'}};
const clears=[];
const values={...identity,state,crypto,requirePrivateWorkspaceWritable(){},captureAccountRequest(){return 'owner'},requireCurrentAccountRequest(){},currentContentSummary(){return {annotations}},normalizeAnnotationBlockID:id=>id||'',enqueueSettingsBulkClear(scope,options){clears.push({scope,...options})},saveWorkspaceState(){},activeAccount(){return {userID:'owner'}},flushSyncOutbox:async()=>{}};
const count=await new Function(...Object.keys(values),allCodesSource+notesSource+';return clearSettingsNotes();')(...Object.values(values));
assert.equal(count,2,'Same section in two editions is two independent notes');
assert.equal(new Set(clears.map(c=>c.codeVersion)).size,6);
assert.equal(new Set(clears.map(c=>c.operationGroupID)).size,1,'One deletion stays in one sync operation');
assert(state.localAnnotations.every(a=>a.noteBody===''));
assert(state.localAnnotations.every(a=>a.tags[0]==='Keep'));
console.log('Web Trash preflight and all-edition note cleanup passed.');
