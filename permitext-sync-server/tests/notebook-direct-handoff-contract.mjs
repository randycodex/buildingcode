import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {normalizeNotebookEvidenceLinks} from '../notebook-contract.mjs';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function addPassageToNotebook(');
const code=source.slice(start,source.indexOf('\nfunction renderInlineCommentBox(',start));
for(const mode of ['current','new','cancel','changed']) {
 const calls=[]; let complete;
 const pending=new Promise(resolve=>complete=resolve);
 const mount={insertionTarget:()=>({id:'note',title:'Existing writing'}),insertLinkedReference:async(...args)=>calls.push(['insert',...args]),refreshCards:async()=>{},focusCard:async id=>calls.push(['focus',id])};
 const context=vm.createContext({workspaceProject:()=>({id:'p'}),captureAccountRequest:()=>({userID:'u'}),
 isCurrentAccountRequest:()=>true,requireCurrentAccountRequest(){},activeWorkspaceID:'w',state:{workflowNavigationGeneration:0},
 researchProjectID:p=>p.id,notebookMounts:new Map([['p',mount]]),openWebWarning:()=>pending,
 crypto:{randomUUID:()=> 'link'},Date,researchCodeEdition:()=> '2014',navigator:{onLine:true},
 emptyNotebookDocument:()=>({document:[]}),postResearch:async(path,payload)=>{calls.push(['save',payload]);return {card:{id:'created'}};},
 saveNotebookCardSnapshot:async()=>{},paneIDForProjectNotebook:()=> 'notes',requestLinkedPanePlacement:(...args)=>calls.push(['place',...args]),
 openProjectNotebook:async()=>true,whenWorkspacePaneReady:async()=>true});
 vm.runInContext(code,context);
 const action=context.addPassageToNotebook({isConnected:true,closest:()=>({dataset:{paneId:'reader'}})},
 {sectionID:'123',sectionNumber:'1020.4',title:'Dead ends',codePrefix:'BC',codeVersion:'historical/2014'},'Exact paragraph including its exception.');
 if(mode==='changed')context.activeWorkspaceID='different';
 complete(mode==='cancel'?false:mode==='new'?'new':'current');await action;
 if(['cancel','changed'].includes(mode)){assert.equal(calls.length,0);continue;}
 const link=mode==='current'?calls[0][3]:calls[0][1].evidenceLinks[0];
 const normalized=normalizeNotebookEvidenceLinks([link])[0];
 assert.equal(normalized.passages[0].exact,'Exact paragraph including its exception.');
 assert.equal(normalized.source.codeVersion,'historical/2014');assert.equal(normalized.source.codeEdition,'2014');
 assert.equal(normalized.source.sectionID,'123');
 if(mode==='current'){assert.equal(calls.length,1);assert.equal(calls[0][1],'note');assert.equal(calls[0][2].referenceKind,'selectedPassage');}
 else {assert.deepEqual(calls.slice(1),[['place','reader','notes'],['focus','created']]);assert.equal(calls[0][1].document.document[0].content[0].props.referenceID,link.id);}
}
const mountStart=source.indexOf('    mountState.insertLinkedReference = async');
const mountCode=source.slice(mountStart,source.indexOf('\n    };',mountStart)+7);
for(const changed of ['none','card','disposed','readonly','conflict','loading']){
 const oldLinks=[];const card={id:'note',evidenceLinks:oldLinks};let inserts=0,writes=0;
 const c=vm.createContext({mountState:{},requestIdentity:{},requireCurrentAccountRequest(){},disposed:changed==='disposed',
 notebookReadOnly:changed==='readonly',saveConflict:changed==='conflict',activeCard:card,draftDocument:null,
 editorMount:{insertReference:()=>{inserts++;return changed!=='loading';},getDocument:()=>({retained:'Existing text plus reference'})},
 markNotebookDirty(){},persistFocusedDraft:async()=>{writes++;}});
 vm.runInContext(mountCode,c);
 const action=c.mountState.insertLinkedReference(changed==='card'?'other':'note',{referenceID:'answer'},{id:'evidence'});
 if(changed==='none'){await action;assert.equal(writes,1);assert.equal(c.draftDocument.retained,'Existing text plus reference');}
 else {await assert.rejects(action);assert.equal(writes,0);assert.equal(card.evidenceLinks,oldLinks);if(changed!=='loading')assert.equal(inserts,0);}
}
console.log('Direct Note handoff: exact edition/passage, current/new destinations, cancellation, navigation and editor guards passed.');
const handoffStart=source.indexOf('function renderResearchNotebookHandoff(');
const handoffCode=source.slice(handoffStart,source.indexOf('\nfunction renderResearchMessageCapture(',handoffStart));
for(const changed of [false,true]){
 const nodes=[],insertions=[];let choose;
 const destination=new Promise(resolve=>choose=resolve);
 const element=tag=>{const e={tag,children:[],isConnected:true,value:'',append(...children){this.children.push(...children);if(tag==='select')this.value=children[0].value;},setAttribute(){},addEventListener(type,fn){this[type]=fn;},closest:()=>({dataset:{paneId:'assistant'}})};nodes.push(e);return e;};
 const c=vm.createContext({document:{createElement:element},hasCapability:()=>true,researchProjects:()=>[{id:'p'}],
 researchProjectID:p=>p.id,readableProjectName:()=> 'Project',crypto:{randomUUID:()=> 'mutation'},
 captureAccountRequest:()=>({userID:'u'}),isCurrentAccountRequest:()=>true,state:{workflowNavigationGeneration:0},activeWorkspaceID:'w',researchAnswerQuestion:()=> 'Question',
 notebookMounts:new Map([['p',{insertionTarget:()=>({id:'existing',title:'My writing'}),insertLinkedReference:async(...args)=>insertions.push(args)}]]),
 openWebWarning:()=>destination,showWebNotice:async()=>assert.fail('Unexpected notice')});
 vm.runInContext(handoffCode,c);c.renderResearchNotebookHandoff({primaryProjectID:'p'},{id:'answer',answer:{}});
 const pending=nodes.find(e=>e.textContent==='Add to note').click();
 if(changed)c.state.workflowNavigationGeneration++;
 choose('current');await pending;
 assert.equal(insertions.length,changed?0:1);
 if(!changed){assert.equal(insertions[0][0],'existing');assert.equal(insertions[0][1].referenceID,'answer');}
}
console.log('Assistant insertion preserves the chosen Note and ignores stale destination dialogs.');
