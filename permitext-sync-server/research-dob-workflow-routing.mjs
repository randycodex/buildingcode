// Source locations are discovery hints, never an answer key. Each document is
// fetched and validated again before its contents may support an answer.
export const researchDOBWorkflowRoutingVersion = "20260909-stakeholder-update-sources-v8";
const source = (id, title, filename, catalogReviewedOn = "2026-09-08") => Object.freeze({
  id, title, url: `https://www.nyc.gov/assets/buildings/pdf/${filename}`,
  publisher: "NYC Department of Buildings", catalogReviewedOn
});
const htmlSource = (id, title, url, sectionHeadings) => Object.freeze({
  id, title, url, publisher: url.includes("/dep/") ? "NYC Department of Environmental Protection" : "NYC Department of Buildings",
  catalogReviewedOn: "2026-09-09", ...(sectionHeadings ? { sectionHeadings } : {})
});
const buildFAQ = "https://www.nyc.gov/site/buildings/industry/dob-now-build-faqs.page";
export const researchDOBWorkflowSources = Object.freeze({
  buildersPavement: source("dob-bpp-service-notice", "Builders Pavement Plan service notice", "bpp_build-sn.pdf"),
  releaseNotes: source("dob-build-release-notes", "DOB NOW: Build release notes", "dob_now_build_release_notes.pdf"),
  applicationGuide: source("dob-application-guide", "DOB NOW application user guide", "dob_now_application_user_guide.pdf"),
  codeChanges2022: source("dob-2022-code-changes", "2022 Construction Codes updates to DOB NOW", "2022_code_changes_dobnow.pdf", "2026-09-09"),
  familySiteSafety: source("dob-family-site-safety-notice", "2022 Construction Codes: Construction Superintendent on 1-, 2- or 3-family buildings", "code_site_safety_1-3_family_sn.pdf", "2026-09-09"),
  loftNotice: source("dob-loft-board-service-notice", "Loft Board Requests in DOB NOW: Build service notice", "26_lb_dn-sn.pdf", "2026-09-09"),
  stakeholderFAQ: htmlSource("dob-stakeholder-faq", "DOB NOW: Build FAQs — Owner and Professional Responsibilities", buildFAQ, ["Roles & Responsibilities: Owner", "Roles & Responsibilities: Professionals"]),
  subsequentFAQ: htmlSource("dob-subsequent-faq", "DOB NOW: Build FAQs — Subsequent Filings", buildFAQ, ["Subsequent Filings"]),
  nbFAQ: htmlSource("dob-nb-altco-faq", "DOB NOW: New Building and Alteration-CO FAQs", "https://www.nyc.gov/site/buildings/industry/new-building-buildfaqs.page"),
  paaPage: htmlSource("dob-paa-process", "DOB NOW: Post Approval Amendment process", "https://www.nyc.gov/site/buildings/industry/post-approval-amendment-paa.page", ["The PAA Process – DOB NOW: Build Job Filings"]),
  paaFAQ: htmlSource("dob-paa-faq", "DOB NOW: Build FAQs — Post Approval Amendments", buildFAQ, ["Post Approval Amendments"]),
  stormwater: htmlSource("dep-stormwater-permits", "DEP Stormwater Permits", "https://www.nyc.gov/site/dep/water/stormwater-permits.page", ["Stormwater Permits"])
});

