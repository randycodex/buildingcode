import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {notebookReferenceKinds} from '../src/notebook-schema.js';
import {notebookReferenceBlocks} from '../public/notebook-passage-blocks.js';
import {validateNotebookDocument, notebookPlainText} from '../notebook-contract.mjs';

const source=await readFile(new URL('../src/notebook-editor.js',import.meta.url),'utf8');
const mount=source.slice(source.indexOf('export function mountPermitextNotebookEditor')).replace('export function','function');
const normalize=source.slice(source.indexOf('function normalizedReference('),source.indexOf('function wrappedDocument('));
const reference={referenceKind:'selectedPassage',referenceID:'exact-passage',label:'BC · 2022 · § 101.1'};
const exact='Complete passage <including literal markup> & conditions.\nException: '+ 'Keep every word. '.repeat(60).trim();
for(const last of [
 {id:'last',type:'paragraph',content:[{type:'text',text:'Keep this final sentence.'}],children:[]},
 {id:'last',type:'numberedListItem',content:[{type:'text',text:'Keep this list.'}],children:[{id:'child',type:'bulletListItem',content:[{type:'text',text:'Nested last line.'}]}]},
 {id:'last',type:'image',props:{url:'permitext-notebook-asset:test'},children:[]}
]) for(const passages of [[],[{exact}]]) {
 const blocks=[{id:'first',type:'paragraph',content:[{type:'text',text:'Selected text at the start.'}]},last];
 const before=structuredClone(blocks),calls=[];
 const editor={document:blocks,
  insertInlineContent:()=>assert.fail('Appending must not replace the current selection'),
  insertBlocks(added,anchor,placement){assert.equal(anchor,last);assert.equal(placement,'after');calls.push('insert');const next=JSON.parse(JSON.stringify(added)).map((block,index)=>({id:`appended-${index}`,...block}));this.document.push(...next);return next;},
  setTextCursorPosition(block,position){assert.equal(block,this.document.at(-1));assert.equal(position,'end');calls.push('cursor');},
  focus(){calls.push('focus');}
 };
 class HTMLElement {}
 const c=vm.createContext({HTMLElement,notebookReferenceKinds,notebookReferenceBlocks,React:{createElement:(_component,props)=>props},PermitextNotebookEditor(){},
  createRoot:()=>({render:props=>{props.controllerRef.current=editor;},unmount(){}})});
 vm.runInContext(normalize+mount,c);
 const controller=c.mountPermitextNotebookEditor(new HTMLElement());
 assert.equal(controller.appendReference(reference,passages),true);
 assert.deepEqual(editor.document.slice(0,before.length),before,'All authored blocks, nested children and images remain untouched.');
 assert.deepEqual(editor.document[before.length].content,[{type:'permitextReference',props:reference}]);
 assert.equal(editor.document.at(-1).type,'paragraph');
 if(passages.length) {
  assert.deepEqual(editor.document.at(-1).content,[{type:'text',text:exact,styles:{}}],'The full passage follows its linked title without truncation or HTML interpretation.');
  const saved=validateNotebookDocument({schema:'permitext-notebook-card',schemaVersion:2,format:'blocknote-json',document:editor.document.slice(before.length)});
  assert.equal(saved.document.document[1].content[0].text,exact);
  assert.match(notebookPlainText(saved.document),/Exception: Keep every word/);
 } else assert.equal(editor.document.length,before.length+1,'References without captured passages remain link-only.');
 assert.deepEqual(calls,['insert','cursor','focus']);
 const count=editor.document.length;
 assert.throws(()=>controller.appendReference({...reference,referenceID:''}),/requires a supported/);
 assert.equal(editor.document.length,count,'Invalid references never modify the Note.');
}
console.log('Notebook append passed: linked title plus full passage at the bottom, long/multiline literal text saved without truncation, existing text/lists/images preserved.');
