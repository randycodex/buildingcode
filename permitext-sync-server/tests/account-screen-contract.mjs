import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function extract(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, "m"));
  assert(start >= 0, name);
  return source.slice(start, source.indexOf("\n}", start) + 2);
}

function harness(signedIn, pro = signedIn) {
  let currentDialog = null, focusReturns = 0, focusTraps = 0, contextCheck, accountCurrent = true;
  const panels = [], transitions = [], toggleAttributes = {}, signInStarts = [], checkoutStarts = [], warningClosures = [];
  function element() {
    const node = {
      children: [], listeners: {}, attributes: {}, dataset: {}, removedStyles: [],
      style: { removeProperty(name) { this.owner.removedStyles.push(name); }, setProperty(name, value) { this[name] = value; } },
      focus() {},
      setAttribute(name, value) { this.attributes[name] = value; },
      getAttribute(name) { return this.attributes[name] ?? null; },
      append(...children) { for (const child of children) { child.parent?.removeChild(child); child.parent = this; this.children.push(child); } },
      before(child) { this.parent?.append(child); },
      removeChild(child) { this.children = this.children.filter(item => item !== child); },
      replaceChildren(...children) { this.children = []; this.append(...children); },
      addEventListener(name, listener) { this.listeners[name] = listener; },
      showModal() { this.open = true; },
      close() { this.open = false; this.listeners.close(); },
      remove() { currentDialog = null; },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      querySelectorAll(selector) { return this.children.flatMap(child => {
        const matches = selector.split(", ").some(part => part.startsWith(".")
          ? child.className?.split(" ").includes(part.slice(1))
          : part === '*' || part === '[data-clear-action="searches"]' && child.attributes?.["data-clear-action"] === "searches");
        return [...(matches ? [child] : []), ...(child.querySelectorAll?.(selector) || [])];
      }); }
    };
    node.classList = {
      add(...names) { node.className = [...new Set([...(node.className || '').split(' ').filter(Boolean), ...names])].join(' '); },
      toggle(name, on) { this[name] = on; },
      contains(name) { return this[name] === true || (node.className || '').split(' ').includes(name); }
    };
    return node;
  }
  function panel() {
    const result = element();
    result.className = "settings-panel";
    result.style.owner = result;
    const category = (id, className) => {
      const card = Object.assign(element(), { scrollTop: 0, className: `settings-card ${className}` });
      card.setAttribute("aria-labelledby", id);
      return card;
    };
    const profile = category("profile", "account-connector"), plan = category("plan", "settings-plan-card");
    const offline = category("offline", "settings-offline-card"), data = category("data", "settings-data-card"), conflicts = category("conflicts", "settings-sync-conflicts-card");
    const signOut = Object.assign(element(), { className: "account-clear" });
    const deleteAccount = Object.assign(element(), { className: "account-delete" });
    profile.append(signOut, deleteAccount);
    const scroll = Object.assign(element(), { className: "settings-scroll", scrollTop: 0 });
    scroll.append(plan, profile, conflicts, offline, data);
    const oldHeader = { remove() { result.headerRemoved = true; } };
    const signInButton = { click() { signInStarts.push("signIn"); currentDialog.dataset.signingIn = "true"; } };
    const find = result.querySelector.bind(result);
    result.querySelector = selector => selector === ".panel-header" ? oldHeader
      : selector === '[data-account-mode="signIn"]' ? signInButton : find(selector);
    result.append(scroll);
    result.__refreshSettingsWorkspace = () => { result.workspaceRefreshes = (result.workspaceRefreshes || 0) + 1; };
    result.__refreshSettingsTrash = async () => { result.trashRefreshes = (result.trashRefreshes || 0) + 1; };
    Object.assign(result, { scroll, profile, plan, offline, data, conflicts, signOut, deleteAccount });
    panels.push(result);
    return result;
  }
  const toolbar = { inert: false };
  const track = { inert: false, scrollLeft: 0, scrollWidth: 1500, clientWidth: 500, querySelector: () => null };
  const context = vm.createContext({
    document: {
      querySelector: selector => {
        if (selector === ".workspace-shell") return { append(dialog) { currentDialog = dialog; } };
        if (selector === ".workflow-toolbar") return toolbar;
        if (selector === '.settings-floating-panel[open]') return currentDialog?.classList.contains('settings-floating-panel') ? currentDialog : null;
        if (selector === '.account-workspace-view[open]') return currentDialog?.classList.contains('account-workspace-view') ? currentDialog : null;
        return selector === ".account-dialog" || selector === ".account-screen[open]" ? currentDialog : null;
      },
      createElement: element,
      body: { append(dialog) { currentDialog = dialog; } }
    },
    workspaceActionsButton: { setAttribute: (name, value) => { toggleAttributes[name] = value; },
      focus: () => { focusReturns++; }, blur() {} },
    settingsButton: { setAttribute: (name,value) => { toggleAttributes[name] = value; }, focus: () => { focusReturns++; } },
    selectedSettingsTab: 'account',
    createFloatingWorkspaceTabs({entries,selected,onSelect}) {
      const nav = Object.assign(element(), {className:'floating-workspace-tabs'});
      const select = key => { entries.forEach(entry => { entry.panel.hidden = entry.id !== key; }); onSelect(key); };
      select(selected);
      return {element:nav,select,dispose(){}};
    },
    bindFloatingWorkspacePanel(dialog,{dismiss,anchor}) {
      anchor.setAttribute('aria-expanded','true');
      dialog.floatingEscape = () => {dismiss();anchor.focus();};
      return {position(){},dispose(){anchor.setAttribute('aria-expanded','false');}};
    },
    topbarBrand: { cloneNode: () => Object.assign(element(), { className: "topbar-brand" }) },
    activeAccount: () => signedIn ? { userID: "synthetic-account" } : null,
    isProAccount: () => pro,
    renderSettings: panel, renderAccountWelcome: panel, renderProAccountEntry: panel, renderDirectSignInEntry: panel,
    showProAccountCheckout: dialog => checkoutStarts.push(dialog),
    trapWebModalFocus: () => { focusTraps++; }, clearProUpgradeIntent() {},
    activeWebWarningClose: confirmed => warningClosures.push(confirmed),
    state: {}, saveWorkspaceState() {}, closeSharedWorkspaceViews() {},
    createSettingsColumnResizers: () => ({ refresh() {}, dispose() {} }),
    captureAccountRequest: () => signedIn ? { userID: "synthetic-account" } : {}, isCurrentAccountRequest: () => accountCurrent,
    setInterval: cb => { contextCheck = cb; return 1; }, clearInterval() {},
    syncWorkflowNavigation() { toggleAttributes["aria-pressed"] = String(Boolean(currentDialog?.open)); },
    activePaneIDs: () => ["reader:one", "utility:settings", "utility:saved"],
    transitionWorkspace: async (kind, options) => transitions.push({ kind, options }), track
  });
  vm.runInContext(["circleXIconSVG", "settingsPanelScrollTop", "refreshWorkspaceAfterSettingsClear", "workspaceFloatingPanelReference", "organizeAccountSettings", "mountAccountScreenContent", "toggleAccountDialog"].map(extract).join("\n"), context);
  return { context, track, panels, transitions, toggleAttributes, signInStarts, checkoutStarts, warningClosures,
    toolbar, revokeAccount() { accountCurrent = false; contextCheck(); },
    dialog: () => currentDialog, focusReturns: () => focusReturns, focusTraps: () => focusTraps };
}

