import assert from "node:assert/strict";
import {
  accumulatedResearchVerificationIssues,
  researchInputForEvidence,
  researchWebSupportRequestBody,
  researchWebSourcesFromProviderPayload,
  validateResearchInterpretation
} from "../app.mjs";
import { normalizeResearchWebSources } from "../research-source-policy.mjs";
import {
  evaluateResearchWebAttribution,
  researchWebAttributionRevisionIssues
} from "../research-web-attribution.mjs";

const bulletinURL = "https://www.nyc.gov/assets/buildings/bldgs_bulletins/bb_2022-013.pdf";
const webRequestBody = researchWebSupportRequestBody({
  model: "gpt-5.6-luna",
  userID: "web-support-contract-user",
  sanitizedQuery: "Find current official NYC DOB boiler guidance.",
  allowedDomains: ["nyc.gov"],
  namedOfficialDocuments: []
});
assert.equal(webRequestBody.tool_choice, "required");
assert.equal(webRequestBody.max_tool_calls, 3);
assert.deepEqual(webRequestBody.tools, [{
  type: "web_search",
  filters: { allowed_domains: ["nyc.gov"] }
}]);
assert.deepEqual(webRequestBody.include, ["web_search_call.action.sources"]);
const attributedClaimTexts = [
  "Buildings Bulletin 2022-013 says a foam-plastic exception requires a flame spread index of 25 or less under ASTM E84 or UL 723.",
  "The bulletin says that exception waives only the floor-level fireblocking requirement.",
  "The bulletin says construction documents must identify the NFPA 285-compliant wall assembly."
];
const citationMarkers = ["[1]", "[2]", "[3]"];
const webSummary = attributedClaimTexts
  .map((claim, index) => `- ${claim} ${citationMarkers[index]}`)
  .join("\n");
const citationRange = (marker) => ({
  start_index: webSummary.indexOf(marker),
  end_index: webSummary.indexOf(marker) + marker.length
});
const payloadSources = researchWebSourcesFromProviderPayload({
  output: [{
    type: "web_search_call",
    action: {
      sources: [{
        url: bulletinURL,
        title: "Buildings Bulletin 2022-013",
        publisher: "NYC Department of Buildings"
      }]
    }
  }, {
    type: "message",
    content: [{
      type: "output_text",
      text: webSummary,
      annotations: [{
        type: "url_citation",
        url: bulletinURL,
        title: "Buildings Bulletin 2022-013",
        ...citationRange(citationMarkers[0])
      }, {
        type: "url_citation",
        url: bulletinURL,
        title: "Buildings Bulletin 2022-013",
        ...citationRange(citationMarkers[1])
      }, {
        type: "url_citation",
        url: bulletinURL,
        title: "Buildings Bulletin 2022-013",
        ...citationRange(citationMarkers[2])
      }]
    }]
  }]
});
const normalizedSources = normalizeResearchWebSources(payloadSources);
assert.equal(normalizedSources.length, 1);
assert.deepEqual(normalizedSources[0].attributedClaims, attributedClaimTexts);

const directRangeText =
  "DOB states that construction documents must identify the NFPA 285-compliant wall assembly.";
const directRangeClaim = "construction documents must identify the NFPA 285-compliant wall assembly";
const directRangeStart = directRangeText.indexOf(directRangeClaim);
const directRangeSources = researchWebSourcesFromProviderPayload({
  output: [{
    type: "message",
    content: [{
      type: "output_text",
      text: directRangeText,
      annotations: [{
        type: "url_citation",
        url: bulletinURL,
        title: "Buildings Bulletin 2022-013",
        start_index: directRangeStart,
        end_index: directRangeStart + directRangeClaim.length
      }]
    }]
  }]
});
assert.deepEqual(
  directRangeSources[0].attributedClaims,
  [directRangeClaim],
  "A provider range that directly covers cited prose must return that exact prose, not the text before it."
);

const markdownCitationMarker =
  "([nyc.gov](https://www.nyc.gov/site/buildings/safety/boiler-compliance.page?utm_source=openai))";
const markdownCitationText =
  `- Annual inspection is required for registered H-stamped and E-stamped low-pressure boilers. ${markdownCitationMarker}`;
const markdownCitationStart = markdownCitationText.indexOf(markdownCitationMarker);
const markdownCitationSources = researchWebSourcesFromProviderPayload({
  output: [{
    type: "message",
    content: [{
      type: "output_text",
      text: markdownCitationText,
      annotations: [{
        type: "url_citation",
        url: "https://www.nyc.gov/site/buildings/safety/boiler-compliance.page?utm_source=openai",
        title: "Boiler Compliance - Buildings",
        start_index: markdownCitationStart,
        end_index: markdownCitationStart + markdownCitationMarker.length
      }]
    }]
  }]
});
assert.deepEqual(
  markdownCitationSources[0].attributedClaims,
  ["Annual inspection is required for registered H-stamped and E-stamped low-pressure boilers."],
  "A provider Markdown citation marker must bind the preceding claim, not become the attributed claim."
);

