import assert from "node:assert/strict";
import { buildResearchRequestEnvelopeBuilders } from "./research-request-envelope-preflight.mjs";

globalThis.fetch = async () => { throw new Error("Network forbidden in instruction contract."); };
const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders();
const source = (codePrefix, sectionNumber) => ({ sectionID: `synthetic-${codePrefix}-${sectionNumber}`,
  sourceID: `passage-${codePrefix}-${sectionNumber}`, codePrefix, sectionNumber, title: "Synthetic input fixture",
  text: "Exact selected text sentinel; condition A AND condition B.", origin: "user_pinned", userSelectedText: true,
  codeVersion: "fixture-prior-edition", evidenceApplicability: "historical" });
const instructions = (question, evidence) => buildAnswerRequest(question, evidence, "offline-contract", { responseStyle: "conversational" }).instructions;
const ordinary = instructions("Can this proposal comply?", [source("PC", "412.4")]);
assert.doesNotMatch(ordinary, /BC 303\.1\.3 is the direct authority|When discussing Type B\+NYC|When BC 901\.9\.3/,
  "Unrelated specialized hints must not occupy an ordinary laundry request.");
for (const [code, section, expected] of [
  ["BC", "303.1.3", /Do not turn this option into a prohibition/],
  ["PC", "403.1.1", /add the resulting fractional requirements, and only then round up/],
  ["BC", "901.9.3", /distinguish the enlarged-portion rule/],
  ["BC", "1107.2.2.7", /keep lavatory and vanity as distinct terms/],
  ["BC", "1101.3.1", /preserve that ancestor condition/]
]) assert.match(instructions("Apply the selected provision.", [source(code, section)]), expected);
assert.match(instructions("Apply the whole selected section.", [source("PC", "403.1")]), /add the resulting fractional requirements, and only then round up/,
  "A selected parent may contain the calculation subsection; retain its conditional hint.");
assert.doesNotMatch(instructions("Apply the selected provision.", [source("PC", "403.10")]), /When supplied PC 403.1 text/,
  "Similar section-number prefixes must not be treated as parent scope.");
for (const question of ["May we share facilities?", "Are shared facilities permitted?", "Does this space share facilities?", "What about sharing facilities?"])
  assert.match(instructions(question, [source("BC", "303.1.3")]), /selected evidence does not establish that permission/);
assert.match(instructions("What about sharing facilities?", [source("BC", "1007.1.1")]), /selected evidence does not establish that permission/);
assert.match(instructions("Does the Type B+NYC provision apply?", []), /make the Building Code discussion conditional/);
assert.match(instructions("Does the agency require a vanity?", []), /keep lavatory and vanity as distinct terms/);

const evidence = [source("BC", "1007.1.1")];
evidence[0].visualSources = [{ id: "fixture-visual", assetName: "fixture.png", mediaType: "image/png", dataBase64: "AA==", byteLength: 1, contentHash: "synthetic-hash" }];
const options = { responseStyle: "conversational", projectContextFacts: ["Owner representation: prior-code status is unverified."],
  messages: [{ role: "user", question: "Earlier active-topic user fact sentinel." }],
  conversationFactContext: { established: ["Established fact sentinel."], hypothetical: ["Hypothetical sentinel."], unknown: ["Unknown sentinel."] },
  webSupport: { sources: [{ id: "synthetic-web-source", authorityClass: "official_guidance", title: "Synthetic guidance fixture",
    publisher: "Synthetic publisher", url: "https://www.nyc.gov/synthetic-fixture",
    attributedClaims: [{ id: "synthetic-web-claim", text: "Guidance claim sentinel." }] }],
    limitation: "Official document unavailable sentinel." }, structuredResponseRetry: true };
