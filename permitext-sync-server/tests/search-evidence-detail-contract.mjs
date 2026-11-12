import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {searchWords, searchWordPattern} from '../public/search-words.js';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const actual = name => {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`)); assert(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
function fixture() {
  const search={key:'search',id:'search',query:'water',matchMode:'words'};
  const readers=[{id:'first',sectionID:'old',codeVersion:'2022'},{id:'active',sectionID:'other',codeVersion:'2022'}];
  const reveals=[],details={},anchors={}; let account=1,serial=0;
  const c=vm.createContext({state:{readers,utilityInstances:[search],paneWeights:{},paneOrder:[]},activeWorkspaceID:'workspace',
    searchReaderOpeningAttempts:new Map(),savedItemOpeningAttempts:new Map(),sectionDetailOpeningAttempts:new Map(),
    captureAccountRequest:()=>account,isCurrentAccountRequest:value=>value===account,
    currentColumnWorkflowView:()=> 'research',workflowPaneIsVisible:()=>true,workspaceColumnsRequireProject:()=>false,
    readerShortcuts:{activeReaderPaneID:()=> 'reader:active'},
    resolveReaderSource:async item=>({...item,__activeCodeSourceContext:{}}),activeCodeSourcesController:{isCurrent:()=>true},
    searchResultDetail:item=>item,readerFieldsForSectionDetail:(d,o)=>({...d,...o}),normalizeAnnotationBlockID:v=>v||'',
    readerMatchesSource:()=>false,readerIsClearlyAvailable:()=>false,isProAccount:()=>true,
    newReaderState:fields=>({id:`new-${++serial}`,...fields}),paneIDForReader:r=>`reader:${r.id}`,
    paneIDForUtilityInstance:i=>`utility:${i.key}:${i.id}`,defaultPaneWidthForID:()=>630,placePaneAfter(){},appendPaneIfMissing(){},
    updateBrowserSectionURL(){},scheduleContinuitySync(){},saveWorkspaceState(){},transitionWorkspace:async()=>{},
    whenWorkspacePaneReady:async()=>true,retainReaderForSource:()=>null,resolvedReaderSourceNavigations:new WeakMap(),
    track:{querySelector:()=>null},CSS:{escape:v=>v},paneIsCollapsed:()=>false,columnExpansionController:()=>({reveal(){}}),
    revealReaderSourceTarget:(reader,item,anchor,options)=>reveals.push({reader,item,anchor,options}),scrollPaneIntoView(){},
    showWebNotice:async()=>{},sectionDetailsBySearch:()=>details,sectionDetailAnchorsBySearch:()=>anchors,
    searchWords,searchWordPattern
  });
  vm.runInContext(['reusableSearchReader','openSourceInReader','openSearchResultDetail','openSavedItemInReader',
    'retireEvidenceDetailLayout','searchDetailPassageBlock'].map(actual).join('\n'),c);
  return {c,search,readers,reveals,details,anchors,changeAccount(){account++;}};
}
const item=(id,extra={})=>({sectionID:id,codePrefix:'BC',codeVersion:'2022',chapterID:'chapter',title:'Water',...extra});
{
  const f=fixture(),untouched=JSON.stringify(f.readers);
  let owned;
  for(const target of [item('1',{blockID:'paragraph'}),item('2',{codeVersion:'2014'}),item('3')]) {
    const reader=await f.c.openSearchResultDetail(target,f.search);
    owned ||= reader;
    assert.equal(reader.id,owned.id);assert.notEqual(reader.id,'active');
    assert.equal(reader.sectionID,target.sectionID);assert.equal(reader.codeVersion,target.codeVersion);
    assert.equal(reader.sourceBlockID,target.blockID||'');
    assert.equal(f.readers.length,3,'First click creates one Search-owned Reader; later clicks update it');
    assert.equal(JSON.stringify(f.readers.slice(0,2)),untouched,'Existing Readers stay untouched');
  }
  assert.equal(f.reveals.at(-1).options.searchQuery,'water');
  const anchor={passages:[{exact:'Original saved quote'}]};
  const saved=await f.c.openSavedItemInReader(item('saved',{blockID:'exact',evidenceAnchor:anchor}),'utility:saved:list');
  assert.notEqual(saved.id,owned.id);assert.equal(saved.sourceBlockID,'exact');assert.equal(f.readers.length,4);
  assert.equal(f.reveals.at(-1).anchor,anchor);assert.equal(f.reveals.at(-1).options.preferPassage,true);
  assert.equal((await f.c.openSavedItemInReader(item('saved-next'),'utility:saved:list')).id,saved.id);
  assert.equal(f.readers.length,4);assert.equal(Object.keys(f.details).length,0);
  assert.equal(f.c.state.utilityInstances.length,1);
  const preserved=JSON.stringify(f.readers);
  const explicit=await f.c.openSourceInReader(item('new'),'utility:search:search',{sourceSurface:'search',forceNewReader:true});
  assert.notEqual(explicit.id,owned.id);assert.equal(f.readers.length,5);
  assert.equal(JSON.stringify(f.readers.slice(0,-1)),preserved,'New reader never changes another Reader');
  assert.equal((await f.c.openSearchResultDetail(item('after-new'),f.search)).id,owned.id,'Normal clicks keep updating the Search-owned Reader');
  assert.equal(explicit.sectionID,'new','The explicit new Reader stays on its passage');
  const beforeNewSaved=JSON.stringify(f.readers);
  const savedNew=await f.c.openSourceInReader(item('fresh-saved'),'utility:saved:list',{sourceSurface:'saved',forceNewReader:true});
  assert.equal(f.readers.length,6);assert.notEqual(savedNew.id,saved.id);
  assert.equal(JSON.stringify(f.readers.slice(0,-1)),beforeNewSaved);
}
{
  const f=fixture();f.c.state.readers.length=0;
  const first=await f.c.openSearchResultDetail(item('first'),f.search);
  const second=await f.c.openSearchResultDetail(item('second'),f.search);
  assert.equal(first.id,second.id);assert.equal(f.readers.length,1);
  const otherSearch={key:'search',id:'other',query:'water'};f.c.state.utilityInstances.push(otherSearch);
  const other=await f.c.openSearchResultDetail(item('other'),otherSearch);
  assert.notEqual(other.id,first.id);assert.equal(f.readers.length,2,'Separate Searches own separate Readers');
}
for(const surface of ['search','saved']) for(const change of ['account','workspace','view','query','closed-search','superseded']) {
  if(surface==='saved' && ['query','closed-search'].includes(change)) continue;
  const f=fixture(),gates=[];f.c.resolveReaderSource=target=>new Promise(resolve=>gates.push(()=>resolve(target)));
  const before=JSON.stringify(f.readers);
  const open=target=>surface==='search'?f.c.openSearchResultDetail(target,f.search):f.c.openSavedItemInReader(target,'evidence');
  const pending=open(item('stale'));
  if(change==='account')f.changeAccount();
  if(change==='workspace')f.c.activeWorkspaceID='another';
  if(change==='view')f.c.state.workflowNavigationGeneration=1;
  if(change==='query')f.search.query='steel';
  if(change==='closed-search')f.c.state.utilityInstances=[];
  if(change==='superseded') {
    const latest=open(item('latest'));gates[1]();await latest;
    gates[0]();assert.equal(await pending,null);assert.equal(f.readers.at(-1).sectionID,'latest');continue;
  }
  gates[0]();assert.equal(await pending,null,`${surface} ${change}`);
  assert.equal(JSON.stringify(f.readers),before);assert.equal(f.reveals.length,0);
}
{
  const f=fixture();
  const records={localSavedItems:[{id:'bookmark',blockID:'exact'}],localAnnotations:[{noteBody:'Existing comments'}],
    localProjects:[{id:'project'}],localProjectSections:[{id:'membership'}],syncOutbox:[{id:'queued'}],notebookDrafts:[{body:'draft'}],reports:[{body:'report'}]};
  const layout={...records,readers:f.readers,utilityInstances:[f.search,{id:'detail',key:'sdc'}],
    sectionDetails:{search:item('old')},sectionDetailAnchors:{search:'evidence'},
    paneOrder:['reader:first','section:detail:search','utility:sdc:detail'],paneWeights:{'reader:first':630,'section:detail:search':600},
    collapsedPaneIDs:['section:detail:search'],columnGroups:[{paneIDs:['reader:first','section:detail:search'],columns:{'reader:first':{kind:'reader'},'section:detail:search':{kind:'utility'}}}]};
  const original=JSON.stringify(layout),migrated=f.c.retireEvidenceDetailLayout(layout);
  assert.equal(JSON.stringify(layout),original,'Migration never mutates the source');
  for(const [key,value] of Object.entries(records)) assert.equal(migrated[key],value,`Preserves ${key}`);
  assert.equal(migrated.readers,f.readers);assert.equal(migrated.utilityInstances.length,1);
  assert.deepEqual(Array.from(migrated.paneOrder),['reader:first']);assert.equal(Object.keys(migrated.sectionDetails).length,0);
  assert.equal(f.c.retireEvidenceDetailLayout(migrated),migrated,'Retirement is idempotent');
}
{
  const f=fixture();
  const blocks=[['intro','References to water are incidental.'],['definition','WATERPROOFING. Exact enacted definition.'],
    ['table','Business areas 100 gross square feet per occupant.'],['unfinished','Laundry facilities shall be provided.']]
    .map(([id,textContent])=>({dataset:{annotationBlockId:id},textContent}));
  const target=detail=>f.c.searchDetailPassageBlock({children:blocks},detail)?.dataset.annotationBlockId;
  assert.equal(target({definitionTerm:'WATERPROOFING',searchQuery:'water'}),'definition');
  assert.equal(target({searchQuery:'occupant business',searchMatchMode:'words'}),'table');
  assert.equal(target({searchQuery:'Laundry Facilit',searchMatchMode:'words'}),'unfinished');
  assert.equal(target({searchQuery:'occupant business',searchMatchMode:'exact'}),undefined);
  assert.equal(target({blockID:'missing',searchQuery:'water'}),undefined,'Explicit missing passages never fall back to another block');
  assert.equal(target({blockID:'table',searchQuery:'water'}),'table');
}
assert.doesNotMatch(actual('workspacePaneDescriptors'), /add\(paneIDForSectionDetail/);
assert.doesNotMatch(actual('defaultActivePaneIDs'), /ids\.push\(paneIDForSectionDetail/);
console.log('Direct Reader evidence passed: Search-owned Reader reuse, exact editions/passages, explicit new columns, stale navigation fences and data-preserving layout retirement.');
