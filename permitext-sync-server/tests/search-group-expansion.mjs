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

// Narrow section-number lookup takes the exact section's source, not the first edition.
const exact = make('403.2.3.3');
assert.equal(apply(exact, [current, historical], all), true);
assert.deepEqual(keys(exact), ['BC|2014']);
// Broad lookup follows existing server result ranking without silently filtering results.
const broad = make();
const matches = [mechanical, historical, current];
const original = JSON.stringify(matches);
apply(broad, matches, all);
assert.deepEqual(keys(broad), ['MC|2022']);
assert.equal(JSON.stringify(matches), original);
// Remembered represented choices take precedence, including multiple explicit expansions.
const remembered = make('concrete', ['BC|2014', 'MC|2022']);
apply(remembered, [current, historical, mechanical], all);
assert.deepEqual(keys(remembered), ['BC|2014', 'MC|2022']);
// Unrepresented remembered choices remain available; one useful fallback opens now.
const absent = make('concrete', ['PC|2014']);
apply(absent, [current, historical], all);
assert.deepEqual(keys(absent), ['PC|2014', 'BC|2022']);
// User closes every group; same-query pagination, retry and persisted reload stay closed.
broad.expandedResultSources = [];
broad.defaultExpandedResultSource = "";
assert.equal(apply(broad, [current], all), false);
const restored = reload(broad);
context.normalizeSearchInstance(restored);
assert.equal(apply(restored, matches, all), false);
assert.deepEqual(keys(restored), []);
// Empty first pages do not consume the decision; first nonempty page does.
const empty = make();
assert.equal(apply(empty, [], all), false);
assert.equal(empty.searchExpansionDecisionKey, '');
assert.equal(apply(empty, [historical], all), true);
assert.equal(apply(empty, [current], all), false);
assert.deepEqual(keys(empty), ['BC|2014']);
// Query and enabled-source scope changes allow a fresh choice; context token changes do not.
restored.query = 'steel';
assert.equal(apply(restored, [current], all), true);
restored.expandedResultSources = [];
restored.defaultExpandedResultSource = "";
assert.equal(apply(restored, [current], { ...all, token: { epoch: 999 } }), false);
const scoped = { querySuffix: '&sourceScope=historical-only' };
assert.equal(apply(restored, [historical], scoped), true);
assert.deepEqual(keys(restored), ['BC|2014']);
// Automatic choices never accumulate as remembered user preferences across queries.
const fresh = make();
apply(fresh, [current], all);
assert.deepEqual(Array.from(fresh.expandedResultSources), []);
fresh.query = 'ventilation';
apply(fresh, [mechanical], all);
assert.deepEqual(keys(fresh), ['MC|2022']);
assert.deepEqual(Array.from(fresh.expandedResultSources), []);
assert.equal(reload(fresh).defaultExpandedResultSource, 'MC|2022');
// Existing legacy expansion state migrates without discarding its source preference.
const legacy = context.normalizeUtilityInstances({ utilityInstances: [{ id: 'legacy', key: 'search', query: 'concrete', expandedResultSource: 'BC|2014' }] })[0];
apply(legacy, [current, historical], all);
assert.deepEqual(keys(legacy), ['BC|2014']);
assert.equal(reload(legacy).searchExpansionDecisionKey, legacy.searchExpansionDecisionKey);
// Both actual renderer entry points make the decision before group construction.
assert.match(source, /applyInitialSearchGroupExpansion\(searchInstance, filteredResults, sourceScope\)[\s\S]{0,100}appendSearchResultGroups\(results, filteredResults/);
assert.match(extract('appendSearchLoadMore'), /applyInitialSearchGroupExpansion\(options.searchInstance, nextResults, options.sourceScope\)[\s\S]{0,100}appendSearchResultGroups\(results, nextResults/);
console.log('Search group defaults: exact/broad, remembered sources, empty-page continuation, collapse/reload, pagination, retry, scope changes and legacy persistence passed.');
