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

const richDocument = {
  ...emptyNotebookDocument(),
  document: [
    {
      type: "heading",
      props: { level: 2, textAlignment: "left" },
      content: [{ type: "text", text: "Field conditions", styles: {} }]
    },
    {
      type: "checkListItem",
      props: { checked: true },
      content: [{ type: "text", text: "Confirm rated wall", styles: {} }]
    },
    {
      type: "image",
      props: {
        url: "permitext-notebook-asset:project-assets%2Fproject%2Fnotebook%2Fimage.png",
        name: "Wall condition",
        caption: "Existing wall at corridor",
        previewWidth: 640
      }
    },
    {
      type: "table",
      content: {
        type: "tableContent",
        rows: [{
          cells: [{
            type: "tableCell",
            content: [{ type: "text", text: "Item", styles: {} }],
            props: { colspan: 1, rowspan: 1 }
          }]
        }]
      }
    }
  ]
};
const richValidated = validateNotebookDocument(richDocument);
assert.equal(richValidated.document.document[0].type, "heading");
assert.equal(richValidated.document.document[2].type, "image");
assert.match(notebookPlainText(richValidated.document), /Existing wall at corridor/);
assert.match(renderNotebookDocumentHTML(richValidated.document), /data-notebook-image-asset/);
assert.match(renderNotebookDocumentHTML(richValidated.document), /<table>/);

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

const manifest = notebookManifestItem({
  cardID: "card-1",
  cardType: payload.cardType,
  title: payload.title,
  document: payload.document
});
assert.equal(manifest.references[0].sourceClassification, "published-code");
assert.equal(manifest.plainText, payload.plainText);

console.log("Permitext BlockNote Notebook contract passed.");
