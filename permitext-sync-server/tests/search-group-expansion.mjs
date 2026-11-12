import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const extract = (name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
const context = vm.createContext({
  defaultSyncCodeVersion: '2022', repeatableUtilityKeys: new Set(['search']),
  normalizeSearchCodeFilters: (value) => Array.isArray(value) ? value : [],
  normalizeSearchHistorySplitRatio: (value) => value,
});
vm.runInContext(['normalizeSearchResultSources', 'newUtilityInstance', 'normalizeUtilityInstances',
  'normalizeSearchInstance', 'applyInitialSearchGroupExpansion'].map(extract).join('\n'), context);
const apply = context.applyInitialSearchGroupExpansion;
const all = { querySuffix: '' };
const current = { codePrefix: 'BC', codeVersion: '2022', sectionNumber: '403.2' };
const historical = { codePrefix: 'BC', codeVersion: '2014', sectionNumber: '403.2.3.3' };
const mechanical = { codePrefix: 'MC', codeVersion: '2022', sectionNumber: '301.1' };
const make = (query = 'concrete', expanded = []) => context.newUtilityInstance('search', {
  id: 'test-search', query, expandedResultSources: expanded,
});
const keys = (instance) => Array.from(new Set([...instance.expandedResultSources, ...(instance.defaultExpandedResultSource ? [instance.defaultExpandedResultSource] : [])]));
const reload = (instance) => context.normalizeUtilityInstances(JSON.parse(JSON.stringify({ utilityInstances: [instance] })))[0];

// Exact, broad, single-edition and partial searches all start collapsed.
const matches = [mechanical, historical, current];
const original = JSON.stringify(matches);
for (const [query, results, scope, edition] of [
  ['403.2.3.3', [current, historical], all, 'all'],
  ['concrete', matches, all, 'all'],
  ['concrete', [current], all, '2022'],
  ['concrete', [current], {querySuffix:'&sourceScope=current-only', enabledSourceCount:1}, 'all'],
  ['concrete', matches, {...all, preferredCodeVersion:'2014'}, 'all'],
  ['concrete', [mechanical, current], {...all, preferredCodeVersion:'2014'}, 'all'],
]) {
  const instance = make(query); instance.searchEdition = edition;
  assert.equal(apply(instance, results, scope), true);
  assert.deepEqual(keys(instance), []);
  assert.equal(apply(instance, [historical], scope), false, 'Later pages never open a group');
}
assert.equal(JSON.stringify(matches), original, 'Results and ranking are unchanged');

// Only explicit user choices survive rerendering and reload, including legacy choices.
const remembered = make('concrete', ['BC|2014', 'MC|2022']);
apply(remembered, matches, all);
assert.deepEqual(keys(remembered), ['BC|2014', 'MC|2022']);
const restored = reload(remembered);
context.normalizeSearchInstance(restored);
assert.equal(apply(restored, matches, all), false);
assert.deepEqual(keys(restored), ['BC|2014', 'MC|2022']);
const absent = make('concrete', ['PC|2014']);
apply(absent, [current, historical], all);
assert.deepEqual(keys(absent), ['PC|2014'], 'An unavailable remembered source never opens a fallback');
const legacy = context.normalizeUtilityInstances({utilityInstances:[{
  id:'legacy', key:'search', query:'concrete', expandedResultSource:'BC|2014'
}]})[0];
apply(legacy, matches, all);
assert.deepEqual(keys(legacy), ['BC|2014']);

// Closing every group remains closed through retry, reload, a new query and scope/mode changes.
remembered.expandedResultSources = [];
assert.equal(apply(remembered, matches, all), false);
const closed = reload(remembered);
for (const [query, scope, mode] of [
  ['concrete', all, 'words'], ['steel', all, 'words'],
  ['steel', {querySuffix:'&sourceScope=historical-only'}, 'words'],
  ['steel', all, 'exact'],
]) {
  closed.query = query; closed.matchMode = mode;
  apply(closed, matches, scope);
  assert.deepEqual(keys(closed), []);
}

// Older automatic previews are retired without discarding manual expansions.
for (const expanded of [[], ['BC|2014']]) {
  const old = make('concrete', expanded);
  old.searchExpansionDecisionKey = JSON.stringify(['visible-matches-v3', 'concrete', [], 'all', '', '2022', 'words']);
  old.defaultExpandedResultSource = 'BC|2022';
  assert.equal(apply(old, matches, all), true);
  assert.equal(old.defaultExpandedResultSource, '');
  assert.deepEqual(keys(old), expanded);
  assert.deepEqual(keys(reload(old)), expanded);
}
const empty = make();
assert.equal(apply(empty, [], all), false);
assert.equal(apply(empty, [historical], all), true);
assert.deepEqual(keys(empty), []);

// Both render paths apply the policy before constructing result groups.
assert.match(source, /applyInitialSearchGroupExpansion\(searchInstance, filteredResults, sourceScope\)[\s\S]{0,100}appendSearchResultGroups\(results, filteredResults/);
assert.match(extract('appendSearchLoadMore'), /applyInitialSearchGroupExpansion\(options.searchInstance, nextResults, options.sourceScope\)[\s\S]{0,100}appendSearchResultGroups\(results, nextResults/);
console.log('Search groups start collapsed: exact/broad/partial results, preferred editions, pagination/retry, query/scope changes, manual choices and legacy preview migration passed.');
