import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function extract(name) {
  const match = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(source);
  const next = /\n(?:async )?function [\w$]+\(/.exec(source.slice(match.index + match[0].length));
  return source.slice(match.index, match.index + match[0].length + next.index);
}
const values = new Map(), saves = [];
let account = null, pro = false;
const context = vm.createContext({
  Date, JSON, Number, sessionStorage: {getItem:k=>values.get(k), setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k)},
  activeAccount:()=>account, isProAccount:()=>pro,
  currentCapabilityContract:()=>({capabilities:{'saved-work':{enabled:true},notes:{enabled:true},projects:{enabled:true}}}),
  entitlementResearchEnabled:()=>pro,
  hasCapability:()=>pro,
  persistSectionBookmark:async(target,saved,options)=>{ saves.push({target,saved,options}); return true; },
  presentWorkspaceIssue:()=>{}
});
vm.runInContext('const pendingProSaveKey="test"; let resumingProSave=false;'+['hasCapability','clearPendingProSave','preservePendingProSave','readPendingProSave','resumePendingProSave'].map(extract).join('\n'),context);
for (const feature of ['saved-work','notes','projects','notebook','professional-exports','offline-access','research']) {
  assert.equal(context.hasCapability(feature),false, `Stale contracts must not unlock ${feature} on Free.`);
}
context.preservePendingProSave({sectionID:545,codeVersion:'nyc-2022',selectedText:'Enacted text',sessionToken:'never persist',folderClientID:'guest-private'});
assert(!values.get('test').includes('sessionToken'));
assert(!values.get('test').includes('guest-private'));
assert.equal(await context.resumePendingProSave(),false);
account={userID:'A'}; pro=true;
assert.equal(await context.resumePendingProSave(),true);
assert.equal(saves.length,1);
assert.equal(saves[0].target.sectionID,545);
assert.equal(saves[0].options.attachToWorkspaceProject,false);
assert.equal(await context.resumePendingProSave(),false,'Successful actions replay once.');
context.preservePendingProSave({sectionID:546});
account={userID:'B'};
assert.equal(await context.resumePendingProSave(),false,'An account switch must not replay another account action.');
context.preservePendingProSave({sectionID:547});
const pending=JSON.parse(values.get('test')); pending.expiresAt=1; values.set('test',JSON.stringify(pending));
assert.equal(await context.resumePendingProSave(),false,'Expired actions must not replay.');
context.preservePendingProSave({sectionID:548}); context.clearPendingProSave();
assert.equal(await context.resumePendingProSave(),false,'Cancelled upgrade prompts must not replay.');
console.log('Minimal Free client checks passed: stale capabilities, save continuation, redaction, account isolation, expiry, cancellation.');