const evidence = [{
  sourceID: "bc-718-2-6-1",
  sectionID: "bc-718",
  codePrefix: "BC",
  sectionNumber: "718.2.6.1",
  title: "Fireblocking of combustible exterior wall coverings",
  text: "Fireblocking shall be installed with sufficient thickness to eliminate any concealed gaps and form an effective barrier between stories.",
  evidencePriority: { evidenceRole: "governing", primaryFunction: "direct_rule" }
}];
const supportingSources = [{
  ...normalizedSources[0],
  id: "web-bb-2022-013",
  attributedClaims: attributedClaimTexts.map((text, index) => ({
    id: `bb-2022-013-claim-${index + 1}`,
    text
  })),
  authorityClass: "official_guidance",
  role: "supporting",
  requiredAttribution: true
}];
const answer = {
  answerText: "BC 718.2.6.1 requires an effective fireblocking barrier. Separately, noncontrolling Buildings Bulletin 2022-013 says the foam-plastic exception requires a flame spread index of 25 or less under ASTM E84 or UL 723, waives only floor-level fireblocking, and requires the construction documents to identify the NFPA 285-compliant wall assembly.",
  supportedPoints: [{
    heading: "Effective fireblocking barrier",
    explanation: "The enacted provision requires sufficient thickness to eliminate concealed gaps and form an effective barrier between stories.",
    sectionID: "bc-718",
    sourceIDs: ["bc-718-2-6-1"]
  }],
  assumptions: [],
  missingFacts: [],
  followUpQuestions: [],
  evidenceLimitations: ["The bulletin is supporting guidance, not enacted code text."],
  additionalEvidenceNeeded: [],
  supportingSourceUses: [{
    sourceID: "web-bb-2022-013",
    claimID: "bb-2022-013-claim-1"
  }, {
    sourceID: "web-bb-2022-013",
    claimID: "bb-2022-013-claim-2"
  }, {
    sourceID: "web-bb-2022-013",
    claimID: "bb-2022-013-claim-3"
  }],
  citations: [{
    sectionID: "bc-718",
    sourceIDs: ["bc-718-2-6-1"],
    relevance: "Establishes the enacted fireblocking requirement."
  }]
};

const validated = validateResearchInterpretation(answer, evidence, supportingSources);
assert.equal(validated.supportedPoints.length, 1);
assert.equal(validated.supportingSourceUses.length, 3);
assert.deepEqual(
  validated.supportingSourceUses.map((use) => use.claim),
  attributedClaimTexts,
  "Server validation must derive immutable claim text from the exact claim IDs."
);
assert.equal(validated.supportingSources[0].authorityClass, "official_guidance");
assert.equal(evaluateResearchWebAttribution({
  question: "How does Buildings Bulletin 2022-013 clarify BC 718.2.6.1?",
  answer: validated,
  evidence,
  supportingSources
}).pass, true);

const wrongColumn = structuredClone(answer);
wrongColumn.supportedPoints[0].heading = "Construction-document identification";
wrongColumn.supportedPoints[0].explanation = "The construction documents must identify the NFPA 285-compliant wall assembly.";
const wrongColumnResult = evaluateResearchWebAttribution({
  question: "How does Buildings Bulletin 2022-013 clarify BC 718.2.6.1?",
  answer: wrongColumn,
  evidence,
  supportingSources
});
assert.equal(wrongColumnResult.pass, false);
assert.deepEqual(wrongColumnResult.guidanceSupportedPointIndexes, [0]);
assert.match(researchWebAttributionRevisionIssues(wrongColumnResult)[0].detail, /out of supportedPoints/);
assert.doesNotMatch(wrongColumn.supportedPoints[0].explanation, /bulletin|guidance|\bBB\b/i);

const droppedSourceUse = structuredClone(answer);
droppedSourceUse.supportingSourceUses = [];
const droppedResult = evaluateResearchWebAttribution({
  question: "How does Buildings Bulletin 2022-013 clarify BC 718.2.6.1?",
  answer: droppedSourceUse,
  evidence,
  supportingSources
});
assert.deepEqual(droppedResult.missingRequiredSourceIDs, ["web-bb-2022-013"]);

const alternateBulletinSource = {
  ...supportingSources[0],
  id: "web-bb-2022-013-html",
  url: "https://www.nyc.gov/site/buildings/codes/2022-013.page"
};
assert.equal(evaluateResearchWebAttribution({
  question: "How does Buildings Bulletin 2022-013 clarify BC 718.2.6.1?",
  answer,
  evidence,
  supportingSources: [...supportingSources, alternateBulletinSource]
}).pass, true, "One exact source use should satisfy a named document even when two official URLs represent it.");

