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
  schemaVersion: 1,
  format: "tiptap-json",
  document: {
    type: "doc",
    content: [{
      type: "paragraph",
      content: [
        { type: "text", text: "Verify ", marks: [{ type: "bold" }] },
        {
          type: "permitextReference",
          attrs: {
            referenceKind: "canonicalSection",
            referenceID: "8881",
            label: "AC § 28-103.30.2"
          }
        },
        { type: "text", text: " before filing." }
      ]
    }]
  }
};

const validated = validateNotebookDocument(linkedDocument);
assert.equal(validated.references.length, 1);
assert.equal(validated.references[0].referenceID, "8881");
assert.equal(notebookPlainText(linkedDocument), "Verify AC § 28-103.30.2 before filing.");

const html = renderNotebookDocumentHTML(linkedDocument);
assert.match(html, /data-reference-kind="canonicalSection"/);
assert.match(html, /AC § 28-103\.30\.2/);

const escapedHTML = renderNotebookDocumentHTML({
  ...emptyNotebookDocument(),
  document: {
    type: "doc",
    content: [{
      type: "paragraph",
      content: [{ type: "text", text: "<script>alert('no')</script>" }]
    }]
  }
});
assert(!escapedHTML.includes("<script>"));
assert(escapedHTML.includes("&lt;script&gt;"));

const migrated = migrateNotebookDocument({
  schemaVersion: 0,
  plainText: "Legacy finding.\n\nSecond paragraph."
});
assert.equal(migrated.schemaVersion, 1);
assert.equal(migrated.migratedFromSchemaVersion, 0);
assert.equal(notebookPlainText(migrated), "Legacy finding.\n\nSecond paragraph.");

assert.throws(
  () => validateNotebookDocument({
    ...emptyNotebookDocument(),
    document: {
      type: "doc",
      content: [{ type: "heading", content: [{ type: "text", text: "Not allowed" }] }]
    }
  }),
  /paragraphs only/
);

assert.throws(
  () => validateNotebookDocument({
    ...emptyNotebookDocument(),
    document: {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{
          type: "permitextReference",
          attrs: {
            referenceKind: "unrestrictedExternalThing",
            referenceID: "bad",
            label: "Bad"
          }
        }]
      }]
    }
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

console.log("Permitext Notebook contract passed.");
