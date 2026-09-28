import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function extract(name, next) { const a=source.indexOf(`async function ${name}(`), b=source.indexOf(next,a); assert.ok(a>=0 && b>a); return source.slice(a,b); }
const functions=extract("openSourceInReader", "\nfunction removeSectionDetail")+extract("openDeepLinkedSectionInReader", "\nfunction readerMatchesSource");
for (const name of ["openSourceInReader", "openDeepLinkedSectionInReader"]) {
  for (const ready of [true,false]) {
    let resolve;
    const gate = new Promise(done => { resolve=done; });
    const calls=[];
    const c=vm.createContext({
      activeWorkspaceID: "workspace-a", captureAccountRequest: () => 1, isCurrentAccountRequest: () => true,
      state:{readers:[],paneWeights:{}}, resolveReaderSource:async item=>item,
      searchResultDetail:item=>item, readerFieldsForSectionDetail:item=>item,
      normalizeAnnotationBlockID:id=>id||"", readerMatchesSource:()=>false, readerIsClearlyAvailable:()=>false,
      isProAccount:()=>true, newReaderState:fields=>({id:"reader-a",...fields}),
      paneIDForReader:reader=>`reader:${reader.id}`, defaultPaneWidthForID:()=>480,
      appendPaneIfMissing(){}, updateBrowserSectionURL(){}, scheduleContinuitySync(){},saveWorkspaceState(){},
      async transitionWorkspace(){ calls.push("shell"); },
      whenWorkspacePaneReady(id){calls.push(["wait",id]);return gate;},
      revealReaderSourceTarget(){calls.push("reveal");}, alignReaderSectionAfterLayout(){calls.push("align");},
      scrollPaneIntoView(){calls.push("scroll");}
    });
    vm.runInContext(functions,c);
    const pending=c[name]({sectionID:42,codePrefix:"BC"});
    await new Promise(done=>setImmediate(done));
    assert.deepEqual(calls,["shell",["wait","reader:reader-a"]],"Only the requested Reader is awaited before DOM-dependent work");
    resolve(ready);
    await pending;
    assert.deepEqual(calls,ready ? ["shell",["wait","reader:reader-a"],name==="openSourceInReader"?"reveal":"align","scroll"] : ["shell",["wait","reader:reader-a"]]);
  }
}
console.log("Reader target readiness passed: source and deep-link navigation wait selectively, suppress closed/stale targets.");

// Declining enablement must leave the Reader untouched.
{
  const state={readers:[],paneWeights:{}};
  const c=vm.createContext({state,activeWorkspaceID:'a',captureAccountRequest:()=>1,isCurrentAccountRequest:()=>true,resolveReaderSource:async()=>null});
  vm.runInContext(functions,c);
  await c.openDeepLinkedSectionInReader({sectionID:42});
  assert.equal(state.readers.length,0);
}
// Metadata arriving after a workspace switch cannot open in the new workspace.
{
  let finish;
  const state={readers:[],paneWeights:{}};
  const c=vm.createContext({state,activeWorkspaceID:'a',captureAccountRequest:()=>1,isCurrentAccountRequest:()=>true,resolveReaderSource:()=>new Promise(resolve=>{finish=resolve;})});
  vm.runInContext(functions,c);
  const pending=c.openDeepLinkedSectionInReader({sectionID:42});
  c.activeWorkspaceID='b';
  finish({sectionID:42});
  await pending;
  assert.equal(state.readers.length,0);
}
assert.ok(!source.includes('api(`/code/sections/${deepLinkedSectionID}`)'), 'Startup must not fetch rich content before source preflight');
console.log('Deep-link cancellation and stale workspace guards passed.');

// The detail heading must reveal the linked Reader horizontally after its own
// readiness gate, without replacing an unrelated occupied Reader.
function actualFunction(name, async = false) {
  const start = source.indexOf(`${async ? 'async ' : ''}function ${name}(`);
  const end = source.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
const headingStart = source.indexOf('  heading.addEventListener("click", async () => {');
const headingEnd = source.indexOf('\n  });', headingStart);
assert.ok(headingStart >= 0 && headingEnd > headingStart, 'Actual detail heading listener found');
const headingHandler = source.slice(headingStart, headingEnd + '\n  });'.length);
for (const ready of [true, false]) {
  const calls=[];
  let handler, finish;
  const gate=new Promise(resolve=>{finish=resolve;});
  const occupied={id:'occupied',chapterID:'original-chapter',targetSectionID:99};
  const occupiedBefore=JSON.stringify(occupied);
  const state={readers:[occupied],searchLinkedReaders:{}};
  const linkedPane={getBoundingClientRect:()=>({left:1304,right:1904,width:600})};
  const track={scrollLeft:0,scrollWidth:1904,clientWidth:1280,
    querySelector(selector){assert.match(selector,/reader:linked/);return linkedPane;},
    getBoundingClientRect:()=>({left:0,right:1280}),
    scrollTo(options){calls.push(['scroll',options.left,options.behavior]);this.scrollLeft=options.left;}
  };
  const c=vm.createContext({state,track,CSS:{escape:id=>id},
    heading:{addEventListener(type,fn){assert.equal(type,'click');handler=fn;}},
    searchID:'search-a',detail:{sectionID:42,chapterID:'target-chapter'},chapter:null,
    sectionPayload:{sectionNumber:'403.2.3.3',title:'Concrete and masonry walls'},
    updateLinkedReaderForSearch:()=>null,isProAccount:()=>true,
    readerFieldsForSectionDetail:(detail,overrides)=>({...detail,...overrides}),
    newReaderState:fields=>({id:'linked',...fields}),searchLinkedReadersBySearch:()=>state.searchLinkedReaders,
    placeLinkedReaderAfterSectionDetail:(searchID,id)=>calls.push(['place',searchID,id]),
    paneIDForReader:reader=>`reader:${reader.id}`,saveWorkspaceState:()=>calls.push('save'),
    transitionWorkspace:async(type,options)=>calls.push(['shell',type,...options.refreshPaneIDs]),
    whenWorkspacePaneReady:id=>{calls.push(['wait',id]);return gate;},
    revealReaderSourceTarget:(reader,detail)=>calls.push(['reveal',reader.id,detail.sectionID]),
    paneIsCollapsed:()=>false
  });
  vm.runInContext(actualFunction('openOrUpdateLinkedReaderForSearch',true)+'\n'+actualFunction('scrollPaneIntoView')+'\n'+headingHandler,c);
  const pending=handler();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,[['place','search-a','linked'],'save',['shell','utility','reader:linked'],['wait','reader:linked']]);
  assert.equal(track.scrollLeft,0,'No horizontal reveal before target readiness');
  assert.equal(state.readers[0],occupied);
  assert.equal(JSON.stringify(occupied),occupiedBefore,'Occupied Reader contents stay unchanged');
  assert.equal(state.searchLinkedReaders['search-a'],'linked');
  finish(ready);await pending;
  // Immediate horizontal reveal avoids interference from concurrent vertical passage alignment.
  assert.deepEqual(calls.slice(4),ready ? [['reveal','linked',42],['scroll',624,'auto']] : []);
  assert.equal(track.scrollLeft,ready ? 624 : 0);
  assert.equal(state.readers[0],occupied);
}
console.log('Detail heading actual handler waits for linked Reader, scrolls offscreen destination into view, and preserves occupied Reader.');
