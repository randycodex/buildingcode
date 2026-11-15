import assert from 'node:assert/strict';
import {createNotebookReferenceTransition} from '../public/notebook-reference-transition.js';
import {notebookColumnsLayout} from '../public/workflow-views.js';

for (const available of [1671,1920]) for (const shared of [300,450,600]) {
  const reference = kind => notebookColumnsLayout([{kind,preferredWidth:kind==='reader'?900:300},
    {kind:'notes'},{kind:'editor'}],available,4,shared);
  assert.deepEqual(reference('reader'),reference('evidence'),'Both references occupy exactly the same slot, including at the writing minimum.');
  assert.ok(reference('reader')[2]>=800);
}

const animations=[];
const makePane = (id,hidden=false) => ({
  dataset:{paneId:id},isConnected:true,inert:false,hidden,
  draft:`Live content for ${id}`,style:new Map(),
  classList:{contains(name){return name==='is-workflow-hidden'&&this.owner.hidden;},owner:null},
  getBoundingClientRect:()=>({left:1,width:450}),
  cloneNode(){assert.fail('Live references must never be replaced with snapshots.');},
  animate(frames,options){
    let resolve,reject;const finished=new Promise((yes,no)=>{resolve=yes;reject=no;});
    const animation={frames,options,finished,finish:resolve,cancel(){this.cancelled=true;reject(Error('Cancelled'));}};
    animations.push(animation);return animation;
  }
});
const reader=makePane('reader:one'),evidence=makePane('utility:saved:one',true);
const notes=makePane('project:notes-index:p'),editor=makePane('project:notebook:p');
const panes=[reader,evidence,notes,editor];
for (const pane of panes) {
  pane.classList.owner=pane;
  pane.style.setProperty=(name,value)=>pane.style.set(name,value);
  pane.style.removeProperty=name=>pane.style.delete(name);
}
const host={scrollLeft:0,getBoundingClientRect:()=>({left:0})};
let context='project:notebook',reduce=false;
const controller=createNotebookReferenceTransition({host,panes:()=>panes,context:()=>context,reducedMotion:()=>reduce});
const swap = target => {reader.hidden=target!=='reader';evidence.hidden=target!=='evidence';};
const writingBefore=[notes.draft,editor.draft,[...notes.style],[...editor.style]];

controller.begin('evidence');swap('evidence');
evidence.dataset.workspacePaneLoading='true';controller.sync();
assert.equal(reader.dataset.notebookReferenceCover,'true','The live outgoing column covers the loading shell.');
assert.equal(reader.inert,true);assert.equal(animations.length,0);
delete evidence.dataset.workspacePaneLoading;controller.sync();
assert.equal(animations.length,1);assert.equal(animations[0].options.duration,80);
assert.deepEqual(animations[0].frames,[{clipPath:'inset(0 0 0 0)'},{clipPath:'inset(0 100% 0 0)'}]);
assert.equal(reader.dataset.notebookReferenceCover,'true','The old reference stays painted throughout the reveal.');
animations[0].finish();await Promise.resolve();
assert.equal(reader.dataset.notebookReferenceCover,undefined);assert.equal(reader.inert,false);
assert.equal(reader.style.size,0);

controller.begin('reader');swap('reader');reader.dataset.readerTabPending='true';controller.sync();
assert.equal(evidence.dataset.notebookReferenceCover,'true','Source navigation retains the outgoing Evidence until Reader is ready.');
assert.equal(animations.length,1);delete reader.dataset.readerTabPending;
controller.sync();const old=animations.at(-1);
controller.begin('evidence');swap('evidence');controller.sync();
assert.equal(old.cancelled,true,'A fast reversal cancels the previous animation.');
assert.equal(evidence.dataset.notebookReferenceCover,undefined,'Returning to the retained reference does not leave a cover over it.');
await Promise.resolve();

controller.begin('reader');swap('reader');context='other-project:notebook';controller.sync();
assert.equal(evidence.dataset.notebookReferenceCover,undefined,'Project/view changes release the previous reference.');
context='project:notebook';reduce=true;
controller.begin('evidence');swap('evidence');evidence.dataset.workspacePaneLoading='true';controller.sync();
assert.equal(reader.dataset.notebookReferenceCover,'true','Reduced motion still waits for ready content.');
const count=animations.length;delete evidence.dataset.workspacePaneLoading;controller.sync();
assert.equal(animations.length,count);assert.equal(reader.dataset.notebookReferenceCover,undefined);

reduce=false;controller.begin('reader');swap('reader');reader.dataset.workspacePaneUnavailable='true';controller.sync();
assert.equal(evidence.dataset.notebookReferenceCover,undefined,'A failed load exposes its retry state.');
delete reader.dataset.workspacePaneUnavailable;
controller.begin('evidence');swap('evidence');controller.sync();controller.cancel();
await Promise.resolve();
assert.ok(panes.every(pane=>!pane.dataset.notebookReferenceCover&&!pane.inert));
assert.deepEqual([notes.draft,editor.draft,[...notes.style],[...editor.style]],writingBefore,
  'Notes and the notepad keep their live content and styles through every swap.');
console.log('Notebook reference transitions passed: equal slot widths, retained live content until ready, no writing-area animation or opacity fades, rapid reversals, reduced motion, failures and context cleanup.');
