// Exercise the same DOM Range and CSS Custom Highlight APIs used by the Reader.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {coalesceQueuedReaderSelection, mergeReaderExcerptFields} from '../public/reader-evidence-selection.js';
const app = await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const state = {syncOutbox:[], localProjectSections:[]};
const account = {userID:'test', sessionToken:'test'};
const remote = {id:'link', sectionID:1, userID:'test', selectedExcerpts:['old'], selectedExcerptOccurrences:{old:[0]}};
const sync = vm.createContext({
  state, coalesceQueuedReaderSelection, mergeReaderExcerptFields, activeAccount:() => account,
  requirePrivateWorkspaceWritable(){}, captureAccountRequest(){}, requireCurrentAccountRequest(){},
  hasCapability:() => true, savedEvidenceKey:item => item.sectionID, projectSectionBelongsToProject:() => true,
  currentContentSummary:() => ({projectSections:state.localProjectSections.length ? state.localProjectSections : [remote]}),
  projectSectionRecordForSection:(project,payload) => ({...payload,id:'link',userID:'test'}),
  projectSectionMutationForSection:(project,payload) => ({projectSection:{...payload,id:'link',userID:'test',updatedAt:new Date().toISOString()}}),
  withoutWorkspaceLayoutSync:mutation => mutation, mutationKindAndRecord:mutation => ({record:mutation.projectSection}),
  syncMutationRecordID:mutation => mutation.projectSection.id, saveWorkspaceState(){}, markForegroundSyncActivity(){},
  syncReaderNoteBookmarkButtons(){}, syncSearchResultBookmarkButtons(){}, refreshProjectMembershipPanes:async()=>{},
  pushMutation:async()=>{throw Error('Offline');}, isSessionAuthenticationError:()=>false, refreshProjectSourceConsumers:async()=>{}
});
for (const [start,end] of [['function enqueueSyncMutation(', 'async function pushMutationBatch('],
  ['async function persistSectionInProject(', 'async function persistSectionFolderSelection(']]) {
  vm.runInContext(app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start))),sync);
}
const add = n => sync.persistSectionInProject({}, {sectionID:1, selectedExcerpts:['again'], selectedExcerptOccurrences:{again:[n]}});
const pending = () => state.syncOutbox[0].mutation.projectSection;
await add(0);
assert.deepEqual(state.localProjectSections[0].selectedExcerpts,['old','again']);
assert.deepEqual(pending().selectedExcerpts,['again'],'A stale remote excerpt must never be re-uploaded.');
await add(2);
assert.deepEqual(pending().selectedExcerptOccurrences.again,[0,2]);
const deletedAt = new Date().toISOString();
sync.enqueueSyncMutation({projectSection:{id:'link',userID:'test',updatedAt:deletedAt,deletedAt}},account);
await add(1);
assert.equal(pending().selectionResetAt,deletedAt);
assert(Date.parse(pending().updatedAt) > Date.parse(deletedAt));
assert.deepEqual(pending().selectedExcerptOccurrences.again,[1]);

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const source = await readFile(new URL('../public/reader-evidence-selection.js',import.meta.url),'utf8');
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || undefined});
try {
  const page = await browser.newPage();
  await page.goto('about:blank');
  const results = await page.evaluate(async code => {
    const {createReaderEvidenceSection, mergeReaderExcerptFields} = await import(URL.createObjectURL(new Blob([code],{type:'text/javascript'})));
    const root = document.createElement('section'); root.className='chapter-section'; document.body.append(root);
    const heading = document.createElement('h3'); heading.textContent='101.1 Lot lines'; root.append(heading);
    const blocks = ['<p>The first lot <em>line</em> is here.</p>', '<p>🪟 The <a>lot</a>\t  line is here. Unique phrase ends</p>', '<p>at the next paragraph.</p>'];
    function block(html) { const p=document.createElement('div');p.innerHTML=html;return p; }
    const evidence=createReaderEvidenceSection(root,heading.textContent,blocks,block);
    root._readerEvidence=evidence;
    evidence.mount(heading,0);
    // The first occurrence is in an unmounted virtual row. Select the second in the DOM.
    const second=block(blocks[1]), third=block(blocks[2]);root.append(second,third);
    evidence.mount(second,2); evidence.mount(third,3);
    const firstWord=second.querySelector('a').firstChild, lastWords=firstWord.parentElement.nextSibling;
    const range=document.createRange();range.setStart(firstWord,0);range.setEnd(lastWords,lastWords.data.indexOf('line')+4);
    const [captured]=evidence.capture(range);
    const show=()=>[...(CSS.highlights.get('reader-saved-evidence')||[])].map(r=>r.toString()).join(' ');
    evidence.update(captured); const exact=show();
    const first=block(blocks[0]);root.insertBefore(first,second);evidence.mount(first,1);
    const located=()=>[...(CSS.highlights.get('reader-saved-evidence')||[])].every(r=>second.contains(r.startContainer));
    const onlySecond=located();
    evidence.update({selectedExcerpts:['lot line','next paragraph']});
    const uniqueOnly=show();
    evidence.update({selectedExcerpts:['lot line'],selectedExcerptOccurrences:{'lot line':[10]}});
    const invalid=show();
    range.setStart(lastWords,lastWords.data.indexOf('Unique'));range.setEnd(third.querySelector('p').firstChild,6);
    const [across]=evidence.capture(range);evidence.update(across);
    const coloredAcross=show();
    evidence.update(captured);
    firstWord.parentElement.replaceChildren(document.createTextNode('lot'));
    await new Promise(resolve=>setTimeout(resolve,0));
    const rebound=show();
    const merged=mergeReaderExcerptFields(captured,{selectedExcerpts:['lot line'],
      selectedExcerptOccurrences:JSON.stringify({'lot line':[0,1]})});
    root.remove(); await new Promise(resolve=>setTimeout(resolve,0));
    const afterRemove = show();
    root.replaceChildren();
    root.dataset.sectionId = '1';
    document.body.append(root);
    const aliases = ['<p>repeat</p>', '<p>101.2 Scope. repeat repeat</p>'];
    const owner = createReaderEvidenceSection(root, '101.1 Title.', aliases, block);
    root._readerEvidence = owner;
    const rows = aliases.map(block);
    root.append(...rows);
    rows.forEach((row,i) => owner.mount(row,i+1));
    owner.update({}, [{label:'101.2 Scope.', payload:{sectionID:2}, record:{
      selectedExcerpts:['repeat'], selectedExcerptOccurrences:{repeat:[1]}
    }}]);
    const target = rows[1].firstChild.firstChild;
    const pos = target.data.lastIndexOf('repeat');
    const marked = [...CSS.highlights.get('reader-saved-evidence')];
    const aliasPaint = marked.length === 1 && marked[0].startContainer === target && marked[0].startOffset === pos;
    range.setStart(target, pos); range.setEnd(target, pos+6);
    const aliasSave = owner.capture(range, {sectionID:1});
    range.setStart(rows[0].firstChild.firstChild, 0);
    const split = owner.capture(range,{sectionID:1});
    const aliasDestination = owner.firstTarget(2) === rows[1] && !owner.firstTarget(1);
    return {captured,exact,onlySecond,uniqueOnly,invalid,across,coloredAcross,rebound,merged,afterRemove,
      aliasSave,aliasPaint,split,aliasDestination};
  },source);
  assert.deepEqual(results.captured,{selectedExcerpts:['lot line'],selectedExcerptOccurrences:{'lot line':[1]}});
  assert.equal(results.exact,'lot line');
  assert.equal(results.onlySecond,true);
  assert.equal(results.uniqueOnly,'next paragraph');
  assert.equal(results.invalid,'');
  assert.equal(results.across.selectedExcerpts[0],'Unique phrase ends at the');
  assert.equal(results.coloredAcross,'Unique phrase ends at the');
  assert.equal(results.rebound,'lot line');
  assert.deepEqual(results.merged.selectedExcerptOccurrences,{'lot line':[0,1]});
  assert.equal(results.afterRemove,'');
  assert.equal(results.aliasPaint,true);
  assert.equal(results.aliasDestination,true);
  assert.deepEqual(results.aliasSave,[{sectionID:2,selectedExcerpts:['repeat'],selectedExcerptOccurrences:{repeat:[1]}}]);
  assert.deepEqual(results.split.map(record => [record.sectionID,record.selectedExcerpts[0]]),[
    [1, 'repeat'], [2, '101.2 Scope. repeat repeat']
  ]);
  console.log('Evidence selection passed across virtual rows, inline links, catalog subsections and multiple paragraphs. Legacy ambiguity, queue coalescing, stale-device saves and delete/re-save passed.');
} finally { await browser.close(); }
