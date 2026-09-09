// Source locations are discovery hints, never an answer key. Each document is
// fetched and validated again before its contents may support an answer.
export const researchDOBWorkflowRoutingVersion = "20260909-legalization-workflow-sources-v5";
const source = (id, title, filename, catalogReviewedOn = "2026-09-08") => Object.freeze({
  id, title, url: `https://www.nyc.gov/assets/buildings/pdf/${filename}`,
  publisher: "NYC Department of Buildings", catalogReviewedOn
});
export const researchDOBWorkflowSources = Object.freeze({
  buildersPavement: source("dob-bpp-service-notice", "Builders Pavement Plan service notice", "bpp_build-sn.pdf"),
  releaseNotes: source("dob-build-release-notes", "DOB NOW: Build release notes", "dob_now_build_release_notes.pdf"),
  applicationGuide: source("dob-application-guide", "DOB NOW application user guide", "dob_now_application_user_guide.pdf"),
  codeChanges2022: source("dob-2022-code-changes", "2022 Construction Codes updates to DOB NOW", "2022_code_changes_dobnow.pdf", "2026-09-09"),
  familySiteSafety: source("dob-family-site-safety-notice", "2022 Construction Codes: Construction Superintendent on 1-, 2- or 3-family buildings", "code_site_safety_1-3_family_sn.pdf", "2026-09-09")
});

export function researchDOBWorkflowRoute(question) {
  const text = String(question || "").replace(/\s+/g, " ").trim();
  const bpp = /\bbuilders?['’]?\s+pavement\s+plan\b|\bBPP(?:5)?\b/i.test(text);
  const dob = /\bDOB\s*NOW\b|\b(?:DOB|Department of Buildings)\b/i.test(text);
  const namedPortal = /\bDOB\s*NOW\b/i.test(text);
  const workflow = /\b(?:fil(?:e|ed|ing|ings)|applications?|job types?|work types?|review types?|documents?|uploads?|submit|submission|attest(?:ation|ations)?|signatures?|form|portal|workflow|tab|screen|field|select|answer (?:yes|no)|check(?:box)?|authorization|waiver|renew(?:al)?|PAA|LOC)\b/i.test(text);
  const formQuestion = namedPortal && /\b(?:questions?|responses?)\b/i.test(text) &&
    /\b(?:answer(?:ed)?|respond|response|select)\b/i.test(text);
  if (!(bpp || dob) || !(workflow || formQuestion)) return null;
  const wetlands = /\bwetlands?\b|\bcoastal erosion\b|\bCEHA\b/i.test(text);
  const siteSafety = /\b(?:site[ -]safety|construction superintendent|SSP)\b|\b(?:alter(?:ing|ation)|demolition)\b[^.?]{0,80}\b(?:50[ -]*(?:%|percent)|fifty[ -]*percent)\b/i.test(text);
  // Naming the portal's Building Code review-year field is not itself a
  // request to determine enacted applicability. Mask only that field name;
  // any separate legal/technical request still requires enacted evidence.
  const reviewField = /\bBuilding Code(?:[ -]+review)?[ -]+(?:year|edition|version)\b/gi;
  const fieldSelection = namedPortal && /\b(?:select|choose|pick|selection|field|dropdown|drop-down|option|which|what)\b/i.test(text);
  const legalQuestion = fieldSelection ? text.replace(reviewField, "portal review field") : text;
  const requiresEnactedAnswer = /\b(?:FAR|floor area ratio|zoning|as[- ]of[- ]right|legal(?:ly)?\b|compli(?:ance|ant|es)|comply|violat(?:ion|e)|permit[- ]exempt|exempt(?:ion)? from|(?:building|plumbing|mechanical|fuel gas|construction) code|code (?:requirement|compliance)|(?:BC|PC|AC|ZR|MC|FGC)\s*(?:§|Section)?\s*\d)/i.test(legalQuestion) ||
    (legalQuestion !== text && /\b(?:govern(?:s|ing)?|appl(?:y|ies|icable|icability)|controll?ing|requires?|required|requirements?|must|mandatory|allowed|permitted|eligib(?:le|ility))\b/i.test(legalQuestion));
  const topic = bpp ? "builders_pavement" : wetlands ? "wetland_documents" : siteSafety ? "site_safety_documents" : "dob_now_workflow";
  const guidanceOnly = (bpp || namedPortal) && !requiresEnactedAnswer;
  const sources = bpp ? [researchDOBWorkflowSources.buildersPavement]
    : wetlands ? [researchDOBWorkflowSources.releaseNotes]
    : siteSafety ? [researchDOBWorkflowSources.applicationGuide, researchDOBWorkflowSources.codeChanges2022, researchDOBWorkflowSources.familySiteSafety]
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
    directDocumentRetrieval: (bpp || wetlands || siteSafety) && guidanceOnly && catalogMatchesRequest,
    passageTerms: bpp ? ["bpp", "bpp5", "pavement"] : wetlands ? ["wetland", "wetlands", "ceha"] : siteSafety ? ["safety", "superintendent"] : [],
    sources
  };
}
