// Browser behavior coverage using shipped handlers/styles and synthetic transport.
// Run with Playwright installed, or PLAYWRIGHT_MODULE_PATH pointing to its entrypoint.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeWorkspaceLayout, captureWorkspaceLayout } from '../public/workspace-state.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const restored = normalizeWorkspaceLayout(captureWorkspaceLayout({
  pinnedPaneID: 'reader:two', paneOrder: ['reader:one', 'reader:two'],
  columnGroups: [{ id: 'group', name: 'Group', paneIDs: ['reader:one', 'reader:two'], collapsed: true }]
}));
assert.equal(restored.pinnedPaneID, 'reader:two');
assert.deepEqual(restored.paneOrder, ['reader:one', 'reader:two']);
assert.equal(restored.columnGroups[0].collapsed, true);
assert.equal(normalizeWorkspaceLayout({ pinnedPaneID: 42 }).pinnedPaneID, '');
assert.equal(normalizeWorkspaceLayout({ pinnedPaneID: 'section:detail:temporary' }).pinnedPaneID, '');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<main class="panel-track" id="panel-track" style="height:700px;width:100%"></main><div id="feedback" role="status"></div>');
  await page.addStyleTag({ content: styles });
  await page.addScriptTag({ content: `
    const track = document.querySelector('#panel-track');
    let state = { paneOrder: ['reader:one','reader:two','reader:three','utility:analysis','research:conversation:b'], paneWeights: {}, collapsedPaneIDs: [], pinnedPaneID: '', utilities: {analysis:true}, utilityInstances: [], researchConversationID: 'a', columnGroups: [{id:'group',name:'Sources',paneIDs:['reader:one','reader:two','reader:three'],collapsed:false}] };
    let activeWorkspaceID = 'workspace', identity = 'account', localWelcomePreviewPending = false, firstUseWelcomeActive = false, detachedProjectWindow = false, pinnedPaneResizeObserver = null, pendingWorkspacePaneRevealID = '', researchConversationPaneOpened = true;
    let activeResearchConversation = {id:'a',title:'Setbacks',primaryProjectID:'',messages:[],sources:[]};
    let researchConversationList = [activeResearchConversation, {id:'b',title:'Egress',primaryProjectID:'',messages:[],sources:[]}];
    let supplementalResearchConversationIDs = ['b'];
    const supplementalResearchConversations = new Map([['b',researchConversationList[1]]]);
    const calls = [], refreshes = [], notices = [];
    let saved, delayEvidence = false, finishEvidence, failEvidence = false;
    function activePaneIDs(){return state.paneOrder;}
    function columnGroupForPane(id){return state.columnGroups.find(g=>g.paneIDs.includes(id));}
    function workspacePrivatePresentationAllowed(){return true;}
    function canGroupColumn(){return true;}
    function saveWorkspaceState(){saved=JSON.parse(JSON.stringify(state));}
    function captureReaderScrollPositions(){return new Map();}
    function restoreReaderScrollPositions(){}
    function closeActiveCustomSelect(){}
    function ensureWorkspacePanelAccessibleName(){}
    function cleanupInactiveWorkboardMounts(){}
    function cleanupInactiveNotebookMounts(){}
    function cleanupInactiveReportDraftMounts(){}
    function bindPaneDragging(){}
    function shouldShowFirstUseWelcome(){return false;}
    function notifyWorkspaceLayoutChange(){}
    function appendReaderMenuControls(){}
    function orderWithPaneStepped(){return null;}
    function refreshPaneDividerValue(){}
    function defaultPaneWidthForID(){return 300;}
    function applyPaneWeight(panel,id){panel.style.flex='0 0 '+(paneIsCollapsed(id)?48:state.paneWeights[id]||360)+'px';}
    function scheduleVisibleReaderScrollIndicatorUpdates(){}
    function captureAccountRequest(){return identity;}
    function isCurrentAccountRequest(value){return value===identity;}
    function activeAccount(){return {userID:identity};}
    function hasCapability(){return true;}
    function researchConversationInWorkspace(c){return c.primaryProjectID==='';}
    function researchCreationProjectID(){return '';}
    function selectedOpenProjectID(){return '';}
    function presentWorkspaceIssue(message,options){document.querySelector('#feedback').textContent=message;notices.push({message,options});}
    async function showWebNotice(title,message){notices.push({title,message});}
    async function startNewResearchFromSelection(selection){calls.push({path:'create',selection});}
    async function transitionWorkspace(mode,options){refreshes.push(options);}
    async function postResearch(path,values){
      calls.push({path,values});
      if(delayEvidence) await new Promise(resolve=>{finishEvidence=resolve;});
      if(failEvidence) throw new Error('Offline');
      return {conversation:{...researchConversationList.find(c=>c.id===values.conversationID),sources:values.selections}};
    }
    ${['orderPanes','paneIDForUtilityInstance','paneIDForResearchConversation','researchConversationPaneIsOpen','researchConversationTitle','paneIsCollapsed','applyPaneCollapsedState','setPaneCollapsed','preparePaneCollapse','prepareColumnGroupControls','openColumnGroupMenu','focusColumnGroupControl','setColumnGroupCollapsed','refreshColumnGroupPresentation','updateCollapsedPaneDividers','togglePinnedPane','refreshPinnedPaneDivider','appendPaneSequence','scrollPaneIntoView','createDivider','resizeAdjacentPanesBy','updateAdjacentDividerValue','singleExpandedDividerEdge','resizePaneEdgeBy','startPaneEdgeResize','startPaneResize','readerSectionResearchSelection','researchSelectionTextFromRange','normalizedPassageAnchorText','openResearchSelectionDestinations','openResearchDestinationMenu','addResearchSelectionToCurrent'].map(actual).join('\n')}
    const panes = state.paneOrder.map((id,index)=>{
      const pane=document.createElement('article');pane.className='workspace-panel';pane.dataset.paneId=id;
      pane.innerHTML='<header><h2>Column '+(index+1)+'</h2><div class="panel-actions"></div></header><div class="body" style="overflow:auto"><textarea>Unsent question '+index+'</textarea><div style="height:1400px"></div></div>';
      track.append(pane);return pane;
    });
    appendPaneSequence(panes);
    panes[1].querySelector('.body').scrollTop=220;
    const retainedDraft=panes[1].querySelector('textarea');
    const section=document.createElement('section');section.className='chapter-section';
    Object.assign(section.dataset,{researchSectionId:'BC-101',researchSectionNumber:'101',researchSectionTitle:'General'});
    section.innerHTML='<div class="annotated-code-block"><p>Only this paragraph.</p><div data-research-selection-exclude="true"><button id="research">Research</button></div></div><div class="annotated-code-block"><p>Another paragraph, not selected.</p></div>';
    panes[0].querySelector('.body').prepend(section);
    const anchor=document.querySelector('#research');
    anchor.onclick=()=>openResearchDestinationMenu(anchor,readerSectionResearchSelection(section,anchor.closest('.annotated-code-block')));
  ` });
  const menu = page.locator('.column-group-menu');
  await page.locator('[data-pane-id="reader:two"] .column-group-menu-button').click();
  await menu.getByRole('menuitem', { name: 'Pin column to left', exact: true }).click();
  assert.equal(await page.evaluate(() => state.pinnedPaneID), 'reader:two');
  assert.equal(await page.evaluate(() => panes[1].querySelector('textarea') === retainedDraft), true);
  assert.equal(await page.evaluate(() => panes[1].querySelector('.body').scrollTop), 220);
  assert.deepEqual(await page.evaluate(() => state.columnGroups[0].paneIDs), ['reader:one','reader:two','reader:three']);
  assert.deepEqual(await page.evaluate(() => state.paneOrder), ['reader:one','reader:two','reader:three','utility:analysis','research:conversation:b']);
  await page.evaluate(() => { track.scrollLeft = 600; });
  await page.waitForTimeout(50);
  assert.ok(Math.abs(await page.evaluate(() => panes[1].getBoundingClientRect().left - track.getBoundingClientRect().left)) < 1, 'Pinned column stays on left while scrolling');
  assert.ok(Math.abs(await page.evaluate(() => document.querySelector('.is-pinned-divider').getBoundingClientRect().left - panes[1].getBoundingClientRect().right)) < 2, 'Pinned divider stays accessible');
  // Scrolling must put ordinary resize handles behind the pinned surface.
  const occluded = await page.evaluate(() => {
    const bounds=panes[1].getBoundingClientRect();
    return [...track.querySelectorAll('.pane-divider:not(.is-pinned-divider)')].map(n=>n.getBoundingClientRect())
      .filter(r=>r.left>bounds.left+10 && r.left<bounds.right-10)
      .map(r=>({x:r.left+0.5,y:bounds.top+400}));
  });
  assert.ok(occluded.length, 'Fixture places another column divider under the pinned column');
  for (const point of occluded) {
    assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('.workspace-panel')?.dataset.paneId,point),
      'reader:two', 'Underlying dividers must neither paint nor receive pointer events over a pinned column');
  }
  const peerWidths = await page.evaluate(() => panes.filter(p=>p!==panes[1]).map(p=>p.getBoundingClientRect().width));
  await page.locator('.is-pinned-divider').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => state.paneWeights['reader:two']), 384);
  assert.deepEqual(await page.evaluate(() => panes.filter(p=>p!==panes[1]).map(p=>p.getBoundingClientRect().width)), peerWidths,
    'Keyboard resize of pinned column must leave scrolling columns unchanged');
  const handle = await page.locator('.is-pinned-divider').boundingBox();
  await page.mouse.move(handle.x+handle.width/2,handle.y+300);
  await page.mouse.down();
  await page.mouse.move(handle.x+handle.width/2+120,handle.y+300,{steps:8});
  await page.mouse.up();
  assert.equal(await page.evaluate(() => state.paneWeights['reader:two']), 504);
  assert.deepEqual(await page.evaluate(() => panes.filter(p=>p!==panes[1]).map(p=>p.getBoundingClientRect().width)), peerWidths,
    'Dragging the pinned edge must resize only that column');

  await page.evaluate(() => setColumnGroupCollapsed(state.columnGroups[0], true));
  assert.equal(await page.locator('[data-pane-id="reader:two"]').isVisible(), true);
  assert.equal(await page.locator('[data-pane-id="reader:two"]').evaluate(n=>n.classList.contains('is-collapsed')), false);
  assert.equal(await page.locator('[data-pane-id="reader:three"]').isVisible(), false);
  await page.evaluate(() => togglePinnedPane(panes[1]));
  assert.equal(await page.evaluate(() => state.pinnedPaneID), '');
  assert.equal(await page.locator('[data-pane-id="reader:two"]').isVisible(), false, 'Unpinned member rejoins collapsed group');
  await page.evaluate(() => {
    setColumnGroupCollapsed(state.columnGroups[0], false);
    track.moveBefore = undefined; // Exercise the older-browser scroll-preserving fallback.
    panes[1].querySelector('.body').scrollTop = 250;
    togglePinnedPane(panes[1]);
  });
  assert.equal(await page.evaluate(() => panes[1].querySelector('.body').scrollTop), 250);
  await page.evaluate(() => togglePinnedPane(panes[3]));
  assert.equal(await page.locator('.workspace-panel.is-pinned').count(), 1);
  assert.equal(await page.evaluate(() => saved.pinnedPaneID), 'utility:analysis');
  await page.evaluate(() => scrollPaneIntoView('reader:one','auto'));
  assert.ok(await page.evaluate(() => panes[0].getBoundingClientRect().left >= panes[3].getBoundingClientRect().right - 1), 'Reveal does not hide destination behind pinned column');
  // Clear the pin for research menu checks; retained source and draft stay mounted.
  await page.evaluate(() => { togglePinnedPane(panes[3]); track.scrollLeft=0; });
  await page.locator('#research').click();
  assert.deepEqual(await menu.getByRole('menuitem').allTextContents(), ['＋ Start new research','Setbacks · Current','Egress']);
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Egress');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => calls.length === 1 && refreshes.length === 1);
  assert.equal(await page.evaluate(() => calls[0].values.conversationID), 'b');
  assert.equal(await page.evaluate(() => calls[0].values.selections[0].selectedText), 'Only this paragraph.');
  assert.equal(await page.evaluate(() => calls[0].values.selections[0].sectionID), 'BC-101');
  assert.equal(await page.evaluate(() => state.researchConversationID), 'a');
  assert.deepEqual(await page.evaluate(() => refreshes[0].refreshPaneIDs), ['research:conversation:b']);
  assert.equal(await page.evaluate(() => panes[4].querySelector('textarea').value), 'Unsent question 4');
  assert.equal(await page.locator('#feedback').textContent(), 'Added to Egress.');
  await page.locator('#research').click();
  await menu.getByRole('menuitem', { name: '＋ Start new research', exact: true }).click();
  assert.equal(await page.evaluate(() => calls.at(-1).path), 'create');
  await page.evaluate(() => { supplementalResearchConversationIDs=[]; });
  await page.locator('#research').click();
  assert.equal(await menu.getByRole('menuitem').count(), 2, 'One current destination plus new research');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#research').getAttribute('aria-expanded'), 'false');
  await page.evaluate(() => { researchConversationPaneOpened=false; });
  await page.locator('#research').click();
  assert.deepEqual(await menu.getByRole('menuitem').allTextContents(), ['＋ Start new research']);
  await page.keyboard.press('Escape');
  // Utility-owned conversations are offered once, scoped to this workspace.
  await page.evaluate(() => {
    state.utilityInstances=[{key:'analysis',id:'extra',conversationID:'b'},{key:'analysis',id:'foreign',conversationID:'foreign'}];
    supplementalResearchConversationIDs=['b','foreign'];
    researchConversationList.push({id:'foreign',title:'Other workspace',primaryProjectID:'other'});
    panes[4].dataset.paneId='utility:analysis:extra';
  });
  assert.deepEqual(await page.evaluate(() => openResearchSelectionDestinations().map(x=>x.id)), ['b']);
  // Failed appends leave the selected conversation and drafts intact and offer retry.
  await page.evaluate(() => { failEvidence=true; });
  const beforeFailure = await page.evaluate(() => refreshes.length);
  await page.locator('#research').click();
  await menu.getByRole('menuitem', { name: 'Egress', exact: true }).click();
  await page.waitForFunction(() => notices.at(-1)?.message==='Offline');
  assert.equal(await page.evaluate(() => refreshes.length), beforeFailure);
  assert.equal(await page.locator('#research').isEnabled(), true);
  await page.evaluate(() => { failEvidence=false; });
  // An in-flight append must not publish into another workspace.
  await page.evaluate(() => { delayEvidence=true; });
  await page.locator('#research').click();
  await menu.getByRole('menuitem', { name: 'Egress', exact: true }).click();
  await page.waitForFunction(() => typeof finishEvidence==='function');
  const refreshCount = await page.evaluate(() => refreshes.length);
  await page.evaluate(() => { activeWorkspaceID='elsewhere'; finishEvidence(); });
  await page.waitForFunction(() => !document.querySelector('#research').disabled);
  assert.equal(await page.evaluate(() => refreshes.length), refreshCount);
  // Closing the pinned column clears the preference instead of pinning a replacement.
  await page.evaluate(() => {
    togglePinnedPane(panes[4]);
    appendPaneSequence(panes.slice(0,4));
  });
  assert.equal(await page.evaluate(() => state.pinnedPaneID), '');
  // Desktop pin preference must not obstruct full-width mobile columns.
  await page.evaluate(() => { activeWorkspaceID='workspace'; togglePinnedPane(panes[1]); });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.notEqual(await page.locator('.is-pinned').evaluate(n=>getComputedStyle(n).position), 'sticky');
  assert.deepEqual(errors, []);
  console.log('Pinned column/group persistence, live DOM/drafts, horizontal scrolling, keyboard resize, reveal, mobile layout, paragraph-only evidence, destination choice, new research and workspace race guards passed.');
} finally { await browser.close(); }
