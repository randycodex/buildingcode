import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start = source.indexOf('function renderResearchNotebookHandoff(');
const code = source.slice(start,source.indexOf('\nfunction renderResearchMessageCapture(',start));
const tick = () => new Promise(resolve=>setImmediate(resolve));
for (const delay of ['confirmation','save','ready','refresh','none']) {
  for (const change of delay === 'none' ? ['none'] : ['view','project']) {
    let finish;
    const gate = new Promise(resolve=>{finish=resolve;});
    const calls = [];
    const nodes = [];
    const project = {id:'p',name:'Local project'};
    const element = tag => {
      const e = {tag,children:[],isConnected:true,value:'',
        append(...children){this.children.push(...children);if(tag==='select')this.value=children[0].value;},
        setAttribute(){},addEventListener(_type,fn){this.click=fn;},
        closest:()=>({dataset:{paneId:'research:one'}})};
      nodes.push(e);return e;
    };
    let activeCard = '';
    const c = vm.createContext({
      state:{workflowNavigationGeneration:0},activeWorkspaceID:'w',
      document:{createElement:element},hasCapability:()=>true,researchProjects:()=>[project],
      researchProjectID:p=>p.id,readableProjectName:p=>p.name,crypto:{randomUUID:()=> 'test-id'},
      captureAccountRequest:()=>({userID:'local'}),isCurrentAccountRequest:()=>true,
      requireCurrentAccountRequest(){},researchAnswerQuestion:()=> 'Research question',
      confirmWebWarning:()=>delay==='confirmation'?gate:Promise.resolve(true),navigator:{onLine:true},
      emptyNotebookDocument:()=>({document:[]}),
      postResearch:async()=>{calls.push('saved');return delay==='save'?gate:{card:{id:'note'}};},
      saveNotebookCardSnapshot:async()=>{},pendingNotebookCardByProject:new Map(),
      researchWorkspaceProjectID:()=> 'p',paneIDForProjectNotebook:()=> 'notebook:p',
      requestLinkedPanePlacement:(from,to)=>calls.push(['placed',from,to]),
      openProjectNotebook:async()=>{calls.push('opened');return true;},
      whenWorkspacePaneReady:()=>delay==='ready'?gate:Promise.resolve(true),
      notebookMounts:new Map([['p',{
        refreshCards:()=>delay==='refresh'?gate:Promise.resolve(),activeCardID:()=>activeCard,
        focusCard:async id=>{calls.push('focused');activeCard=id;}
      }]]),showWebNotice:async()=>calls.push('notice')
    });
    vm.runInContext(code,c);
    c.renderResearchNotebookHandoff({primaryProjectID:'p'},{id:'answer',answer:{}});
    const pending = nodes.find(e=>e.tag==='button').click();
    await tick();
    if(change==='view') c.state.workflowNavigationGeneration=2;
    if(change==='project') c.activeWorkspaceID='other';
    finish(delay==='save'?{card:{id:'note'}}:true);
    await pending;
    if(change==='none') {
      assert.deepEqual(calls,['saved',['placed','research:one','notebook:p'],'opened','focused']);
      assert.equal(c.pendingNotebookCardByProject.size,0);
    } else {
      assert.equal(c.pendingNotebookCardByProject.size,0,'Cancelled navigation cannot focus the Note on a later return');
      assert(!calls.includes('focused'),`${delay}/${change}: do not focus a Note after navigation`);
      assert(!calls.includes('notice'),`${delay}/${change}: do not show stale errors`);
      if(['confirmation','save'].includes(delay))assert(!calls.includes('opened'));
    }
  }
}
console.log('Research → Notebook navigation passed: current destination opens beside Research; delayed confirmation/save/hydration/refresh cannot pull the user into a different view or Project.');
