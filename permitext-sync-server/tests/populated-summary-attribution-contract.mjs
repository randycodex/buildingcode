import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fixtureMeasureSync, summaryAttributionPrelude} from './populated-summary-attribution.mjs';
const stats = {};
let now = 0;
const value = {};
const receiver = {value};
const wrapped = fixtureMeasureSync('test', function(a) {assert.equal(this, receiver);assert.equal(a, 7);return this.value;}, stats, () => now++);
assert.equal(wrapped.call(receiver,7), value);
const failure = new Error('original');
const throwing = fixtureMeasureSync('test', () => {throw failure;}, stats, () => now++);
assert.throws(throwing, error => error === failure);
assert.deepEqual(stats.test,{count:2,totalMs:2,maxMs:1});
const context = vm.createContext({__permitextFixtureSummaryStats:{},performance:{now:()=>now++}});
vm.runInContext(summaryAttributionPrelude()+`
  const result = currentContentSummary(3);
  function currentContentSummary(n) { return projectEvidenceCount(n) + summarizeMutations(n); }
  function projectEvidenceCount(n) { return n; }
  function summarizeMutations(n) { return n * 2; }
  globalThis.result = result;
`, context);
assert.equal(context.result,9);
for (const name of ['currentContentSummary','projectEvidenceCount','summarizeMutations']) assert.equal(context.__permitextFixtureSummaryStats[name].count,1);
assert.equal(context.__permitextFixtureSummaryStats.currentContentSummary.totalMs,5);
console.log('Fixture summary attribution passed: hoisted setup before startup, exact return/throw/receiver, nested inclusive counts.');
