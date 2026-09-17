import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const html=`<!doctype html><html><head><meta charset="utf-8"><title>Definition pop-up verification</title><link rel="stylesheet" href="/reader-definition-popover.css"><style>body{background:#080b10;color:#eee;font:18px/1.7 Georgia;padding:48px;max-width:660px}#results{font:14px system-ui;color:#8ddaa4}a{color:#8cd}p{margin:28px 0}</style></head><body><h1>Definition pop-up verification</h1><output id="results">Checking…</output><main><p id="prose">A fire <strong>wall</strong> separates buildings. The fire wall remains visible.</p><p id="links">An <a href="#source">exit</a> and an exit provide access.</p><p id="safe">An exit is available.</p></main><script type="module">
import {installDefinitionLinks,openDefinitionPopover} from '/reader-definition-popover.js';
import {definitionsForReader} from '/reader-definition-registry.js';
import {createDefinitionMatcher} from '/definition-matcher.js';
import {setReaderDefinitionContext,decorateReaderDefinitions} from '/reader-definitions.js';
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

 const italicEntry={...entries[0],id:'italic-wall',requiresItalic:true};
 const italicCases=[
  ['authored em term','<em>fire wall</em>',1],
  ['nested strong inside italic','<em>fire <strong>wall</strong></em>',1],
  ['split authored italic wrappers','<em>fire</em> <i><span>wall</span></i>',1],
  ['italic wrappers separated by br','<em>fire</em><br><i>wall</i>',1],
  ['plain prose excluded','fire wall',0],
  ['partially italic term excluded','<em>fire</em> wall',0],
  ['computed italic alone excluded','<span style="font-style:italic">fire wall</span>',0],
  ['existing italic source link preserved','<a href="#source"><em>fire wall</em></a>',0]
 ];
 for(const [name,markup,count] of italicCases){
  const paragraph=document.createElement('p');paragraph.innerHTML=markup;document.querySelector('main').append(paragraph);
  const before=paragraph.textContent,anchor=paragraph.querySelector('a');
  check(name,installDefinitionLinks(paragraph,[italicEntry])===count&&paragraph.textContent===before&&(!anchor||paragraph.querySelector('a')===anchor));
  check(name+' remains idempotent',installDefinitionLinks(paragraph,[italicEntry])===0);
  paragraph.remove();
 }
 const mixedItalic=document.createElement('p');mixedItalic.textContent='fire wall';document.querySelector('main').append(mixedItalic);
 check('mixed meaning keeps unrestricted entry',installDefinitionLinks(mixedItalic,[italicEntry,entries[0]])===1);
 mixedItalic.querySelector('button').click();
 check('plain term popup excludes italic-only meaning',document.querySelectorAll('.reader-definition-text').length===1);
 document.querySelector('.reader-definition-close').click();mixedItalic.remove();

 const dimensionalEntries=definitionsForReader(registry,{bundle:'2026-zoning-resolution',codeSectionID:1,chapterNumber:'II-3'});
 const farEntries=dimensionalEntries.filter(entry=>entry.term==='floor area ratio');
 check('actual Zoning II-3 selects only reviewed italic FAR meaning',farEntries.length===1&&farEntries[0].term==='floor area ratio'&&farEntries[0].requiresItalic===true);
 const actualHTML=await fetch('/zoning-II-3.html').then(response=>response.text());
 const actualDocument=new DOMParser().parseFromString(actualHTML,'text/html');
 const actualCorpus=document.createElement('section');actualCorpus.id='actual-zoning-II-3';
 actualCorpus.append(...Array.from(actualDocument.body.childNodes));document.querySelector('main').append(actualCorpus);
 const actualText=actualCorpus.textContent;
 check('actual II-3 contains thirty-three singular or plural FAR occurrences',[...actualText.matchAll(/\\bfloor\\s+area\\s+ratios?\\b/gi)].length===33);
 check('actual II-3 links twenty-eight authored italic occurrences',installDefinitionLinks(actualCorpus,farEntries)===28&&actualCorpus.querySelectorAll('.reader-definition-term').length===28);
 check('actual II-3 source text preserved',actualCorpus.textContent===actualText);
 check('actual II-3 plain headings remain unlinked',actualCorpus.querySelectorAll('h1 button,h2 button,h3 button,h4 button,h5 button,h6 button').length===0);
 const remaining=actualCorpus.cloneNode(true);remaining.querySelectorAll('.reader-definition-term').forEach(button=>button.remove());
 check('actual II-3 five plain headings and captions remain unlinked',[...remaining.textContent.matchAll(/\\bfloor\\s+area\\s+ratios?\\b/gi)].length===5);
 check('actual II-3 repeated decoration remains stable',installDefinitionLinks(actualCorpus,farEntries)===0&&actualCorpus.querySelectorAll('.reader-definition-term').length===28);

 const dimensionalCorpus=document.createElement('section');
 dimensionalCorpus.append(...Array.from(new DOMParser().parseFromString(actualHTML,'text/html').body.childNodes));
 document.querySelector('main').append(dimensionalCorpus);
 const dimensionalText=dimensionalCorpus.textContent;
 check('reviewed dimensional set has thirteen italic-only meanings',dimensionalEntries.length===13&&dimensionalEntries.every(entry=>entry.requiresItalic));
 installDefinitionLinks(dimensionalCorpus,dimensionalEntries);
 check('dimensional decoration preserves complete source text',dimensionalCorpus.textContent===dimensionalText);
 for(const entry of dimensionalEntries){
  const negative=document.createElement('p');negative.textContent=entry.term;document.querySelector('main').append(negative);
  check('plain dimensional term stays unlinked: '+entry.term,installDefinitionLinks(negative,[entry])===0);
  negative.replaceChildren();const emphasis=document.createElement('em');emphasis.textContent=entry.term.slice(0,-1);negative.append(emphasis,entry.term.slice(-1));
  check('partial italic dimensional term stays unlinked: '+entry.term,installDefinitionLinks(negative,[entry])===0);negative.remove();
  const labels=[entry.term,...(entry.aliases||[])];
  const button=[...dimensionalCorpus.querySelectorAll('.reader-definition-term')].find(button=>labels.includes(button.textContent.toLowerCase()));
  check('actual italic occurrence linked: '+entry.term,Boolean(button));
  button.click();
  check('complete cited meaning retained: '+entry.term,document.querySelector('.reader-definition-text')?.textContent===entry.text&&document.querySelector('.reader-definition-popover')?.textContent.includes('12-10'));
  document.querySelector('.reader-definition-close').click();
  check('focus returns: '+entry.term,document.activeElement===button);
 }
 check('compound building phrase remains one link',Boolean([...dimensionalCorpus.querySelectorAll('.reader-definition-term')].find(button=>button.textContent.toLowerCase()==='building or other structure')));
 dimensionalCorpus.remove();

 const hmcHTML=await fetch('/hmc-subchapter-2.html').then(response=>response.text());
 const hmcDocument=new DOMParser().parseFromString(hmcHTML,'text/html');
 const hmcContext={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterNumber:'2'};
 const hmcEntries=sectionNumber=>definitionsForReader(registry,{...hmcContext,sectionNumber});
 const multipleEntries=sectionNumber=>hmcEntries(sectionNumber).filter(entry=>entry.term.toLowerCase()==='multiple dwelling');
 const hmcSectionNumber=section=>section.querySelector('h3')?.textContent.match(/27-\\s*\\d+(?:\\.\\d+)*/)?.[0].replace(/\\s/g,'');
 const hmcSection=number=>{const section=[...hmcDocument.querySelectorAll('section')].find(section=>hmcSectionNumber(section)===number);if(!section)throw Error('Actual HMC source section missing: '+number);return section;};
 const hmcPair=multipleEntries('27-2056.3');
 check('HMC application selects additive general and Article 14 meanings',hmcPair.length===2&&hmcPair.some(entry=>entry.source.sectionNumber==='27-2004')&&hmcPair.some(entry=>entry.source.sectionNumber==='27-2056.1'));
 check('HMC enumerated application sections retain the same pair',[...Array.from({length:16},(_,index)=>'27-2056.'+(index+3)),'27-2056.6.1'].every(number=>multipleEntries(number).length===2));
 const hmcApplication=hmcSection('27-2056.3').cloneNode(true);document.querySelector('main').append(hmcApplication);
 const hmcBefore=hmcApplication.textContent;installDefinitionLinks(hmcApplication,hmcEntries('27-2056.3'),{sectionNumber:'27-2056.3'});
 const hmcTrigger=[...hmcApplication.querySelectorAll('button.reader-definition-term')].find(button=>button.textContent.toLowerCase()==='multiple dwelling');
 check('actual HMC application links without changing enacted text',Boolean(hmcTrigger)&&hmcApplication.textContent===hmcBefore);
 hmcTrigger.click();
 const hmcTexts=[...document.querySelectorAll('.reader-definition-text')].map(node=>node.textContent);
 const hmcCitations=[...document.querySelectorAll('.reader-definition-source')].map(node=>node.textContent);
 check('HMC popup displays both exact complete source bodies',hmcTexts.length===2&&hmcPair.every(entry=>hmcTexts.includes(entry.text)));
 check('HMC popup labels both enacted citations',hmcCitations.some(text=>text.includes('27-2004'))&&hmcCitations.some(text=>text.includes('27-2056.1')));
 check('HMC local expansion preserves owner-family and section 14 qualifications',hmcTexts.some(text=>text.includes('provided, however')&&text.includes('27-2056.14')&&text.includes("owner's family")));
 document.querySelector('.reader-definition-close').click();
 check('HMC popup Close returns to its application term',document.activeElement===hmcTrigger&&!document.querySelector('[role=dialog]'));
 for(const number of ['27-2056.1','27-2056.2','27-2056.22']){
  const actual=hmcSection(number).cloneNode(true);const before=actual.textContent;document.querySelector('main').append(actual);
  const selected=hmcEntries(number);installDefinitionLinks(actual,selected,{sectionNumber:number});
  check('HMC '+number+' excludes definition/covered uses and preserves source',multipleEntries(number).length===(number==='27-2056.22'?1:0)&&actual.textContent===before&&![...actual.querySelectorAll('button.reader-definition-term')].some(button=>button.textContent.toLowerCase()==='multiple dwelling'));
  actual.remove();
 }
 const hmcBatchCounts={'Class B multiple dwelling':8,'Converted dwelling':10,'Apartment':60,'Rooming unit':14,'Rooming house':7,'Lodging house':3,'Premises':82,'Structure':5,'Summer resort dwelling':3,'Self-closing door':6,'Unoccupied dwelling unit':5};
 const hmcReviewed=['Public hall','Living room','Dining space','Foyer','Kitchenette','Fire-retarded','Cellar','Basement','Shaft','Stair','Fire escape','Private dwelling','Person',...Object.keys(hmcBatchCounts)];
 const hmcSources=await Promise.all([1,2,3,4,5].map(async chapter=>({chapter:String(chapter),document:new DOMParser().parseFromString(await fetch('/hmc-chapter-'+chapter+'.html').then(response=>response.text()),'text/html')})));
 const contextualCounts={person:0,multiple:0},batchCounts=Object.fromEntries(Object.keys(hmcBatchCounts).map(label=>[label.toLowerCase(),0])),contextDifferences=[];
 for(const source of hmcSources){
  for(const section of source.document.querySelectorAll('section')){
   const number=hmcSectionNumber(section);if(!number)continue;
   const eligible=definitionsForReader(registry,{...hmcContext,chapterNumber:source.chapter,sectionNumber:number});
   for(const paragraph of section.querySelectorAll(':scope > p')){
    const clone=paragraph.cloneNode(true),before=clone.textContent;
    installDefinitionLinks(clone,eligible,{sectionNumber:number});
    const rawMultiple=createDefinitionMatcher(eligible,{sectionNumber:number})(before).filter(match=>match.entries.some(entry=>entry.term==='Multiple dwelling')).length;
    const normalizedMultiple=createDefinitionMatcher(eligible,{sectionNumber:number})(before.replace(/\\s+/g,' ').trim()).filter(match=>match.entries.some(entry=>entry.term==='Multiple dwelling')).length;
    const renderedMultiple=[...clone.querySelectorAll('.reader-definition-term')].filter(button=>button.textContent.toLowerCase()==='multiple dwelling').length;
    if(rawMultiple!==renderedMultiple)contextDifferences.push({number,text:before,rawMultiple,renderedMultiple});
    if(normalizedMultiple!==rawMultiple)contextDifferences.push({number,text:before,rawMultiple,normalizedMultiple});
    if(clone.textContent!==before)throw Error('HMC contextual decoration altered source '+number);
    for(const button of clone.querySelectorAll('.reader-definition-term')){
     if(button.textContent.toLowerCase()==='person')contextualCounts.person++;
     if(button.textContent.toLowerCase()==='multiple dwelling')contextualCounts.multiple++;
     if(Object.hasOwn(batchCounts,button.textContent.toLowerCase()))batchCounts[button.textContent.toLowerCase()]++;
    }
    if(installDefinitionLinks(clone,eligible,{sectionNumber:number})!==0)throw Error('HMC repeated decoration created another link '+number);
   }
  }
 }
 check('HMC all actual paragraph Person contexts preserve nineteen exclusions',contextualCounts.person===118);
 check('HMC paragraph matcher and rendered occurrence counts agree',contextDifferences.length===0);
 check('HMC all actual paragraph Multiple dwelling contexts preserve compounds and covered references',contextualCounts.multiple===272);
 for(const [label,count]of Object.entries(hmcBatchCounts))check('HMC actual paragraph batch count and contextual exclusions: '+label,batchCounts[label.toLowerCase()]===count);
 for(const [number,labels]of [['27-2017',[]],['27-2017.1',['multiple dwelling']],['27-2017.4',['multiple dwelling']],['27-2017.8',['basement','premises']]]){
  const clone=hmcSection(number).cloneNode(true),before=clone.textContent;
  installDefinitionLinks(clone,hmcEntries(number),{sectionNumber:number});
  const linked=[...clone.querySelectorAll('.reader-definition-term')].map(button=>button.textContent.toLowerCase());
  check('HMC exact definition boundary preserves separate operative section '+number,clone.textContent===before&&(labels.length?labels.every(label=>linked.includes(label)):linked.length===0));
 }
 for(const label of hmcReviewed){
  let verified=false;
  for(const source of hmcSources){
   for(const section of source.document.querySelectorAll('section')){
    const number=hmcSectionNumber(section);if(!number)continue;
    const eligible=definitionsForReader(registry,{...hmcContext,chapterNumber:source.chapter,sectionNumber:number}).filter(entry=>entry.term===label&&entry.source.sectionNumber==='27-2004');if(!eligible.length)continue;
    const clone=section.cloneNode(true),before=clone.textContent;document.querySelector('main').append(clone);
    installDefinitionLinks(clone,eligible,{sectionNumber:number});const button=clone.querySelector('.reader-definition-term');
    if(button){
     check('HMC actual application source unchanged: '+label,clone.textContent===before);button.click();
     check('HMC complete general meaning and citation: '+label,document.querySelector('.reader-definition-text')?.textContent===eligible[0].text&&document.querySelector('.reader-definition-source')?.textContent.includes('27-2004'));
     document.querySelector('.reader-definition-close').click();check('HMC general Close restores focus: '+label,document.activeElement===button);verified=true;
    }
    if(verified&&['Person','Private dwelling','Rooming unit','Class B multiple dwelling'].includes(label))clone.id='review-hmc-'+label.toLowerCase().replaceAll(' ','-');else clone.remove();if(verified)break;
   }
   if(verified)break;
  }
  check('HMC reviewed label has rendered source occurrence: '+label,verified);
 }
 const hmcGeneralSection=[...hmcSources[0].document.querySelectorAll('section')].find(section=>section.querySelector('h3')?.textContent.startsWith('27-2004'));
 const plainDefinitions=hmcGeneralSection.cloneNode(true);document.querySelector('main').append(plainDefinitions);
 check('HMC complete general definition section remains plain',installDefinitionLinks(plainDefinitions,definitionsForReader(registry,{...hmcContext,chapterNumber:'1',sectionNumber:'27-2004'}),{sectionNumber:'27-2004'})===0);plainDefinitions.remove();
 for(const [id,number,label]of [[31001869,'27-2017.4','multiple dwelling'],[31001873,'27-2017.8','basement']]){
  const prepared=await fetch('/hmc-prepared-'+id+'.json').then(response=>response.json());
  check('HMC prepared section identity '+id,prepared.sectionNumber===number);
  const root=document.createElement('section'),reader={};root.id='review-prepared-'+id;
  for(const block of prepared.blocks){const wrapper=document.createElement('div');wrapper.className='annotated-code-block';wrapper.dataset.sectionNumber=prepared.sectionNumber;wrapper.dataset.sectionTitle=prepared.title;const content=document.createElement('div');content.innerHTML=block.html;wrapper.append(content);root.append(wrapper);}
  const before=root.textContent;document.querySelector('main').append(root);
  setReaderDefinitionContext(reader,{codeSectionID:5,chapterNumber:prepared.chapterNumber},'new-york-city/2026-enacted-administrative-code/bundle.json');
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{observer.disconnect();reject(Error('Prepared Reader decoration timed out '+id));},3000);const observer=new MutationObserver(()=>{if(root.querySelector('.reader-definition-term')){clearTimeout(timer);observer.disconnect();resolve();}});observer.observe(root,{childList:true,subtree:true});decorateReaderDefinitions(root,reader);});
  const trigger=[...root.querySelectorAll('.reader-definition-term')].find(button=>button.textContent.toLowerCase()===label);
  check('HMC actual prepared metadata drives production decorator '+number,Boolean(trigger)&&root.textContent===before);
  trigger.click();check('HMC prepared passage popup retains source '+number,document.querySelector('.reader-definition-source')?.textContent.includes('27-2004'));
  document.querySelector('.reader-definition-close').click();check('HMC prepared passage focus return '+number,document.activeElement===trigger);
 }
 const temporary=document.createElement('p');temporary.textContent='exit';document.body.append(temporary);installDefinitionLinks(temporary,entries);
 openDefinitionPopover(temporary.querySelector('button'),[entries[1]]);temporary.remove();await Promise.resolve();
 check('reader removal closes detached popup',!document.querySelector('[role=dialog]'));
 document.querySelector('#results').textContent=checks.length+' checks passed. Click a dotted term to inspect the pop-up.';
 document.title='PASS — Definition pop-up verification';
}catch(error){document.querySelector('#results').textContent='FAIL: '+error.message;document.title='FAIL — Definition pop-up verification';}
</script></body></html>`;
const allowed=new Set(['reader-definition-popover.js','reader-definition-popover.css','definition-matcher.js','reader-definition-registry.json','reader-definition-registry.js','reader-definitions.js']);
const server=createServer(async(req,res)=>{
 const name=new URL(req.url,'http://127.0.0.1').pathname.replace(/^\/web\//,'/').slice(1);
 if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 if(/^hmc-chapter-[1-5]\.html$/.test(name)){const chapter=Number(name.match(/[1-5]/)[0]);res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/'+(30000076+chapter)+'.html',import.meta.url)));return;}
 if(/^hmc-prepared-(31001869|31001873)\.json$/.test(name)){res.setHeader('Content-Type','application/json');res.end(await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/prepared/sections/'+name.match(/3100\d+/)[0]+'.json',import.meta.url)));return;}
 if(name==='hmc-subchapter-2.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/30000078.html',import.meta.url)));return;}
 if(name==='zoning-II-3.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-zoning-resolution/chapters/II-3.html',import.meta.url)));return;}
 if(!allowed.has(name)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',name.endsWith('.json')?'application/json':name.endsWith('.css')?'text/css':'text/javascript');
 res.end(await readFile(new URL('../public/'+name,import.meta.url)));
});
const port=Number(process.env.PORT||8898);
server.listen(port,'127.0.0.1',()=>console.log('Definition fixture: http://127.0.0.1:'+port+'/'));
