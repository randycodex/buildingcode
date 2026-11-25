import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {notebookReferenceKinds} from '../src/notebook-schema.js';
import {notebookPassageGroups,createNotebookPassageDisclosure} from '../public/notebook-passage-disclosure.js';

const header=id=>({id:`header-${id}`,type:'paragraph',content:[{type:'permitextReference',props:{referenceKind:'selectedPassage',referenceID:id,label:`Section ${id}`}}]});
const text=(id,value)=>({id,type:'paragraph',content:[{type:'text',text:value,styles:{}}]});
let document={document:[header('a'),text('body-a','Captured A'),text('comment','My own comments'),text('duplicate','Captured A'),header('b'),text('body-b','Captured B')]};
const links=[{id:'a',passages:[{exact:'Captured A'}]},{id:'b',passages:[{exact:'Captured B'}]}];
const before=JSON.stringify(document);
let groups=notebookPassageGroups(document,links);
assert.deepEqual([...groups],[['a',['body-a']],['b',['body-b']]],'Only each captured paragraph folds, not authored comments or a later duplicate quote.');
const edited=structuredClone(document);edited.document[1].content[0].text='Edited passage';
assert.deepEqual(notebookPassageGroups(edited,links,groups).get('a'),['body-a'],'An already-associated passage remains foldable during edits.');
edited.document.splice(1,1);edited.document=edited.document.filter(block=>block.id!=='duplicate');
assert.equal(notebookPassageGroups(edited,links,groups).has('a'),false,'Deleting a passage never assigns an unrelated comment to its title.');
assert.equal(JSON.stringify(document),before);

const references=['a','b','missing'].map(id=>({
  dataset:{referenceId:id,referenceLabel:`Section ${id}`},
  classList:new Set()
}));
for (const reference of references) reference.classList.remove=reference.classList.delete;
const buttons=references.map(reference=>({hidden:true,attrs:{},
 closest:()=>reference,
 setAttribute(name,value){this.attrs[name]=value;}}));
const styles=[],observers=[];
const ownerDocument={createElement:()=>({textContent:'',remove(){this.removed=true;}}),head:{append(style){styles.push(style);}},
 defaultView:{CSS:{escape:value=>value},MutationObserver:class {constructor(callback){this.callback=callback;observers.push(this);}observe(_element,options){assert.equal(options.attributes,undefined);}disconnect(){this.disconnected=true;}}}};
const element={dataset:{},ownerDocument,querySelectorAll:selector=>selector==='[data-permitext-reference]'?references:buttons};
let themes={a:'building',b:'mechanical'};
const disclosure=createNotebookPassageDisclosure(element,{getDocument:()=>document,getEvidenceLinks:()=>links,
 getReferenceTheme:(_reference,link)=>themes[link?.id]});
const ref=id=>({dataset:{referenceId:id}});
assert.deepEqual(buttons.map(button=>button.hidden),[false,false,true]);
assert.deepEqual(references.map(reference=>Array.from(reference.classList)),[['code-theme-building'],['code-theme-mechanical'],[]]);
assert.equal(buttons[0].attrs['aria-expanded'],'true');
assert.equal(disclosure.toggle(ref('a')),true);
assert.equal(buttons[0].attrs['aria-expanded'],'false');
assert.match(styles[0].textContent,/body-a/);assert.doesNotMatch(styles[0].textContent,/comment|duplicate|body-b/);
disclosure.toggle(ref('b'));disclosure.toggle(ref('a'));
assert.equal(buttons[0].attrs['aria-expanded'],'true');assert.equal(buttons[1].attrs['aria-expanded'],'false');
assert.doesNotMatch(styles[0].textContent,/body-a/);assert.match(styles[0].textContent,/body-b/);
assert.equal(JSON.stringify(document),before,'Collapsing cannot mutate the saved document or its exports.');
themes={a:'electrical'};
observers[0].callback();await Promise.resolve();
assert.equal(buttons[1].attrs['aria-expanded'],'false','A view refresh retains each section’s independent state.');
assert.deepEqual(references.map(reference=>Array.from(reference.classList)),[['code-theme-electrical'],[],[]]);
disclosure.destroy();assert.equal(styles[0].removed,true);assert.equal(observers[0].disconnected,true);
assert.equal(disclosure.toggle(ref('a')),false);

