import * as recentViewScope from "../public/recent-view-scope.js";
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { syncCodeVersion, historicalConstructionSyncCodeVersion as historical, defaultSyncCodeVersion as current } from '../public/sync-identity.js';
import { mergeContinuityRecords } from '../continuity-merge.mjs';
import { documentFixture } from './helpers/workflow-dom.mjs';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const opened = [];
const options = [{ prefix: 'AC', label: '2022 Administrative', codeVersion: current }, { prefix: 'AC', label: '2014 Administrative', codeVersion: historical }, { prefix: 'BC', label: 'Building Code' }];
const c = vm.createContext({ ...recentViewScope, activeRecentViewProjectID:()=>"", syncCodeVersion, defaultSyncCodeVersion: current, historicalConstructionSyncCodeVersion: historical, codeOptions: options,
  chapters: [{ id: 1, codePrefix: 'AC', codeSectionID: 3, codeVersion: current, title: 'Wrong edition chapter' }],
  state: { recentlyViewedSections: [] }, swiftReferenceDateSeconds: () => 123,
  codeOptionVersion: option => syncCodeVersion(option.codeVersion),
  recentViewLimit: 50, saveWorkspaceState() {},
  codeOptionFor: (prefix, version) => options.find(o => o.prefix === prefix && o.codeVersion === version),
  codeDisplayLabel: (prefix, version) => `Administrative Code (${version === historical ? '2014' : '2022'} edition)`,
  paneIDForUtilityInstance: i => i.id, openSearchResultDetail: async (...args) => opened.push(args),
  recentlyViewedPreviewHasEnactedText: () => false,
  resolveSectionDetail: async () => { throw new Error('Legacy hydration must not guess a source'); },
  mergeRecentlyViewedDetails: () => false,
});
vm.runInContext(['researchCodeEdition', 'recentViewCodePrefix', 'recentViewSourceVersion', 'recentViewNavigationSource', 'recentViewSourceLabel',
  'recentViewIdentity', 'recentViewEntryForReader', 'openRecentlyViewedInReader', 'hydrateSearchRecentlyViewedEntries'].map(actual).join('\n'), c);
const old = { sectionID: 7, codePrefix: 'AC', codeSectionID: 3, codeSectionName: '2022 Administrative', previewText: '', viewedAt: 1 };
const reader = { ...old, chapterID: 1, codeVersion: historical };
const entry = c.recentViewEntryForReader(reader);
assert.equal(entry.codeVersion, historical);
assert.equal(entry.sourceVersion, historical);
assert.equal(entry.codeSectionName, '2014 Administrative');
assert.equal(entry.chapterTitle, ''); // Same chapter ID in another edition must not be borrowed.
assert.equal(c.recentViewSourceLabel(entry), 'Administrative Code · 2014');
assert.equal(c.recentViewSourceLabel(old), 'AC · Edition not recorded');
assert.notEqual(c.recentViewIdentity(old), c.recentViewIdentity(entry));
assert.notEqual(c.recentViewIdentity({ ...entry, codeVersion: current }), c.recentViewIdentity(entry));
assert.equal(c.recentViewIdentity({ ...old, sourceVersion: '2014 Construction Codes' }), c.recentViewIdentity(entry));
await c.openRecentlyViewedInReader({ id: 'search' }, old);
await c.openRecentlyViewedInReader({ id: 'search' }, { ...old, sourceVersion: historical });
assert.equal(Object.hasOwn(opened[0][0], 'codeVersion'), false);
assert.equal(opened[1][0].codeVersion, historical);
assert.equal(opened[0][0].sectionID, 7);
const legacyHydration = await c.hydrateSearchRecentlyViewedEntries([old]);
assert.equal(legacyHydration[0], old);
assert.match(actual('renderSearchHistory'), /openRecentlyViewedInReader\(instance, entry\)/);
assert.doesNotMatch(actual('renderSearchHistory'), /forceNewReader|search-open-new-reader/);

