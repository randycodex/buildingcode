import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);};
function harness(instanceMode=false){
 const calls={requests:[],loading:0,disposed:0,created:0,layout:0},header={},rail={scrollTop:83,contains:()=>false,querySelector:()=>null};
 const content={children:[],querySelector:()=>content.children.length?rail:null,replaceChildren(...children){this.children=children;}};
 const panel={isConnected:true,parentNode:null,classList:{add(){}},dataset:{},querySelector:()=>content};
 const instance=instanceMode?{id:'instance',key:'analysis',conversationID:'a'}:null;
 const state={researchConversationID:'a',utilityInstances:instance?[instance]:[],workflowNavigationGeneration:0};
 const track={querySelector:selector=>selector.includes('.research-v2-panel')?panel:null};panel.parentNode=track;
 const conversations={a:{id:'a',primaryProjectID:'project-a',title:'Question A',messages:[],sources:[]},b:{id:'b',primaryProjectID:'project-a',title:'Question B',messages:[],sources:[]}};
 let accountCurrent=true, options;
 const context=vm.createContext({state,track,CSS:{escape:v=>v},researchDraftPaneIDs:new Set(),researchNewChatDrafts:new Map(),supplementalResearchConversations:new Map(),activeResearchConversation:conversations.a,
  researchHistoryShowing:false,researchConversationPaneOpened:true,activeWorkspaceID:'workspace',activeAccount:()=>({userID:'owner'}),captureAccountRequest:()=>1,isCurrentAccountRequest:()=>accountCurrent,
  paneIDForUtilityInstance:i=>'instance:'+i.id,renderUtility:()=>{calls.created++;return panel;},analysisTemplate:{},showColumnLoadingStatus(){calls.loading++;},
  postResearch:async(path,body)=>{calls.requests.push(path);if(path.endsWith('/list'))return{conversations:Object.values(conversations),nextCursor:null,hasMore:false};if(path.endsWith('/get'))return{conversation:conversations[body.conversationID]};throw Error(path);},
  researchWorkspaceProjectID:()=> 'project-a',researchConversationInWorkspace:conversation=>conversation.primaryProjectID==='project-a',
  createResearchV2View(value){options=value;return{element:{id:value.conversation.id},dispose(){calls.disposed++;}};},
  crypto:{randomUUID:()=> 'new-request'},sessionStorage:{getItem:()=>null},document:{activeElement:null},MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>fn(),
  hasCapability:()=>true,scheduleResearchDraftPersistence(){},notifyWorkspaceLayoutChange(){calls.layout++;}
 });
 vm.runInContext([actual('researchAssistantContentIdentity'),actual('renderResearchV2Pane'),actual('refreshResearchConversationInPlace')].join('\n'),context);
 return{context,panel,header,calls,state,instance,conversations,get options(){return options;},get accountCurrent(){return accountCurrent;},set accountCurrent(v){accountCurrent=v;}};
}
for(const mode of [false,true]){
 const f=harness(mode),paneID=mode?'instance:instance':'utility:analysis';
 await f.context.renderResearchV2Pane(paneID,{available:true});
 assert.deepEqual(f.calls.requests,['/research/conversations/list','/research/conversations/get']);
 assert.equal(f.calls.loading,1);assert.equal(f.calls.created,1);
 f.options.onDraft('Unsent follow-up in A');
 for(const id of ['b','a','b']){
  if(mode){f.instance.conversationID=id;f.context.supplementalResearchConversations.set(id,f.conversations[id]);}
  else{f.state.researchConversationID=id;f.context.activeResearchConversation=f.conversations[id];}
  assert.equal(await f.context.refreshResearchConversationInPlace(paneID,id,f.instance),'updated');
  assert.equal(f.options.conversation.id,id);
 }
 assert.equal(f.calls.requests.length,2,'Switch rendering must not repeat configuration, history or conversation requests');
 assert.equal(f.calls.loading,1,'An already visible Assistant never goes back to a loading screen');
 assert.equal(f.calls.created,1,'The original column and its header/close controls stay mounted');
 assert.equal(f.options.history[0].id,'a','Numbered history ordering stays stable');
 f.state.researchConversationID='a';
 if(mode){f.instance.conversationID='a';f.context.supplementalResearchConversations.set('a',f.conversations.a);}else f.context.activeResearchConversation=f.conversations.a;
 await f.context.refreshResearchConversationInPlace(paneID,'a',f.instance);
 assert.equal(f.options.initialDraft,'Unsent follow-up in A','Each conversation retains its own unsent draft');
 f.accountCurrent=false;
 assert.equal(await f.context.refreshResearchConversationInPlace(paneID,'a',f.instance),'stale');
 assert.equal(f.calls.loading,1);
}
console.log('V2 switching passed: primary/repeated columns, no loading-shell rebuild, no redundant requests, stable history order, per-conversation drafts and stale-account rejection.');

