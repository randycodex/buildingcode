import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {notebookReferenceKinds} from '../src/notebook-schema.js';

const source=await readFile(new URL('../src/notebook-editor.js',import.meta.url),'utf8');
const mount=source.slice(source.indexOf('export function mountPermitextNotebookEditor')).replace('export function','function');
const normalize=source.slice(source.indexOf('function normalizedReference('),source.indexOf('function wrappedDocument('));
const reference={referenceKind:'selectedPassage',referenceID:'exact-passage',label:'BC · 2022 · § 101.1'};
for(const last of [
 {id:'last',type:'paragraph',content:[{type:'text',text:'Keep this final sentence.'}],children:[]},
 {id:'last',type:'numberedListItem',content:[{type:'text',text:'Keep this list.'}],children:[{id:'child',type:'bulletListItem',content:[{type:'text',text:'Nested last line.'}]}]},
 {id:'last',type:'image',props:{url:'permitext-notebook-asset:test'},children:[]}
]) {
 const blocks=[{id:'first',type:'paragraph',content:[{type:'text',text:'Selected text at the start.'}]},last];
 const before=structuredClone(blocks),calls=[];
 const editor={document:blocks,
  insertInlineContent:()=>assert.fail('Appending must not replace the current selection'),
  insertBlocks(added,anchor,placement){assert.equal(anchor,last);assert.equal(placement,'after');calls.push('insert');const next={id:'appended',...JSON.parse(JSON.stringify(added[0]))};this.document.push(next);return [next];},
  setTextCursorPosition(block,position){assert.equal(block,this.document.at(-1));assert.equal(position,'end');calls.push('cursor');},
  focus(){calls.push('focus');}
 };
 class HTMLElement {}
 const c=vm.createContext({HTMLElement,notebookReferenceKinds,React:{createElement:(_component,props)=>props},PermitextNotebookEditor(){},
  createRoot:()=>({render:props=>{props.controllerRef.current=editor;},unmount(){}})});
 vm.runInContext(normalize+mount,c);
 const controller=c.mountPermitextNotebookEditor(new HTMLElement());
 assert.equal(controller.appendReference(reference),true);
 assert.deepEqual(editor.document.slice(0,-1),before,'All authored blocks, nested children and images remain untouched.');
 assert.equal(editor.document.at(-1).type,'paragraph');
 assert.deepEqual(editor.document.at(-1).content,[{type:'permitextReference',props:reference},' ']);
 assert.deepEqual(calls,['insert','cursor','focus']);
 const count=editor.document.length;
 assert.throws(()=>controller.appendReference({...reference,referenceID:''}),/requires a supported/);
 assert.equal(editor.document.length,count,'Invalid references never modify the Note.');
}
console.log('Notebook append passed: a new bottom paragraph after text, nested lists or images, preserved selection content and exact reference identity.');
