import assert from 'node:assert/strict';
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA='1';
globalThis.fetch=async()=>{throw Error('Offline check');};
const {assembledResearchEvidenceForTurn}=await import('../app.mjs');
const questions=[
'Use the 2022 NYC Construction Codes and 2022 NYC Fire Code. This conversation concerns hypothetical schematic-design examples for a proposed new building at 1070 Southern Boulevard, Bronx, with ground-floor retail and community-facility space. Do not treat the examples as confirmed project facts. Under the NYC Plumbing Code, what minimum and maximum liquid seal depths are permitted for an ordinary fixture trap? Cite the governing section and explain briefly.',
'For that same ordinary fixture trap, would a 6-inch liquid seal comply? Explain briefly.',
'Does that section allow any deeper seal for special designs relating to accessible fixtures, or is the ordinary maximum absolute? Explain the scope of the exception.',
'For an ordinary trap with no special accessible-fixture design, is a 1.5-inch liquid seal allowed?',
'Is a liquid seal exactly 4 inches deep allowed for the same ordinary trap, or must it be less than 4 inches?',
'Can I install two traps in series on the same fixture to provide extra protection against sewer gas? Cite the relevant rule.'
];
const messages=questions.flatMap((question,index)=>[{role:'user',question},{role:'assistant',answer:{answerText:index===5?'No. A fixture shall not be double trapped (PC1002.1).':'Ordinary liquid seals are 2–4 inches (PC1002.4).',citations:[{codePrefix:'PC',sectionNumber:index===5?'1002.1':'1002.4'}],verification:{pass:true}}}]);
const {researchEvidenceRetrievalQuery}=await import('../research-evidence-assembly.mjs');
assert.equal(researchEvidenceRetrievalQuery({question:'Are S-traps permitted for ordinary plumbing fixtures under this code? Cite the relevant rule.',previousMessages:messages}).relevanceComparison,false);
const assembled=await assembledResearchEvidenceForTurn({question:'Are S-traps permitted for ordinary plumbing fixtures under this code? Cite the relevant rule.',messages,pinnedEvidence:[],projectFacts:[]});
console.log(assembled.sources.map(s=>`${s.codePrefix} ${s.sectionNumber}`).join(', '));
assert(assembled.sources.some(s=>s.codePrefix==='PC'&&s.sectionNumber==='1002.3'&&/S.*traps/i.test(s.text)),'Named trap rule must survive long related conversation');
console.log('Named trap continuity passed.');
