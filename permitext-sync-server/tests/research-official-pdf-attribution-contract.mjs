import assert from "node:assert/strict";
import PDFDocument from "pdfkit";
import { researchOfficialPDFPassages } from "../research-official-pdf-attribution.mjs";
import {
  bindResearchWebSupportToOfficialDocuments,
  fetchResearchOfficialDocumentPassages,
  selectResearchOfficialHTMLPassages
} from "../research-official-html-attribution.mjs";
import { researchOfficialGuidanceOnlyInterpretation, validateResearchInterpretation, finalizeResearchGuidanceOnlyInterpretation } from "../app.mjs";

const sourceURL = "https://www.nyc.gov/assets/buildings/pdf/synthetic-contract.pdf";
async function pdf(pages, options = {}) {
  const document = new PDFDocument({ autoFirstPage: false, ...options });
  const chunks = [];
  const completed = new Promise((resolve, reject) => {
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  for (const text of pages) {
    document.addPage();
    if (text) document.fontSize(12).text(text);
  }
  document.end();
  return completed;
}
const bytes = await pdf([
  "Synthetic test guidance. Required document: a zoning worksheet. Exception: no worksheet is required for an unchanged use.",
  "Synthetic test guidance. A stormwater permit is required before approval. This is a separate workflow.",
  ""
]);
const response = (body = bytes, headers = {}) => new Response(body, {
  headers: { "content-type": "application/pdf", ...headers }
});
const extracted = await researchOfficialPDFPassages(bytes, sourceURL);
assert.equal(extracted.pageCount, 3);
assert.deepEqual(extracted.textlessPages, [3]);
assert.equal(extracted.passages[0].pageNumber, 1);
assert.match(extracted.passages[0].text, /Exception: no\s+worksheet/);
assert.equal(extracted.passages[1].sourceURL, `${sourceURL}#page=2`);
assert.equal(extracted.passages[0].contentHash.length, 64);
const repeated = await researchOfficialPDFPassages(bytes, sourceURL);
assert.deepEqual(repeated, extracted);
const changed = await researchOfficialPDFPassages(await pdf(["A changed worksheet requirement."]), sourceURL);
assert.notEqual(changed.passages[0].id, extracted.passages[0].id);
assert.notEqual(changed.passages[0].contentHash, extracted.passages[0].contentHash);
const selected = selectResearchOfficialHTMLPassages(extracted.passages, "stormwater permit", { maximum: 1 });
assert.equal(selected[0].pageNumber, 2);
assert.deepEqual(selectResearchOfficialHTMLPassages(extracted.passages, "unrelatedgibberish"), []);

let networkCalls = 0;
const fetchImpl = async () => { networkCalls += 1; return response(); };
const fetched = await fetchResearchOfficialDocumentPassages(sourceURL, { officialDomains: ["nyc.gov"], fetchImpl });
assert.equal(fetched.format, "pdf");
assert.equal(fetched.passages[0].pageNumber, 1);
const bound = await bindResearchWebSupportToOfficialDocuments({ sources: [{
  id: "official-contract", url: sourceURL, title: "Synthetic guidance",
  authorityClass: "official_guidance", role: "supporting", controlling: false,
  attributedClaims: [{ id: "wrong-model-claim", text: "Every zoning worksheet is required without exception." }]
}] }, { question: "What does the official guidance say about a zoning worksheet?", officialDomains: ["nyc.gov"], fetchImpl });
assert.equal(bound.sourceValidation.method, "official_documents");
assert.equal(bound.sources[0].sourceValidation, "official_pdf");
assert.equal(bound.sources[0].attributedClaims[0].pageNumber, 1);
assert.match(bound.sources[0].attributedClaims[0].text, /Exception: no\s+worksheet/);
assert.ok(bound.sources[0].attributedClaims.every((claim) => claim.id !== "wrong-model-claim"));
const answer = researchOfficialGuidanceOnlyInterpretation(bound);
assert.match(answer.answerText, /#page=1/);
assert.ok(answer.evidenceLimitations.some((value) => /pages 3/.test(value)));
assert.equal(answer.supportingSources[0].attributedClaims[0].pageNumber, 1);
assert.equal(answer.citations.length, 0);
assert.match(answer.conclusion, /noncontrolling/);
const validated = validateResearchInterpretation(answer, [], bound.sources, { allowOfficialGuidanceOnly: true });
assert.match(validated.answerText, /#page=1/);
const final = finalizeResearchGuidanceOnlyInterpretation(validated, { allowOfficialGuidanceOnly: true });
assert.equal(final.supportingSources[0].attributedClaims[0].pageNumber, 1);
assert.equal(final.supportingSources[0].attributedClaims[0].contentHash, extracted.passages[0].contentHash);
assert.ok(final.evidenceLimitations.some((value) => /pages 3/.test(value)));

for (const [body, code] of [
  [Buffer.from("not a PDF"), "RESEARCH_OFFICIAL_PDF_INVALID"],
  [Buffer.from("%PDF-1.7\nbroken"), "RESEARCH_OFFICIAL_PDF_INVALID"],
  [await pdf([""]), "RESEARCH_OFFICIAL_PDF_NO_TEXT"],
  [await pdf(["Protected text"], { userPassword: "secret-test-password" }), "RESEARCH_OFFICIAL_PDF_ENCRYPTED"]
]) {
  await assert.rejects(() => researchOfficialPDFPassages(body, sourceURL), (error) => error.code === code);
}
await assert.rejects(() => researchOfficialPDFPassages(bytes, sourceURL, { maximumPages: 1 }),
  (error) => error.code === "RESEARCH_OFFICIAL_PDF_TOO_MANY_PAGES");
await assert.rejects(() => researchOfficialPDFPassages(bytes, sourceURL, { maximumCharacters: 10 }),
  (error) => error.code === "RESEARCH_OFFICIAL_PDF_TOO_MUCH_TEXT");
await assert.rejects(() => researchOfficialPDFPassages(bytes, sourceURL, { timeoutMilliseconds: 1 }),
  (error) => error.code === "RESEARCH_OFFICIAL_SOURCE_TIMEOUT");
for (const headers of [{}, { "content-length": String(bytes.length) }]) {
  await assert.rejects(() => fetchResearchOfficialDocumentPassages(sourceURL, {
    officialDomains: ["nyc.gov"], maximumBytes: 10, fetchImpl: async () => response(bytes, headers)
  }), (error) => error.code === "RESEARCH_OFFICIAL_SOURCE_TOO_LARGE");
}
await assert.rejects(() => fetchResearchOfficialDocumentPassages(sourceURL, {
  officialDomains: ["nyc.gov"], fetchImpl: async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private.pdf" } })
}), (error) => error.code === "RESEARCH_OFFICIAL_SOURCE_REDIRECT_REJECTED");
const controller = new AbortController();
const cancelled = researchOfficialPDFPassages(bytes, sourceURL, { signal: controller.signal });
controller.abort(new DOMException("Cancelled by user", "AbortError"));
await assert.rejects(() => cancelled, (error) => error.name === "AbortError");
await assert.rejects(() => bindResearchWebSupportToOfficialDocuments({ sources: [{ url: sourceURL }] }, {
  officialDomains: ["nyc.gov"], signal: controller.signal, fetchImpl
}), (error) => error.name === "AbortError");
assert.equal(networkCalls, 2, "All retrievals used local response doubles; cancellation did not fetch.");
console.log("Research official PDF extraction, attribution, bounds and cancellation passed (zero external/provider calls).");
