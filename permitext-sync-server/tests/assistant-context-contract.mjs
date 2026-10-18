import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeWorkspaceLayout} from '../public/workspace-state.js';
import {researchProjectInformation} from '../app.mjs';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const server = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
const styles = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const extract = (text, name, async = false) => {
  const start = text.indexOf(`${async ? 'async ' : ''}function ${name}(`);
  assert.ok(start >= 0, name);
  return text.slice(start, text.indexOf('\n}', start) + 2);
};

const retiredViews = {'utility:analysis': {tab:'work', splitRatio:0.8,
  draft:{projectID:'project-a', workType:'New building', uses:'Outdated use', additionalFacts:'Outdated fact'}}};
const normalized = normalizeWorkspaceLayout({researchViewState:{assistantViews:retiredViews,
  drafts:{'utility:analysis':'Keep my question'},draftPaneIDs:['utility:analysis']}});
assert.equal(Object.hasOwn(normalized.researchViewState, 'assistantViews'), false,
  'Retired Work editor state cannot return after a workspace reload.');
assert.equal(normalized.researchViewState.drafts['utility:analysis'], 'Keep my question');
assert.doesNotMatch(source, /renderAssistantContextSidebar|bindAssistantContextDivider|researchAssistantViews|assistantWorkFacts|assistant-work-type-select/);
assert.doesNotMatch(styles, /assistant-context-toolbar|assistant-context-details|assistant-context-divider|assistant-work-form/);
assert.match(styles, /\.assistant-workspace > \.assistant-history-rail \{[^}]*grid-template-rows: minmax\(0, 1fr\) auto;/,
  'History fills the space vacated by the Work editor.');

// Start actual main and supplemental composers with a retained legacy draft.
// Only Project identity is submitted; the server owns current Context and Facts.
for (const supplemental of [false, true]) {
  const elements = [], requests = [], turns = [];
  const element = tag => {
    const node = {tag, children:[], listeners:{}, dataset:{}, style:{}, value:'', scrollHeight:48,
      classList:{add(){}}, setAttribute(){}, addEventListener(name,handler){this.listeners[name]=handler;},
      append(...children){this.children.push(...children);}, querySelector(){return null;}};
    elements.push(node); return node;
  };
  const instance = supplemental ? {id:'second',key:'analysis'} : null;
  const paneID = supplemental ? 'utility:analysis:second' : 'utility:analysis';
  const context = vm.createContext({
    document:{createElement:element},state:{researchViewState:{assistantViews:retiredViews}},
    workspaceProject:()=>({id:'project-a',name:'Current project'}),projectDetailKey:project=>project.id,
    paneIDForUtilityInstance:()=>paneID,researchNewChatDrafts:new Map(),
    researchProjectContextPreview:()=>element('preview'), researchComposerDisclosure:()=>element('disclosure'),
    researchChatPlaceholder:'Ask a question', bindResearchSendShortcut(){}, requestAnimationFrame:fn=>fn(),
    scheduleResearchDraftPersistence(){},flushResearchDraftPersistence(){},
    createResearchProgressSession:()=>({stages:new Map()}),renderResearchProgressCard:()=>element('progress'),
    startResearchProgressTimer(){},activeResearchProgress:new Map(),
    refreshResearchConversationList:async()=>{}, openResearchConversation:async()=>{},
    recoveredResearchProgressCallbacks:()=>({}),
    runResearchProgressSession:async progress=>turns.push(progress.conversationID),
    postResearch:async(path,body)=>{requests.push({path,body});return {conversation:{id:'new-chat',primaryProjectID:body.projectID}};},
    refreshResearchProgressCard(){throw Error('Conversation submission failed');},clearInterval(){},Date,Map,
  });
  vm.runInContext(extract(source,'renderNewResearchComposer'),context);
  context.renderNewResearchComposer(element('container'),true,instance);
  const input = elements.find(node=>node.tag==='textarea');
  input.value='What applies to the project?';input.listeners.input();
  await elements.find(node=>node.tag==='form').listeners.submit({preventDefault(){}});
  assert.equal(requests.length,1,'New chat does not send an extra per-conversation Work context request.');
  assert.equal(requests[0].path,'/research/conversations/create');
  assert.equal(requests[0].body.projectID,'project-a');
  assert.equal(Object.hasOwn(requests[0].body,'facts'),false);
  assert.deepEqual(turns,['new-chat']);
}

// Saved Project Context and Facts remain live; no editor draft is needed.
let project = {id:'project-a',address:'123 Example Street',description:'Renovate the ground floor',
  structuredFacts:[{id:'use',key:'proposed-use',label:'Proposed use',value:'Retail',status:'stated'}]};
const serverContext=vm.createContext({String,researchProjectInformation,
  projectAccessForUser:async(userID,projectID)=>userID==='owner'&&projectID===project.id ? {projectID,project}:null});
vm.runInContext(extract(server,'currentResearchProjectInformation',true),serverContext);
const first=await serverContext.currentResearchProjectInformation('owner','project-a');
assert.equal(first.address,'123 Example Street');assert.equal(first.description,'Renovate the ground floor');
assert.ok(first.facts.some(fact=>fact.includes('Retail')));
project={...project,description:'Renovate the second floor',structuredFacts:[{...project.structuredFacts[0],value:'Office'}]};
const next=await serverContext.currentResearchProjectInformation('owner','project-a');
assert.equal(next.description,'Renovate the second floor');
assert.ok(next.facts.some(fact=>fact.includes('Office')),'Later turns read updated saved Project facts.');
assert.ok(first.facts.some(fact=>fact.includes('Retail')),'Previous context snapshots remain intact.');
assert.equal(await serverContext.currentResearchProjectInformation('other','project-a'),null,'Project access remains enforced.');
console.log('Assistant Project context passed: Work UI and draft injection removed, chat creation preserved, live Project facts and access retained.');
