import assert from 'node:assert/strict';
import {mountResearchDeleteControls} from '../public/research-delete-controls.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

class Node {
  constructor(tag) {this.tag=tag;this.children=[];this.listeners={};this.attributes={};this.isConnected=true;this.value='';}
  append(...nodes) {this.children.push(...nodes);if(this.tag==='select'&&!this.value)this.value=this.children[0].value;}
  replaceChildren(...nodes) {this.children=[];this.append(...nodes);}
  setAttribute(name,value) {this.attributes[name]=value;}
  addEventListener(name,fn) {this.listeners[name]=fn;}
  querySelectorAll(tag) {return this.children.flatMap(child=>[...(child.tag===tag?[child]:[]),...child.querySelectorAll(tag)]);}
}
globalThis.document={createElement:tag=>new Node(tag)};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const find=(root,predicate)=>[root,...root.children.flatMap(child=>all(child))].find(predicate);
const all=root=>[root,...root.children.flatMap(child=>all(child))];
async function fixture(mode,scopeValue='selected') {
  const root=new Node('div'), requests=[], confirms=[], deletions=[];
  let valid=true, projectID='project-a', deleted=false;
  mountResearchDeleteControls(root,{
    project:{id:'project-a',name:'Project A'},currentProjectID:()=>projectID,isCurrent:()=>valid,
    request:async(path,body)=>{
      requests.push({path,body});
      if(path.endsWith('/list'))return {conversations:deleted?[]:[{id:'one',title:'One'},{id:'hidden',title:'Hidden',historyHiddenAt:'date'}],nextCursor:null};
      if(path.endsWith('/delete-preview')){if(mode==='account-during-preview')valid=false;return {count:2,conversationIDs:['one','hidden'],confirmationToken:'reviewed'};}
      assert(path.endsWith('/delete-many'));deleted=true;return {deletedCount:2,conversationIDs:['one','hidden'],projectIDs:['project-a']};
    },
    confirm:async(title,message,options)=>{
      confirms.push({title,message,options});
      if(mode==='account-during-confirm')valid=false;
      if(mode==='project-during-confirm')projectID='project-b';
      return mode!=='cancel';
    },beforeDelete:ids=>deletions.push(ids),onDeleted:async()=>{}
  });
  await flush();
  assert.equal(requests.length,1,'Opening the section loads exactly one page');
  assert.deepEqual(requests[0].body,{limit:30,includeHidden:true,q:''});
  const scope=find(root,node=>node.tag==='select');scope.value=scopeValue;await scope.listeners.change();await flush();
  if(scopeValue==='selected') {
    const boxes=find(root,node=>node.className==='settings-conversation-list').querySelectorAll('input');
    for(const box of boxes){box.checked=true;box.listeners.change();}
  }
  const review=find(root,node=>node.textContent==='Review deletion');
  await Promise.all([review.listeners.click(),review.listeners.click()]);await flush();
  const commits=requests.filter(row=>row.path.endsWith('/delete-many'));
  if(mode==='success') {
    assert.equal(commits.length,1,'Double click cannot submit a second deletion');
    assert.equal(commits[0].body.confirmPermanentDeletion,true);assert.equal(commits[0].body.confirmationToken,'reviewed');
    assert.equal(commits[0].body.scope,scopeValue);
    if(scopeValue==='project')assert.equal(commits[0].body.projectID,'project-a');
    assert.equal(deletions.length,1);
    assert.match(find(root,node=>node.className==='settings-conversation-delete-status').textContent,/Permanently deleted 2 conversations/);
  } else {
    assert.equal(commits.length,0,`${mode} must never delete`);assert.equal(deletions.length,0);
  }
  if(confirms.length) {
    assert.match(confirms[0].message,/Delete 2 conversations/);assert.match(confirms[0].message,/research answers and evidence snapshots/);
    assert.match(confirms[0].message,/Saved passages, Notes, Reports, project data/);
    assert.match(confirms[0].message,/cannot be undone and does not go to Trash/);
    assert.equal(confirms[0].options.confirmLabel,'Delete 2 conversations');
  }
  const requestsAfter=requests.length;await flush();assert.equal(requests.length,requestsAfter,'No recurring requests');
}
for(const scope of ['selected','project','all'])await fixture('success',scope);
await fixture('cancel');await fixture('account-during-preview');await fixture('account-during-confirm');await fixture('project-during-confirm','project');
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function refreshAfterResearchDeletion(');
const body=source.slice(start,source.indexOf('\n}',start)+2);
let aborted=0;
const state={researchConversationID:'drop',paneOrder:['research:conversation:drop','reader:keep'],paneWeights:{'research:conversation:drop':920,'reader:keep':900},
  utilityInstances:[{id:'instance',key:'analysis',conversationID:'drop',draft:'Drop draft'},{id:'keep',key:'analysis',conversationID:'keep',draft:'Keep draft'}],
  columnGroups:[{paneIDs:['utility:analysis:instance','reader:keep'],columns:{'utility:analysis:instance':{kind:'utility',value:{conversationID:'drop'},draft:'Drop draft'},'reader:keep':{kind:'reader',value:{id:'reader'}}}}]};
const context=vm.createContext({state,valid:true,researchOpenGeneration:0,researchQuestionDraft:'Drop draft',activeResearchConversation:{id:'drop'},
  activeResearchProgress:new Map([['drop',{controller:{abort(){aborted++;}}}],['keep',{}]]),
  supplementalResearchConversations:new Map([['drop',{}],['keep',{}]]),supplementalResearchConversationIDs:['drop','keep'],
  researchNewChatDrafts:new Map([['followup:drop','Drop draft'],['followup:keep','Keep draft'],['utility:analysis:instance','Drop draft']]),
  researchDraftPaneIDs:new Set(),researchConversationList:[{id:'drop'},{id:'keep'}],researchHistoryPageReaders:new Map(),
  localStorage:{},removeResearchRequestRecovery(){},paneIDForResearchConversation:id=>'research:conversation:'+id,paneIDForUtilityInstance:instance=>'utility:analysis:'+instance.id,
  readResearchConversationList:{invalidate(){}},saveWorkspaceState(){},refreshResearchConversationList:async()=>{},refreshResearchProjectAssignmentConsumers:async()=>{},transitionWorkspace:async()=>{}});
context.requireCurrentAccountRequest=()=>{if(!context.valid)throw Error('Account changed');};
vm.runInContext(body,context);
const before=JSON.stringify(state);context.valid=false;
await assert.rejects(context.refreshAfterResearchDeletion({conversationIDs:['drop'],projectIDs:[]},{}),/Account changed/);
assert.equal(JSON.stringify(state),before,'Stale completion must not mutate another account');context.valid=true;
await context.refreshAfterResearchDeletion({conversationIDs:['drop'],projectIDs:[]},{userID:'owner'});
assert.equal(aborted,1);assert(context.activeResearchProgress.has('keep'));
assert(!context.researchNewChatDrafts.has('followup:drop'));assert.equal(context.researchNewChatDrafts.get('followup:keep'),'Keep draft');
assert.equal(state.utilityInstances[0].conversationID,'');assert.equal(state.utilityInstances[0].draft,'');
assert.equal(state.utilityInstances[1].draft,'Keep draft');
assert.deepEqual(state.columnGroups[0].paneIDs,['reader:keep']);
assert.equal(state.paneWeights['reader:keep'],900);
console.log('Settings deletion controls passed: count and disclosure, all scopes, cancellation, stale account/project fences, duplicate-submit protection, paged hidden history and no recurring requests.');
