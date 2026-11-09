import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {settingsSavedContentSnapshot} from '../public/settings-saved-content.js';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const settings = app.slice(app.indexOf('function renderSettings('));
const start = settings.indexOf('  let savedCollections =');
const collectionSource = settings.slice(start, settings.indexOf('  const paintLibraryDownloadProgress', start));
const folderHelpers = app.slice(app.indexOf('function folderType('), app.indexOf('\nfunction readableProjectName('));
const managerStart = settings.indexOf('  const refreshProjectManagement =');
const managerSource = settings.slice(managerStart, settings.indexOf('  manageProjects?.addEventListener', managerStart));
const notifyStart = app.indexOf('function refreshOpenSettingsWorkspace(');
const notifySource = app.slice(notifyStart, app.indexOf('\n}', notifyStart) + 2);

function harness({projects = [{id:'one'}, {id:'two'}], saved = [{}], links = [], annotations = [], allowed = true} = {}) {
  const node = () => ({hidden:false,disabled:false,textContent:'',attributes:{},children:[],events:{},
    style:{setProperty(){}}, setAttribute(key,value){this.attributes[key]=value;},
    append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},
    addEventListener(name,handler){this.events[name]=handler;}
  });
  const nodes = new Map();
  const panel = {querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},querySelectorAll:()=>[],closest(){return panel;}};
  const manageProjects = node();
  manageProjects.open = true;
  manageProjects.querySelector = selector => panel.querySelector(`manager ${selector}`);
  const controls = Object.fromEntries(['collectionsCard','collectionList','collectionSelectAll','collectionDelete','collectionClearAll','collectionActions','collectionSelectionStatus'].map(name=>[name,node()]));
  let current = true;
  const deleted = [], confirmations = [];
  saved = saved.map((item, index) => ({sectionID: index + 1, ...item}));
  links = links.map(item => ({folderClientID:'one', ...item}));
  annotations = annotations.map((item,index) => ({sectionID: index + 1, ...item}));
  const content = {projects, savedItems:saved, projectSections:links, annotations};
  const context = vm.createContext({panel,...controls,settingsIdentity:'owner',upgrade:false,manageProjects,
    document:{createElement:node,querySelectorAll:()=>[panel]},isCurrentAccountRequest:()=>current,
    workspacePrivatePresentationAllowed:()=>allowed,
    renderProjectManager:container=>{container.projectNames=content.projects.filter(project=>!project.deletedAt&&project.folderType!=='reference').map(project=>project.name || project.id);},
    bookmarkRecordsForSettings:()=>saved,currentContentSummary:()=>content,
    visibleProjectRecords:records=>records.filter(project=>!project.deletedAt),
    projectIsArchived:project=>Boolean(project.archivedAt),projectRecordID:project=>project.id,
    workspaceProject:()=>content.projects.find(project=>project.id==='one'&&!project.deletedAt) || null,
    settingsSavedContentForSummary:summary=>settingsSavedContentSnapshot(summary,{workspace:content.projects.find(project=>project.id==='one'&&!project.deletedAt)||null}), savedContentLibrary:{refresh(){}},
    savedEvidenceKey:item=>`${item.codeVersion || 'nyc-2022'}:${item.sectionID}:${item.blockID || ''}`,
    projectSectionBelongsToProject:(link,project)=>link.folderClientID===project.id,
    projectColor:()=>'',readableProjectName:project=>project.name || project.id,
    confirmWebWarning:async(...args)=>{confirmations.push(args);return true;},prepareRecoverableDeletion:async()=>{},
    deleteArchivedProjectData:async project=>{deleted.push(project.id);project.deletedAt='deleted';},
    requireCurrentAccountRequest(){assert(current);},setStatus(){},settingsPanelScrollTop:()=>0,track:{scrollLeft:0},
    refreshWorkspaceAfterSettingsClear:async()=>panel.__refreshSettingsWorkspace()
  });
  vm.runInContext(folderHelpers+managerSource+collectionSource+notifySource,context);
  return {nodes,controls,content,saved,panel,manageProjects,deleted,confirmations,
    setCurrent(value){current=value;},refresh(){panel.__refreshSettingsContent();},
    setAllowed(value){allowed=value;},refreshWorkspace(){context.refreshOpenSettingsWorkspace();},
    select(ids){vm.runInContext(`selectedCollectionIDs.clear();${ids.map(id=>`selectedCollectionIDs.add(${JSON.stringify(id)});`).join('')}updateCollectionSelection();`,context);}
  };
}

const h = harness({saved:[{},{}],links:[{sectionID:545},{sectionID:546},{sectionID:547,deletedAt:'deleted'}],annotations:[{noteBody:'Kept note'},{noteBody:' '},{tags:['tag only']}]});
assert.equal(h.controls.collectionsCard.hidden,true,'Ordinary Projects do not appear again in Saved Content.');
assert.equal(h.controls.collectionList.children.length,0);
assert.equal(h.nodes.get('[data-content-count="bookmarks"]').textContent,'2 saved');
assert.equal(h.nodes.get('[data-content-count="notes"]').textContent,'0 saved','Unassigned notes do not appear in workspace recovery.');
await h.controls.collectionClearAll.events.click();
assert.deepEqual(h.deleted,[],'A hidden collection action cannot delete regular Projects.');
const empty = harness({projects:[],saved:[]});
assert.equal(empty.controls.collectionsCard.hidden,true);
assert.equal(empty.nodes.get('[data-clear-action="bookmarks"]').disabled,true);
assert.equal(empty.nodes.get('[data-clear-action="notes"]').disabled,true);
const linksOnly = harness({saved:[],links:[{sectionID:545}]});
assert.equal(linksOnly.nodes.get('[data-clear-action="bookmarks"]').disabled,false,'Passage links remain manageable even without a standalone saved passage.');

