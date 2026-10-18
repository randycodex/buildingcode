import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as scope from '../public/recent-view-scope.js';
import {mergeContinuityRecords} from '../continuity-merge.mjs';
import {syncCodeVersion,defaultSyncCodeVersion} from '../public/sync-identity.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);};
let projectID='',accountID='owner',clock=800_000_001;
const timers=[],queued=[];
const context=vm.createContext({...scope,syncCodeVersion,defaultSyncCodeVersion,
  activeWorkspaceID:'general',activeWorkspaceRecord:()=>({projectID}),
  captureAccountRequest:()=>accountID,isCurrentAccountRequest:id=>id===accountID,
  activeAccount:()=>({userID:accountID}),state:{recentlyViewedSections:[],syncOutbox:[],readers:[]},
  syncedContent:{summary:{}},mutationKindAndRecord:mutation=>({kind:'continuity',record:mutation.continuity}),
  codeOptions:[{prefix:'BC',label:'Building Code'}],chapters:[],codeOptionFor:()=>({label:'Building Code'}),
  swiftReferenceDateSeconds:()=>clock++,recentViewLimit:50,recentSearchLimit:50,continuityPushTimer:null,
  normalizeSearchHistory:entries=>entries||[],normalizeRecentSearchHistory:entries=>entries||[],
  Date,saveWorkspaceState(){},window:{setTimeout:callback=>timers.push(callback)},clearTimeout(){},
  enqueueSyncMutation:mutation=>queued.push(mutation),flushSyncOutbox:async()=>{},
  recentlyViewedPreviewHasEnactedText:()=>false,
  sectionPlainText:section=>section.text,stripLeadingSectionNumber:title=>title,
  snippetWithoutDuplicateTitle:entry=>entry.snippet,
});
const functions=['activeRecentViewProjectID','recentViewSourceVersion','recentViewCodePrefix','recentViewIdentity',
  'recentViewEntryForReader','mergeRecentlyViewedDetails','recordRecentlyViewedReader','searchRecentlyViewedEntries',
  'continuityRecentEntries','continuityRecentSearches','continuityRecentSearchHistory','outgoingRecentSearchHistory',
  'continuityValuesForReader','scheduleContinuitySync','scheduleRecentSearchContinuitySync','applyRemoteContinuityIfNewer',
  'recentViewNavigationSource','hydrateSearchRecentlyViewedEntries'];
vm.runInContext(functions.map(actual).join('\n'),context);
const visit=(id,title)=>context.recordRecentlyViewedReader({sectionID:id,title,codePrefix:'BC',codeVersion:defaultSyncCodeVersion});
const shown=()=>Array.from(context.searchRecentlyViewedEntries(),entry=>entry.title);
const select=id=>{projectID=id;context.activeWorkspaceID=id||'general';};
visit(7,'Older general browsing');
select('project-a');assert.deepEqual(shown(),[],'A new Project cannot inherit unassigned account history.');
visit(7,'Project A visit');
const a=context.state.recentlyViewedSections[0];
select('project-b');assert.deepEqual(shown(),[],'Project B starts empty after visiting a section in A.');
visit(7,'Project B visit');
const b=context.state.recentlyViewedSections[0];
assert.notEqual(context.recentViewIdentity(a),context.recentViewIdentity(b),'The same section belongs independently to both Projects.');
assert.deepEqual(shown(),['Project B visit']);
context.mergeRecentlyViewedDetails([{...a,previewText:'A enacted preview'}]);
assert.deepEqual(shown(),['Project B visit'],'Hydrating A cannot add its visit to B.');
select('project-a');assert.deepEqual(shown(),['Project A visit']);
assert.equal(context.searchRecentlyViewedEntries()[0].previewText,'A enacted preview');
context.state.recentlyViewedSections=JSON.parse(JSON.stringify(context.state.recentlyViewedSections));
assert.deepEqual(shown(),['Project A visit'],'Project history persists after a serialized reload.');
select('');assert.deepEqual(shown(),['Older general browsing']);

const record=entries=>({userID:'owner',codeVersion:defaultSyncCodeVersion,updatedAt:'2026-10-17T22:00:00Z',
  values:{recentlyViewedSectionsJSON:JSON.stringify(entries)}});
const merged=mergeContinuityRecords(record([a]),record([b]));
assert.deepEqual(merged,mergeContinuityRecords(record([b]),record([a])));
assert.equal(JSON.parse(merged.values.recentlyViewedSectionsJSON).length,2,'Sync retains identical section IDs in separate Projects.');
context.syncedContent.summary.latestContinuity=merged;
context.state.recentlyViewedSections=[];
select('project-a');assert.deepEqual(shown(),['Project A visit'],'Synced recents use the same Project filter as local recents.');
select('project-b');assert.deepEqual(shown(),['Project B visit']);
select('new-project');assert.deepEqual(shown(),[]);
await context.applyRemoteContinuityIfNewer();
assert.deepEqual(shown(),[],'Applying synced history never fills a new Project with another Project’s visits.');
select('project-a');assert.deepEqual(shown(),['Project A visit']);
const bounded=mergeContinuityRecords(record([a]),record(Array.from({length:70},(_,i)=>({...b,sectionID:i+100,viewedAt:900_000_000-i}))));
const entries=JSON.parse(bounded.values.recentlyViewedSectionsJSON);
assert.equal(entries.filter(entry=>entry.projectID==='project-b').length,50);
assert.equal(entries.filter(entry=>entry.projectID==='project-a').length,1,'Activity in B cannot evict A’s entire history.');
assert.equal(scope.limitRecentViewsByProject([...entries,{...a,projectID:'third'}]).length,52);

// Delayed pushes must not capture/promote a Reader after changing Project or account.
select('project-a');context.scheduleContinuitySync({sectionID:8,chapterID:1,title:'A delayed visit',codePrefix:'BC',codeVersion:defaultSyncCodeVersion});
select('project-b');timers.at(-1)();assert.equal(queued.length,0);
context.scheduleRecentSearchContinuitySync();accountID='other';timers.at(-1)();assert.equal(queued.length,0);
accountID='owner';context.scheduleRecentSearchContinuitySync();timers.at(-1)();assert.equal(queued.length,1);
const sent=JSON.parse(queued[0].continuity.values.recentlyViewedSectionsJSON);
assert.ok(sent.some(entry=>entry.projectID==='project-a'&&entry.sectionID===8));
assert.equal(sent.some(entry=>entry.projectID==='project-b'&&entry.sectionID===8),false);

let resolveDetail,onEntry=0;
context.resolveSectionDetail=()=>new Promise(resolve=>{resolveDetail=resolve;});
select('project-a');const before=JSON.stringify(context.state.recentlyViewedSections);
const hydration=context.hydrateSearchRecentlyViewedEntries([a],{isCurrent:()=>projectID==='project-a',onEntry:()=>onEntry++});
select('project-b');resolveDetail({chapter:{id:1},section:{title:'A',text:'A enacted text'}});
assert.deepEqual(Array.from(await hydration),[]);assert.equal(onEntry,0);
assert.equal(JSON.stringify(context.state.recentlyViewedSections),before,'A late hydration cannot write after its context changed.');
assert.match(actual('renderSearchHistory'),/isCurrent: current/);
console.log('Recently Viewed Project scope passed: new/switch/return/reload, local and synced history, independent limits, exact source identity, stale timers and hydration.');
