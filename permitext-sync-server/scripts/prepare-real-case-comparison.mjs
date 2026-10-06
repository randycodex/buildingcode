// No API keys, provider calls, account creation or production mutations.
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { prepareRealCaseDataset, sha256 } from "./real-case-comparison-dataset.mjs";
import { activeCodeSourceCatalog } from "../active-code-source-catalog.mjs";
import { createResearchCorpusRegistry } from "../research-corpus-registry.mjs";
import { researchModelConfiguration } from "../research-config.mjs";

const value = name => {
  const index = process.argv.indexOf(name), result = process.argv[index + 1];
  if (index < 0 || !result || result.startsWith("--")) throw Error(`Required: ${name} VALUE`);
  return result;
};
const sourcePath = resolve(value("--dataset"));
const outputDirectory = resolve(value("--output-directory"));
try { await access(outputDirectory); throw Error("Use a new output directory to preserve frozen preparations."); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const sourceText = await readFile(sourcePath, "utf8");
const prepared = prepareRealCaseDataset(sourceText);
const codeSHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const readerSources = await activeCodeSourceCatalog();
const registry = createResearchCorpusRegistry({ zoningResearchEligibility: true });
const writer = researchModelConfiguration({});
await mkdir(outputDirectory, { recursive: true });
const save = async (name, value) => writeFile(join(outputDirectory, name), JSON.stringify(value, null, 2) + "\n");
await writeFile(join(outputDirectory, "source.json"), sourceText);
await save("model-inputs.json", { sourceSHA256: prepared.sourceSHA256, inputsSHA256: prepared.inputsSHA256, cases: prepared.inputs });
await save("reference-review.json", { sourceSHA256: prepared.sourceSHA256, status: "draft", cases: prepared.references });

// Isolate imports and fail closed on any attempted network read. This audit
// intentionally uses local lexical retrieval, with no semantic/web support.
for (const name of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
Object.assign(process.env, {
  NODE_ENV: "test", PERMITEXT_SYNC_DATA_PATH: join(outputDirectory, "unused-store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(outputDirectory, "unused-assets"),
  PERMITEXT_RESEARCH_MODEL_EVIDENCE_ANALYSIS: "0", PERMITEXT_RESEARCH_WEB_SUPPORT: "0",
  PERMITEXT_RESEARCH_PASSAGE_SEARCH: "0", PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS: "1"
});
let externalAttempts = 0;
globalThis.fetch = async () => { externalAttempts++; throw Error("Offline preparation forbids network calls."); };
const { researchCorpusPlanForTurn, assembledResearchEvidenceForTurn } = await import("../app.mjs");
const { planZoningResearchQuestion } = await import("../research-zoning-planner.mjs");
const rows = [], packets = [];
for (const entry of prepared.inputs) {
  const start = Date.now();
  try {
    const corpusPlan = await researchCorpusPlanForTurn({ question: entry.question, projectFacts: entry.suppliedFacts });
    const zoningRequested = corpusPlan.selected.some(c => c.id === "nyc-zoning-resolution" && c.retrievalRole !== "recall_only");
    const zoningPlan = zoningRequested ? planZoningResearchQuestion({ question: entry.question, projectFacts: entry.suppliedFacts }) : null;
    const assembled = await assembledResearchEvidenceForTurn({
      question: entry.question, messages: [], pinnedEvidence: [], projectFacts: entry.suppliedFacts,
      corpusPlan, zoningPlan
    });
    const sources = assembled.sources || [];
    rows.push({
      id: entry.id, status: "retrieved_locally", milliseconds: Date.now() - start,
      requestedCorpora: corpusPlan.selected.filter(c => c.retrievalRole !== "recall_only").map(c => c.id),
      sourceCount: sources.length, evidenceCharacters: sources.reduce((n, s) => n + String(s.text || "").length, 0),
      retrievedCodePrefixes: [...new Set(sources.map(s => s.codePrefix))],
      sourceReferences: sources.map(s => ({ sourceID: s.sourceID, sectionID: s.sectionID, codePrefix: s.codePrefix, sectionNumber: s.sectionNumber, codeEdition: s.codeEdition })),
      limitations: assembled.coverageLimitations || [], zoningPath: zoningPlan?.path || null,
      evidenceSHA256: sha256(JSON.stringify(sources))
    });
    packets.push({ id: entry.id, input: entry, sources, corpusPlan, zoningPlan, evidenceSHA256: rows.at(-1).evidenceSHA256 });
  } catch (error) {
    rows.push({ id: entry.id, status: "retrieval_error", code: error.code || null, error: error.message, milliseconds: Date.now() - start });
  }
  if (rows.length % 8 === 0) console.log(JSON.stringify({ prepared: rows.length, total: prepared.inputs.length, providerCalls: 0 }));
}
await save("evidence-packets.json", { sourceSHA256: prepared.sourceSHA256, cases: packets });
const automaticPrefixes = new Set(registry.filter(c => c.automaticResearchEligible).flatMap(c => c.codePrefixes));
const preflight = {
  ...prepared.summary, sourceSHA256: prepared.sourceSHA256, inputsSHA256: prepared.inputsSHA256, codeSHA,
  createdAt: new Date().toISOString(), providerCalls: 0, externalAttempts,
  retrievalProfile: "local lexical assembly; draft zoning diagnostic access; no web or semantic search; no supplied answer-key authority pins",
  retrievalCompletedCount: rows.filter(r => r.status === "retrieved_locally").length,
  casesWithNoRetrievedSources: rows.filter(r => r.sourceCount === 0).map(r => r.id),
  retrievalErrorIDs: rows.filter(r => r.status === "retrieval_error").map(r => r.id),
  readerPrefixesAbsentFromAutomaticResearch: readerSources.filter(s => !automaticPrefixes.has(s.codePrefix)).map(s => ({ codePrefix: s.codePrefix, edition: s.editionLabel })),
  candidateWriter: { model: writer.model, effort: writer.reasoningEffort, promptVersion: writer.promptVersion },
  correctnessVerified: false, rows
};
await save("preflight.json", preflight);
await save("comparison-plan.json", {
  status: "prepared_for_review_not_run", sourceSHA256: prepared.sourceSHA256, codeSHA,
  caseIDs: prepared.inputs.map(c => c.id), candidateAnswerCount: prepared.inputs.length * 3,
  writer: preflight.candidateWriter, repeats: 1,
  arms: [
    { id: "minimal", description: "Minimal Permitext-specific behavioral instructions, with the same evidence and output schema." },
    { id: "simplified", description: "Direct answer first, investigate available gaps, cite support, preserve material conditions and state specific remaining uncertainty." },
    { id: "current", description: "Current Permitext writer instructions over the same frozen evidence." }
  ],
  controls: ["Same model and reasoning effort", "Same question and supplied facts", "Same evidence and citations schema", "Same output allowance", "Rotate arm order", "No answer key or grading rubric in writer inputs", "Save every first answer before grading"],
  grading: { blindArmLabels: true, referenceStatus: "draft", dimensions: ["correctness", "completeness", "directness", "unnecessary refusal", "citation support", "material uncertainty"], flagReferenceDisagreements: true },
  separateFollowup: "Full-pipeline test of retrieval, reviewer vetoes and revisions. Writer-only comparison does not measure these.",
  pending: ["Verify expected-answer claims and obtain necessary official text", "Build and dry-run the three writer request variants", "Approve a dollar cap before paid calls", "Run and grade the candidates; do not make a final restrictions decision from this preflight"]
});
console.log(JSON.stringify({ outputDirectory, sourceSHA256: prepared.sourceSHA256, cases: rows.length, retrievedLocally: preflight.retrievalCompletedCount, errors: preflight.retrievalErrorIDs, emptyEvidence: preflight.casesWithNoRetrievedSources, providerCalls: 0, externalAttempts }, null, 2));
