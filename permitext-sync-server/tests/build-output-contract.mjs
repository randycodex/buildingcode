import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import notebookViteConfig from "../vite.notebook.config.js";

assert.equal(
  notebookViteConfig.build?.emptyOutDir,
  false,
  "The notebook build must not delete unrelated files in its output directory."
);

const notebookEditor = await readFile(new URL("../src/notebook-editor.js", import.meta.url), "utf8");
const notebookSchema = await readFile(new URL("../src/notebook-schema.js", import.meta.url), "utf8");
const appServer = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
const webClient = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const packageManifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

assert(
  notebookEditor.includes('from "@blocknote/core"') &&
    notebookEditor.includes('from "@blocknote/mantine"') &&
    notebookEditor.includes('from "@blocknote/react"'),
  "The Notebook editor is not built from the open-source BlockNote packages."
);
assert(
  notebookEditor.includes('type: "fontSize"') &&
    notebookEditor.includes('{ label: "14", value: "" }') &&
    notebookEditor.includes('className: "notebook-font-size-icon"') &&
    !notebookEditor.includes('label: "Default"') &&
    notebookEditor.includes('className: "notebook-font-size-select"') &&
    notebookEditor.includes("FormattingToolbarController") &&
    notebookEditor.includes("editor.addStyles({ fontSize: value })") &&
    notebookEditor.includes("editor.removeStyles({ fontSize: activeFontSize })"),
  "Every shared BlockNote editor must offer inline text-size formatting."
);
assert.equal(notebookSchema.includes("tiptapDocumentToBlockNote"), true);
assert.equal(notebookSchema.includes('notebookSchemaVersion = 2'), true);
assert.equal(packageManifest.dependencies["@tiptap/core"], undefined);
assert(
  appServer.includes('"notebook/assets/upload": handleNotebookAssetUpload') &&
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
  webClient.includes('uploadNotebookAsset(projectID, file, cardID = "")') &&
    webClient.includes("resolveNotebookAsset(projectID, assetURL)") &&
    webClient.includes('notebookClientVersion = "20260801-notebook-font-size-v8"'),
  "The web Notebook must upload, resolve, and version its private BlockNote images."
);

console.log("permitext build output contract passed");
