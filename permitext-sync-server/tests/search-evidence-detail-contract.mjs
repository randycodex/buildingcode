import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {searchWords, searchWordPattern} from '../public/search-words.js';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const actual = name => {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
function fixture() {
  const search = {key:'search', id:'a', query:'water', matchMode:'words'};
  const other = {key:'search', id:'b', query:'water', matchMode:'exact'};
  const readers = [{id:'manual', chapterID:'old', sectionID:'old', scrollTop:420}];
  const details = {}, anchors = {}, placements = [], reveals = [], notices = [];
  const panel = {dataset:{}, querySelector:()=>null};
  let account = 1, sourceCurrent = true, serial = 0;
  const c = vm.createContext({
    state:{readers, utilityInstances:[search,other], paneWeights:{}, paneOrder:[], searchLinkedReaders:{}},
    activeWorkspaceID:'workspace', sectionDetailOpeningAttempts:new Map(), sectionDetailSearchContexts:new WeakMap(),
    captureAccountRequest:()=>account, isCurrentAccountRequest:value=>value===account,
    isCurrentActiveCodeSourceContext:()=>sourceCurrent,
    resolveReaderSource:async item=>({...item, __activeCodeSourceContext:{}}),
    workspaceColumnsRequireProject:()=>false, workflowPaneIsVisible:()=>true,
    sectionDetailsBySearch:()=>details, sectionDetailAnchorsBySearch:()=>anchors,
    paneIDForUtilityInstance:i=>`utility:${i.key}:${i.id}`, paneIDForSectionDetail:id=>`section:detail:${id}`,
    syncCodeVersion:value=>value, syncCodeVersionForPrefix:()=> '2022', normalizeAnnotationBlockID:value=>value||'',
    placeSectionDetailAfterPane:(id,anchor)=>placements.push([id,anchor]),
    updateBrowserSectionURL(){}, scheduleContinuitySync(){},
    updateLinkedReaderForSearch:()=>{throw Error('Result click moved a Reader');},
    newReaderState:value=>({id:`new-${++serial}`,...value}), readerFieldsForSectionDetail:(d,o)=>({...d,...o}),
    saveWorkspaceState(){}, transitionWorkspace:async()=>{}, whenWorkspacePaneReady:async()=>true,
    track:{querySelector:selector=>selector.startsWith('.section-detail-panel')?panel:null}, CSS:{escape:value=>value},
    paneIsCollapsed:()=>false, columnExpansionController:()=>({reveal:()=>reveals.push('reveal')}),
    scrollPaneIntoView:id=>reveals.push(id), showWebNotice:async(...args)=>notices.push(args),
    currentColumnWorkflowView:()=> 'research', searchReaderOpeningAttempts:new Map(),
    activeCodeSourcesController:{isCurrent:()=>sourceCurrent}, resolvedReaderSourceNavigations:new WeakMap(),
    searchResultDetail:item=>item, readerMatchesSource:(r,d)=>r.sectionID===d.sectionID,
    readerIsClearlyAvailable:()=>false, isProAccount:()=>true, paneIDForReader:r=>`reader:${r.id}`,
    defaultPaneWidthForID:()=>600, placePaneAfter(){}, appendPaneIfMissing(){},
    revealReaderSourceTarget(){}, closeLinkedReaderForSearch(){}, searchWords, searchWordPattern
  });
  vm.runInContext(['openSearchResultDetail','openSectionDetail','openSourceInReader','reusableSearchReader',
    'retainReaderForSource','removeSectionDetail','searchDetailPassageBlock'].map(actual).join('\n'),c);
  return {c, search, other, details, anchors, readers, placements, reveals, notices,
    changeAccount(){account++;}, revoke(){sourceCurrent=false;}};
}
const item = (sectionID, extra={}) => ({sectionID, codePrefix:'BC', codeVersion:'2022', chapterID:'chapter',
  title:'Water', codeSource:{canonicalEdition:'2022'}, ...extra});
{
  const f=fixture(), original=JSON.stringify(f.readers);
  for (const target of [item('1',{blockID:'paragraph'}),item('2',{codeVersion:'2014'}),item('1')]) {
    const detail=await f.c.openSearchResultDetail(target,f.search);
    assert.equal(detail.sectionID,target.sectionID);
    assert.equal(detail.blockID,target.blockID||'');
    assert.equal(detail.codeVersion,target.codeVersion);
    assert.equal(detail.codeSource,target.codeSource);
    assert.equal(Object.hasOwn(detail,'searchQuery'),false,'Live query text must not enter serialized workspace details');
    assert.equal(Object.keys(f.details).length,1,'Clicks reuse one detail for a Search column');
    assert.equal(JSON.stringify(f.readers),original,'Opening a result cannot mutate Readers');
  }
  await f.c.openSearchResultDetail(item('3'),f.other);
  assert.equal(Object.keys(f.details).length,2,'Separate Search columns own separate details');
  assert.equal(f.details.a.sectionID,'1'); assert.equal(f.c.sectionDetailSearchContexts.get(f.details.b).searchMatchMode,'exact');
  assert.deepEqual(f.placements.at(-1),['b','utility:search:b']);
  const reader=await f.c.openSourceInReader(item('1',{blockID:'paragraph'}),'section:detail:a',{sourceSurface:'search-detail'});
  const retained=JSON.stringify(reader);
  await f.c.openSearchResultDetail(item('9'),f.search);
  assert.equal(JSON.stringify(reader),retained,'An explicitly opened Reader stays on its selected passage');
  const reused=await f.c.openSourceInReader(item('9'),'section:detail:a',{sourceSurface:'search-detail'});
  assert.equal(reused.id,reader.id,'Open in Reader reuses this detail\'s Reader only after an explicit click');
  f.c.removeSectionDetail('a');
  assert(f.readers.includes(reader),'Closing detail leaves its independently opened Reader available');
  assert.equal(JSON.stringify(f.readers[0]),JSON.stringify(JSON.parse(original)[0]));
}
for (const mode of ['cancel','account','workspace','view','closed-search','query','source','closed-detail']) {
  const f=fixture(); let resolve;
  f.c.resolveReaderSource=()=>new Promise(done=>{resolve=done;});
  const pending=f.c.openSearchResultDetail(item('late'),f.search);
  if(mode==='account')f.changeAccount();
  if(mode==='workspace')f.c.activeWorkspaceID='another';
  if(mode==='view')f.c.state.workflowNavigationGeneration=1;
  if(mode==='closed-search')f.c.state.utilityInstances=[];
  if(mode==='query')f.search.query='concrete';
  if(mode==='source')f.revoke();
  if(mode==='closed-detail')f.c.removeSectionDetail('a');
  resolve(mode==='cancel'?null:{...item('late'),__activeCodeSourceContext:{}});
  assert.equal(await pending,null,mode);
  assert.equal(Object.keys(f.details).length,0,mode);
  assert.deepEqual(f.reveals,[],mode);
}
{
  const f=fixture(), gates=[];
  f.c.resolveReaderSource=()=>new Promise(resolve=>gates.push(resolve));
  const first=f.c.openSearchResultDetail(item('first'),f.search);
  const second=f.c.openSearchResultDetail(item('second'),f.search);
  gates[1]({...item('second'),__activeCodeSourceContext:{}}); await second;
  gates[0]({...item('first'),__activeCodeSourceContext:{}}); await first;
  assert.equal(f.details.a.sectionID,'second','A late first click cannot overwrite the newest selection');
  assert.equal(f.c.sectionDetailOpeningAttempts.size,0);
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
assert.match(actual('appendSearchResultGroups'),/openSearchResultDetail\(detail, searchInstance\)/);
assert.match(actual('openRecentlyViewedInReader'),/openSearchResultDetail\(recentViewNavigationSource\(entry\), searchInstance\)/);
console.log('Search Evidence detail passed: one detail per Search, exact source and passage targeting, explicit Reader reuse and preservation, stale click/account/view/close guards, and recent-result routing.');
