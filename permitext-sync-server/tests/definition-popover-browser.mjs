import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const html=`<!doctype html><html><head><meta charset="utf-8"><title>Definition pop-up verification</title><link rel="stylesheet" href="/reader-definition-popover.css"><style>body{background:#080b10;color:#eee;font:18px/1.7 Georgia;padding:48px;max-width:660px}#results{font:14px system-ui;color:#8ddaa4}a{color:#8cd}p{margin:28px 0}</style></head><body><h1>Definition pop-up verification</h1><output id="results">Checking…</output><main><p id="prose">A fire <strong>wall</strong> separates buildings. The fire wall remains visible.</p><p id="links">An <a href="#source">exit</a> and an exit provide access.</p><p id="safe">An exit is available.</p></main><script type="module">
import {installDefinitionLinks,openDefinitionPopover} from '/reader-definition-popover.js';
const entries=[{id:'wall',term:'FIRE WALL',text:'A wall meeting the applicable requirements.\\n\\nSynthetic browser fixture, not published code.',resolution:'direct',source:{code:'Building Code',bundle:'2022-construction-codes',sectionNumber:'202'}},{id:'exit',term:'EXIT',text:'<img src=x onerror=alert(1)> is plain text in this synthetic security fixture.',resolution:'direct',source:{code:'Building Code',bundle:'2022-construction-codes',sectionNumber:'202'}}];
const checks=[];function check(name,condition){checks.push({name,passed:Boolean(condition)});if(!condition)throw Error(name);}
try{
 const prose=document.querySelector('#prose');const before=prose.textContent;
 check('two matches, including inline emphasis',installDefinitionLinks(prose,entries)===2);
 check('source text unchanged',prose.textContent===before);
 check('emphasis retained',prose.querySelector('button strong')?.textContent==='wall');
 check('idempotent linking',installDefinitionLinks(prose,entries)===0);
 const links=document.querySelector('#links');const anchor=links.querySelector('a');installDefinitionLinks(links,entries);
 check('existing source link preserved',links.querySelector('a')===anchor&&links.querySelectorAll('button').length===1);
 const inline=document.createElement('p');inline.innerHTML='An <a href="#source">exit</a> and an exit. **§<a href="#section">28-401.3</a> Definitions. EXIT. An exit meaning.';document.body.append(inline);
 const inlineText=inline.textContent;installDefinitionLinks(inline,entries);
 check('inline definition heading remains excluded even with a section citation link',inline.querySelectorAll('button').length===1&&inline.textContent===inlineText);
 inline.remove();
 installDefinitionLinks(document.querySelector('#safe'),entries);
 const trigger=document.querySelector('#safe button');const scroll=window.scrollY;
 document.getSelection()?.removeAllRanges();
 trigger.click();
 check('installed click handler opens the definition',trigger.getAttribute('aria-expanded')==='true'&&document.querySelector('[role=dialog]')?.getAttribute('aria-label')==='Definition of exit');
 document.querySelector('.reader-definition-close').click();
 check('installed close handler closes and restores focus',!document.querySelector('[role=dialog]')&&document.activeElement===trigger);
 const template=document.createElement('template');template.innerHTML='<p>An exit remains usable after its Reader panel mounts.</p>';
 const detached=template.content.querySelector('p');
 check('template starts in an inert owner document',detached.ownerDocument!==document);
 installDefinitionLinks(detached,entries);
 const adoptedTrigger=detached.querySelector('button');document.querySelector('main').append(detached);
 check('Reader content adopts the live document',adoptedTrigger.ownerDocument===document);
 adoptedTrigger.click();
 check('installed handler survives template document adoption',adoptedTrigger.getAttribute('aria-expanded')==='true'&&document.querySelector('[role=dialog]')?.getAttribute('aria-label')==='Definition of exit');
 document.querySelector('.reader-definition-close').click();detached.remove();

 const selected=document.createRange();selected.selectNodeContents(document.querySelector('#prose'));
 document.getSelection()?.addRange(selected);
 trigger.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));
 check('pointer click preserves an active text selection',!document.querySelector('[role=dialog]')&&String(document.getSelection()).length>0);
 document.getSelection()?.removeAllRanges();
 const close=openDefinitionPopover(trigger,[entries[1]]);
 check('definition text treated as text',!document.querySelector('.reader-definition-popover img'));
 check('accessible dialog',document.querySelector('[role=dialog]')?.getAttribute('aria-label')==='Definition of exit');
 close();check('focus restored without scroll',document.activeElement===trigger&&window.scrollY===scroll);
 const registry=await fetch('/reader-definition-registry.json').then(response=>response.json());
 const amendment=registry.books.find(book=>book.bundle==='2026-existing-building-code'&&book.scope==='general').entries.find(entry=>entry.term==='ADDITION');
 const amendmentProse=document.createElement('p');amendmentProse.id='amendment';amendmentProse.textContent='An addition to an existing building.';document.querySelector('main').append(amendmentProse);
 installDefinitionLinks(amendmentProse,[amendment]);
 const closeAmendment=openDefinitionPopover(amendmentProse.querySelector('button'),[amendment]);
 check('amendment definition preserves publication and effective regime',document.querySelector('.reader-definition-source')?.textContent.includes('Local Law 42/2026 §4 (effective with Existing Building Code)'));
 check('amendment definition uses retained wording',document.querySelector('.reader-definition-text')?.textContent===amendment.text);
 closeAmendment();
 const utility=registry.books.find(book=>book.bundle==='2026-existing-building-code'&&book.scope==='general').entries.find(entry=>entry.term==='UTILITY COMPANY OR PUBLIC UTILITY COMPANY');
 const utilityProse=document.createElement('p');utilityProse.id='utility';utilityProse.textContent='A utility company provides service.';document.querySelector('main').append(utilityProse);
 check('published utility alternative is linked',installDefinitionLinks(utilityProse,[utility])===1);
 const closeUtility=openDefinitionPopover(utilityProse.querySelector('button'),[utility]);
 const utilitySource=document.querySelector('.reader-definition-source')?.textContent;
 check('state-law source shows subsection and revision without an internal bundle id',utilitySource.includes('§ 2(23)')&&utilitySource.includes('Revision December 23, 2022')&&!utilitySource.includes('new-york-state-public-service-law'));
 check('state-law definition preserves the jurisdiction exception',document.querySelector('.reader-definition-text')?.textContent===utility.text&&utility.text.includes('other than article 11'));
 closeUtility();
 const temporary=document.createElement('p');temporary.textContent='exit';document.body.append(temporary);installDefinitionLinks(temporary,entries);
 openDefinitionPopover(temporary.querySelector('button'),[entries[1]]);temporary.remove();await Promise.resolve();
 check('reader removal closes detached popup',!document.querySelector('[role=dialog]'));
 document.querySelector('#results').textContent=checks.length+' checks passed. Click a dotted term to inspect the pop-up.';
 document.title='PASS — Definition pop-up verification';
}catch(error){document.querySelector('#results').textContent='FAIL: '+error.message;document.title='FAIL — Definition pop-up verification';}
</script></body></html>`;
const allowed=new Set(['reader-definition-popover.js','reader-definition-popover.css','definition-matcher.js','reader-definition-registry.json']);
const server=createServer(async(req,res)=>{
 const name=new URL(req.url,'http://127.0.0.1').pathname.slice(1);
 if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 if(!allowed.has(name)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',name.endsWith('.json')?'application/json':name.endsWith('.css')?'text/css':'text/javascript');
 res.end(await readFile(new URL('../public/'+name,import.meta.url)));
});
const port=Number(process.env.PORT||8898);
server.listen(port,'127.0.0.1',()=>console.log('Definition fixture: http://127.0.0.1:'+port+'/'));
