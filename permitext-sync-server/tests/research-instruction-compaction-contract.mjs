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
// One general writer policy replaces provision-specific drafting hints.
for (const [code, section] of [["BC", "303.1.3"], ["PC", "403.1.1"], ["BC", "901.9.3"],
  ["BC", "1107.2.2.7"], ["BC", "1101.3.1"], ["PC", "403.1"], ["PC", "403.10"]])
  assert.equal(instructions("Apply the selected provision.", [source(code, section)]), ordinary);
for (const question of ["May we share facilities?", "What about sharing facilities?", "Does the Type B+NYC provision apply?", "Does the agency require a vanity?"])
  assert.equal(instructions(question, [source("BC", "303.1.3")]), ordinary);
assert.match(ordinary, /calculation order, table headers and footnotes/);
assert.match(ordinary, /governing ancestor conditions/);
assert.match(ordinary, /every exception material to the conclusion/);
assert.match(ordinary, /conditional conclusions/);

const evidence = [source("BC", "1007.1.1")];
const verifierInstructions = (question, selected) => buildVerifierRequest(question, selected, { answerText: 'Offline draft.' }, 'offline', {}).instructions;
assert.doesNotMatch(verifierInstructions('Explain the laundry rule.', [source('PC', '412.4')]), /For an HCR vanity question|For a Type B\+NYC provision|When BC 901\.9\.3 and a separate|When supplied BC 1101\.3 ancestor/);
for (const [question, selected, expected] of [
  ['Explain the selected rule.', source('BC', '901.9.3'), /separate qualifying trigger cannot automatically be confined/],
  ['Explain Type B+NYC.', source('BC', '1107.2.2.7'), /For a Type B\+NYC provision/],
  ['Explain the selected rule.', source('BC', '1101.3.1'), /When supplied BC 1101\.3 ancestor/],
  ['Does HCR require a vanity?', source('BC', '1107.2.2.7'), /For an HCR vanity question/]
]) assert.match(verifierInstructions(question, [selected]), expected);
evidence[0].visualSources = [{ id: "fixture-visual", assetName: "fixture.png", mediaType: "image/png", dataBase64: "AA==", byteLength: 1, contentHash: "synthetic-hash" }];
const options = { responseStyle: "conversational", projectContextFacts: ["Owner representation: prior-code status is unverified."],
  messages: [{ role: "user", question: "Earlier active-topic user fact sentinel." }],
  conversationFactContext: { established: ["Established fact sentinel."], hypothetical: ["Hypothetical sentinel."], qualified: ["No change of occupancy sentinel."], unknown: ["Unknown sentinel."] },
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
  "Established fact sentinel.", "Hypothetical sentinel.", "Unknown sentinel.", "No change of occupancy sentinel.", "Owner representation: prior-code status is unverified.", "Official document unavailable sentinel.",
  "synthetic-web-source", "synthetic-web-claim", "Guidance claim sentinel."])
  assert(serializedInput.includes(sentinel), `Lost input: ${sentinel}`);
for (const request of [body, buildVerifierRequest("Current question sentinel.", evidence, { answerText: "Synthetic answer." }, "offline-contract", options)]) {
  const input = typeof request.input === "string" ? request.input : JSON.stringify(request.input);
  if (request === body) {
    const text = request.input[0].content[0].text;
    const context = JSON.parse(text.split("RESEARCH CONTEXT DATA — FACTS, PLANS AND PRIOR ANSWERS; NOT LEGAL AUTHORITY\n")[1].split("\n\nAUTHORIZED ENACTED EVIDENCE")[0]);
    assert.deepEqual(context.conversationFacts, options.conversationFactContext);
    assert.deepEqual(context.webSupport, options.webSupport);
  } else {
    assert.match(input, /QUALIFIED USER STATEMENTS/);
    assert.match(input, /on the stated facts/);
    assert.match(input, /USER-STATED UNKNOWNS/);
  }
  assert.match(input, /No change of occupancy sentinel/);
  assert.match(input, /Unknown sentinel/);
}
assert.deepEqual(body.input[0].content.at(-1), { type: "input_image", image_url: "data:image/png;base64,AA==", detail: "original" });
for (const policy of [/exact supplied SECTION_ID and PASSAGE_ID/, /discussion premises/, /scope of hypotheticals/,
  /prior assistant answers are organizational context, not authority/, /each required claim/, /exact selection boundaries/,
  /not automatically current law/, /noncontrolling/, /WEB_SOURCE_ID\/WEB_CLAIM_ID/])
  assert.match(body.instructions, policy);
assert.match(body.instructions, /previous structured response failed/);
const ordinaryGuidance = instructions("Explain this filing step.", []);
assert.match(ordinaryGuidance, /Bind every legal claim and supportedPoint/);
const authorizedGuidance = buildAnswerRequest("Summarize this official guidance.", [], "offline-contract", { allowOfficialGuidanceOnly: true });
assert.match(authorizedGuidance.instructions, /without manufacturing enacted points or citations/);
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
console.log("Research instruction contract passed: general writer policy, scoped review, preserved inputs and authority boundaries, strict schema and visual rejection.");