const record = views => ({ userID: 'test', codeVersion: current, updatedAt: '2026-09-28T00:00:00.000Z', values: { recentlyViewedSectionsJSON: JSON.stringify(views) } });
const views = r => JSON.parse(r.values.recentlyViewedSectionsJSON);
const native = { ...old, sourceVersion: '2014 Construction Codes', viewedAt: 2 };
delete native.codePrefix;
const web = { ...entry, viewedAt: 3 };
const a = record([native, old]);
const b = record([web, { ...entry, sourceVersion: current, codeVersion: current, viewedAt: 4 }]);
const merged = mergeContinuityRecords(a, b);
assert.deepEqual(merged, mergeContinuityRecords(b, a));
assert.equal(views(merged).length, 3); // Alias/native-web merge, but 2014/2022/legacy remain separate.
assert.equal(views(merged).find(v => v.codeVersion === historical).viewedAt, 3);
const families = ['BC68', 'EBC', 'ECC', 'EC', 'FC', 'HMC', 'T24', 'T25', 'T26', 'T28', 'LL'];
const many = record(families.map((codePrefix, index) => ({ ...entry, sectionID: 100 + index, codePrefix, viewedAt: 3 })));
assert.equal(views(mergeContinuityRecords(many, many)).length, families.length);
console.log('Recently Viewed source integrity passed: exact entry/label, native alias, legacy navigation, no guessed hydration, edition-aware commutative merge and additional families.');

for (const [codePrefix, codeSectionName] of [['FC', 'Fire Code'], ['ECC', 'Energy Conservation Code']]) {
  const nativeEntry = { ...entry, sourceVersion: historical, codeSectionName, viewedAt: 2 };
  delete nativeEntry.codePrefix; delete nativeEntry.codeVersion;
  const webEntry = { ...entry, codePrefix, viewedAt: 3 };
  assert.equal(c.recentViewIdentity(nativeEntry), c.recentViewIdentity(webEntry));
  assert.equal(views(mergeContinuityRecords(record([nativeEntry]), record([webEntry]))).length, 1);
}

const unknown = { sectionID: 7, codeSectionName: 'Unrecognized family', sourceVersion: 'specialty-library' };
assert.equal(Object.hasOwn(c.recentViewNavigationSource(unknown), 'codePrefix'), false);
const legacyUnknown = { sectionID: 7, codeSectionName: ' Unknown Family ' };
assert.equal(c.recentViewIdentity(legacyUnknown), c.recentViewIdentity({ ...legacyUnknown, codeSectionName: 'unknown family' }));

assert.equal(c.recentViewSourceLabel({ ...entry, codeVersion: 'unknown-explicit-edition' }), 'AC · Source details unavailable');
// Run the actual preview merger: matching edition enriches, other editions and
// unresolved legacy retain their own text even when numeric section IDs overlap.
vm.runInContext(actual('mergeRecentlyViewedDetails'), c);
c.state.recentlyViewedSections = [
  { ...entry, previewText: '' },
  { ...entry, codeVersion: current, sourceVersion: current, previewText: 'Current edition text' },
  { ...old, previewText: 'Legacy text' },
];
assert.equal(c.mergeRecentlyViewedDetails([{ ...entry, previewText: 'Historical enacted text' }]), true);
assert.equal(c.state.recentlyViewedSections.length, 3);
assert.deepEqual(Array.from(c.state.recentlyViewedSections, item => item.previewText),
  ['Historical enacted text', 'Current edition text', 'Legacy text']);
console.log('Unknown edition labeling and actual cross-edition preview merge isolation passed.');

