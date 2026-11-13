import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {reportsContainingSource} from '../public/project-workflow.js';
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
  notebookBlocksFromSourceElement:()=>[],addPassageToNotebook:async(...args)=>calls.push(args)});
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
 append(...items){this.children.push(...items);},prepend(...items){this.children.unshift(...items);},
 querySelectorAll(){return this.children.filter(child=>child.tag==='button');},closest(){return body;},
 setAttribute(name,value){this.attrs[name]=value;},addEventListener(name,action){this[name]=action;}};nodes.push(node);return node;};
const body=element('section'),project={id:'project'};
const c=vm.createContext({document:{createElement:element},window:{getSelection:()=>''},
 codeTheme:()=> 'building',savedEvidenceKey:()=> 'saved',normalizeAnnotationBlockID:value=>String(value||''),
 sectionTitleWithoutNumber:()=> 'Scope',savedEvidenceEdition:()=> '2014',annotationForTarget:()=>({}),evidenceCommentsText:v=>v,markResearchSelectable(){},
 projectIdentity:p=>p,projectDetailKey:p=>p.id,hasCapability:()=>true,
 reportMembershipIndicator:()=>Object.assign(element('button'),{textContent:'Add to Report'}),
 openIncludedSourceReport:async()=>{calls.push('report');return true;},
 openSavedItemInReader:async(_item,pane)=>{assert.equal(pane,'evidence');calls.push('reader');},
 openSavedEvidenceMenu:(_row,anchor,menu)=>{assert.equal(anchor.attrs['aria-haspopup'],'menu');menu.hidden=false;},
 startFocusedResearchFromSavedItem:async()=>calls.push('research'),
 addSavedEvidenceToNotebook:async(_anchor,_item,id)=>{assert.equal(id,'project');calls.push('note');},
 animateSavedRowRemoval:async()=>{},persistSectionBookmark:async(_item,saved)=>{assert.equal(saved,false);calls.push('remove');return true;},
 showWebNotice:()=>assert.fail('Unexpected notice'),refreshOpenSavedPanes:async()=>{}});
vm.runInContext(source.slice(source.indexOf('function appendSavedEvidenceRow('),source.indexOf('\nfunction renderSavedItemsByCode(')),c);
c.appendSavedEvidenceRow(body,{id:'bookmark',sectionID:'source',sectionNumber:'1010.2',codeVersion:'2014',savedColumnKind:'bookmark',previewText:'Short preview'},'evidence',
 {reportProject:project,researchProjectID:'project',showProjectContext:false},{});
const row=body.children[0],actions=row.children.find(node=>node.className==='saved-evidence-menu');
const trigger=row.children.find(node=>node.className==='icon-button saved-evidence-menu-button');
assert.equal(actions.hidden,true,'Secondary actions occupy no space until the menu opens');
assert.deepEqual(actions.children.map(node=>node.textContent),['Add to note','Ask Assistant','Add to Report','Remove']);
assert.ok(actions.children.every(button=>button.attrs.role==='menuitem'));
assert.equal(row.children.some(node=>node.className==='saved-row-actions'),false,'No extra action rows remain');
await row.children[0].click();assert.deepEqual(calls,['reader']);calls.length=0;
trigger.click();assert.equal(actions.hidden,false);
for(const button of actions.children)await button.click();
assert.deepEqual(calls,['note','research','report','remove']);
const styles=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
assert.match(styles,/\.saved-evidence-menu\[hidden\]\s*\{ display: none;/);
console.log('Evidence actions passed: one menu, no action rows, passage opens Reader, retained Note/Assistant/Report/Remove actions, exact-edition capture and stale-context guards.');

// Saved passages enter the Report through its Sources column, using the exact
// source identity so two editions of the same paragraph stay distinct.
const paletteStart=source.indexOf('  function renderSourcePalette(');
const paletteEnd=source.indexOf('\n  }',paletteStart)+4;
assert(paletteStart>=0&&paletteEnd>paletteStart);
const paletteSources=['2022','2014'].map(edition=>({kind:'evidence',id:`passage-${edition}`,
 label:`BC ${edition} · 1010.2`,sourceClassification:'published-code'}));
const activeDraft={blocks:[{id:'existing',kind:'paragraph',text:'Keep Report edits'}]};
let dirtyChanges=0,renders=0;
const paletteContext=vm.createContext({document:{createElement:element},panel:{querySelector:()=>null},
 sources:paletteSources,activeDraft,reportsContainingSource,crypto:{randomUUID:()=>`block-${dirtyChanges}`},
 reportSectionExpanded:()=>true,wireProjectSectionMotion(){},persistReportSectionExpanded(){},
 mountState:{async addSources(_draftID,sources){
   activeDraft.blocks.push(...sources.map(source=>({id:`block-${source.id}`,kind:source.kind,sourceID:source.id})));
   dirtyChanges++;renders++;
 }}});
vm.runInContext(source.slice(paletteStart,paletteEnd),paletteContext);
const evidenceSourceButtons=()=>{
 const container=element('section');paletteContext.renderSourcePalette(container);
 const group=container.children.find(section=>section.children[0].children[0].textContent==='Evidence');
 return group.children[1].children.map(row=>row.children[1]);
};
let sourceButtons=evidenceSourceButtons();
assert.equal(sourceButtons.length,2);
await sourceButtons[0].click();
sourceButtons=evidenceSourceButtons();
assert.equal(sourceButtons[0].disabled,true,'An included passage cannot be added twice from Sources.');
assert.equal(sourceButtons[0].textContent,'Added');
assert.equal(sourceButtons[1].disabled,false,'The other edition remains separately available.');
await sourceButtons[1].click();
assert.deepEqual(activeDraft.blocks.map(block=>block.sourceID||block.id),['existing','passage-2022','passage-2014']);
assert.equal(activeDraft.blocks[0].text,'Keep Report edits');
assert.equal(dirtyChanges,2);assert.equal(renders,2);
console.log('Report Sources insertion passed: exact passage/edition identities, duplicate prevention, retained Report edits and save scheduling.');
