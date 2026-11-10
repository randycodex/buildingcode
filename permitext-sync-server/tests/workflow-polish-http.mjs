import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sharp from 'sharp';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {emptyNotebookDocument, validateNotebookDocument} from '../notebook-contract.mjs';
import {freezeResearchV2Turn} from '../research-v2-engine.mjs';
import {assistantPassageScope, assistantProjectInformation} from '../assistant-conversation-scope.mjs';

const directory = await mkdtemp(join(tmpdir(), 'permitext-workflow-polish-'));
Object.assign(process.env, {NODE_ENV:'test', VERCEL:'', VERCEL_ENV:'',
  PERMITEXT_SYNC_DATA_PATH:join(directory,'sync.json'), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(directory,'assets'),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:'synthetic-polish-grant'});
for (const key of ['OPENAI_API_KEY','DATABASE_URL','PERMITEXT_SYNC_DATABASE_URL','POSTGRES_URL','NEON_DATABASE_URL','BLOB_READ_WRITE_TOKEN','VERCEL_OIDC_TOKEN','BLOB_STORE_ID']) delete process.env[key];
Object.assign(process.env,{OPENAI_API_KEY:'offline-polish-double',PERMITEXT_TEST_RESEARCH_MOCK:'',PERMITEXT_RESEARCH_V2:'1',
  PERMITEXT_RESEARCH_V2_BUDGET_PATH:join(directory,'budget.json'),PERMITEXT_RESEARCH_MODEL:'gpt-6-luna',
  PERMITEXT_RESEARCH_MAX_REQUEST_USD:'1',PERMITEXT_RESEARCH_USER_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD:'7',
  PERMITEXT_RESEARCH_DAILY_CAP_USD:'7',PERMITEXT_RESEARCH_MONTHLY_CAP_USD:'7',PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS:'.1',
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS:'.01',PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS:'.5',PERMITEXT_RESEARCH_PRICING_VERSION:'offline-polish-test'});
const originalFetch = globalThis.fetch, providerPackets = [];
globalThis.fetch = async (input, options) => {
  if (String(input) !== 'https://api.openai.com/v1/responses') return originalFetch(input,options);
  const body = JSON.parse(options.body); providerPackets.push(body.input);
  const output = body.text.format.name === 'permitext_v2_review' ? {pass:true,issues:[]}
    : {answerText:'The reviewed Project snapshot describes a proposed office renovation; existing conditions need confirmation.',claims:[],missingSources:[],missingFacts:[]};
  return Response.json({model:body.model,status:'completed',service_tier:'default',usage:{input_tokens:200,output_tokens:100},
    output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]});
};
let server;
try {
  const {handleRequest} = await import('../app.mjs');
  server = createServer(handleRequest); await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`, userID = 'apple:synthetic-polish', projectID = 'polish-project';
  let token;
  const post = async (path, body, expected = 200, bearer = token) => {
    const response = await fetch(base + path, {method:'POST',headers:{'content-type':'application/json',...(bearer ? {authorization:`Bearer ${bearer}`} : {})},
      body:JSON.stringify({auth:{accountUserID:userID},...body})});
    const result = await response.json(); assert.equal(response.status, expected, `${path}: ${JSON.stringify(result).slice(0,700)}`); return result;
  };
  await post('/admin/lifetime-grants/grant',{userID},200,process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  token = (await post('/account/sign-in',{credential:{provider:'apple',providerUserID:'synthetic-polish',email:'polish@example.test',displayName:'Synthetic workflow test'}})).account.backendSessionToken;
  const project = {id:'polish-record',clientID:projectID,userID,name:'Workflow polish QA',description:'Proposed office renovation; existing conditions need confirmation.',
    address:'Synthetic address',codeVersion:'2022-construction',colorHex:'#334455',sortOrder:0,updatedAt:new Date().toISOString()};
  await post('/sync/push',{batch:{user:{id:userID},mutations:[{project}]}});
  const cards = [];
  for (let index = 0; index < 5; index++) {
    const assetID = randomUUID();
    const contentType = index % 2 ? 'image/webp' : 'image/png';
    const image = await sharp({create:{width:360,height:180,channels:3,background:{r:30+index*35,g:80,b:170}}})[index % 2 ? 'webp' : 'png']().toBuffer();
    const upload = await fetch(`${base}/notebook/assets/upload?projectID=${projectID}&assetID=${assetID}`, {method:'POST',
      headers:{authorization:`Bearer ${token}`,'x-permitext-user-id':userID,'content-type':contentType},body:image});
    assert.equal(upload.status,200, await upload.text());
    const document = {...emptyNotebookDocument(),document:[
      {type:'heading',props:{level:2},content:[{type:'text',text:`Rich Note ${index+1}`,styles:{}}]},
      {type:'paragraph',content:[{type:'text',text:'Review ',styles:{}},{type:'link',href:'https://www.nyc.gov/',content:[{type:'text',text:'official source',styles:{bold:true}}]}]},
      {type:'numberedListItem',props:{start:3},content:[{type:'text',text:'First ordered review item',styles:{}}]},
      {type:'numberedListItem',content:[{type:'text',text:'Second ordered review item',styles:{}}]},
      {type:'table',content:{type:'tableContent',headerRows:2,rows:[
        {cells:[{type:'tableCell',props:{colspan:2},content:[{type:'link',href:`https://www.nyc.gov/?qa=header-${index}`,
          content:[{type:'text',text:`Reviewed conditions ${index+1}`,styles:{bold:true,backgroundColor:'yellow'}}]}]},
          [{type:'text',text:'References',styles:{bold:true}}]]},
        {cells:[[{type:'text',text:'Function',styles:{bold:true}}],[{type:'text',text:'Review notes',styles:{italic:true}}],[{type:'text',text:'Source links',styles:{underline:true}}]]},
        {cells:[[{type:'text',text:`Bold-cell-${index}`,styles:{bold:true}}],
          [{type:'text',text:`Italic-cell-${index}`,styles:{italic:true}},{type:'text',text:'\n',styles:{}},
           {type:'text',text:`Underline-cell-${index}`,styles:{underline:true}},{type:'text',text:'\n',styles:{}},
           {type:'text',text:`Strike-cell-${index}`,styles:{strike:true}},{type:'text',text:'\n',styles:{}},
           {type:'text',text:`Highlight-cell-${index}`,styles:{backgroundColor:'yellow'}}],
          [{type:'link',href:`https://www.nyc.gov/site/buildings/index.page?qa=cell-${index}`,
            content:[{type:'text',text:`Styled-cell-link-${index}`,styles:{bold:true,italic:true}}]},
           {type:'text',text:'\n',styles:{}},{type:'link',href:`mailto:qa-${index}@example.test`,content:[{type:'text',text:`Email-cell-${index}`,styles:{}}]}]]},
        ...(index === 0 ? Array.from({length:36},(_,row)=>({cells:[
          [{type:'text',text:`Continuation-row-${String(row).padStart(2,'0')}`,styles:{}}],
          [{type:'text',text:'Wrapped review text preserves the table across page breaks.',styles:{}}],
          [{type:'link',href:`https://www.nyc.gov/?qa=row-${row}`,content:[{type:'text',text:'Continuation source',styles:{italic:true,underline:true}}]}]]})) : [])
      ]}},
      {type:'paragraph',content:[{type:'text',text:'\t\t a. Footnote with inherited indentation. '.repeat(12),styles:{}}]},
      {type:'image',props:{url:`permitext-notebook-asset:${assetID}`,name:`image-${index}.png`,caption:`QA figure ${index+1}`}}
    ]};
    const card = (await post('/notebook/cards/save',{projectID,expectedVersion:0,clientMutationID:`polish-note-${index}`,cardType:'finding',title:`QA Note ${index+1}`,document,evidenceLinks:[]} ,201)).card;
    assert.deepEqual((await post('/notebook/cards/get',{projectID,cardID:card.id})).card.document, JSON.parse(JSON.stringify(validateNotebookDocument(document).document)));
    cards.push(card);
  }
  const blocks = cards.map((card,index) => index < 3 ? {id:`block-${index}`,kind:'notebookCard',sourceID:card.id,label:card.title}
    : {id:`block-${index}`,kind:'paragraph',text:card.plainText,notebookDocument:card.document,
      derivedFrom:{kind:'notebookCard',id:card.id,title:card.title,version:card.version},sourceSnapshotAt:new Date().toISOString(),evidenceLinks:[]});
  const draft = (await post('/reports/drafts/save',{projectID,title:'Rich Note workflow verification',reportDate:new Date().toISOString(),expectedVersion:0,blocks},201)).draft;
  assert.deepEqual(draft.blocks[3].notebookDocument,cards[3].document,'Editable snapshots retain the full document');
  const issued = await post('/reports/generate',{projectID,draftID:draft.id,expectedVersion:draft.version},201);
  assert.equal(issued.manifest.items.filter(item => item.document || item.notebookDocument).length,5);
  const readPDF = async () => {
    const response = await fetch(base+'/reports/files/read',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},
      body:JSON.stringify({auth:{accountUserID:userID},projectID,generatedReportID:issued.generatedReport.file.generatedReportID})});
    assert.equal(response.status,200); return Buffer.from(await response.arrayBuffer());
  };
  const pdf = await readPDF();
  assert((pdf.toString('latin1').match(/\/Subtype \/Image\b/g) || []).length >= 5,'Five image objects must reach the PDF');
  assert((pdf.toString('latin1').match(/\/URI \(https:\/\/www.nyc.gov\//g) || []).length >= 5,'Links must remain interactive');
  const parsedPDF = await getDocument({data:new Uint8Array(pdf),useSystemFonts:true}).promise;
  const textItems = [], links = [];
  for (let pageNumber=1;pageNumber<=parsedPDF.numPages;pageNumber++) {
    const page = await parsedPDF.getPage(pageNumber);
    await page.getOperatorList();
    const content = await page.getTextContent();
    for (const item of content.items) if ('str' in item) {
      textItems.push({...item,font:page.commonObjs.get(item.fontName).name});
      assert(item.transform[4] >= 53 && item.transform[4] + item.width <= 559,'Cell text stays within the PDF margins');
    }
    links.push(...(await page.getAnnotations()).filter(annotation=>annotation.subtype === 'Link'));
  }
  for (let index=0;index<5;index++) {
    assert(textItems.some(item=>item.str.includes(`Bold-cell-${index}`) && /bold/i.test(item.font)),'Table cell bold is retained');
    assert(textItems.some(item=>item.str.includes(`Italic-cell-${index}`) && Math.abs(item.transform[2]) > .1),'Table cell italics are retained');
    assert(textItems.some(item=>item.str.includes(`Styled-cell-link-${index}`) && /bold/i.test(item.font) && Math.abs(item.transform[2]) > .1),'Links retain their text marks');
    for (const marker of ['Underline-cell','Strike-cell','Highlight-cell']) assert(textItems.some(item=>item.str.includes(`${marker}-${index}`)));
    for (const target of [`https://www.nyc.gov/?qa=header-${index}`,`https://www.nyc.gov/site/buildings/index.page?qa=cell-${index}`,`mailto:qa-${index}@example.test`]) {
      assert(links.some(link=>(link.unsafeUrl || link.url) === target),`Clickable cell link retained: ${target}`);
    }
  }
  assert(links.filter(link=>(link.unsafeUrl || link.url) === 'https://www.nyc.gov/?qa=header-0').length >= 4,'Styled merged headers and their links repeat on continuation pages');
  for(let row=0;row<36;row++) assert.equal(textItems.filter(item=>item.str.includes(`Continuation-row-${String(row).padStart(2,'0')}`)).length,1,'Body rows are neither dropped nor repeated at page breaks');
  await parsedPDF.destroy();
  if (process.env.PERMITEXT_POLISH_QA_PDF) { await writeFile(process.env.PERMITEXT_POLISH_QA_PDF,pdf); await writeFile(`${process.env.PERMITEXT_POLISH_QA_PDF}.json`,JSON.stringify(issued.manifest,null,2)); }
  await post('/notebook/cards/save',{...cards[0],projectID,cardID:cards[0].id,expectedVersion:cards[0].version,clientMutationID:'polish-later-edit',document:{...emptyNotebookDocument(),document:[{type:'paragraph',content:[{type:'text',text:'Later edit',styles:{}}]}]}});
  assert.deepEqual(await readPDF(),pdf,'Issued PDF bytes remain immutable after Note edits');
  const conversation = (await post('/research/conversations/create',{projectID,analysisMode:'conversation_only'},201)).conversation;
  const preview = (await post('/research/conversations/project-context',{conversationID:conversation.id,preview:true})).snapshot;
  await post('/research/conversations/project-context',{conversationID:conversation.id,snapshotHash:'stale'},409);
  const included = (await post('/research/conversations/project-context',{conversationID:conversation.id,snapshotHash:preview.contentHash})).conversation;
  assert.equal(included.assistantScope.includeProjectContext,true);
  assert.equal(assistantProjectInformation(assistantPassageScope(included)).description, project.description);
  const packet = freezeResearchV2Turn({question:'Summarize the reviewed project context.',sources:[],projectContextSnapshot:included.assistantScope.projectContext});
  assert.equal(packet.projectContextSnapshot.projectInformation.description,project.description);
  const frozen = JSON.stringify(packet);
  const response = await post('/research/conversations/message',{ answerMode: "verified",conversationID:included.id,question:'Summarize the reviewed project context.',requestID:'polish-context-answer',
    researchEngine:'v2',analysisMode:'conversation_only',expectedRevision:included.revision,expectedEvidenceSetVersion:included.evidenceSetVersion || 1});
  const answer = response.conversation.messages.at(-1).answer;
  assert(answer.inputSnapshot, JSON.stringify({answer,providerCalls:providerPackets.length}).slice(0,2800));
  assert.equal(answer.inputSnapshot.projectContextSnapshot.contentHash,preview.contentHash);
  assert.equal(providerPackets.length,2,'A writer and a reviewer both receive the frozen context');
  assert(providerPackets.every(value => value.includes(project.description)));
  const frozenAnswer = JSON.stringify(answer);
  await post('/sync/push',{batch:{user:{id:userID},mutations:[{project:{...project,description:'Changed after review',updatedAt:new Date(Date.now()+1000).toISOString()}}]}});
  const reopened = (await post('/research/conversations/get',{conversationID:conversation.id})).conversation;
  assert.equal(reopened.assistantScope.projectContext.projectInformation.description,project.description,'Project changes do not silently update reviewed snapshots');
  await post('/research/conversations/project-context',{conversationID:conversation.id,include:false});
  assert.equal(JSON.stringify(packet),frozen,'Removing future context does not mutate captured packets');
  assert.equal(JSON.stringify((await post('/research/conversations/get',{conversationID:conversation.id})).conversation.messages.at(-1).answer),frozenAnswer,'Reviewed answers remain immutable after Project changes and exclusion');
  console.log('PASS: five rich Notes, PNG/WebP upload, table/link round trip, editable snapshots, five PDF images/links, immutable PDF, explicit/stale/frozen/excluded context.');
} finally {
  globalThis.fetch = originalFetch;
  server?.closeAllConnections(); if (server) await new Promise(resolve=>server.close(resolve));
  await rm(directory,{recursive:true,force:true});
}
