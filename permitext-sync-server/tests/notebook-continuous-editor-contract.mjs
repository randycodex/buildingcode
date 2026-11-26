import assert from 'node:assert/strict';
import { blockNoteBlocksFromNotebookDocument } from '../src/notebook-schema.js';
import { validateNotebookDocument, renderNotebookDocumentHTML } from '../notebook-contract.mjs';
import { notebookFontSize, notebookFontSizes, notebookLineSpacings, notebookTextColor, notebookTextColors } from '../public/notebook-styles.js';
import { notebookBlocksWithTableHeights, restoreNotebookTableHeights } from '../src/notebook-table-resize.js';

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
// BlockNote passes its render context through `this`; custom paragraph props
// must preserve it in both the editable view and clipboard/export rendering.
const specsSource = editorSource.slice(editorSource.indexOf('const notebookBlockSpecs ='),editorSource.indexOf('// Keep the normal color parser'));
const renderContext = {blockContentDOMAttributes:{class:'authored'},renderType:'nodeView'};
let inheritedRenderContext;
const baseSpec = {config:{propSchema:{}},implementation:{
  render(){inheritedRenderContext=this;return {dom:{style:{setProperty(...args){this.applied=args;}}}};},
  parse:()=>({})
}};
const spacingSpecs = vm.runInNewContext(`${specsSource}; notebookBlockSpecs`,{
  defaultBlockSpecs:{paragraph:baseSpec},allowedBlockTypeSet:new Set(['paragraph']),notebookLineSpacings
});
for(const render of ['render','toExternalHTML']) {
  const output=spacingSpecs.paragraph.implementation[render].call(renderContext,{props:{lineSpacing:'2'}});
  assert.equal(inheritedRenderContext,renderContext);
  assert.deepEqual(output.dom.style.applied,['line-height','2','important']);
}
const toolbarSource = editorSource.slice(editorSource.indexOf('export function notebookTableActions('),editorSource.indexOf('function normalizedReference(')).replace(/^export /gm,'');
const colorPropertiesSource = editorSource.slice(editorSource.indexOf('function notebookTextColorProperties('), editorSource.indexOf('const notebookTextColorStyle'));
const selected = structuredClone(fixture.document);
const updates = []; let focusCount = 0, transactions = 0;
const styleState = {};
const createdLinks = [];
let selectionWrites = 0;
let selectedText = 'Keep';
const editor = {
  document:selected,
  prosemirrorState:{doc:{descendants(){}}},
  _tiptapEditor:{state:{doc:{},selection:{from:5,to:9}},commands:{setTextSelection(value){selectionWrites++;editor._tiptapEditor.state.selection=value;}}},
  getActiveStyles:()=>({...styleState}), getSelectedText:()=>selectedText, getSelectedLinkUrl:()=>'',
  toggleStyles:value=>{for(const style of Object.keys(value)) styleState[style]=!styleState[style];},
  createLink:(url,text)=>createdLinks.push({url,text}),
  isEditable:true, getSelection:()=>({blocks:selected}), getTextCursorPosition:()=>({block:selected[0]}), getExtension:()=>null,
  focus:()=>{focusCount++;}, transact:callback=>{transactions++;callback();},
  updateBlock:(block,update)=>{updates.push({id:block.id,...update});}
};
const hookState = [], hookRefs = [];
let stateIndex = 0, refIndex = 0;
const context = vm.createContext({
  notebookFontSize,notebookFontSizes,notebookLineSpacings,notebookTextColor,notebookTextColors,
  notebookBlocksWithTableHeights,restoreNotebookTableHeights,
  getComputedStyle:()=>({fontSize:'13.3333px'}),
  URL, Menu:{Target:'menu-target',Dropdown:'menu-dropdown',Item:'menu-item'},
  useState:initial=>{const index=stateIndex++; if(!(index in hookState)) hookState[index]=initial; return [hookState[index],value=>{hookState[index]=value;}];},
  useRef:initial=>{const index=refIndex++; return hookRefs[index] ||= {current:initial};},
  React:{createElement:(type,props,...children)=>({type,props,children})},
  useEditorState:({editor,selector})=>selector({editor}),
  BasicTextStyleButton:'style-button', CreateLinkButton:'link-button'
});
vm.runInContext(colorPropertiesSource + toolbarSource,context);
const renderToolbar = () => {stateIndex=0;refIndex=0;return context.PermitextFormattingToolbar({editor,options:{}});};
const toolbar = renderToolbar();
const menuItems = node => node && typeof node === 'object' ? [node,...(node.children || []).flatMap(menuItems)] : [];
const headingOption = menuItems(toolbar).find(node=>node.type==='menu-item'&&node.children[0]==='Heading 2');
headingOption.props.onClick();
assert.equal(focusCount,1); assert.equal(transactions,1);
assert.deepEqual(updates.map(update=>update.id),['heading','list'],'Images remain images');
assert.ok(updates.every(update=>update.type==='heading' && update.props.level===2));
assert.deepEqual(selected,fixture.document,'Toolbar does not rebuild content or strip nested data');
const bullets = menuItems(toolbar).find(child=>child?.props?.['aria-label']==='Bulleted list');
let prevented = false;
bullets.props.onMouseDown({preventDefault(){prevented=true;}});
assert.equal(prevented,true,'Pointer formatting retains the editor selection');
console.log('Continuous toolbar callbacks passed: focus, selected text-only conversion, one undo transaction, and preserved structure.');

