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
 const conversations={a:{id:'a',title:'Question A',messages:[],sources:[]},b:{id:'b',title:'Question B',messages:[],sources:[]}};
 let accountCurrent=true, options;
 const context=vm.createContext({state,track,CSS:{escape:v=>v},researchDraftPaneIDs:new Set(),researchNewChatDrafts:new Map(),supplementalResearchConversations:new Map(),activeResearchConversation:conversations.a,
  researchHistoryShowing:false,researchConversationPaneOpened:true,activeWorkspaceID:'workspace',activeAccount:()=>({userID:'owner'}),captureAccountRequest:()=>1,isCurrentAccountRequest:()=>accountCurrent,
  paneIDForUtilityInstance:i=>'instance:'+i.id,renderUtility:()=>{calls.created++;return panel;},analysisTemplate:{},showColumnLoadingStatus(){calls.loading++;},
  postResearch:async(path,body)=>{calls.requests.push(path);if(path.endsWith('/list'))return{conversations:Object.values(conversations),nextCursor:null,hasMore:false};if(path.endsWith('/get'))return{conversation:conversations[body.conversationID]};throw Error(path);},
  researchWorkspaceProjectID:()=>'',researchConversationInWorkspace:()=>true,createResearchProjectSelect:()=>null,
  createResearchV2View(value){options=value;return{element:{id:value.conversation.id},dispose(){calls.disposed++;}};},
  sessionStorage:{getItem:()=>null},document:{activeElement:null},MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>fn(),
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
