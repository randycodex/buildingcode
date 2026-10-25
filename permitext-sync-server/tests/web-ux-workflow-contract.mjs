import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);};
const presentation=vm.createContext({researchCodeEdition:()=> '2022',escapeRegExp:s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')});
vm.runInContext(actual('stripLeadingSectionNumber')+'\n'+actual('searchResultPresentation'),presentation);
const record={sectionID:291,codePrefix:'BC',codeVersion:'exact-edition',sectionNumber:'2.1.',headerLine:'SECTION BC 403',headingLine:'HIGH-RISE BUILDINGS',title:'Stairs shall be provided. '.repeat(12),snippet:'Stairs shall be provided. '.repeat(12)};
const before=JSON.stringify(record),card=presentation.searchResultPresentation(record,'Stairs');
assert.equal(card.citation,"BC · 2022 · Section BC 403 · 2.1.");assert.equal(card.heading,'HIGH-RISE BUILDINGS');assert.ok(card.excerpt.length<=234);assert.match(card.excerpt,/Stairs/);assert.equal(JSON.stringify(record),before,'Presentation never rewrites source identity');assert.doesNotMatch(card.citation,/403\.5\.2/,'Unknown subsection parents must not be invented');
const short=presentation.searchResultPresentation({sectionNumber:'403.2',title:'403.2 Construction',snippet:'403.2 Construction The building shall comply.',codePrefix:'BC'},'building');assert.equal(short.heading,'Construction');assert.equal(short.excerpt,'The building shall comply.');
const late=presentation.searchResultPresentation({...record,snippet:'A long context sentence. '.repeat(20)+' stairs shall comply. '+ 'Following context. '.repeat(20)},'stairs');assert.match(late.excerpt,/stairs/);assert.ok(late.excerpt.length<=234);

const handoff=vm.createContext({researchConversationTitle:c=>c.title});
vm.runInContext(actual('researchAnswerQuestion')+actual('boundedResearchHistoryQuery'),handoff);
const questions={starterQuestion:'First question',messages:[{id:'q1',role:'user',question:'First question',requestID:'one'},{id:'a1',role:'assistant',requestID:'one'},{id:'q2',role:'user',question:'Follow-up question',requestID:'two'},{id:'q3',role:'user',question:'Later concurrent question',requestID:'three'},{id:'a2',role:'assistant',requestID:'two'}]};
assert.equal(handoff.researchAnswerQuestion(questions,questions.messages.at(-1)),'Follow-up question','Reference label follows the exact answer request');
assert.equal(handoff.researchAnswerQuestion({messages:[{role:'user',question:'Legacy follow-up'},{id:'old',role:'assistant'}]},{id:'old'}),'Legacy follow-up');
assert.equal(handoff.boundedResearchHistoryQuery('a'.repeat(199)+'😀'),'a'.repeat(199),'Never split a surrogate pair');
assert.equal(handoff.boundedResearchHistoryQuery('😀'.repeat(101)),'😀'.repeat(100));
assert.equal(handoff.boundedResearchHistoryQuery('a'.repeat(199)+'e\u0301'),'a'.repeat(199),'Never split a combining grapheme');
assert.equal(handoff.boundedResearchHistoryQuery('stairs '),'stairs ','Typing spaces remains possible');
assert.match(actual('renderResearch'),/historySearch.maxLength = 200/);
assert.match(actual('readResearchHistoryPage'),/q: boundedResearchHistoryQuery/);

const pressed={};const button=name=>({setAttribute:(key,value)=>pressed[name]=value,classList:{toggle(){}}});
const chrome=vm.createContext({document:{querySelectorAll:()=>[],querySelector:()=>null},syncReaderToolbarButton(){},workspaceColumnsRequireProject:()=>false,syncTopbarProjectToolStates(){},state:{readers:[],utilityInstances:[{key:'analysis'}],utilities:{analysis:false}},addReaderButton:button('reader'),toggleArchiveButton:button('archive'),toggleSearchButton:button('search'),toggleSavedButton:button('saved'),toggleAnalysisButton:button('analysis'),toggleWorkboardButton:button('workboard'),toggleSettingsButton:button('settings'),hasCapability:()=>true,genericWorkboardIsOpen:()=>false});
vm.runInContext(actual('setUtilityButtonStates'),chrome);chrome.setUtilityButtonStates();assert.equal(pressed.analysis,'true');chrome.state.utilityInstances=[];chrome.setUtilityButtonStates();assert.equal(pressed.analysis,'false');chrome.state.utilities.analysis=true;chrome.setUtilityButtonStates();assert.equal(pressed.analysis,'true');

chrome.workspaceColumnsRequireProject=()=>true;chrome.setUtilityButtonStates();
for(const control of ['toggleSavedButton','toggleSearchButton','toggleAnalysisButton','toggleWorkboardButton'])assert.equal(chrome[control].disabled,false,'Project-less controls can receive clicks to explain the Project requirement');
chrome.workspaceColumnsRequireProject=()=>false;chrome.setUtilityButtonStates();
assert.equal(chrome.toggleSearchButton.disabled,false,'Project creation re-enables column controls');

// Invoke the real Report handoff click handler, including failed remote save and races.
const reportStart=source.indexOf('reportButton.addEventListener("click", async () => {', source.indexOf('async function renderProjectNotebook('));
const reportHandler=source.slice(reportStart,source.indexOf('\n      footerActions.append',reportStart));
async function reviewReport(scenario={}){let click;const promotions=[],notices=[];const context=vm.createContext({reportAdditionFeedback(){},reportButton:{disabled:false,addEventListener:(_,fn)=>click=fn},editorRenderSequence:1,disposed:false,requestIdentity:1,identity:{id:'project'},activeCard:{id:'note',version:1},dirty:true,saveConflict:false,notebookReadOnly:false,isCurrentAccountRequest:()=>!scenario.accountChanged,saveActiveNotebookCard:async()=>{if(scenario.disposed)context.disposed=true;if(scenario.switchedCard)context.editorRenderSequence++;context.dirty=Boolean(scenario.dirty);context.saveConflict=Boolean(scenario.conflict);return scenario.result!==false;},promoteNotebookCardToReport:async(_,card)=>promotions.push(card),showWebNotice:async(_,message)=>notices.push(message)});vm.runInContext(reportHandler,context);await click();return {promotions,notices,context};}
for(const scenario of [{result:false,dirty:true},{result:true,dirty:true},{result:true,conflict:true}]){const result=await reviewReport(scenario);assert.equal(result.promotions.length,0);assert.match(result.notices[0],/device draft is preserved/);}
for(const scenario of [{accountChanged:true},{disposed:true},{switchedCard:true}]){const result=await reviewReport(scenario);assert.equal(result.promotions.length,0);assert.equal(result.notices.length,0);}
assert.equal((await reviewReport()).promotions.length,1,'Only acknowledged clean Note reaches Report review');

let account='owner',opened=0;const focused=[],scrolled=[],expanded=[];
const state={utilityInstances:[{id:'first',key:'search',query:'stairs'},{id:'second',key:'search',query:'fire'},{id:'research',key:'analysis',draft:'unsent',conversationID:'answer'}],utilities:{},paneOrder:[]};
const c=vm.createContext({workspaceColumnsRequireProject:()=>false,state,activeWorkspaceID:'one',activeAccount:()=>({userID:account}),paneIDForUtilityInstance:i=>i.id,whenWorkspacePaneReady:async()=>true,CSS:{escape:s=>s},track:{querySelector:selector=>{const id=selector.match(/data-pane-id="([^"]+)"/)[1];return {dataset:{paneId:id},querySelector:()=>({focus:()=>focused.push(id)})};}},columnGroupForPane:id=>id==='first'?{collapsed:true}:null,setColumnGroupCollapsed:()=>expanded.push('group'),paneIsCollapsed:id=>id==='first',setPaneCollapsed:()=>expanded.push('pane'),scrollPaneIntoView:id=>scrolled.push(id),openNewSearchColumn:async()=>opened++,openNewResearchColumn:async()=>opened++,focusUtility:async()=>{}});
vm.runInContext('const recentUtilityColumns=new Map();'+actual('rememberUtilityColumn')+actual('focusRecentUtilityColumn'),c);
await c.focusRecentUtilityColumn('search');assert.equal(focused.at(-1),'second');
c.rememberUtilityColumn('first');await c.focusRecentUtilityColumn('search');assert.equal(focused.at(-1),'first');assert.deepEqual(expanded,['group','pane']);
await c.focusRecentUtilityColumn('analysis');assert.equal(state.utilityInstances[2].draft,'unsent');assert.equal(state.utilityInstances[2].conversationID,'answer');assert.equal(opened,0,'Toolbar never duplicates an existing column');
c.activeWorkspaceID='two';await c.focusRecentUtilityColumn('search');assert.equal(focused.at(-1),'second','Recent focus does not leak between workspaces');
account='other';await c.focusRecentUtilityColumn('search');assert.equal(focused.at(-1),'second');
state.utilityInstances=[];await c.focusRecentUtilityColumn('search');assert.equal(opened,1,'First click opens a column when none exists');
assert.match(actual('openColumnGroupMenu'),/New search column/);assert.match(actual('openColumnGroupMenu'),/New research column/);
const binding=actual('bindImmediateUtilityControls');assert.match(binding,/focusRecentUtilityColumn\("search"\)/);assert.match(binding,/focusRecentUtilityColumn\("analysis"\)/);
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');assert.match(html,/class="workflow-layout-actions"/);assert.match(source,/label: "Saved groups…", run: \(\) => openSavedColumnGroupsMenu/);

// History navigation uses the Project record ID to locate the workspace, not its client ID.
let activeProject='a',switched=[],targetInstance;
const routing=vm.createContext({captureAccountRequest:()=>1,isCurrentAccountRequest:()=>true,researchConversationInWorkspace:conversation=>conversation.primaryProjectID===activeProject,reconcileProjectWorkspaces(){},researchProjects:()=>[{id:'record-b',clientID:'b'}],researchProjectID:p=>p.clientID,projectRecordID:p=>p.id,workspaceRegistry:{workspaces:[{id:'workspace-b',projectID:'record-b'}]},state:{utilityInstances:[{id:'new-workspace-chat',key:'analysis'}]},switchWorkspace:async id=>{switched.push(id);activeProject='b';return true;},openResearchConversation:async(id,options)=>{targetInstance=options.instance;return id;},showWebNotice:async()=>assert.fail('Known Project must resolve')});
vm.runInContext(actual('openResearchHistoryConversation'),routing);assert.equal(await routing.openResearchHistoryConversation({id:'saved-answer',primaryProjectID:'b'},{id:'old-workspace-chat'}),'saved-answer');assert.deepEqual(switched,['workspace-b']);assert.equal(targetInstance.id,'new-workspace-chat');
console.log('Web UX behavior passed: honest concise citations, no source mutation, query-centered excerpt, recent-column focus and account/workspace isolation, Layout groups, Project history routing.');
