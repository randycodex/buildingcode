// Full local app in independent browser profiles, using synthetic fixture data.
// File-store fixture tests the browser's push-only behavior; the companion
// PostgreSQL test verifies actual incremental-query response sizes/dependencies.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const fixture=spawn(process.execPath,[fileURLToPath(new URL('./populated-workspace-performance-fixture.mjs',import.meta.url)),
  '--port',process.env.PERMITEXT_LAYOUT_TEST_PORT || '8876','--profile','small','--keep-alive','true'],{stdio:['ignore','pipe','pipe']});
let output='';
const ready=new Promise((resolve,reject)=>{
  fixture.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/POPULATED_FIXTURE_READY (http[^\s]+)/);if(match)resolve(match[1]);});
  fixture.stderr.on('data',chunk=>{output+=chunk;});
  fixture.once('exit',code=>reject(new Error(`Fixture exited ${code}: ${output.slice(-2000)}`)));
});
let browser;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
  const start=await Promise.race([ready,delay(30000).then(()=>{throw Error('Fixture startup timeout');})]);
  const origin=new URL(start).origin;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const errors=[];
  async function profile(width=1440) {
    const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
    const page=await context.newPage();const requests=[];
    page.on('pageerror',error=>{errors.push(error.message);console.error('Browser error:',error.message);});
    page.on('request',request=>{if(request.method()==='POST')requests.push({path:new URL(request.url()).pathname,body:request.postDataJSON()});});
    await page.route('**/web/app.js?*',route=>route.fulfill({contentType:'text/javascript',body:source+`
      window.layoutTest={state:()=>state,saveWorkspaceState,flushSyncOutbox,queueWorkspaceLayoutSync,loadSyncedContent,
        renderUtilityWorkspace,switchWorkspace,toggleUtilityPane,resizePaneEdgeBy,
        activeWorkspace:()=>activeWorkspaceID,registry:()=>workspaceRegistry,sharedWorkspaceLayout,
        reconcileWorkspaceLayouts,applyPendingWorkspaceLayout,refreshSyncedWorkspaceInPlace,
        setDraft:(key,value)=>researchNewChatDrafts.set(key,value)};`}));
    // Isolated fixture refuses outbound services as well; browser requests are confined here.
    await page.route(url=>!url.toString().startsWith(origin),route=>route.abort());
    await page.goto(start);
    await page.waitForFunction(()=>window.layoutTest?.registry()?.workspaces?.some(item=>item.projectID)).catch(async error=>{console.error('Browser state:',await page.locator('body').innerText());throw error;});
    await page.evaluate(()=>layoutTest.switchWorkspace(layoutTest.registry().workspaces.find(item=>item.projectID).id));
    await page.waitForFunction(()=>document.querySelector('.workspace-panel[data-pane-id]'));
    return {context,page,requests};
  }
  const a=await profile();
  await a.page.evaluate(async()=>{await layoutTest.toggleUtilityPane('search');await layoutTest.toggleUtilityPane('calculator');});
  await a.page.waitForTimeout(2500);
  await a.page.evaluate(()=>layoutTest.flushSyncOutbox({refresh:false}));
  const searchID=await a.page.evaluate(()=>`utility:search:${layoutTest.state().utilityInstances.find(item=>item.key==='search').id}`);
  const before=a.requests.length;
  await a.page.evaluate(id=>{
    document.activeElement?.blur();
    // Exercise the shipped keyboard resize handler and durable save path.
    for(let i=0;i<8;i++)layoutTest.resizePaneEdgeBy(id,10);
    const s=layoutTest.state();s.paneOrder=[id,...s.paneOrder.filter(value=>value!==id)];layoutTest.saveWorkspaceState();
  },searchID);
  await a.page.waitForTimeout(2200);
  const changes=a.requests.slice(before);
  const pushes=changes.filter(request=>request.path==='/sync/push');
  assert.equal(pushes.length,1,JSON.stringify(changes.map(r=>r.path)));
  assert.equal(changes.filter(request=>request.path==='/sync/pull').length,0,'Resize/reorder must not trigger a content pull');
  assert(!changes.some(request=>/^\/(?:projects\/hub|projects\/foundation|notebook|reports)/.test(request.path)),'Resize/reorder must not download project documents');
  assert.equal(Object.keys(pushes[0].body.batch.mutations[0].continuity.values).join(','),'workspaceLayoutsJSON');
  assert(Buffer.byteLength(JSON.stringify(pushes[0].body))<6000);
  const acknowledged=a.requests.length;
  await a.page.evaluate(async()=>{layoutTest.queueWorkspaceLayoutSync();await layoutTest.flushSyncOutbox({refresh:true});});
  assert.equal(a.requests.slice(acknowledged).filter(r=>r.path==='/sync/push').length,0,'An acknowledged layout is not resent before the next pull');
  const expected=await a.page.evaluate(()=>layoutTest.sharedWorkspaceLayout(layoutTest.state()));
  assert.equal(expected.paneOrder[0],searchID);
  const b=await profile();
  await b.page.waitForTimeout(1500);
  const restored=await b.page.evaluate(()=>layoutTest.sharedWorkspaceLayout(layoutTest.state()));
  assert.deepEqual(restored,expected,'A fresh independent browser restores open columns, order and widths');
  const width=await b.page.locator(`[data-pane-id="${searchID}"]`).first().evaluate(element=>element.getBoundingClientRect().width);
  assert(Math.abs(width-expected.paneWeights[searchID])<2,`${width} versus ${expected.paneWeights[searchID]}`);
  await b.page.screenshot({path:process.env.PERMITEXT_LAYOUT_SCREENSHOT || '/tmp/permitext-layout-sync-restored.png'});
  const responsiveStart=b.requests.length;
  await b.page.setViewportSize({width:390,height:844});
  await b.page.waitForTimeout(1800);
  assert.equal(await b.page.evaluate(id=>layoutTest.state().paneWeights[id],searchID),expected.paneWeights[searchID],'Narrow screens preserve the shared preferred width');
  assert.equal(b.requests.slice(responsiveStart).filter(r=>r.path==='/sync/push').length,0,'Viewport changes do not upload layouts');
  await b.page.screenshot({path:'/tmp/permitext-layout-sync-mobile.png'});
  await b.page.setViewportSize({width:1440,height:1000});
  const unchanged=b.requests.length;
  await b.page.evaluate(()=>{for(let i=0;i<5;i++)layoutTest.saveWorkspaceState();});
  await b.page.waitForTimeout(1800);
  assert.equal(b.requests.slice(unchanged).filter(r=>r.path==='/sync/push').length,0,'Unchanged saves send no layout traffic');
  // Warm a fitted layout in a different Project before returning. This is
  // the production case missed by a fresh-profile restore-only test.
  for (const session of [a,b]) {
    await session.page.evaluate(async()=>{
      const target=layoutTest.activeWorkspace();
      const other=layoutTest.registry().workspaces.find(item=>item.projectID && item.id!==target);
      await layoutTest.switchWorkspace(other.id);
      if(!layoutTest.state().utilityInstances.some(item=>item.key==='search')) await layoutTest.toggleUtilityPane('search');
      await layoutTest.switchWorkspace(target);
      await layoutTest.switchWorkspace(other.id);
      await layoutTest.switchWorkspace(target);
    });
    const restoredWidth=await session.page.locator(`[data-pane-id="${searchID}"]`).first().evaluate(element=>element.getBoundingClientRect().width);
    assert(Math.abs(restoredWidth-expected.paneWeights[searchID])<2,'Project switching preserves the rendered preferred Search width');
  }
  // Local drafts survive an incoming presentation record; content never enters its payload.
  await b.page.evaluate(()=>{layoutTest.setDraft('local','Do not upload this draft');layoutTest.saveWorkspaceState();});
  await a.page.evaluate(()=>layoutTest.toggleUtilityPane('calculator'));
  await a.page.waitForTimeout(2000);
  // Explicit pull uses the fixture's file-store implementation; production SQL
  // delta shape is tested separately with the actual repository.
  await b.page.evaluate(async()=>{await layoutTest.loadSyncedContent({force:true});await layoutTest.refreshSyncedWorkspaceInPlace({accountUserID:layoutTest.state().account.userID});});
  const remote=await b.page.evaluate(()=>({calculator:layoutTest.state().utilities.calculator,draft:layoutTest.state().researchViewState.drafts.local}));
  assert.equal(remote.calculator,false,'Remote closing is applied');
  assert.equal(remote.draft,'Do not upload this draft');
  // Offline changes persist in the durable account catalog and queue, then retry.
  await b.context.setOffline(true);
  await b.page.evaluate(()=>layoutTest.toggleUtilityPane('calculator'));
  await b.page.waitForTimeout(1800);
  assert(await b.page.evaluate(()=>layoutTest.state().syncOutbox.some(item=>item.mutation.continuity?.values.workspaceLayoutsJSON)));
  await b.context.setOffline(false);
  await b.page.evaluate(()=>layoutTest.flushSyncOutbox({refresh:true}));
  assert.equal(await b.page.evaluate(()=>layoutTest.state().syncOutbox.length),0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,layoutPushes:pushes.length,resizeEvents:8,layoutPushBytes:Buffer.byteLength(JSON.stringify(pushes[0].body)),contentPullsAfterResize:0,projectDownloadsAfterResize:0,
    checks:['independent browser restore','open columns/order/rendered width','repeated Project switching in both profiles','unchanged suppression','remote close','local draft preservation','offline retry'],screenshot:'/tmp/permitext-layout-sync-restored.png'},null,2));
} finally {
  await browser?.close();fixture.kill('SIGTERM');
}
