import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const begin=source.indexOf('function renderResearchNotebookHandoff(');
const code=source.slice(begin,source.indexOf('\nfunction renderResearchMessageCapture(',begin));
for(const mode of ['success','missing','switched','cancel']) {
 const nodes=[],notices=[],captured=[];
 const project={id:'p',name:'Test Project'};
 const element=tag=>{const e={tag,children:[],isConnected:true,value:'',append(...children){this.children.push(...children);if(tag==='select')this.value=children[0].value;},setAttribute(){},addEventListener(type,fn){this[type]=fn;}};nodes.push(e);return e;};
 let finish;
 const gate=new Promise(resolve=>finish=resolve);
 const c=vm.createContext({window:{requestAnimationFrame:()=>{}},document:{createElement:element},hasCapability:()=>true,researchAnswerHasVerificationRecovery:()=>false,researchProjects:()=>[project],
  researchProjectID:p=>p.id,readableProjectName:p=>p.name,crypto:{randomUUID:()=> 'mutation'},
  captureAccountRequest:()=> 'account',isCurrentAccountRequest:()=>true,activeWorkspaceID:'w',
  openIncludedSourceReport:async()=>false,reportAdditionFeedback:button=>{button.textContent='Included in Report · Open';},
  showWebNotice:async(...args)=>notices.push(args),
  addProjectSourcesToReport:async(p,choose)=>{assert.equal(p,project);captured.push(...choose(mode==='missing'?[]:[{kind:'researchAnswer',id:'answer'},{kind:'researchAnswer',id:'other'}]));return mode==='switched'?gate:mode==='cancel'?null:{title:'Destination'};}
 });
 vm.runInContext(code,c);c.renderResearchNotebookHandoff({primaryProjectID:'p'},{id:'answer',answer:{}});
 const button=nodes.find(e=>e.textContent==='Add to Report');assert(button);
 const pending=button.click();
 if(mode==='switched'){c.activeWorkspaceID='different';finish({title:'Old Report'});}
 await pending;
 if(mode==='missing'){assert.equal(captured.length,0);assert.match(notices[0][1],/Link this Assistant conversation/);}
 else {assert.deepEqual(captured.map(s=>s.id),['answer']);assert.equal(notices.length,0);assert.equal(button.textContent,mode==='success'?'Included in Report · Open':'Add to Report');}
}
console.log('Assistant Report handoff passed: exact answer identity, selected Project, missing-source feedback and workspace-change guard.');
