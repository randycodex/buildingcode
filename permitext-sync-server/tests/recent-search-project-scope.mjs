import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as searchScope from '../public/recent-search-scope.js';
import * as viewScope from '../public/recent-view-scope.js';
import {mergeContinuityRecords} from '../continuity-merge.mjs';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);};
let projectID='',owner='owner',clock=1_792_000_000_000;
class Clock extends Date {constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock++;}}
const c=vm.createContext({...searchScope,...viewScope,Date:Clock,
  state:{recentSearches:['Old general search'],recentSearchHistory:[],recentlyViewedSections:[],syncOutbox:[]},
  activeWorkspaceID:'general',activeWorkspaceRecord:()=>({projectID}),activeAccount:()=>({userID:owner}),
  captureAccountRequest:()=>owner,isCurrentAccountRequest:value=>value===owner,
  recentSearchLimit:50,recentSearchPopoverLimit:15,recentViewLimit:50,chapters:[],defaultSyncCodeVersion:'test',
  syncedContent:{summary:{}},saveWorkspaceState(){},scheduleRecentSearchContinuitySync(){},
  mutationKindAndRecord:mutation=>({kind:'continuity',record:mutation.continuity}),
  continuityRecentEntries:values=>JSON.parse(values.recentlyViewedSectionsJSON||'[]'),recentViewIdentity:entry=>String(entry.sectionID),
});
vm.runInContext(['normalizeSearchHistory','normalizeRecentSearchHistory','activeRecentViewProjectID',
  'continuityRecentSearches','continuityRecentSearchHistory','localRecentSearchHistory','searchRecentQueries',
  'outgoingRecentSearchHistory','recordRecentSearch','removeRecentSearch','continuityValuesForReader','applyRemoteContinuityIfNewer']
  .map(actual).join('\n'),c);
const select=id=>{projectID=id;c.activeWorkspaceID=id||'general';};
const queries=()=>Array.from(c.searchRecentQueries(50));
select('project-a');assert.deepEqual(queries(),[],'A new Project does not inherit the account’s old unassigned strings.');
c.recordRecentSearch('stairs');c.recordRecentSearch('STAIRS');
assert.deepEqual(queries(),['STAIRS'],'Repeated query text is deduplicated within its Project.');
const a=c.state.recentSearchHistory.find(entry=>entry.projectID==='project-a');
select('project-b');assert.deepEqual(queries(),[]);
c.recordRecentSearch('stairs');c.recordRecentSearch('sprinklers');
assert.deepEqual(queries(),['sprinklers','stairs']);
const b=c.state.recentSearchHistory.filter(entry=>entry.projectID==='project-b');
select('project-a');assert.deepEqual(queries(),['STAIRS']);
c.state=JSON.parse(JSON.stringify(c.state));
assert.deepEqual(queries(),['STAIRS'],'Project query ownership survives serialization and reload.');
select('');assert.deepEqual(queries(),['Old general search'],'Untagged legacy queries remain outside Projects.');
select('project-a');c.removeRecentSearch('stairs');assert.deepEqual(queries(),[]);
select('project-b');assert.deepEqual(queries(),['sprinklers','stairs'],'Removing A’s query preserves B’s matching query.');

const record=(entries,updatedAt=clock)=>({userID:'owner',codeVersion:'test',updatedAt:new Date(updatedAt).toISOString(),values:{
  recentSearchesJSON:'[]',recentSearchHistoryJSON:JSON.stringify(entries)}});
const merged=mergeContinuityRecords(record([a]),record(b));
assert.deepEqual(merged,mergeContinuityRecords(record(b),record([a])));
assert.equal(JSON.parse(merged.values.recentSearchHistoryJSON).length,3,'Sync retains one record per Project and normalized query.');
assert.equal(JSON.parse(merged.values.continuityHistoryClearsJSON).searches,0,'An empty unassigned legacy list cannot clear Project histories.');
assert.deepEqual(JSON.parse(merged.values.recentSearchesJSON),[],'Project-owned queries are not downgraded into unassigned legacy strings.');
const removed=mergeContinuityRecords(record(c.state.recentSearchHistory),record([a]));
assert.deepEqual(searchScope.projectRecentSearchQueries(JSON.parse(removed.values.recentSearchHistoryJSON),'project-a'),[],
  'A stale sync cannot immediately restore a query removed from A.');