for (const signedIn of [false, true]) {
  const h = harness(signedIn);
  h.context.toggleAccountDialog();
  const dialog = h.dialog(), panel = h.panels[0];
  assert.equal(dialog.className, "account-dialog account-screen settings-floating-panel");
  assert.equal(dialog.open, true);
  assert.equal(h.track.inert, false); assert.equal(h.toolbar.inert, false);
  assert.equal(dialog.children[0].children.length, 2, "The shared top menu already provides the brand.");
  assert.equal(dialog.children[1], panel, "Keep the original wired controls and their account fences.");
  assert.equal(panel.headerRemoved, true);
  assert.deepEqual(panel.removedStyles, ["flex"], "Column size must not become the screen height.");
  if (signedIn) {
    const [account, library, recovery] = panel.scroll.children;
    assert.equal(panel.scroll.children.length, 3);
    assert.deepEqual(account.children.slice(1, 3), [panel.profile, panel.plan]);
    assert.deepEqual(library.children.slice(1), [panel.offline]);
    assert.equal(library.children[0].textContent,"Offline");
    assert.equal(recovery.children[0].textContent, "Data & recovery");
    assert.deepEqual(recovery.children.slice(1), [panel.conflicts, panel.data]);
    assert.equal(account.children.at(-1).children[0], panel.signOut, "Keep the wired sign-out control below Plan.");
    assert.equal(account.children.at(-1).children[1], panel.deleteAccount, "One direct action keeps the original deletion confirmation handler.");
  }
  dialog.listeners.keydown({ defaultPrevented: true, key: "Tab" });
  assert.equal(h.focusTraps(), 0, "Nested dialogs and editors retain handled keyboard events.");
  const warning = h.context.document.createElement("div");
  warning.className = "web-warning-backdrop";
  dialog.append(warning);
  dialog.children[0].children[1].listeners.click();
  assert.equal(h.dialog(), null);
  assert.deepEqual(h.warningClosures, [false], "Closing Settings cancels its unanswered confirmation.");
  assert.equal(h.toggleAttributes["aria-pressed"], "false");
  h.context.toggleAccountDialog();
  h.dialog().floatingEscape();
  assert.equal(h.focusReturns(), 1, "Escape returns focus to the Account entry.");
  assert.equal(h.track.inert, false); assert.equal(h.toolbar.inert, false);
  h.context.toggleAccountDialog(); h.revokeAccount();
  assert.equal(h.dialog(), null, "Account changes discard the private account view.");
  assert.equal(h.track.inert, false);
}

