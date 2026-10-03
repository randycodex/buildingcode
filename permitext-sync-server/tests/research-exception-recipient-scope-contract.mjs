import assert from "node:assert/strict";
import {
  researchClaimScopeInstruction,
  researchZoningExplanationScopeInstruction,
  researchExceptionRecipientScopeInstruction
} from "../research-claim-scope.mjs";
import { buildResearchRequestEnvelopeBuilders } from "./research-request-envelope-preflight.mjs";

globalThis.fetch = () => { throw new Error("Exception recipient contracts forbid network/provider calls."); };
const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders();
for (const instruction of [researchClaimScopeInstruction, researchZoningExplanationScopeInstruction]) {
  assert(instruction.includes(researchExceptionRecipientScopeInstruction));
  assert.match(instruction, /Retain expressly shared modifiers, conjunctions and eligibility conditions/);
  assert.match(instruction, /item-by-item recipient check in answerText and supportedPoints when drafting, revising and reviewing/);
}

// Fabricated sources exercise mixed-recipient coordination and its converse.
// These are exact request-boundary checks, not generated legal-answer grading.
const fixtures = [
  {
    id: "separate-building-recipient",
    source: "The synthetic facade test excludes portions occupied by maintenance entrances; doors to emergency passages; and detached workshop buildings used exclusively for fabrication.",
    question: "Our mixed-use building has a workshop room. Is that room excluded from the facade test?",
    supported: "A workshop room is not the stated detached-workshop-building recipient. The building category also retains the exclusive-fabrication condition.",
    wrong: "Portions occupied by maintenance entrances, emergency doors or workshop buildings are excluded, including the workshop room."
  },
  {
    id: "expressly-shared-portion-modifier",
    source: "The synthetic area test excludes portions occupied by maintenance entrances, service corridors or pump equipment. The same portion-based exemption applies to all three listed items.",
    question: "Does the pump exemption cover the whole building?",
    supported: "The stated exemption covers the portion occupied by pump equipment, not the whole building.",
    wrong: "Pump equipment is a separately exempted whole-building category, so the whole building is excluded."
  },
  {
    id: "equipment-recipient-with-own-condition",
    source: "The synthetic protection test excludes portions used as access lanes; unoccupied service sheds; and appliances equipped with an approved automatic shutdown. An appliance exception does not extend to equipment merely served by it.",
    question: "The coil is served by an appliance with automatic shutdown. Does that exempt the coil?",
    supported: "The stated appliance exemption does not extend to a served coil merely because of that relationship.",
    wrong: "Portions occupied by access lanes, service sheds or automatically shutting-down appliances are exempt, so the served coil is exempt."
  }
];

let envelopes = 0;
for (const fixture of fixtures) {
  for (const specialized of [false, true]) {
    const source = { sectionID: `synthetic-${fixture.id}`, sourceID: `synthetic-passage-${fixture.id}`,
      codePrefix: specialized ? "ZR" : "BC", sectionNumber: "999", title: "Fabricated coordinated exemptions", text: fixture.source };
    const options = { responseStyle: "conversational",
      ...(specialized ? { zoningPlan: { questionSignals: { streetscapeExplanation: true } } } : {}) };
    const draft = buildAnswerRequest(fixture.question, [source], "offline-recipient", options);
    const revision = buildAnswerRequest(fixture.question, [source], "offline-recipient", {
      ...options,
      previousInterpretation: { answerText: fixture.wrong, supportedPoints: [{ explanation: fixture.wrong, sourceIDs: [source.sourceID], sectionID: source.sectionID }] },
      revisionFeedback: [{ type: "misstated_provision", detail: "Preserve the exception recipient and eligibility condition in every affected claim; do not distribute an item-specific modifier." }]
    });
    for (const request of [draft, revision]) {
      assert(request.instructions.includes(researchExceptionRecipientScopeInstruction), `${fixture.id}: writer/revision recipient rule missing`);
      assert(request.input.includes(fixture.question));
      assert(request.input.includes(fixture.source), `${fixture.id}: exception source rewritten`);
      assert.equal(request.text.format.strict, true);
      envelopes += 1;
    }
    for (const narrative of [fixture.supported, fixture.wrong]) {
      const proposal = { answerText: narrative, supportedPoints: [{ explanation: narrative, sourceIDs: [source.sourceID], sectionID: source.sectionID }] };
      const reviewer = buildVerifierRequest(fixture.question, [source], proposal, "offline-recipient", options);
      assert(reviewer.instructions.includes(researchExceptionRecipientScopeInstruction), `${fixture.id}: reviewer recipient rule missing`);
      assert(reviewer.input.includes(fixture.source), `${fixture.id}: reviewer must retain exact source`);
      assert(reviewer.input.includes(narrative), `${fixture.id}: proposed claim must reach review unchanged`);
      assert.equal(reviewer.text.format.strict, true);
      envelopes += 1;
    }
  }
}
console.log(`Exception recipient scope reaches ${envelopes} ordinary/zoning writer, revision and reviewer envelopes; heterogeneous and genuinely shared modifiers, qualifications and proposed claims remain exact. No provider calls or generated-answer acceptance.`);
