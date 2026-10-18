import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {normalizeNotebookEvidenceLinks} from '../notebook-contract.mjs';
import {notebookReferenceBlocks} from '../public/notebook-passage-blocks.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function addPassageToNotebook(');
const code=source.slice(start,source.indexOf('\nfunction renderInlineCommentBox(',start));
for(const mode of ['current','unsaved','new','cancel','changed','account','detached','other-project']) {
 const calls=[]; let complete;
 const pending=new Promise(resolve=>complete=resolve);
 const hasOpenNote=['current','unsaved','account','detached'].includes(mode);
 const mount={insertionTarget:()=>({id:mode==='unsaved'?'':'note',title:'Existing writing'}),insertLinkedReference:async(...args)=>calls.push(['insert',...args])};
 const context=vm.createContext({window:{requestAnimationFrame:()=>{}},workspaceProject:()=>({id:'p'}),captureAccountRequest:()=>({userID:'u'}),
 isCurrentAccountRequest:()=>mode!=='account',requireCurrentAccountRequest(){},activeWorkspaceID:'w',state:{workflowNavigationGeneration:0},
 researchProjectID:p=>p.id,notebookMounts:new Map(hasOpenNote?[['p',mount]]:mode==='other-project'?[['other',mount]]:[]),
 openWebWarning:options=>{calls.push(['choose',options]);return pending;},
 crypto:{randomUUID:()=> 'link'},Date,researchCodeEdition:()=> '2014',navigator:{onLine:true},
 notebookReferenceBlocks,emptyNotebookDocument:()=>({document:[]}),postResearch:async(path,payload)=>{calls.push(['save',payload]);return {card:{id:'created'}};},
 saveNotebookCardSnapshot:async()=>{},showNotebookSavedLink:(...args)=>calls.push(['saved',...args])});
 vm.runInContext(code,context);
 const action=context.addPassageToNotebook({isConnected:mode!=='detached',closest:()=>({dataset:{paneId:'reader'}})},
 {sectionID:'123',sectionNumber:'1020.4',title:'Dead ends',codePrefix:'BC',codeVersion:'historical/2014'},'Exact paragraph including its exception.');
 if(mode==='changed')context.activeWorkspaceID='different';
 complete(mode==='cancel'?false:'new');await action;
 const mutations=calls.filter(call=>['insert','save','saved'].includes(call[0]));
 if(['cancel','changed','account','detached'].includes(mode)){assert.equal(mutations.length,0);continue;}
 const link=hasOpenNote?mutations[0][3]:mutations[0][1].evidenceLinks[0];
 const normalized=normalizeNotebookEvidenceLinks([link])[0];
 assert.equal(normalized.passages[0].exact,'Exact paragraph including its exception.');
 assert.equal(normalized.source.codeVersion,'historical/2014');assert.equal(normalized.source.codeEdition,'2014');
 assert.equal(normalized.source.sectionID,'123');
 if(hasOpenNote){assert.equal(calls.length,1,'An open Note inserts directly without a dialog or new Note.');assert.equal(calls[0][1],mode==='unsaved'?'':'note');assert.equal(calls[0][2].referenceKind,'selectedPassage');}
 else {assert.equal(calls[0][0],'choose');assert.equal(mutations[0][0],'save');assert.equal(mutations[0][1].projectID,'p');assert.equal(mutations[1][0],'saved');assert.equal(mutations[0][1].document.document[0].content[0].props.referenceID,link.id);assert.equal(mutations[0][1].document.document[1].content[0].text,link.passages[0].exact);}
}
const mountStart=source.indexOf('    mountState.insertLinkedReference = async');
const mountCode=source.slice(mountStart,source.indexOf('\n    };',mountStart)+7);
for(const changed of ['none','card','disposed','readonly','conflict','loading']){
 const oldLinks=[];const card={id:'note',evidenceLinks:oldLinks};let inserts=0,writes=0;
 const c=vm.createContext({mountState:{},requestIdentity:{},requireCurrentAccountRequest(){},disposed:changed==='disposed',
 notebookReadOnly:changed==='readonly',saveConflict:changed==='conflict',activeCard:card,draftDocument:null,
 editorMount:{appendReference:(_reference,passages)=>{inserts++;assert.equal(passages[0].exact,'Full captured passage.');return changed!=='loading';},insertReference:()=>assert.fail('External passages must append instead of using the caret'),getDocument:()=>({retained:'Existing text plus reference'})},
 markNotebookDirty(){},persistFocusedDraft:async()=>{writes++;}});
 vm.runInContext(mountCode,c);
 const action=c.mountState.insertLinkedReference(changed==='card'?'other':'note',{referenceID:'answer'},{id:'evidence',passages:[{exact:'Full captured passage.'}]});
 if(changed==='none'){await action;assert.equal(writes,1);assert.equal(c.draftDocument.retained,'Existing text plus reference');}
 else {await assert.rejects(action);assert.equal(writes,0);assert.equal(card.evidenceLinks,oldLinks);if(changed!=='loading')assert.equal(inserts,0);}
}
console.log('Direct Note handoff: open saved/unsaved Note without dialog, exact edition/passage, same-Project destination, new Note fallback and editor guards passed.');
const handoffStart=source.indexOf('function renderResearchNotebookHandoff(');
const handoffCode=source.slice(handoffStart,source.indexOf('\nfunction renderResearchMessageCapture(',handoffStart));
for(const changed of [false,true]){
 const nodes=[],insertions=[];let finish;
 const inserted=new Promise(resolve=>finish=resolve);
 const element=tag=>{const e={tag,children:[],isConnected:true,value:'',append(...children){this.children.push(...children);if(tag==='select')this.value=children[0].value;},setAttribute(){},addEventListener(type,fn){this[type]=fn;},closest:()=>({dataset:{paneId:'assistant'}})};nodes.push(e);return e;};
 const c=vm.createContext({window:{requestAnimationFrame:()=>{}},document:{createElement:element},hasCapability:()=>true,researchProjects:()=>[{id:'p'}],
 researchProjectID:p=>p.id,readableProjectName:()=> 'Project',crypto:{randomUUID:()=> 'mutation'},
 captureAccountRequest:()=>({userID:'u'}),isCurrentAccountRequest:()=>true,state:{workflowNavigationGeneration:0},activeWorkspaceID:'w',researchAnswerQuestion:()=> 'Question',
 notebookMounts:new Map([['p',{insertionTarget:()=>({id:'existing',title:'My writing'}),insertLinkedReference:async(...args)=>{insertions.push(args);await inserted;}}]]),
 openWebWarning:()=>assert.fail('An open Note must not show a destination dialog'),showWebNotice:async()=>assert.fail('Unexpected notice')});
 vm.runInContext(handoffCode,c);c.renderResearchNotebookHandoff({primaryProjectID:'p'},{id:'answer',answer:{}});
 const pending=nodes.find(e=>e.textContent==='Add to note').click();
 if(changed)c.state.workflowNavigationGeneration++;
 finish();await pending;
 assert.equal(insertions.length,1);
 assert.equal(insertions[0][0],'existing');assert.equal(insertions[0][1].referenceID,'answer');
 assert.equal(nodes.find(e=>e.tag==='button').textContent,changed?'Add to note':'Added to note','A stale completion must not update the new view.');
}
console.log('Assistant insertion uses the open Note without a dialog and ignores stale completion UI.');