const unrelatedSource = {
  ...supportingSources[0],
  id: "web-other-guidance",
  title: "Buildings Bulletin 2024-001",
  attributedClaims: [{
    id: "other-guidance-claim-1",
    text: "Buildings Bulletin 2024-001 addresses an unrelated filing procedure."
  }]
};
const unrelatedBinding = structuredClone(answer);
unrelatedBinding.supportingSourceUses[0] = {
  sourceID: "web-bb-2022-013",
  claimID: "other-guidance-claim-1"
};
assert.throws(
  () => validateResearchInterpretation(
    unrelatedBinding,
    evidence,
    [...supportingSources, unrelatedSource]
  ),
  (error) => error?.code === "INVALID_RESEARCH_WEB_CITATION"
);

const unavailableWebSupport = {
  searched: true,
  sources: [],
  requestedDocuments: ["Buildings Bulletin 2022-013"],
  unattributedRequestedDocuments: ["Buildings Bulletin 2022-013"],
  limitation: "Permitext could not retrieve a source-specific attributable passage for Buildings Bulletin 2022-013; that document was not used in this answer."
};
const undisclosedUnavailable = structuredClone(answer);
undisclosedUnavailable.supportingSourceUses = [];
undisclosedUnavailable.evidenceLimitations = ["Only enacted BC 718 was evaluated."];
const unavailableResult = evaluateResearchWebAttribution({
  question: "How does Buildings Bulletin 2022-013 clarify BC 718.2.6.1?",
  answer: undisclosedUnavailable,
  evidence,
  webSupport: unavailableWebSupport
});
assert.equal(unavailableResult.pass, false);
assert.deepEqual(
  unavailableResult.undisclosedUnavailableDocumentReferences,
  ["Buildings Bulletin 2022-013"]
);
assert.match(
  researchWebAttributionRevisionIssues(unavailableResult)[0].detail,
  /could not retrieve a source-specific attributable passage/
);

const genericUnavailableWebSupport = {
  searched: true,
  sources: [],
  limitation: "Permitext searched the approved official supporting web sources but could not retrieve an attributable passage; web guidance was not used in this answer."
};
const genericUndisclosed = structuredClone(answer);
genericUndisclosed.supportingSourceUses = [];
genericUndisclosed.evidenceLimitations = ["Only enacted BC 718 was evaluated."];
const genericUnavailableResult = evaluateResearchWebAttribution({
  question: "Use current official NYC DOB guidance to explain the filing process.",
  answer: genericUndisclosed,
  evidence,
  webSupport: genericUnavailableWebSupport
});
assert.equal(genericUnavailableResult.pass, false);
assert.equal(genericUnavailableResult.undisclosedGenericLimitation, true);
assert.match(
  researchWebAttributionRevisionIssues(genericUnavailableResult)[0].detail,
  /searched the approved official supporting web sources/
);
genericUndisclosed.evidenceLimitations = [genericUnavailableWebSupport.limitation];
assert.equal(evaluateResearchWebAttribution({
  question: "Use current official NYC DOB guidance to explain the filing process.",
  answer: genericUndisclosed,
  evidence,
  webSupport: genericUnavailableWebSupport
}).pass, true);
undisclosedUnavailable.evidenceLimitations = [unavailableWebSupport.limitation];
assert.equal(evaluateResearchWebAttribution({
  question: "How does Buildings Bulletin 2022-013 clarify BC 718.2.6.1?",
  answer: undisclosedUnavailable,
  evidence,
  webSupport: unavailableWebSupport
}).pass, true);

const attempts = [{
  issues: [{
    type: "wrong_attribution",
    detail: "Do not cite BC 718.2.6.1 for the bulletin-only NFPA 285 clarification."
  }]
}, {
  issues: [{
    type: "missed_material_conclusion",
    detail: "Retain the flame-spread-index condition and state that only floor-level fireblocking is waived."
  }]
}, {
  issues: [{
    type: "misstated_provision",
    detail: "The bulletin says construction documents must identify the NFPA 285 assembly; do not weaken must to should."
  }]
}];
const revisionInput = researchInputForEvidence(
  "How does Buildings Bulletin 2022-013 clarify BC 718.2.6.1?",
  evidence,
  {
    webSupport: { summary: webSummary, sources: supportingSources },
    revisionFeedback: accumulatedResearchVerificationIssues(attempts),
    previousInterpretation: answer
  }
);
assert.match(revisionInput, /SOURCE-SPECIFIC ATTRIBUTED CLAIMS/);
assert.match(revisionInput, /WEB_CLAIM_ID: bb-2022-013-claim-1/);
assert.match(revisionInput, /construction documents must identify/);
assert.match(revisionInput, /PREVIOUS PROPOSED ANSWER JSON/);
assert.match(revisionInput, /Preserve its correct, unchallenged enacted conclusions/);
assert.match(revisionInput, /Never move a web-guidance claim into supportedPoints/);
for (const attempt of attempts) {
  assert.match(revisionInput, new RegExp(attempt.issues[0].type));
  assert.match(revisionInput, new RegExp(
    attempt.issues[0].detail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  ));
}

console.log("Permitext source-specific web-attribution and revision non-regression contract passed; paid model calls: no.");
