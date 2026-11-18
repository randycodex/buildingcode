import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createReportPageEditor} from '../public/report-page-editor.js';

class Element {
  constructor(tag='div') {this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.events={};this.className='';this.hidden=false;this.offsetHeight=40;this.offsetTop=0;this.clientWidth=612;this.style={setProperty(){}};}
  append(...nodes) {for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node);}}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}
  replaceChildren(...nodes){for(const node of [...this.children])node.remove();this.append(...nodes);}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type,handler){this.events[type]=handler;}
  matches(selector){return this.tagName==='textarea' && selector.includes('textarea');}
  get isConnected(){return Boolean(this.root || this.parentNode?.isConnected);}
  get classList(){return {add:name=>{this.className+=' '+name;},remove:name=>{this.className=this.className.split(' ').filter(v=>v!==name).join(' ');}};}
  querySelector(selector){return this.children.find(node=>selector.startsWith('[data-page=') && node.dataset.page===selector.match(/"(\d+)"/)[1]) || null;}
  querySelectorAll(selector){return this.children.filter(node=>node.className.includes(selector.slice(1)));}
  getBoundingClientRect(){return {left:0,top:0,bottom:1000,width:612};}
  contains(node){return node===this || this.children.some(child=>child.contains(node));}
  scrollTo(position){this.scroll=position;}
  focus(){this.focused=true;}
}
globalThis.document={createElement:tag=>new Element(tag)};
globalThis.ResizeObserver=class{observe(){}disconnect(){}};
const root=new Element();root.root=true;
const host=new Element(),legacy=new Element(),row=new Element(),field=new Element('textarea');
field.value='Unsubmitted text';root.append(host,legacy);legacy.append(row);row.append(field);
let completed=0;
const editor=createReportPageEditor({host,isCurrent:()=>true,describe:id=>id,field:id=>id==='paragraph'?{element:field,size:10}:null,
  actions:id=>id==='paragraph'?row:null,onSelect(){},onFinish(){completed++;}});
root.append(editor.inspector);
const layout={pages:[{page:1,width:612,height:792,margin:54}],regions:[{id:'paragraph',page:1,x:54,y:54,width:504,height:50}]};
const pages=()=>{const container=new Element(),page=new Element();page.dataset.page='1';container.append(page);host.append(container);return container;};
editor.pages({container:pages(),layout});editor.select('paragraph',{focus:true,reveal:false});
assert.equal(field.parentNode.className,'report-page-edit-overlay');
assert.equal(field.focused,true);assert.equal(row.parentNode,editor.inspector);
const focusedParent=field.parentNode;
editor.pages({container:pages(),layout});
assert.equal(field.parentNode,focusedParent,'Refreshing PDF pages keeps the same live editor, selection and unsubmitted text');
assert.equal(field.value,'Unsubmitted text');
editor.finish();assert.equal(field.parentNode,row);assert.equal(row.parentNode,legacy);assert.equal(completed,1);
editor.dispose();delete globalThis.document;delete globalThis.ResizeObserver;

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('  const generateReport = async () => {');
const end=source.indexOf('\n  const deleteReport = ',start);
assert(start>0 && end>start);
const downloaded=[],calls=[];
const context=vm.createContext({generatingReport:false,deletingReport:false,disposed:false,dirty:false,
  activeDraft:{id:'draft',version:4,title:'Actual pages',blocks:[{kind:'heading',text:'Heading'}]},
  sourceMutationDraft:null,projectID:'project',requestIdentity:'owner',requestWorkspaceID:'workspace',activeWorkspaceID:'workspace',selectedReportTemplateID:'standard',
  pageEditor:{finish(){calls.push('finish');}},paintExportState(){},clearStatus(){},showStatusError(message){throw Error(message);},
  saveDraft:async()=>true,isCurrentAccountRequest:()=>true,
  reportRequest:async path=>assert.fail(`Export must not write or list Versions: ${path}`),
  requestDraftPDF:async(draft, editingLayout)=>{calls.push(`pdf:${draft.id}`); assert.equal(editingLayout, undefined);
    return {blob:async()=>({type:'application/pdf'})};},
  downloadCodeMemoBlob:(...args)=>downloaded.push(args),
  transitionWorkspace(){throw Error('Export must not change the workspace');}});
vm.runInContext(source.slice(start,end)+'\nglobalThis.exportReport=generateReport;',context);
await context.exportReport();
assert.deepEqual(downloaded, [[{type:'application/pdf'},'Actual pages.pdf']]);
assert.deepEqual(calls,['finish','pdf:draft']);
assert.equal(context.generatingReport,false);
console.log('Paged editing passed: measured page targets, direct text editing, external item controls, live editor retention across reflow, and PDF download without preview or navigation.');
