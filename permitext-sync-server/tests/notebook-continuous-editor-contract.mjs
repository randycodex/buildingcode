import assert from 'node:assert/strict';
import { blockNoteBlocksFromNotebookDocument } from '../src/notebook-schema.js';
import { validateNotebookDocument, renderNotebookDocumentHTML } from '../notebook-contract.mjs';

// Reusing the editor must preserve authored structure and reference identity.
const fixture = {schema:'permitext-notebook-card',schemaVersion:2,format:'blocknote-json',document:[
  {id:'heading',type:'heading',props:{level:2},content:[{type:'text',text:'Review',styles:{bold:true}}],children:[]},
  {id:'list',type:'numberedListItem',content:[{type:'text',text:'Keep this text',styles:{italic:true,strike:true}},
    {type:'link',href:'https://example.com/record',content:[{type:'text',text:'Supporting record',styles:{bold:true,strike:true}}]}],
    children:[{id:'child',type:'bulletListItem',content:[{type:'permitextReference',props:{referenceKind:'researchAnswer',referenceID:'answer-id',label:'Saved answer'}}],children:[]}]},
  {id:'image',type:'image',props:{url:'permitext-notebook-asset:fixture-image',caption:'Original caption'},children:[]}
]};
const mountedBlocks = blockNoteBlocksFromNotebookDocument(fixture);
assert.deepEqual(mountedBlocks,fixture.document);
const saved = validateNotebookDocument({...fixture,document:mountedBlocks});
const remounted = blockNoteBlocksFromNotebookDocument(saved.document);
assert.equal(remounted[1].content[0].styles.strike,true);
assert.equal(remounted[1].content[1].content[0].styles.strike,true);
assert.equal(remounted[1].content[1].href,'https://example.com/record');
assert.equal(remounted[1].children[0].content[0].props.referenceID,'answer-id');
assert.equal(remounted[2].props.url,'permitext-notebook-asset:fixture-image');
assert.equal(remounted[2].props.caption,'Original caption');
assert.match(renderNotebookDocumentHTML(saved.document),/<s><em>Keep this text<\/em><\/s>/);
assert.match(renderNotebookDocumentHTML(saved.document),/href="https:\/\/example.com\/record"/);
assert.equal(saved.references[0].referenceID,'answer-id');
console.log('Continuous Notebook contract passed: heading, nested lists, mixed styles, links, references, and image identities survive editor/save/remount.');

// Execute the actual toolbar callbacks with a minimal React boundary. A toolbar
// action must change selected text blocks in one history transaction, without
// converting selected images or changing inline content and child blocks.
const {readFile} = await import('node:fs/promises');
const vm = await import('node:vm');
const editorSource = await readFile(new URL('../src/notebook-editor.js',import.meta.url),'utf8');
const toolbarSource = editorSource.slice(editorSource.indexOf('function PermitextFormattingToolbar('),editorSource.indexOf('function normalizedReference('));
const selected = structuredClone(fixture.document);
const updates = []; let focusCount = 0, transactions = 0;
const styleState = {};
const createdLinks = [];
let selectionWrites = 0;
let selectedText = 'Keep';
const editor = {
  _tiptapEditor:{state:{doc:{},selection:{from:5,to:9}},commands:{setTextSelection(value){selectionWrites++;editor._tiptapEditor.state.selection=value;}}},
  getActiveStyles:()=>({...styleState}), getSelectedText:()=>selectedText, getSelectedLinkUrl:()=>'',
  toggleStyles:value=>{for(const style of Object.keys(value)) styleState[style]=!styleState[style];},
  createLink:(url,text)=>createdLinks.push({url,text}),
  isEditable:true, getSelection:()=>({blocks:selected}),
  focus:()=>{focusCount++;}, transact:callback=>{transactions++;callback();},
  updateBlock:(block,update)=>{updates.push({id:block.id,...update});}
};
const hookState = [], hookRefs = [];
let stateIndex = 0, refIndex = 0;
const context = vm.createContext({
  URL,
  useState:initial=>{const index=stateIndex++; if(!(index in hookState)) hookState[index]=initial; return [hookState[index],value=>{hookState[index]=value;}];},
  useRef:initial=>{const index=refIndex++; return hookRefs[index] ||= {current:initial};},
  React:{createElement:(type,props,...children)=>({type,props,children})},
  useEditorState:({editor,selector})=>selector({editor}),
  BasicTextStyleButton:'style-button', CreateLinkButton:'link-button'
});
vm.runInContext(toolbarSource,context);
const renderToolbar = () => {stateIndex=0;refIndex=0;return context.PermitextFormattingToolbar({editor,options:{}});};
const toolbar = renderToolbar();
const styleSelect = toolbar.children.find(child=>child?.type==='select');
styleSelect.props.onChange({target:{value:'heading-2'}});
assert.equal(focusCount,1); assert.equal(transactions,1);
assert.deepEqual(updates.map(update=>update.id),['heading','list'],'Images remain images');
assert.ok(updates.every(update=>update.type==='heading' && update.props.level===2));
assert.deepEqual(selected,fixture.document,'Toolbar does not rebuild content or strip nested data');
const bullets = toolbar.children.find(child=>child?.props?.['aria-label']==='Bulleted list');
let prevented = false;
bullets.props.onMouseDown({preventDefault(){prevented=true;}});
assert.equal(prevented,true,'Pointer formatting retains the editor selection');
console.log('Continuous toolbar callbacks passed: focus, selected text-only conversion, one undo transaction, and preserved structure.');

const bold = toolbar.children.find(child=>child?.props?.['aria-label']==='Bold');
bold.props.onClick();
assert.equal(styleState.bold,true,'Persistent Bold applies directly to selected text');
renderToolbar().children.find(child=>child?.props?.['aria-label']==='Bold').props.onClick();
assert.equal(styleState.bold,false,'Clicking active Bold toggles it off');
const descendants = node => node && typeof node === 'object' ? [node,...(node.children || []).flatMap(descendants)] : [];
const named = (tree,name) => descendants(tree).find(node=>node.props?.['aria-label']===name);
named(renderToolbar(),'Link').props.onClick();
named(renderToolbar(),'Link URL').props.onChange({target:{value:'https://example.com/record'}});
let linkForm = descendants(renderToolbar()).find(node=>node.type==='form');
linkForm.props.onSubmit({preventDefault(){}});
assert.deepEqual(createdLinks.at(-1),{url:'https://example.com/record',text:undefined},'Link marks selected content without flattening existing styles');
editor._tiptapEditor.state.selection = {from:9,to:9};
selectedText='';
named(renderToolbar(),'Link').props.onClick();
named(renderToolbar(),'Link URL').props.onChange({target:{value:'https://example.com/new'}});
descendants(renderToolbar()).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});
assert.deepEqual(createdLinks.at(-1),{url:'https://example.com/new',text:'https://example.com/new'},'Empty-caret Link inserts visible URL text');
named(renderToolbar(),'Link').props.onClick();
named(renderToolbar(),'Link URL').props.onChange({target:{value:'https://'}});
const beforeInvalid = createdLinks.length;
descendants(renderToolbar()).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});
assert.equal(createdLinks.length,beforeInvalid);
assert.equal(selectionWrites,0,'Invalid link leaves the current caret untouched');
console.log('Persistent formatting passed: bold toggles, selection link preserves styles, empty-caret link inserts text, invalid URL retains selection.');
