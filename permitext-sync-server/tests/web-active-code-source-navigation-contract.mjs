import assert from 'node:assert/strict';
import {createActiveCodeSourceController} from '../public/active-code-source-controller.js';
import {createActiveCodeSourceNavigationGuard} from '../public/active-code-source-navigation.js';
const source={canonicalEdition:'2022',jurisdictionID:1,codeID:1,categoryID:1};
const target=Object.freeze({sectionID:77,canonicalEdition:'2022',blockID:'exact'});
const data=new Map();let writes=0,reads=0,confirmations=0;
const storage={getItem:key=>data.get(key)??null,setItem(key,value){writes++;data.set(key,value)}};
const controller=createActiveCodeSourceController({storage,loadCatalog:async()=>[{...source,title:'Building'}]});
controller.setContext({accountID:'A',sessionID:'1'});
let confirm=async()=>true;
const guard=createActiveCodeSourceNavigationGuard({controller,resolveTarget:async input=>{reads++;assert.equal(input,target);return{target,source}},confirmEnable:input=>{confirmations++;assert.equal(input.target,target);return confirm(input)}});
let result=await guard({target,source});assert.equal(result.target,target);assert.equal(reads,0);assert.equal(writes,0);assert.equal(confirmations,0);
result=await guard({target});assert.equal(reads,1);assert.equal(result.target,target);
controller.update(source,false,controller.captureContext());const before=writes;
confirm=async()=>false;assert.equal(await guard({target,source}),null);assert.equal(writes,before);assert.equal(controller.state.preferences.isEnabled(source),false);
confirm=async()=>true;result=await guard({target,source});assert.equal(result.target,target);assert.equal(controller.isCurrent(result.context),true);assert.equal(writes,before+1);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
for(const mode of ['abort','workspace','account-away-back','reload']) {
 controller.update(source,false,controller.captureContext());
 const pending=deferred();confirm=()=>pending.promise;let workspaceCurrent=true;const abort=new AbortController();const prior=writes;
 const opening=guard({target,source,signal:abort.signal,isCurrent:()=>workspaceCurrent});
 await Promise.resolve();await Promise.resolve();
 if(mode==='abort')abort.abort();
 if(mode==='workspace')workspaceCurrent=false;
 if(mode==='account-away-back'){controller.setContext({accountID:'B',sessionID:'2'});controller.setContext({accountID:'A',sessionID:'1'});}
 if(mode==='reload')controller.reload();
 pending.resolve(true);await assert.rejects(opening);assert.equal(writes,prior);assert.equal(controller.state.preferences.isEnabled(source),false);
 await controller.ensureCatalog();
}
await assert.rejects(guard({target,source:{...source,canonicalEdition:'missing'}}),error=>error.code==='SOURCE_UNAVAILABLE');
const ambiguity=createActiveCodeSourceNavigationGuard({controller,resolveTarget:async()=>{throw Error('ambiguous')}});
await assert.rejects(ambiguity({target}),/ambiguous/);
const missing=createActiveCodeSourceNavigationGuard({controller,resolveTarget:async()=>null});
await assert.rejects(missing({target}),error=>error.code==='SOURCE_UNAVAILABLE');
// Dependencies expose no body transport or Reader mutation; only metadata is called.
assert.equal(reads,1);
console.log('Browser explicit source navigation guard contracts passed');
