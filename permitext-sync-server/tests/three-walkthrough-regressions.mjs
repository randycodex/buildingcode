import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseFragment} from 'parse5';
import {notebookBlocksFromSourceElement,notebookContentText} from '../public/notebook-content.js';
import {validateNotebookDocument,renderNotebookDocumentHTML,notebookManifestItem} from '../notebook-contract.mjs';
import {immutableReportManifest} from '../report-contract.mjs';
import {renderReportPDF} from '../report-pdf.mjs';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';

const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const extract=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness() {
  let release;
  const preparing=new Promise(resolve=>release=resolve);
  const c=vm.createContext({structuredClone,disposed:false,requestIdentity:{},requestWorkspaceID:'w',activeWorkspaceID:'w',
    isCurrentAccountRequest:()=>true,accountContextChangedError:()=>Error('Context changed'),
    activeDraft:{id:'',version:0,introduction:'Synthetic report',blocks:[]},generatingReport:false,deletingReport:false,
    dirty:true,projectID:'project',selectedReportTemplateID:'permitext-standard',history:[],identity:{},calls:[],message:'',
    saveDraft:async()=>{c.activeDraft.id ||= 'assigned-on-first-save';c.activeDraft.version++;c.dirty=false;return true;},
    prepareReportNoteSources:async()=>{await preparing;if(c.fail)throw Error('Note unavailable');},
    appendUniqueReportSources:(draft,sources)=>draft.blocks.push(...sources),setDirty:()=>{c.dirty=true;},
    renderWorkspaceContent(){},paintExportState(){},clearStatus(){c.message='';},showStatusError:m=>{c.message=m;},
    reportRequest:async(path,body)=>{c.calls.push({path,body:structuredClone(body),blocks:structuredClone(c.activeDraft.blocks)});
      return path==='/reports/generate'?{manifest:{},generatedReport:{file:{}}}:{reports:[]};},
    reviewReport(){},transitionWorkspace:async()=>{},paneIDForProjectDetail:()=> 'report'});
  const method=extract('    addSources(draftID, selectedSources) {','    async confirmDiscardIfNeeded()');
  vm.runInContext('let sourceAddition=Promise.resolve(); let sourceAdditionDraft=null; const mount={'+method+'}; globalThis.add=mount.addSources;'+
    extract('  const generateReport = async () => {','  const deleteReport = async (trigger) => {')+'globalThis.generate=generateReport;',c);
  return {c,release};
}
for (let n=0;n<5;n++) {
  const {c,release}=harness();
  const adding=c.add('',[{kind:'notebookCard',id:'first'}]);
  const exporting=c.generate();
  await tick();
  assert.equal(c.calls.length,0,'PDF creation must wait for source preparation');
  await assert.rejects(c.add(c.activeDraft.id,[{id:'late'}]),/exporting/);
  release();await Promise.all([adding,exporting]);
  assert.equal(c.calls[0].path,'/reports/generate');
  assert.equal(c.calls[0].blocks[0].id,'first','The first source survives the draft ID assignment');
  assert.equal(c.generatingReport,false);
}
{
  const {c,release}=harness();c.fail=true;
  const adding=c.add('',[{id:'retry'}]),exporting=c.generate();release();
  await assert.rejects(adding,/unavailable/);await exporting;
  assert.equal(c.calls.length,0,'Failed source preparation must prevent an incomplete PDF');
  assert.match(c.message,/could not be included/);
  c.fail=false;await c.add(c.activeDraft.id,[{id:'retry'}]);await c.generate();
  assert.equal(c.calls[0].blocks[0].id,'retry','A failed addition can be retried');
}
{
  const {c,release}=harness(),adding=c.add('',[{id:'wrong-report'}]);await tick();
  c.activeDraft={id:'other',blocks:[]};release();await assert.rejects(adding,/changed/i);
  assert.equal(c.activeDraft.blocks.length,0);
  c.activeDraft.introduction='A separate Report';await c.generate();
  assert.equal(c.calls[0].body.draftID,'other','An old destination failure cannot block a different Report');
}

