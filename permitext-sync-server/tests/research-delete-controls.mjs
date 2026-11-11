import assert from 'node:assert/strict';
import {createResearchHistoryManagement} from '../public/research-delete-controls.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

class Node {
  constructor(tag) {this.tag=tag;this.children=[];this.listeners={};this.attributes={};this.isConnected=true;this.value='';this.style={};this.offsetWidth=260;}
  append(...nodes) {for(const node of nodes){node.parent=this;this.children.push(node);}}
  prepend(...nodes) {for(const node of nodes)node.parent=this;this.children.unshift(...nodes);}
  setAttribute(name,value) {this.attributes[name]=value;}
  removeAttribute(name) {delete this.attributes[name];}
  addEventListener(name,fn) {this.listeners[name]=fn;}
  querySelector(selector) {return all(this).slice(1).find(node=>selector==='button'?node.tag==='button':node.className?.split(' ').includes(selector.slice(1)));}
  remove() {if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.isConnected=false;}
  contains(node) {return all(this).includes(node);}
  getBoundingClientRect() {return {right:320,bottom:100};}
  focus() {document.activeElement=this;}
  get classList(){return {add:name=>{this.className=`${this.className||''} ${name}`;},toggle:(name,value)=>{const names=new Set((this.className||'').split(' '));value?names.add(name):names.delete(name);this.className=[...names].join(' ');}};}
}
const all=root=>[root,...root.children.flatMap(all)];
const find=(root,text)=>all(root).find(node=>node.textContent===text);
const byClass=(root,name)=>all(root).find(node=>node.className?.split(' ').includes(name));
globalThis.document={createElement:tag=>new Node(tag),body:new Node('body'),addEventListener(){},querySelector(){return null;}};
globalThis.window={innerWidth:1200,innerHeight:900,addEventListener(){}};
const history=[{id:'one',title:'One'},{id:'hidden',title:'Hidden',historyHiddenAt:'date'}];
async function fixture(mode,scopeValue='selected') {
  const requests=[], confirms=[],deletions=[],completed=[],hiddenChanges=[];
  let valid=true,projectID='project-a';
  const management=createResearchHistoryManagement({
    project:()=>({id:projectID,name:'Project A'}),isCurrent:()=>valid,
    request:async(path,body)=>{
      requests.push({path,body});
      if(path.endsWith('/delete-preview')){if(mode==='account-during-preview')valid=false;return {count:body.conversationIDs?.length||2,conversationIDs:body.conversationIDs||['one','hidden'],confirmationToken:'reviewed'};}
      assert(path.endsWith('/delete-many'));if(mode==='failure')throw Error('Retry failed');
      return {deletedCount:2,conversationIDs:['one','hidden'],projectIDs:['project-a']};
    },
    confirm:async(title,message,options)=>{
      confirms.push({title,message,options});
      if(mode==='account-during-confirm')valid=false;
      if(mode==='project-during-confirm')projectID='project-b';
      return mode!=='cancel';
    },beforeDelete:ids=>deletions.push(ids),onDeleted:async result=>completed.push(result),onIncludeHidden:value=>hiddenChanges.push(value)
  });
  management.setConversations(history);
  const rows=history.map(conversation=>{const row=new Node('article'),open=new Node('button');row.append(open);management.bindRow(row,open,conversation);return row;});
  const root=management.element;
  assert.equal(requests.length,0,'Management reuses History rows instead of loading a duplicate list.');
  assert.equal(rows[0].children[0].hidden,true);
  assert.equal(byClass(rows[1],'assistant-history-hidden-label').textContent,'Hidden from History');
  if(scopeValue==='selected') {
    assert.equal(byClass(root,'assistant-history-select').hidden,true,'Select stays inside the options menu until selection starts.');
    byClass(root,'assistant-history-more').listeners.click();
    find(document.body,'Select conversations').listeners.click();
    assert.equal(find(root,'Done').attributes['aria-label'],'Done selecting conversations');
    assert.equal(find(root,'Done').hidden,false,'Done stays available while selecting.');
    assert(rows.every(row=>!row.children[0].hidden));
    assert.equal(find(root,'Delete selected').disabled,true);
    assert.equal(management.selectConversation('one'),true);
    find(root,'Select all shown').listeners.click();
    assert(rows.every(row=>row.children[0].checked));
    const remove=find(root,'Delete selected');await Promise.all([remove.listeners.click(),remove.listeners.click()]);
  } else {
    byClass(root,'assistant-history-more').listeners.click();
    const menu=byClass(document.body,'assistant-history-menu');
    if(mode==='project-before-click')projectID='project-b';
    await find(menu,scopeValue==='project'?'Delete all in Project A…':'Delete all conversations…').listeners.click();
  }
  const commits=requests.filter(row=>row.path.endsWith('/delete-many'));
  if(mode==='success') {
    assert.equal(commits.length,1,'Double click cannot submit a second deletion');
    assert.equal(commits[0].body.confirmPermanentDeletion,true);assert.equal(commits[0].body.confirmationToken,'reviewed');
    assert.equal(commits[0].body.scope,scopeValue);
    if(scopeValue==='project')assert.equal(commits[0].body.projectID,'project-a');
    else if(scopeValue==='selected')assert.deepEqual(commits[0].body.conversationIDs,['one','hidden']);
    assert.equal(deletions.length,1);assert.equal(completed.length,1);
    assert.equal(find(root,'Select').attributes['aria-pressed'],'false');
  } else if(mode==='failure') {
    assert.equal(completed.length,0);assert.match(byClass(root,'assistant-history-management-status').textContent,/Retry failed/);
    assert.equal(find(root,'Delete selected').disabled,false,'A failed request keeps the exact selection retryable.');
  } else {
    assert.equal(commits.length,0,`${mode} must never delete`);assert.equal(deletions.length,0);
  }
  if(confirms.length) {
    assert.match(confirms[0].message,/research answers and evidence snapshots/);
    assert.match(confirms[0].message,/Saved passages, Notes, Reports, project data/);
    assert.match(confirms[0].message,/cannot be undone and does not go to Trash/);
    assert.equal(confirms[0].options.confirmLabel,'Delete 2 conversations');
  }
  management.dispose();
  return {management,root,rows,requests,hiddenChanges};
}
for(const scope of ['selected','project','all'])await fixture('success',scope);
await fixture('cancel');await fixture('failure');await fixture('account-during-preview');await fixture('account-during-confirm');await fixture('project-during-confirm','project');await fixture('project-before-click','project');
// Per-chat deletion uses the same reviewed endpoint, with exactly one ID.
let current=true;const requests=[],included=[];
const manager=createResearchHistoryManagement({isCurrent:()=>current,project:()=>null,request:async(path,body)=>{requests.push({path,body});return path.endsWith('delete-preview')?{count:1,conversationIDs:body.conversationIDs,confirmationToken:'single'}:{conversationIDs:body.conversationIDs};},confirm:async(title,message)=>{assert.match(title,/One/);return true;},onDeleted:async()=>{},onIncludeHidden:value=>included.push(value)});
manager.setConversations(history);const row=new Node('article'),open=new Node('button');row.append(open);manager.bindRow(row,open,history[0]);
byClass(row,'assistant-history-row-menu').listeners.click();await find(document.body,'Delete').listeners.click();
assert.deepEqual(requests.map(row=>row.body.conversationIDs),[['one'],['one']]);
byClass(manager.element,'assistant-history-more').listeners.click();await find(document.body,'Include hidden conversations').listeners.click();
assert.deepEqual(included,[true]);assert.equal(requests.length,2,'Showing hidden chats delegates to History pagination, not deletion.');
byClass(manager.element,'assistant-history-more').listeners.click();find(document.body,'Select conversations').listeners.click();
manager.selectConversation('one');manager.setConversations([history[1]]);
assert.equal(find(manager.element,'Delete selected').disabled,true,'Removed rows cannot remain selected after a refresh.');
manager.handleKeyDown({key:'Escape',preventDefault(){}});assert.equal(find(manager.element,'Select').attributes['aria-pressed'],'false');
assert.equal(find(manager.element,'Select').hidden,true);
assert.equal(document.activeElement,byClass(manager.element,'assistant-history-more'),'Escape returns focus to the visible options button.');
manager.setConversations([]);byClass(manager.element,'assistant-history-more').listeners.click();
assert.equal(find(document.body,'Select conversations').disabled,true,'Empty History cannot enter selection mode.');
assert.equal(document.activeElement.textContent,'Include hidden conversations','Opening skips the disabled selection action.');
byClass(document.body,'assistant-history-menu').listeners.keydown({key:'ArrowUp',preventDefault(){}});
assert.equal(document.activeElement.textContent,'Delete all conversations…','Keyboard navigation skips disabled menu items.');
manager.reset();
current=false;byClass(row,'assistant-history-row-menu').listeners.click();assert.equal(byClass(document.body,'assistant-history-menu'),undefined,'A stale account cannot open management menus.');manager.dispose();
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function refreshAfterResearchDeletion(');
const body=source.slice(start,source.indexOf('\n}',start)+2);
let aborted=0;
const transitions=[];
const histories=new Map(['utility:analysis','utility:analysis:instance','utility:analysis:keep','utility:analysis:new-chat']
  .map(paneID=>[paneID,['drop','keep']]));
const state={researchConversationID:'drop',paneOrder:['research:conversation:drop','reader:keep'],paneWeights:{'research:conversation:drop':920,'reader:keep':900},
  utilityInstances:[{id:'instance',key:'analysis',conversationID:'drop',draft:'Drop draft'},{id:'keep',key:'analysis',conversationID:'keep',draft:'Keep draft'},
    {id:'new-chat',key:'analysis',conversationID:'',draft:'Unsent new conversation'},{id:'search',key:'search',query:'retained search'}],
  columnGroups:[{paneIDs:['utility:analysis:instance','reader:keep'],columns:{'utility:analysis:instance':{kind:'utility',value:{conversationID:'drop'},draft:'Drop draft'},'reader:keep':{kind:'reader',value:{id:'reader'}}}}]};
const context=vm.createContext({state,valid:true,researchOpenGeneration:0,researchQuestionDraft:'Drop draft',activeResearchConversation:{id:'drop'},
  activeResearchProgress:new Map([['drop',{controller:{abort(){aborted++;}}}],['keep',{}]]),
  supplementalResearchConversations:new Map([['drop',{}],['keep',{}]]),supplementalResearchConversationIDs:['drop','keep'],
  researchNewChatDrafts:new Map([['followup:drop','Drop draft'],['followup:keep','Keep draft'],['utility:analysis:instance','Drop draft'],['utility:analysis:new-chat','Unsent new conversation']]),
  researchDraftPaneIDs:new Set(),researchConversationList:[{id:'drop'},{id:'keep'}],researchHistoryPageReaders:new Map(),
  localStorage:{},removeResearchRequestRecovery(){},paneIDForResearchConversation:id=>'research:conversation:'+id,paneIDForUtilityInstance:instance=>'utility:analysis:'+instance.id,
  readResearchConversationList:{invalidate(){}},saveWorkspaceState(){},refreshResearchConversationList:async()=>{},refreshResearchProjectAssignmentConsumers:async()=>{},
  transitionWorkspace:async(mode,options)=>{
    transitions.push({mode,...options});
    options.refreshPaneIDs.forEach(paneID=>{if(histories.has(paneID))histories.set(paneID,Array.from(context.researchConversationList,row=>row.id));});
  }});
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
assert.equal(state.utilityInstances[2].draft,'Unsent new conversation');
assert.equal(context.researchNewChatDrafts.get('utility:analysis:new-chat'),'Unsent new conversation');
assert.deepEqual(Array.from(transitions[0].refreshPaneIDs),['utility:analysis','utility:analysis:instance','utility:analysis:keep','utility:analysis:new-chat'],
  'Deletion refreshes every Assistant History, even when its open conversation was not deleted or it only has a new draft.');
assert.equal(state.utilityInstances[3].query,'retained search');
assert.deepEqual(state.columnGroups[0].paneIDs,['reader:keep']);
assert.equal(state.paneWeights['reader:keep'],900);
assert([...histories.values()].every(ids=>ids.length===1&&ids[0]==='keep'),
  'A deleted conversation disappears from every mounted Assistant History, not just the column that owned it.');
await context.refreshAfterResearchDeletion({conversationIDs:['keep'],projectIDs:[]},{userID:'owner'});
assert([...histories.values()].every(ids=>ids.length===0),'Removing the final conversation leaves all Assistant History lists empty.');
assert.equal(state.utilityInstances[2].draft,'Unsent new conversation','Deleting every stored conversation preserves an unsent new chat.');
const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
assert(!index.includes('settings-conversations'));assert(!source.includes('mountResearchDeleteControls'));
assert(source.includes('historyManagement.bindRow(row, openButton, conversation, researchConversationTitle(conversation))'));
assert(source.includes('includeHidden:Boolean(historyState.historyIncludeHidden)'));
assert(!source.slice(source.indexOf('async function renderResearch(paneID'),source.indexOf('function visualEvidenceDataURL')).includes('clearResearchConversationHistory('),'History deletion cannot call the old hide-from-history endpoint.');
console.log('Assistant History management passed: individual/selected/project/account deletion, reviewed IDs and disclosure, cancellation, stale account/project fences, retry, hidden history, selection refresh, and Settings removal.');

const pinItem={id:'pin-target',title:'Pinned question',isPinned:false};
let renamed=0,pinToggles=0;
const pinMenu=createResearchHistoryManagement({isCurrent:()=>true});
const pinRow=new Node('article'),pinOpen=new Node('button');pinRow.append(pinOpen);
pinMenu.setConversations([pinItem]);
pinMenu.bindRow(pinRow,pinOpen,pinItem,pinItem.title,{onRename:()=>{renamed++;},onPin:()=>{pinItem.isPinned=!pinItem.isPinned;pinToggles++;}});
byClass(pinRow,'assistant-history-row-menu').listeners.click();
let exactMenu=byClass(document.body,'assistant-history-menu');
assert.deepEqual(exactMenu.children.map(item=>item.textContent),['Rename','Pin','Delete']);
find(exactMenu,'Pin').listeners.click();assert.equal(pinToggles,1);
byClass(pinRow,'assistant-history-row-menu').listeners.click();
exactMenu=byClass(document.body,'assistant-history-menu');
assert.deepEqual(exactMenu.children.map(item=>item.textContent),['Rename','Unpin','Delete']);
find(exactMenu,'Rename').listeners.click();assert.equal(renamed,1);pinMenu.dispose();
console.log('Conversation menus expose exactly Rename, Pin/Unpin and Delete.');
