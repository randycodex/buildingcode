import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {codeSourceIdentity,codeSourceKey,createActiveCodeSources} from '../public/active-code-sources.js';
import {defaultSyncCodeVersion, syncCodeVersion} from '../public/sync-identity.js';
import {normalizeWorkspaceLayout,captureWorkspaceLayout} from '../public/workspace-state.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const a=app.search(new RegExp(`(?:async )?function ${name}\\(`));return app.slice(a,app.indexOf('\n}',a)+2);};
const current={canonicalEdition:'2022',jurisdictionID:1,codeID:1,categoryID:1};
const old={...current,canonicalEdition:'2014'},plumbing={...current,categoryID:2};
let token=1, project=null, privateAllowed=true;
const preferences=createActiveCodeSources([plumbing]);
const c=vm.createContext({Set,JSON,Array,encodeURIComponent,codeSourceIdentity,codeSourceKey,
 defaultSyncCodeVersion,syncCodeVersion,workspacePrivatePresentationAllowed:()=>privateAllowed,workspaceProject:()=>project,
 prepareActiveCodeSearchScope:async()=>({querySuffix:'global'}),accountContextChangedError:()=>Error('Changed account'),
 activeCodeSourcesController:{captureContext:()=>token,isCurrent:t=>t===token,ensureCatalog:async()=>{},state:{catalog:[current,old,plumbing],preferences}}});
vm.runInContext(actual('searchPanelSources')+'\n'+actual('prepareSearchPanelScope'),c);
const query={querySourceKeys:[codeSourceKey(old),codeSourceKey(plumbing)]};
const before=JSON.stringify(preferences.disabledSources());
const scope=await c.prepareSearchPanelScope(query);
assert.equal(scope.enabledSourceCount,2);assert.deepEqual(JSON.parse(decodeURIComponent(scope.querySuffix.split('=')[1])).enabledSources,[old,plumbing]);
assert.equal(JSON.stringify(preferences.disabledSources()),before,'Search scope never mutates retired browsing preferences');
assert.equal((await c.prepareSearchPanelScope({querySourceKeys:[]})).enabledSourceCount,0,'Explicit empty is not unrestricted');
assert.equal((await c.prepareSearchPanelScope({})).querySuffix,'global');
assert.equal(scope.preferredCodeVersion,defaultSyncCodeVersion);
project={codeVersion:'2014'};
assert.equal((await c.prepareSearchPanelScope(query)).preferredCodeVersion,syncCodeVersion('2014'));
assert.equal((await c.prepareSearchPanelScope({})).preferredCodeVersion,syncCodeVersion('2014'));
privateAllowed=false;
assert.equal((await c.prepareSearchPanelScope({})).preferredCodeVersion,defaultSyncCodeVersion,'Pending private access never uses private Project preferences');
privateAllowed=true;
const layout=normalizeWorkspaceLayout({utilityInstances:[{id:'s',key:'search',...query}]});
assert.deepEqual(captureWorkspaceLayout(layout).utilityInstances[0].querySourceKeys,query.querySourceKeys);
c.activeCodeSourcesController.ensureCatalog=async()=>{token++;};await assert.rejects(c.prepareSearchPanelScope(query),/Changed account/);
console.log('Search-only scope: exact editions, retired preference independence, explicit empty, reload persistence and stale account guard passed.');

// Exercise the real app restore path, not only the generic layout copy.
c.normalizeSearchCodeFilters=value=>Array.isArray(value)?value:[];
c.normalizeSearchHistorySplitRatio=()=>0.5;
c.normalizeSearchResultSources=value=>Array.isArray(value)?value:[];
c.repeatableUtilityKeys=new Set(['search','saved']);
vm.runInContext(['newUtilityInstance','normalizeUtilityInstances','normalizeSearchInstance'].map(actual).join('\n'),c);
assert.equal(c.newUtilityInstance('search',{id:'default-search'}).matchMode,'words','New Search columns default to all words.');
assert.equal(c.normalizeSearchInstance({}).matchMode,'words','Restoring a missing search mode defaults to all words.');
assert.equal(c.normalizeSearchInstance(null).matchMode,'words','An absent Search instance also defaults to all words.');
for(const selection of [query.querySourceKeys,[],null]) {
 const saved=JSON.parse(JSON.stringify({utilityInstances:[{id:'search-id',key:'search',query:'business areas',matchMode:'exact',querySourceKeys:selection}]}));
 const restored=c.normalizeUtilityInstances(saved)[0];
 assert.equal(restored.id,'search-id');assert.equal(restored.matchMode,'exact');
 assert.equal(JSON.stringify(c.normalizeSearchInstance(restored).querySourceKeys),JSON.stringify(selection),'Actual restore must retain exact, empty and all-enabled scope');
}
console.log('Actual utility-instance creation/restore preserves temporary Search scope, including explicit empty.');
