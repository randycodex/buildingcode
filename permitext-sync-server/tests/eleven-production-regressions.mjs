import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {normalizeNotebookDocumentStyles} from '../public/notebook-styles.js';
import {validateNotebookDocument} from '../notebook-contract.mjs';
import {tableDisplayCells} from '../public/notebook-content.js';

const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const extract=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
const rich={schema:'permitext-notebook-card',format:'blocknote-json',schemaVersion:2,document:[{type:'paragraph',content:[{type:'text',text:'Clipboard highlight',styles:{backgroundColor:'rgb(255, 255, 0)',bold:true}}]}]};
assert.equal(normalizeNotebookDocumentStyles(rich).document[0].content[0].styles.backgroundColor,'yellow');
assert.equal(rich.document[0].content[0].styles.backgroundColor,'rgb(255, 255, 0)','Normalization is immutable');
assert.equal(validateNotebookDocument(rich).document.document[0].content[0].styles.backgroundColor,'yellow');

let card={plainText:''},draft=null,synced=0;
const mounts=new Map();
const guard=vm.createContext({notebookColumnMounts:mounts,requireCurrentAccountRequest(){},captureAccountRequest:()=>({userID:'owner'}),
 loadNotebookDraft:async()=>draft,synchronizeNotebookDraft:async()=>{synced++;draft=null;},postResearch:async()=>({card})});
vm.runInContext(extract('async function prepareReportNoteSources(','async function addProjectSourcesToReport('),guard);
const add=()=>guard.prepareReportNoteSources('project',[{kind:'notebookCard',id:'note'}]);
await assert.rejects(add,/no saved content/);
card={plainText:'Saved text'};await add();
card={plainText:'',imageAssets:[{id:'image'}]};await add();
draft={recoveryConflict:true};await assert.rejects(add,/conflict/);
draft={revision:'pending'};card={plainText:'Synced text'};await add();assert.equal(synced,1);
mounts.set('note',{activeCardID:()=> 'note',hasPendingEdits:()=>true,prepareCardMutation:async()=>false});
await assert.rejects(add,/pending edits/);mounts.clear();

let choice='new',offered,inserted=0,saved=0;
const target={id:'hidden-current',title:'Hidden current Note'};
const destination=vm.createContext({workspaceProject:()=>({id:'project'}),captureAccountRequest:()=>({userID:'owner'}),
 activeWorkspaceID:'workspace',state:{},isCurrentAccountRequest:()=>true,researchProjectID:p=>p.id,
 notebookMounts:new Map([['project',{insertionTarget:()=>target,insertLinkedReference:async()=>inserted++}]]),
 openWebWarning:async options=>{offered=options;return choice;},evidenceComments:()=>[],detailNoteValueForTarget:()=>'',
 researchCodeEdition:()=> '2022',crypto:{randomUUID:()=> 'passage'},navigator:{onLine:true},emptyNotebookDocument:()=>({document:[]}),
 notebookReferenceBlocks:()=>[],generatedNoteTitle:x=>x,postResearch:async()=>{saved++;return {card:{id:'new'}};},
 requireCurrentAccountRequest(){},saveNotebookCardSnapshot:async()=>{},showNotebookSavedLink(){}});
vm.runInContext(extract('async function addPassageToNotebook(','let readerCommentIndex'),destination);
const anchor={isConnected:true,closest:()=>null};
await destination.addPassageToNotebook(anchor,{sectionID:'1',title:'Occupant load',codePrefix:'BC'},'Exact passage');
assert.equal(offered.choices.length,2);assert.match(offered.choices[0].label,/Hidden current Note/);assert.equal(saved,1);assert.equal(inserted,0);
choice='current';await destination.addPassageToNotebook(anchor,{sectionID:'1'},'Exact passage');assert.equal(inserted,1);
choice=false;await destination.addPassageToNotebook(anchor,{sectionID:'1'},'Exact passage');assert.equal(saved,1);assert.equal(inserted,1);

