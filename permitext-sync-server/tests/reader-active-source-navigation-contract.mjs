import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createActiveCodeSourceController } from '../public/active-code-source-controller.js';
import { createActiveCodeSourceNavigationGuard } from '../public/active-code-source-navigation.js';
const text = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const extract = (name, next) => text.slice(text.indexOf(`async function ${name}(`), text.indexOf(`\n${next}`, text.indexOf(`async function ${name}(`)));
const source = {canonicalEdition:'exact',jurisdictionID:1,codeID:1,categoryID:4,codePrefix:'BC68',categoryLabel:'1968 Building Code'};
function setup() {
  const values = new Map();
  const controller = createActiveCodeSourceController({storage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},loadCatalog:async()=>[source]});
  controller.setContext({accountID:'a',sessionID:'s'});
  const reader={id:'reader',codePrefix:'BC68',codeVersion:'exact',chapterID:'old',sectionID:'previous'};
  let began=0, notices=0;
  const c={activeCodeSourcesController:controller,createActiveCodeSourceNavigationGuard,
    syncCodeVersion:value=>value,syncCodeVersionForPrefix:()=> 'exact',fetchChapterList:async()=>[{id:'new',codePrefix:'BC68',codeVersion:'exact'}],
    confirmWebWarning:async()=>false,captureAccountRequest:()=> 'a',isCurrentAccountRequest:value=>value==='a',activeWorkspaceID:'w',
    state:{readers:[reader]},closeActiveCustomSelect(){},beginReaderNavigation(){began++;return 'nav';},
    readerCodeSelectionKey:()=> 'BC68',saveWorkspaceState(){},scheduleContinuitySync(){},refreshReaderContent:async()=>true,
    showWebNotice:async()=>{notices++;},console};
  vm.createContext(c);
  vm.runInContext(extract('guardReaderChapterSource','async function selectReaderNavigation(')+extract('selectReaderNavigation','function bindReaderNavigationKeyboard('),c);
  const panel={isConnected:true,dataset:{},querySelector:()=>({value:'old'})};
  return {c,controller,reader,panel,began:()=>began,notices:()=>notices};
}
for (const accept of [false,true]) {
  const t=setup();await t.controller.ensureCatalog();t.controller.update(source,false,t.controller.captureContext());
  t.c.confirmWebWarning=async()=>accept;
  await t.c.selectReaderNavigation(t.panel,t.reader,{chapterID:'new'});
  assert.equal(t.began(),accept?1:0);
  assert.equal(t.reader.chapterID,accept?'new':'old');
  assert.equal(t.controller.state.preferences.isEnabled(source),accept);
}
{
  const t=setup();await t.controller.ensureCatalog();t.controller.update(source,false,t.controller.captureContext());
  let resolve,entered;const ready=new Promise(r=>entered=r);
  t.c.confirmWebWarning=()=>{entered();return new Promise(r=>resolve=r);};
  const opening=t.c.selectReaderNavigation(t.panel,t.reader,{chapterID:'new'});await ready;
  t.c.activeWorkspaceID='another';resolve(true);await opening;
  assert.equal(t.began(),0);assert.equal(t.reader.chapterID,'old');assert.equal(t.controller.state.preferences.isEnabled(source),false);
}
{
  const t=setup();vm.runInContext(extract('openReferenceInAdjacentReader','async function openInlineCodeReference('),t.c);
  t.c.resolveReaderSource=async()=>null;
  await t.c.openReferenceInAdjacentReader(t.reader,{sectionNumber:'27-1',codePrefix:'BC68',codeVersion:'exact'});
  assert.equal(t.c.state.readers.length,1);assert.equal(t.reader.chapterID,'old');
  // A deferred metadata lookup cannot replace a Reader after account/context change.
  let resolve;t.c.resolveReaderSource=()=>new Promise(r=>resolve=r);
  const opening=t.c.openReferenceInAdjacentReader(t.reader,{sectionID:'123'});
  t.c.activeWorkspaceID='other';resolve({sectionID:'123',__activeCodeSourceContext:t.controller.captureContext()});await opening;
  assert.equal(t.c.state.readers.length,1);assert.equal(t.reader.chapterID,'old');
}
{
  const t=setup();let passed;
  t.c.openReferenceInAdjacentReader=async(reader,detail)=>{passed=detail;};
  vm.runInContext(extract('openInlineCodeReference','async function openStructuredCodeReference('),t.c);
  const trigger={isConnected:true,setAttribute(){},removeAttribute(){}};
  await t.c.openInlineCodeReference(t.reader,'BC68','27-1',trigger);
  assert.equal(passed.sectionNumber,'27-1');assert.equal(passed.codeVersion,'exact');assert.equal(trigger.disabled,false);
}
{
  const t=setup();await t.controller.ensureCatalog();let reject,entered,refreshes=0;
  const ready=new Promise(r=>entered=r);
  t.c.beginReaderNavigation=panel=>{panel.dataset.readerNavigationToken='nav';return 'nav';};
  t.c.fetchChapter=()=>{entered();return new Promise((_resolve,r)=>reject=r);};
  t.c.refreshReaderContent=async()=>{refreshes++;};
  const opening=t.c.selectReaderNavigation(t.panel,t.reader,{chapterID:'new',sectionID:'section'});await ready;
  t.c.activeWorkspaceID='other';reject(new Error('late fetch failure'));await opening;
  assert.equal(refreshes,0,'Late failed chapter must not refresh another workspace');
}
for (const phase of ['transition','ready']) {
  const t=setup();await t.controller.ensureCatalog();let release,entered,aligned=0,scrolled=0;
  const reached=new Promise(r=>entered=r);
  const pause=()=>{entered();return new Promise(r=>release=r);};
  Object.assign(t.c,{resolveReaderSource:async()=>({sectionID:'target',chapterID:'new',codeVersion:'exact',codePrefix:'BC68',__activeCodeSourceContext:t.controller.captureContext()}),
    isProAccount:()=>true,newReaderState:fields=>({id:'target-reader',...fields}),readerFieldsForSectionDetail:value=>({...value}),
    paneIDForReader:reader=>reader.id,placePaneAfter(){},updateBrowserSectionURL(){},
    transitionWorkspace:phase==='transition'?pause:async()=>{},whenWorkspacePaneReady:phase==='ready'?pause:async()=>true,
    alignReaderSectionAfterLayout(){aligned++;},scrollPaneIntoView(){scrolled++;}});
  vm.runInContext(extract('openReferenceInAdjacentReader','async function openInlineCodeReference('),t.c);
  const opening=t.c.openReferenceInAdjacentReader(t.reader,{sectionID:'target'});await reached;
  t.controller.setContext({accountID:'another-account',sessionID:'new-session'});release(true);await opening;
  assert.equal(aligned,0);assert.equal(scrolled,0);
}
{
  const t=setup();let opened=0,version;
  Object.assign(t.c,{parseCodeJumpAnchor:()=>({kind:'chapter',codePrefix:'BC68',chapterNumber:'1'}),codeDisplayLabel:value=>value,
    fetchChapterList:async(_prefix,requested)=>{version=requested;return [{id:'wrong',codePrefix:'BC68',chapterNumber:'1',codeVersion:'other-edition'}];},
    openReferenceInAdjacentReader:async()=>{opened++;}});
  vm.runInContext(extract('openStructuredCodeReference','function plainTextFromHTML('),t.c);
  await t.c.openStructuredCodeReference(t.reader,'anchor',{isConnected:true,setAttribute(){},removeAttribute(){}});
  assert.equal(version,'exact');assert.equal(opened,0,'Structured references reject another edition');
}
console.log('PASS actual Reader navigation: disabled cancel, explicit enable, stale workspace, reference cancel, metadata-only inline route');
