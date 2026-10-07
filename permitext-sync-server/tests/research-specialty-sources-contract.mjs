import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createResearchCorpusRegistry, routeResearchCorpora } from "../research-corpus-registry.mjs";
import { constrainSpecialtySearchPlan, missingEnergyReferenceLookups, specialtyCodeVersion } from "../research-specialty-codes.mjs";
import { extractResearchCodeReferences } from "../research-conversation-topic.mjs";
import { enactedSection } from "../enacted-code-content.mjs";
import { immutableEvidenceSnapshot } from "../project-foundation-contract.mjs";
import { researchPassagesForSection } from "../research-passage-index.mjs";

delete process.env.PERMITEXT_RESEARCH_CURRENT_CORPUS_RECALL;
process.env.PERMITEXT_RESEARCH_SEMANTIC_SEARCH = "0";
process.env.PERMITEXT_RESEARCH_WEB_SUPPORT = "0";
globalThis.fetch = () => { throw new Error("Source contract must not call a provider."); };
const registry = createResearchCorpusRegistry();
const route = (question, previousMessages = []) => routeResearchCorpora({question, previousMessages, registry});
const ids = plan => plan.selected.map(corpus => corpus.id);
const energyID = "nyc-2025-energy-code", electricalID = "nyc-2025-electrical-amendments";
for (const question of ["Are grounding pigtails required?", "Does Romex comply in NYC?", "Explain EC 210.52."])
  assert(ids(route(question)).includes(electricalID), question);
for (const question of ["Can rigid foam fill wall furring?", "Can single-pane replicas comply?", "Explain ECC R503.1.1.2."])
  assert(ids(route(question)).includes(energyID), question);
for (const year of [2011, 2014, 2016, 2020]) {
  const plan = route(`Under the ${year} NYC Energy Conservation Code, explain roof insulation.`);
  assert(!ids(plan).includes(energyID));
  assert(plan.unavailable.some(corpus => corpus.id === `nyc-${year}-energy-code`));
}
assert(!ids(route("The house was built in 2016. Explain insulation requirements.")).includes("nyc-2016-energy-code"));
const historical = route("COMcheck passes under NYC 2016. What does the energy code require?");
assert(historical.unavailable.some(corpus => corpus.id === "nyc-2016-energy-code"));
const followup = route("What about the roof?", [{role:"user",question:"Under the 2020 NYC Energy Code, explain insulation."}]);
assert(!ids(followup).includes(energyID));
assert(followup.unavailable.some(corpus => corpus.id === "nyc-2020-energy-code"));
const switchEdition = route("Use the 2025 energy code instead.", [{role:"user",question:"Under the 2020 energy code, explain insulation."}]);
assert(ids(switchEdition).includes(energyID));
assert(!switchEdition.unavailable.length);
const mixedEditions = route("Under the 2025 electrical code and the 2016 energy code, explain the separate requirements.");
assert(ids(mixedEditions).includes(electricalID));
assert(!ids(mixedEditions).includes(energyID));
assert(mixedEditions.unavailable.some(corpus=>corpus.id==='nyc-2016-energy-code'));
const shorthand = route("What about 2014?", [{role:"user",question:"Under the 2025 energy code, explain insulation."}]);
assert(!ids(shorthand).includes("nyc-2014-construction-codes"));
assert(shorthand.unavailable.some(corpus => corpus.id === "nyc-2014-energy-code"));
const transition = route("Our energy inspection filing was October 18, 2010 and approved February 8, 2011.");
assert(!ids(transition).includes(energyID));
assert(transition.unavailable.some(corpus => corpus.id === "nyc-energy-historical"));
const completePrior = route("Our complete energy submission was filed March 29, 2026. Explain insulation.");
assert(completePrior.unavailable.some(corpus => corpus.id === "nyc-2020-energy-code"));
assert(!ids(completePrior).includes(energyID));
const uncertainPrior = route("Our energy application was filed March 29, 2026. Explain insulation.");
assert(uncertainPrior.unavailable.some(corpus => corpus.id === "nyc-energy-historical"));
assert(!ids(uncertainPrior).includes(energyID));
assert(ids(route("Our complete energy submission was filed March 30, 2026. Explain insulation.")).includes(energyID));
assert(route("Under the 2011 NYC Electrical Code, explain Romex.").unavailable.some(corpus => corpus.id === "nyc-2011-electrical-code"));
assert(ids(route("Under 2020 NEC, explain GFCI protection.")).includes(electricalID));
const constrained = constrainSpecialtySearchPlan(route("2025 NYC energy code roof insulation"), historical);
assert(!ids(constrained).includes(energyID), "Generated queries must preserve the requested edition.");
assert(constrained.unavailable.some(corpus => corpus.id === "nyc-2016-energy-code"));
assert(!constrained.requestedCorpusIDs.includes(energyID), "Dropped generated editions must not appear in the writer's requested corpus plan.");
const wrongHistorical = constrainSpecialtySearchPlan(route("2011 NYC energy code insulation"), historical);
assert(wrongHistorical.unavailable.some(corpus => corpus.id === "nyc-2016-energy-code"));
assert(!wrongHistorical.unavailable.some(corpus => corpus.id === "nyc-2011-energy-code"));
assert.deepEqual(extractResearchCodeReferences("EC 210.52 and ECC R503.1.1.2").map(reference => reference.codePrefix), ["EC", "ECC"]);

