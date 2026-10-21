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
  const end = source.indexOf('\n  refreshColumnGroupPresentation();', start);
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
  let observeCallback, observed=[], paints=0, reads=0, allowed=false;
  const panel=document.createElement('article');
  class Observer {constructor(callback){observeCallback=callback;}observe(node){observed.push(node);}unobserve(node){observed=observed.filter(n=>n!==node);}}
  const lazy=vm.createContext({document,IntersectionObserver:Observer,readerPrivateContentAllowed:()=>allowed,
    isSectionSaved(){reads++;return true;},renderCodeBlock(){const n=document.createElement('p');n.textContent='Complete source passage';return n;},
    renderInlineCommentBox(){paints++;const n=document.createElement('div');n.className='inline-comment';return n;}});
  const begin=source.indexOf('function renderAnnotatedCodeBlock(');
  vm.runInContext(source.slice(begin,source.indexOf('\n}',begin)+2),lazy);
  const wrapper=lazy.renderAnnotatedCodeBlock({}, {}, {},{sectionID:'s',blockID:'p'},{lazyControls:true,panel});
  assert.equal(wrapper.textContent,'');assert.equal(wrapper.children[0].textContent,'Complete source passage');
  assert.equal(paints,0);assert.equal(observed.length,1);
  observeCallback([{target:wrapper,isIntersecting:true}]);
  assert.equal(paints,1);assert.equal(reads,0,'Deferred actions must not read private state while access is pending');
  assert.equal(observed.length,0);
  wrapper.dispatch('focusin');assert.equal(paints,1,'Keyboard focus must not duplicate controls');
  const saved=lazy.renderAnnotatedCodeBlock({}, {}, {},{sectionID:'s',blockID:'saved'},{lazyControls:true,showBookmark:true,panel});
  assert.equal(saved.children.length,2,'Saved indicators are available immediately, even offscreen');
}
console.log('Large Reader: source text is immediate, offscreen actions are deferred, saved icons stay mounted and privacy gates hold.');
