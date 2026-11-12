import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,writeFile} from 'node:fs/promises';
import {createResearchOperationGate} from '../public/research-operation-gate.js';
import {createResearchV2View} from '../public/research-v2.js';
import {researchInlineRuns} from '../public/research-inline-format.js';
import {researchAnswerURL,linkedResearchAnswerID} from '../public/research-answer-links.js';
import {Element,all,document,tick,deferred} from './helpers/research-test-dom.mjs';
import {constructionHTMLBodyForSection} from '../construction-html-content.mjs';
import {prepareSavedEvidenceItems} from '../report-evidence.mjs';
import {notebookManifestItem} from '../notebook-contract.mjs';
import {immutableReportManifest} from '../report-contract.mjs';
import {reportItemPreview} from '../report-presentation.mjs';
import {sourceFormattingRuns} from '../public/report-source-formatting.js';
import {renderReportPDF} from '../report-pdf.mjs';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

Object.assign(globalThis,{document,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>fn()});
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const actual=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
const source={kind:'selection',sectionID:'2152',selectedText:'Exact reviewed table.'};
for(let n=0;n<5;n++){
  const gate=createResearchOperationGate(),scope='owner:workspace',saving=deferred(),publishing=deferred();
  let loaded=null,sends=0,applied=0;
  const c=vm.createContext({document,researchOperations:gate,researchOperationScope:()=>scope,activeWorkspaceID:'workspace',
    captureAccountRequest:()=>({userID:'owner'}),isCurrentAccountRequest:()=>true,
    state:{utilityInstances:[],researchConversationID:'chat'},supplementalResearchConversations:new Map(),
    currentColumnWorkflowView:()=> 'research',paneIDForUtilityInstance:()=> 'analysis',
    researchWorkflowButton:(label,fn)=>{const button=new Element('button');button.textContent=label;button.addEventListener('click',fn);return button;},
    reconciledResearchProgressSession:()=>null,
    postResearch:async(_path,body)=>{assert.equal(body.include,true);applied++;return saving.promise;},
    openResearchConversation:async(_id,{conversation})=>{await publishing.promise;loaded=conversation;}
  });
  vm.runInContext(actual('function renderResearchProjectContext(','function researchEvidenceSplitRatio('),c);
  const makeView=()=>{
    const panel=new Element('article');panel.className='workspace-panel';panel.dataset.paneId='analysis';
    const view=createResearchV2View({conversation:{id:'chat',primaryProjectID:'project',sources:[source],messages:[]},initialDraft:'Keep my question',onDraft(){},
      operationGate:{status:()=>gate.status(scope),subscribe:fn=>gate.subscribe(scope,fn)},
      renderProjectContext:host=>c.renderResearchProjectContext(host,{id:'chat',primaryProjectID:'project'},
        {onUpdated:async result=>{await publishing.promise;loaded=result.conversation;}}),
      onSend:async()=>{sends++;assert.equal(loaded?.assistantScope?.includeProjectContext,true);}
    });panel.append(view.element);return view;
  };
  let view=makeView();const context=view.element.querySelector('.research-project-context');
  const pending=context._projectContextOptions.setEnabled(true);
  const attemptSend=async()=>{view.element.querySelector('.rv2-input').handlers.keydown({key:'Enter',preventDefault(){}});await tick();assert.equal(sends,0);assert.equal(view.element.querySelector('.rv2-send').disabled,true);assert.equal(view.element.querySelector('.rv2-input').value,'Keep my question');};
  await attemptSend();assert.equal(applied,1);
  if(n%2){context.isConnected=false;view.dispose();view=makeView();await attemptSend();}
  saving.resolve({conversation:{id:'chat',messages:[],sources:[source],assistantScope:{includeProjectContext:true,projectContext:{contentHash:'reviewed-hash'}}}});await tick();await attemptSend();
  publishing.resolve();await pending;assert.equal(gate.status(scope),'');
  view.element.querySelector('.rv2-input').handlers.keydown({key:'Enter',preventDefault(){}});await tick();assert.equal(sends,1);view.dispose();
}
// A new mount observes an in-flight source transition, including failure cleanup.
{
  const gate=createResearchOperationGate(),release=gate.begin('owner','Opening selected passage…');
  let calls=0;const view=createResearchV2View({conversation:{sources:[source],messages:[]},initialDraft:'Pending',onDraft(){},onSend:async()=>calls++,
    operationGate:{status:()=>gate.status('owner'),subscribe:fn=>gate.subscribe('owner',fn)}});
  view.element.querySelector('.rv2-input').handlers.keydown({key:'Enter',preventDefault(){}});await tick();assert.equal(calls,0);
  assert.equal(gate.status('different-account'),'');release();assert.equal(view.element.querySelector('.rv2-send').disabled,false);view.dispose();
}