const { researchCorpusResources, assembledResearchEvidenceForTurn } = await import("../app.mjs");
const manifest = JSON.parse(await readFile(new URL("../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2025-specialty-codes/source-manifest.json", import.meta.url)));
const fingerprints = new Map(manifest.files.map(file => [file.sourceURL, file.sha256]));
let verified = 0;
for (const [id, prefix, expected] of [[energyID,"ECC",68],[electricalID,"EC",294]]) {
  const corpus = registry.find(item => item.id === id);
  assert.equal(corpus.codeVersion, specialtyCodeVersion);
  const resource = await researchCorpusResources({selected:[corpus]});
  assert.equal(resource.catalog.length, expected);
  assert(resource.catalog.every(section => section.codePrefix === prefix && section.corpusID === id));
  if (prefix === "EC") {
    const afci = resource.catalog.find(section => section.sectionNumber === "210.12(A)");
    assert(afci, "The published AFCI section must be separately addressable.");
    assert.match((await enactedSection(afci.id)).officialText, /AFCI protection/);
    assert.doesNotMatch((await enactedSection(33000088)).officialText, /AFCI protection/,
      "AFCI exceptions must not be attributed to the branch-circuit section.");
  }
  for (const summary of resource.catalog) {
    const body = await enactedSection(summary.id);
    const source = body.specialtyCodeSource;
    assert.equal(source.sourceSHA256, fingerprints.get(source.sourceURL), `Unbound source hash for ${prefix} ${summary.sectionNumber}`);
    assert.equal(source.effectiveDate, corpus.effectiveDate);
    assert(body.blocks.some(block => block.plainText?.trim()), `Missing text for ${prefix} ${summary.sectionNumber}`);
    verified++;
  }
}
process.env.PERMITEXT_RESEARCH_PASSAGE_SEARCH = "1";
const envelope = await enactedSection(33000035);
const tablePassages = researchPassagesForSection({id:33000035,codePrefix:"ECC",sectionNumber:"C402",title:"Building envelope"}, envelope);
for (const number of ["C402.1.2", "C402.6.3"]) {
  const table = tablePassages.find(passage => passage.kind === "plain_text_table" && passage.subsectionNumber === number);
  assert(table, `Complete published table ${number} must be independently searchable.`);
  assert.equal(envelope.blocks[0].plainText.slice(table.sourceOffsets.start, table.sourceOffsets.end), table.text);
  assert.match(table.text, /For SI:/, "Units must survive whole-table retrieval.");
  assert.match(table.text, number === "C402.1.2" ? /Swinging door.*U-0\.37/ : /Swinging doors 0\.20a/);
  assert.match(table.text, number === "C402.1.2" ? /g\. Swinging door U-factors.*NFRC-100/ : /a\. The maximum rate.*[\s\S]*6\.24 psf \(300 Pa\)/);
  assert(table.contextTexts.length, "The governing subsection must accompany its table.");
  assert.equal(table.scopeComplete, false, "A complete table does not determine project applicability.");
}
const doorQuestion = "Flush paint-grade opaque swinging exterior doors: U-factor and air leakage energy requirements";
const doorPacket = await assembledResearchEvidenceForTurn({question:doorQuestion,messages:[],pinnedEvidence:[],projectFacts:[],corpusPlan:route(doorQuestion)});
const doorSource = doorPacket.sources.find(source => String(source.sectionID) === "33000035");
assert(doorSource, "Door requirements must retrieve the actual envelope source.");
assert.match(doorSource.text, /TABLE C402\.(?:1\.2|6\.3)/, "Evidence must contain a complete relevant table, not only a referral.");
assert.match(doorSource.text, /For SI:/);
const opaqueDoorDelegation = tablePassages.find(passage => passage.subsectionNumber === 'C402.5.5' && /Opaque doors shall comply with Table C402\.1\.2/.test(passage.text));
const leakageRule = tablePassages.find(passage => passage.subsectionNumber === 'C402.6.3');
assert.match(leakageRule.completeSubsectionText, /2\. Fenestration in buildings[\s\S]*Section\s+C402\.6\.2 is not required to meet the air leakage requirements/,
  'A wrapped section reference cannot split the governing exception.');
