// Source locations are discovery hints, never an answer key. Each document is
// fetched and validated again before its contents may support an answer.
export const researchDOBWorkflowRoutingVersion = "20260908-dob-procedural-sources-v1";
const source = (id, title, filename) => Object.freeze({
  id, title, url: `https://www.nyc.gov/assets/buildings/pdf/${filename}`,
  publisher: "NYC Department of Buildings", catalogReviewedOn: "2026-09-08"
});
export const researchDOBWorkflowSources = Object.freeze({
  buildersPavement: source("dob-bpp-service-notice", "Builders Pavement Plan service notice", "bpp_build-sn.pdf"),
  releaseNotes: source("dob-build-release-notes", "DOB NOW: Build release notes", "dob_now_build_release_notes.pdf"),
  applicationGuide: source("dob-application-guide", "DOB NOW application user guide", "dob_now_application_user_guide.pdf")
});

export function researchDOBWorkflowRoute(question) {
  const text = String(question || "").replace(/\s+/g, " ").trim();
  const bpp = /\bbuilders?['’]?\s+pavement\s+plan\b|\bBPP(?:5)?\b/i.test(text);
  const dob = /\bDOB\s*NOW\b|\b(?:DOB|Department of Buildings)\b/i.test(text);
  const namedPortal = /\bDOB\s*NOW\b/i.test(text);
  const workflow = /\b(?:fil(?:e|ed|ing|ings)|applications?|job types?|work types?|review types?|documents?|uploads?|submit|submission|attest(?:ation|ations)?|signatures?|form|portal|workflow|tab|screen|field|select|answer (?:yes|no)|check(?:box)?|authorization|waiver|renew(?:al)?|PAA|LOC)\b/i.test(text);
  if (!(bpp || dob) || !workflow) return null;
  const wetlands = /\bwetlands?\b|\bcoastal erosion\b|\bCEHA\b/i.test(text);
  const requiresEnactedAnswer = /\b(?:FAR|floor area ratio|zoning|as[- ]of[- ]right|legal(?:ly)?|compli(?:ance|ant|es)|comply|violat(?:ion|e)|permit[- ]exempt|exempt(?:ion)? from|(?:building|plumbing|mechanical|fuel gas|construction) code|code (?:requirement|compliance)|(?:BC|PC|AC|ZR|MC|FGC)\s*(?:§|Section)?\s*\d)/i.test(text);
  const topic = bpp ? "builders_pavement" : wetlands ? "wetland_documents" : "dob_now_workflow";
  const guidanceOnly = (bpp || namedPortal) && !requiresEnactedAnswer;
  const sources = bpp ? [researchDOBWorkflowSources.buildersPavement]
    : wetlands ? [researchDOBWorkflowSources.releaseNotes]
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
    directDocumentRetrieval: (bpp || wetlands) && guidanceOnly && catalogMatchesRequest,
    passageTerms: bpp ? ["bpp", "bpp5", "pavement"] : wetlands ? ["wetland", "wetlands", "ceha"] : [],
    sources
  };
}
