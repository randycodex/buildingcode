// A recorded seed answer supplies conversation context; practical drafts and
// verifier verdicts are offline doubles. Rejected guidance must never persist.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const recorded = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-compact-confirmation-2026-09-08.json", import.meta.url)));
const scratch = await mkdtemp(join(tmpdir(), "permitext-decision-fact-http-"));
for (const name of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
Object.assign(process.env, {
  NODE_ENV: "", OPENAI_API_KEY: "offline-response-double", PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"), PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(), PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1.50", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "2",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "2", PERMITEXT_RESEARCH_DAILY_CAP_USD: "2", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "2",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12", PERMITEXT_RESEARCH_PRICING_VERSION: "offline-test",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: ".2", PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2", PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "offline-test"
});
const nativeFetch = globalThis.fetch;

const { isResearchPracticalNextStep, researchPracticalNextStepTarget } = await import('../research-practical-next-step.mjs');
const codeBasisQuestion = 'Is the building a prior-code building for purposes of BC 901.9?';
assert.equal(researchPracticalNextStepTarget([
  {role:'assistant', answer:{followUpQuestions:['What is the alteration value?']}},
  {role:'assistant', answer:{followUpQuestions:[codeBasisQuestion]}},
  {role:'user',question:"I'm not sure"}
]), codeBasisQuestion, 'Resolve uncertainty against the latest question, not an earlier cost question.');
const history = [{role:'assistant', answer:{answerText:'The use is unresolved.',followUpQuestions:['What is the approved occupancy?']}}];
for (const question of ["I'm not sure. What should I check first?", "I'm not sure.", "I don’t know", "Not sure", 'Where can I find that?', 'How do I check that?']) assert(isResearchPracticalNextStep(question, history));
for (const question of ['Does my building need sprinklers?', "I'm not sure whether BC 903.2 requires sprinklers.", 'What should I check first? Does BC 903.2 apply?']) assert(!isResearchPracticalNextStep(question, history));
assert(!isResearchPracticalNextStep('What should I check first?', []));
assert(!isResearchPracticalNextStep("I'm not sure", [{role:'assistant',answer:{answerText:'The provision names this code.',followUpQuestions:[],missingFacts:[]}}]), 'An answered rule explanation must not become an unresolved compliance question.');
let practical = false, accept = true, phases = [], expectedTarget = '';
const guidance = {answerText:'As a practical first step, look for the approved use of the affected space in your available project records. If you cannot find it, ask the person preparing the work what use is recorded. This does not determine whether sprinklers are required.', supportedPoints:[], assumptions:[], missingFacts:['Approved use of the affected space is unknown.'], followUpQuestions:[], evidenceLimitations:['No compliance determination is made in this fact-finding guidance.'], additionalEvidenceNeeded:[], supportingSourceUses:[], citations:[]};
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), 'https://api.openai.com/v1/responses');
  const body = JSON.parse(options.body); const phase = body.text.format.name; phases.push(phase);
  if (practical) assert(body.instructions.includes(JSON.stringify(expectedTarget)), 'Both generation and verification receive the exact preceding question.');
  let output;
  if (phase === 'permitext_code_interpretation') {
    if (practical) {
      assert(body.instructions.includes('PRACTICAL NEXT-STEP GUIDANCE ONLY'));
      assert.equal(body.text.format.schema.properties.citations.maxItems, 0);
      output = [{type:'message',content:[{type:'output_text',text:JSON.stringify(guidance)}]}];
    } else output = recorded.providerCalls.find(c=>c.caseID === 'PC-04' && c.phase === phase).output;
  } else {
    assert.equal(phase, 'permitext_research_verification');
    if (practical) assert(body.instructions.includes('PRACTICAL NEXT-STEP GUIDANCE ONLY'));
    const verdict = !practical || accept ? {pass:true,issues:[],missingFactsOnly:false,unnecessaryMissingFactIndices:[]} : {pass:false,issues:[{type:'unsupported_requirement',detail:'Synthetic rejection of unsafe guidance must prevent delivery.'}],missingFactsOnly:false,unnecessaryMissingFactIndices:[]};
    output = [{type:'message',content:[{type:'output_text',text:JSON.stringify(verdict)}]}];
  }
  return Response.json({model:body.model,status:'completed',usage:{input_tokens:100,output_tokens:100,total_tokens:200},output});
};
let server;
try {
  const { immutableResearchAnswer } = await import('../project-foundation-contract.mjs');
  const { handleRequest, validateResearchInterpretation } = await import('../app.mjs');
  assert.throws(()=>validateResearchInterpretation(guidance,[]), /invalid interpretation/);
  assert.equal(validateResearchInterpretation(guidance,[],[],{practicalNextStep:true}).citations.length,0);
  server=createServer(handleRequest); await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const request=async(path,body,token)=>{const response=await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
  const signed=await request('/account/sign-in',{credential:{provider:'web',providerUserID:randomUUID(),displayName:'Offline practical guidance'}}); const account=signed.body.account; const token=account.backendSessionToken; const auth={accountUserID:account.appUserID};
  await request('/admin/lifetime-grants/grant',{userID:account.appUserID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const zoningConversation = await request('/research/conversations/create',{auth},token);
  phases=[];
  const zoning = await request('/research/conversations/message',{auth,conversationID:zoningConversation.body.conversation.id,question:'Does zoning allow our proposed interior alteration?',requestID:randomUUID()},token);
  assert.equal(zoning.status,422); assert.equal(zoning.body.code,'RESEARCH_ZONING_SOURCE_UNAVAILABLE'); assert.equal(zoning.body.charged,false); assert.deepEqual(phases,[]);
  for (const accepted of [true,false]) {
    practical=false; accept=accepted;
    const created=await request('/research/conversations/create',{auth},token); const conversationID=created.body.conversation.id;
    const seed=await request('/research/conversations/message',{auth,conversationID,question:recorded.results.find(r=>r.id==='PC-04').question,requestID:randomUUID()},token);
    assert.equal(seed.status,200,JSON.stringify(seed.body));
    expectedTarget = researchPracticalNextStepTarget(seed.body.conversation.messages);
    assert(expectedTarget.length > 0);
    practical=true; phases=[];
    const response=await request('/research/conversations/message',{auth,conversationID,question:accepted ? "I'm not sure." : "I'm not sure. What should I check first?",requestID:randomUUID()},token);
    assert.equal(response.status,accepted?200:502,JSON.stringify(response.body));
    const reopened=await request('/research/conversations/get',{auth,conversationID},token);
    const answers=reopened.body.conversation.messages.filter(m=>m.role==='assistant');
    assert.equal(answers.length,accepted?2:1);
    assert.equal(phases.filter(p=>p==='permitext_research_verification').length,accepted?1:2);
    if (accepted) {
      const answer = answers.at(-1).answer;
      assert.equal(answer.answerText,guidance.answerText); assert.deepEqual(answer.citations,[]);
      const base = {question:"I'm not sure. What should I check first?",answer,evidence:[{id:'test',sourceID:'test'}],citations:[]};
      for (const changed of [
        {...answer,practicalNextStep:false},
        {...answer,verification:{...answer.verification,pass:false}},
        {...answer,verification:{...answer.verification,scope:'ordinary'}},
        {...answer,verification:{...answer.verification,history:[]}},
        {...answer,followUpQuestions:['Repeat the unanswered question?']}
      ]) assert.throws(()=>immutableResearchAnswer({...base,answer:changed}),/require citations/);
      assert.throws(()=>immutableResearchAnswer({...base,question:'Does BC 903.2 require sprinklers?'}),/require citations/);
    }
  }
} finally { globalThis.fetch=nativeFetch; if(server){server.closeAllConnections();await new Promise(r=>server.close(r));} await rm(scratch,{recursive:true,force:true}); }
console.log('Practical next-step HTTP checks passed: narrowly scoped empty bindings, independent verifier acceptance and rejection, no paid calls.');
