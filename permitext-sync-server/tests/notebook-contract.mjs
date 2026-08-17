import assert from "node:assert/strict";
import {
  emptyNotebookDocument,
  migrateNotebookDocument,
  notebookManifestItem,
  notebookPlainText,
  normalizeNotebookCardPayload,
  renderNotebookDocumentHTML,
  validateNotebookDocument
} from "../notebook-contract.mjs";
import { blockNoteBlocksFromNotebookDocument } from "../src/notebook-schema.js";

const linkedDocument = {
  schema: "permitext-notebook-card",
  schemaVersion: 2,
  format: "blocknote-json",
  document: [{
    id: "block-1",
    type: "paragraph",
    props: {
      backgroundColor: "default",
      textColor: "default",
      textAlignment: "left"
    },
    content: [
      { type: "text", text: "Verify ", styles: { bold: true } },
      {
        type: "permitextReference",
        props: {
          referenceKind: "canonicalSection",
          referenceID: "8881",
          label: "AC § 28-103.30.2"
        }
      },
      { type: "text", text: " before filing.", styles: {} }
    ],
    children: []
  }]
};

const validated = validateNotebookDocument(linkedDocument);
assert.equal(validated.references.length, 1);
assert.equal(validated.references[0].referenceID, "8881");
assert.equal(notebookPlainText(linkedDocument), "Verify AC § 28-103.30.2 before filing.");

const html = renderNotebookDocumentHTML(linkedDocument);
assert.match(html, /data-reference-kind="canonicalSection"/);
assert.match(html, /AC § 28-103\.30\.2/);
assert.match(html, /<strong>Verify <\/strong>/);

assert.throws(
  () => validateNotebookDocument({
    ...emptyNotebookDocument(),
    document: [{
      type: "paragraph",
      content: [{ type: "text", text: "Unsupported styling", styles: { textSize: "18px" } }]
    }]
  }),
  /unsupported style/
);

const escapedHTML = renderNotebookDocumentHTML({
  ...emptyNotebookDocument(),
  document: [{
    type: "paragraph",
    content: [{ type: "text", text: "<script>alert('no')</script>", styles: {} }]
  }]
});
assert(!escapedHTML.includes("<script>"));
assert(escapedHTML.includes("&lt;script&gt;"));

const migratedLegacyText = migrateNotebookDocument({
  schemaVersion: 0,
  plainText: "Legacy finding.\n\nSecond paragraph."
});
assert.equal(migratedLegacyText.schemaVersion, 2);
assert.equal(migratedLegacyText.migratedFromSchemaVersion, 0);
assert.equal(notebookPlainText(migratedLegacyText), "Legacy finding.\n\nSecond paragraph.");

const migratedTipTap = migrateNotebookDocument({
  schema: "permitext-notebook-card",
  schemaVersion: 1,
  format: "tiptap-json",
  document: {
    type: "doc",
    content: [{
      type: "paragraph",
      content: [
        { type: "text", text: "Existing ", marks: [{ type: "italic" }] },
        {
          type: "permitextReference",
          attrs: {
            referenceKind: "canonicalSection",
            referenceID: "8881",
            label: "AC § 28-103.30.2"
          }
        }
      ]
    }]
  }
});
assert.equal(migratedTipTap.schemaVersion, 2);
assert.equal(migratedTipTap.format, "blocknote-json");
assert.equal(migratedTipTap.migratedFromSchemaVersion, 1);
assert.equal(notebookPlainText(migratedTipTap), "Existing AC § 28-103.30.2");
assert.deepEqual(
  blockNoteBlocksFromNotebookDocument({
    schema: "permitext-notebook-card",
    schemaVersion: 1,
    format: "tiptap-json",
    document: {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: "Existing note" }]
      }]
    }
  }),
  [{
    type: "paragraph",
    content: [{ type: "text", text: "Existing note", styles: {} }]
  }]
);

