import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createActiveCodeSourceController} from '../public/active-code-source-controller.js';
import {createActiveCodeSourceNavigationGuard} from '../public/active-code-source-navigation.js';
import {createActiveCodeSourcePreferences,codeSourceIdentity,codeSourceKey} from '../public/active-code-sources.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const a=app.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(a>=0,name);return app.slice(a,app.indexOf('\n}',a)+2);};
const current={canonicalEdition:'2022',jurisdictionID:1,codeID:1,categoryID:1,codePrefix:'BC'};
const historic={...current,canonicalEdition:'2014'};
const codes=[{prefix:'BC',version:'2022'},{prefix:'BC',version:'2014'}];
for(const accountID of [null,'account']) for(const corrupt of [false,true]) {
 const values=new Map();let writes=0,reads=0;
 const storage={getItem:key=>{reads++;return values.get(key)??null;},setItem:(key,value)=>{writes++;values.set(key,value);}};
 const legacy=createActiveCodeSourcePreferences(storage);
 legacy.updateMany(accountID,[current,historic],false);
 if(corrupt) for(const key of values.keys()) values.set(key,'corrupt legacy preference');
 const original=JSON.stringify([...values]); reads=0;writes=0;
 const c=vm.createContext({createActiveCodeSourceController,localStorage:storage,api:async()=>({codeSources:[current,historic]}),
  codeSourceIdentity,codeSourceKey,accountContextChangedError:()=>Error('Account changed')});
 const start=app.indexOf('activeCodeSourcesController = createActiveCodeSourceController({');
 vm.runInContext('let activeCodeSourcesController;'+app.slice(start,app.indexOf('\n});',start)+4)+
  '\nglobalThis.controller=activeCodeSourcesController;'+['prepareActiveCodeSearchScope','searchPanelSources','prepareSearchPanelScope','enabledReaderBrowseProjection'].map(actual).join('\n'),c);
 c.controller.setContext({accountID,sessionID:'first'});
 assert.equal(reads,0,'The web app must never read retired library filters, including corrupt values');
 assert.equal(c.controller.state.error,null);
 assert.equal((await c.enabledReaderBrowseProjection(codes)).codes.length,2,'Reader always offers current and historical codes');
 const all=await c.prepareSearchPanelScope({querySourceKeys:null});
 assert.equal(all.querySuffix,'','A default Search includes all codes');
 const selected=await c.prepareSearchPanelScope({querySourceKeys:[codeSourceKey(historic)]});
 assert.deepEqual(JSON.parse(decodeURIComponent(selected.querySuffix.split('=')[1])).enabledSources,[codeSourceIdentity(historic)]);
 assert.equal((await c.prepareSearchPanelScope({querySourceKeys:[]})).enabledSourceCount,0);
 const guard=createActiveCodeSourceNavigationGuard({controller:c.controller,confirmEnable:()=>assert.fail('Retired library filters cannot prompt to enable a Reader source')});
 const opened=await guard({target:{sectionID:'historic-section'},source:historic});
 assert.equal(opened.target.sectionID,'historic-section');
 assert.equal(opened.source.canonicalEdition,'2014','Reader navigation keeps the exact edition');
 c.controller.reload();
 assert.equal(c.controller.state.preferences.isEnabled(current),true);
 assert.equal(writes,0);assert.equal(JSON.stringify([...values]),original,'Legacy preferences are ignored without rewriting storage');
 c.controller.setContext({accountID:'another',sessionID:'second'});
 assert.equal(c.controller.isCurrent(opened.context),false,'Account changes still cancel stale navigation');
}
console.log('Web source policy passed: Settings filters retired, old/corrupt preferences ignored, Reader all codes, exact editions, Search-only selection and account cancellation.');