const legacy = harness({projects:[{id:'one'},{id:'old',folderType:'reference'},{id:'archived',folderType:'reference',archivedAt:'2026-10-01'},{id:'shared',folderType:'reference',sharedOnly:true}]});
assert.equal(legacy.controls.collectionsCard.hidden,true,'Account-wide collection controls no longer appear in workspace recovery.');
assert.equal(legacy.controls.collectionList.children.length,2,'Only owned legacy collections are offered here.');
assert.equal(legacy.controls.collectionList.children.at(-1).children.at(-1).textContent,'Archived');
legacy.select(['one','old']);legacy.refresh();
assert.equal(legacy.controls.collectionSelectionStatus.textContent,'1 selected','A regular Project ID cannot enter a collection deletion.');
await legacy.controls.collectionDelete.events.click();
assert.deepEqual(legacy.deleted,['old']);
assert.equal(legacy.controls.collectionClearAll.hidden,false);
await legacy.controls.collectionClearAll.events.click();
assert.deepEqual(legacy.deleted,['old','archived'],'Move all targets remaining legacy collections only.');
assert.equal(legacy.controls.collectionsCard.hidden,true,'The legacy group disappears when no collections remain.');
assert.equal(legacy.content.projects.find(project=>project.id==='one').deletedAt,undefined);
assert.equal(legacy.content.projects.find(project=>project.id==='shared').deletedAt,undefined);
assert(legacy.confirmations.every(([,message,options])=>message.includes('across synced devices')&&options.container===legacy.panel));

// Project changes refresh counts without reintroducing a second Project manager.
h.content.projects[0].deletedAt='deleted';h.content.projectSections=[];h.refresh();
assert.equal(h.controls.collectionList.children.length,0);
assert.equal(h.nodes.get('[data-content-count="bookmarks"]').textContent,'0 saved');
assert.equal(h.nodes.get('[data-content-count="notes"]').textContent,'0 saved');
h.content.projects.push({id:'new-collection',folderType:'reference'});h.refresh();
assert.equal(h.controls.collectionList.children.length,1);
h.setCurrent(false);h.content.projects=[];h.refresh();
assert.equal(h.controls.collectionList.children.length,1,'A response from a previous account cannot change this Settings view.');
assert.match(settings,/onChange: async \(\) => \{\s*refreshSettingsContent\(\);\s*await panel\.__refreshSettingsTrash\?\.\(\);/);

// A workspace created or renamed while Settings is open updates the single Project manager.
const live = harness({projects:[], allowed:false});
const originalPanel=live.panel;
live.panel.profileDraft='Unfinished profile edit';live.panel.scrollTop=245;
live.refreshWorkspace();
assert.equal(live.nodes.get('manager summary').attributes['aria-disabled'],'true');
assert.equal(live.nodes.get('manager .settings-project-manager-content').hidden,true);
live.content.projects.push({id:'created',name:'New workspace',folderType:'project'});live.setAllowed(true);live.refreshWorkspace();
assert.deepEqual(live.nodes.get('manager .settings-project-manager-content').projectNames,['New workspace']);
assert.equal(live.controls.collectionsCard.hidden,true);
assert.equal(live.panel,originalPanel);assert.equal(live.panel.profileDraft,'Unfinished profile edit');assert.equal(live.panel.scrollTop,245);
live.content.projects[0].name='Renamed workspace';live.refreshWorkspace();
assert.deepEqual(live.nodes.get('manager .settings-project-manager-content').projectNames,['Renamed workspace']);
assert.equal(live.manageProjects.open,true);
live.setCurrent(false);live.content.projects.push({id:'other-account',name:'Private other account'});live.refreshWorkspace();
assert.deepEqual(live.nodes.get('manager .settings-project-manager-content').projectNames,['Renamed workspace']);

// Clearing activity matches the label and leaves pinned searches and other continuity intact.
const activitySource=app.slice(app.indexOf('async function performSettingsClearAction('),app.indexOf('\nfunction ',app.indexOf('async function performSettingsClearAction(')));
const activityState={recentSearches:['a'],recentSearchHistory:['b'],recentlyViewedSections:[1],pinnedSearches:['keep']};
const mutations=[];
const activityValues={state:activityState,requirePrivateWorkspaceWritable(){},captureAccountRequest:()=> 'owner',requireCurrentAccountRequest(){},activeAccount:()=>({userID:'owner'}),syncedContent:{summary:{latestContinuity:{values:{other:'keep'}}}},defaultSyncCodeVersion:'nyc-2022',enqueueSyncMutation:mutation=>mutations.push(mutation),saveWorkspaceState(){},flushSyncOutbox:async()=>{}};
await new Function(...Object.keys(activityValues),activitySource+';return performSettingsClearAction("searches");')(...Object.values(activityValues));
assert.deepEqual(activityState.recentSearches,[]);assert.deepEqual(activityState.recentSearchHistory,[]);assert.deepEqual(activityState.recentlyViewedSections,[]);assert.deepEqual(activityState.pinnedSearches,['keep']);
assert.equal(mutations[0].continuity.values.other,'keep');
assert.equal(mutations[0].continuity.values.recentlyViewedSectionsJSON,'[]');
assert.match(index,/>Recent activity</);
assert(!index.includes('id="settings-projects-title"'),'No duplicate Projects block remains in Saved Content.');
console.log('Data & Recovery: single Project manager, legacy collection-only deletion, live counts, account isolation, mounted state, and recent activity scope passed.');