const editorSource=await readFile(new URL('../src/notebook-editor.js',import.meta.url),'utf8');
const renderer=editorSource.slice(editorSource.indexOf('const notebookReferenceCodeNames'),editorSource.indexOf('const notebookBlockSpecs'));
const c=vm.createContext({notebookReferenceKinds,React:{createElement:(type,props,...children)=>({type,props,children})},
 createReactInlineContentSpec:(_schema,implementation)=>implementation});
vm.runInContext(renderer+'\nglobalThis.referenceRenderer=PermitextReference;',c);
const view=c.referenceRenderer.render({inlineContent:{props:{referenceKind:'selectedPassage',referenceID:'a',label:'BC · 2022 · § 101.2 · Scope'}}});
assert.equal(view.type,'span');assert.equal(view.children.length,2);
const [sourceButton,toggleButton]=view.children;
assert.equal(sourceButton.type,'button');
assert.equal(sourceButton.props['aria-label'],'Open BC · 2022 · § 101.2 · Scope');
assert.equal(sourceButton.props['data-notebook-passage-toggle'],undefined);
assert.equal(sourceButton.children[0].children[0],'BC · 2022 · § 101.2');
assert.equal(sourceButton.children[1].children[0],'Scope');
assert.equal(toggleButton.type,'button');
assert.equal(toggleButton.props['data-notebook-passage-toggle'],'true');
assert.equal(toggleButton.props.hidden,true);

const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const themeStart=app.indexOf('function notebookReferenceTheme(');
const themeSource=app.slice(themeStart,app.indexOf('function notebookCanonicalReferenceLabel',themeStart));
const codeOptions=[{prefix:'BC',theme:'building'},{prefix:'MC',theme:'mechanical'}];
const referenceTheme=vm.runInNewContext(`${themeSource}\nnotebookReferenceTheme`,{
 codeOptions,notebookReferenceCodeTitle:prefix=>prefix==='BC'?'Building Code':'Mechanical Code'
});
const citation=(referenceKind,referenceLabel)=>({dataset:{referenceKind,referenceLabel}});
assert.equal(referenceTheme(citation('selectedPassage','BC · Title'),{source:{codePrefix:' MC '}}),'mechanical');
assert.equal(referenceTheme(citation('canonicalSection','Building Code · 2022 · § 101.2 · Scope')),'building');
assert.equal(referenceTheme(citation('selectedPassage','MC § 101.2')),'mechanical');
assert.equal(referenceTheme(citation('researchAnswer','BC · Title')),undefined);
assert.equal(referenceTheme(citation('selectedPassage','Unrecognized · Title')),undefined);
const start=app.indexOf('      const activateFocusedReference = (referenceElement, togglePassage');
const handlers=app.slice(start,app.indexOf('      const footer =',start));
const listeners={},calls=[];
const context=vm.createContext({disposed:false,isCurrentAccountRequest:()=>true,requestIdentity:{},renderSequence:1,editorRenderSequence:1,
 activeCard:{id:'note',evidenceLinks:links},focusedCardID:'note',focusedPassageDisclosure:{toggle:()=>calls.push('toggle')},
 editorElement:{addEventListener:(name,listener)=>listeners[name]=listener},identity:{},foundation:{},loadCard(){},paneID:'notes',projectID:'project',
 openNotebookReference:async()=>{calls.push('source');},showWebNotice:()=>assert.fail('Unexpected navigation error')});
vm.runInContext(handlers,context);
const event=(toggle,key)=>({key,target:{closest:selector=>selector==='[data-permitext-reference]'?ref('a'):toggle?{}:null},preventDefault(){},stopPropagation(){}});
listeners.click(event(true));listeners.keydown(event(true,'Enter'));listeners.keydown(event(true,' '));
assert.deepEqual(calls,['toggle','toggle','toggle']);
listeners.click(event(false));listeners.keydown(event(false,'Enter'));
assert.deepEqual(calls.slice(-2),['source','source'],'Pointer and keyboard both open the source.');
context.editorRenderSequence++;listeners.click(event(true));assert.equal(calls.length,5,'A stale Note cannot toggle or navigate.');
console.log('Passage citations passed: code colors, source navigation, independent disclosure, and content preservation.');
