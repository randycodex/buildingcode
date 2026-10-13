import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { writerComparisonRequests, assertWriterControls } from "./real-case-comparison-requests.mjs";
import { sha256 } from "./real-case-comparison-dataset.mjs";
import { isResearchPracticalNextStep } from "../research-practical-next-step.mjs";

const index = process.argv.indexOf("--directory");
if (index < 0 || !process.argv[index + 1]) throw Error("Required: --directory PATH");
const directory = resolve(process.argv[index + 1]);
const packets = JSON.parse(await readFile(join(directory, "evidence-packets.json"), "utf8"));
const original = await readFile(join(directory, "source.json"), "utf8");
if (sha256(original) !== packets.sourceSHA256) throw Error("Frozen source changed.");
const destination = join(directory, "writer-requests");
try { await access(destination); throw Error("Writer requests already exist; preserve the original preparation."); }
catch (error) { if (error.code !== "ENOENT") throw error; }
await mkdir(destination);
for (const name of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
Object.assign(process.env, {
  NODE_ENV: "test", OPENAI_API_KEY: "offline-request-capture",
  PERMITEXT_SYNC_DATA_PATH: join(directory, "unused-writer-store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(directory, "unused-writer-assets"),
  PERMITEXT_RESEARCH_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_REASONING_EFFORT: "low"
});
let captured = null, intercepted = 0;
globalThis.fetch = async (url, options) => {
  const target = new URL(url);
  if (target.hostname !== "api.openai.com" || target.pathname !== "/v1/responses") throw Error("Offline writer preparation forbids network calls.");
  captured = JSON.parse(options.body); intercepted++;
  // A permanent fake HTTP failure prevents retries and all answer validation.
  return Response.json({ error: { code: "offline_capture", message: "Request captured without provider dispatch." } }, { status: 400 });
};
const { openAIResearchInterpretation, researchInputForEvidence } = await import("../app.mjs");
const { resolveResearchCodeBasis } = await import("../research-code-basis.mjs");
const rows = [];
for (const packet of packets.cases) {
  if (sha256(JSON.stringify(packet.sources)) !== packet.evidenceSHA256) throw Error(`${packet.id}: frozen evidence changed.`);
  captured = null;
  const question = packet.input.prompt;
  const codeBasis = resolveResearchCodeBasis({ corpusPlan: packet.corpusPlan });
  const messages = [];
  const practicalNextStep = !packet.zoningPlan && isResearchPracticalNextStep(question, messages);
  if (practicalNextStep) throw Error("This frozen cohort compares substantive first-turn code questions.");
  try {
    await openAIResearchInterpretation(question, packet.sources, "isolated-real-case-comparison", {
      responseStyle: "conversational", practicalNextStep, messages,
      zoningPlan: packet.zoningPlan,
      codeBasis
    });
  } catch (error) { if (!captured) throw error; }
  if (captured.model !== "gpt-6-luna" || captured.reasoning?.effort !== "low" || captured.store !== false) throw Error("Unexpected writer configuration.");
  const plain = researchInputForEvidence(question, packet.sources, {});
  if (typeof plain !== "string") throw Error(`${packet.id}: visual evidence requires a separately reviewed comparison.`);
  const marker = "AUTHORIZED ENACTED EVIDENCE\n";
  const sourceIndex = plain.indexOf(marker);
  if (sourceIndex < 0) throw Error("Missing enacted evidence block.");
  const safetyIndex = plain.indexOf("\n\nZONING RESEARCH SAFETY CONTRACT — SERVER GENERATED", sourceIndex);
  const sourceBlock = plain.slice(sourceIndex, safetyIndex < 0 ? undefined : safetyIndex).trimEnd();
  let requests;
  try { requests = writerComparisonRequests({ currentRequest: captured, question, sourceBlock, sharedContext: { codeBasis, corpusPlan: packet.corpusPlan, zoningPlan: packet.zoningPlan } }); }
  catch (error) {
    await writeFile(join(directory, "writer-layout-debug.json"), JSON.stringify({ caseID: packet.id, input: captured.input, sourceBlock }, null, 2));
    throw error;
  }
  const controls = assertWriterControls(requests);
  const variants = {};
  for (const [arm, request] of Object.entries(requests)) {
    const name = `${packet.id}-${arm}.json`;
    await writeFile(join(destination, name), JSON.stringify(request, null, 2) + "\n");
    variants[arm] = { file: name, instructionsCharacters: request.instructions.length, inputCharacters: request.input.length, requestSHA256: sha256(JSON.stringify(request)) };
  }
  rows.push({ id: packet.id, ...controls, variants });
}
const report = {
  sourceSHA256: packets.sourceSHA256, writerRequests: rows.length * 3, cases: rows.length,
  model: "gpt-6-luna", effort: "low", providerCalls: 0, interceptedOfflineRequests: intercepted,
  currentArmMeaning: "Current writer policies relocated into instructions; same frozen local evidence and schema in every arm. Not the final full HTTP pipeline, reviewer or repair behavior.",
  rows
};
await writeFile(join(directory, "writer-request-preflight.json"), JSON.stringify(report, null, 2) + "\n");
const planPath = join(directory, "comparison-plan.json");
const plan = JSON.parse(await readFile(planPath, "utf8"));
plan.pending = plan.pending.filter(item => item !== "Build and dry-run the three writer request variants");
plan.writerRequestPreparation = { completed: true, cases: report.cases, requests: report.writerRequests, providerCalls: 0, report: "writer-request-preflight.json" };
await writeFile(planPath, JSON.stringify(plan, null, 2) + "\n");
console.log(JSON.stringify({ cases: report.cases, writerRequests: report.writerRequests, model: report.model, effort: report.effort, providerCalls: 0, interceptedOfflineRequests: intercepted, identicalEvidenceAcrossArms: true }, null, 2));
