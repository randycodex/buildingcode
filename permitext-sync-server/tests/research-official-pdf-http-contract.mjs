import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import { validateGuidanceSourceResolutions } from "../research-guidance-source-resolutions.mjs";

const replayPath = process.argv[2];
const scratch = await mkdtemp(join(tmpdir(), "permitext-official-pdf-http-"));
for (const name of Object.keys(process.env)) {
  if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
}
Object.assign(process.env, {
  NODE_ENV: "", OPENAI_API_KEY: "offline-response-double",
  PERMITEXT_SYNC_DATA_PATH: join(scratch, "store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(scratch, "assets"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_RESEARCH_WEB_SUPPORT: "1",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: "1",
  PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "2",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "2",
  PERMITEXT_RESEARCH_DAILY_CAP_USD: "2",
  PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "2",
  PERMITEXT_RESEARCH_MODEL: "gpt-5.6-terra",
  PERMITEXT_RESEARCH_FAST_MODEL: "gpt-5.6-luna",
  PERMITEXT_RESEARCH_ROUTING_MODE: "hybrid",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "2",
  PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.2",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "12",
  PERMITEXT_RESEARCH_PRICING_VERSION: "offline-test",
  PERMITEXT_RESEARCH_FAST_INPUT_USD_PER_MILLION_TOKENS: "0.2",
  PERMITEXT_RESEARCH_FAST_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.02",
  PERMITEXT_RESEARCH_FAST_OUTPUT_USD_PER_MILLION_TOKENS: "1.2",
  PERMITEXT_RESEARCH_FAST_PRICING_VERSION: "offline-test"
});
const sourceURL = "https://www.nyc.gov/assets/buildings/pdf/bpp_build-sn.pdf";
const releaseURL = "https://www.nyc.gov/assets/buildings/pdf/dob_now_build_release_notes.pdf";
const guideURL = "https://www.nyc.gov/assets/buildings/pdf/dob_now_application_user_guide.pdf";
const codeChangesURL = "https://www.nyc.gov/assets/buildings/pdf/2022_code_changes_dobnow.pdf";
const familyNoticeURL = "https://www.nyc.gov/assets/buildings/pdf/code_site_safety_1-3_family_sn.pdf";
const loftNoticeURL = "https://www.nyc.gov/assets/buildings/pdf/26_lb_dn-sn.pdf";
const companionFixture = JSON.parse(await readFile(new URL("../evals/fixtures/dob-companion-source-fragments-20260909.json", import.meta.url)));
const stakeholderFixture = JSON.parse(await readFile(new URL("../evals/fixtures/dob-stakeholder-source-fragments-20260909.json", import.meta.url)));
const submissionFixture = JSON.parse(await readFile(new URL("../evals/fixtures/dob-filing-submission-source-20260909.json", import.meta.url)));
const loftFixture = JSON.parse(await readFile(new URL("../evals/fixtures/dob-loft-service-document-20260909.json", import.meta.url)));
const officialDocuments = JSON.parse(await readFile(new URL("../evals/fixtures/dob-official-document-pages-20260909.json", import.meta.url)));
const boardUpdate = officialDocuments.documents.find((document) => document.source.id === "dob-build-release-notes")
  .document.passages.find((passage) => passage.pageNumber === 20);
assert.match(boardUpdate.text, /Board added as a Stakeholder/);
const guideDocument = new PDFDocument();
const guideChunks = [];
const guideComplete = new Promise((resolve) => { guideDocument.on("data", (chunk) => guideChunks.push(chunk)); guideDocument.on("end", () => resolve(Buffer.concat(guideChunks))); });
guideDocument.text("Synthetic routing regression source. DOB NOW Alteration routing asks whether the work must meet New Building requirements, is inconsistent with the Certificate of Occupancy, changes occupancy or use, makes a major change to exits, or changes the number of stories. All five No responses result in the Alteration job type. This is portal guidance, not a compliance determination.");
guideDocument.addPage().text("Synthetic review-field regression source. The DOB NOW Building Code review year selection depends on job type, filing date and work type. The address identifies the property; an address alone does not select a review year. This describes the portal field, not enacted code applicability.");
guideDocument.addPage().text("Synthetic percentage-question regression source. Does the alteration alter more than 50 percent of the building gross floor area? A Yes response triggers the Site Safety Plan workflow item. Actual applicability needs the appropriate site safety criteria.");
guideDocument.addPage().text("Synthetic amendment regression source. To revise approved scope and drawings in a DOB NOW filing, the Applicant of Record submits a Post Approval Amendment (PAA). A PAA is unavailable when the filing includes legalization. This describes the filing action, not legal approval of the revised work.");
guideDocument.addPage().text("Synthetic subsequent-filing regression source. Related work on the same construction project uses one job number with separate filing extensions. A subsequent filing may have a different applicant. Check the job type and current companion guidance before stating its completion process.");
guideDocument.addPage().text("Synthetic stormwater regression source. Question one asks whether this project disturbs 20,000 square feet or more of soil or creates 5,000 square feet or more of impervious surface. Question two separately asks whether it is part of a larger common plan of development. A Yes triggers the stormwater document workflow.");
const attestationPage = officialDocuments.documents.find((document) => document.source.id === "dob-application-guide")
  .document.passages.find((passage) => passage.pageNumber === 38);
assert.match(attestationPage.text, /Applicant o\s*f Record/);
guideDocument.addPage().text(attestationPage.text);
guideDocument.end();
const guideBytes = await guideComplete;
async function syntheticPDF(text) {
  const document = new PDFDocument();
  const chunks = [];
  const complete = new Promise((resolve) => { document.on("data", (chunk) => chunks.push(chunk)); document.on("end", () => resolve(Buffer.concat(chunks))); });
  document.text(text); document.end();
  return complete;
}
const codeChangesBytes = await syntheticPDF("Synthetic source: Site Safety Highlights. Construction Superintendent for 1-, 2-, or 3-family buildings. The permit holder must be registered as a General Contractor. In this limited family-building context, a Site Safety Plan is required only when a Construction Superintendent is required. Other building scopes have separate criteria.");
const familyNoticeBytes = await syntheticPDF("Synthetic service notice: Construction Superintendent exception for qualifying New Building, AltCO, Enlargement or Demolition jobs on 1-, 2-, or 3-family buildings with a registered General Contractor as permit holder. This is a limited exception, not a rule for all jobs.");
// Reflow source-derived text into a local PDF double; this tests transport and
// binding, while the fixture separately retains the actual PDF's page/hash.
const loftNoticeBytes = await syntheticPDF(loftFixture.document.passages[0].text);
const releaseDocument = new PDFDocument();
const releaseChunks = [];
const releaseComplete = new Promise((resolve) => { releaseDocument.on("data", (chunk) => releaseChunks.push(chunk)); releaseDocument.on("end", () => resolve(Buffer.concat(releaseChunks))); });
releaseDocument.text("Synthetic regression source: August 2026 Wetlands documents. An initial NB-GC filing flagged as wetlands requires a DEC Jurisdictional Determination.");
releaseDocument.addPage().text("Wetlands documents continued. If the determination requires a DEC Permit, submit it before approval. Otherwise submit a waiver request for the DEC Permit document.");
releaseDocument.addPage().text("Unrelated required documents for NB-GC filing applications flagged in the DOB NOW Property Profile as Mandatory Inclusionary Housing. August 2026 workflow documents and conditional responses.");
// Source-derived reflow for transport/ranking checks; actual page 20 and hash
// remain in the fixture. The current owner-type condition must reach the model.
releaseDocument.addPage().text(boardUpdate.text);
for (const pageNumber of [10, 28, 29, 32]) {
  const page = officialDocuments.documents.find((document) => document.source.id === "dob-build-release-notes")
    .document.passages.find((passage) => passage.pageNumber === pageNumber);
  releaseDocument.addPage().text(page.text);
}
releaseDocument.end();
const releaseBytes = await releaseComplete;
let question = `According to the official service notice at ${sourceURL}, which review type applies to the new application?`;
let resolutionFailure = null;
let payload;
let bytes;
if (replayPath) {
  const pilot = JSON.parse(await readFile(new URL("../evals/results/research-owner-live-pilot-2026-09-07.json", import.meta.url)));
  const call = pilot.providerCalls.find((call) => call.caseID === "PDF-BPP");
  payload = { model: call.model, status: "completed", usage: call.usage, output: call.output };
  question = pilot.cases.find((item) => item.id === "PDF-BPP").question;
  bytes = await readFile(replayPath);
} else {
  const document = new PDFDocument();
  const chunks = [];
  const complete = new Promise((resolve) => { document.on("data", (chunk) => chunks.push(chunk)); document.on("end", () => resolve(Buffer.concat(chunks))); });
  document.text("Synthetic regression source. Builders Pavement Plan filings require Standard Plan Review. This is a filing step, not automatic permit approval.");
  document.end();
  bytes = await complete;
  const text = "Builders Pavement Plan filings require Standard Plan Review according to the official service notice.";
  payload = { model: "gpt-5.6-luna", status: "completed", usage: { input_tokens: 100, output_tokens: 50 }, output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text, annotations: [{ type: "url_citation", start_index: 0, end_index: text.length, url: sourceURL, title: "Service notice" }] }] }] };
}
const nativeFetch = globalThis.fetch;
let providerDoubles = 0;
let documentDoubles = 0;
let corruptDocument = false;
let rejectSummary = false;
let qualificationFailure = null;
let summaryDoubles = 0;
let verificationDoubles = 0;
let portalCase = null;
let missingSafetySources = false;
let missingADUSections = false;
let responseDoubleFailure = null;
const responseDouble = async (url, options) => {
  if (String(url) === "https://api.openai.com/v1/responses") {
    providerDoubles += 1;
    const body = JSON.parse(options.body);
    if (body.tools?.some((tool) => tool.type === "web_search")) {
      if (!portalCase) return Response.json(payload);
      const text = "The DOB NOW application guide describes Alteration routing and the Building Code review year field.";
      return Response.json({ model: body.model, status: "completed", usage: { input_tokens: 100, output_tokens: 50 }, output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text, annotations: [{ type: "url_citation", start_index: 0, end_index: text.length, url: guideURL, title: "Synthetic application guide" }] }] }] });
    }
    if (portalCase) assert(["permitext_official_guidance_summary", "permitext_official_guidance_verification"].includes(body.text.format.name),
      "The portal workflow question must not enter general enacted-code interpretation.");
    const input = JSON.parse(body.input);
    if (portalCase) {
      assert.equal(input.question, question.replace(/\s+/g, " ").trim(), "Retain the complete authored question through normal HTTP whitespace normalization.");
      if (portalCase === "DOBNOW-001") {
        assert.equal(input.conversationFacts.unknown.length, 0);
        assert.equal(input.conversationFacts.qualified.length, 2);
        assert.match(body.instructions, /on the stated facts/);
      }
      if (portalCase === "DOBNOW-003") {
        assert(input.passages.some((passage) => /subsequent filing of an NB or Alteration-CO filing/.test(passage.intro) && /remain Permit Entire/.test(passage.text)));
        assert(input.passages.some((passage) => /subsequent filing of an NB or Alteration-CO filing.*remain Permit Entire/s.test(passage.text)),
          "The FAQ question that scopes the exception must be in the primary passage text.");
        assert(input.passages.some((passage) => /subsequent filing in pre-filing status/.test(passage.text)));
        const completion = input.sourceRelationships.find((relationship) => relationship.kind === "filing_completion_scope");
        assert(completion?.relatedEvidence.some((evidence) => evidence.sourceID === "dob-nb-altco-faq"),
          "Both model stages need the specialized completion consequence alongside the general rule.");
      }
      if (portalCase === "DOBNOW-004") {
        assert(input.passages.some((passage) => /same Applicant of Record as the original filing/.test(passage.text) && /fields are NOT editable/.test(passage.text)));
        assert(input.passages.some((passage) => /Work on floors can be changed with a PAA/.test(passage.text)));
      }
      if (portalCase === "DOBNOW-012") {
        assert(input.passages.some((passage) => /City-owned sewer system/.test(passage.text) && /exclusions and definitions/.test(passage.text)));
        assert(input.passages.some((passage) => /Question two separately/.test(passage.text)));
      }
      if (portalCase === "DOBNOW-016") {
        const text = input.passages.filter((passage) => passage.url.startsWith(loftNoticeURL)).map((passage) => passage.text).join(" ").replace(/\s+/g, " ");
        assert.match(text, /Yes In or affecting an IMD unit File for Loft Board Certification and include a Narrative Statement/);
        assert.match(text, /Once the job filing is submitted/);
        assert.match(text, /No In a commercial unit and does not affect an IMD Unit Request a Letter of No Objection/);
      }
      if (portalCase === "DOBNOW-023") {
        const text = input.passages.filter((passage) => passage.sourceID === "dob-stakeholder-faq").map((passage) => passage.text).join(" ");
        assert.match(text, /Filing Representatives can enter and view all filing information/);
        assert.match(text, /cannot upload plans or submit filings\/permits/);
        assert.match(text, /Owners can review the filing, complete the Owner’s Attestation/);
        assert.doesNotMatch(text, /same email address|Preview to File/);
        const update = input.passages.find((passage) => passage.url.startsWith(releaseURL) && /Board added as a Stakeholder/.test(passage.text));
        assert(update, "Current additional-stakeholder guidance must reach both drafting and verification alongside the base role rules.");
        assert.match(update.text, /Condo Unit Owner or Co\s*-\s*Op Tenant\s*-\s*Shareholder/);
        assert.match(update.text, /NYC\.ID/);
        assert.match(update.text, /Both the owner and the Board representative/);
        const steps = input.passages.filter((passage) => passage.url === submissionFixture.url).map((passage) => passage.text).join(" ");
        assert.match(steps, /Applicant officially submits the job filing/);
        assert.match(steps, /Applicant must review the filing and provide a final electronic signature/);
        assert.match(steps, /other stakeholders must electronically sign the job filing/);
        assert(input.sourceRelationships.some((relationship) => relationship.kind === "conditional_stakeholder"),
          "The source-derived conditional-actor relationship must reach both model stages.");
      }
      if (portalCase === "DOBNOW-014") {
        const text = input.passages.map((passage) => passage.text).join(" ").replace(/\s+/g, " ");
        assert.match(text, /DHCR/);
        assert.match(text, /document is required confirming the building contains 0/);
        assert.match(text, /Otherwise, owners must check Yes to Question 5/);
      }
      if (portalCase === "DOBNOW-017") {
        const text = input.passages.map((passage) => passage.text).join(" ").replace(/\s+/g, " ");
        assert.match(text, /Prior to TCO \(optional\).*required prior to Final CO/);
        assert.match(text, /waiver request is allowed.*cannot be deferred/);
        assert.match(text, /Where does the main entrance of the ADU directly open to/);
        assert.match(text, /Specify Other/);
        assert.match(text, /may not be submitted unless and until/);
      }
      if (portalCase === "DOBNOW-008") {
        assert(input.passages.some((passage) => passage.url.startsWith(guideURL) && /gross floor area/.test(passage.text)));
        if (missingSafetySources) {
          assert.match(input.retrievalLimitation, /documents could not be validated/);
          assert.match(input.retrievalLimitation, /conditions and exceptions remain unverified/);
        } else {
          assert(input.passages.some((passage) => passage.url.startsWith(codeChangesURL) && /In this limited family[ -]+building context/.test(passage.text.replace(/\s+/g, " "))),
            JSON.stringify(input.passages.map(({ url, text }) => ({ url, text }))));
          assert(input.passages.some((passage) => passage.url.startsWith(familyNoticeURL) && /AltCO, Enlargement or Demolition/.test(passage.text.replace(/\s+/g, " "))));
        }
        assert.match(body.instructions, /A heading limits the statements beneath it/);
      }
    }
    let value;
    if (body.text.format.name === "permitext_official_guidance_summary") {
      summaryDoubles += 1;
      const wetlands = /wetlands/i.test(input.question);
      const passages = ["DOBNOW-003", "DOBNOW-004", "DOBNOW-008", "DOBNOW-012", "DOBNOW-014", "DOBNOW-017", "DOBNOW-016", "DOBNOW-023"].includes(portalCase) ? input.passages
        : portalCase ? input.passages.filter((passage) => passage.url.startsWith(guideURL) && passage.page === (portalCase === "DOBNOW-001" ? 1 : portalCase === "DOBNOW-004" ? 4 : 2))
        : wetlands ? input.passages : input.passages.slice(0, 1);
      if (["DOBNOW-001", "DOBNOW-021"].includes(portalCase)) assert.equal(passages.length, 1);
      const citedPassages = portalCase === "DOBNOW-023" ? [
        passages.find((passage) => passage.url.startsWith(guideURL) && /Applicant o\s*f Record/.test(passage.text)),
        passages.find((passage) => passage.sourceID === "dob-stakeholder-faq" && /cannot upload plans or submit filings/.test(passage.text)),
        passages.find((passage) => passage.url.startsWith(releaseURL) && /Board added as a Stakeholder/.test(passage.text)),
        passages.find((passage) => passage.url === submissionFixture.url && /Applicant officially submits/.test(passage.text))
      ] : passages;
      assert(citedPassages.every(Boolean));
      value = {
        paragraphs: [{
          text: rejectSummary ? "The filing automatically grants the construction permit."
            : portalCase === "DOBNOW-001"
              ? "On the stated facts, answer No to all five routing questions; the resulting job type is Alteration."
            : portalCase === "DOBNOW-021"
              ? "An address alone is insufficient to select the review year. Provide the job type, filing date and work type."
            : portalCase === "DOBNOW-004"
              ? "The Applicant of Record submits a Post Approval Amendment to revise the approved scope and drawings. The stated filing does not include legalization."
            : portalCase === "DOBNOW-003"
              ? "Use a subsequent filing under the same job number. Confirm the job type before stating the completion path; an NB or Alteration-CO subsequent filing remains Permit Entire and closes through the initial CO process."
            : portalCase === "DOBNOW-012"
              ? "Answer Yes to the first project-specific threshold question because exactly 5,000 square feet satisfies it. The larger-common-plan question remains separate. Final DEP applicability also depends on City-owned-sewer drainage and current exclusions."
            : portalCase === "DOBNOW-016"
              ? "Answer Yes for work in or affecting the IMD unit. After submitting the job filing, request Loft Board Certification and include a Narrative Statement; the DOB approval hold remains until the required certification is issued."
            : portalCase === "DOBNOW-023"
              ? "The filing representative may prepare filing information but cannot submit the filing. The required applicant and owner attestations remain outstanding."
            : portalCase === "DOBNOW-014"
              ? "The owner cannot simply answer No without the document confirming zero regulated units and explaining why the DHCR records are inaccurate; otherwise the owner must answer Yes."
            : portalCase === "DOBNOW-017"
              ? "Answer Yes and select Basement. The DOHMH Radon and Vapor Level Certificate is required before Final CO, may be uploaded before TCO, allows a waiver request and cannot be deferred."
            : portalCase === "DOBNOW-008"
              ? missingSafetySources
                ? "Answer Yes to the percentage question: the alteration alters 60 percent of gross floor area. The exception documents could not be retrieved, so final Site Safety Plan applicability remains unresolved."
                : "Answer Yes to the percentage question: the alteration alters 60 percent of gross floor area. Final Site Safety Plan applicability remains conditional on the building and work criteria, including the scoped family-building exception with a registered General Contractor."
            : wetlands
              ? "Submit the DEC Jurisdictional Determination. If it requires a DEC Permit, submit that permit before approval; otherwise request a waiver for the permit document."
              : replayPath
                ? "For new BPP applications beginning August 17, 2026, file in DOB NOW: Build using Standard Plan Review and complete the BPP5 Authorization to DOT."
                : "Use Standard Plan Review for the new BPP filing. This filing step does not automatically approve the permit.",
          sourceUses: citedPassages.map((passage) => ({ sourceID: passage.sourceID, claimID: passage.claimID }))
        }], missingFacts: [], evidenceLimitations: []
      };
      if (input.sourceResolutionPacket) {
        assert.equal(Object.keys(body.text.format.schema.properties)[0], "sourceResolutions");
        // Explicit synthetic findings exercise transport and structural gates;
        // they are not generated-answer or professional-acceptance evidence.
        const statements = {
          creation_and_submission_timing: "The supplied creation-timing directions remain unresolved; submission requires I1 submission.",
          filing_completion_scope: "The general separate-LOC direction depends on job type; NB/Alteration-CO subsequent filings remain Permit Entire and close through the initial CO process.",
          field_editability: "Work on Floors remains unresolved because the process page prohibits editing while the FAQ permits floor changes subject to a PW3 cost update.",
          conditional_stakeholder: "If the source's ownership condition applies, the additional board stakeholder must attest before submission."
        };
        value.sourceResolutions = { packetSHA256: input.sourceResolutionPacket.packetSHA256,
          relationships: input.sourceResolutionPacket.relationships.map(({ relationshipIndex, requiredSourceUses }) => {
            const relationship = input.sourceRelationships[relationshipIndex];
            const statement = statements[relationship.kind];
            assert(statement, `Missing explicit fixture for ${relationship.kind}`);
            value.paragraphs[0].text += ` ${statement}`;
            for (const use of requiredSourceUses) if (!value.paragraphs[0].sourceUses.some(item => item.sourceID === use.sourceID && item.claimID === use.claimID)) value.paragraphs[0].sourceUses.push(use);
            return { relationshipIndex, outcome: relationship.kind.includes("timing") || relationship.kind === "field_editability" ? "unresolved" : "conditional", statement, paragraphIndex: 0 };
          }) };
        if (resolutionFailure === "missing_plan") delete value.sourceResolutions;
        if (resolutionFailure === "uncarried_statement") value.paragraphs[0].text = value.paragraphs[0].text.replace(value.sourceResolutions.relationships[0].statement, "");
        if (resolutionFailure === "missing_source") {
          const required = input.sourceResolutionPacket.relationships[0].requiredSourceUses[0];
          value.paragraphs[0].sourceUses = value.paragraphs[0].sourceUses.filter(use => use.sourceID !== required.sourceID || use.claimID !== required.claimID);
        }
      }
    } else {
      assert.equal(body.text.format.name, "permitext_official_guidance_verification");
      validateGuidanceSourceResolutions(input, input.proposedAnswer);
      verificationDoubles += 1;
      assert(input.passages.every((passage) => passage.contentHash?.length === 64));
      if (rejectSummary) {
        assert.match(input.proposedAnswer.answerText, /automatically grants/);
        assert(input.passages.some((passage) => /not automatic permit approval|Once the BPP filing is approved/.test(passage.text)));
      }
      value = rejectSummary
        ? { pass: false, issues: [{ type: "overstated_compliance", detail: "The document does not say filing automatically grants a construction permit." }] }
        : { pass: true, issues: [] };
      // This deterministic verifier double tests receipt transport and gating,
      // not the semantic accuracy of any generated or fixture answer.
      value.qualificationReview = {
        packetSHA256: input.qualificationReviewPacket.packetSHA256,
        passages: input.passages.map((passage, passageIndex) => ({
          passageIndex, finding: "addressed", conditionSpanIDs: [0],
          answerReferences: ["paragraph:0"], reason: "Synthetic verifier fixture for source-review transport."
        }))
      };
      if (qualificationFailure === "missing_receipt") delete value.qualificationReview;
      if (qualificationFailure === "omitted_condition") {
        value.qualificationReview.passages[0].finding = "missing_or_misstated";
        value.qualificationReview.passages[0].reason = "The proposed answer omits a required condition in this passage.";
      }
    }
    return Response.json({ model: body.model, status: "completed", usage: { input_tokens: 100, output_tokens: 100 }, output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
  }
  if (String(url) === sourceURL) {
    documentDoubles += 1;
    return new Response(corruptDocument ? Buffer.from("invalid pdf") : bytes, { headers: { "content-type": "application/pdf" } });
  }
  if (String(url) === releaseURL) return new Response(missingADUSections ? codeChangesBytes : releaseBytes, { headers: { "content-type": "application/pdf" } });
  if (String(url) === guideURL) return new Response(guideBytes, { headers: { "content-type": "application/pdf" } });
  if (String(url) === loftNoticeURL) return new Response(loftNoticeBytes, { headers: { "content-type": "application/pdf" } });
  if (portalCase === "DOBNOW-023" && String(url) === stakeholderFixture.url) return new Response(stakeholderFixture.html, { headers: { "content-type": "text/html" } });
  if (portalCase === "DOBNOW-023" && String(url) === submissionFixture.url) return new Response(submissionFixture.html, { headers: { "content-type": "text/html" } });
  const companion = companionFixture.documents.find((document) => document.url === String(url));
  if (companion) return new Response(companion.html, { headers: { "content-type": "text/html" } });
  if (String(url) === codeChangesURL || String(url) === familyNoticeURL) return missingSafetySources
    ? new Response("Synthetic unavailable source", { status: 503 })
    : new Response(String(url) === codeChangesURL ? codeChangesBytes : familyNoticeBytes, { headers: { "content-type": "application/pdf" } });
  throw new Error(`Unexpected external request in offline contract: ${String(url)}`);
};
globalThis.fetch = async (...args) => {
  try { return await responseDouble(...args); }
  catch (error) { responseDoubleFailure = error; throw error; }
};
let server;
try {
  const { handleRequest } = await import("../app.mjs");
  server = createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const request = async (path, body, token) => {
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const { body: { account } } = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Offline PDF Contract" } });
  await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  const auth = { accountUserID: account.appUserID };
  const ask = async () => {
    const created = await request("/research/conversations/create", { auth }, account.backendSessionToken);
    return request("/research/conversations/message", { auth, conversationID: created.body.conversation.id, question, requestID: randomUUID() }, account.backendSessionToken);
  };
  const response = await ask();
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const answer = [...response.body.conversation.messages].reverse().find((message) => message.role === "assistant").answer;
  assert.match(answer.answerText, /Standard Plan Review/);
  assert.match(answer.answerText, /#page=1/);
  assert.equal(answer.verification.pass, true);
  assert.equal(answer.officialGuidanceSummary.verification.qualificationReview.pass, true);
  assert.equal(answer.citations.length, 0, "Official guidance must not become enacted-code citations.");
  assert.equal(answer.supportingSources[0].sourceValidation, "official_pdf");
  assert.equal(answer.supportingSources[0].controlling, false);
  assert.equal(answer.supportingSources[0].attributedClaims[0].pageNumber, 1);
  assert.equal(answer.supportingSources[0].sourceContentHash.length, 64);
  const saved = await request("/research/answers/get", {
    auth, answerID: response.body.conversation.messages.at(-1).id
  }, account.backendSessionToken);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.answer.immutable, true);
  assert.equal(saved.body.answer.answer.answerText, answer.answerText);
  assert.deepEqual(saved.body.answer.answer.officialGuidanceSummary, answer.officialGuidanceSummary);
  assert.deepEqual(saved.body.answer.answer.supportingSources, answer.supportingSources);
  assert.equal(providerDoubles, replayPath ? 2 : 3, "Known workflows bypass search; a summary and independent verification are both required.");
  if (replayPath) {
    assert.match(answer.answerText, /BPP5/);
    assert.match(answer.answerText, /August 17, 2026/);
    assert(answer.answerText.split(/\s+/).length < 120);
    console.log(`Saved official document summary replay passed: ${answer.answerText.split(/\s+/).length} words; complete source page retained behind the summary.`);
  }
  const beforeWorkflow = providerDoubles;
  question = "A new Builders Pavement Plan application is initiated after August 17, 2026. Where must it be filed, which review type applies, and what authorization step appears?";
  const workflowResponse = await ask();
  assert.equal(workflowResponse.status, 200, JSON.stringify(workflowResponse.body));
  const workflowAnswer = workflowResponse.body.conversation.messages.at(-1).answer;
  assert.match(workflowAnswer.answerText, /Standard Plan Review/);
  assert.equal(workflowAnswer.retrieval.officialWorkflow.retrievalMethod, "official_workflow_catalog");
  assert.equal(providerDoubles, beforeWorkflow + 2, "The BPP workflow bypasses search but verifies its summary.");
  question = "An initial NB-GC filing is on a property flagged in DOB NOW as potentially affected by Tidal Wetlands, Freshwater Wetlands, or a Coastal Erosion Hazard Area. What documents and conditional responses are required under the August 2026 workflow?";
  const wetlandResponse = await ask();
  assert.equal(wetlandResponse.status, 200, JSON.stringify(wetlandResponse.body));
  const wetlandAnswer = wetlandResponse.body.conversation.messages.at(-1).answer;
  assert.match(wetlandAnswer.answerText, /DEC Jurisdictional Determination/);
  assert.match(wetlandAnswer.answerText, /waiver request|request a waiver/);
  assert.doesNotMatch(wetlandAnswer.answerText, /Mandatory Inclusionary Housing/);
  assert.deepEqual(wetlandAnswer.supportingSources.flatMap((source) => source.attributedClaims.map((claim) => claim.pageNumber)), [1, 2]);
  assert.equal(providerDoubles, beforeWorkflow + 4, "The wetlands workflow bypasses search but verifies its summary.");
  assert.equal(summaryDoubles, 3);
  assert.equal(verificationDoubles, 3);
  const retained = JSON.parse(await readFile(new URL("../evals/results/research-owner-api-round2-live-dob-safety-confirmation-2026-09-09.json", import.meta.url)));
  const companionRetained = JSON.parse(await readFile(new URL("../evals/results/research-owner-api-round2-live-dob-companion-confirmation-2026-09-09.json", import.meta.url)));
  for (const id of ["DOBNOW-001", "DOBNOW-003", "DOBNOW-004", "DOBNOW-012", "DOBNOW-014", "DOBNOW-017", "DOBNOW-021", "DOBNOW-016", "DOBNOW-023", "DOBNOW-008"]) {
    portalCase = id;
    question = [...retained.results, ...companionRetained.results].find((item) => item.id === id).question;
    const beforePortal = providerDoubles;
    const response = await ask();
    assert.equal(response.status, 200, `${JSON.stringify(response.body)}\n${responseDoubleFailure?.stack || ""}`);
    const answer = response.body.conversation.messages.at(-1).answer;
    assert.equal(answer.retrieval.allowOfficialGuidanceOnly, true);
    assert.equal(answer.citations.length, 0, "Portal guidance must not acquire irrelevant enacted citations.");
    assert.equal(answer.verification.pass, true);
    assert.equal(providerDoubles - beforePortal, ["DOBNOW-003", "DOBNOW-004", "DOBNOW-008", "DOBNOW-012", "DOBNOW-014", "DOBNOW-017", "DOBNOW-016", "DOBNOW-023"].includes(id) ? 2 : 3, "Known companion sources bypass search; summary and verifier remain required.");
    const expected = { "DOBNOW-001": /On the stated facts/, "DOBNOW-003": /same job number/, "DOBNOW-004": /Applicant of Record submits a Post Approval Amendment/, "DOBNOW-012": /first project-specific threshold question/, "DOBNOW-014": /cannot simply answer No/, "DOBNOW-017": /required before Final CO/, "DOBNOW-021": /address alone is insufficient/, "DOBNOW-008": /alters 60 percent/, "DOBNOW-016": /Loft Board Certification/, "DOBNOW-023": /cannot submit the filing/ };
    assert.match(answer.answerText, expected[id]);
    assert.equal(answer.promptVersion, "20260909-document-summary-v13");
    assert.equal(answer.officialGuidanceSummary.version, "20260909-document-summary-v2",
      "New summaries retain the required qualification receipt; older v1 records remain readable.");
    assert.doesNotMatch(answer.answerText, /sourceResolutions|relationshipIndex|packetSHA256/);
    if (id === "DOBNOW-003") {
      for (const failure of ["missing_plan", "uncarried_statement", "missing_source"]) {
        resolutionFailure = failure;
        const beforeRejected = providerDoubles;
        const rejected = await ask();
        assert(rejected.status >= 400);
        assert.equal(rejected.body.code, "INVALID_RESEARCH_RESPONSE");
        assert.equal(providerDoubles - beforeRejected, 1, "An invalid source resolution stops after the draft without a verifier or retry.");
      }
      resolutionFailure = null;
      qualificationFailure = "omitted_condition";
      const beforeSemantic = providerDoubles;
      const semanticRejection = await ask();
      assert.equal(semanticRejection.body.code, "RESEARCH_VERIFICATION_FAILED");
      assert.equal(providerDoubles - beforeSemantic, 2, "A structurally valid plan cannot override semantic rejection or trigger an extra call.");
      qualificationFailure = null;
    }
    if (id === "DOBNOW-017") {
      missingADUSections = true;
      const beforeMissing = providerDoubles;
      const missing = await ask();
      assert(missing.status >= 400);
      assert.equal(missing.body.code, "RESEARCH_OFFICIAL_GUIDANCE_UNAVAILABLE");
      assert.equal(providerDoubles, beforeMissing, "Missing curated PDF sections must stop before any model or search request.");
      missingADUSections = false;
    }
  }
  missingSafetySources = true;
  const partialSafety = await ask();
  assert.equal(partialSafety.status, 200, `${JSON.stringify(partialSafety.body)}\n${responseDoubleFailure?.stack || ""}`);
  const partialAnswer = partialSafety.body.conversation.messages.at(-1).answer;
  assert.match(partialAnswer.answerText, /applicability remains unresolved/);
  assert(partialAnswer.evidenceLimitations.some((limitation) => /conditions and exceptions remain unverified/.test(limitation)));
  missingSafetySources = false;
  portalCase = null;
  rejectSummary = true;
  question = "A new Builders Pavement Plan application is initiated after August 17, 2026. Where must it be filed, which review type applies, and what authorization step appears?";
  const unsupported = await ask();
  assert(unsupported.status >= 400);
  assert.equal(unsupported.body.code, "RESEARCH_VERIFICATION_FAILED");
  const telemetry = await request("/internal/evaluations/data", { auth }, account.backendSessionToken);
  const failed = telemetry.body.researchSpend.operationMetrics.find((operation) => operation.failureCode === "RESEARCH_VERIFICATION_FAILED");
  assert(failed && failed.charged === false && failed.pendingProviderRequestCount === 0,
    "A rejected summary must not consume the user's turn; dispatched provider usage still settles.");
  rejectSummary = false;
  for (const failure of ["missing_receipt", "omitted_condition"]) {
    qualificationFailure = failure;
    const beforeRejected = providerDoubles;
    const rejectedReview = await ask();
    assert(rejectedReview.status >= 400);
    assert.equal(rejectedReview.body.code, "RESEARCH_VERIFICATION_FAILED");
    assert.equal(providerDoubles - beforeRejected, 2, "A failed qualification review must not add a retry or separate judge.");
  }
  qualificationFailure = null;
  const beforeCorruptDocument = documentDoubles;
  // Keep the generic PDF failure check independent of catalog fallback.
  question = `According to the official service notice at ${sourceURL}, which review type applies to the new application?`;
  corruptDocument = true;
  const rejected = await ask();
  assert.equal(rejected.status, 502);
  assert.equal(rejected.body.code, "RESEARCH_OFFICIAL_GUIDANCE_UNAVAILABLE");
  assert.equal(documentDoubles, beforeCorruptDocument + 1);
  console.log("Official PDF summary HTTP completion, semantic rejection and invalid-document rejection passed; zero external calls, provider responses mocked.");
} finally {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  globalThis.fetch = nativeFetch;
  await rm(scratch, { recursive: true, force: true });
}