// Pro entry keeps signup separate from Settings and retains the expected auth handoff.
const replaceSettings = harness(false);
replaceSettings.context.toggleAccountDialog();
const previousSettings = replaceSettings.dialog();
replaceSettings.context.toggleAccountDialog({upgrade:true});
assert.notEqual(replaceSettings.dialog(), previousSettings);
assert.equal(replaceSettings.dialog().dataset.proUpgrade, 'true', 'Get Pro replaces an already open generic account screen');
replaceSettings.dialog().children[0].children[0].listeners.click();
for (const signedIn of [false, true]) {
  const pro = harness(signedIn);
  pro.context.toggleAccountDialog({ upgrade: true });
  assert.equal(pro.dialog().attributes['aria-label'], 'Get Pro');
  assert.equal(pro.dialog().children[0].children.length, 1, 'The Pro header contains only its close control');
  assert.equal(pro.dialog().children[0].children[0].attributes['aria-label'], 'Close Get Pro');
  assert.equal(pro.panels[0].scroll.children.length, 5, 'The Pro entry must not organize Settings columns');
  pro.dialog().dataset.signingIn = 'true';
  pro.revokeAccount();
  if (signedIn) assert.equal(pro.dialog(), null, 'Account changes close an existing-account upgrade');
  else {
    assert.equal(pro.dialog().open, true, 'Expected guest authentication preserves the upgrade handoff');
    delete pro.dialog().dataset.signingIn;
    pro.revokeAccount();
    assert.equal(pro.dialog(), null, 'An unrelated account change still closes the guest screen');
  }
}
console.log('Pro entry passed: focused heading, no Settings columns, guest sign-in handoff and existing-account isolation.');

// The welcome shortcut starts the existing sign-in action without an upgrade.
const directSignIn = harness(false);
directSignIn.context.toggleAccountDialog({ signIn: true });
assert.deepEqual(directSignIn.signInStarts, ["signIn"]);
assert.equal(directSignIn.dialog().attributes['aria-label'], 'Sign in');
assert.equal(directSignIn.dialog().dataset.proUpgrade, undefined);
assert.equal(directSignIn.dialog().children[0].children[1].attributes['aria-label'], 'Close Sign in');
directSignIn.revokeAccount();
assert.equal(directSignIn.dialog().open, true, 'Expected authentication keeps the direct sign-in handoff open');
delete directSignIn.dialog().dataset.signingIn;
directSignIn.revokeAccount();
assert.equal(directSignIn.dialog(), null, 'Unrelated account changes still discard the sign-in screen');
const signedInShortcut = harness(true);
signedInShortcut.context.toggleAccountDialog({ signIn: true });
assert.deepEqual(signedInShortcut.signInStarts, [], 'An existing account must not start another authentication request');
const freeUpgrade = harness(true, false);
freeUpgrade.context.toggleAccountDialog({ upgrade: true });
assert.equal(freeUpgrade.checkoutStarts.length, 1, 'A signed-in Free account goes straight to the checkout review');
assert.equal(freeUpgrade.checkoutStarts[0], freeUpgrade.dialog());
const guestUpgrade = harness(false);
guestUpgrade.context.toggleAccountDialog({ upgrade: true });
assert.equal(guestUpgrade.checkoutStarts.length, 0, 'Guests review Pro and authenticate before checkout');