const leakageTable = tablePassages.find(passage => passage.kind === 'plain_text_table' && passage.subsectionNumber === 'C402.6.3');
assert(leakageTable.contextTexts.some(text => /2\. Fenestration in buildings[\s\S]*C402\.6\.2 is not required/.test(text)),
  'The complete table must retain the complete exception in its governing lead-in.');
assert(opaqueDoorDelegation);
assert(opaqueDoorDelegation.contextTexts.some(text => /TABLE C402\.1\.2[\s\S]*Swinging door.*U-0\.37[\s\S]*g\. Swinging door U-factors/.test(text)),
  'An opaque-door rule must retain its own referenced complete table, rather than borrow a fenestration table.');
const generalEnvelopeScope = tablePassages.find(passage => passage.subsectionNumber === 'C402.1' && /Section C402\.1\.2/.test(passage.text));
assert(generalEnvelopeScope.contextTexts.some(text => /TABLE C402\.1\.2[\s\S]*Swinging door.*U-0\.37/.test(text)),
  'A published section reference to the table must retain its complete thermal requirements too.');
const generalEnvelopePacket = await assembledResearchEvidenceForTurn({question:'ECC C402.1',messages:[],pinnedEvidence:[],projectFacts:[],corpusPlan:route('Energy code opaque doors')});
assert(generalEnvelopePacket.sources.some(source => source.indexedPassage?.subsectionNumber === 'C402.1' &&
  /TABLE C402\.1\.2[\s\S]*Swinging door.*U-0\.37[\s\S]*g\. Swinging door U-factors/.test(source.text)),
  'The assembled general-envelope packet must supply the referenced opaque-door table.');
const sizingGap = {evidenceLimitations:['ECC R403.7 equipment sizing is not supplied.'],additionalEvidenceNeeded:['R403.7']};
const opaqueQuestion = 'Opaque wood exterior entrance door without glass: energy U-factor';
const thermalGap = {evidenceLimitations:['The supplied commercial text lacks the opaque-door U-factor table.'],additionalEvidenceNeeded:[]};
const thermalReferral = {corpusID:energyID,text:generalEnvelopeScope.text,truncated:false};
assert.deepEqual(missingEnergyReferenceLookups(thermalGap, route(opaqueQuestion), [thermalReferral], {question:opaqueQuestion}),
  [{number:'C402.1.2',query:'ECC C402.1.2'}], 'An unnamed door-table gap must follow its supplied thermal-rule referral.');
