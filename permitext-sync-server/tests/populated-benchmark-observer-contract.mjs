import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('./populated-workspace-benchmark.js', import.meta.url), 'utf8');
function harness({complete = true, observerSupported = true} = {}) {
  const frames = [], samples = [];
  let mutation, timeout, now = 1, available = true;
  const img = {complete, naturalWidth: 1};
  const editor = {querySelectorAll: selector => selector === 'img' ? [img] : [{}]};
  const notebook = {querySelector: selector => selector === '.notebook-editor-surface' ? editor : {value:'Synthetic Note 1'}, querySelectorAll: () => [{},{},{},{}]};
  const saved = {querySelector: () => ({}), querySelectorAll: () => [{},{},{}]};
  const report = {querySelectorAll: () => Array(8).fill({})};
  const c = vm.createContext({URL, location:{href:'http://localhost/workspace'}, innerWidth:1600,innerHeight:1000,
    document:{currentScript:{src:'http://localhost/fixture/benchmark.js?key=capability'},documentElement:{},visibilityState:'visible',
      querySelector: selector => !available ? null : selector.startsWith('.saved') ? saved : selector.startsWith('.notebook') ? notebook : selector.startsWith('.report') ? report : {}, addEventListener(){}},
    performance:{now:()=>now++,getEntriesByType:()=>[{name:'http://localhost/notebook/cards/get?token=secret'}, {name:'http://localhost/web/app.js?v=secret'}]},
    PerformanceObserver:class {observe(){if(!observerSupported)throw Error('unsupported');}takeRecords(){return [{startTime:1,duration:51}];}disconnect(){}},
    MutationObserver:class {constructor(callback){mutation=callback;}observe(){}disconnect(){}},
    requestAnimationFrame:fn=>frames.push(fn),setTimeout:fn=>{timeout=fn;return 1;},clearTimeout(){},
    fetch:async (_url, options)=>{samples.push(JSON.parse(options.body));return {};}
  });
  vm.runInContext(source,c);
  return {frames,samples,img,mutate:()=>mutation(),timeout:()=>timeout(),setAvailable:value=>available=value};
}
const f = harness();
assert.equal(f.samples.length,0);
f.frames.shift()(); assert.equal(f.samples.length,0);
f.frames.shift()(); assert.equal(f.samples[0].status,'ready');
assert.equal(f.samples[0].longTasks.length,1);
assert.deepEqual(f.samples[0].resourceCounts,{'/notebook/cards/get':1,'/static/*':1});
assert.ok(!JSON.stringify(f.samples).includes('secret'));
const pending = harness({complete:false,observerSupported:false});
assert.equal(pending.frames.length,0);
pending.img.complete=true;pending.mutate();
pending.frames.shift()();pending.setAvailable(false);pending.frames.shift()();
assert.equal(pending.samples.length,0,'Removed panes must not satisfy stale ready milestones');
pending.timeout();assert.equal(pending.samples[0].status,'timeout');
assert.equal(pending.samples[0].longTasksSupported,false);
assert.equal(pending.samples[0].checks.notebook,false);
console.log('Fixture benchmark observer passed: two-frame readiness, current predicates, image decode wait, timeout, sanitized routes and unsupported long-task reporting.');