const markdown='The factor is **100 gross square feet per occupant**. *Verify* __basis__. `a_b` **[S1]** <script>alert(1)</script>';
assert(researchInlineRuns(markdown).some(run=>run.bold&&run.text==='100 gross square feet per occupant'));
assert(researchInlineRuns(markdown).some(run=>run.italic&&run.text==='Verify'));
let cited;
for(const reveal of [false,true]){
  const view=createResearchV2View({conversation:{sources:[source],messages:[{id:'answer',role:'assistant',answer:{answerText:markdown}}]},
    ...(reveal?{revealAnswerID:'answer'}:{}),onDraft(){},onCitation:(_message,id)=>{cited=id;}});
  const elements=all(view.element),answer=elements.find(node=>node.attributes['aria-label']==='Research answer');
  assert(answer.textContent.includes('100 gross square feet per occupant'));assert(!answer.textContent.includes('**'));
  assert(elements.some(node=>node.tagName==='strong'&&node.textContent==='100 gross square feet per occupant'));
  assert(!elements.some(node=>node.tagName==='script'),'Model HTML remains inert text');
  elements.find(node=>node.attributes['aria-label']==='Open citation S1').handlers.click();assert.equal(cited,'S1');view.dispose();
}
assert.equal(researchInlineRuns('Keep 2*3 and snake_case literal').map(run=>run.text).join(''),'Keep 2*3 and snake_case literal');
{
  const view=createResearchV2View({conversation:{sources:[source],messages:[
    {id:'earlier',role:'assistant',answer:{answerText:'Earlier saved answer'}},
    {id:'latest',role:'assistant',answer:{answerText:'Latest follow-up'}}]},onDraft(){}});
  assert.equal(view.focusAnswer('earlier'),true);
  const answers=view.element.querySelectorAll('.rv2-answer');
  assert(answers[0].focused&&answers[0].scrolled,'Saved-answer navigation reveals the earlier answer rather than the latest one');
  assert(!answers[1].focused);assert.equal(view.focusAnswer('missing'),false);view.dispose();
}

const items=[];
for(const [index,number] of ['1006.2.1','1020.1.1','1004.1.3'].entries()){
  const section={id:index+1,chapterID:1,chapterNumber:'10',codePrefix:'BC',sectionNumber:number,title:`Code table ${number}`};
  const body=await constructionHTMLBodyForSection(section);
  const prepared=await prepareSavedEvidenceItems({selections:[{sectionID:String(section.id),codeVersion:'2022'}],
    resolveSource:async()=>({section,body,source:{canonicalEdition:'2022',editionLabel:'2022'}})});
  assert(prepared.items[0].tables.some(table=>table.cellSuperscripts?.length),'Native source superscripts are captured');items.push(...prepared.items);
}
const refs=Array.from({length:5},(_,n)=>({type:'permitextReference',props:{referenceKind:'researchAnswer',referenceID:`qa-answer-${n+1}:answer`,label:`Research answer ${n+1}`}}));
for(const ref of refs){assert.equal(linkedResearchAnswerID(researchAnswerURL(ref.props.referenceID)),ref.props.referenceID);}
assert.equal(researchAnswerURL('bad\nid'),'');assert.equal(linkedResearchAnswerID('https://per.codes/workspace?researchAnswer=%0Aid'),'');
items.push(notebookManifestItem({cardID:'references',cardType:'finding',title:'Five saved answer references',document:{schema:'permitext-notebook-card',format:'blocknote-json',schemaVersion:2,
  document:refs.map(ref=>({type:'paragraph',content:[ref]}))}}));
const makeManifest=items=>immutableReportManifest({project:{id:'qa',name:'Five production fixes — TEST ONLY'},draftID:'qa',title:'Code table superscripts and saved answer links',
  reportDate:'2026-11-11T18:00:00Z',author:{userID:'qa',displayName:'Workflow QA'},codeEdition:'2022',reportVersion:1,items,disclaimers:[]});
const manifest=makeManifest(items);
const table=manifest.items[0].tables[0],preview=reportItemPreview(manifest.items[0]).find(part=>part.kind==='table');
assert.deepEqual(preview.cellSuperscripts,table.cellSuperscripts);
const marker=table.cellSuperscripts[0],text=table.rows[marker.row][marker.column];
assert(sourceFormattingRuns({key:'cell',text,superscriptRanges:marker.ranges},[{key:'cell',text,formats:{highlight:[[0,text.length]]}}]).some(run=>run.superscript&&run.highlight),'Native superscripts combine with report-owned highlighting');
const invalid=structuredClone(items);invalid[0].tables[0].cellSuperscripts[0].ranges=[[0,999999]];
assert.throws(()=>makeManifest(invalid),/superscript/);
const pdf=await renderReportPDF(manifest);
if(process.env.PERMITEXT_FIVE_FIX_QA_PDF)await writeFile(process.env.PERMITEXT_FIVE_FIX_QA_PDF,pdf);
const parsed=await getDocument({data:new Uint8Array(pdf),useSystemFonts:true}).promise;
const superscripts=[],uris=new Set();let printed='';
for(let n=1;n<=parsed.numPages;n++){
  const page=await parsed.getPage(n),content=await page.getTextContent();printed+=content.items.map(item=>item.str).join(' ')+'\n';
  superscripts.push(...content.items.filter(item=>/^[a-g](?:, [a-g])*$/.test(item.str)&&item.transform[0]<7));
  for(const annotation of await page.getAnnotations())if(annotation.url)uris.add(annotation.url);
}
assert(superscripts.length>=5,'Real PDF renders raised letter-footnote runs in direct evidence tables');
for(const ref of refs)assert(uris.has(researchAnswerURL(ref.props.referenceID)),'Each saved Research reference has a real PDF link annotation');
assert.equal(printed.match(/Open\s+saved\s+Research\s+answer:/g)?.length,5,'Recipients also receive a printed URL');
await parsed.destroy();
console.log('Five production regressions passed: delayed context toggle/send and remounts (5), safe live/history emphasis with citations, native table superscripts, validated ranges, and 5 clickable saved-answer PDF links.');
