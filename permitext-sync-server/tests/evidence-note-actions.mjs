import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('async function addSavedEvidenceToNotebook('),source.indexOf('\nfunction appendSavedEvidenceRow('));
const exact='The full saved paragraph, including every condition. '+ 'Preserve the complete historical source. '.repeat(12);
for(const mode of ['paragraph','section','no-note','missing','edition','workspace','project','account','view','closed','note','mount','acknowledged']) {
 const calls=[],identity={},nextIdentity={};let finish;
 let project={id:'project'},account=true,target=mode==='no-note'?null:{id:'note',identity};
 const mount={insertionTarget:()=>target};
 const anchor={isConnected:true};
 const section={id:'source',codeVersion:mode==='edition'?'2022':'2014',codePrefix:'BC',sectionNumber:'1010.2',title:'Historical passage',
  blocks:[{id:'selected',text:exact},{id:'other',text:'Another paragraph, not the selection.'}]};
 const gate=new Promise(resolve=>finish=resolve);
 const c=vm.createContext({workspaceProject:()=>project,researchProjectID:p=>p.id||'',captureAccountRequest:()=>identity,isCurrentAccountRequest:()=>account,
  activeWorkspaceID:'workspace',state:{workflowNavigationGeneration:0},notebookMounts:new Map(mode==='no-note'?[]:[['project',mount]]),
  normalizeAnnotationBlockID:value=>String(value||''),syncCodeVersion:value=>value,
  resolveSavedSectionDetail:async()=>{await gate;return {section,chapter:{id:'chapter',chapterNumber:'10'}};},
  sectionRecordMatchesRequestedEdition:(detail,record)=>detail.codeVersion===record.codeVersion,
  annotatedBlocksForSection:s=>s.blocks,
  document:{createElement:()=>({children:[],append(child){this.children.push(child);}})},renderCodeBlock:block=>block,
  notebookEvidenceTextMap:(node,options)=>{assert.equal(options.literalInline,true);return {text:node.children.map(block=>block.text).join('\n')};},
  addPassageToNotebook:async(...args)=>calls.push(args)});
 vm.runInContext(helper,c);
 const pending=c.addSavedEvidenceToNotebook(anchor,{sectionID:'source',codeVersion:'2014',codePrefix:'BC',blockID:mode==='missing'?'missing':'selected',
  ...(mode==='section'?{scope:'section'}:{})},'project');
 if(mode==='workspace')c.activeWorkspaceID='other';
 if(mode==='project')project={id:'other'};
 if(mode==='account')account=false;
 if(mode==='view')c.state.workflowNavigationGeneration++;
 if(mode==='closed')anchor.isConnected=false;
 if(mode==='note')target={id:'note',identity:nextIdentity};
 if(mode==='mount')c.notebookMounts.set('project',{});
 if(mode==='acknowledged')target={id:'new-server-id',identity};
 finish();
 if(['missing','edition'].includes(mode)){await assert.rejects(pending,/unavailable/);assert.equal(calls.length,0);}
 else {await pending;const expected=['paragraph','section','no-note','acknowledged'].includes(mode);assert.equal(calls.length,expected?1:0,mode);
  if(expected){assert.equal(calls[0][1].codeVersion,'2014');assert.equal(calls[0][1].sectionID,'source');assert.equal(calls[0][2],mode==='section'?`${exact}\nAnother paragraph, not the selection.`:exact);}}
}

const nodes=[],calls=[];
const element=tag=>{const node={tag,children:[],dataset:{},attrs:{},isConnected:true,classList:{add(){}},
 append(...items){this.children.push(...items);},setAttribute(name,value){this.attrs[name]=value;},addEventListener(name,action){this[name]=action;}};nodes.push(node);return node;};
const body=element('section'),project={id:'project'};
const c=vm.createContext({document:{createElement:element},window:{getSelection:()=>''},
 codeTheme:()=> 'building',savedEvidenceKey:()=> 'saved',normalizeAnnotationBlockID:value=>String(value||''),
 sectionTitleWithoutNumber:()=> 'Scope',savedEvidenceEdition:()=> '2014',annotationForTarget:()=>({}),markResearchSelectable(){},
 projectIdentity:p=>p,projectDetailKey:p=>p.id,hasCapability:()=>true,reportMembershipIndicator:()=>element('button'),
 startFocusedResearchFromSavedItem:async()=>calls.push('research'),addSavedEvidenceToReport:async()=>{calls.push('report');return {};},reportAdditionFeedback(){},
 addSavedEvidenceToNotebook:async(_anchor,_item,id)=>{assert.equal(id,'project');calls.push('note');},
 animateSavedRowRemoval:async()=>{},persistSectionBookmark:async(_item,saved)=>{assert.equal(saved,false);calls.push('remove');return true;},
 showWebNotice:()=>assert.fail('Unexpected notice'),refreshOpenSavedPanes:async()=>{}});
vm.runInContext(source.slice(source.indexOf('function appendSavedEvidenceRow('),source.indexOf('\nfunction renderSavedItemsByCode(')),c);
c.appendSavedEvidenceRow(body,{id:'bookmark',sectionID:'source',sectionNumber:'1010.2',codeVersion:'2014',savedColumnKind:'bookmark',previewText:'Short preview'},'evidence',
 {reportProject:project,researchProjectID:'project',showProjectContext:false},{});
const actions=body.children[0].children.find(node=>node.className==='saved-row-actions');
assert.deepEqual(actions.children.map(node=>node.textContent),['Research','Add to Report','Add to note','Remove']);
assert.equal(nodes.filter(node=>node.tag==='details').length,0,'Remove is a direct row action, with no three-dot disclosure.');
for(const button of actions.children)await button.click();
assert.deepEqual(calls,['research','report','note','remove']);
const styles=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
assert.doesNotMatch(styles,/\.saved-row-actions \.saved-add-to-report\s*\{[^}]*opacity:\s*1/,'Report follows the same hover visibility as Research.');
assert.match(styles,/\.saved-section-row:hover \.saved-row-actions button,[\s\S]*?\.saved-section-row:focus-within \.saved-row-actions button\s*\{\s*opacity: 1/);
console.log('Evidence actions passed: four direct actions, shared hover/focus visibility, complete exact-edition Note capture, missing-paragraph rejection and stale account/Project/Note guards.');
