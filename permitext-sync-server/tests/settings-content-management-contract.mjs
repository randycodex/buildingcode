import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const settings = app.slice(app.indexOf('function renderSettings('));
const start = settings.indexOf('  let settingsProjects =');
const selectionSource = settings.slice(start, settings.indexOf('  projectSelectAll.addEventListener', start));
const folderHelpers = app.slice(app.indexOf('function folderType('), app.indexOf('\nfunction readableProjectName('));

function harness({projects = [{id:'one'}, {id:'two'}], saved = [{}], links = [], annotations = []} = {}) {
  const node = () => ({hidden:false,disabled:false,textContent:'',attributes:{},children:[],events:{},
    style:{setProperty(){}},
    setAttribute(key,value){this.attributes[key]=value;},
    append(...children){this.children.push(...children);},
    replaceChildren(...children){this.children=children;},
    addEventListener(name,handler){this.events[name]=handler;}
  });
  const nodes = new Map();
  const panel = {querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);}};
  const controls = Object.fromEntries(['projectList','projectEmpty','projectSelectAll','projectDelete','projectClearAll','projectActions','projectSelectionStatus'].map(name=>[name,node()]));
  let current = true;
  const content = {projects, projectSections:links, annotations};
  const context = vm.createContext({panel,...controls,settingsIdentity:'owner',
    document:{createElement:node},isCurrentAccountRequest:()=>current,
    bookmarkRecordsForSettings:()=>saved,currentContentSummary:()=>content,
    visibleProjectRecords:records=>records.filter(project=>!project.deletedAt),
    projectIsArchived:project=>Boolean(project.archivedAt),projectRecordID:project=>project.id,
    projectColor:()=>'',readableProjectName:project=>project.name || project.id
  });
  vm.runInContext(folderHelpers+selectionSource,context);
  return {nodes,controls,content,saved,panel,
    setCurrent(value){current=value;},refresh(){panel.__refreshSettingsContent();},
    select(ids){vm.runInContext(`selectedProjectIDs.clear();${ids.map(id=>`selectedProjectIDs.add(${JSON.stringify(id)});`).join('')}updateProjectSelection();`,context);}
  };
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
// A Project mutation must update the already-open Saved Content section.
h.select(['one', 'two']);
h.content.projects[0].deletedAt = '2026-10-18T00:00:00Z';
h.content.projectSections = [{sectionID:546}];
h.refresh();
assert.equal(h.nodes.get('[data-content-count="projects"]').textContent,'1 total');
assert.equal(h.controls.projectList.children.length,1,'Deleted rows disappear without reopening Settings.');
assert.equal(h.controls.projectList.children[0].children[1].children[0].textContent,'two');
assert.equal(h.controls.projectSelectionStatus.textContent,'1 selected','Deleted selections cannot target missing projects.');
assert.equal(h.controls.projectList.children[0].children[0].checked,true,'Surviving selections remain checked.');
h.content.projects[1].deletedAt = '2026-10-18T00:00:01Z';
h.content.projectSections = [];
h.refresh();
assert.equal(h.nodes.get('[data-content-count="projects"]').textContent,'0 total');
assert.equal(h.controls.projectList.children.length,0);
assert.equal(h.controls.projectEmpty.hidden,false);
assert.equal(h.controls.projectActions.hidden,true);
assert.equal(h.controls.projectSelectionStatus.hidden,true);
assert.equal(h.nodes.get('[data-content-count="bookmarks"]').textContent,'2 saved · 0 Project links','Unrelated saved passages remain after project deletion.');
assert.equal(h.nodes.get('[data-content-count="notes"]').textContent,'1 saved · Tags stay','Unrelated notes remain.');
h.content.projects = [{id:'restored',name:'Restored project',archivedAt:'2026-10-17'}];
h.refresh();h.refresh();
assert.equal(h.controls.projectList.children.length,1,'Repeated refreshes replace rows rather than duplicate them.');
assert.equal(h.controls.projectList.children[0].children.at(-1).textContent,'Archived');
h.content.projects[0].archivedAt = null;
h.refresh();
assert.equal(h.controls.projectList.children[0].children.length,2,'Restoring a project removes its Archived badge in place.');
h.setCurrent(false);h.content.projects=[];h.refresh();
assert.equal(h.controls.projectList.children.length,1,'A response from a previous account cannot change this Settings view.');
assert.match(settings,/onChange: \(\) => \{\s*refreshSettingsContent\(\);\s*panel\.__refreshSettingsTrash\?\.\(\);/,'Inline project actions refresh Saved Content and open Trash.');
console.log('Saved content management: selection, scope, live project removal and restore, counts, retained content and account fencing passed.');