const body = buildAnswerRequest("Current question sentinel.", evidence, "offline-contract", options);
assert.equal(body.max_output_tokens, 3000);
assert.deepEqual(body.reasoning, { effort: "low" });
assert.equal(body.store, false);
assert.equal(body.text.format.strict, true);
const serializedInput = JSON.stringify(body.input);
for (const sentinel of ["Current question sentinel.", evidence[0].text, "fixture-prior-edition", "Earlier active-topic user fact sentinel.",
  "Established fact sentinel.", "Hypothetical sentinel.", "Unknown sentinel.", "Owner representation: prior-code status is unverified.", "Official document unavailable sentinel.",
  "WEB_SOURCE_ID: synthetic-web-source", "WEB_CLAIM_ID: synthetic-web-claim", "Guidance claim sentinel."])
  assert(serializedInput.includes(sentinel), `Lost input: ${sentinel}`);
assert.deepEqual(body.input[0].content.at(-1), { type: "input_image", image_url: "data:image/png;base64,AA==", detail: "original" });
for (const policy of [/exact supplied identifiers/, /not independently verified facts/, /Label illustrations hypothetical; never use them to introduce unsupported law/,
  /Never promote an earlier assistant conclusion/, /REQUIRED_CLAIM_COVERAGE/, /USER_SELECTED_TEXT/, /Never cite irrelevant/,
  /historical, prior-edition case-specific, or future-effective/, /noncontrolling/, /WEB_SOURCE_ID and WEB_CLAIM_ID/])
  assert.match(body.instructions, policy);
assert.match(body.instructions, /cannot be parsed|could not be parsed/);
const ordinaryGuidance = instructions("Explain this filing step.", []);
assert.match(ordinaryGuidance, /Do not return a guidance-only answer without enacted bindings/);
const authorizedGuidance = buildAnswerRequest("Summarize this official guidance.", [], "offline-contract", { allowOfficialGuidanceOnly: true });
assert.match(authorizedGuidance.instructions, /return supportedPoints and citations as empty arrays/);
assert.equal(authorizedGuidance.max_output_tokens, 1500);
const malformed = structuredClone(evidence);
malformed[0].visualSources[0].dataBase64 = "not valid base64!";
assert.throws(() => buildAnswerRequest("Read this figure.", malformed, "offline-contract"), { code: "INVALID_RESEARCH_VISUAL_SOURCE" });
for (const [label, selection] of [
  ["complete", { ...source("ZR", "23-371"), canonicalContextComplete: true }],
  ["partial", { ...source("BC", "1007.1.1"), canonicalContextComplete: false }],
  ["excerpt", { ...source("ZR", "42-192"), canonicalContextComplete: false, pinnedSelectionExcerpted: true,
    targetedZoningContext: { limitation: "Some selected source paragraphs are omitted; do not infer their contents." } }]
]) {
  selection.text = `Exact ${label} selected passage sentinel.\nClosing condition A AND condition B remain controlling.`;
  const before = structuredClone(selection);
  const draft = buildAnswerRequest("Apply the selection.", [selection], "offline-contract");
  const verifier = buildVerifierRequest("Apply the selection.", [selection], { answerText: "Synthetic conclusion." }, "offline-contract");
  for (const body of [draft, verifier]) {
    assert.equal(body.input.split(selection.text).length - 1, 1, `${label}: supply the complete passage exactly once.`);
    assert(body.input.includes(`PASSAGE_ID: ${selection.sourceID}`));
    if (selection.pinnedSelectionExcerpted) {
      assert.doesNotMatch(body.input, /USER_SELECTED_TEXT:/);
      assert.match(body.input, /the complete section is not supplied/);
      assert.match(body.input, /Some selected source paragraphs are omitted/);
    } else {
      assert.match(body.input, /USER_SELECTED_TEXT: same as (?:ENACTED_TEXT|TEXT)\n/);
    }
  }
  assert.deepEqual(selection, before, "Rendering must not alter selected-text provenance or source metadata.");
}
console.log("Research instruction contract passed: scoped hints, preserved inputs and authority boundaries, strict schema and visual rejection.");
