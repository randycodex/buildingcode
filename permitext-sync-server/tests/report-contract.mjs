import assert from "node:assert/strict";
import {
  immutableReportManifest,
  normalizeReportDraftPayload,
  reportDraftForClient,
  reportManifestSummary,
  stableReportJSON,
  unavailableReportEvidenceWarning
} from "../report-contract.mjs";
import { renderReportPDF } from "../report-pdf.mjs";

const createdAt = "2026-07-24T12:00:00.000Z";
const generatedAt = "2026-07-24T16:37:00.000Z";
assert.deepEqual(
  unavailableReportEvidenceWarning(
    { code: "ENOENT" },
    { canonicalID: "1026", sectionNumber: "4.2.", title: "Roof framing" }
  ),
  {
    kind: "evidence",
    sourceID: "1026",
    code: "ENOENT",
    message: "4.2. Roof framing"
  }
);
assert.equal(
  unavailableReportEvidenceWarning({ code: "DATABASE_FAILURE" }, { canonicalID: "1026" }),
  null,
  "Report source recovery must not hide unexpected server failures."
);
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
      id: "project-facts-1",
      kind: "projectFacts",
      sourceID: "project-1",
      title: "Project Facts",
      address: "100 Test Avenue, New York, NY",
      facts: "Interior alteration"
    },
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
      supportedPoints: [{
        heading: "Table method",
        explanation: "Use the selected table.",
        sectionID: "BC-1004.1",
        sourceIDs: ["source-1"]
      }],
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
  presentation: {
    firmControlsVersion: 3,
    organization: {
      id: "organization-1",
      name: "Permit Studio PLLC"
    },
    template: {
      id: "template-client",
      name: "Client Report",
      coverLabel: "Client Code Report"
    },
    branding: {
      displayName: "Permit Studio",
      accentColorHex: "#1267a0",
      website: "https://example.test",
      footerText: "Permit Studio PLLC"
    }
  },
  reportVersion: 1,
  sourceVersions: {
    codeEdition: "2022 Construction Codes",
    researchSystem: "research-v1"
  },
  createdAt
};
const automaticallyDatedManifest = immutableReportManifest({
  ...manifestInput,
  id: "manifest-automatic-date",
  reportDate: generatedAt,
  createdAt: generatedAt
});
assert.equal(
  automaticallyDatedManifest.reportDate,
  generatedAt,
  "Generated Reports must snapshot the automatic generation date and time."
);
const longProjectFactsManifest = immutableReportManifest({
  ...manifestInput,
  id: "manifest-long-project-facts",
  project: {
    ...manifestInput.project,
    description: "Project fact. ".repeat(500)
  }
});
assert.ok(
  longProjectFactsManifest.project.description.length > 5_000,
  "Reports must retain Project facts that exceed the old 5,000-character boundary."
);
const manifest = immutableReportManifest(manifestInput);
const repeatedManifest = immutableReportManifest(manifestInput);
assert.equal(manifest.immutable, true);
assert.equal(manifest.items[1].sourceClassification, "project-material");
assert.equal(manifest.items[2].sourceClassification, "published-code");
assert.equal(manifest.items[3].sourceClassification, "ai-assisted");
assert.equal(manifest.items[4].sourceClassification, "project-material");
assert.equal(manifest.presentation.template.id, "template-client");
assert.equal(manifest.presentation.branding.accentColorHex, "#1267a0");
assert.equal(manifest.contentHash, repeatedManifest.contentHash);
assert.equal(reportManifestSummary(manifest).itemCount, 5);
assert.equal(
  reportManifestSummary(manifest).presentation.template.name,
  "Client Report",
  "Report history summaries must preserve the immutable firm template snapshot."
);
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
const pdfPageCount = (pdf) =>
  (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
assert.equal(renderedPDF.subarray(0, 5).toString("ascii"), "%PDF-");
assert(renderedPDF.length > 2_000, "Rendered Report PDF was unexpectedly small.");
assert(
  renderedPDF.length > renderedWithoutPreview.length,
  "Rendered Report PDF did not embed the flattened Workboard preview."
);
assert.equal(
  pdfPageCount(renderedWithoutPreview),
  2,
  "Report footer rendering must not create blank trailing pages."
);
assert.equal(
  pdfPageCount(renderedPDF),
  pdfPageCount(renderedWithoutPreview) + 1,
  "The expanded Research result and Workboard preview should add exactly one populated page."
);

console.log("Permitext Report contract passed.");
