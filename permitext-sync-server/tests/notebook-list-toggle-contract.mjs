import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return `${source.slice(start - 6, start) === 'async ' ? 'async ' : ''}${source.slice(start, source.indexOf('\n}', start) + 2)}`;
}
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.className = ''; this.text = ''; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren() { this.children = []; }
  set textContent(value) { this.text = value; }
  get textContent() { return this.text + this.children.map(node => node.textContent).join(''); }
  setAttribute(name, value) { this.attrs[name] = value; }
  addEventListener() {}
  get classList() { return {toggle:(name, on) => {
    const names = new Set(this.className.split(' ').filter(Boolean));
    on ? names.add(name) : names.delete(name); this.className = [...names].join(' ');
  }}; }
  querySelectorAll(selector) {
    return this.children.flatMap(node => [
      ...((selector.startsWith('.') ? node.className.split(' ').includes(selector.slice(1)) : node.tag === selector) ? [node] : []),
      ...node.querySelectorAll(selector)
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
const project = {id:'project'}, state = {notebookListHidden:false};
const editorID = 'project:notebook:project:note:editor';
let view = 'notebook', allowed = true, saves = 0, transitions = 0;
const context = vm.createContext({
  state, document:{createElement:tag => new Element(tag), querySelector:() => null},
  // Deferred panels are built before they belong to the workspace track.
  track:{querySelector:() => null}, applyPaneWeight() {},
  workspacePrivatePresentationAllowed:() => allowed, hasCapability:() => allowed,
  workspaceProject:() => project, projectDetailKey:value => value?.id || '',
  currentWorkflowView:() => view, currentColumnWorkflowView:() => view, isProAccount:() => true,
  selectedNotebookColumn:() => ({id:'editor',cardID:'a'}), notebookColumnPaneID:() => editorID,
  isProjectNotebookPaneID:id => id.startsWith('project:notebook:'),
  notebookCatalogs:new Map([['project',[{id:'a',title:'Note A'},{id:'b',title:'Note B'}]]]),
  notebookCatalogRequests:new Map(), saveWorkspaceState(){saves++;},
  async transitionWorkspace(mode){assert.equal(mode,'utility'); transitions++;}
});
vm.runInContext(['notebookIndexPaneID','renderNotebookIndex','syncNotebookLanding','toggleNotebookList','workflowPaneIsVisible'].map(actual).join('\n'), context);
const panel = context.renderNotebookIndex(project);
const list = panel.querySelector('.notebook-index-body');
assert.deepEqual(list.querySelectorAll('li').map(node => node.textContent), ['Note A','Note B'], 'A newly reopened deferred panel renders existing notes before mounting.');
assert.ok(list.querySelectorAll('button').some(node => node.textContent === 'New note'));
const indexID = context.notebookIndexPaneID(project);
await context.toggleNotebookList();
assert.equal(context.workflowPaneIsVisible(indexID), false);
assert.equal(context.workflowPaneIsVisible(editorID), true, 'Hiding the list leaves the selected note visible.');
await context.toggleNotebookList();
assert.equal(context.workflowPaneIsVisible(indexID), true);
assert.equal(saves, 2); assert.equal(transitions, 2);
allowed = false;
assert.equal(await context.toggleNotebookList(), false);
allowed = true; view = 'research';
assert.equal(await context.toggleNotebookList(), false);
assert.equal(saves, 2, 'Unavailable tools and other working views cannot change list visibility.');
console.log('Notes list toggle passed: immediate deferred contents, independent editor visibility, persistence and access/view guards.');
