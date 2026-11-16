import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const begin=source.indexOf('function renderResearchNotebookHandoff(');
const code=source.slice(begin,source.indexOf('\nfunction renderResearchMessageCapture(',begin));
for(const currentNote of [null,{title:'Working note'}]) {
 const nodes=[];
 const project={id:'p',name:'Test Project'};
 const element=tag=>{const e={tag,dataset:{},children:[],value:'',append(...children){this.children.push(...children);if(tag==='select')this.value=children[0].value;},setAttribute(){},addEventListener(){}};nodes.push(e);return e;};
 const c=vm.createContext({document:{createElement:element},hasCapability:()=>true,researchAnswerHasVerificationRecovery:()=>false,researchProjects:()=>[project],
  researchProjectID:p=>p.id,readableProjectName:p=>p.name,crypto:{randomUUID:()=> 'mutation'},
  workingResearchNote:()=>currentNote
 });
 vm.runInContext(code,c);
 const region=c.renderResearchNotebookHandoff({primaryProjectID:'p'},{id:'answer',answer:{}});
 const actions=region.children.filter(e=>e.tag==='button');
 assert.equal(actions.length,1,'An Assistant answer offers only the Note handoff');
 assert.equal(actions[0].textContent,currentNote?'Add to Working note':'Add to note…');
 assert.equal(actions[0].disabled,false);
 assert(!nodes.some(e=>e.textContent==='Add to Report'));
}
console.log('Assistant answer actions retain the Note handoff and omit the Report shortcut.');
