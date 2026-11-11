import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,writeFile} from 'node:fs/promises';
import {parseFragment} from 'parse5';
import {notebookBlocksFromSourceElement} from '../public/notebook-content.js';
import {prepareSavedEvidenceItems} from '../report-evidence.mjs';
import {immutableReportManifest} from '../report-contract.mjs';
import {reportItemPreview} from '../report-presentation.mjs';
import {reportImageMaterial,isPublicImageAddress} from '../report-images.mjs';
import {renderReportPDF} from '../report-pdf.mjs';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const extract=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));

// #1: Creation belongs to the active Report instead of its inert covered track.
let host; const reportHost={};
const create=vm.createContext({closeWorkspaceContextMenu(){},hasCapability:()=>true,confirmWorkspaceTransition:async()=>true,
 reportScreen:{isOpen:()=>true,element:reportHost},document:{querySelector:()=>null},track:{inert:true},
 showProjectCreateSheet:panel=>{host=panel;}});
vm.runInContext(extract('async function createNewWorkspace(','function commitWorkspaceRename('),create);
await create.createNewWorkspace();assert.equal(host,reportHost);

// #2: External creates publish immediately; returning to Notebook can refresh an existing catalog.
let response={cards:[{id:'fresh',title:'Server Note'}]},reads=0;
const catalogs=new Map([['project',[{id:'old'}]]]);
const notes=vm.createContext({notebookCatalogs:catalogs,notebookCatalogRequests:new Map(),workspacePrivatePresentationAllowed:()=>true,
 workspaceProject:()=>({id:'project'}),hasCapability:()=>true,projectDetailKey:p=>p.id,captureAccountRequest:()=>({userID:'owner'}),
 activeWorkspaceID:'workspace',isCurrentAccountRequest:()=>true,postResearch:async()=>{reads++;return response;},syncNotebookNoteTabs(){},syncNotebookLanding(){}});
vm.runInContext(extract('async function ensureNotebookTabCatalog(','async function openNotebookNoteColumn('),notes);
notes.publishSavedNotebookCard('project',{id:'new',title:'Created elsewhere'});assert.equal(catalogs.get('project')[0].id,'new');
await notes.ensureNotebookTabCatalog();assert.equal(reads,0);
await notes.ensureNotebookTabCatalog({refresh:true});assert.equal(reads,1);assert.equal(catalogs.get('project')[0].id,'fresh');

// #4: Moving linked columns together never adds explicitly removed group members back.
const groups=vm.createContext({state:{columnGroups:[{id:'g',paneIDs:['search'],columns:{}}]},normalizeColumnGroups:x=>x,
 savedEvidenceColumnGroup:()=>[],basePaneGroupForMove:()=>['search','detail'],newUtilityInstance(){throw Error('Unexpected legacy conversion');}});
vm.runInContext(extract('function reconcileColumnGroups(','function paneGroupForMove('),groups);
groups.reconcileColumnGroups(['search','detail']);assert.deepEqual(Array.from(groups.state.columnGroups[0].paneIDs),['search']);

// #6: Run the real mounted handoff twice while a save is in flight.
let releaseSave;const saving=new Promise(resolve=>releaseSave=resolve);let saves=0;
const draft={id:'report',blocks:[]};
const queue=vm.createContext({structuredClone,disposed:false,isCurrentAccountRequest:()=>true,requestIdentity:{},requestWorkspaceID:'workspace',
 activeWorkspaceID:'workspace',activeDraft:draft,generatingReport:false,deletingReport:false,projectID:'project',
 accountContextChangedError:()=>Error('Changed'),saveDraft:async()=>{if(++saves===1)await saving;return true;},
 prepareReportNoteSources:async()=>{},appendUniqueReportSources:(d,s)=>{for(const source of s)if(!d.blocks.some(b=>b.id===source.id))d.blocks.push(source);},setDirty(){},renderWorkspaceContent(){}});
const start=app.indexOf('    addSources(draftID, selectedSources) {');
const method=app.slice(start,app.indexOf('    async confirmDiscardIfNeeded()',start));
vm.runInContext('let sourceAddition=Promise.resolve(); const mount={'+method+'};globalThis.add=mount.addSources;',queue);
const first=queue.add('report',[{id:'one'}]),second=queue.add('report',[{id:'two'}]);
releaseSave();await Promise.all([first,second]);assert.deepEqual(draft.blocks.map(b=>b.id),['one','two']);
queue.activeWorkspaceID='other';await assert.rejects(queue.add('report',[{id:'wrong'}]),/Changed/);

// #8: The current V2 composer and legacy composer receive the reviewed question without sending it.
for(const kind of ['rv2-input','research-question-input']){
 const input={value:'',disabled:false,dispatchEvent(){this.dispatched=true;},focus(){this.focused=true;}};
 const conversation={id:'chat',primaryProjectID:'project',codeVersion:'2022'};
 const calc=vm.createContext({captureAccountRequest:()=>({}),activeWorkspaceID:'workspace',workspaceProject:()=>({id:'project'}),
 state:{workflowNavigationGeneration:0,utilityInstances:[]},isCurrentAccountRequest:()=>true,researchProjectID:()=> 'project',
 calculatorConversationForPane:()=>conversation,researchDraftPaneIDs:new Set(),track:{querySelector:selector=>selector.includes(kind)?{...input,querySelector:()=>input}:null},
 researchNewChatDrafts:new Map(),reconciledResearchProgressSession:()=>null,resolveReaderSource:async s=>s,
 postResearch:async()=>({selection:{selectedText:'Exact table and footnotes'}}),document:{createElement:()=>({append(){}})},
 researchAnswerSourceCitation:()=> 'BC 1004.1.3',researchCodeEdition:()=> '2022',occupantLoadFootnoteQuestion:()=> 'Reviewed 1405 net sf calculation',
 confirmWebWarning:async()=>true,addResearchSelectionToCurrent:async()=>conversation,paneIDForResearchConversation:()=> 'utility:analysis',
 whenWorkspacePaneReady:async()=>true,CSS:{escape:x=>x},Event:class{}});
 // The outer pane is a different selector from the composer.
 calc.track.querySelector=selector=>selector.startsWith('.workspace-panel')?{querySelector:selector=>selector.includes(kind)?input:null}:selector.includes(kind)?input:null;
 vm.runInContext(extract('async function askCalculatorFootnotes(','function renderOccupantLoadCalculation('),calc);
 await calc.askCalculatorFootnotes({sectionID:'source',codeVersion:'2022'},{});
 assert.equal(input.value,'Reviewed 1405 net sf calculation');assert(input.focused&&input.dispatched);
 input.value='User writing';await assert.rejects(calc.askCalculatorFootnotes({codeVersion:'2022'},{}),/current Assistant draft/);
}