// A completed turn is published from its authoritative mutation response.
// It must not reopen the pane or perform list/get/configuration reads.
for(const mode of [false,true]){
 const f=harness(mode),paneID=mode?'instance:instance':'utility:analysis';
 let saved=0,invalidated=0;
 const result={conversation:{...f.conversations.a,revision:2,messages:[
  {id:'question-new',role:'user',question:'State the rule.'},
  {id:'answer-new',role:'assistant',answer:{answerText:'The saved, checked answer. [S1]'}}
 ],sources:[]},usage:{used:1}};
 Object.assign(f.context,{postResearchWithProgress:async()=>result,
  researchConversationList:[{id:'a',title:'Question A'}],researchHistoryPageReaders:new Map(),
  readResearchConversationList:{invalidate(){invalidated++;}},refreshResearchUsage:{invalidate(){invalidated++;}},
  saveWorkspaceState(){saved++;},supplementalResearchConversationIDs:[],sessionStorage:{getItem:()=>null,removeItem(){}}});
 await f.context.renderResearchV2Pane(paneID,{available:true});
 f.options.onDraft('State the rule.');
 await f.options.onSend({question:'State the rule.',requestID:'unique-request',signal:new AbortController().signal});
 assert.equal(f.calls.requests.length,2,'Completion does not refetch the history or the just-saved answer');
 assert.equal(f.calls.loading,1,'Completion never restores the column loading screen');
 assert.equal(f.calls.created,1,'The column and header survive the answer');
 assert.equal(f.options.conversation.messages.at(-1).id,'answer-new');
 assert.equal(f.options.revealAnswerID,'answer-new','Only the new saved answer receives the reveal animation');
 assert.equal(f.options.initialDraft,'','The sent draft is cleared in the completed view');
 assert.equal(saved,1);assert.equal(invalidated,2);
 assert.ok(!('messages' in f.context.researchConversationList[0]),'History summaries do not retain whole conversations');
}
console.log('V2 completion passed: publish authoritative result in place, no reload/readback, cleared sent draft and targeted new-answer reveal.');

for(const stale of ['account','workspace','closed-pane']){
 const f=harness();let finish;
 Object.assign(f.context,{postResearchWithProgress:()=>new Promise(resolve=>finish=resolve),sessionStorage:{getItem:()=>null,removeItem(){throw Error('Late response cleared recovery state');}}});
 await f.context.renderResearchV2Pane('utility:analysis',{available:true});
 f.options.onDraft('Keep my draft');
 const pending=f.options.onSend({question:'Keep my draft',requestID:'stale-turn',signal:new AbortController().signal});
 if(stale==='account')f.accountCurrent=false;
 if(stale==='workspace')f.context.activeWorkspaceID='elsewhere';
 if(stale==='closed-pane')f.panel.isConnected=false;
 finish({conversation:{...f.conversations.a,messages:[{id:'late',role:'assistant'}]}});await pending;
 assert.equal(f.context.researchNewChatDrafts.get('followup:a'),'Keep my draft',stale);
 assert.equal(f.calls.loading,1);assert.equal(f.calls.created,1);
}
console.log('Late completion passed: account, workspace and closed-pane changes preserve drafts and recovery state.');

