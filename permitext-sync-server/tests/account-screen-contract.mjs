import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function extract(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, "m"));
  assert(start >= 0, name);
  return source.slice(start, source.indexOf("\n}", start) + 2);
}

function harness(signedIn) {
  let currentDialog = null, focusReturns = 0, focusTraps = 0;
  const panels = [], transitions = [], toggleAttributes = {};
  function element() {
    return {
      children: [], listeners: {}, attributes: {}, dataset: {}, removedStyles: [],
      style: { removeProperty(name) { this.owner.removedStyles.push(name); } },
      setAttribute(name, value) { this.attributes[name] = value; },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener(name, listener) { this.listeners[name] = listener; },
      showModal() { this.open = true; },
      close() { this.open = false; this.listeners.close(); },
      remove() { currentDialog = null; },
      querySelector() { return null; },
      querySelectorAll(selector) { return this.children.flatMap(child => child.querySelectorAll?.(selector) || []); }
    };
  }
  function panel() {
    const result = element();
    result.style.owner = result;
    const category = id => ({ scrollTop: 0, getAttribute: name => name === "aria-labelledby" ? id : null });
    const profile = category("profile"), plan = category("plan"), sources = category("sources");
    const scroll = {
      children: [plan, profile, sources], scrollTop: 0,
      querySelector: selector => selector === ".account-connector" ? profile : null,
      prepend(child) { this.children = [child, ...this.children.filter(item => item !== child)]; }
    };
    const oldHeader = { remove() { result.headerRemoved = true; } };
    result.querySelector = selector => ({ ".panel-header": oldHeader, ".settings-scroll": signedIn ? scroll : null })[selector] || null;
    result.querySelectorAll = selector => signedIn && selector === ".settings-card" ? [profile, plan, sources] : [];
    result.__refreshActiveCodeSources = async () => { result.sourcesReady = true; };
    Object.assign(result, { scroll, profile, plan, sources });
    panels.push(result);
    return result;
  }
  const track = { scrollLeft: 0, scrollWidth: 1500, clientWidth: 500, querySelector: () => null };
  const context = vm.createContext({
    document: {
      querySelector: selector => selector === ".account-dialog" || selector === ".account-screen[open]" ? currentDialog : null,
      createElement: element,
      body: { append(dialog) { currentDialog = dialog; } }
    },
    toggleSettingsButton: { setAttribute: (name, value) => { toggleAttributes[name] = value; },
      focus: () => { focusReturns++; }, blur() {} },
    activeAccount: () => signedIn ? { userID: "synthetic-account" } : null,
    renderSettings: panel, renderAccountWelcome: panel,
    trapWebModalFocus: () => { focusTraps++; }, clearProUpgradeIntent() {},
    activePaneIDs: () => ["reader:one", "utility:settings", "utility:saved"],
    transitionWorkspace: async (kind, options) => transitions.push({ kind, options }), track
  });
  vm.runInContext(["settingsPanelScrollTop", "refreshWorkspaceAfterSettingsClear", "mountAccountScreenContent", "toggleAccountDialog"].map(extract).join("\n"), context);
  return { context, track, panels, transitions, toggleAttributes,
    dialog: () => currentDialog, focusReturns: () => focusReturns, focusTraps: () => focusTraps };
}

for (const signedIn of [false, true]) {
  const h = harness(signedIn);
  h.context.toggleAccountDialog();
  const dialog = h.dialog(), panel = h.panels[0];
  assert.equal(dialog.className, "account-dialog account-screen");
  assert.equal(dialog.open, true);
  assert.equal(dialog.children[1], panel, "Keep the original wired controls and their account fences.");
  assert.equal(panel.headerRemoved, true);
  assert.deepEqual(panel.removedStyles, ["flex"], "Column size must not become the screen height.");
  if (signedIn) assert.deepEqual(panel.scroll.children, [panel.profile, panel.plan, panel.sources]);
  dialog.listeners.keydown({ defaultPrevented: true, key: "Tab" });
  assert.equal(h.focusTraps(), 0, "Nested dialogs and editors retain handled keyboard events.");
  dialog.children[0].children[1].listeners.click();
  assert.equal(h.dialog(), null);
  assert.equal(h.toggleAttributes["aria-pressed"], "false");
  h.context.toggleAccountDialog();
  h.dialog().listeners.cancel();
  h.dialog().close();
  assert.equal(h.focusReturns(), 1, "Escape returns focus to the Account entry.");
}

// Content recovery refreshes must retain the screen's Back action and scroll location.
const h = harness(true);
h.context.toggleAccountDialog();
h.panels[0].scroll.scrollTop = 240;
h.panels[0].profile.scrollTop = 25;
h.panels[0].sources.scrollTop = 360;
assert.equal(h.context.settingsPanelScrollTop(h.panels[0]), 240);
await h.context.refreshWorkspaceAfterSettingsClear(240, 350);
assert.equal(h.dialog().children[1], h.panels[1]);
assert.equal(h.panels[1].scroll.scrollTop, 240);
assert.equal(h.panels[1].profile.scrollTop, 25);
assert.equal(h.panels[1].sources.scrollTop, 360);
assert.equal(h.panels[1].sourcesReady, true);
assert.equal(h.panels[1].plan.scrollTop, 0);
assert.equal(h.track.scrollLeft, 350);
assert.equal(h.transitions[0].options.refreshPaneIDs.join(","), "reader:one,utility:saved");
h.dialog().children[0].children[1].listeners.click();
assert.equal(h.dialog(), null);
console.log("Account screen passed: signed-in/guest lifecycle, original controls, Back/Escape, nested keyboard handling, and independent category scroll restoration.");