const status={dataset:{},textContent:'',children:[],append(...children){this.children.push(...children);}};
let lookups=0,autosaves=0;
const property=vm.createContext({identity:{address:''},selectedFolderType:'project',addressInput:{value:'123 Test Street'},isEditing:true,autoSave:true,
 propertyLookupAddress:'',propertyLookupResult:null,propertyLookupStatus:status,isCurrent:()=>true,activeAccount:()=>({}),navigator:{onLine:true},
 document:{createElement:()=>({addEventListener(name,fn){this[name]=fn;}})},saveAutomatic:async()=>autosaves++,
 postResearch:async()=>{if(++lookups===1)throw Error('Upstream unavailable');return {property:{structuredFacts:[{status:'sourced'}]}};}});
vm.runInContext(extract('  let propertyLookupPromise = null;','    return propertyLookupPromise;')+'    return propertyLookupPromise;\n  };\n globalThis.lookupPropertyContext=lookupPropertyContext;',property);
assert.equal(await property.lookupPropertyContext(),null);assert.match(status.textContent,/manual facts are unchanged/);
const retry=status.children.find(node=>node.textContent==='Try again');assert(retry);retry.click();
await new Promise(resolve=>setImmediate(resolve));assert.equal(lookups,2);assert.equal(autosaves,1);assert.match(status.textContent,/Imported 1/);

const cells=tableDisplayCells([['A','A','B'],['A','A','C']], [{row:0,column:0,rowSpan:2,colSpan:2}]);
assert.equal(cells.flat().filter(Boolean).length,3);assert.equal(cells[0][0].colSpan,2);assert.equal(cells[1][0],null);
assert.throws(()=>tableDisplayCells([['A','B']],[{row:0,column:0,rowSpan:2,colSpan:1}]),/span/i);
assert.match(app,/timeZoneName:\s*"short"/);
let pendingList,flushed=false,openedNote,switchedWorkspace;
const element=()=>({children:[],dataset:{},setAttribute(){},append(...nodes){this.children.push(...nodes);},addEventListener(name,fn){this[name]=fn;}});
const pendingContext=vm.createContext({captureAccountRequest:()=>({userID:'owner'}),requireCurrentAccountRequest(){},isCurrentAccountRequest:()=>true,
 pendingSyncItems:async()=>['one','two'].map(id=>({kind:'draft',id,projectID:'canonical-project',title:id,project:'Project',reason:'Waiting'})),
 document:{createElement:element},showWebNotice:async(_title,_message,{content})=>{pendingList=content;},
 flushPendingNotebookDrafts:async()=>{flushed=true;},loadNotebookDraft:async()=>flushed?null:{},pendingNotebookDraftReason:()=> 'Waiting',
 activeWebWarningClose(){},currentContentSummary:()=>({projects:[{id:'raw-project',clientID:'canonical-project'}]}),researchProjectID:p=>p.clientID,
 projectRecordID:p=>p.id,visibleWorkspaceRecords:()=>[{id:'workspace',projectID:'raw-project'}],activeWorkspaceID:'other',
 switchWorkspace:async id=>{switchedWorkspace=id;return true;},switchWorkflowView:async()=>{},openNotebookNoteColumn:async(_project,note)=>{openedNote=note;}});
vm.runInContext(extract('async function openPendingSyncDetails(','async function openConnectionStatusConflictReview('),pendingContext);
await pendingContext.openPendingSyncDetails();
await pendingList.children[0].children.find(node=>node.textContent==='Retry sync').click();
assert(pendingList.children.every(row=>row.children.find(node=>node.textContent==='Synced')),'Retry refreshes every draft affected by the shared sync');
await pendingList.children[0].children.find(node=>node.textContent==='Open Note').click();
assert.equal(switchedWorkspace,'workspace');assert.equal(openedNote.id,'one');
console.log('Production regressions passed: clipboard styles, shared Report source guard, explicit Note destination, recoverable property import, merged cell geometry and timezone.');
