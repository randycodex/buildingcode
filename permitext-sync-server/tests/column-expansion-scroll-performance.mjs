import assert from 'node:assert/strict';
import {createColumnExpansion} from '../public/column-expansion.js';
import {documentFixture} from './helpers/workflow-dom.mjs';

const document = documentFixture(), create = document.createElement;
let paragraphReads = 0, scrollerReads = 0, restoredAnchors = 0;
document.createElement = tag => {
  const node = create(tag);
  node.scrollLeft = 0;
  Object.defineProperty(node, 'parentElement', {get: () => node.parentNode});
  node.before = other => {const parent=node.parentNode;other.parentNode=parent;parent.children.splice(parent.children.indexOf(node),0,other);};
  node.classList = {
    contains: name => node.className.split(/\s+/).includes(name),
    toggle(name, on) {const names=new Set(node.className.split(/\s+/).filter(Boolean));if(on) names.add(name);else names.delete(name);node.className=[...names].join(' ');}
  };
  return node;
};
const root=document.createElement('main'), host=document.createElement('section');
host.clientWidth=1400;host.scrollLeft=96;root.append(host);
const panes = ['one','two'].map(id => {
  const pane=document.createElement('article');pane.className='workspace-panel';pane.dataset.paneId=id;
  const scroller=document.createElement('div');scroller.className='reader-content';
  let top=id==='one'?333:777, left=17;
  Object.defineProperties(scroller, {
    scrollTop:{get(){scrollerReads++;return top;},set(value){top=value;}},
    scrollLeft:{get(){scrollerReads++;return left;},set(value){left=value;}}
  });
  const draft=document.createElement('textarea');draft.value=`Unsaved ${id}`;scroller.append(draft);
  for(let index=0;index<5000;index++) {
    const passage=document.createElement('p');passage.textContent=`Complete source passage ${index}`;
    for(const key of ['scrollTop','scrollLeft']) Object.defineProperty(passage,key,{get(){paragraphReads++;return 0;}});
    scroller.append(passage);
  }
  pane.append(scroller);host.append(pane);pane.scroller=scroller;pane.draft=draft;return pane;
});
const frames=[];
globalThis.document=document;
globalThis.requestAnimationFrame=fn=>frames.push(fn);
globalThis.matchMedia=()=>({matches:true});
const observations=[];
globalThis.MutationObserver=class {observe(node,options){observations.push({node,options});}disconnect(){}};
globalThis.ResizeObserver=class {observe(){}disconnect(){}};
try {
  const controller=createColumnExpansion({host,columns:()=>panes,label:node=>node.dataset.paneId,menu:false,
    capturePosition:()=>({anchor:'source'}),restorePosition:position=>{assert.equal(position.anchor,'source');restoredAnchors++;}});
  assert.ok(observations.every(({options})=>!options.subtree),'Layout observation must never subscribe to thousands of nested passage mutations');
  assert.deepEqual(observations.map(({node})=>node),[host,...panes],'Observe host membership and only direct pane layout attributes');
  assert.equal(paragraphReads,0,'Initial expansion setup cannot read scroll geometry from 10,000 non-scrolling paragraphs');
  assert.ok(scrollerReads<=12,'Only the two actual scrolling containers are measured');
  controller.expand(panes[0]);
  assert.equal(panes[1].classList.contains('is-column-strip'),true);
  panes[1].scroller.scrollTop=0;panes[1].scroller.scrollLeft=0;
  controller.restore();
  assert.equal(panes[1].scroller.scrollTop,777,'Expand/restore retains nested vertical position');
  assert.equal(panes[1].scroller.scrollLeft,17,'Expand/restore retains nested horizontal position');
  assert.equal(host.scrollLeft,96);
  assert.equal(panes[1].draft.value,'Unsaved two');
  host.clientWidth=700;controller.refresh();frames.shift()();
  assert.equal(host.classList.contains('has-column-tabs'),true);
  assert.equal(panes[1].classList.contains('is-column-tab-hidden'),true);
  panes[1].scroller.scrollTop=0;
  host.clientWidth=1400;controller.refresh();frames.shift()();
  assert.equal(panes[1].scroller.scrollTop,777,'Returning from narrow tabs restores the retained column position');
  assert.equal(paragraphReads,0,'Expand, restore and narrow-layout changes never measure source paragraphs');
  assert.equal(panes[0].scroller.children.length,5001,'Every source passage and the draft remain mounted');
  assert.ok(restoredAnchors>=5,'Reader passage anchors continue through the existing restoration hook');
  controller.dispose();
} finally {
  for(const key of ['document','requestAnimationFrame','matchMedia','MutationObserver','ResizeObserver']) delete globalThis[key];
}
console.log('Column expansion passed: zero scroll-geometry reads across 10,000 source paragraphs; expand/restore, narrow tabs, nested scroll, source text and drafts preserved.');