// Creating a new question in a repeated column must retire its former owner,
// while retaining that former conversation's unsent draft for a later reopen.
{
 const f=harness(true);const created={id:'created',primaryProjectID:'project-a',title:'New question',messages:[],sources:[]};
 f.state.paneOrder=['instance:instance','research:conversation:a'];f.state.paneWeights={'research:conversation:a':920};
 Object.assign(f.context,{crypto:{randomUUID:()=> 'new-request'},researchConversationList:[{id:'a'}],researchHistoryPageReaders:new Map(),
  readResearchConversationList:{invalidate(){}},refreshResearchUsage:{invalidate(){}},saveWorkspaceState(){},
  supplementalResearchConversationIDs:['a'],researchConversationPaneIsOpen:()=>false});
 f.context.supplementalResearchConversations.set('a',f.conversations.a);
 await f.context.renderResearchV2Pane('instance:instance',{available:true});
 f.options.onDraft('Retain the former draft');
 f.context.postResearch=async (path,body)=>{assert.equal(path,'/research/conversations/create');assert.equal(body.projectID,'project-a');return{conversation:created};};
 await f.options.onNew();
 assert.equal(f.instance.conversationID,'created');assert.equal(f.instance.draft,'');
 assert.equal(f.context.researchNewChatDrafts.get('followup:a'),'Retain the former draft');
 assert.deepEqual([...f.context.supplementalResearchConversationIDs],['created']);
 assert.ok(!f.context.supplementalResearchConversations.has('a'));
 assert.deepEqual([...f.state.paneOrder],['instance:instance']);assert.ok(!('research:conversation:a' in f.state.paneWeights));
 assert.equal(f.calls.loading,1);assert.equal(f.options.history[0].id,'created');
}
console.log('New-question publication passed: retain the column, retire the former owner and keep its draft.');

// Historical unassigned answers remain readable, but new work belongs to a Project.
{
 const f=harness();f.context.researchWorkspaceProjectID=()=>'';
 f.conversations.a.primaryProjectID=null;f.conversations.b.primaryProjectID=null;
 f.context.researchConversationInWorkspace=c=>!c.primaryProjectID;
 let choices=0,sends=0;
 Object.assign(f.context,{chooseProjectForSaving:async()=>{choices++;},postResearchWithProgress:async()=>{sends++;}});
 await f.context.renderResearchV2Pane('utility:analysis',{available:true});
 assert(!('projectControl' in f.options),'The workspace owns the project; the view cannot reassign it.');
 f.options.onDraft('Keep this unsent historical follow-up');
 const disposed=f.calls.disposed,requests=f.calls.requests.length;
 await f.options.onNew();
 assert.equal(choices,1);assert.equal(f.calls.requests.length,requests);
 assert.equal(f.calls.disposed,disposed,'Choosing a Project cannot dispose the current view prematurely.');
 await assert.rejects(f.options.onSend({question:'Keep this unsent historical follow-up',requestID:'unassigned'}),/Open a Project/);
 assert.equal(sends,0,'An unassigned conversation cannot start a paid answer.');
 assert.equal(f.context.researchNewChatDrafts.get('followup:a'),'Keep this unsent historical follow-up');
}
{
 const f=harness();let notice='';
 f.context.showWebNotice=async(_title,message)=>{notice=message;};
 await f.context.renderResearchV2Pane('utility:analysis',{available:true});
 f.options.onDraft('Preserve this draft');const disposed=f.calls.disposed;
 f.context.postResearch=async()=>{throw Error('Project sync unavailable');};
 await f.options.onNew();
 assert.equal(f.calls.disposed,disposed);assert.equal(notice,'Project sync unavailable');
 assert.equal(f.context.researchNewChatDrafts.get('followup:a'),'Preserve this draft');
}
{
 const f=harness();f.conversations.a.primaryProjectID='another-project';
 await f.context.renderResearchV2Pane('utility:analysis',{available:true});
 assert.equal(f.options,undefined,'Restoring a stale pane must not reveal another project’s conversation.');
}
console.log('Workspace Project ownership passed: automatic creation scope, no selector, preserved historical answers/drafts, and no unassigned paid calls.');