// Exercise the actual source-to-Note converter, including nested formatting.
const dom=node=>{const children=(node.childNodes||[]).map(dom),style=node.attrs?.find(a=>a.name==='style')?.value||'';return {
  nodeType:node.nodeName==='#text'?3:1,tagName:node.tagName?.toUpperCase(),childNodes:children,
  style:{verticalAlign:/vertical-align\s*:\s*super/i.test(style)?'super':''},
  children:children.filter(c=>c.nodeType===1),matches:()=>false,querySelector:()=>null,
  get textContent(){return node.value||children.map(c=>c.textContent).join('');}};};
const blocks=notebookBlocksFromSourceElement(dom(parseFragment('<p>Area (27.9 m\n\t<sup><b>2</b></sup>\n\t). <mark>Marked condition</mark> <u>Underlined</u></p>')));
const document={schema:'permitext-notebook-card',schemaVersion:2,format:'blocknote-json',document:blocks};
const canonical=validateNotebookDocument(document).document;
const superscript=canonical.document[0].content.find(node=>node.styles?.superscript);
assert.equal(superscript.text,'2');assert.equal(superscript.styles.bold,true);
assert.match(canonical.document[0].content.map(node=>node.text||'').join(''),/27\.9 m2\)\./,'HTML indentation must not separate a unit exponent');
assert.equal(canonical.document[0].content.find(node=>node.text==='Marked condition').styles.backgroundColor,'yellow');
assert.match(renderNotebookDocumentHTML(canonical),/<sup><strong>2<\/strong><\/sup>/);
assert.match(renderNotebookDocumentHTML(canonical),/<mark>Marked condition<\/mark>/);
const enacted=JSON.parse(await readFile(new URL('../../NYC CC APP/NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/sections/2656.json',import.meta.url),'utf8'));
const enactedCopy=notebookBlocksFromSourceElement(dom(parseFragment(enacted.blocks.map(b=>b.html||'').join(''))));
assert.match(notebookContentText({document:enactedCopy}),/27\.9 m2\)/,'BC 1104.3.1 keeps unit notation compact despite source HTML indentation');
canonical.document.push({type:'table',content:{type:'tableContent',rows:[{cells:[
  [{type:'text',text:'Cell highlight',styles:{backgroundColor:'yellow'}}],
  [{type:'text',text:'m',styles:{}},{type:'text',text:'3',styles:{superscript:true}},
    {type:'link',href:'https://per.codes/workspace',content:[{type:'text',text:' Cell link',styles:{}}]}]
]}]}});
const item=notebookManifestItem({cardID:'styles',cardType:'finding',title:'Inline formatting test',document:canonical});
const manifest=immutableReportManifest({project:{id:'test',name:'Synthetic formatting verification'},draftID:'test',
  title:'Three walkthrough fixes',reportDate:'2026-11-11',author:{userID:'test',displayName:'QA'},codeEdition:'2022',reportVersion:1,items:[item],disclaimers:[]});
const pdf=await getDocument({data:new Uint8Array(await renderReportPDF(manifest)),useSystemFonts:true}).promise;
const superscripts=[],links=[];let highlight=false;
for(let n=1;n<=pdf.numPages;n++){
  const page=await pdf.getPage(n),content=await page.getTextContent(),ops=await page.getOperatorList();
  superscripts.push(...content.items.filter(x=>['2','3'].includes(x.str)&&x.transform[0]<7));
  links.push(...await page.getAnnotations());
  highlight ||= ops.argsArray.some(values=>values?.some?.(entry=>entry==='#f4d35e'));
}
assert(superscripts.some(x=>x.str==='2')&&superscripts.some(x=>x.str==='3'),'Paragraph and table superscripts use raised, smaller runs');
assert(highlight,'Semantic highlights reach the actual PDF');
assert(links.some(x=>x.url==='https://per.codes/workspace'),'Cell links remain clickable with superscript text');
await pdf.destroy();
console.log('Three walkthrough regressions passed: immediate export barrier, first-save identity, failed-add retry/fences, source highlights and persisted superscripts.');