assert.deepEqual(searchScope.projectRecentSearchQueries(JSON.parse(removed.values.recentSearchHistoryJSON),'project-b'),['sprinklers','stairs']);
select('project-a');c.recordRecentSearch('stairs');assert.deepEqual(queries(),['stairs'],'An intentional later search restores a removed query.');
const outgoing=c.continuityValuesForReader({}, {promoteReader:false});
assert.ok(JSON.parse(outgoing.recentSearchHistoryJSON).some(entry=>entry.projectID==='project-a'));
assert.deepEqual(JSON.parse(outgoing.recentSearchesJSON),['Old general search']);

const many=searchScope.normalizeProjectSearchHistory([a,...Array.from({length:70},(_,i)=>({projectID:'project-b',query:`query ${i}`,searchedAt:clock+i}))]);
assert.equal(many.filter(entry=>entry.projectID==='project-a').length,1);
assert.equal(many.filter(entry=>entry.projectID==='project-b').length,50,'Each Project retains its own 50 queries.');
assert.deepEqual(searchScope.normalizeProjectSearchHistory(many),many);
select('new-project');c.syncedContent.summary.latestContinuity={...merged,updatedAt:new Date(clock+100_000).toISOString()};
c.state.continuityAppliedAt=null;c.state.recentActivityUpdatedAt=null;
await c.applyRemoteContinuityIfNewer();assert.deepEqual(queries(),[],'Applying remote history cannot populate a new Project.');
select('project-a');assert.deepEqual(queries(),['STAIRS']);
select('project-b');assert.deepEqual(queries(),['sprinklers','stairs']);
const cleared=mergeContinuityRecords(merged,record([],clock+200_000));
assert.deepEqual(JSON.parse(cleared.values.recentSearchHistoryJSON),[],'The explicit account-wide Settings clear still clears every Project.');
assert.deepEqual(JSON.parse(mergeContinuityRecords(cleared,merged).values.recentSearchHistoryJSON),[],'Pre-clear snapshots cannot resurrect Project queries.');

// Render the actual popover and verify its visible rows and stale click guards.
class Node {
 constructor(){this.children=[];this.handlers={};this.attributes={};this.classes=new Set();this.textContent='';}
 classList={contains:name=>this.classes.has(name)};
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(){this.children=[];}
 setAttribute(name,value){this.attributes[name]=value;}
 addEventListener(name,callback){this.handlers[name]=callback;}
 set innerHTML(value){if(value==='<span></span>')this.children=[new Node()];}
 querySelector(selector){return selector==='span'?this.children[0]:null;}
 focus(){}
}
const input=new Node(),popover=new Node();popover.dataset={};
const panel={isConnected:true,querySelector:selector=>selector==='.search-input'?input:popover};
Object.assign(c,{document:{createElement:()=>new Node()},clear:node=>node.replaceChildren(),
  setSearchRecentPopoverOpen(){},circleXIconSVG:()=>'',updateSearchDock(){},renderSearchResults(){}});
vm.runInContext(actual('renderSearchRecentPopover'),c);
select('project-b');c.renderSearchRecentPopover(panel,{id:'search',query:''});
assert.deepEqual(popover.children[0].children.map(row=>row.children[0].children[0].textContent),['sprinklers','stairs']);
const staleApply=popover.children[0].children[0].children[0].handlers.click;
const staleRemove=popover.children[0].children[0].children[1].handlers.click;
select('project-a');const before=JSON.stringify(c.state.recentSearchHistory);staleApply();staleRemove();
assert.equal(JSON.stringify(c.state.recentSearchHistory),before,'Old popover clicks cannot edit the newly active Project.');
select('new-project');c.renderSearchRecentPopover(panel,{id:'search',query:''});assert.equal(popover.children.length,0);
console.log('Recent search Project scope passed: actual recording/removal/popover, switching and reload, query deduplication, legacy isolation, per-Project limits, sync, clear and stale callbacks.');
