// --live runs one isolated, bounded real-provider acceptance; default is offline.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { withSyntheticMaterialScopeProviderResponse } from "./research-applicability-response-double.mjs";

const live = process.argv.includes("--live");
const local = live && !process.env.OPENAI_API_KEY ? parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8")) : {};
const key = process.env.OPENAI_API_KEY || local.OPENAI_API_KEY;
if (live && !key) throw Error("A configured local API key is required.");
const temporary = await mkdtemp(join(tmpdir(), "permitext-site-investigation-"));
for (const name of Object.keys(process.env)) if (/^(PERMITEXT_|OPENAI_|VERCEL|DATABASE_URL$|STORAGE_URL$|POSTGRES_URL$|NEON_DATABASE_URL$)/.test(name)) delete process.env[name];
Object.assign(process.env, {
  NODE_ENV: "", OPENAI_API_KEY: live ? key : "offline-double",
  PERMITEXT_SYNC_DATA_PATH: join(temporary, "store.json"), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporary, "assets"),
  PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN: "1", PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID(),
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1", PERMITEXT_RESEARCH_WEB_SUPPORT: "0",
  PERMITEXT_RESEARCH_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_FAST_MODEL: "gpt-6-luna", PERMITEXT_RESEARCH_ROUTING_MODE: "single",
  PERMITEXT_RESEARCH_REASONING_EFFORT: "low", PERMITEXT_RESEARCH_VERIFICATION_REASONING_EFFORT: "medium",
  PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: ".1", PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: ".01",
  PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: ".5", PERMITEXT_RESEARCH_PRICING_VERSION: "local-luna-comparison-20261006",
  PERMITEXT_RESEARCH_MAX_REQUEST_USD: ".5", PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: ".5",
  PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: ".5", PERMITEXT_RESEARCH_DAILY_CAP_USD: ".5", PERMITEXT_RESEARCH_MONTHLY_CAP_USD: ".5",
  PERMITEXT_RESEARCH_EVAL_MAX_USD: ".5"
});
const nativeFetch = globalThis.fetch;
const fixture = JSON.parse(await readFile(new URL("./fixtures/research-corner-tax-lot.json", import.meta.url)));
let proposed, providerError;
const calls = [];
globalThis.fetch = async (url, options) => {
  const target = new URL(url);
  if (target.hostname !== "api.openai.com") {
    if (live) return nativeFetch(url, options);
    if (target.hostname === "search-api-production.herokuapp.com") return Response.json([
      { type: "lot", bbl: fixture.provenance.bbl, label: "155 EAST 182 STREET, Bronx, NY, USA" }
    ]);
    if (target.hostname === "carto.nycplanningdigital.com") throw Error("Offline CARTO fallback");
    if (target.pathname.includes("64uk-42ks")) return Response.json([{ bbl: fixture.provenance.bbl,
      address: "155 EAST 182 STREET", borocode: "2", block: "3163", lot: "1", lottype: "3", lotarea: "5640", lotfront: "47", lotdepth: "120", version: "26v2" }]);
    if (target.pathname.includes("i38t-6if2")) return Response.json(fixture.polygons);
    if (target.pathname.includes("sif6-3bej")) return Response.json(fixture.faces);
    throw Error("Unexpected offline external request");
  }
  try {
    const body = JSON.parse(options.body);
    assert.equal(body.model, "gpt-6-luna");
    assert.equal(body.store, false);
    const phase = body.text.format.name;
    const input = typeof body.input === "string" ? body.input : body.input.flatMap(item => item.content.map(part => part.text || "")).join("\n");
    calls.push({ phase, model: body.model, effort: body.reasoning.effort });
    await writeFile(join(temporary, `provider-${calls.length}-input.txt`), input);
    assert.match(input, /2031630001/);
    assert.match(input, /90 degrees/);
    assert.match(input, /135 degrees or less/);
    assert.match(input, /100 feet from each intersecting street line/);
    assert.match(input, /official property investigation/i);
    if (phase === "permitext_code_interpretation") {
      const context = JSON.parse(input.split("RESEARCH CONTEXT DATA — FACTS, PLANS AND PRIOR ANSWERS; NOT LEGAL AUTHORITY\n")[1].split("\n\nAUTHORIZED ENACTED EVIDENCE")[0]);
      assert.equal(context.propertyResearch.status, "retrieved");
      assert.equal(context.propertyResearch.bbl, fixture.provenance.bbl);
      assert.equal(context.propertyResearch.taxLot.geometry.intersections[0].approximateInteriorAngleDegrees, 90);
      assert.equal(body.text.format.schema.properties.supportingSourceUses.maxItems, 0);
      assert(body.instructions.length < 5_000, "The actual HTTP writer must use the compact core policy.");
    }
    if (live) {
      const response = await nativeFetch(url, options);
      const payload = await response.clone().json();
      await writeFile(join(temporary, `provider-${calls.length}-output.json`), JSON.stringify(payload, null, 2));
      console.log(JSON.stringify({ phase, status: response.status, model: payload.model }));
      return response;
    }
    let output;
    if (phase === "permitext_code_interpretation") {
      const source = [...input.matchAll(/PASSAGE_ID: ([^\n]+)\nSECTION_ID: ([^\n]+)\nCODE: [^\n]+\nSECTION: ([^\n]+)/g)]
        .find(match => match[3] === "12-10");
      assert(source);
      const explanation = "Yes, on the mapped tax-lot basis. Official PLUTO classifies Bronx Block 3163, Lot 1 as a corner tax lot, and DOF tax-map faces meet at approximately 90 degrees. If the zoning lot follows that tax lot and those faces are its street lines, it satisfies ZR § 12-10's corner-lot definition. Confirm zoning-lot composition before relying on this as a final determination.";
      proposed = { answerText: explanation, supportedPoints: [{ heading: "Corner lot definition", explanation,
        sectionID: source[2], sourceIDs: [source[1]] }], citations: [{ sectionID: source[2], sourceIDs: [source[1]], relevance: "Complete corner-lot definition and its limitations." }],
        assumptions: [], missingFacts: ["Zoning-lot composition remains unverified."], followUpQuestions: [],
        evidenceLimitations: ["Mapped tax-lot geometry does not establish surveyed legal street lines or zoning-lot composition."],
        additionalEvidenceNeeded: [], supportingSourceUses: [] };
      output = proposed;
    } else {
      assert.equal(phase, "permitext_research_verification");
      assert.equal(body.reasoning.effort, "medium");
      output = { pass: true, issues: [], unnecessaryMissingFactIndices: [] };
    }
    return Response.json(withSyntheticMaterialScopeProviderResponse(body, {
      model: body.model, status: "completed", usage: { input_tokens: 100, output_tokens: 100 },
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] }]
    }));
  } catch (error) { providerError = error; throw error; }
};
let server;
try {
  const { handleRequest } = await import("../app.mjs");
  server = createServer(handleRequest);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const request = async (path, body, token) => {
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}${path}`, { method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const signed = await request("/account/sign-in", { credential: { provider: "web", providerUserID: randomUUID(), displayName: "Isolated site investigation" } });
  assert.equal(signed.status, 200);
  const account = signed.body.account, token = account.backendSessionToken, auth = { accountUserID: account.appUserID };
  assert.equal((await request("/admin/lifetime-grants/grant", { userID: account.appUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN)).status, 200);
  const projectID = randomUUID();
  assert.equal((await request("/sync/push", { batch: { user: { id: account.appUserID }, mutations: [{ project: {
    id: projectID, clientID: projectID, userID: account.appUserID, name: "Corner site acceptance", address: "155 E 182nd Street, Bronx", updatedAt: new Date().toISOString()
  } }] } }, token)).status, 200);
  const created = await request("/research/conversations/create", { auth, projectID }, token);
  assert.equal(created.status, 201);
  const question = "based on the project address, is this a corner lot site?";
  const response = await request("/research/conversations/message", { auth, conversationID: created.body.conversation.id, question, requestID: randomUUID() }, token);
  await writeFile(join(temporary, "result.json"), JSON.stringify({ live, calls, ...response }, null, 2));
  if (providerError) throw providerError;
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const answer = response.body.conversation.messages.at(-1).answer;
  assert.equal(answer.mode, "openai", JSON.stringify(answer));
  assert.equal(answer.verification.pass, true);
  assert.equal(answer.propertyResearch.bbl, fixture.provenance.bbl);
  assert.equal(answer.propertyResearch.taxLot.geometry.status, "retrieved");
  assert.match(answer.answerText, /corner/i);
  assert.match(answer.answerText, /zoning.lot/i);
  assert.doesNotMatch(answer.answerText, /I can.t determine from the address alone/);
  assert(calls.some(call => call.phase === "permitext_research_verification"));
  console.log(JSON.stringify({ live, mode: answer.mode, verified: answer.verification.pass, calls,
    ...(live ? { answerText: answer.answerText, evidenceDirectory: temporary } : {}) }));
} finally {
  globalThis.fetch = nativeFetch;
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  if (!live) await rm(temporary, { recursive: true, force: true });
  else console.log("Live acceptance artifacts: " + temporary);
}