let upgradePrompts = 0, savedSequence = 0, savedPro = false;
const savedState = {utilityInstances:[],utilities:{},paneWeights:{},paneOrder:[],readers:[]};
const savedTransitions = [], lockedSavedPanes = [], foundationRegistrations = [], foundationReleases = [];
const savedToolbarState = new Map();
const toolbarControl = {setAttribute(){}};
const savedContext = vm.createContext({
  hasCapability: () => savedPro,
  presentPlanLimitNotice: async () => { upgradePrompts += 1; return false; },
  state:savedState, repeatableUtilityKeys:new Set(['search','saved']), CSS:{escape:value=>value},
  newUtilityInstance:key=>({key,id:`saved-${++savedSequence}`}),
  paneIDForUtilityInstance:instance=>`utility:${instance.key}:${instance.id}`,
  defaultPaneWidthForID:()=>600, appendPaneIfMissing:id=>savedState.paneOrder.push(id),
  saveWorkspaceState(){}, scrollPaneIntoView(){}, whenWorkspacePaneReady:async()=>true,
  transitionWorkspace:async mode=>{
    savedTransitions.push(mode);
    for (const instance of savedState.utilityInstances) await savedContext.renderSaved(instance);
  },
  closeUtilityInstance:async instance=>{savedState.utilityInstances=savedState.utilityInstances.filter(item=>item.id!==instance.id);return true;},
  renderProLockedPane:(paneID,title)=>{const panel={paneID,title};lockedSavedPanes.push(panel);return panel;},
  currentContentSummary:()=>{throw new Error('Free Saved must not read private saved content.');},
  requestAnimationFrame:callback=>callback(),track:{querySelector:()=>({querySelector:()=>({focus(){}})})},
  workspacePrivatePresentationAllowed:()=>true,
  createInitialProjectFoundationScope:()=>({register:id=>foundationRegistrations.push(id),release:id=>foundationReleases.push(id)}),
  detachedProjectWindow:false,genericWorkboardIsOpen:()=>false,openProjectDetails:()=>[],
  openCodeQuestionPaneIDs:()=>[],researchConversationPaneIsOpen:()=>false,supplementalResearchConversationIDs:[],
  renderUtilityInstance:(instance,options)=>savedContext.renderSaved(instance,options),
  addReaderButton:{classList:{toggle(){}}},toggleArchiveButton:null,toggleSearchButton:toolbarControl,
  toggleSavedButton:{setAttribute:(name,value)=>savedToolbarState.set(name,value)},
  toggleAnalysisButton:toolbarControl,toggleWorkboardButton:null,toggleSettingsButton:toolbarControl
});
vm.runInContext(['focusUtility','toggleUtilityPane','toggleProjectsColumns','renderSaved','openUnassignedSaves','workspacePaneDescriptors','setUtilityButtonStates'].map(extract).join('\n'),savedContext);
await savedContext.toggleProjectsColumns();
assert.equal(savedState.utilityInstances.length,1,'Saved opens a column on Free.');
assert.equal(lockedSavedPanes.at(-1).title,'Saved');
savedContext.setUtilityButtonStates();
assert.equal(savedToolbarState.get('aria-pressed'),'true','The toolbar reflects an open locked Saved column.');
const transitionsBeforeFocus=savedTransitions.length;
await savedContext.focusUtility('saved');
await savedContext.openUnassignedSaves();
assert.equal(savedTransitions.length,transitionsBeforeFocus,'Focus and unassigned Saved reuse the open column.');
assert.equal(savedState.utilityInstances.length,1);
await savedContext.toggleProjectsColumns();
assert.equal(savedState.utilityInstances.length,0,'A second toolbar activation closes the locked column.');
savedContext.setUtilityButtonStates();
assert.equal(savedToolbarState.get('aria-pressed'),'false');
await savedContext.toggleUtilityPane('saved');
assert.equal(savedState.utilityInstances.length,1,'Direct Saved entry points also open the locked column.');
assert.equal(upgradePrompts,0,'Saved navigation no longer interrupts reading with an upgrade dialog.');
const restoredSaved=await savedContext.renderSaved({id:'existing-saved',key:'saved'},{foundationScope:{release:id=>foundationReleases.push(id)}});
assert.equal(restoredSaved.title,'Saved');
assert.equal(foundationReleases.at(-1),'utility:saved:existing-saved','A downgrade releases any pending private foundation consumer.');
const freeDescriptors=savedContext.workspacePaneDescriptors({accessGate:{allowed:true}});
assert.equal(freeDescriptors.length,1,'Free Saved columns are included in reload descriptors.');
assert.equal(freeDescriptors[0].foundationScope,null,'Locked Saved does not start private project foundation loading.');
assert.equal(foundationRegistrations.length,0);
await freeDescriptors[0].load(new AbortController().signal);
assert.equal(lockedSavedPanes.at(-1).title,'Saved');
savedPro=true;
const proDescriptors=savedContext.workspacePaneDescriptors({accessGate:{allowed:true}});
assert.ok(proDescriptors[0].foundationScope,'Pro keeps normal Saved foundation loading.');
assert.equal(proDescriptors[0].deferredFoundationRelease,true);
assert.equal(foundationRegistrations.at(-1),proDescriptors[0].id);
console.log('Free Saved navigation opens and reuses a locked column, toggles closed, restores without private reads, and retains Pro foundation loading.');

const redirects = [];
let existingSession = null;
const authContext = vm.createContext({
  URL, Promise,
  completeClerkPermitextSignIn: async () => existingSession,
  window: { location: { href: 'https://permitext.example/app?section=545', assign: url => redirects.push(url) } }
});
vm.runInContext(extract('signInWithClerkWeb'), authContext);
const authConfig = {accountPortalSignInURL:'https://accounts.example/sign-in'};
authContext.signInWithClerkWeb(authConfig, 'signUp');
await new Promise(setImmediate);
assert.equal(new URL(redirects[0]).pathname, '/sign-up');
assert.equal(new URL(new URL(redirects[0]).searchParams.get('redirect_url')).searchParams.get('section'), '545');
authContext.signInWithClerkWeb(authConfig, 'signIn');
await new Promise(setImmediate);
assert.equal(new URL(redirects[1]).pathname, '/sign-in');
existingSession = {userID:'existing-pro'};
assert.equal((await authContext.signInWithClerkWeb(authConfig, 'signUp')).userID, 'existing-pro');
assert.equal(redirects.length, 2, 'Existing sessions must not be sent through new-account signup.');
console.log('Account welcome routes preserve return context and reuse existing sessions.');
