import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import notebookViteConfig from "../vite.notebook.config.js";

assert.equal(
  notebookViteConfig.build?.emptyOutDir,
  false,
  "The notebook build must not delete unrelated files in its output directory."
);

const notebookEditor = await readFile(new URL("../src/notebook-editor.js", import.meta.url), "utf8");
assert.match(notebookEditor, /function notebookReferenceParts\(referenceKind, label\)[\s\S]*?notebook-reference-meta[\s\S]*?notebook-reference-title[\s\S]*?notebook-reference-preview/, "Notebook reference components must render structured evidence previews.");
assert.match(notebookEditor, /const notebookReferenceCodeNames = \{[\s\S]*?BC: "Building Code"[\s\S]*?function normalizedNotebookReferenceLabel\(label\)/, "Notebook reference previews must normalize legacy code prefixes to full code titles.");
const notebookSchema = await readFile(new URL("../src/notebook-schema.js", import.meta.url), "utf8");
const appServer = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
const webClient = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const packageManifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

// Build-time gates must ship even though private test fixtures do not.
const vercelIgnore = await readFile(new URL("../.vercelignore", import.meta.url), "utf8");
assert.match(vercelIgnore, /^tests\/$/m, "Keep test fixtures excluded from deployment.");
assert.equal(packageManifest.scripts["prebuild:notebook"], "npm run test:notebook-security");
assert.equal(packageManifest.scripts["test:notebook-security"], "node scripts/verify-notebook-dependencies.mjs");
assert.doesNotMatch(vercelIgnore, /^\/?scripts(?:\/|$)/m, "The build security gate must be deployed.");
const notebookSecurityGate = await readFile(new URL("../scripts/verify-notebook-dependencies.mjs", import.meta.url), "utf8");
assert.match(notebookSecurityGate, /DOMSerializer\.renderSpec/);
assert.match(notebookSecurityGate, /assertPatched\(locked\.version/);

assert(
  notebookEditor.includes('from "@blocknote/core"') &&
    notebookEditor.includes('from "@blocknote/mantine"') &&
    notebookEditor.includes('from "@blocknote/react"'),
  "The Notebook editor is not built from the open-source BlockNote packages."
);
assert(
  notebookEditor.includes("FormattingToolbarController") &&
    notebookEditor.includes("BlockTypeSelect") &&
    notebookEditor.includes('BasicTextStyleButton, { key: "bold", basicTextStyle: "bold" }') &&
    notebookEditor.includes('BasicTextStyleButton, { key: "italic", basicTextStyle: "italic" }') &&
    notebookEditor.includes("CreateLinkButton") &&
    !notebookEditor.includes('type: "fontSize"') &&
    !notebookEditor.includes('type: "textSize"'),
  "The shared Notebook editor must keep the same basic formatting surface as native iOS."
);
assert.equal(notebookSchema.includes("tiptapDocumentToBlockNote"), true);
assert.equal(notebookSchema.includes('notebookSchemaVersion = 2'), true);
assert.equal(packageManifest.dependencies["@tiptap/core"], undefined);
assert(
  appServer.includes('"notebook/assets/upload": handleNotebookAssetUpload') &&
    appServer.includes('"notebook/cards/archive": handleNotebookCardArchive') &&
    appServer.includes('"notebook/assets/read": handleNotebookAssetRead') &&
    appServer.includes('"notebook/assets/delete": handleNotebookAssetDelete') &&
    appServer.includes('type: "notebookImageAsset"') &&
    appServer.includes("notebookImageStorage(asset?.payload?.storageProvider") &&
    appServer.includes("notebookImageContentType(body)") &&
    appServer.includes("NOTEBOOK_IMAGE_ID_CONFLICT") &&
    appServer.includes('"cache-control": "private, no-store"'),
  "Notebook images must use authenticated private Project storage."
);
assert(
  webClient.includes('uploadNotebookAsset(projectID, file, cardID = "", requestIdentity = captureAccountRequest())') &&
    webClient.includes("resolveNotebookAsset(projectID, assetURL, requestIdentity = captureAccountRequest())") &&
    webClient.includes('notebookClientVersion = "20260903-tiptap-security-v14"'),
  "The web Notebook must upload, resolve, and version its private BlockNote images."
);

console.log("permitext build output contract passed");