assert.deepEqual(missingEnergyReferenceLookups(thermalGap, historical, [thermalReferral], {question:opaqueQuestion}), []);
assert.deepEqual(missingEnergyReferenceLookups(thermalGap, route(opaqueQuestion), [{...thermalReferral,truncated:true}], {question:opaqueQuestion}), []);
assert.deepEqual(missingEnergyReferenceLookups(thermalGap, route('Energy code windows'), [thermalReferral], {question:'Glazed window U-factor'}), []);
assert.deepEqual(missingEnergyReferenceLookups(thermalGap, route(opaqueQuestion), [thermalReferral], {question:'Wood-framed glazed door U-factor'}), []);
const thermalPacket = await assembledResearchEvidenceForTurn({question:'ECC C402.1.2',messages:[],pinnedEvidence:[],projectFacts:[],corpusPlan:route(opaqueQuestion)});
const thermalSource = thermalPacket.sources.find(source => source.indexedPassage?.subsectionNumber === 'C402.1.2' &&
  /TABLE C402\.1\.2[\s\S]*Swinging door.*U-0\.37[\s\S]*g\. Swinging door U-factors/.test(source.text));
assert(thermalSource && !thermalSource.truncated, 'The followed referral must supply a complete thermal table and its footnote.');
assert.deepEqual(missingEnergyReferenceLookups(thermalGap, route(opaqueQuestion), [thermalReferral,thermalSource], {question:opaqueQuestion}), []);
assert.deepEqual(missingEnergyReferenceLookups(sizingGap, route('Energy code equipment sizing')), [{number:'R403.7',query:'ECC R403.7'}]);
assert.deepEqual(missingEnergyReferenceLookups(sizingGap, historical), [], 'A lookup must not substitute current law for a historical request.');
const sizingPacket = await assembledResearchEvidenceForTurn({question:'ECC R403.7',messages:[],pinnedEvidence:[],projectFacts:[],corpusPlan:route('Energy code equipment sizing')});
const sizingSource = sizingPacket.sources.find(source => source.corpusID === energyID && /(?:^|\n)R403\.7\s/.test(source.text));
assert(sizingSource, 'An exact missing-subsection lookup must supply the actual sizing rule.');
assert.equal(sizingSource.indexedPassage.subsectionNumber, 'R403.7', 'ECC references must receive exact-subsection priority.');
assert.match(sizingSource.text, /ACCA Manual S[\s\S]*ACCA[\s\S]*Manual J/);
assert.deepEqual(missingEnergyReferenceLookups(sizingGap, route('Energy code equipment sizing'), [sizingSource]), [], 'Already supplied rules must not trigger another lookup.');
for (const question of ["Under 2025 NYC Electrical Code, which rooms need air-conditioner receptacles?",
  "Under the 2025 NYC Energy Code, is roof recover exempt?"]) {
  const packet = await assembledResearchEvidenceForTurn({question,messages:[],pinnedEvidence:[],projectFacts:[],corpusPlan:route(question)});
  const specialty = packet.sources.filter(source => [energyID,electricalID].includes(source.corpusID));
  assert(specialty.length, `No specialty text retrieved: ${question}`);
  assert(specialty.every(source => source.sourceCoverage?.boundary &&
    source.sourceProvenance?.sourceSHA256 === fingerprints.get(source.sourceProvenance?.sourceURL)),
  "Edition coverage and publication provenance must survive passage assembly.");
  const snapshot = immutableEvidenceSnapshot({source:specialty[0]});
  assert.equal(snapshot.provenance.publication.sourceSHA256, specialty[0].sourceProvenance.sourceSHA256);
  assert.equal(snapshot.sourceCoverage.boundary, specialty[0].sourceCoverage.boundary);
  const savedBoundary = snapshot.sourceCoverage.boundary;
  specialty[0].sourceCoverage.boundary = "mutated after snapshot";
  assert.equal(snapshot.sourceCoverage.boundary, savedBoundary, "Published source boundaries must be immutable in the saved snapshot.");
}
console.log("Research electrical/energy source contract passed", {verified, publications:fingerprints.size});
