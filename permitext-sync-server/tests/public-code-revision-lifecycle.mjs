import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bindPublicCodeRevisionChecks, createPublicCodeRevisionController} from '../public/public-code-revision.js';
import {createWebAppUpdatePrompt} from '../public/web-app-update.js';

class Button extends EventTarget {
  hidden = true;
  attributes = {};
  setAttribute(key, value) { this.attributes[key] = value; }
}
const window = new EventTarget(), document = new EventTarget(), button = new Button();
window.navigator = {onLine:true};
window.setInterval = window.setTimeout = () => assert.fail('Release discovery cannot schedule idle polling');
document.visibilityState = 'visible';
document.body = {inert:false};
let now = 0, requests = 0, latest = 'current', fail = false, reloads = 0;
const updates = createWebAppUpdatePrompt({document, button, currentVersion:'current',
  prepareReload:async()=>true, activate:async()=>{}, location:{reload(){reloads++;}}});
const controller = createPublicCodeRevisionController({now:()=>now, onInvalidate(){}, fetchRevision:async()=>{
  requests++;
  if (fail) throw Error('offline');
  updates.observe(latest);
  return {corpusRevision:'a'.repeat(64),webAppVersion:latest};
}});
const settle = async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const dispose = bindPublicCodeRevisionChecks({window,document,probe:options=>controller.probe(options)});
await settle();assert.equal(requests,1);assert.equal(button.hidden,true);

// A new app release with the same corpus stays undiscovered during idle time.
latest='next';now+=30*60_000;await settle();
assert.equal(requests,1,'Thirty idle minutes do not make a release request');
assert.equal(button.hidden,true);
window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('pageshow'));
document.dispatchEvent(new Event('visibilitychange'));await settle();
assert.equal(requests,2,'Returning through multiple lifecycle events shares one request');
assert.equal(button.hidden,false,'Returning discovers an app release even with an unchanged code corpus');
assert.equal(await updates.reload(),true);assert.equal(reloads,1,'The green update action still activates and reloads');

now+=30_000;window.dispatchEvent(new Event('focus'));await settle();
assert.equal(requests,2,'Repeated focus within the throttle window makes no request');
document.visibilityState='hidden';now+=10*60_000;
window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('pageshow'));
document.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(requests,2);
document.visibilityState='visible';window.navigator.onLine=false;
document.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(requests,2);
window.navigator.onLine=true;const before=controller.generation;
window.dispatchEvent(new Event('online'));await settle();
assert.equal(requests,3);assert.ok(controller.generation>before,'Reconnect still invalidates offline-backed caches');
fail=true;now+=60_001;window.dispatchEvent(new Event('focus'));await settle();
assert.equal(requests,4);assert.equal(controller.revision,'a'.repeat(64),'Failed discovery keeps the last verified corpus');
fail=false;

// Explicit probes bypass the return throttle, including after a failed check.
// The actual SYNC ordering and non-blocking behavior are exercised separately
// in project-update-manual.mjs, including offline/cancel/double-click guards.
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
await controller.probe({force:true});assert.equal(requests,5);
fail=true;await controller.probe({force:true});assert.equal(requests,6);
dispose();now+=60_001;window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));
document.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(requests,6);

assert.match(source,/bindPublicCodeRevisionChecks\(\{window, document, probe:options => publicCodeRevision\.probe\(options\)\}\)/);
assert.doesNotMatch(source,/setInterval\([^\n]*publicCodeRevision\.probe/,'The startup idle revision interval must remain removed');
console.log('Event-based app/code discovery passed: zero idle polling, startup/return coalescing, throttle, hidden/offline guards, reconnect invalidation, unchanged-corpus app update button, and explicit probe after discovery errors.');