// #3/#5: Actual illustrated source extraction, normalized manifests and visual order.
const body=JSON.parse(await readFile(new URL('../../NYC CC APP/NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/sections/7761.json',import.meta.url),'utf8'));
const prepared=await prepareSavedEvidenceItems({selections:[{sectionID:'7761',codeVersion:'2022'}],resolveSource:async()=>({
 section:{id:'7761',sectionNumber:'R102.1',title:'Suspension systems',codePrefix:'BC'},body,source:{canonicalEdition:'2022',editionLabel:'2022'}})});
const evidence=prepared.items[0];assert.equal(evidence.figures.length,3);
assert.equal(reportItemPreview(evidence).filter(p=>p.kind==='image').length,3);
const textAnchor=reportItemPreview(evidence).find(part=>part.kind==='text');
evidence.sourceFormatting=[{key:textAnchor.key,text:textAnchor.text,formats:{bold:[[0,6]]}}];
// Minimal DOM adapter exercises the browser converter on the enacted HTML, without a browser implementation dependency.
const dom=node=>{const children=(node.childNodes||[]).map(dom),attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));
 return {nodeType:node.nodeName==='#text'?3:1,tagName:node.tagName?.toUpperCase(),childNodes:children,children:children.filter(c=>c.nodeType===1),
 get textContent(){return node.value||children.map(c=>c.textContent).join('');},getAttribute:key=>attrs[key]||null,alt:attrs.alt||'',matches:()=>false,
 querySelector(selector){return children.find(c=>selector.split(',').some(s=>s.trim().toUpperCase()===c.tagName))||children.map(c=>c.querySelector?.(selector)).find(Boolean);}};};
const sourceRoot=dom(parseFragment(body.blocks.map(b=>b.html||'').join('')));
const copied=notebookBlocksFromSourceElement(sourceRoot);assert.equal(copied.filter(b=>b.type==='image').length,3);

// #7: Canonical HTTPS embeds and source figures share verified image material; private fetches stay blocked.
const material=new Map();for(const figure of evidence.figures)material.set(figure.url,await reportImageMaterial(figure.url,figure.contentHash));
await assert.rejects(reportImageMaterial(evidence.figures[0].url,'0'.repeat(64)),/immutable source hash/);
for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.0.1','::1','::ffff:127.0.0.1','fc00::1'])assert.equal(isPublicImageAddress(ip),false);
await assert.rejects(reportImageMaterial('https://127.0.0.1/private'),/public internet/);
await assert.rejects(reportImageMaterial('http://example.com/image.png'),/public HTTPS/);
assert.equal(isPublicImageAddress('8.8.8.8'),true);
const embedded={kind:'notebookCard',cardID:'embedded',cardType:'finding',title:'HTTPS embedded code figure',plainText:'',document:{schema:'permitext-notebook-card',schemaVersion:2,format:'blocknote-json',document:[{type:'image',props:{url:evidence.figures[0].url,name:'Embedded official code figure'}}]}};
const manifest=immutableReportManifest({project:{id:'test',name:'TEST ONLY - nine workflow fixes'},draftID:'test',title:'Illustrated sources and embedded images',reportDate:'2026-11-11',createdAt:'2026-11-11T15:00:00Z',author:{userID:'test',displayName:'Workflow QA'},codeEdition:'2022',items:[evidence,embedded],disclaimers:['Synthetic verification only. Verify applicability against enacted source text.'],reportVersion:1});
assert.equal(manifest.items[0].figures.length,3);
const pdf=await renderReportPDF(manifest,{projectMaterialBySourceID:material});
if(process.env.PERMITEXT_NINE_QA_PDF)await writeFile(process.env.PERMITEXT_NINE_QA_PDF,pdf);
const parsed=await getDocument({data:new Uint8Array(pdf),useSystemFonts:true}).promise;
let imageCount=0;const pages=[];
for(let n=1;n<=parsed.numPages;n++){const page=await parsed.getPage(n),ops=await page.getOperatorList();imageCount+=ops.fnArray.filter(v=>v===OPS.paintImageXObject).length;pages.push((await page.getTextContent()).items.map(i=>i.str).join(' '));}
assert(imageCount>=4,'Three source figures and the HTTPS embed must become actual PDF images');
// #9: The notice sits on the cover, without adding a notice-only final page.
assert.match(pages[0],/Professional-use notice/);assert.doesNotMatch(pages.at(-1),/Professional-use notice/);
await parsed.destroy();
console.log('Nine workflow fixes passed: active creation host, fresh Notes, explicit grouping, queued Report sources, both Assistant composers, source figures, HTTPS embeds, image hashes and notice pagination.');
