import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.isConnected = true; this.open = false; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute() {}
  addEventListener(name, cb) { this.events[name] = cb; }
  showModal() { this.open = true; }
  close() { if (!this.open) return; this.open = false; this.events.close?.(); }
  remove() { this.isConnected = false; }
}
const document = { createElement: tag => new Element(tag), body: new Element('body') };
let tick;
const context = vm.createContext({ document, setInterval: cb => { tick = cb; return 1; }, clearInterval() {} });
vm.runInContext((await readFile(new URL('../public/report-screen.js',import.meta.url),'utf8')).replace('export function','function'),context);
let loads=0, disposed=0, valid=true;
const panel=new Element('article'); panel.draft='unfinished'; panel.scrollTop=613;
const screen=context.createReportScreen({projectName:'Test project',load:async()=>{loads++;return panel;},isCurrent:()=>valid,onClose(){},onDispose(){disposed++;}});
screen.open(); await Promise.resolve(); await Promise.resolve();
screen.close(); screen.open(); await Promise.resolve();
assert.equal(loads,1,'Returning to Report must reuse the mounted editor');
assert.equal(document.body.children[0].children[1].children[0],panel);
assert.equal(panel.draft,'unfinished'); assert.equal(panel.scrollTop,613);
valid=false; tick(); assert.equal(disposed,1); assert.equal(screen.isOpen(),false);
screen.dispose(); assert.equal(disposed,1);
let resolve; valid=true;
const pending=context.createReportScreen({projectName:'Pending',load:()=>new Promise(r=>resolve=r),isCurrent:()=>valid,onClose(){},onDispose(){}});
pending.open(); valid=false; tick(); resolve(panel); await Promise.resolve(); await Promise.resolve();
assert.equal(pending.isOpen(),false,'A late load cannot reopen private content after a context change');
// Both dedicated screens must remove retained private content when access is revoked,
// even while closed. This covers the screen lifecycle outside the column hydrator.
for (const title of ['Report', 'Project details']) {
  let allowed = true, removed = 0;
  const privatePanel = new Element('article');
  const guarded = context.createReportScreen({
    projectName: 'Private project', screenTitle: title, load: async () => privatePanel,
    isCurrent: () => allowed, onClose() {}, onDispose() { removed++; }
  });
  await guarded.open(); guarded.close();
  allowed = false; tick();
  assert.equal(removed, 1, `${title} disposes its retained editor on access revocation`);
  assert.equal(guarded.isCurrent(), false);
  guarded.open();
  assert.equal(guarded.isOpen(), false, `${title} cannot reopen private content`);
}
console.log('Report screen passed: mounted draft and scroll retention, context cleanup, late-load fencing.');
