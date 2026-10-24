import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {inlineCodeReferencePhrases} from '../public/code-references.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=name=>{const start=app.indexOf(`function ${name}(`);assert(start>=0);return app.slice(start,app.indexOf('\n}',start)+2);};
const elements=[];
const node=tag=>{const n={tag,children:[],isConnected:true,textContent:'',append(...children){this.children.push(...children);}};elements.push(n);return n;};
let opened=[],lookups=[],generic=0,current=true;
const source={codePrefix:'BC',codeVersion:'2022',selectedText:'See Section 1004.3 for fixed seating.'};
const runtime=vm.createContext({document:{createElement:node},inlineCodeReferencePhrases,
 researchDisplayList:value=>value||[],researchSourcesForAnswer:()=>[source],
 researchWorkflowButton:(label,action)=>({tag:'button',label,action}),
 captureAccountRequest:()=> 'owner',isCurrentAccountRequest:()=>current,activeWorkspaceID:'workspace',
 normalizedInlineSectionNumber:n=>n.toLowerCase(),sectionRecordMatchesRequestedEdition:(s,t)=>s.codeVersion===t.codeVersion,
 resolveInlineCodeSection:async(prefix,number,version)=>{lookups.push({prefix,number,version});return {sectionID:'target',sectionNumber:number,codePrefix:prefix,codeVersion:version};},
 openSourceInReader:async(target,pane)=>opened.push({target,pane}),openReaderFromToolbar:()=>generic++});
vm.runInContext(actual('renderResearchMissingEvidence'),runtime);
const allButtons=root=>[...root.children.flatMap(n=>n.children?allButtons(n):[]),...root.children.filter(n=>n.tag==='button')];
const render=needed=>runtime.renderResearchMissingEvidence({}, {answer:{additionalEvidenceNeeded:needed}},'assistant-one');
assert.equal(render([]),null);
let region=render(['Add Section 1004.3.']);let buttons=allButtons(region);
assert.equal(buttons.length,1);assert.equal(buttons[0].label,'Open BC § 1004.3 in Reader');
assert.equal(lookups.length,0,'Rendering never automatically retrieves additional code.');
await buttons[0].action();assert.equal(opened.length,1);assert.equal(opened[0].pane,'assistant-one');assert.equal(lookups[0].version,'2022');
buttons=allButtons(render(['Add Section 9999.9.']));assert.equal(buttons[0].label,'Open Reader','An invented or unsupported reference does not become a link.');
buttons=allButtons(render(['Add PC Section 1004.3.']));assert.equal(buttons[0].label,'Open Reader','Do not silently map another code to this edition.');
buttons=allButtons(render(['Add Section 1004.3.']));
runtime.resolveInlineCodeSection=async()=>({sectionNumber:'1004.3.1',codeVersion:'2022'});
await assert.rejects(buttons[0].action(),/exact referenced provision/);
runtime.resolveInlineCodeSection=async()=>({sectionNumber:'1004.3',codeVersion:'2014'});
await assert.rejects(buttons[0].action(),/exact referenced provision/);
runtime.resolveInlineCodeSection=async()=>({sectionNumber:'1004.3'});
await assert.rejects(buttons[0].action(),/exact referenced provision/);
assert.equal(opened.length,1,'Missing editions, child-section fallbacks and other editions may not be opened.');
current=false;await buttons[0].action();assert.equal(opened.length,1,'Late resolution cannot navigate a different account.');
console.log('Passage workflow: explicit reference navigation, no automatic lookup, exact section/edition checks and stale-account protection passed.');
