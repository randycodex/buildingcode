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

let upgradePrompts = 0;
const savedContext = vm.createContext({
  hasCapability: () => false,
  presentPlanLimitNotice: async () => { upgradePrompts += 1; return false; }
});
vm.runInContext(['focusUtility', 'toggleUtilityPane', 'toggleProjectsColumns', 'renderSaved'].map(extract).join('\n'), savedContext);
await savedContext.toggleProjectsColumns();
await savedContext.toggleUtilityPane('saved');
await savedContext.focusUtility('saved');
assert.equal(upgradePrompts, 3, 'Every Saved entry point must prompt before opening or changing columns.');
assert.equal(await savedContext.renderSaved({id:'existing-saved',key:'saved'}), null, 'Restored Free workspaces must not render a locked Saved column.');
console.log('Free Saved entry points preserve the current workspace and avoid locked columns.');

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