// Content recovery updates keep the floating panel, disclosures, edits, and scroll mounted.
const h = harness(true);
h.context.toggleAccountDialog();
h.panels[0].scroll.scrollTop = 240;
h.panels[0].profile.scrollTop = 25;
h.panels[0].offline.scrollTop = 360;
h.panels[0].scroll.children[1].scrollTop = 425;
const projectsSection = h.context.document.createElement("details");
projectsSection.open = true;
const trashSection = h.context.document.createElement("details");
trashSection.open = true;
h.panels[0].data.append(projectsSection, trashSection);
h.panels[0].profile.unsavedDraft = "Keep this edit";
assert.equal(h.context.settingsPanelScrollTop(h.panels[0]), 240);
await h.context.refreshWorkspaceAfterSettingsClear(240, 350);
assert.equal(h.panels.length, 1, "Restoring content must not reconstruct Settings.");
assert.equal(h.dialog().children[1], h.panels[0]);
assert.equal(h.panels[0].scroll.scrollTop, 240);
assert.equal(h.panels[0].profile.scrollTop, 25);
assert.equal(h.panels[0].offline.scrollTop, 360);
assert.equal(h.panels[0].scroll.children[1].scrollTop, 425, "Offline column position survives a recovery refresh.");
assert.equal(h.panels[0].workspaceRefreshes, 1);
assert.equal(h.panels[0].trashRefreshes, 1);
assert.equal(projectsSection.open, true);
assert.equal(trashSection.open, true);
assert.equal(h.panels[0].profile.unsavedDraft, "Keep this edit");
assert.equal(h.panels[0].plan.scrollTop, 0);
assert.equal(h.track.scrollLeft, 350);
assert.equal(h.transitions[0].options.refreshPaneIDs.join(","), "reader:one,utility:saved");
h.dialog().children[0].children[1].listeners.click();
assert.equal(h.dialog(), null);
const legacyRecovery = harness(true);
legacyRecovery.context.toggleAccountDialog();
legacyRecovery.dialog().className = "account-dialog account-screen account-workspace-view";
await legacyRecovery.context.refreshWorkspaceAfterSettingsClear(0, 0);
assert.equal(legacyRecovery.panels.length, 2, "The legacy full-screen recovery path remains available.");
const revokedRecovery = harness(true);
revokedRecovery.context.toggleAccountDialog();
revokedRecovery.context.transitionWorkspace = async () => revokedRecovery.revokeAccount();
await revokedRecovery.context.refreshWorkspaceAfterSettingsClear(0, 0);
assert.equal(revokedRecovery.dialog(), null);
assert.equal(revokedRecovery.panels.length, 1, "An account change cannot refresh a different user's Settings.");
console.log("Account screen passed: signed-in/guest lifecycle, original controls, close/Escape, nested keyboard handling, and independent category scroll restoration.");

const expanded = harness(true);
expanded.context.state.settingsCollapsedColumnIDs = ["account", "library", "recovery"];
expanded.context.toggleAccountDialog();
for (const column of expanded.panels[0].scroll.children) {
  const heading = column.children[0];
  assert.equal(heading.getAttribute("role"), null);
  assert.equal(heading.getAttribute("aria-expanded"), null);
  assert.equal(heading.listeners.click, undefined);
  assert.equal(heading.listeners.keydown, undefined);
  assert.equal(column.classList.contains("is-collapsed"), false);
  assert.equal(column.children.some(node => node.className?.includes("settings-column-restore")), false);
}
expanded.dialog().children[0].children[1].listeners.click();
expanded.context.toggleAccountDialog();
assert.ok(expanded.panels[1].scroll.children.every(column => !column.classList.contains("is-collapsed")), "Old collapsed preferences must not hide Settings columns when reopened");
console.log("Settings tabs retain all category controls and ignore legacy column-collapse preferences.");
