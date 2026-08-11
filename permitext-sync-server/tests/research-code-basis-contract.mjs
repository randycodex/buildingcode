import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { immutableEvidenceSnapshot, immutableResearchAnswer } from "../project-foundation-contract.mjs";
import { resolveResearchCodeBasis } from "../research-code-basis.mjs";

const availableCodeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
const availableCodeEdition = "2022 New York City Construction Codes";
const resolvedAt = "2026-08-10T12:00:00.000Z";

const unassigned = resolveResearchCodeBasis({ availableCodeVersion, availableCodeEdition, resolvedAt });
assert.equal(unassigned.codeYear, 2022);
assert.equal(unassigned.retrievalScope, "single-corpus");
assert.equal(unassigned.basisSource, "permitext-default");
assert.match(unassigned.disclosure, /2022 NYC Construction Codes/);

const projectDefault = resolveResearchCodeBasis({
  projectID: "project-1",
  projectCodeVersion: "nyc-2022",
  availableCodeVersion,
  availableCodeEdition,
  resolvedAt
});
assert.equal(projectDefault.basisSource, "project-default");
assert.equal(projectDefault.projectCodeVersionSupported, true);
assert.match(projectDefault.disclosure, /Project default/);

const unsupportedProjectDefault = resolveResearchCodeBasis({
  projectID: "project-2",
  projectCodeVersion: "NYC Zoning Resolution",
  availableCodeVersion,
  availableCodeEdition,
  resolvedAt
});
assert.equal(unsupportedProjectDefault.codeVersion, availableCodeVersion);
assert.equal(unsupportedProjectDefault.projectCodeVersionSupported, false);
assert.equal(unsupportedProjectDefault.retrievalScope, "single-corpus");
assert.match(unsupportedProjectDefault.disclosure, /not available in Research/);
assert.match(unsupportedProjectDefault.limitation, /did not retrieve.*configured version/i);

const evidence = immutableEvidenceSnapshot({
  id: "evidence-1",
  source: {
    sourceID: "source-1",
    sectionID: "section-1",
    sectionNumber: "101.1",
    chapterNumber: "1",
    codePrefix: "BC",
    codeEdition: availableCodeEdition,
    codeVersion: availableCodeVersion,
    text: "This is the immutable enacted passage used by the answer."
  },
  approvedAt: resolvedAt
});
const answerPayload = {
  codeBasis: projectDefault,
  conclusion: "The cited provision controls.",
  assumptions: [],
  missingFacts: [],
  evidenceLimitations: [],
  additionalEvidenceNeeded: []
};
const answer = immutableResearchAnswer({
  id: "answer-1",
  owner: { kind: "user", id: "user-1" },
  conversationID: "conversation-1",
  projectID: "project-1",
  question: "Which edition applies?",
  answer: answerPayload,
  evidence: [evidence],
  citations: [{ sectionID: "section-1", sourceIDs: ["source-1"], relevance: "Direct support" }],
  model: "test",
  researchSystemVersion: "test",
  createdAt: resolvedAt
});
answerPayload.codeBasis.disclosure = "tampered";
assert.match(answer.codeBasis.disclosure, /Project default/);

const root = dirname(fileURLToPath(import.meta.url));
const appSource = await readFile(join(root, "../app.mjs"), "utf8");
const uiSource = await readFile(join(root, "../public/app.js"), "utf8");
const styles = await readFile(join(root, "../public/styles.css"), "utf8");
assert.match(appSource, /codeBasis: answerCodeBasis/);
assert.match(appSource, /Do not imply that another code edition was retrieved/);
assert.match(uiSource, /research-answer-code-basis/);
assert.match(styles, /\.research-answer-code-basis/);

console.log("permitext Research code-basis contract passed");
