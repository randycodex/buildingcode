import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.attributes = {}; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, handler) { this.events[name] = handler; }
  showModal() { this.open = true; }
  close() { this.open = false; this.events.close?.(); }
  remove() { this.removed = true; }
  click() { if (this.tag === "a") downloadCount++; this.events.click?.(); }
}
const source = await readFile(new URL("../public/report-export-review.js", import.meta.url), "utf8");
const document = { body: new Element("body"), createElement: tag => new Element(tag) };
let timer, createdBlob, downloadCount = 0, requests = 0, current = true, resolveRequest;
const urls = new Set();
const context = vm.createContext({ document, crypto: { randomUUID: () => "synthetic" },
  setInterval: callback => { timer = callback; return 1; }, clearInterval: () => {},
  URL: { createObjectURL: blob => { createdBlob = blob; urls.add("blob:synthetic"); return "blob:synthetic"; },
    revokeObjectURL: url => urls.delete(url) },
  Blob, Uint8Array, atob, Error, renderReportPDF: async (container, blob) => { createdBlob = blob; const page = new Element("canvas"); container.append(page); return () => {}; } });
vm.runInContext(source.replace(/^import[^\n]+\n/, "").replace("export function", "function"), context);
const packet = { filename: "reviewed.pdf", pdfBlob: new Blob(["%PDF-frozen-reviewed-bytes"]),
  manifest: { project: { name: "Review Project" }, reportVersion: 2, sourceVersions: { selections: [{}] },
    items: [{ kind: "evidence", codeBook: "BC", codeEdition: "2022", sectionNumber: "101.2", title: "Scope",
      passageText: "Complete text including the final exception." },
    { kind: "heading", text: "Your note" }, { kind: "paragraph", text: "Private note." }], disclaimers: ["Unofficial reference."] } };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const args = { isCurrent: () => current,
  prepare: async () => { requests++; return packet; } };
let dialog = context.openReportExportReview(args);
await flush();
const [header, status, content, footer] = dialog.children;
const [retry, download] = footer.children;
assert.equal(download.disabled, false);
assert.equal(downloadCount, 0, "Review must not print, open a PDF or download automatically.");
assert.equal(content.children[0].tag, "canvas");
assert.equal(await createdBlob.text(), "%PDF-frozen-reviewed-bytes");
assert.ok(!status.textContent.includes("Tables included as text"));
download.click();
assert.equal(await createdBlob.text(), "%PDF-frozen-reviewed-bytes");
assert.equal(requests, 1, "Download uses the issued PDF bytes, not a fresh source lookup.");
header.children[1].click();
assert.equal(dialog.removed, true);
assert.equal(urls.size, 0, "Release private object URLs when the review closes.");

dialog = context.openReportExportReview({ ...args, prepare: () => new Promise(resolve => { resolveRequest = resolve; }) });
current = false;
timer();
resolveRequest(packet);
await flush();
assert.equal(dialog.removed, true);
assert.equal(dialog.children[2].children.length, 0, "An account/Project switch must discard a pending private snapshot.");

current = true;
let fail = true;
dialog = context.openReportExportReview({ ...args, prepare: async () => {
  if (fail) throw Error("Complete source unavailable.");
  return packet;
} });
await flush();
assert.equal(dialog.children[1].attributes.role, "alert");
assert.equal(dialog.children[3].children[1].disabled, true);
assert.equal(dialog.children[3].children[0].hidden, false);
fail = false;
dialog.children[3].children[0].click();
await flush();
assert.equal(dialog.children[3].children[1].disabled, false);
dialog.close();
console.log("Export review passed: frozen byte download, complete preview and notes, no automatic print, context-change disposal and recoverable loading errors.");
