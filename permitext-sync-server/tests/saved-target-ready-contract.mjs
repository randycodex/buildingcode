import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source=await readFile(new URL("../public/app.js",import.meta.url),"utf8");
const start=source.indexOf("async function settleSavedPanelAfterProjectTransition(");
const end=source.indexOf("\nasync function ",start+1);
assert.ok(start>=0&&end>start);
// Stop at the function's actual closing brace rather than including neighboring helpers.
const body=source.slice(start,source.indexOf("\n}\n",start)+3);
for(const scenario of ["delayed", "account-changed", "workspace-changed", "reused"]) {
  let resolve, currentPanel=null;
  const ready=new Promise(done=>{resolve=done;});
  const calls=[];
  const panel={isConnected:true,dataset:{}};
  const c=vm.createContext({
    CSS:{escape:value=>value},
    track:{querySelector(){calls.push("query");return currentPanel;}},
    state:{utilityInstances:[{id:"saved-a",key:"saved"}]},
    paneIDForUtilityInstance:()=>"saved:a",
    whenWorkspacePaneReady(id){calls.push(["wait",id]);return ready;},
    requestAnimationFrame:callback=>callback(),
    async hydrateSavedPanel(){calls.push("hydrate");},
    async refreshSavedPanelInPlace(){calls.push("refresh");return true;}
  });
  vm.runInContext(body,c);
  const task=c.settleSavedPanelAfterProjectTransition("saved:a",scenario==="reused"?panel:null);
  await Promise.resolve();
  assert.deepEqual(calls,[["wait","saved:a"]],"No DOM access or hydration before target publication");
  const cancelled=scenario.endsWith("changed");
  currentPanel=panel;
  resolve(!cancelled);
  assert.equal(await task,!cancelled);
  assert.deepEqual(calls,cancelled?[["wait","saved:a"]]:[["wait","saved:a"],"query",scenario==="reused"?"refresh":"hydrate"]);
}
console.log("Saved target readiness passed: deferred publication, account/workspace cancellation and existing-pane refresh.");
