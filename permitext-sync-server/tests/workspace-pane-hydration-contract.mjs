import assert from 'node:assert/strict';
import { createWorkspacePaneHydrator } from '../public/workspace-pane-hydration.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function fixture() {
  let current = { key: 'account-a/workspace-a', generation: 1 };
  const ready = [], errors = [], discarded = [];
  const hydrator = createWorkspacePaneHydrator({
    isContextCurrent: context => context === current,
    onReady: (job, pane) => ready.push({ job, pane }),
    onError: (job, error) => errors.push({ job, error }),
    onDiscard: (job, pane) => discarded.push({ job, pane }),
  });
  return { hydrator, ready, errors, discarded, get context() { return current; }, set context(value) { current = value; } };
}
const descriptor = (id, load, identity = id) => ({ id, identity, load });

// A slow editor does not hold up a fast reader, and all current jobs settle.
{
  const f = fixture(), slow = deferred();
  let slowSignal;
  f.hydrator.reconcile([
    descriptor('notebook', signal => { slowSignal = signal; return slow.promise; }),
    descriptor('reader', () => 'reader-pane'),
  ], f.context);
  await tick();
  assert.deepEqual(f.ready.map(x => x.pane), ['reader-pane']);
  assert.equal(slowSignal.aborted, false);
  let settled = false;
  const completion = f.hydrator.settled().then(result => { settled = true; return result; });
  await tick();
  assert.equal(settled, false);
  slow.resolve('notebook-pane');
  assert.equal((await completion).length, 2);
  assert.equal(f.ready.length, 2);
}
// Failed loads remain retryable with a fresh job/controller and no replay of peers.
{
  const f = fixture(); let count = 0; const signals = [];
  const load = signal => { signals.push(signal); if (++count === 1) throw new Error('offline'); return 'recovered'; };
  f.hydrator.reconcile([descriptor('search', load)], f.context);
  await f.hydrator.settled();
  assert.equal(f.errors.length, 1);
  assert.equal(f.hydrator.retry('missing'), false);
  assert.equal(f.hydrator.retry('search'), true);
  await f.hydrator.settled();
  assert.equal(signals[0].aborted, true);
  assert.notEqual(signals[0], signals[1]);
  assert.equal(f.ready[0].pane, 'recovered');
  assert.equal(f.hydrator.retry('search'), false);
}
// Same-ID reopening never allows an old completion to attach or dispose its replacement.
{
  const f = fixture(), old = deferred(); let signal;
  f.hydrator.reconcile([descriptor('reader', s => { signal = s; return old.promise; })], f.context);
  await tick();
  f.hydrator.reconcile([], f.context);
  assert.equal(signal.aborted, true);
  f.hydrator.reconcile([descriptor('reader', () => 'new-pane')], f.context);
  await f.hydrator.settled();
  old.resolve('old-pane'); await tick();
  assert.deepEqual(f.ready.map(x => x.pane), ['new-pane']);
  assert.deepEqual(f.discarded.map(x => x.pane), ['old-pane']);
  assert.notEqual(f.discarded[0].job, f.ready[0].job);
}
// Reconciliation adopts a retained pending job into the latest same-account generation.
{
  const f = fixture(), held = deferred(); let loads = 0;
  const d = descriptor('report', () => { loads++; return held.promise; });
  f.hydrator.reconcile([d], f.context); await tick();
  f.context = { key: f.context.key, generation: 2 };
  f.hydrator.reconcile([d], f.context);
  held.resolve('retained'); await f.hydrator.settled();
  assert.equal(loads, 1);
  assert.equal(f.ready[0].job.context, f.context);
  f.hydrator.reconcile([d], f.context); await f.hydrator.settled();
  assert.equal(loads, 1);
}
// Account change replaces jobs even with the same pane identity.
{
  const f = fixture(), held = deferred();
  f.hydrator.reconcile([descriptor('reader', () => held.promise)], f.context); await tick();
  f.context = { key: 'account-b/workspace-a', generation: 2 };
  f.hydrator.reconcile([descriptor('reader', () => 'account-b')], f.context);
  await f.hydrator.settled(); held.resolve('account-a'); await tick();
  assert.deepEqual(f.ready.map(x => x.pane), ['account-b']);
  assert.deepEqual(f.discarded.map(x => x.pane), ['account-a']);
}
// A generation superseded without reconciliation cannot publish.
{
  const f = fixture(), held = deferred();
  f.hydrator.reconcile([descriptor('reader', () => held.promise)], f.context); await tick();
  f.context = { key: f.context.key, generation: 2 };
  held.resolve('stale-generation'); await f.hydrator.settled();
  assert.equal(f.ready.length, 0);
  assert.equal(f.discarded[0].pane, 'stale-generation');
}
// Existing healthy editors are never reconstructed; replacement identity does load.
{
  const f = fixture(); let loads = 0;
  f.hydrator.reconcile([{ ...descriptor('notebook', () => { loads++; }), existing: 'editor-with-draft' }], f.context);
  await f.hydrator.settled();
  assert.equal(loads, 0); assert.equal(f.ready.length, 0);
  f.hydrator.reconcile([descriptor('notebook', () => { loads++; return 'different-notebook'; }, 'other')], f.context);
  await f.hydrator.settled(); assert.equal(loads, 1);
}
// Cancellation before the first microtask avoids starting the request entirely.
{
  const f = fixture(); let loads = 0;
  f.hydrator.reconcile([descriptor('reader', () => { loads++; })], f.context);
  f.hydrator.cancelAll(); await tick();
  assert.equal(loads, 0); assert.deepEqual(await f.hydrator.settled(), []);
}
// Aborted request rejection is silent; observer failures are reported by allSettled.
{
  const f = fixture(), held = deferred();
  f.hydrator.reconcile([descriptor('reader', () => held.promise)], f.context); await tick();
  f.hydrator.cancelAll(); held.reject(new Error('aborted')); await tick();
  assert.equal(f.errors.length, 0);
  const h = createWorkspacePaneHydrator({ isContextCurrent: () => true, onReady: () => { throw new Error('observer'); } });
  h.reconcile([descriptor('reader', () => 'pane')], { key: 'a' });
  assert.equal((await h.settled())[0].status, 'rejected');
}
// Before load begins, the newest retained descriptor supplies its closure.
{
  const f = fixture(); const calls = [];
  f.hydrator.reconcile([descriptor('reader', () => { calls.push('old'); return 'old'; })], f.context);
  f.hydrator.reconcile([descriptor('reader', () => { calls.push('new'); return 'new'; })], f.context);
  await f.hydrator.settled();
  assert.deepEqual(calls, ['new']);
  assert.equal(f.ready[0].pane, 'new');
}
// Once started, a retained load finishes exactly once using its original closure.
// Construction-affecting changes therefore MUST change descriptor.identity.
{
  const f = fixture(), held = deferred(); let replacementCalls = 0;
  f.hydrator.reconcile([descriptor('reader', () => held.promise)], f.context); await tick();
  const next = descriptor('reader', () => { replacementCalls++; return 'replacement'; });
  f.hydrator.reconcile([next], f.context);
  held.resolve('original'); await f.hydrator.settled();
  assert.equal(replacementCalls, 0);
  assert.equal(f.ready[0].pane, 'original');
  assert.equal(f.ready[0].job.descriptor, next);
}
// Externally supplied healthy DOM supersedes a pending load with the same identity.
{
  const f = fixture(), held = deferred(); let oldSignal;
  f.hydrator.reconcile([descriptor('reader', signal => { oldSignal = signal; return held.promise; })], f.context);
  await tick();
  f.hydrator.reconcile([{ ...descriptor('reader', () => { throw new Error('must reuse editor'); }), existing: 'healthy-external-pane' }], f.context);
  assert.equal(oldSignal.aborted, true, 'healthy external replacement cancels a pending load');
  await f.hydrator.settled();
  held.resolve('obsolete-pane'); await tick();
  assert.equal(f.ready.length, 0);
  assert.deepEqual(f.discarded.map(x => x.pane), ['obsolete-pane']);
}
// Healthy external replacement of a ready pane updates ownership without rebuilding.
{
  const f = fixture(); let loads = 0;
  const d = descriptor('reader', () => { loads++; return 'original-pane'; });
  f.hydrator.reconcile([d], f.context); await f.hydrator.settled();
  const originalJob = f.ready[0].job;
  f.hydrator.reconcile([{ ...d, existing: 'original-pane' }], f.context);
  assert.equal(originalJob.status, 'ready', 'reusing our own pane retains its job');
  f.hydrator.reconcile([{ ...d, existing: 'external-pane' }], f.context);
  await f.hydrator.settled();
  assert.equal(originalJob.status, 'cancelled');
  assert.equal(loads, 1); assert.equal(f.ready.length, 1);
  assert.equal(f.discarded.length, 0, 'DOM owner disposes already-published panes');
}
// A load finishing during a generation gap must not leave a dead pending slot.
for (const outcome of ['resolve', 'reject', 'before-start']) {
  const f = fixture(), held = deferred(); let loads = 0;
  const d = descriptor('reader', () => { loads++; return held.promise; });
  f.hydrator.reconcile([d], f.context);
  if (outcome !== 'before-start') await tick();
  f.context = { key: f.context.key, generation: 2 };
  if (outcome === 'resolve') held.resolve('obsolete');
  if (outcome === 'reject') held.reject(new Error('obsolete failure'));
  await f.hydrator.settled();
  f.hydrator.reconcile([descriptor('reader', () => { loads++; return 'current'; })], f.context);
  await f.hydrator.settled();
  assert.equal(loads, outcome === 'before-start' ? 1 : 2);
  assert.deepEqual(f.ready.map(x => x.pane), ['current']);
  assert.equal(f.errors.length, 0);
}
// Cancelling one id preserves peer work and permits same-identity refresh.
{
  const f = fixture(), old = deferred(), peer = deferred(); let signal;
  f.hydrator.reconcile([
    descriptor('reader', s => { signal = s; return old.promise; }),
    descriptor('notebook', () => peer.promise),
  ], f.context); await tick();
  assert.equal(f.hydrator.cancel('reader'), true);
  assert.equal(f.hydrator.cancel('reader'), false);
  assert.equal(signal.aborted, true);
  f.hydrator.reconcile([
    descriptor('reader', () => 'refreshed'),
    descriptor('notebook', () => { throw new Error('peer restarted'); }),
  ], f.context);
  old.resolve('old'); peer.resolve('peer'); await f.hydrator.settled(); await tick();
  assert.deepEqual(f.ready.map(x => x.pane).sort(), ['peer', 'refreshed']);
  assert.deepEqual(f.discarded.map(x => x.pane), ['old']);
  assert.equal(f.hydrator.cancel('reader'), true);
  assert.equal(f.hydrator.cancel('missing'), false);
}
console.log('workspace pane hydration contract passed');
