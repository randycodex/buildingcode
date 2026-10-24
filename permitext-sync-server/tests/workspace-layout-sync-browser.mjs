// Full local app in independent browser profiles, with synthetic data only.
// Verify browser-local arrangements and absence of layout push/download traffic.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
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
 async function profile() {
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  const page=await context.newPage(),requests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.method()==='POST')requests.push({path:new URL(request.url()).pathname,body:request.postDataJSON()});});
  await page.route(url=>!url.toString().startsWith(origin),route=>route.abort());
  await page.goto(start);await page.locator('#workspace-actions').filter({hasText:'Synthetic Project 1'}).waitFor();
  await page.locator('#panel-track > .workspace-panel:not(.is-workflow-hidden)').first().waitFor();
  await page.waitForTimeout(1500);
  return {context,page,requests};
 }
 const panes=page=>page.locator('#panel-track > .workspace-panel:not(.is-workflow-hidden)').evaluateAll(elements=>elements.map(e=>({id:e.dataset.paneId,width:Math.round(e.getBoundingClientRect().width)})));
 const a=await profile(),b=await profile();
 const originalB=await panes(b.page);
 await a.page.locator('#toggle-calculator').click();await a.page.locator('[data-pane-id="utility:calculator"]').waitFor();
 const before=a.requests.length;
 for(let i=0;i<4;i++)await a.page.getByRole('separator',{name:'Resize adjacent columns',exact:true}).press('ArrowLeft');
 const expectedA=await panes(a.page);
 await a.page.waitForTimeout(2200);
 const changes=a.requests.slice(before);
 assert.equal(changes.filter(r=>r.path==='/sync/push').length,0,'Resize must not upload any layout');
 assert.equal(changes.filter(r=>r.path==='/sync/pull').length,0,'Resize must not trigger a content pull');
 assert(!changes.some(r=>/^\/(?:projects\/hub|projects\/foundation|notebook|reports)/.test(r.path)),'Resize must not download project documents');
 await b.page.reload();await b.page.locator('#panel-track > .workspace-panel:not(.is-workflow-hidden)').first().waitFor();
 assert.deepEqual(await panes(b.page),originalB,'Another browser keeps its layout after a fresh pull');
 assert.equal(await b.page.locator('#project-update-badge').isVisible(),false,'Layout changes cannot create pending content updates');
 for(const session of [a,b]) {
  const expected=await panes(session.page);
  await session.page.locator('#workspace-actions').click();await session.page.getByRole('menuitemradio',{name:'Synthetic Project 2',exact:true}).click();
  await session.page.locator('#workspace-actions').filter({hasText:'Synthetic Project 2'}).waitFor();
  await session.page.locator('#workspace-actions').click();await session.page.getByRole('menuitemradio',{name:'Synthetic Project 1',exact:true}).click();
  await session.page.locator('#workspace-actions').filter({hasText:'Synthetic Project 1'}).waitFor();
  await session.page.locator('#panel-track > .workspace-panel:not(.is-workflow-hidden)').first().waitFor();
  assert.deepEqual(await panes(session.page),expected,'Project switching preserves each browser’s column identities and widths');
 }
 await a.page.reload();await a.page.locator('[data-pane-id="utility:calculator"]').waitFor();
 assert.deepEqual(await panes(a.page),expectedA,'Own browser reload restores local manual widths');
 assert.deepEqual(errors,[],'The app must start and navigate without runtime errors');
 console.log('Browser-local layouts passed in two independent profiles: no layout traffic, no remote indicator, local widths across reload/project switches, and no runtime errors.');
} finally {
 await browser?.close();fixture.kill('SIGTERM');
}
