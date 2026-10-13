// Free audit using the production writer's normalization/validation boundary.
// Preserve raw answers and machine scores; this is not a semantic review.
import { readFile, writeFile, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sha256 } from "./real-case-comparison-dataset.mjs";
const index = process.argv.indexOf("--directory");
if (index < 0 || !process.argv[index + 1]) throw Error("Required: --directory PATH");
const runIndex = process.argv.indexOf("--run");
const runName = runIndex < 0 ? "paid-run" : process.argv[runIndex + 1];
if (!["paid-run", "interface-followup"].includes(runName)) throw Error("Unrecognized isolated run directory.");
const directory = resolve(process.argv[index + 1]), run = join(directory, runName);
const read = async path => JSON.parse(await readFile(path, "utf8"));
const answers = await read(join(run, "answers.json")), freeze = await read(join(run, "answer-freeze.json")), packets = await read(join(directory, "evidence-packets.json"));
if (sha256(JSON.stringify(answers)) !== freeze.SHA256 || answers.sourceSHA256 !== packets.sourceSHA256) throw Error("Frozen answer/evidence identity changed.");
for (const name of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
Object.assign(process.env, { NODE_ENV: "test", PERMITEXT_SYNC_DATA_PATH: join(directory, "unused-binding-audit-store.json"), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(directory, "unused-binding-audit-assets") });
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw Error("Binding audit forbids all network calls."); };
const { normalizeResearchInterpretationEvidenceBindings, validateResearchInterpretation } = await import("../app.mjs");
const rows = [];
for (const c of answers.cases) {
  const evidence = packets.cases.find(p => p.id === c.id).sources;
  for (const [arm, result] of Object.entries(c.answers)) {
    let status = "generation_failed", errorCode = null, message = result.failure;
    if (result.status === "completed") {
      try {
        validateResearchInterpretation(normalizeResearchInterpretationEvidenceBindings(structuredClone(result.answer), evidence), evidence, [], {});
        status = "passed_binding_boundary"; message = null;
      } catch (error) { status = "failed_binding_boundary"; errorCode = error.code ?? null; message = error.message; }
    }
    rows.push({ id: c.id, arm, status, errorCode, message });
  }
}
if (networkAttempts || sha256(JSON.stringify(await read(join(run, "answers.json")))) !== freeze.SHA256) throw Error("Audit isolation or immutability failed.");
try { await access(process.env.PERMITEXT_SYNC_DATA_PATH); throw Error("Audit unexpectedly created application storage."); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const summary = Object.fromEntries(["minimal", "simplified", "current"].map(arm => [arm, {
  passed: rows.filter(r => r.arm === arm && r.status === "passed_binding_boundary").length,
  failed: rows.filter(r => r.arm === arm && r.status === "failed_binding_boundary").length,
  failuresByCode: Object.fromEntries([...new Set(rows.filter(r => r.arm === arm && r.errorCode).map(r => r.errorCode))].map(code => [code, rows.filter(r => r.arm === arm && r.errorCode === code).length]))
}]));
await writeFile(join(run, "binding-audit.json"), JSON.stringify({ providerCalls: 0, networkAttempts, answersSHA256: freeze.SHA256, rawAnswersChanged: false, method: "Production normalizeResearchInterpretationEvidenceBindings then validateResearchInterpretation; no web sources, semantic reviewer, retry, repair or persistence.", summary, rows }, null, 2) + "\n", { mode: 0o600 });
console.log(JSON.stringify({ providerCalls: 0, networkAttempts, summary }, null, 2));
