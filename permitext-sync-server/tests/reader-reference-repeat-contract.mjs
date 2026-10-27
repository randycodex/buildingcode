import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
function fixture() {
  const origin = {id:'origin', codePrefix:'BC', codeVersion:'edition-a', chapterID:'10', sectionID:'origin-section'};
  const target = {id:'target', referenceSourceReaderID:'origin', codePrefix:'BC', codeVersion:'edition-a', chapterID:'10', sectionID:'2152', sectionNumber:'1004.1.3', shouldSmoothScrollToSection:false};
  const detail = {...target, __activeCodeSourceContext:{generation:1}};
  const calls = {resolved:0, rendered:0, aligned:0, revealed:0, saved:0, moved:0};
  const panelClasses = new Set(), contentClasses = new Set();
  let offset = 0, missing = false, enabled = true;
  const title = {isConnected:true, getBoundingClientRect:()=>({top:210 + offset, height:24, bottom:234 + offset})};
  const section = {querySelector:()=>title};
  const content = {
    scrollTop:4000, classList:{contains:name=>contentClasses.has(name)},
    getBoundingClientRect:()=>({top:84,bottom:800}),
    querySelector:selector=>!missing && (selector.includes('"2152"') || selector.includes('"1004.1.3"')) ? section : null
  };
  const panel = {isConnected:true, dataset:{readerPublicCorpusGeneration:'1'},
    classList:{contains:name=>panelClasses.has(name)},
    querySelector:()=>content, getBoundingClientRect:()=>({top:84})};
  const state = {readers:[origin,target]};
  const context = vm.createContext({
    state, activeWorkspaceID:'workspace', publicCodeRevision:{generation:1}, readerReferenceOpeningAttempts:new Map(), readerReferenceNeedsPassage:()=>false,
    CSS:{escape:value=>value}, getComputedStyle:()=>({height:'126px'}),
    syncCodeVersion:value=>value, syncCodeVersionForPrefix:()=> 'edition-a',
    normalizeAnnotationBlockID:value=>value || '',
    captureAccountRequest:()=>1, isCurrentAccountRequest:()=>true,
    activeCodeSourcesController:{isCurrent:()=>true},
    resolveReaderSource:async value=>{calls.resolved++; return enabled ? {...value, ...detail} : null;},
    track:{querySelector:()=>panel}, paneIDForReader:reader=>`reader:${reader.id}`,
    isProAccount:()=>true, searchLinkedReadersBySearch:()=>({}),
    placePaneAfter(){calls.moved++;}, updateBrowserSectionURL(){}, scheduleContinuitySync(){},
    saveWorkspaceState(){calls.saved++;},
    async transitionWorkspace(){calls.rendered++; content.scrollTop=0;}, whenWorkspacePaneReady:async()=>true,
    alignReaderSectionAfterLayout(){calls.aligned++; content.scrollTop=4000;},
    scrollPaneIntoView(){calls.revealed++;}, showWebNotice:async()=>{throw new Error('Unexpected notice');}
  });
  vm.runInContext(['readerFieldsForSectionDetail','readerContentScrollKey','savedReaderTarget',
    'readerSectionTitleNode','readerAlreadyAtReferenceTarget','openReferenceInAdjacentReader'].map(actual).join('\n'), context);
  panel.dataset.readerContentKey = context.readerContentScrollKey(target);
  return {context, origin, target, detail, calls, panel, content, panelClasses, contentClasses,
    set offset(value){offset=value;}, set missing(value){missing=value;}, set enabled(value){enabled=value;},
    open:()=>context.openReferenceInAdjacentReader(origin, detail)};
}

for (const offset of [0, -0.7, 1.4]) {
  const f = fixture(); f.offset=offset;
  const original = JSON.stringify(f.context.state);
  await f.open(); await f.open();
  assert.equal(f.calls.resolved,2, 'Repeated clicks still validate active source access');
  assert.equal(f.calls.rendered,0, 'Do not rebuild an already positioned Source Reader');
  assert.equal(f.calls.aligned,0, 'Do not schedule another scroll alignment');
  assert.equal(f.content.scrollTop,4000);
  assert.equal(JSON.stringify(f.context.state),original);
  assert.equal(f.calls.saved,0); assert.equal(f.calls.moved,0);
  assert.equal(f.calls.revealed,2, 'An offscreen column can still be revealed horizontally');
}
for (const change of [
  f=>{f.offset=150;}, f=>{f.offset=-100;},
  f=>{f.detail.sectionID='different-section';},
  f=>{f.detail.codeVersion='edition-b';},
  f=>{f.detail.chapterID='other-chapter';},
  f=>{f.missing=true;}, f=>{f.panel.isConnected=false;},
  f=>{f.panel.dataset.workspacePaneLoading='true';},
  f=>{f.panel.dataset.readerContentKey='stale-render';},
  f=>{f.panel.dataset.readerPublicCorpusGeneration='0';},
  f=>{f.panelClasses.add('is-collapsed');}, f=>{f.panelClasses.add('is-workflow-hidden');},
  f=>{f.contentClasses.add('is-searching-reader');}
]) {
  const f=fixture(); change(f);
  await f.open();
  assert.equal(f.calls.rendered,1, 'Different, moved, hidden or stale targets still navigate');
  assert.equal(f.calls.aligned,1);
}
const disabled=fixture(); disabled.enabled=false;
await disabled.open();
assert.equal(disabled.calls.rendered,0); assert.equal(disabled.calls.revealed,0);
assert.equal(disabled.content.scrollTop,4000, 'Declining source access leaves the visible Reader untouched');
console.log('Repeated Reader references passed: preserve aligned exact-source content, tolerate pixel rounding, retain access checks and navigate moved/different/stale targets.');

// Only the latest link clicked in a source Reader may publish after async metadata.
const race=fixture(), pending=new Map();
race.context.activeCodeSourcesController.captureContext=()=>({generation:1});
race.context.resolveReaderCodeReference=(_reader,request)=>new Promise(resolve=>pending.set(request.number,resolve));
const old=race.context.openReferenceInAdjacentReader(race.origin,{referenceRequest:{number:'old'}});
const recent=race.context.openReferenceInAdjacentReader(race.origin,{referenceRequest:{number:'recent'}});
pending.get('recent')(race.detail);await recent;
pending.get('old')(race.detail);await old;
assert.equal(race.calls.resolved,1,'Late metadata from an older click cannot reach source access or navigation');
const switched=fixture();let finish;
switched.context.activeCodeSourcesController.captureContext=()=>({generation:1});
switched.context.resolveReaderCodeReference=()=>new Promise(resolve=>finish=resolve);
const opening=switched.context.openReferenceInAdjacentReader(switched.origin,{referenceRequest:{number:'101'}});
switched.context.activeWorkspaceID='elsewhere';finish(switched.detail);await opening;
assert.equal(switched.calls.resolved,0);assert.equal(switched.calls.rendered,0);
console.log('Reference request races passed: latest click wins, stale workspace cannot navigate.');

// Select controls normalize numeric catalog chapter IDs to strings on hydration.
// That changes representation, not the destination or navigation ownership.
const normalized=fixture();normalized.offset=150;
normalized.context.transitionWorkspace=async()=>{normalized.calls.rendered++;normalized.target.chapterID=10;};
await normalized.open();
assert.equal(normalized.calls.revealed,1,'Hydrated string/number IDs must not silently cancel the reveal');
assert.equal(normalized.calls.aligned,1);
console.log('Reader identity normalization passed: equivalent numeric/string chapter IDs still reveal and align.');
