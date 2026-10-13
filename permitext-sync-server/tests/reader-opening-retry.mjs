import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function refreshReaderContent('),end=source.indexOf('\n}',start);
const actual=source.slice(start,end+2);
for(const [failure,expected] of [[{status:500},2],[{status:503},2],[{status:502},2],[{status:504},2],[{isNetworkFailure:true},2],[{code:'PUBLIC_CORPUS_CHANGED'},2],[{status:404},1],[{status:409},1],[{},1]]){
 let attempts=0,token=0,notices=0;
 const panel={dataset:{},querySelector:()=>({querySelector:()=>({append(){}})}),querySelectorAll:()=>[]};
 const c=vm.createContext({resolvedReaderSourceNavigations:new WeakMap(),workspaceReaderContentIdentity:()=>"identity",
  beginReaderNavigation:()=>panel.dataset.readerNavigationToken=++token,
  applyCodeTheme(){},renderReaderTrust(){},populateCodeSelect(){},resetEnhancedSelects(){},
  populateReaderSelectors:async()=>true,renderSectionContent:async()=>{attempts++;if(attempts===1)throw Object.assign(Error('Synthetic opening failure'),failure);},
  window:{setTimeout:fn=>queueMicrotask(fn)},console:{warn(){}},clear(){},emptyReader(){notices++;},
  document:{createElement:()=>({addEventListener(){}})},enhanceSelect(){},setTitle(){},preparePaneCollapse(){}
 });
 vm.runInContext(actual,c);await c.refreshReaderContent(panel,{chapterID:'chapter',sectionID:'section'});
 assert.equal(attempts,expected);assert.equal(notices,expected===1?1:0);
}
// Closing or superseding the Reader while the retry waits must end the opening.
let attempts=0,finish;
const panel={dataset:{},querySelector:()=>({})};
const c=vm.createContext({resolvedReaderSourceNavigations:new WeakMap(),workspaceReaderContentIdentity:()=>"identity",
 beginReaderNavigation:()=>panel.dataset.readerNavigationToken='opening',applyCodeTheme(){},renderReaderTrust(){},populateCodeSelect(){},resetEnhancedSelects(){},
 populateReaderSelectors:async()=>true,renderSectionContent:async()=>{attempts++;throw Object.assign(Error('Transient'),{status:503});},
 window:{setTimeout:fn=>{finish=fn;}},console:{warn(){}}
});vm.runInContext(actual,c);
const pending=c.refreshReaderContent(panel,{});await new Promise(resolve=>setImmediate(resolve));
panel.dataset.readerNavigationToken='newer-opening';finish();await pending;
assert.equal(attempts,1);
console.log('Cold-opening retries are bounded to transient failures and cancelled by newer navigation.');
