import assert from 'node:assert/strict';
import {sharedWorkspaceLayout, mergeWorkspaceLayouts, applySharedWorkspaceLayout, isWorkspaceLayoutOnlyMutation, onlyWorkspaceLayoutsChanged, workspaceLayoutsKey} from '../public/workspace-layout-sync.js';
import {mergeContinuityRecords} from '../continuity-merge.mjs';
const project = {id:'p', clientID:'p', name:'Project'};
const local = {projectDetails:[project], projectDetail:project,
  readers:[{id:'r',chapterID:1,sectionID:2,codePrefix:'BC',codeVersion:'v',body:'PRIVATE BODY',internalSearchQuery:'PRIVATE SEARCH'}],
  utilityInstances:[{id:'s',key:'search',query:'PRIVATE QUERY'},{id:'a',key:'analysis',draft:'PRIVATE DRAFT',conversationID:'c'}],
  utilities:{analysis:true},notebooks:[project],reportDrafts:[],notebookColumns:[{id:'n',projectID:'p',cardID:'card'},{id:'draft',projectID:'p',newNote:true}],
  paneOrder:['reader:r','utility:search:s'],paneWeights:{'reader:r':720.3,'utility:search:s':610},
  researchViewState:{drafts:{a:'PRIVATE DRAFT'},draftPaneIDs:['draft'],conversationOpen:true,supplementalIDs:['c']},
  codeQuestionWorkspace:{activeQuestionID:'q',activeStage:'evidence',openPanes:[{projectID:'p',questionID:'q',paneRole:'reader',paneID:'cq:p:q:reader'}],definitionsByQuestionID:{q:{text:'PRIVATE DEFINITION'}}},
  workflowPaneWeights:{research:{'reader:r':720}},workflowMembership:{'reader:r':['research']},
  sectionDetails:{s:{blocks:['PRIVATE BODY']}},searchQuery:'PRIVATE SEARCH',trackScrollLeft:500};
const layout = sharedWorkspaceLayout(local);
assert(!JSON.stringify(layout).includes('PRIVATE'));
assert(!('trackScrollLeft' in layout));
assert.equal(layout.notebookColumns.length,1);
assert.equal(layout.paneWeights['reader:r'],720);
assert.deepEqual(sharedWorkspaceLayout(layout),layout,'Projection is stable and idempotent');
const record={id:'project:p',projectID:'p',updatedAt:'2026-10-23T12:00:00Z',layout};
const newer={...record,updatedAt:'2026-10-23T12:00:01Z',layout:{...layout,paneOrder:[...layout.paneOrder].reverse(),paneWeights:{'reader:r':810}}};
const a=mergeWorkspaceLayouts([record],[newer]);
assert.equal(a[0].layout.paneWeights['reader:r'],810);
assert.deepEqual(a,mergeWorkspaceLayouts([newer],[record]));
assert.deepEqual(mergeWorkspaceLayouts('bad',{},[{...record,id:'other'}]),[]);
assert.deepEqual(mergeWorkspaceLayouts([newer],[record]),a,'A stale device cannot restore a removed column');
const aliasedProject={...project,id:'record-p',clientID:'p'};
const aliasedRecord={...a[0],id:'project:record-p',projectID:'record-p'};
const aliased=applySharedWorkspaceLayout(local,aliasedRecord,aliasedProject);
assert.equal(aliased.notebookColumns[0].cardID,'card','Notebook columns retain stable client identity aliases');
assert.equal(aliased.codeQuestionWorkspace.openPanes[0].paneID,'cq:p:q:reader','CQ columns retain stable client identity aliases');
const closed=mergeWorkspaceLayouts([{...newer,updatedAt:'2026-10-23T12:00:02Z',layout:sharedWorkspaceLayout({})}])[0];
assert.equal(applySharedWorkspaceLayout(local,closed,project).readers.length,0,'Explicit empty layouts close columns');
const applied=applySharedWorkspaceLayout(local,a[0],project);
assert.equal(applied.readers[0].internalSearchQuery,'PRIVATE SEARCH');
const navigated={...local,readers:[{...local.readers[0],chapterID:99,sectionID:100}]};
assert.equal(applySharedWorkspaceLayout(navigated,a[0],project).readers[0].sectionID,100,'Existing Readers keep their own reading position');
assert.equal(applied.utilityInstances[0].query,'PRIVATE QUERY');
assert.equal(applied.codeQuestionWorkspace.definitionsByQuestionID.q.text,'PRIVATE DEFINITION');
assert.equal(applied.researchViewState.drafts.a,'PRIVATE DRAFT');
assert(applied.notebookColumns.some(item=>item.newNote),'Unsaved Notes survive remote closing');
assert.equal(applySharedWorkspaceLayout(local,a[0],{id:'other'}),local);
const wrap=(values,updatedAt='2026-10-23T12:00:01Z')=>({userID:'u',codeVersion:'v',updatedAt,values});
const metadata=wrap({[workspaceLayoutsKey]:JSON.stringify(a)});
const original=wrap({selectedCodeSectionID:'17',recentSearchesJSON:'["query"]'},'2026-10-23T12:00:00Z');
const merged=mergeContinuityRecords(original,metadata);
assert.equal(merged.values.selectedCodeSectionID,'17','Layout-only save preserves reader continuity');
assert.deepEqual(JSON.parse(merged.values[workspaceLayoutsKey]),a);
assert.deepEqual(mergeContinuityRecords(metadata,original),merged,'Arrival order does not lose content');
const ios=mergeContinuityRecords(merged,wrap({selectedCodeSectionID:'22'},'2026-10-23T12:00:02Z'));
assert.deepEqual(JSON.parse(ios.values[workspaceLayoutsKey]),a,'Older clients preserve shared layouts');
assert(isWorkspaceLayoutOnlyMutation({continuity:metadata}));
assert(!isWorkspaceLayoutOnlyMutation({continuity:merged}));
const baseline=mergeContinuityRecords(original,wrap({[workspaceLayoutsKey]:'[]'},original.updatedAt));
assert(onlyWorkspaceLayoutsChanged([{continuity:{...baseline,serverEventID:10}}],[{continuity:{...merged,serverEventID:11}}]));
assert(!onlyWorkspaceLayoutsChanged([{continuity:baseline}],[{continuity:ios}]));
assert(!onlyWorkspaceLayoutsChanged([{continuity:merged}],[{project:{id:'p'}}]));
console.log(`Workspace layout merge/projection passed; representative layout ${Buffer.byteLength(JSON.stringify(layout))} bytes; no content, drafts, search text, or scroll positions.`);
