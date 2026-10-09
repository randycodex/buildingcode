import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name){const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);}
const refresh=source.slice(source.indexOf('const refreshResearchUsage = createResearchRefresh('),source.indexOf('\nfunction closeCodeQuestionDownstreamPanes'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<main id="track"></main><template id="research"><article><header><div class="panel-actions"></div></header><div class="analysis-content"></div></article></template>');
 await page.addScriptTag({content:`
 let identity='A',activeWorkspaceID='workspace',researchConversationList=[],researchUsage=null,activeResearchConversation=null;
 const state={utilityInstances:[{key:'analysis',id:'one'},{key:'analysis',id:'two'}],researchConversationID:''};
 const researchDraftPaneIDs=new Set(),analysisTemplate=document.querySelector('#research'),requests=[],transitions=[];
 const releaseSurfaceVisibility={researchHistoryManagement:false};
 function activeAccount(){return {userID:identity,sessionToken:identity};}function captureAccountRequest(){return identity;}function isCurrentAccountRequest(value){return value===identity;}function codeQuestionContextChangedError(){return Error('Context changed');}
 function postResearch(path){return new Promise((resolve,reject)=>requests.push({path,resolve,reject}));}
 function paneIDForUtilityInstance(instance){return 'utility:analysis:'+instance.id;}
 function hasCapability(){return true;}function activeProjectIDForCodeQuestions(){return '';}
 function researchConversationPaneIsOpen(){return false;}function renderUtility(template,id){const p=template.content.firstElementChild.cloneNode(true);p.dataset.paneId=id;return p;}
 function selectionModeIconSVG(){return '';}function trashIconSVG(){return '';}function clear(node){node.replaceChildren();}
 function workspaceResearchConversations(){return researchConversationList;}
 function researchConversationHistoryGroups(conversations){return [{id:'today',label:'Today',conversations,collapsible:false}];}
 function researchConversationTitle(value){return value.title;}function researchConversationDate(){return 'Today';}function researchProjectName(){return 'Unassigned';}function researchProjects(){return [];}function researchChevronIconsSVG(){return '';}
 function codeQuestionWorkspaceEnabled(){return false;}function saveWorkspaceState(){}async function transitionWorkspace(mode,options){transitions.push(options);}function researchUsageCopy(value){return value.remaining+' turns left';}function hasAvailableWebResearchTurnPack(){return false;}
 ${actual('createResearchRefresh')} ${refresh} ${actual('renderResearch')}
 `});
 await page.evaluate(async()=>{for(const instance of state.utilityInstances){const pane=await renderResearch(paneIDForUtilityInstance(instance));document.querySelector('#track').append(pane);}});
 assert.equal(await page.getByRole('button',{name:'+ New chat',exact:true}).count(),2,'Both composers are actionable while all requests are held');
 await page.waitForFunction(()=>requests.length===2);
 assert.deepEqual(await page.evaluate(()=>requests.map(x=>x.path).sort()),['/research/conversations/list','/research/usage']);
 await page.evaluate(()=>requests.find(x=>x.path.endsWith('/list')).resolve({conversations:[{id:'saved',title:'Saved history',createdAt:'2026-10-08T12:00:00Z'}]}));
 await page.waitForFunction(()=>document.querySelectorAll('.research-conversation-row').length===2);
 assert.equal(await page.getByRole('button',{name:'+ New chat',exact:true}).count(),2);
 await page.evaluate(()=>requests.find(x=>x.path.endsWith('/usage')).reject(Error('Allowance unavailable')));
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].filter(x=>x.textContent==='Retry allowance').length===2);
 assert.equal(await page.locator('.research-conversation-row').count(),2,'Usage failure does not remove history');
 await page.getByRole('button',{name:'Retry allowance',exact:true}).first().click();
 await page.waitForFunction(()=>requests.length===3);assert.equal(await page.evaluate(()=>requests[2].path),'/research/usage');
 await page.evaluate(()=>requests[2].resolve({usage:{remaining:42}}));await page.getByText('42 turns left').waitFor();
 await page.getByRole('button',{name:'+ New chat',exact:true}).first().click();
 assert.equal(await page.evaluate(()=>researchDraftPaneIDs.has('utility:analysis:one')),true,'New chat works independently of usage/history metadata');
 assert.equal(await page.evaluate(()=>transitions.length),1);
 // A pending pane removed from the workspace cannot publish private content later.
 await page.evaluate(async()=>{identity='B';researchDraftPaneIDs.clear();const pane=await renderResearch('utility:analysis:one');document.querySelector('#track').replaceChildren(pane);});
 await page.waitForFunction(()=>requests.length===5);
 await page.evaluate(()=>{document.querySelector('#track').replaceChildren();requests[3].resolve({conversations:[{id:'secret',title:'Late private history'}]});requests[4].resolve({usage:{remaining:1}});});
 await page.waitForTimeout(30);assert.equal(await page.locator('.research-conversation-row').count(),0);
 assert.deepEqual(errors,[]);
 console.log('Progressive Research browser passed: immediate New chat, two panes share list/usage reads, history precedes usage, usage failure/retry isolates history, closed-pane publication suppressed.');
}finally{await browser.close();}
