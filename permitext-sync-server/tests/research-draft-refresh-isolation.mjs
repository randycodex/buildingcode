import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function extract(name,async=false){const start=source.indexOf(`${async?'async ':''}function ${name}(`);const end=source.indexOf('\n}',start);assert.ok(start>=0&&end>start);return source.slice(start,end+2);}
function harness() {
 const drafts=new Map(), panes=new Map();let snapshot;let owner={userID:'owner',sessionToken:'session'};let focused=null;let afterTransition=()=>{};
 const state={researchConversationID:'named',utilityInstances:[],researchViewState:null};
 const find=selector=>{const id=selector.match(/data-pane-id="([^"]+)"/)?.[1];const pane=panes.get(id);if(!pane)return null;if(selector.includes('.research-question-input'))return pane.input;if(selector.includes('.research-conversation-panel')&&!pane.input)return null;return pane;};
 const context=vm.createContext({state,Map,Set,Object,String,Event:class{},CSS:{escape:x=>x},
  researchNewChatDrafts:drafts,researchDraftPaneIDs:new Set(),supplementalResearchConversationIDs:[],supplementalResearchConversations:new Map(),
  researchQuestionDraft:'',activeResearchConversation:null,researchHistoryShowing:false,researchConversationPaneOpened:true,restoredResearchViewState:null,
  activeWorkspaceID:'workspace',activeAccount:()=>owner,researchArtifactConsumersVisible:()=>true,
  researchConversationPaneIsOpen:()=>Boolean(panes.get('utility:analysis')?.input),
  paneIDForResearchConversation:id=>!id||id===state.researchConversationID?'utility:analysis':`research:conversation:${id}`,
  fetchAuthoritativeResearchConversation:async id=>({id,messages:[]}),
  track:{querySelector:find,querySelectorAll:()=>[...panes.values()].map(p=>p.input).filter(Boolean)},
  document:{get activeElement(){return focused;}},
  transitionWorkspace:async()=>{for(const pane of panes.values())if(pane.input)mount(pane.id,pane.conversationID);await afterTransition();}
 });
 vm.runInContext(['restoreResearchWorkspaceState','captureResearchWorkspaceState'].map(x=>extract(x)).join('\n')+'\n'+extract('refreshVisibleResearchArtifactConsumers',true),context);
 context.saveWorkspaceState=()=>{vm.runInContext('captureResearchWorkspaceState()',context);snapshot=JSON.stringify(state.researchViewState);};
 const composerStart=source.indexOf('  const followUpDraftKey = `followup:${conversationID}`;');
 const handlerStart=source.indexOf('  input.addEventListener("input", () => {',composerStart);
 const handler=source.slice(handlerStart,source.indexOf('\n  bindResearchSendShortcut(input, composer);',handlerStart));
 function mount(id,conversationID) {
  const callbacks={};const pane={id,conversationID,scrollTop:0,scrollHeight:100,clientHeight:100};
  const input={value:drafts.get(`followup:${conversationID}`)||'',dataset:{researchDraftKey:`followup:${conversationID}`},style:{},selectionStart:2,selectionEnd:4,
   addEventListener:(name,fn)=>callbacks[name]=fn,dispatchEvent:()=>callbacks.input(),matches:()=>true,
   closest:()=>({dataset:{paneId:id}}),focus:()=>{focused=input;},setSelectionRange:(a,b)=>{input.selectionStart=a;input.selectionEnd=b;}};
  pane.input=input;panes.set(id,pane);
  const scope=vm.createContext({...context,input,followUpDraftKey:`followup:${conversationID}`,ownerInstance:null,resizeComposerInput:()=>{},sendButton:{},researchEnabled:true,researchRequestActive:false,conversation:{sourceStatus:'current'},projectContextBlocked:false,starterAnalysisQuestion:''});
  vm.runInContext(handler,scope);
  return input;
 }
 return {context,state,drafts,panes,mount,setFocused:x=>{focused=x;},focused:()=>focused,
  reload:()=>{state.researchViewState=JSON.parse(snapshot);context.restoredResearchViewState=null;context.researchQuestionDraft='';vm.runInContext('restoreResearchWorkspaceState()',context);},
  refresh:()=>vm.runInContext('refreshVisibleResearchArtifactConsumers()',context),
  after:fn=>{afterTransition=fn;},changeOwner:()=>{owner={userID:'other',sessionToken:'other-session'};},snapshot:()=>snapshot};
}
// Real input persistence + capture/restore functions reproduce the observed path.
const h=harness();let input=h.mount('utility:analysis','named');
input.value='Retained unsent fixture question.';input.dispatchEvent();h.reload();
assert.equal(h.mount('utility:analysis','named').value,'Retained unsent fixture question.');
h.state.researchConversationID='selected';h.context.supplementalResearchConversationIDs.push('named');
h.mount('research:conversation:named','named');h.mount('utility:analysis','selected');
await h.refresh();
assert.equal(h.panes.get('research:conversation:named').input.value,'Retained unsent fixture question.');
assert.equal(h.panes.get('utility:analysis').input.value,'');
// Back to history leaves the named supplementary composer mounted.
h.panes.set('utility:analysis',{id:'utility:analysis',scrollTop:0});await h.refresh();
assert.equal(h.drafts.get('followup:named'),'Retained unsent fixture question.');
assert.equal(h.panes.get('research:conversation:named').input.value,'Retained unsent fixture question.');
h.state.researchConversationID='named';assert.equal(h.mount('utility:analysis','named').value,'Retained unsent fixture question.');
h.reload();assert.equal(h.drafts.get('followup:named'),'Retained unsent fixture question.');
// Distinct drafts cannot be copied between panes, including a deliberately empty draft.
h.state.researchConversationID='selected';h.drafts.set('followup:selected','Different draft');
h.mount('utility:analysis','selected');const named=h.mount('research:conversation:named','named');h.setFocused(named);
await h.refresh();assert.equal(h.panes.get('utility:analysis').input.value,'Different draft');
assert.equal(h.panes.get('research:conversation:named').input.value,'Retained unsent fixture question.');
assert.equal(h.focused(),h.panes.get('research:conversation:named').input);
input=h.panes.get('research:conversation:named').input;input.value='';input.dispatchEvent();await h.refresh();
assert.equal(h.drafts.get('followup:named'),'');assert.equal(h.panes.get('research:conversation:named').input.value,'');
// A transition crossing account identity must not focus/publish into the next account.
h.setFocused(h.panes.get('utility:analysis').input);const priorFocus=h.focused();h.after(()=>h.changeOwner());
assert.equal(await h.refresh(),false);assert.equal(h.focused(),priorFocus);
const moved=harness();const old=moved.mount('utility:analysis','named');moved.setFocused(old);
moved.after(()=>{moved.state.researchConversationID='selected';moved.mount('utility:analysis','selected');});
await moved.refresh();assert.equal(moved.focused(),old,'refresh cannot move focus into another conversation reusing the pane');
const switched=harness();switched.mount('utility:analysis','named');switched.after(()=>{switched.context.activeWorkspaceID='other-workspace';});
assert.equal(await switched.refresh(),false);
assert.match(source,/input\.dataset\.researchDraftKey = draftKey/,'new-chat composers keep their own focus identity');
assert.match(source,/input\.dataset\.researchDraftKey = followUpDraftKey/,'conversation composers use their durable draft key');
console.log('PASS actual Research refresh/capture/restore/input behavior: per-conversation drafts survive history, supplementary promotion, reload, explicit clearing and account transition.');
