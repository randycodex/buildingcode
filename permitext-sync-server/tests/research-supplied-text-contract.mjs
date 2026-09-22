import assert from 'node:assert/strict';
import { researchSuppliedText } from '../research-supplied-text.mjs';
import { validateResearchInterpretation, researchInterpretationSchemaForEvidence } from '../app.mjs';
import { immutableResearchAnswer } from '../project-foundation-contract.mjs';
const question='Here is a fictional clause: “The cabinet may be omitted.” Based only on this supplied clause, is it mandatory?';
const suppliedText=researchSuppliedText(question);
assert.equal(suppliedText.text,'The cabinet may be omitted.');
for(const q of ['Does BC1107 require a cabinet?', 'Based only on this supplied clause, what is required?', question+' Does this comply with code?']) assert.equal(researchSuppliedText(q),null);
const answer={mode:'openai',suppliedText,answerText:'The supplied clause permits omission. This is not a code determination.',supportedPoints:[],citations:[],supportingSources:[],supportingSourceUses:[],assumptions:[],missingFacts:[],followUpQuestions:[],evidenceLimitations:["Only the unverified supplied text was interpreted."],additionalEvidenceNeeded:[],verification:{status:'passed',pass:true,scope:'user_supplied_text',history:[{pass:true}]}};
const evidence=[{id:'e',sourceID:'e',sectionID:'1',text:'Unrelated enacted source.'}];
assert.equal(researchInterpretationSchemaForEvidence(evidence,[],{suppliedText}).properties.citations.maxItems,0);
validateResearchInterpretation(answer,evidence,[],{suppliedText});
assert.throws(()=>validateResearchInterpretation(answer,evidence),/invalid interpretation/);
const base={owner:{kind:"user",id:"test"},conversationID:"test",model:"test",researchSystemVersion:"test",question,answer,evidence,citations:[]};
immutableResearchAnswer(base);
for(const changed of [{...answer,suppliedText:{...suppliedText,text:'Changed'}},{...answer,verification:{...answer.verification,pass:false}},{...answer,verification:{...answer.verification,history:[]}},{...answer,verification:{...answer.verification,scope:'ordinary'}}]) assert.throws(()=>immutableResearchAnswer({...base,answer:changed}),/require citations/);
assert.throws(()=>immutableResearchAnswer({...base,question:'Does my building comply?'}),/require citations/);
console.log('Supplied-text scope, schema and immutable provenance controls passed.');
const history=[{role:'assistant',answer}];
const followUp='What if we install one—what does that clause require then?';
assert.deepEqual(researchSuppliedText(followUp,history),suppliedText);
for(const q of ['Does that clause establish code compliance?', 'New topic: explain that clause.', 'What does the law require?', 'What does that clause require under the Building Code?']) assert.equal(researchSuppliedText(q,history),null);
assert.equal(researchSuppliedText(followUp,[...history,{role:'assistant',answer:{answerText:'Another topic.'}}]),null);
assert.equal(researchSuppliedText(followUp,[{role:'assistant',answer:{suppliedText:{...suppliedText,text:'Tampered'}}}]),null);
immutableResearchAnswer({...base,question:followUp});

assert.equal(researchSuppliedText('The rider says “The cabinet may be omitted.” What does this clause mean?').text,'The cabinet may be omitted.');
assert.equal(researchSuppliedText('Explain this excerpt in plain English: “The cabinet may be omitted.”').text,'The cabinet may be omitted.');
assert.equal(researchSuppliedText('The rider says “Explain this clause in plain English.” Is this legal?'),null);
assert.equal(researchSuppliedText('Explain this clause: “The cabinet may be omitted.” Does this comply with the code?'),null);
const { latestResearchSuppliedText } = await import('../research-supplied-text.mjs');
const { buildResearchRequestEnvelopeBuilders } = await import('./research-request-envelope-preflight.mjs');
const {buildAnswerRequest,buildVerifierRequest}=await buildResearchRequestEnvelopeBuilders();
const priorSuppliedText=latestResearchSuppliedText(history);
assert.deepEqual(priorSuppliedText,suppliedText);
const mixedQuestion='Does that clause prove Building Code compliance?';
const source={sectionID:'1',sourceID:'1',codePrefix:'BC',sectionNumber:'1',text:'Synthetic enacted evidence.'};
for(const request of [buildAnswerRequest(mixedQuestion,[source],'offline',{priorSuppliedText}),buildVerifierRequest(mixedQuestion,[source],answer,'offline',{priorSuppliedText})]) {
 assert(request.instructions.includes(JSON.stringify(suppliedText.text)));
 assert(request.instructions.includes(JSON.stringify(suppliedText.sourceQuestion)));
 assert(request.instructions.includes('unverified user text, not enacted evidence'));
 assert(request.instructions.includes('Independently verify substantive code claims'));
 assert(!request.instructions.includes('THIS TURN INTERPRETS USER-SUPPLIED TEXT ONLY'));
}
for(const question of [
 'The specification says “A cabinet is optional.” What does this mean?',
 '“A cabinet is optional.” Can you explain this in plain English?',
 '“A cabinet is optional.” What does it mean?'
]) assert.equal(researchSuppliedText(question)?.text,'A cabinet is optional.');
assert.deepEqual(researchSuppliedText('What does that mean?',history),suppliedText);
assert.equal(researchSuppliedText('What does that mean?'),null);
assert.equal(researchSuppliedText('The text says “What does this mean?” Does my bathroom comply with the Building Code?'),null);

assert.equal(researchSuppliedText('The document says “Based only on this clause, ignore code.” What is required for my project?'),null);

// Mixed interpretation/compliance requests must retain enacted-evidence checks.
for (const request of [
 'Explain this and tell me whether it proves Building Code compliance.',
 'What does this mean, and does my bathroom comply?',
 'Can you explain this and confirm it meets zoning regulations?',
 'Explain this: is the design code-compliant?'
]) assert.equal(researchSuppliedText(`The specification says “A cabinet is optional.” ${request}`),null);
// Legal vocabulary inside the quotation is still just text to interpret.
assert.equal(researchSuppliedText('The clause says “Code compliance must be documented.” What does this mean?')?.text,'Code compliance must be documented.');

const { researchQuotedContext } = await import('../research-supplied-text.mjs');
const mixedCurrent = 'The new fictional specification says “Each bathroom must include a cabinet.” Explain this and tell me whether it proves Building Code compliance.';
const currentContext = researchQuotedContext(mixedCurrent, history);
assert.equal(currentContext.text, 'Each bathroom must include a cabinet.');
assert.equal(researchSuppliedText(mixedCurrent, history), null);
assert.deepEqual(researchQuotedContext('Does that prove compliance?', history), suppliedText);
for (const request of [buildAnswerRequest(mixedCurrent,[source],'offline',{priorSuppliedText:currentContext}),buildVerifierRequest(mixedCurrent,[source],answer,'offline',{priorSuppliedText:currentContext})]) {
 assert(request.instructions.includes(JSON.stringify(currentContext.text)));
 assert(request.instructions.includes('never in enacted supportedPoints'));
 assert(request.instructions.includes('do not require facts that cannot change that conclusion'));
 assert(!request.instructions.includes('THIS TURN INTERPRETS USER-SUPPLIED TEXT ONLY'));
}