export function researchDOBWorkflowRoute(question) {
  const text = String(question || "").replace(/\s+/g, " ").trim();
  const bpp = /\bbuilders?['’]?\s+pavement\s+plan\b|\bBPP(?:5)?\b/i.test(text);
  const dob = /\bDOB\s*NOW\b|\b(?:DOB|Department of Buildings)\b/i.test(text);
  const namedPortal = /\bDOB\s*NOW\b/i.test(text);
  const workflow = /\b(?:fil(?:e|ed|ing|ings)|applications?|job types?|work types?|review types?|documents?|uploads?|submit|submission|attest(?:ation|ations)?|signatures?|form|portal|workflow|tab|screen|field|select|answer (?:yes|no)|check(?:box)?|authorization|waiver|renew(?:al)?|PAA|LOC)\b/i.test(text);
  const formQuestion = namedPortal && /\b(?:questions?|responses?)\b/i.test(text) &&
    /\b(?:answer(?:ed)?|respond|response|select)\b/i.test(text);
  if (!(bpp || dob) || !(workflow || formQuestion || /\bpost[ -]approval amendments?\b/i.test(text))) return null;
  const wetlands = /\bwetlands?\b|\bcoastal erosion\b|\bCEHA\b/i.test(text);
  const siteSafety = /\b(?:site[ -]safety|construction superintendent|SSP)\b|\b(?:alter(?:ing|ation)|demolition)\b[^.?]{0,80}\b(?:50[ -]*(?:%|percent)|fifty[ -]*percent)\b/i.test(text);
  const paa = /\b(?:PAA|post[ -]approval amendments?)\b|\bapproved\b[^.?]{0,100}\b(?:scope|drawings)\b[^.?]{0,100}\b(?:revis(?:e|ed|ion)|amend(?:ed|ment)?|chang(?:e|ed))\b/i.test(text);
  const subsequent = /\bsubsequent\s+filings?\b/i.test(text);
  const stormwater = /\bstormwater\b|\bimpervious\s+(?:area|surface)\b/i.test(text);
  const loft = /\b(?:Loft (?:Law|Board)|interim multiple dwelling|IMD)\b/i.test(text);
  const filingRepresentative = /\bfiling representatives?\b/i.test(text) && /\b(?:attest(?:ation|ations)?|sign(?:ature)?|submit|submission)\b/i.test(text);
  // Naming the portal's Building Code review-year field is not itself a
  // request to determine enacted applicability. Mask only that field name;
  // any separate legal/technical request still requires enacted evidence.
  const reviewField = /\bBuilding Code(?:[ -]+review)?[ -]+(?:year|edition|version)\b/gi;
  const fieldSelection = namedPortal && /\b(?:select|choose|pick|selection|field|dropdown|drop-down|option|which|what)\b/i.test(text);
  const legalQuestion = fieldSelection ? text.replace(reviewField, "portal review field") : text;
  const requiresEnactedAnswer = /\b(?:FAR|floor area ratio|zoning|as[- ]of[- ]right|legal(?:ly)?\b|compli(?:ance|ant|es)|comply|violat(?:ion|e)|permit[- ]exempt|exempt(?:ion)? from|(?:building|plumbing|mechanical|fuel gas|construction) code|code (?:requirement|compliance)|(?:BC|PC|AC|ZR|MC|FGC)\s*(?:§|Section)?\s*\d)/i.test(legalQuestion) ||
    (legalQuestion !== text && /\b(?:govern(?:s|ing)?|appl(?:y|ies|icable|icability)|controll?ing|requires?|required|requirements?|must|mandatory|allowed|permitted|eligib(?:le|ility))\b/i.test(legalQuestion));
  const topic = bpp ? "builders_pavement" : wetlands ? "wetland_documents" : siteSafety ? "site_safety_documents"
    : paa ? "post_approval_amendments" : subsequent ? "subsequent_filings" : stormwater ? "stormwater_documents"
    : loft ? "loft_board_documents" : filingRepresentative ? "filing_stakeholder_roles" : "dob_now_workflow";
  const guidanceOnly = (bpp || namedPortal) && !requiresEnactedAnswer;
  const sources = bpp ? [researchDOBWorkflowSources.buildersPavement]
    : wetlands ? [researchDOBWorkflowSources.releaseNotes]
    : siteSafety ? [researchDOBWorkflowSources.applicationGuide, researchDOBWorkflowSources.codeChanges2022, researchDOBWorkflowSources.familySiteSafety]
    : paa ? [researchDOBWorkflowSources.paaPage, researchDOBWorkflowSources.paaFAQ, researchDOBWorkflowSources.applicationGuide]
    : subsequent ? [researchDOBWorkflowSources.applicationGuide, researchDOBWorkflowSources.subsequentFAQ, researchDOBWorkflowSources.nbFAQ]
    : stormwater ? [researchDOBWorkflowSources.applicationGuide, researchDOBWorkflowSources.stormwater]
    : loft ? [researchDOBWorkflowSources.loftNotice, researchDOBWorkflowSources.releaseNotes, researchDOBWorkflowSources.applicationGuide]
    : filingRepresentative ? [researchDOBWorkflowSources.applicationGuide, researchDOBWorkflowSources.stakeholderFAQ, researchDOBWorkflowSources.releaseNotes]
    : [researchDOBWorkflowSources.releaseNotes, researchDOBWorkflowSources.applicationGuide];
  const requestedURLs = text.match(/https:\/\/[^\s<>"\])]+/gi) || [];
  // An explicit source request takes priority over a catalog shortcut.
  const catalogMatchesRequest = requestedURLs.every((url) =>
    sources.some((source) => source.url === url.replace(/[.,;]+$/, "").split("#")[0])
  );
  return {
    version: researchDOBWorkflowRoutingVersion,
    topic,
    guidanceOnly,
    directDocumentRetrieval: (bpp || wetlands || siteSafety || paa || subsequent || stormwater || loft || filingRepresentative) && guidanceOnly && catalogMatchesRequest,
    passageTerms: bpp ? ["bpp", "bpp5", "pavement"] : wetlands ? ["wetland", "wetlands", "ceha"] : siteSafety ? ["safety", "superintendent"]
      : paa ? ["paa", "amendment", "amendments"] : subsequent ? ["subsequent"] : stormwater ? ["stormwater", "impervious"]
      : loft ? ["loft", "imd"] : filingRepresentative ? ["attestation", "attestations", "attest", "representative", "representatives"] : [],
    sources
  };
}
