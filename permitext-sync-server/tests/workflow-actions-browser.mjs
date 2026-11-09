// Start a fresh disposable populated-workspace-performance-fixture.mjs server.
import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fixtureURL = new URL(process.env.PERMITEXT_UX_FIXTURE_URL);
assert.equal(fixtureURL.hostname, '127.0.0.1');
const browser = await chromium.launch({headless:true,
  executablePath:process.env.CHROMIUM_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const page = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  page.setDefaultTimeout(15000);
  const errors=[];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(fixtureURL.href);
  await page.getByRole('button',{name:'Choose workspace',exact:true}).click();
  await page.getByRole('menuitemradio',{name:'Synthetic Project 1',exact:true}).click();
  const start=page.getByRole('region',{name:'Research tools'});
  await start.getByRole('button',{name:'Search codes',exact:true}).click();
  await page.locator('.search-panel:visible input[type=search]').waitFor();
  assert.equal(await page.locator('#collapse-readers').isVisible(),false);
  await page.locator('#workspace-actions').click();
  await page.getByRole('menuitem',{name:'Close all columns',exact:true}).click();
  await start.waitFor();
  await start.getByRole('button',{name:'Ask about this project',exact:true}).click();
  await page.locator('.research-question-input:visible').waitFor();
  await page.locator('#workspace-actions').click();
  await page.getByRole('menuitem',{name:'Close all columns',exact:true}).click();
  await start.getByRole('button',{name:'Open a reader',exact:true}).click();
  await page.getByRole('button',{name:'Building Code (2022)',exact:true}).click();
  await page.locator('.reader-panel:visible').waitFor();
  await page.locator('#workspace-actions').click();
  await page.getByRole('menuitem',{name:'Close all columns',exact:true}).click();
  await start.waitFor();
  console.log('Research starting actions and Close all in View options passed.');

  await page.getByRole('button',{name:'Calculator',exact:true}).click();
  const card=page.locator('.occupant-load-card:visible');
  const recent=card.locator('select[aria-label="Recent calculations"]');
  await card.locator('select[aria-label="Function of space"]:not([disabled])').waitFor({state:'attached'});
  assert.equal(await recent.locator('option').count(),1);
  await card.getByRole('button',{name:'New calculation',exact:true}).click();
  await card.getByRole('button',{name:'New calculation',exact:true}).click();
  assert.equal(await recent.locator('option').count(),1);
  await card.locator('select[aria-label="Function of space"]:not([disabled])').waitFor({state:'attached'});
  await card.getByRole('textbox',{name:'Floor area · ft²',exact:true}).fill('450');
  await card.getByRole('button',{name:'New calculation',exact:true}).click();
  assert.equal(await recent.locator('option').count(),2);
  const previous=await recent.locator('option').filter({hasText:'450 ft²'}).getAttribute('value');
  await recent.selectOption(previous,{force:true});
  assert.equal(await card.getByRole('textbox',{name:'Floor area · ft²',exact:true}).inputValue(),'450');
  console.log('Calculator passed: blank reuse, meaningful draft preservation and recognizable area fallback.');

  await page.getByRole('button',{name:'Report',exact:true}).click();
  await page.getByRole('button',{name:'Create PDF version',exact:true}).click();
  const preview=page.locator('.report-export-review:visible');
  await preview.getByText('Synthetic Project 1 · Version 1 saved',{exact:true}).waitFor({timeout:45000});
  const download=page.waitForEvent('download');
  await preview.getByRole('button',{name:'Download PDF',exact:true}).click();
  const file=await download;
  assert.ok((await stat(await file.path())).size>1000);
  console.log('Report passed: Create PDF version, saved-version feedback and actual PDF download.');
  assert.deepEqual(errors,[]);

  // Exercise the shipped consent listener with an instrumented checkout button.
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const begin=source.indexOf('  policyAcceptance.addEventListener("change", () => {');
  assert.ok(begin>=0);
  const handler=source.slice(begin,source.indexOf('\n  });',begin)+6);
  const consent=await browser.newPage();
  await consent.setContent('<label><input id="consent" type="checkbox">Agree to policies</label><button id="checkout" disabled>Upgrade to Pro</button>');
  await consent.addScriptTag({content:`
    const policyAcceptance=document.querySelector('#consent');
    const checkoutButton=document.querySelector('#checkout');
    const upgrade=true;
    window.checkoutClicks=0;
    checkoutButton.addEventListener('click',()=>window.checkoutClicks++);
    function syncAccountState(){checkoutButton.disabled=!policyAcceptance.checked;}
    ${handler}
  `});
  await consent.getByRole('checkbox').check();
  assert.equal(await consent.evaluate(()=>window.checkoutClicks),0);
  assert.equal(await consent.getByRole('button',{name:'Upgrade to Pro'}).isEnabled(),true);
  await consent.getByRole('button',{name:'Upgrade to Pro'}).click();
  assert.equal(await consent.evaluate(()=>window.checkoutClicks),1);
  console.log('Upgrade consent passed: agreement enables the purchase action and checkout requires a separate click.');
} finally {await browser.close();}