const richDocument = {
  ...emptyNotebookDocument(),
  document: [
    {
      type: "heading",
      props: { level: 2, textAlignment: "left" },
      content: [{ type: "text", text: "Field conditions", styles: {} }]
    },
    {
      type: "bulletListItem",
      content: [{ type: "text", text: "Confirm rated wall", styles: { italic: true } }]
    },
    {
      type: "numberedListItem",
      props: { start: 1 },
      content: [{
        type: "link",
        href: "https://www.nyc.gov/site/buildings/index.page",
        content: [{ type: "text", text: "Confirm with DOB", styles: {} }]
      }]
    },
    {
      type: "image",
      props: {
        url: "permitext-notebook-asset:project-assets%2Fproject%2Fnotebook%2Fimage.png",
        name: "Wall condition",
        caption: "Existing wall at corridor",
        previewWidth: 640
      }
    }
  ]
};
const richValidated = validateNotebookDocument(richDocument);
assert.equal(richValidated.document.document[0].type, "heading");
assert.equal(richValidated.document.document[3].type, "image");
assert.deepEqual(
  richValidated.imageAssets,
  ["project-assets%2Fproject%2Fnotebook%2Fimage.png"],
  "Notebook image identities are not included in the synchronized card contract."
);
assert.match(notebookPlainText(richValidated.document), /Existing wall at corridor/);
assert.match(renderNotebookDocumentHTML(richValidated.document), /data-notebook-image-asset/);
assert.match(renderNotebookDocumentHTML(richValidated.document), /<ul><li><em>Confirm rated wall<\/em><\/li><\/ul>/);
assert.match(renderNotebookDocumentHTML(richValidated.document), /<a href="https:\/\/www\.nyc\.gov/);

for (const unsupportedType of ["checkListItem", "toggleListItem", "quote", "codeBlock", "divider", "table"]) {
  assert.throws(
    () => validateNotebookDocument({
      ...emptyNotebookDocument(),
      document: [{ type: unsupportedType, content: [] }]
    }),
    /unsupported block/,
    `${unsupportedType} remains available in the simple shared Notebook contract.`
  );
}

assert.throws(
  () => validateNotebookDocument({
    ...emptyNotebookDocument(),
    document: [{ type: "video", props: { url: "https://example.com/video.mp4" } }]
  }),
  /unsupported block/
);

assert.throws(
  () => validateNotebookDocument({
    ...emptyNotebookDocument(),
    document: [{
      type: "paragraph",
      content: [{
        type: "permitextReference",
        props: {
          referenceKind: "unrestrictedExternalThing",
          referenceID: "bad",
          label: "Bad"
        }
      }]
    }]
  }),
  /unsupported/
);

const payload = normalizeNotebookCardPayload({
  cardType: "finding",
  title: "Notice timing",
  document: linkedDocument,
  createdBy: "apple:notebook-test",
  updatedBy: "apple:notebook-test"
});
assert.equal(payload.schemaVersion, 2);
assert.equal(payload.sourceClassification, "user-authored");
assert.equal(payload.references[0].referenceKind, "canonicalSection");
assert(payload.renderedHTML.includes("notebook-reference-chip"));
assert.deepEqual(payload.imageAssets, []);

const passageLinkID = "evidence-link-1";
const passageDocument = {
  ...emptyNotebookDocument(),
  document: [{
    type: "paragraph",
    content: [{
      type: "permitextReference",
      props: {
        referenceKind: "selectedPassage",
        referenceID: passageLinkID,
        label: "BC § 101.2 · Scope"
      }
    }]
  }]
};
const evidenceLinks = [{
  id: passageLinkID,
  label: "BC § 101.2 · Scope",
  relationshipRole: "context",
  projectID: "project-1",
  notebookCardID: "notebook-card-1",
  source: {
    jurisdiction: "New York City",
    codePrefix: "BC",
    codeEdition: "2022",
    codeVersion: "2022-construction-codes",
    sourceID: "2",
    sectionID: "2",
    sectionNumber: "101.2",
    sectionTitle: "Scope.",
    sourceLibraryVersion: "2022-construction-codes#1"
  },
  passages: [{
    exact: "The provisions of this code shall apply",
    prefix: "Scope.",
    suffix: "to the construction",
    start: 7,
    end: 47
  }],
  createdAt: "2026-08-15T12:00:00.000Z",
  noteTarget: { scope: "card", blockID: "", exact: "" }
}];
const passagePayload = normalizeNotebookCardPayload({
  cardType: "finding",
  title: "Scope note",
  document: passageDocument,
  evidenceLinks,
  createdBy: "apple:notebook-test",
  updatedBy: "apple:notebook-test"
});
assert.equal(passagePayload.evidenceLinks[0].source.sectionNumber, "101.2");
assert.equal(passagePayload.evidenceLinks[0].projectID, "project-1");
assert.equal(passagePayload.evidenceLinks[0].notebookCardID, "notebook-card-1");
assert.equal(passagePayload.evidenceLinks[0].label, "BC § 101.2 · Scope");
assert.equal(passagePayload.evidenceLinks[0].passages[0].exactHash.length, 64);
assert.throws(
  () => normalizeNotebookCardPayload({
    cardType: "finding",
    title: "Broken passage link",
    document: passageDocument,
    evidenceLinks: [],
    createdBy: "apple:notebook-test",
    updatedBy: "apple:notebook-test"
  }),
  /missing its evidence locator/
);

assert.throws(
  () => validateNotebookDocument({
    ...emptyNotebookDocument(),
    document: [{ type: "image", props: { url: "permitext-notebook-local:pending-image" } }]
  }),
  /Permitext asset or HTTPS URL/,
  "Temporary device-local image references reached the synchronized Notebook contract."
);

const manifest = notebookManifestItem({
  cardID: "card-1",
  cardType: payload.cardType,
  title: payload.title,
  document: payload.document
});
assert.equal(manifest.references[0].sourceClassification, "published-code");
assert.equal(manifest.plainText, payload.plainText);

console.log("Permitext BlockNote Notebook contract passed.");
