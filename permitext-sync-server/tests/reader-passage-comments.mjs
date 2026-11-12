import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('function openReaderPassageComments('),end=source.indexOf('\n}',start)+2;
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.events={};this.attributes={};this.className='';this.isConnected=true;}
  append(...nodes){this.children.push(...nodes.filter(node=>typeof node==='object'));}
  setAttribute(key,value){this.attributes[key]=value;}
  querySelector(selector){return this.children.find(node=>selector.startsWith('.')?node.className===selector.slice(1):node.tag===selector)||this.children.map(node=>node.querySelector(selector)).find(Boolean)||null;}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  addEventListener(name,fn){(this.events[name]||=[]).push(fn);}
  dispatch(name){for(const fn of this.events[name]||[])fn({});}
  replaceChildren(){this.children=[];this.textContent='';}
  remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}
  focus(){doc.activeElement=this;}
  click(){this.dispatch('click');}
}
let doc;
function fixture(value='Existing legacy comment'){
  let account=1,remote=value,editor,callback;const writes=[];
  doc={activeElement:null,createElement:tag=>new Element(tag)};
  const panel=new Element('article'),block=new Element('div'),anchor=new Element('button');
  anchor.closest=selector=>selector==='.annotated-code-block'?block:null;
  block.after=node=>{node.parent=panel;panel.children.push(node);};
  const target={sectionID:'101',sectionNumber:'101.1',codeVersion:'2014',blockID:'exact',title:'Title'};
  const history={deletions:[]};
  const c=vm.createContext({document:doc,state:{syncConflicts:[],localAnnotations:[]},activeWorkspaceID:'workspace',
    captureAccountRequest:()=>account,isCurrentAccountRequest:id=>id===account,readerPrivateContentAllowed:()=>true,
    hasCapability:()=>true,visibleSyncedTargetKey:item=>JSON.stringify(item),detailNoteValueForTarget:()=>remote,
    circleXIconSVG:()=>'',sectionDisplayTitle:(number,title)=>`${number} ${title}`,evidenceCommentUndoState:()=>history,
    createEvidenceCommentsEditor(text,label,undo){
      assert.equal(undo,history);editor=new Element('div');editor.value=text;editor.undoNotice=new Element('div');
      if(text)editor.append(new Element('textarea'));
      editor.addComment=()=>{editor.append(new Element('textarea'));editor.dispatch('input');};return editor;
    },pendingAnnotationNoteForTarget:()=>null,toggleAccountDialog(){},flushSyncOutbox:async()=>{},saveWorkspaceState(){},
    setAnnotationNoteValue:(item,text,onStatus)=>{writes.push({item,text});remote=text;callback=onStatus;return true;},syncReaderNoteControls(){}
  });
  vm.runInContext(source.slice(start,end),c);
  const region=c.openReaderPassageComments(panel,target,anchor);
  return{c,panel,region,target,writes,get editor(){return editor;},setRemote:text=>{remote=text;},blur:()=>{doc.activeElement=null;},changeAccount:()=>account++,ack:()=>callback?.('synced')};
}
{
  const original='## Passage comments\n\n### Comment 1\nOriginal\n\n### Comment 2\nKeep exactly';
  const f=fixture(original);
  assert.equal(f.editor.value,original);assert.equal(f.writes.length,0,'Opening comments never rewrites existing data');
  f.setRemote('Remote update');f.region._refresh();
  assert.equal(f.editor.value,original,'A remote update cannot replace a focused draft');
  f.blur();f.region._refresh();assert.equal(f.editor.value,'Remote update');
  f.editor.value=original+'\nAdditional text';f.editor.dispatch('input');
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].item,f.target);
  assert.equal(f.writes[0].text,original+'\nAdditional text','The existing serialized field and exact edition/block are retained');
  f.c.openReaderPassageComments(f.panel,f.target,{closest(){throw Error('Should reuse current editor');}});
  assert.equal(f.panel.children.length,1,'Repeated clicks do not create another editor or column');
  f.changeAccount();f.ack();f.region._refresh();assert.equal(f.region.isConnected,false,'Private comments retire after an account change');
  f.editor.value='Stale edit';f.editor.dispatch('input');assert.equal(f.writes.length,1,'Stale editors cannot write');
}
{
  const f=fixture('');assert.equal(f.writes.length,0,'A blank editor does not create a deletion or annotation');
  f.c.activeWorkspaceID='other';f.editor.value='Wrong workspace';f.editor.dispatch('input');
  assert.equal(f.writes.length,0);assert.equal(f.editor.readOnly,true);
}
console.log('Reader passage comments passed: legacy serialized data, exact scope, no writes on open, focused draft preservation, editor reuse and stale account/workspace guards.');
