import assert from "node:assert/strict";
import {
  immutableReportManifest,
  normalizeReportDraftPayload,
  reportDraftForClient,
  reportManifestSummary,
  stableReportJSON
} from "../report-contract.mjs";
import { renderReportPDF } from "../report-pdf.mjs";

const createdAt = "2026-07-24T12:00:00.000Z";
const draft = normalizeReportDraftPayload({
  title: "Egress Code Review",
  reportDate: createdAt,
  introduction: "A focused review of the selected Project evidence.",
  blocks: [
    { id: "heading-1", kind: "heading", text: "Selected evidence" },
    {
      id: "evidence-1",
      kind: "evidence",
      sourceID: "BC-1004.1",
      label: "BC 1004.1 Design occupant load"
    },
    {
      id: "research-1",
      kind: "researchAnswer",
      sourceID: "answer-1",
      label: "Occupant-load Research answer"
    }
  ],
  createdBy: "user-1",
  updatedBy: "user-1"
});
assert.equal(draft.schemaVersion, 1);
assert.equal(draft.blocks.length, 3);
assert.equal(draft.blocks[0].sourceClassification, "user-authored");

const clientDraft = reportDraftForClient({
  envelope: {
    id: "draft-1",
    version: 2,
    createdAt,
    updatedAt: createdAt
  },
  payload: draft
}, ["project-1"]);
assert.equal(clientDraft.version, 2);
assert.deepEqual(clientDraft.projectIDs, ["project-1"]);

const manifestInput = {
  id: "manifest-1",
  project: {
    id: "project-1",
    name: "100 Test Avenue",
    address: "100 Test Avenue, New York, NY",
    description: "Interior alteration"
  },
  draftID: "draft-1",
  title: draft.title,
  reportDate: draft.reportDate,
  author: {
    userID: "user-1",
    displayName: "Professional Reviewer"
  },
  codeEdition: "2022 Construction Codes",
  items: [
    draft.blocks[0],
    {
      id: "evidence-1",
      kind: "evidence",
      sectionID: "BC-1004.1",
      sectionNumber: "1004.1",
      codeBook: "Building Code",
      chapter: "10",
      title: "Design occupant load",
      passageText: "In determining means of egress requirements...",
      passageTextHash: "evidence-hash",
      sourceLibraryVersion: "2022-construction-codes#1"
    },
    {
      id: "research-1",
      kind: "researchAnswer",
      answerID: "answer-1",
      conversationID: "conversation-1",
      question: "What occupant load applies?",
      conclusion: "The selected evidence supports calculating occupant load from the applicable table.",
      explanation: "The exact factor depends on the Project facts.",
      assumptions: [],
      missingFacts: ["Proposed occupancy"],
      limitations: ["Only selected evidence was reviewed."],
      additionalEvidenceNeeded: [],
      citations: [{ sectionID: "BC-1004.1", sourceIDs: ["source-1"] }],
      evidence: [{ id: "snapshot-1", passageText: "Selected passage" }],
      reviewStatus: "unreviewed"
    },
    {
      id: "workboard-1",
      kind: "workboardPreview",
      sourceID: "workboard-preview-1",
      title: "Coordination diagram",
      contentType: "image/png",
      contentHash: "workboard-preview-hash",
      readPath: "/workboards/previews/read"
    }
  ],
  disclaimers: [
    "Verify decisions against enacted code text and agency guidance."
  ],
  reportVersion: 1,
  sourceVersions: {
    codeEdition: "2022 Construction Codes",
    researchSystem: "research-v1"
  },
  createdAt
};
const manifest = immutableReportManifest(manifestInput);
const repeatedManifest = immutableReportManifest(manifestInput);
assert.equal(manifest.immutable, true);
assert.equal(manifest.items[1].sourceClassification, "published-code");
assert.equal(manifest.items[2].sourceClassification, "ai-assisted");
assert.equal(manifest.items[3].sourceClassification, "project-material");
assert.equal(manifest.contentHash, repeatedManifest.contentHash);
assert.equal(reportManifestSummary(manifest).itemCount, 4);
assert.equal(
  stableReportJSON({ b: 2, a: 1 }),
  stableReportJSON({ a: 1, b: 2 }),
  "Report hashing must not depend on object key insertion order."
);

assert.throws(
  () => normalizeReportDraftPayload({
    ...draft,
    blocks: [{ kind: "researchAnswer", sourceID: "", label: "Missing source" }]
  }),
  /Invalid Report source ID/
);
assert.throws(
  () => immutableReportManifest({ ...manifestInput, items: [] }),
  /requires at least one item/
);

const renderedWithoutPreview = await renderReportPDF(manifest);
const previewPNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+VnweAAAAAElFTkSuQmCC",
  "base64"
);
const renderedPDF = await renderReportPDF(manifest, {
  projectMaterialBySourceID: new Map([
    ["workboard-preview-1", { body: previewPNG, contentType: "image/png" }]
  ])
});
assert.equal(renderedPDF.subarray(0, 5).toString("ascii"), "%PDF-");
assert(renderedPDF.length > 2_000, "Rendered Report PDF was unexpectedly small.");
assert(
  renderedPDF.length > renderedWithoutPreview.length,
  "Rendered Report PDF did not embed the flattened Workboard preview."
);

console.log("Permitext Report contract passed.");
