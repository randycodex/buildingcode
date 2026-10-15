import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const settings = app.slice(app.indexOf('function renderSettings('));
const start = settings.indexOf('  const settingsProjectsIncludeCollections =');
const selectionSource = settings.slice(start, settings.indexOf('  projectEmpty.hidden', start));
const folderHelpers = app.slice(app.indexOf('function folderType('), app.indexOf('\nfunction readableProjectName('));

function harness({projects = [{id:'one'}, {id:'two'}], saved = [{}], links = [], annotations = []} = {}) {
  const node = () => ({hidden:false,disabled:false,textContent:'',attributes:{},setAttribute(key,value){this.attributes[key]=value;}});
  const nodes = new Map();
  const panel = {querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);}};
  const controls = Object.fromEntries(['projectList','projectSelectAll','projectDelete','projectClearAll','projectActions','projectSelectionStatus'].map(name=>[name,node()]));
  const context = vm.createContext({panel,...controls,settingsProjects:projects,
    bookmarkRecordsForSettings:()=>saved,currentContentSummary:()=>({projectSections:links,annotations})});
  vm.runInContext(folderHelpers+selectionSource+';updateProjectSelection();',context);
  return {nodes,controls,select(ids){vm.runInContext(`selectedProjectIDs.clear();${ids.map(id=>`selectedProjectIDs.add(${JSON.stringify(id)});`).join('')}updateProjectSelection();`,context);}};
}

const h = harness({saved:[{},{}],links:[{sectionID:545},{sectionID:546},{sectionID:547,deletedAt:'deleted'}],annotations:[{noteBody:'Kept note'},{noteBody:' '},{tags:['tag only']}]});
assert.equal(h.nodes.get('#settings-projects-title').textContent,'Projects');
assert.equal(h.controls.projectList.attributes['aria-label'],'Projects');
assert.equal(h.controls.projectClearAll.attributes['aria-label'],'Move all projects to Trash');
assert.equal(h.nodes.get('[data-content-count="bookmarks"]').textContent,'2 saved · 2 Project links');
assert.equal(h.nodes.get('[data-content-count="notes"]').textContent,'1 saved · Tags stay');
assert.equal(h.controls.projectDelete.hidden,true,'No empty disabled selection action.');
assert.equal(h.controls.projectClearAll.hidden,false);
h.select(['one']);
assert.equal(h.controls.projectDelete.hidden,false);
assert.equal(h.controls.projectDelete.disabled,false);
assert.equal(h.controls.projectClearAll.hidden,true,'Only the selected scope is offered while selecting.');
assert.equal(h.controls.projectSelectionStatus.textContent,'1 selected');
assert.equal(h.controls.projectDelete.attributes['aria-label'],'Move 1 selected item to Trash');
h.select(['one','two']);
assert.equal(h.controls.projectSelectAll.textContent,'Clear selection');
h.select([]);
assert.equal(h.controls.projectDelete.hidden,true);
assert.equal(h.controls.projectSelectionStatus.hidden,true);
assert.equal(h.controls.projectClearAll.hidden,false);
const empty = harness({projects:[],saved:[]});
assert.equal(empty.nodes.get('#settings-projects-title').textContent,'Projects','Empty accounts do not advertise legacy collections.');
assert.equal(empty.controls.projectActions.hidden,true);
assert.equal(empty.controls.projectSelectAll.hidden,true);
assert.equal(empty.nodes.get('[data-clear-action="bookmarks"]').disabled,true);
assert.equal(empty.nodes.get('[data-clear-action="notes"]').disabled,true);
const linksOnly = harness({saved:[],links:[{sectionID:545}]});
assert.equal(linksOnly.nodes.get('[data-clear-action="bookmarks"]').disabled,false,'Orphaned Project links remain manageable.');
for (const projects of [[{id:'old',folderType:'reference'}],[{id:'one'},{id:'old',folderType:'reference',archivedAt:'2026-10-01'}]]) {
  const legacy = harness({projects});
  assert.equal(legacy.nodes.get('#settings-projects-title').textContent,'Projects & collections');
  assert.equal(legacy.controls.projectList.attributes['aria-label'],'Projects and saved collections');
  assert.equal(legacy.controls.projectClearAll.attributes['aria-label'],'Move all projects and saved collections to Trash');
}
console.log('Saved content management: counts, selection scope, clear selection, empty groups, and Project-link-only cleanup passed.');
