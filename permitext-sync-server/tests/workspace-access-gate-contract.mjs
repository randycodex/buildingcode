import assert from 'node:assert/strict';
import { createWorkspaceAccessGate } from '../public/workspace-access-gate.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
{
  const held = deferred(); let calls = 0;
  const gate = createWorkspaceAccessGate({ isCurrent: () => true, verify: () => held.promise });
  gate.subscribe(value => { assert.equal(value, gate); calls++; });
  assert.equal(gate.phase, 'pending'); assert.equal(gate.allowed, false);
  await tick(); assert.equal(calls, 0); assert.equal(gate.allowed, false);
  held.resolve('verified'); assert.equal(await gate.ready, gate);
  assert.equal(gate.phase, 'verified'); assert.equal(gate.allowed, true); assert.equal(calls, 1);
  const unsubscribe = gate.subscribe(() => calls++); unsubscribe(); assert.equal(calls, 2);
}
for (const phase of ['permitted-offline', 'unavailable', 'active', true, undefined]) {
  const gate = createWorkspaceAccessGate({ isCurrent: () => true, verify: () => phase });
  await gate.ready;
  assert.equal(gate.allowed, phase === 'permitted-offline');
  assert.equal(gate.phase, phase === 'permitted-offline' ? phase : 'unavailable');
}
{
  const error = new Error('offline'); let calls = 0;
  const gate = createWorkspaceAccessGate({ isCurrent: () => true, verify: () => { throw error; } });
  gate.subscribe(() => calls++); await gate.ready;
  assert.equal(gate.phase, 'unavailable'); assert.equal(gate.error, error);
  assert.equal(gate.allowed, false); assert.equal(calls, 1);
}
{
  const held = deferred(); let current = true, calls = 0;
  const gate = createWorkspaceAccessGate({ isCurrent: () => current, verify: () => held.promise });
  gate.subscribe(() => calls++); await tick(); current = false; held.resolve('verified');
  await gate.ready;
  assert.equal(gate.allowed, false); assert.equal(gate.phase, 'unavailable'); assert.equal(calls, 0);
  gate.subscribe(() => calls++); assert.equal(calls, 0);
}
{
  let current = true;
  const gate = createWorkspaceAccessGate({ isCurrent: () => current, verify: () => 'verified' });
  await gate.ready; assert.equal(gate.allowed, true);
  current = false; assert.equal(gate.allowed, false);
}
{
  const held = deferred(); let calls = 0;
  const gate = createWorkspaceAccessGate({ isCurrent: () => true, verify: () => held.promise });
  gate.subscribe(() => calls++); await tick(); gate.dispose(); held.resolve('verified');
  await gate.ready;
  assert.equal(gate.phase, 'unavailable'); assert.equal(gate.allowed, false); assert.equal(calls, 0);
  gate.subscribe(() => calls++); assert.equal(calls, 0);
}
{
  let verifies = 0;
  const gate = createWorkspaceAccessGate({ isCurrent: () => true, verify: () => { verifies++; return 'verified'; } });
  gate.dispose(); await gate.ready; assert.equal(verifies, 0);
}
{
  const held = deferred(); let calls = 0;
  const gate = createWorkspaceAccessGate({ isCurrent: () => true, verify: () => held.promise });
  gate.subscribe(() => { throw new Error('observer'); });
  gate.subscribe(async () => { throw new Error('async observer'); });
  gate.subscribe(() => calls++);
  const unsubscribe = gate.subscribe(() => { throw new Error('unsubscribed'); }); unsubscribe();
  held.resolve('verified'); await gate.ready;
  assert.equal(calls, 1); assert.equal(gate.allowed, true);
  gate.subscribe(() => { throw new Error('late observer'); });
  gate.subscribe(async () => { throw new Error('late async observer'); });
  await tick();
}
{
  let calls = 0, verifies = 0;
  const stale = createWorkspaceAccessGate({ isCurrent: () => false, verify: () => { verifies++; return 'verified'; } });
  stale.subscribe(() => calls++); await stale.ready;
  assert.equal(verifies, 0); assert.equal(calls, 0); assert.equal(stale.allowed, false);
  const gate = createWorkspaceAccessGate({ isCurrent: () => true, verify: () => 'verified' });
  const unsubscribe = gate.subscribe(() => calls++); unsubscribe();
  await gate.ready; assert.equal(calls, 0);
  gate.dispose(); assert.equal(gate.phase, 'unavailable'); assert.equal(gate.allowed, false);
}
console.log('workspace access gate contract passed');
