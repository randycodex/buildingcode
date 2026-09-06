import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import vm from 'node:vm';
import { reportResearchPlainText, reportCitationLabel, reportCodeBasisLines } from '../report-presentation.mjs';
import { renderReportPDF } from '../report-pdf.mjs';
import { notebookPlainText } from '../notebook-contract.mjs';
import { researchWebSupportTrigger } from '../research-source-policy.mjs';
import { applyResearchOutsideAuthorityStartingPoints } from '../research-answer-presentation.mjs';

const question = 'Using the selected 2014 BC 1010.2 passage, summarize the ramp slope rule and its stated exceptions for this synthetic Project. Keep the Project’s assumptions and partial sprinkler coverage explicit; do not treat them as confirmed applicability or whole-building sprinkler protection. Identify what must be verified before applying the rule.';
const discovery = [{ sourceName: 'NYC Zoning Resolution', sourceURL: 'https://zr.planning.nyc.gov/' }];
const sourcePolicy = researchWebSupportTrigger({ question, outsideLibraryRequired: true }, {});
assert.equal(sourcePolicy.useWeb, false);
assert(sourcePolicy.reasons.includes('selected_evidence_boundary'));
const revised = { answerText: 'Use **1:12** for an *assumed* egress ramp; verify applicability. Only the cellar is sprinklered.', evidenceLimitations: ['The actual code basis and ramp role remain unconfirmed.'] };
const before = structuredClone(revised);
for (let pass = 0; pass < 2; pass++) {
  assert.deepEqual(applyResearchOutsideAuthorityStartingPoints(revised, discovery, { sourcePolicy }), before,
    'Both initial presentation and post-verifier repair must respect the selected-passage boundary.');
}
assert.deepEqual(applyResearchOutsideAuthorityStartingPoints(revised, discovery), before, 'No policy decision must fail closed.');
const externalPolicy = researchWebSupportTrigger({ question: 'Find official OMH requirements for this licensed program.', outsideLibraryRequired: true }, {});
const external = applyResearchOutsideAuthorityStartingPoints(revised,
  [{ sourceName: 'NYS Office of Mental Health', sourceURL: 'https://omh.ny.gov/omhweb/policy_and_regulations/' }], { sourcePolicy: externalPolicy });
assert.match(external.answerText, /Office of Mental Health/);
assert.match(external.evidenceLimitations.at(-1), /not a source-bound substantive rule/);
assert.deepEqual(revised, before);

assert.equal(reportResearchPlainText('**Use 1:12**; *assumed* egress. **1:7**. 2 * 3 = 6. `BC 1010.2`'), 'Use 1:12; assumed egress. 1:7. 2 * 3 = 6. BC 1010.2');
assert.equal(reportResearchPlainText('[Official source](https://example.test/source)'), 'Official source (https://example.test/source)');
const citation = { sectionID: 'internal-section', sourceIDs: ['internal-source'], codePrefix: 'BC', sectionNumber: '1010.2', title: 'Slope', codeEdition: '2014 NYC Construction Codes' };
assert.equal(reportCitationLabel(citation), 'BC · § 1010.2 · Slope — 2014 NYC Construction Codes');
assert.match(reportCitationLabel({}, [{sectionNumber:'1010.2', codeEdition:'2022'}]), /unavailable/, 'Missing source identity must not bind to an unidentified snapshot.');
assert.equal(reportCitationLabel({ sectionID: 'internal-section', sourceIDs: ['internal-source'] }, [{ sectionID: 'internal-section', sourceID: 'internal-source', sectionNumber: '1010.2', codeBook: 'BC', codeEdition: '2014' }]), 'BC · § 1010.2 — 2014');
assert.match(reportCitationLabel({ sectionID: 'internal-section', sourceIDs: ['other-edition-source'] }, [{ sectionID: 'internal-section', sourceID: 'internal-source', sectionNumber: '1010.2', codeBook: 'BC', codeEdition: '2022' }]), /unavailable/);

const noteDocument = { schema: 'permitext-notebook-card', schemaVersion: 2, format: 'blocknote-json', document: [{ type: 'paragraph', content: [
  { type: 'text', text: 'Retained review.', styles: {} },
  { type: 'permitextReference', props: { referenceKind: 'researchAnswer', referenceID: 'answer', label: 'Research: saved answer' } },
  { type: 'text', text: 'Next sentence.', styles: {} }
] }] };
const originalNote = structuredClone(noteDocument);
assert.equal(notebookPlainText(noteDocument), 'Retained review. Research: saved answer Next sentence.');
assert.deepEqual(noteDocument, originalNote);

