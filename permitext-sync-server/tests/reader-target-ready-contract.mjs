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