// Visit timestamps use the native epoch and calendar days, including DST.
const timeContext=vm.createContext({Date,Intl});
vm.runInContext(['recentViewTimestamp','recentViewHistoryGroups','recentViewTimePresentation','researchHistoryDayIndex'].map(actual).join('\n'),timeContext);
const stamp=date=>(date.getTime()-Date.UTC(2001,0,1))/1000;
const oldTZ=process.env.TZ;
process.env.TZ='America/New_York';
try {
  const now=new Date(2026,10,16,12);
  const visits=[
    {id:'unknown'},
    {id:'yesterday',viewedAt:stamp(new Date(2026,10,15,23,59))},
    {id:'older',viewedAt:stamp(new Date(2025,10,15))},
    {id:'today-old',viewedAt:stamp(new Date(2026,10,16,9))},
    {id:'today-new',viewedAt:stamp(new Date(2026,10,16,11,55))}
  ];
  const before=JSON.stringify(visits);
  assert.equal(JSON.stringify(timeContext.recentViewHistoryGroups(visits,now).map(group=>({label:group.label,ids:group.entries.map(item=>item.id)}))),
    JSON.stringify([{label:'Today',ids:['today-new','today-old']},{label:'Yesterday',ids:['yesterday']},{label:'Earlier',ids:['older','unknown']}]));
  assert.equal(JSON.stringify(visits),before,'Grouping never mutates saved history or source identity');
  assert.equal(timeContext.recentViewTimePresentation(visits[4],now).label,'5m ago');
  assert.equal(timeContext.recentViewTimePresentation(visits[0],now),null,'Missing visit dates never get an invented time');
  assert.match(timeContext.recentViewTimePresentation(visits[2],now).label,/2025/);
  assert.equal(timeContext.recentViewTimePresentation({viewedAt:'not-a-date'},now),null);
  for (const [today,previous] of [
    [new Date(2026,10,2,0,30),new Date(2026,10,1,0,15)],
    [new Date(2026,2,9,0,30),new Date(2026,2,8,0,15)]
  ]) assert.equal(timeContext.recentViewHistoryGroups([{viewedAt:stamp(previous)}],today)[0].label,'Yesterday','DST does not move a visit into the wrong calendar group');
  assert.equal(timeContext.recentViewHistoryGroups([],now).length,0);
} finally {
  if (oldTZ===undefined) delete process.env.TZ; else process.env.TZ=oldTZ;
}

// Render the actual history rows, then follow their original source actions.
const document=documentFixture(),panel=document.createElement('article'),results=document.createElement('div');
results.className='search-results';results.classList={add(){},remove(){}};results.style={removeProperty(){}};
panel.append(results);
const visitEntries=[{...entry,title:'Historical wall rule',sectionNumber:'101.1',previewText:'Historical enacted text',viewedAt:stamp(new Date())},{...old,viewedAt:undefined}];
const original=JSON.stringify(visitEntries);
Object.assign(c,{document,Date,Intl,activeWorkspaceID:'workspace',captureAccountRequest:()=> 'account',isCurrentAccountRequest:()=>true,
  searchRecentlyViewedEntries:()=>visitEntries,clear:node=>node.replaceChildren(),codeTheme:()=> 'administrative',
  sectionDisplayTitle:(number,title)=>`${number} ${title}`,markResearchSelectable(){},
  requestAnimationFrame:callback=>callback(),renderSearchRecentPopover(){},window:{getSelection:()=>''}});
vm.runInContext(['recentViewTimestamp','recentViewHistoryGroups','recentViewTimePresentation','researchHistoryDayIndex','renderSearchHistory'].map(actual).join('\n'),c);
await c.renderSearchHistory(panel,{id:'history',query:''},{hydrate:false});
const row=results.querySelector('.search-jump-open');
assert.equal(row.children[0].textContent,'101.1 Historical wall rule');
assert.equal(row.children[1].querySelector('.search-jump-code').textContent,'Administrative Code · 2014');
assert.equal(row.children[2].textContent,'Historical enacted text');
assert.equal(results.querySelectorAll('.search-jump-open').length,2);
assert.equal(results.querySelectorAll('button').length,2,'Each visit has one action and no extra Reader button');
assert.equal(results.querySelectorAll('time').length,1,'An undated legacy visit has no fabricated time');
assert.deepEqual(results.querySelectorAll('.search-recent-group-heading').map(node=>node.textContent),['Today','Earlier']);
row.dispatch('click');
assert.equal(opened.at(-1)[0].codeVersion,historical);
assert.equal(opened.at(-1)[0].sectionID,entry.sectionID);
assert.equal(JSON.stringify(visitEntries),original);
console.log('Recently Viewed presentation passed: title first, explicit edition, real visit times, calendar groups across DST, retained entries and exact-source actions.');
