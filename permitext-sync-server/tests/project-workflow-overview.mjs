import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {documentFixture} from './helpers/workflow-dom.mjs';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('async function renderProjectSavedWork(');
const actual = source.slice(start, source.indexOf('\n}', start) + 2);
function deferred() {let resolve, reject; const promise = new Promise((a,b) => {resolve=a; reject=b;}); return {promise,resolve,reject};}
function fixture() {
  const doc = documentFixture(), root = doc.createElement('section'), questions = doc.createElement('section'), questionList = doc.createElement('div');
  questionList.className = 'project-open-question-list'; questions.append(questionList);
  let project = {id:'one'}, identity = 1, current = true;
  const notes = [], foundations = [], resolutions = [], opens = [], views = [];
  const summary = {savedItems: [{sectionID:'101',codeVersion:'2022',codePrefix:'MC',blockID:'paragraph',title:'Mechanical',id:'saved-one'}],
    projectSections: [{sectionID:'101',codeVersion:'2022',blockID:'paragraph',folderClientID:'one',id:'link-one'},
      {sectionID:'101',codeVersion:'2022',blockID:'paragraph',folderClientID:'other',id:'foreign-link'}]};
  const context = vm.createContext({document: doc, activeWorkspaceID:'workspace',
    captureAccountRequest: () => identity, isCurrentAccountRequest: value => value === identity,
    workspaceProject: () => project, projectDetailMatches: (a,b) => a?.id === b?.id, projectDetailKey: value => value.id,
    hasCapability: () => true,
    postResearch: (path, values) => {assert.equal(path,'/notebook/cards/list'); assert.equal(values.projectID,'one'); const next=deferred(); notes.push(next); return next.promise;},
    loadInitialProjectFoundation: () => {const next=deferred(); foundations.push(next); return next.promise;},
    currentContentSummary: () => summary, savedEvidenceKey: item => [item.codeVersion,item.sectionID,item.blockID].join(':'),
    projectSectionBelongsToProject: (item,p) => item.folderClientID === p.id,
    resolveSectionDetail: detail => {resolutions.push(detail); return Promise.resolve({section:{sectionNumber:'101.4.3',title:'Mechanical',blocks:[{id:'paragraph',plainText:'Selected mechanical paragraph'}]}});},
    stripLeadingSectionNumber: value => value, normalizeAnnotationBlockID: value => value || '', annotatedBlocksForSection: section => section.blocks, sectionPlainText: () => 'Whole section',
    switchWorkflowView: async view => views.push(view),
    openProjectSavedSection: async (_p, item) => opens.push(['passage',item.sectionID]),
    openNotebookNoteColumn: async (_p, item) => opens.push(['note',item.id]),
    openResearchConversation: async id => opens.push(['conversation',id]), showWebNotice: async () => assert.fail('Unexpected error')
  });
  vm.runInContext(actual, context);
  return {root, questions, questionList, notes, foundations, resolutions, opens, views, summary, context,
    render: () => context.renderProjectSavedWork(root,{id:'one'},()=>current,questions),
    changeProject: () => {project={id:'other'};}, changeAccount: () => identity++, dispose: () => {current=false;}};
}
const cards=[{id:'note-one',title:'Review',plainText:'Saved note text',openQuestions:[{text:'Confirm the occupancy',status:'open'},{text:'Resolved item',status:'resolved'}]}];
const conversations=[{id:'conversation-one',title:'Scope discussion'}];
const settle = async f => {f.notes.at(-1).resolve({cards}); f.foundations.at(-1).resolve({researchConversations:conversations});};
const f=fixture(), rendering=f.render(); await settle(f); await rendering; await new Promise(resolve=>setImmediate(resolve));
assert.equal(f.root.children[0].children[0].textContent,'Passages · 1', 'Project links join surviving saved items and exclude other projects.');
assert.equal(f.resolutions[0].codePrefix,'MC'); assert.equal(f.resolutions[0].codeVersion,'2022');
assert.equal(f.questionList.children.length,1); assert.equal(f.questionList.children[0].attributes['aria-label'],'Confirm the occupancy');
const passage=f.root.children[0].querySelector('button');
assert.match(passage.attributes['aria-label'],/MC · 101.4.3 · Mechanical/);
assert.equal(passage.children[1].textContent,'Selected mechanical paragraph','A paragraph bookmark does not preview unrelated section text.');
passage.dispatch('click'); await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(f.views,['research']); assert.deepEqual(f.opens,[['passage','101']]);
const note=f.root.children[1].querySelector('button'); note.dispatch('click'); await new Promise(resolve=>setImmediate(resolve));
assert.equal(f.views.at(-1),'notebook'); assert.deepEqual(f.opens.at(-1),['note','note-one']);
f.questionList.children[0].dispatch('click'); await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(f.opens.at(-1),['note','note-one']);
f.root.children[2].querySelector('button').dispatch('click'); await new Promise(resolve=>setImmediate(resolve));
assert.equal(f.views.at(-1),'research'); assert.deepEqual(f.opens.at(-1),['conversation','conversation-one']);
for (const invalidate of [f=>f.changeProject(),f=>f.changeAccount(),f=>f.dispose(),f=>{f.context.activeWorkspaceID='other';}]) {
  const stale=fixture(), pending=stale.render(); invalidate(stale); await settle(stale); await pending;
  assert.equal(stale.root.children.length,1); assert.equal(stale.root.children[0].textContent,'Loading saved work…');
  assert.equal(stale.questionList.children.length,0,'Stale responses cannot cross project, account, workspace or disposed screen boundaries.');
}
const concurrent=fixture(), older=concurrent.render(), newer=concurrent.render();
await settle(concurrent); await newer;
concurrent.notes[0].resolve({cards:[{id:'old',title:'Old response'}]}); concurrent.foundations[0].resolve({researchConversations:[]}); await older;
assert.equal(concurrent.root.children[1].querySelector('strong').textContent,'Review','An older overview response never replaces the latest collection.');
const failure=fixture(), partial=failure.render(); failure.notes[0].reject(new Error('Offline')); failure.foundations[0].resolve({researchConversations:conversations}); await partial;
assert.ok(failure.root.children.some(node=>node.textContent.includes('Notes could not be loaded')));
assert.ok(failure.root.children.some(node=>node.querySelector('strong')?.textContent==='Scope discussion'),'One failed collection does not suppress available work.');
console.log('Project overview passed: real project joins, exact passage identity, unresolved note questions, destination routing, partial failure and stale response fences.');
