const visibleReaderReveals = [];
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name){const start=source.indexOf(`function ${name}(`);const end=source.indexOf('\n}',start);assert.ok(start>=0&&end>start);const before=source.slice(Math.max(0,start-6),start);return (before==='async '?'async ':'')+source.slice(start,end+2);}
const calls=[],requests=[];
const existing={id:'reader',codePrefix:'BC',codeVersion:'edition',chapterID:'2',sectionID:'114',searchPreviewPaneID:'search'};
const untouched={id:'other',codePrefix:'PC',chapterID:'10',sectionID:'100'};
const content={classList:{contains:()=>false},querySelectorAll:()=>[{dataset:{sectionId:'113',sectionAliases:'114 115'}}]};
const panel={dataset:{readerPublicCorpusGeneration:'1'},querySelector:name=>name==='.reader-content'?content:{value:''}};
const c=vm.createContext({columnExpansionController:()=>({reveal:node=>visibleReaderReveals.push(node)}),paneIsCollapsed:()=>false,state:{readers:[existing,untouched],paneWeights:{}},activeWorkspaceID:'workspace',
  workspaceColumnsRequireProject:()=>false,currentColumnWorkflowView:()=> 'research',captureAccountRequest:()=>1,isCurrentAccountRequest:()=>true,
  workflowPaneIsVisible:()=>true,resolveReaderSource:item=>new Promise(resolve=>requests.push(()=>resolve(item))),
  searchResultDetail:item=>item,readerFieldsForSectionDetail:item=>item,normalizeAnnotationBlockID:id=>id||'',
  readerMatchesSource:()=>false,readerIsClearlyAvailable:()=>false,isProAccount:()=>true,newReaderState:item=>({id:'new',...item}),
  paneIDForReader:reader=>reader.id,defaultPaneWidthForID:()=>480,placePaneAfter(){},appendPaneIfMissing(){},
  updateBrowserSectionURL(){},scheduleContinuitySync(){},saveWorkspaceState(){},
  transitionWorkspace:async(_type,options)=>calls.push([...options.refreshPaneIDs]),whenWorkspacePaneReady:async()=>true,
  revealReaderSourceTarget:(_reader,item)=>calls.push(item.sectionID),scrollPaneIntoView(){},
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
