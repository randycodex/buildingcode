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
 installDefinitionLinks(document.querySelector('#safe'),entries);
 const trigger=document.querySelector('#safe button');const scroll=window.scrollY;
 const close=openDefinitionPopover(trigger,[entries[1]]);
 check('definition text treated as text',!document.querySelector('.reader-definition-popover img'));
 check('accessible dialog',document.querySelector('[role=dialog]')?.getAttribute('aria-label')==='Definition of exit');
 close();check('focus restored without scroll',document.activeElement===trigger&&window.scrollY===scroll);
 const temporary=document.createElement('p');temporary.textContent='exit';document.body.append(temporary);installDefinitionLinks(temporary,entries);
 openDefinitionPopover(temporary.querySelector('button'),[entries[1]]);temporary.remove();await Promise.resolve();
 check('reader removal closes detached popup',!document.querySelector('[role=dialog]'));
 document.querySelector('#results').textContent=checks.length+' checks passed. Click a dotted term to inspect the pop-up.';
 document.title='PASS — Definition pop-up verification';
}catch(error){document.querySelector('#results').textContent='FAIL: '+error.message;document.title='FAIL — Definition pop-up verification';}
</script></body></html>`;
const allowed=new Set(['reader-definition-popover.js','reader-definition-popover.css','definition-matcher.js']);
const server=createServer(async(req,res)=>{
 const name=req.url?.slice(1);
 if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 if(!allowed.has(name)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',name.endsWith('.css')?'text/css':'text/javascript');
 res.end(await readFile(new URL('../public/'+name,import.meta.url)));
});
server.listen(8898,'127.0.0.1',()=>console.log('Definition fixture: http://127.0.0.1:8898/'));
