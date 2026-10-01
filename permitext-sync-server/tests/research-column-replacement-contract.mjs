import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function openResearchConversation(');
const fn=source.slice(start,source.indexOf('\n}',start)+2);
function setup(otherOwner=false){
 const instance={id:'column-a',key:'analysis',conversationID:'old',draft:'unfinished follow-up'};
 const state={utilityInstances:[instance,...(otherOwner?[{id:'column-b',key:'analysis',conversationID:'old'}]:[])],researchConversationID:'',paneOrder:['utility:analysis:column-a','research:conversation:old'],paneWeights:{'research:conversation:old':400}};
 const context=vm.createContext({state,activeWorkspaceID:'project-workspace',researchDraftPaneIDs:new Set(['utility:analysis:column-a']),researchNewChatDrafts:new Map(),supplementalResearchConversationIDs:['old','other'],supplementalResearchConversations:new Map([['old',{id:'old'}],['other',{id:'other'}]]),paneIDForUtilityInstance:i=>'utility:analysis:'+i.id,captureAccountRequest:()=>({}),isCurrentAccountRequest:()=>true,fetchAuthoritativeResearchConversation:async id=>({id}),saveWorkspaceState(){},transitionWorkspace:async()=>{}});
 vm.runInContext(fn,context);return {context,instance};
}
for(const otherOwner of [false,true]){
 const {context:c,instance}=setup(otherOwner);
 await c.openResearchConversation('new',{instance});
 assert.equal(instance.conversationID,'new');
 assert.equal(c.supplementalResearchConversationIDs.includes('old'),otherOwner,'Only another explicit owner keeps the old conversation open.');
 assert(c.supplementalResearchConversationIDs.includes('other'),'Unrelated open chats remain open.');
 assert(c.supplementalResearchConversationIDs.includes('new'));
 assert.equal(c.researchNewChatDrafts.get('followup:old'),'unfinished follow-up','Old follow-up draft is preserved.');
 if(!otherOwner){assert(!c.state.paneOrder.includes('research:conversation:old'));assert.equal(c.state.paneWeights['research:conversation:old'],undefined);}
}
const {context:c,instance}=setup();
c.fetchAuthoritativeResearchConversation=async()=>{c.activeWorkspaceID='other-workspace';return{id:'new'};};
assert.equal(await c.openResearchConversation('new',{instance}),null);
assert.equal(instance.conversationID,'old','A stale fetch must not replace a column after a workspace switch.');
console.log('Research column replacement: no ghost chat; other owners, drafts and workspace races preserved.');
