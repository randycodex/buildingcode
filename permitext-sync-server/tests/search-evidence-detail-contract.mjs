import {initializeReaderTabs,addReaderTab,openRecentReaderTab,readerTabs,canAddReaderTab,maximumReaderTabs} from '../public/reader-tabs.js';
import {linkPaneToView} from '../public/workflow-views.js';
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
  const c=vm.createContext({initializeReaderTabs,addReaderTab,openRecentReaderTab,readerTabs,canAddReaderTab,maximumReaderTabs,rememberReaderTabPosition(){},retainReaderColumn(){},linkPaneToView,state:{readers,utilityInstances:[search],paneWeights:{},paneOrder:[]},activeWorkspaceID:'workspace',
    searchReaderOpeningAttempts:new Map(),savedItemOpeningAttempts:new Map(),sectionDetailOpeningAttempts:new Map(),
    captureAccountRequest:()=>account,isCurrentAccountRequest:value=>value===account,
    currentColumnWorkflowView:()=> 'research',activateNotebookReference(){},workingResearchNote:()=>null,workflowPaneIsVisible:()=>true,workspaceColumnsRequireProject:()=>false,
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
    notifyReaderColumnLimit:()=>false,showWebNotice:async()=>{},sectionDetailsBySearch:()=>details,sectionDetailAnchorsBySearch:()=>anchors,
    searchWords,searchWordPattern
  });
  vm.runInContext(['prepareReaderSourceTab','reusableSearchReader','openSourceInReader','openSearchResultDetail','openSavedItemInReader',
    'retireEvidenceDetailLayout','searchDetailPassageBlock','openProjectSavedSection','readerPositionLabel'].map(actual).join('\n'),c);
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
  assert.equal(f.reveals.at(-1).options.wholeSection,false);
  const beforeNextSaved=JSON.stringify(f.readers.slice(0,-1));
  const nextSaved=await f.c.openSavedItemInReader(item('saved-next',{codeVersion:'2014'}),'utility:saved:list');
  assert.equal(nextSaved.id,saved.id,'Another Evidence item reuses the same Reader across editions');
  assert.equal(nextSaved.sectionID,'saved-next');assert.equal(nextSaved.codeVersion,'2014');
  assert.equal(f.reveals.at(-1).options.wholeSection,true);
  assert.equal(JSON.stringify(f.readers.slice(0,-1)),beforeNextSaved,'Evidence navigation preserves other Reader sessions');
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
  assert.equal((await f.c.openSavedItemInReader(item('after-new-evidence'),'utility:saved:list')).id,saved.id);
  assert.equal(savedNew.sectionID,'fresh-saved','An explicit new Reader stays independent of the reusable Evidence Reader');
}
{
  const f=fixture();f.c.state.readers.length=0;
  const first=await f.c.openSearchResultDetail(item('first'),f.search);
  assert.equal(f.c.readerPositionLabel(first),'Search Reader');
  const second=await f.c.openSearchResultDetail(item('second'),f.search);
  assert.equal(first.id,second.id);assert.equal(f.readers.length,1);
  const otherSearch={key:'search',id:'other',query:'water'};f.c.state.utilityInstances.push(otherSearch);
  const other=await f.c.openSearchResultDetail(item('other'),otherSearch);
  assert.notEqual(other.id,first.id);assert.equal(f.readers.length,2,'Separate Searches own separate Readers');
}
{
  const f=fixture();
  const reader=await f.c.openSavedItemInReader(item('evidence-source'),'utility:saved:project');
  assert.equal(f.c.readerPositionLabel(reader),'Evidence Reader');
  const other=await f.c.openSavedItemInReader(item('other-evidence'),'utility:saved:other');
  assert.notEqual(other.id,reader.id,'Separate Evidence columns have their own Readers');
  assert.equal(reader.sectionID,'evidence-source');
  const settings=await f.c.openSavedItemInReader(item('settings-source'),'utility:settings');
  const nextSettings=await f.c.openSavedItemInReader(item('next-settings-source'),'utility:settings');
  assert.notEqual(settings.id,nextSettings.id,'Saved Content in Settings keeps its separate Reader behavior');
}
for(const surface of ['search','saved']) for(const change of ['account','workspace','view','query','closed-search','superseded']) {
  if(surface==='saved' && ['query','closed-search'].includes(change)) continue;
  const f=fixture(),gates=[];f.c.resolveReaderSource=target=>new Promise(resolve=>gates.push(()=>resolve(target)));
  const before=JSON.stringify(f.readers);
  const open=target=>surface==='search'?f.c.openSearchResultDetail(target,f.search):f.c.openSavedItemInReader(target,'utility:saved:list');
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
console.log('Direct Reader navigation passed: Search and Evidence reuse, exact editions/passages, explicit new columns, stale navigation fences and data-preserving layout retirement.');


// Notebook owns one Reader with the six most recently opened source tabs.
{
 const f=fixture();f.c.currentColumnWorkflowView=()=> 'notebook';
 const reader=f.readers[0];Object.assign(reader,{codePrefix:'BC',scrollPosition:{sectionID:'old',anchorOffset:-87}});initializeReaderTabs(reader);
 f.c.state.workflowMembership={'reader:first':['notebook'],'reader:active':['research']};
 assert.equal(f.c.readerPositionLabel(reader),'Reader');assert.equal(f.c.readerPositionLabel(f.readers[1]),'Reader 1','Research numbering excludes Notebook’s one Reader');
 const originalTab=readerTabs(reader)[0],other=JSON.stringify(f.readers[1]);
 const one=await f.c.openSavedItemInReader(item('evidence-one',{codeVersion:'2014',blockID:'exact'}),'utility:saved:list');const firstTab=one.activeTabID;
 const two=await f.c.openSavedItemInReader(item('evidence-two'),'utility:saved:list');
 assert.equal(one.id,two.id);assert.equal(f.readers.length,2);assert.equal(readerTabs(reader).length,3);
 assert.equal(readerTabs(reader).find(tab=>tab.id===firstTab).sectionID,'evidence-one');assert.equal(readerTabs(reader).find(tab=>tab.id===firstTab).codeVersion,'2014');
 assert.deepEqual(readerTabs(reader).find(tab=>tab.id===originalTab.id),originalTab);assert.equal(JSON.stringify(f.readers[1]),other);
 for(const [index,prefix] of ['MC','FGC','ECC'].entries())addReaderTab(reader,{codePrefix:prefix,codeVersion:'2022',sectionID:`section-${index}`,scrollPosition:{sectionID:`section-${index}`,anchorOffset:-100-index}},`code-${index}`);
 const priorTabs=readerTabs(reader);let notices=0;f.c.showWebNotice=async()=>notices++;
 assert.equal(await f.c.openSavedItemInReader(item('seventh'),'utility:saved:list'),reader);assert.equal(notices,0);
 assert.equal(readerTabs(reader).length,6);assert.equal(readerTabs(reader)[0].sectionID,'seventh');
 assert.deepEqual(readerTabs(reader).slice(1),priorTabs.slice(0,5));assert.equal(JSON.stringify(f.readers[1]),other);
}
{
 const f=fixture();f.c.currentColumnWorkflowView=()=> 'notebook';
 f.c.state.workflowMembership={'reader:first':['notebook'],'reader:active':['research']};
 initializeReaderTabs(f.readers[0]);
 const one=await f.c.openProjectSavedSection({id:'project'},item('project-evidence'),'utility:saved:list');const firstTab=one.activeTabID;
 const two=await f.c.openProjectSavedSection({id:'project'},item('next-project-evidence'),'utility:saved:list');
 assert.equal(one.id,two.id);assert.equal(f.readers.length,2);assert.equal(readerTabs(one).find(tab=>tab.id===firstTab).sectionID,'project-evidence');
}
console.log('Notebook Evidence passed: one Reader, new sources first, exact editions/positions preserved, and oldest-tab retirement at capacity.');