// The actual browser functions are exercised, including the pane gate that
// caused a successful conversation GET to show History without its answer.
const client = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function extract(name, next) { const start=client.indexOf(name); const end=client.indexOf(next,start+name.length); assert(start>=0&&end>start);return client.slice(start,end); }
function harness({ unavailable=false, stale=false }={}) {
  const state={ utilities:{}, paneWeights:{}, paneOrder:[] }, seen=[];
  const context=vm.createContext({
    state, researchOpenGeneration:0, researchConversationPaneOpened:false,
    track:{querySelector:()=>null}, activeAccount:()=>({userID:'local',sessionToken:'local-session'}),
    activeProjectIDForCodeQuestions:()=> 'project',
    fetchAuthoritativeResearchConversation:async()=>{if(unavailable)throw new Error('Unavailable');return {id:'conversation',primaryProjectID:'project'};},
    researchOpenContextIsCurrent:()=>!stale, showWebNotice:async(...args)=>seen.push(args),
    codeQuestionWorkspaceEnabled:()=>false, questionsForActiveProject:()=>[],
    paneIDForResearchConversation:(id=state.researchConversationID)=>id?`research:${id}`:'',
    defaultPaneWidthForID:()=>600, primarySavedPaneID:()=> 'saved', saveWorkspaceState(){},
    openProjectDetails:()=>[], transitionWorkspace:async()=>seen.push(context.researchConversationPaneIsOpen()),
    scrollPaneIntoView:id=>seen.push(id),requestAnimationFrame(){},
    supplementalResearchConversationIDs:[],
    notebookResearchAnswers:foundation=>foundation.researchAnswers||[],
  });
  vm.runInContext(extract('function researchConversationPaneIsOpen()', 'function paneIDForSectionDetail(')+
    extract('async function openResearchConversation(conversationID', 'function researchRelativeDate(')+
    extract('async function openNotebookReference(', 'function privateCacheFallbackAllowed('),context);
  return {context,state,seen};
}
const opened=harness();
await opened.context.openNotebookReference({}, { researchAnswers:[{id:'answer',conversationID:'conversation'}] }, {referenceKind:'researchAnswer',referenceID:'answer'});
assert.equal(opened.state.researchConversationID,'conversation');
assert.equal(opened.context.researchConversationPaneIsOpen(),true);
assert(opened.seen.includes(true),'The answer pane is visible during the transition.');
for(const mode of [{unavailable:true},{stale:true}]) {const h=harness(mode);await h.context.openResearchConversation('conversation');assert.equal(h.context.researchConversationPaneIsOpen(),false);}
await assert.rejects(harness().context.openNotebookReference({}, {researchAnswers:[]}, {referenceKind:'researchAnswer',referenceID:'missing'}), /reference is unavailable/);

const manifest={id:'synthetic-manifest',immutable:true,schemaVersion:2,generatorVersion:'local-report-handoff-test',contentHash:'b'.repeat(64),title:'Synthetic Research handoff',reportVersion:1,reportDate:'2026-09-06T00:00:00Z',createdAt:'2026-09-06T00:00:00Z',author:{displayName:'Synthetic reviewer'},project:{name:'Synthetic Project',address:'No real property'},codeEdition:'2022 NYC Construction Codes',disclaimers:['Synthetic review; verify enacted sources.'],items:[
  {id:'intro',kind:'paragraph',order:0,sourceClassification:'user-authored',text:'Research → Note → Report. Only the cellar is sprinklered. Retain ≥ and ≤.'},
  {id:'note',kind:'paragraph',order:1,sourceClassification:'user-authored',text:notebookPlainText(noteDocument)},
  {id:'answer',kind:'researchAnswer',order:2,sourceClassification:'ai-assisted',question,conclusion:revised.answerText,explanation:'The **1:7** garage exception remains conditional.',supportedPoints:[{heading:'Conditional exception',explanation:'No more than three stories; verify below-grade levels and nonaccessible egress.'}],citations:[citation],evidence:[],codeEdition:'2014 NYC Construction Codes',authorityLabel:'Conditional on Project facts',codeBasis:{disclosure:'Only the selected 2014 evidence was reviewed.'},missingFacts:['Actual filing basis and ramp function'],limitations:revised.evidenceLimitations,disclaimer:'AI-assisted review, not an official determination.'}
]};
assert.deepEqual(reportCodeBasisLines(manifest), ['Project default: 2022 NYC Construction Codes','Included Research basis: 2014 NYC Construction Codes','Source applicability must be verified for this Project.']);
const originalManifest=structuredClone(manifest);
const pdf=await renderReportPDF(manifest);
assert(pdf.subarray(0,5).equals(Buffer.from('%PDF-')));
assert(pdf.length>10000);
assert.deepEqual(manifest,originalManifest,'Rendering must preserve all saved source and edition fields.');
if(process.env.PERMITEXT_REPORT_REVIEW_DIR){await mkdir(process.env.PERMITEXT_REPORT_REVIEW_DIR,{recursive:true});await writeFile(process.env.PERMITEXT_REPORT_REVIEW_DIR+'/web-research-handoff.pdf',pdf);}

// Older Notes retain their canonical document and stored revision. Read-time
// plain text for a new Report snapshot is derived from that document, not from
// the old concatenated convenience field.
const server = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
const begin = server.indexOf('function notebookCardForClient(');
const finish = server.indexOf('async function authenticatedNotebookBody(', begin);
const noteContext = vm.createContext({ notebookPlainText });
vm.runInContext(server.slice(begin, finish), noteContext);
const stored = { envelope:{id:'note',version:2},payload:{document:noteDocument,plainText:'Retained review.Research: saved answerNext sentence.'} };
const originalStored=structuredClone(stored);
const projected=noteContext.notebookCardForClient(stored,['project']);
assert.equal(projected.plainText,'Retained review. Research: saved answer Next sentence.');
assert.equal(projected.version,2);
assert.deepEqual(stored,originalStored);
assert.equal(noteContext.notebookCardForClient({envelope:{id:'legacy',version:1},payload:{plainText:'Legacy text'}}).plainText,'Legacy text');
console.log('Research handoff presentation passed: selected-authority boundary, Note pane navigation, reference separation, readable editions/citations, immutable Report rendering.');
