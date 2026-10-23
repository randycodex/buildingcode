import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {capturePaneScrollPositions} from '../public/workflow-views.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=source.indexOf(`async function ${name}(`);return source.slice(start,source.indexOf('\n}',start)+2);};
const events=[], state={localProjectSections:[]};let finish;
const c=vm.createContext({state, requirePrivateWorkspaceWritable(){},captureAccountRequest:()=>1,activeAccount:()=>({userID:'a'}),hasCapability:()=>true,
 projectSectionRecordForSection:()=>({id:'project-section',sectionID:'s'}),projectSectionMutationForSection:()=>({id:'mutation'}),
 enqueueSyncMutation(){events.push('outbox');},saveWorkspaceState(){events.push('persist');},
 syncReaderNoteBookmarkButtons(){assert.equal(state.localProjectSections.length,1);events.push('reader');},
 syncSearchResultBookmarkButtons(){events.push('search');},refreshProjectMembershipPanes:async()=>{},requireCurrentAccountRequest(){},
 pushMutation:()=>new Promise(resolve=>{finish=resolve;events.push('network');}),refreshProjectSourceConsumers:async()=>{},isSessionAuthenticationError:()=>false});
vm.runInContext(actual('persistSectionInProject'),c);
const saving=c.persistSectionInProject({id:'p'},{sectionID:'s',codeVersion:'2022'});
assert.deepEqual(events,['outbox','persist','reader','search','network']);
finish();await saving;
const scroller={scrollTop:120,scrollLeft:0};
const pane={scrollTop:0,scrollLeft:0,querySelectorAll(selector){assert.notEqual(selector,'*','Scroll capture must not force layout for every source paragraph');return [scroller];}};
assert.equal(capturePaneScrollPositions(pane)[0].node,scroller);

// Browser fallback re-insertion resets nested scrolling; restore the real helper's snapshot.
{
  const nested = {scrollTop: 120, scrollLeft: 35};
  const moving = {scrollTop: 10, scrollLeft: 0, querySelectorAll: () => [nested]};
  const track = {children: [{}], insertBefore(node) {
    node.scrollTop = 0; nested.scrollTop = 0; nested.scrollLeft = 0;
  }};
  moving.parentNode = track;
  const start = source.indexOf('  nodes.forEach((node, index) => {', source.indexOf('function appendPaneSequence('));
  const end = source.indexOf('\n  // Finish ordering and group visibility', start);
  assert.ok(start > 0 && end > start);
  vm.runInNewContext(source.slice(start, end), {track, nodes: [moving], capturePaneScrollPositions});
  assert.equal(moving.scrollTop, 10);
  assert.equal(nested.scrollTop, 120);
  assert.equal(nested.scrollLeft, 35);
}
console.log('Workspace feedback: durable local save paints before network; scroll capture avoids all-descendant layout reads.');

// A long section retains its body while mounting actions only near the viewport.
{
  const {documentFixture}=await import('./helpers/workflow-dom.mjs');
  const document=documentFixture();
  const base=document.createElement;
  document.createElement=tag=>{const node=base(tag);node.removeAttribute=key=>delete node.attributes[key];return node;};
  let observeCallback, observed=[], paints=0, reads=0, snapshots=0, allowed=false, currentSavedKeys=new Set();
  const paintOptions = [];
  let linkPasses=0, definitionPasses=0;
  const panel=document.createElement('article');
  class Observer {constructor(callback){observeCallback=callback;}observe(node){observed.push(node);}unobserve(node){observed=observed.filter(n=>n!==node);}}
  const lazy=vm.createContext({document,IntersectionObserver:Observer,
    linkInlineCodeReferences(){linkPasses++;},decorateReaderDefinitions(){definitionPasses++;},readerPrivateContentAllowed:()=>allowed,
    workspaceSavedEvidenceKeys(){snapshots++;return currentSavedKeys;},
    isSectionSaved(target,_version,keys){reads++;return (keys || currentSavedKeys).has(target.blockID);},renderCodeBlock(){const n=document.createElement('p');n.textContent='Complete source passage';return n;},
    renderInlineCommentBox(_section,_reader,_target,options){paints++;paintOptions.push(options);const n=document.createElement('div');n.className='inline-comment';return n;}});
  const begin=source.indexOf('function renderAnnotatedCodeBlock(');
  vm.runInContext(source.slice(begin,source.indexOf('\n}',begin)+2),lazy);
  const wrapper=lazy.renderAnnotatedCodeBlock({}, {}, {},{sectionID:'s',blockID:'p'},{lazyControls:true,lazyDecorations:true,panel});
  assert.equal(linkPasses+definitionPasses,0,'Offscreen source text does not build interactive term/reference wrappers');
  assert.equal(wrapper.textContent,'');assert.equal(wrapper.children[0].textContent,'Complete source passage');
  assert.equal(paints,0);assert.equal(observed.length,1);
  observeCallback([{target:wrapper,isIntersecting:true}]);
  assert.equal(linkPasses,1);assert.equal(definitionPasses,1,'Visible text gains both reference and definition navigation');
  assert.equal(paints,1);assert.equal(reads,0,'Deferred actions must not read private state while access is pending');
  assert.equal(snapshots,0);
  assert.equal(observed.length,0);
  wrapper.dispatch('focusin');assert.equal(paints,1,'Keyboard focus must not duplicate controls');
  const saved=lazy.renderAnnotatedCodeBlock({}, {}, {},{sectionID:'s',blockID:'saved'},{lazyControls:true,showBookmark:true,panel});
  assert.equal(saved.children.length,2,'Saved indicators are available immediately, even offscreen');
  allowed=true;
  const first=lazy.renderAnnotatedCodeBlock({}, {}, {},{sectionID:'s',blockID:'one'},{lazyControls:true,panel});
  const second=lazy.renderAnnotatedCodeBlock({}, {}, {},{sectionID:'s',blockID:'two'},{lazyControls:true,panel});
  currentSavedKeys=new Set(['two']);
  observeCallback([{target:first,isIntersecting:true},{target:second,isIntersecting:true}]);
  assert.equal(snapshots,1,'One current saved-key index serves the whole visible batch');
  assert.equal(reads,2);
  assert.deepEqual(paintOptions.slice(-2).map(options=>options.showBookmark),[false,true]);
  assert.ok(paintOptions.slice(-2).every(options=>options.bookmarkStateResolved),'Eager control/subscription paint must reuse the fresh resolved state');
  observeCallback([{target:first,isIntersecting:true},{target:second,isIntersecting:false}]);
  assert.equal(snapshots,1,'Already mounted or nonintersecting blocks do not read workspace data');
  const keyboard=lazy.renderAnnotatedCodeBlock({}, {}, {},{sectionID:'s',blockID:'three'},{lazyControls:true,panel});
  currentSavedKeys=new Set(['three']);
  keyboard.dispatch('focusin');
  assert.equal(paintOptions.at(-1).showBookmark,true,'Later keyboard mounting reads fresh saved state');
}
console.log('Large Reader: source text is immediate, offscreen actions are deferred, saved icons stay mounted and privacy gates hold.');
