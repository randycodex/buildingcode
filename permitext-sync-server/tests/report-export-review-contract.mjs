import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.attributes = {}; this.isConnected = true; this.classList = { add() {}, remove() {} }; }
  focus() { document.activeElement = this; }
  append(...children) { this.children.push(...children); children.forEach(child => { child.parentElement = this; }); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, handler) { this.events[name] = handler; }
  showModal() { this.open = true; }
  close() { this.open = false; this.events.close?.(); }
  remove() { this.removed = true; this.isConnected = false; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); }
  click() { if (this.tag === "a") downloadCount++; this.events.click?.(); }
}
const source = await readFile(new URL("../public/report-export-review.js", import.meta.url), "utf8");
const document = { body: new Element("body"), createElement: tag => new Element(tag) };
let timer, createdBlob, downloadCount = 0, requests = 0, current = true, resolveRequest;
const urls = new Set();
const preferences = new Map();
let storageBlocked = false;
const context = vm.createContext({ document, crypto: { randomUUID: () => "synthetic" },
  localStorage: {
    getItem: key => { if (storageBlocked) throw Error('Storage unavailable'); return preferences.get(key); },
    setItem: (key, value) => { if (storageBlocked) throw Error('Storage unavailable'); preferences.set(key, value); }
  },
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
const canvas = content.children[0];
const themeToggle = header.children[1];
assert.equal(themeToggle.attributes['aria-checked'], 'false');
themeToggle.click();
assert.equal(themeToggle.attributes['aria-checked'], 'true');
assert.equal(dialog.attributes['data-preview-theme'], 'dark');
assert.equal(content.children[0], canvas, 'Changing theme keeps the existing rendered PDF pages');
assert.equal(await createdBlob.text(), "%PDF-frozen-reviewed-bytes");
assert.ok(!status.textContent.includes("Tables included as text"));
download.click();
assert.equal(await createdBlob.text(), "%PDF-frozen-reviewed-bytes");
assert.equal(requests, 1, "Download uses the issued PDF bytes, not a fresh source lookup.");
header.children[2].click();
assert.equal(dialog.removed, true);
assert.equal(urls.size, 0, "Release private object URLs when the review closes.");

dialog = context.openReportExportReview({ ...args, prepare: () => new Promise(resolve => { resolveRequest = resolve; }) });
assert.equal(dialog.attributes['data-preview-theme'], 'dark', 'The next saved version remembers the preview preference');
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

const mount = new Element("article");
const editor = new Element("textarea"), initiallyHidden = new Element("section");
editor.value = "Retained report edits"; editor.hidden = false; initiallyHidden.hidden = true;
mount.append(editor, initiallyHidden); mount.scrollTop = 318;
document.activeElement = editor;
let inline = context.openReportExportReview({...args, mount});
await flush();
assert.equal(inline.tag, "section");
assert.equal(inline.parentElement, mount);
assert.equal(editor.hidden, true);
assert.equal(mount.scrollTop, 0);
inline.children[0].children[2].click();
assert.equal(editor.hidden, false);
assert.equal(initiallyHidden.hidden, true);
assert.equal(editor.value, "Retained report edits");
assert.equal(mount.scrollTop, 318);
assert.equal(document.activeElement, editor);
inline = context.openReportExportReview({...args, mount});
await flush();
const replacement = context.openReportExportReview({...args, mount});
await flush();
assert.equal(inline.removed, true, "Only one inline preview owns the document");
replacement.children[0].children[2].click();
assert.equal(editor.hidden, false);
assert.equal(mount.scrollTop, 318);
console.log("Inline PDF preview passed: shared screen, retained editor/scroll/focus and replacement cleanup.");

let externallyClosed = 0;
const titleControlled = context.openReportExportReview({...args, mount, showClose: false, onClose: () => externallyClosed++});
await flush();
assert.equal(titleControlled.children[0].children.length, 2, 'Title-controlled previews have only the PDF title and theme switch in the header');
assert.equal(document.activeElement, titleControlled.children[0].children[1], 'Focus a visible control when the Close button is absent');
titleControlled.children[0].children[1].click();
assert.equal(titleControlled.children[2].children.length, 1, 'The theme still works without a Close button');
titleControlled.events.keydown({key: 'Escape', preventDefault() {}});
assert.equal(titleControlled.removed, true);
assert.equal(externallyClosed, 1, 'Keyboard dismissal still informs the owning PDF column');
assert.equal(document.activeElement, editor);
assert.equal(editor.value, 'Retained report edits');
console.log('Title-controlled PDF preview passed: no Close button, visible focus, retained theme and Escape dismissal.');

let finishClosedLoad;
const closedWhileLoading = context.openReportExportReview({...args, mount, showClose: false,
  prepare: () => new Promise(resolve => {finishClosedLoad = resolve;})});
closedWhileLoading.dispose();
finishClosedLoad(packet); await flush();
assert.equal(closedWhileLoading.removed, true);
assert.equal(closedWhileLoading.children[2].children.length, 0, 'A late PDF response cannot restore a title-closed preview');
assert.equal(editor.hidden, false);

storageBlocked = true;
const privatePreview = context.openReportExportReview({...args, mount});
await flush();
privatePreview.children[0].children[1].click();
assert.equal(privatePreview.attributes['data-preview-theme'], 'dark', 'Preview theme remains usable when preference storage is blocked');
assert.equal(mount.scrollTop, 0);
privatePreview.children[0].children[2].click();
assert.equal(mount.scrollTop, 318);
console.log('PDF theme passed: accessible toggle, preference retention, original download bytes, unchanged pages and blocked-storage fallback.');
