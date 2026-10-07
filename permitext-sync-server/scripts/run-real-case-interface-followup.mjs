// Separate diagnostic: one first-listed question in each family, same writers
// and evidence, but disallow the unused web-support field in every arm.
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, openSync, closeSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import { Agent } from "undici";
import { sha256 } from "./real-case-comparison-dataset.mjs";
import { assertWriterControls } from "./real-case-comparison-requests.mjs";
import { reserveMicros, reserveRequest, settleRequest, chargedMicros, assertSchema } from "./real-case-comparison-budget.mjs";
const index = process.argv.indexOf("--directory");
if (index < 0 || !process.argv[index + 1]) throw Error("Required: --directory PATH");
const directory = resolve(process.argv[index + 1]), primary = join(directory, "paid-run"), destination = join(directory, "interface-followup");
const read = name => JSON.parse(readFileSync(name, "utf8"));
const ids = ["BC-01", "PC-01", "MC-01", "FGC-01", "GAC-01", "ECC-01", "EC-01", "ZR-01"], arms = ["minimal", "simplified", "current"];
const manifest = read(join(directory, "writer-request-preflight.json")), packets = read(join(directory, "evidence-packets.json"));
if (sha256(readFileSync(join(directory, "source.json"), "utf8")) !== manifest.sourceSHA256 || packets.sourceSHA256 !== manifest.sourceSHA256) throw Error("Source changed.");
const requests = new Map();
for (const id of ids) {
  const row = manifest.rows.find(r => r.id === id), bodies = {};
  for (const arm of arms) {
    const body = read(join(directory, "writer-requests", row.variants[arm].file));
    if (sha256(JSON.stringify(body)) !== row.variants[arm].requestSHA256 || /WEB_SOURCE_ID:/.test(body.input)) throw Error("Changed request or actual web sources; cannot disable web support.");
    body.text.format.schema.properties.supportingSourceUses.minItems = 0;
    body.text.format.schema.properties.supportingSourceUses.maxItems = 0;
    reserveMicros(body); bodies[arm] = body; requests.set(`${id}:${arm}`, body);
  }
  assertWriterControls(bodies);
}
if (!process.argv.includes("--live")) {
  console.log(JSON.stringify({ providerCalls: 0, caseIDs: ids, candidates: 24, singleChange: "supportingSourceUses maxItems=0 in every arm, because no web-support sources were supplied", capUSD: 10, costsCarryFromPrimaryRun: true }, null, 2)); process.exit(0);
}
const capIndex = process.argv.indexOf("--cap");
if (process.argv[capIndex + 1] !== "10") throw Error("Only the existing $10 cap is authorized.");
const oldLedger = read(join(primary, "ledger.json"));
if (read(join(primary, "completion.json")).status !== "completed" || existsSync(join(primary, "runner.lock")) || oldLedger.requests.some(r => r.status !== "settled")) throw Error("Primary run must be finished and accounted before this follow-up.");
if (existsSync(destination)) throw Error("Follow-up already exists; preserve first answers.");
const root = fileURLToPath(new URL("../", import.meta.url));
const apiKey = process.env.OPENAI_API_KEY || parseEnv(readFileSync(join(root, ".env.local"), "utf8")).OPENAI_API_KEY;
if (!apiKey) throw Error("No local provider credential.");
mkdirSync(destination, { mode: 0o700 });
const lock = join(destination, "runner.lock"); closeSync(openSync(lock, "wx"));
const atomic = (name, value) => { const file = join(destination, name); writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 }); renameSync(`${file}.tmp`, file); };
const ledger = { ...structuredClone(oldLedger), runnerSHA256: sha256(readFileSync(fileURLToPath(import.meta.url))), createdAt: new Date().toISOString(), priorLedgerSHA256: sha256(JSON.stringify(oldLedger)), requests: oldLedger.requests.map(r => ({ ...r, artifactDirectory: r.artifactDirectory ?? primary, originalKey: r.originalKey ?? r.key, key: `prior:${r.key}`, priorCohort: true })) };
const plan = { status: "separate_exploratory_interface_diagnostic", sourceSHA256: manifest.sourceSHA256, caseIDs: ids, selection: "First-listed question of every family, independent of preference or score", repeats: 1, candidates: 24, changes: ["supportingSourceUses maxItems=0 in every arm"], unchanged: ["All behavioral instructions", "Question, facts and evidence", "Model, effort, service tier and output allowance", "Other interface fields"], primaryAnswersUnchanged: true, machineGrading: "No new paid grading; compare interface validation and retain raw answers", capUSD: 10, priorCostsIncluded: true };
atomic("plan.json", plan); atomic("ledger.json", ledger);
const dispatcher = new Agent({ headersTimeout: 240000, bodyTimeout: 240000 });
const results = new Map(); let next = 0, stopped = false;
const jobs = ids.flatMap((id, index) => arms.map((_, offset) => ({ id, arm: arms[(index + offset) % 3] })));
try {
  const workers = await Promise.allSettled(Array.from({ length: 4 }, async () => {
    while (!stopped && next < jobs.length) {
      const { id, arm } = jobs[next++], key = `${id}:${arm}`, body = requests.get(key), requestID = randomUUID();
      const row = { id: requestID, key, stage: "interface_writer", reservedMicros: reserveMicros(body), requestSHA256: sha256(JSON.stringify(body)), startedAt: new Date().toISOString() };
      try {
        reserveRequest(ledger, row); atomic("ledger.json", ledger); atomic(`${requestID}-request.json`, body);
        const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify(body), dispatcher, signal: AbortSignal.timeout(240000) });
        const payload = await response.json(); atomic(`${requestID}-response.json`, payload);
        settleRequest(ledger, requestID, payload); atomic("ledger.json", ledger);
        const text = (payload.output ?? []).flatMap(o => o.content ?? []).filter(c => c.type === "output_text").map(c => c.text).join("");
        let answer = null, failure = null;
        try { if (!response.ok || payload.status !== "completed") throw Error("Provider did not complete."); answer = JSON.parse(text); assertSchema(answer, body.text.format.schema); }
        catch (error) { failure = error.message; }
        results.set(key, { key, status: failure ? "failed" : "completed", failure, answer, requestSHA256: row.requestSHA256, providerRequestID: requestID });
        atomic(`${requestID}-result.json`, results.get(key));
        console.log(JSON.stringify({ key, completed: results.size, costUpperUSD: chargedMicros(ledger) / 1e6 }));
      } catch (error) {
        stopped = true; const stored = ledger.requests.find(r => r.id === requestID);
        if (stored?.status === "pending") stored.status = "unknown";
        atomic("ledger.json", ledger); throw error;
      }
    }
  }));
  const errors = workers.filter(w => w.status === "rejected");
  if (errors.length) throw Error(errors.map(e => e.reason.message).join("; "));
  const answers = { sourceSHA256: manifest.sourceSHA256, createdAt: new Date().toISOString(), cases: ids.map(id => ({ id, answers: Object.fromEntries(arms.map(arm => [arm, results.get(`${id}:${arm}`)])) })) };
  atomic("answers.json", answers); atomic("answer-freeze.json", { SHA256: sha256(JSON.stringify(answers)), answerCount: 24, beforeAnyGrading: true });
  atomic("completion.json", { status: "completed", cases: 8, attempts: 24, completedAnswers: [...results.values()].filter(r => r.status === "completed").length, costUpperUSD: chargedMicros(ledger) / 1e6, estimatedTokenCostUSD: ledger.requests.reduce((n, r) => n + r.estimatedCostMicros, 0) / 1e6, incrementalCostUpperUSD: ledger.requests.filter(r => !r.priorCohort).reduce((n, r) => n + r.costUpperMicros, 0) / 1e6, capUSD: 10 });
} catch (error) { atomic("completion.json", { status: "stopped", reason: error.message, capUSD: 10, costUpperUSD: chargedMicros(ledger) / 1e6 }); console.error(error.message); process.exitCode = 1; }
finally { await dispatcher.close(); unlinkSync(lock); }
