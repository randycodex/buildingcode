const visibleReaderReveals = [];
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name){const start=source.indexOf(`function ${name}(`);const end=source.indexOf('\n}',start);assert.ok(start>=0&&end>start);const before=source.slice(Math.max(0,start-6),start);return (before==='async '?'async ':'')+source.slice(start,end+2);}
const calls=[],requests=[],reveals=[],placements=[];
const existing={id:'reader',codePrefix:'BC',codeVersion:'edition',chapterID:'2',sectionID:'114',searchPreviewPaneID:'search'};
const untouched={id:'other',codePrefix:'PC',chapterID:'10',sectionID:'100'};
const content={classList:{contains:()=>false},querySelectorAll:()=>[{dataset:{sectionId:'113',sectionAliases:'114 115'}}]};
const panel={dataset:{readerPublicCorpusGeneration:'1'},querySelector:name=>name==='.reader-content'?content:{value:''}};
const c=vm.createContext({columnExpansionController:()=>({reveal:node=>visibleReaderReveals.push(node)}),paneIsCollapsed:()=>false,state:{readers:[existing,untouched],paneWeights:{}},activeWorkspaceID:'workspace',
  workspaceColumnsRequireProject:()=>false,currentColumnWorkflowView:()=> 'research',captureAccountRequest:()=>1,isCurrentAccountRequest:()=>true,
  workflowPaneIsVisible:()=>true,resolveReaderSource:item=>new Promise(resolve=>requests.push(()=>resolve(item))),
  searchResultDetail:item=>item,readerFieldsForSectionDetail:(item,options)=>({...item,...options}),normalizeAnnotationBlockID:id=>id||'',
  readerMatchesSource:()=>false,readerIsClearlyAvailable:()=>false,isProAccount:()=>true,newReaderState:item=>({id:'new',...item}),
  paneIDForReader:reader=>reader.id,defaultPaneWidthForID:()=>480,placePaneAfter:(anchor,pane)=>placements.push([anchor,pane]),appendPaneIfMissing(){},
  updateBrowserSectionURL(){},scheduleContinuitySync(){},saveWorkspaceState(){},
  transitionWorkspace:async(_type,options)=>calls.push([...options.refreshPaneIDs]),whenWorkspacePaneReady:async()=>true,
  revealReaderSourceTarget:(reader,item,anchor,options)=>{calls.push(item.sectionID);reveals.push({reader,item,anchor,options});},scrollPaneIntoView(){},
  resolvedReaderSourceNavigations:new WeakMap(),searchReaderOpeningAttempts:new Map(),publicCodeRevision:{generation:1},
  workspaceReaderContentIdentity:reader=>reader.sectionID,readerContentScrollKey:reader=>reader.sectionID,setTitle(){},
  track:{querySelector:()=>panel},CSS:{escape:value=>value},savedReaderTarget:()=>({})
});
vm.runInContext(['retainReaderForSource','reusableSearchReader','openSourceInReader'].map(actual).join('\n'),c);
const opening=c.openSourceInReader({...existing,sectionID:'115'},'search',{sourceSurface:'search'});
requests.shift()();await opening;
assert.deepEqual(calls,[[], '115'],'Existing chapter and target reuse text without a Reader rebuild');
assert.equal(c.state.readers.length,2);assert.equal(untouched.sectionID,'100');
assert.equal(panel.dataset.workspacePaneIdentity,'115');
const target=id=>({codePrefix:'BC',codeVersion:'edition',chapterID:'2',sectionID:id});
calls.length=0;
const first=c.openSourceInReader(target('114'),'search',{sourceSurface:'search'});
const second=c.openSourceInReader(target('115'),'search',{sourceSurface:'search'});
requests[1]();await second;requests[0]();await first;
assert.equal(existing.sectionID,'115','A late older result cannot replace the latest click');
assert.deepEqual(calls,[[],'115']);
assert.equal(c.retainReaderForSource(existing,{...target('115'),codeVersion:'other-edition'}),null,'Different editions cannot reuse text');
assert.equal(c.retainReaderForSource(existing,target('999')),null,'Unloaded passages require real hydration');
c.publicCodeRevision.generation=2;
assert.equal(c.retainReaderForSource(existing,target('115')),null,'Invalidated corpus forces fresh manifest and body validation');
console.log('Actual result-opening flow reuses loaded text, keeps latest click and rejects mismatched sources.');

assert(visibleReaderReveals.length > 0, 'Explicit source navigation reveals its destination through the shared column layout.');

// Research citations resolve their exact source, reuse only a suitable Reader,
// and request passage positioning without creating a Search column.
vm.runInContext(actual('readerMatchesSource'),c);
requests.length=0;
const evidenceAnchor={sectionID:'115',blockID:'exact-paragraph'};
existing.sourceAnchorPaneID='assistant';
const originalReaderCount=c.state.readers.length;
const researchOpening=c.openSourceInReader(target('115'),'assistant',{
  sourceSurface:'research',projectID:'project-a',evidenceAnchor
});
assert.equal(requests.length,1,'A Research citation resolves its source before choosing a Reader.');
requests.shift()();
assert.equal(await researchOpening,existing,'An adjacent Reader already showing the citation is reused.');
assert.equal(c.state.readers.length,originalReaderCount);
assert.equal(existing.sourceProjectID,'project-a');
assert.equal(existing.sourceAnchorPaneID,'assistant');
assert.deepEqual(placements.at(-1),['assistant','reader']);
assert.equal(reveals.at(-1).anchor,evidenceAnchor);
assert.equal(reveals.at(-1).options.preferPassage,true);
assert.equal(reveals.at(-1).options.researchPassage,true);
assert.equal(untouched.sectionID,'100','Opening a citation preserves an unrelated Reader.');

const detailOpening=c.openSourceInReader(target('116'),'search-detail',{sourceSurface:'search-detail'});
requests.shift()();const detailReader=await detailOpening;
assert.notEqual(detailReader.id,existing.id,'Search details preserve a Reader belonging to Assistant.');
assert.deepEqual(placements.at(-1),['search-detail',detailReader.id]);
assert.equal(reveals.at(-1).options.preferPassage,true);
assert.equal(reveals.at(-1).options.researchPassage,false);

const notebookOpening=c.openSourceInReader(target('117'),'assistant',{projectID:'project-a'});
requests.shift()();assert.equal(await notebookOpening,existing);
assert.equal(reveals.at(-1).options.preferPassage,false,'Ordinary source links keep section-based positioning.');
assert.equal(reveals.at(-1).options.researchPassage,false);

let current=true;
c.isCurrentAccountRequest=()=>current;
const beforeLateSource=c.state.readers.map(reader=>({...reader}));
const beforeLateReveal=reveals.length,beforeLatePlacement=placements.length;
const staleOpening=c.openSourceInReader(target('118'),'assistant',{sourceSurface:'research'});
current=false;requests.shift()();
assert.equal(await staleOpening,null);
assert.deepEqual(c.state.readers.map(reader=>({...reader})),beforeLateSource,'A late Research source cannot alter another account’s Readers.');
assert.equal(reveals.length,beforeLateReveal);
assert.equal(placements.length,beforeLatePlacement);
console.log('Research, Search-detail and ordinary Reader links passed: exact resolution, adjacent reuse, Project/anchor retention, passage targeting and stale-account isolation.');