const bold = menuItems(toolbar).find(child=>child?.props?.['aria-label']==='Bold');
bold.props.onClick();
assert.equal(styleState.bold,true,'Persistent Bold applies directly to selected text');
menuItems(renderToolbar()).find(child=>child?.props?.['aria-label']==='Bold').props.onClick();
assert.equal(styleState.bold,false,'Clicking active Bold toggles it off');
const descendants = node => node && typeof node === 'object' ? [node,...(node.children || []).flatMap(descendants)] : [];
const named = (tree,name) => descendants(tree).find(node=>node.props?.['aria-label']===name);
for (const label of ['Text style', 'Line spacing', 'Table']) {
  const trigger = named(toolbar, label);
  assert.equal(trigger.type, 'button');
  assert.equal(trigger.children[0].type, 'svg');
  assert.equal(trigger.children[0].props['aria-hidden'], 'true');
}
editor.domElement={isConnected:true};
editor.prosemirrorView={dom:{isConnected:true},domAtPos:()=>({node:{nodeType:1}})};
assert.equal(named(renderToolbar(),'Font size').children[0],'10 pt','Inherited CSS pixel sizes display as document points.');
editor.domElement.isConnected=false;
Object.defineProperty(editor,'prosemirrorView',{configurable:true,get(){assert.fail('An unmounted editor has no view.');}});
assert.doesNotThrow(renderToolbar,'The toolbar must render before the editor mounts.');
delete editor.prosemirrorView;delete editor.domElement;
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

const choose=(control,label)=>{
  const tree=renderToolbar();named(tree,control).props.onClick();
  const menu=descendants(tree).find(node=>node.type==='menu-dropdown'&&node.props['aria-label']===control);
  const item=descendants(menu).find(node=>node.type==='menu-item'&&
    (node.children[0]===label || node.children[0]?.children?.at(-1)===label));
  assert.ok(item,`${control}: ${label}`);assert.ok(!item.props.disabled);item.props.onClick();
};
editor.addStyles=value=>Object.assign(styleState,value);
editor.removeStyles=value=>Object.keys(value).forEach(key=>delete styleState[key]);
styleState.bold=true;choose('Font size','18 pt');
assert.equal(styleState.fontSize,'18');assert.equal(styleState.bold,true,'Font size preserves other selected marks.');
choose('Text color','Blue');
assert.equal(styleState.textColor,'blue');
choose('Text color','Default');
assert.equal(styleState.textColor,undefined);
assert.equal(styleState.bold,true);
assert.equal(styleState.fontSize,'18');
choose('Font size','Default');assert.equal(styleState.fontSize,undefined);assert.equal(styleState.bold,true);
const beforeSpacing=updates.length;choose('Line spacing','2 · Double');
assert.deepEqual(updates.slice(beforeSpacing).map(update=>update.id),['heading','list']);
assert.ok(updates.slice(beforeSpacing).every(update=>update.props.lineSpacing==='2'));

context.TableHandlesExtension='tableHandles';
const tableCalls=[];
for (const command of ['addRowAfter','addColumnAfter','deleteRow','deleteColumn']) {
  context[command] = () => { tableCalls.push(command); return true; };
}
editor.exec=command=>command();
editor.getExtension=key=>key==='tableHandles'?{
  getCellSelection:()=>({from:{row:1,col:2},to:{row:1,col:2},cells:[{row:1,col:2}]})
}:null;
selected.splice(0,selected.length,{id:'table',type:'table',content:{rows:Array.from({length:3},()=>({cells:[[],[],[]]})),headerRows:1}});
choose('Table','Add row below');choose('Table','Add column right');choose('Table','Delete row');choose('Table','Delete column');
assert.deepEqual(tableCalls,['addRowAfter','addColumnAfter','deleteRow','deleteColumn'],
  'Table commands use the live selection without requiring a hovered cell.');
choose('Table','Remove header row');assert.equal(updates.at(-1).content.headerRows,0);
const blank={id:'blank',type:'paragraph',content:[],children:[]};selected.splice(0,selected.length,blank);
const inserted=[];let cursorTarget;
editor.getTextCursorPosition=()=>({block:blank});
editor.updateBlock=(block,update)=>{const result={...block,...update};inserted.push(result);return result;};
editor.insertBlocks=blocks=>{inserted.push(...blocks);return blocks;};
editor.setTextCursorPosition=block=>{cursorTarget=block;};
choose('Table','Insert 3 × 3 table');
assert.equal(inserted[0].type,'table');assert.equal(inserted[0].content.rows.length,3);
assert.equal(inserted[0].content.rows[0].cells.length,3);assert.equal(inserted[0].content.headerRows,1);
assert.equal(inserted[1].type,'paragraph');assert.equal(cursorTarget.id,'blank');
console.log('Notebook tools passed: font size/default preserve marks, paragraph spacing, table insertion, row/column commands and headers.');
