import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {evidenceComments,serializeEvidenceComments} from '../public/evidence-comments.js';
import {syncCodeVersion,defaultSyncCodeVersion,historicalConstructionSyncCodeVersion} from '../public/sync-identity.js';
import {bulkClearTimestamp,indexBulkClears} from '../public/sync-state.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);};
const target={sectionID:101,codeVersion:defaultSyncCodeVersion,blockID:'paragraph'};
const body=serializeEvidenceComments(['First comment','Second comment']);
const remote=[{...target,id:'server-normalized-id',noteBody:body,tags:[],updatedAt:'2026-10-21T18:00:00Z'},
  {...target,id:'other-passage',blockID:'other',noteBody:'Unchanged other passage',tags:[],updatedAt:'2026-10-21T18:00:00Z'}];
const state={localAnnotations:[{...target,id:'web-local-id',noteBody:'',tags:[],deletedAt:'2026-10-21T18:01:00Z',updatedAt:'2026-10-21T18:01:00Z'}]};
let reads=0,flush;
const c=vm.createContext({state,evidenceComments,syncCodeVersion,defaultSyncCodeVersion,bulkClearTimestamp,indexBulkClears,
 currentBulkClearRecords:()=>[],queueMicrotask:fn=>{flush=fn;},
 // The UI summary intentionally omits deleted records; the pending tombstone
 // still needs to suppress an older server record with a different ID.
 currentContentSummary:()=>{reads++;return {annotations:[...remote,...state.localAnnotations.filter(item=>!item.deletedAt)]};}});
vm.runInContext('let readerCommentIndex=null;\n'+['normalizeAnnotationBlockID','normalizeAnnotationTags','annotationRecordsForTarget','annotationForTarget',
 'annotationEvidenceIsVisible','consolidatedSavedAnnotations','visibleSyncedTargetKey','readerCommentCount'].map(actual).join('\n'),c);
assert.equal(c.readerCommentCount(target),0,'Final-comment deletion hides the Reader indicator before network sync');
assert.equal(c.readerCommentCount({...target,blockID:'other'}),1,'Other passages retain their comment indicator');
assert.equal(reads,1,'All visible controls share one comment snapshot');
state.localAnnotations=[{...target,id:'web-local-id',noteBody:body,tags:[],deletedAt:null,updatedAt:'2026-10-21T18:02:00Z'}];flush();
assert.equal(c.readerCommentCount(target),2,'Undo restores the Reader count before network sync');
assert.equal(c.readerCommentCount({...target,codeVersion:historicalConstructionSyncCodeVersion}),0,'Edition stays exact');
assert.equal(c.readerCommentCount({...target,blockID:''}),0,'Section and paragraph comments remain distinct');
assert.equal(reads,2);
state.localAnnotations=[{...state.localAnnotations[0],noteBody:'First comment',updatedAt:'2026-10-21T18:03:00Z'}];flush();
assert.equal(c.readerCommentCount(target),1,'Deleting one of several comments updates the count immediately');
console.log('Reader comments: immediate final deletion/Undo, current count, unchanged other passages, exact edition/scope and one snapshot per batch passed');
