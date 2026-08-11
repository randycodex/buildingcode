import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evidenceDiscoveryVersion } from "../evidence-discovery.mjs";

async function jsonRequest(baseURL, path, options = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method: options.method || "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${payload?.error || text}`);
  return payload;
}

export async function withOfflineResearchHTTPHarness(namespace, evaluate) {
  const safeNamespace = String(namespace || "benchmark").replace(/[^a-z0-9-]/gi, "-");
  const temporaryDirectory = await mkdtemp(join(tmpdir(), `permitext-${safeNamespace}-`));
  const previousEnvironment = new Map();
  const environment = {
    NODE_ENV: "test",
    PERMITEXT_SYNC_DATA_PATH: join(temporaryDirectory, "sync-store.json"),
    PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporaryDirectory, "private-assets"),
    PERMITEXT_SYNC_DATABASE_URL: "",
    DATABASE_URL: "",
    STORAGE_URL: "",
    POSTGRES_URL: "",
    NEON_DATABASE_URL: "",
    PERMITEXT_TEST_RESEARCH_MOCK: "1",
    PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
    PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: `${safeNamespace}-grant-token`
  };
  for (const [key, value] of Object.entries(environment)) {
    previousEnvironment.set(key, process.env[key]);
    process.env[key] = value;
  }

  let server;
  try {
    const { handleRequest } = await import(`../app.mjs?${safeNamespace}=${Date.now()}`);
    server = createServer(handleRequest);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const baseURL = `http://127.0.0.1:${server.address().port}`;
    const providerUserID = `${safeNamespace}-eval`;
    const credential = { provider: "web", providerUserID, displayName: "Benchmark Retrieval Eval" };
    const firstSignIn = await jsonRequest(baseURL, "/account/sign-in", {
      method: "POST",
      body: { credential }
    });
    await jsonRequest(baseURL, "/admin/lifetime-grants/grant", {
      method: "POST",
      token: environment.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN,
      body: { userID: firstSignIn.account.appUserID }
    });
    const account = (await jsonRequest(baseURL, "/account/sign-in", {
      method: "POST",
      body: { credential }
    })).account;

    const sectionCache = new Map();
    const resolveSection = async (requested) => {
      const cacheKey = requested.sectionID
        ? `id:${requested.sectionID}`
        : `${requested.codePrefix}:${requested.sectionNumber}`;
      if (sectionCache.has(cacheKey)) return sectionCache.get(cacheKey);
      let sectionID = String(requested.sectionID || "").trim();
      if (!sectionID) {
        const parameters = new URLSearchParams({
          q: requested.sectionNumber,
          code: requested.codePrefix || "BC",
          limit: "20"
        });
        const search = await jsonRequest(baseURL, `/code/search?${parameters}`);
        const match = (search.results || []).find((item) =>
          item.codePrefix === (requested.codePrefix || "BC") &&
          item.sectionNumber === requested.sectionNumber
        );
        if (!match) throw new Error(`No canonical section for ${requested.codePrefix} ${requested.sectionNumber}.`);
        sectionID = String(match.id);
      }
      const section = (await jsonRequest(baseURL, `/code/sections/${sectionID}`)).section;
      const resolved = {
        sectionID: String(section.sectionID || sectionID),
        codePrefix: section.codePrefix,
        sectionNumber: section.sectionNumber,
        title: section.title,
        codeVersion: section.codeVersion,
        body: { blocks: section.blocks || [] },
        crossReferences: []
      };
      sectionCache.set(cacheKey, resolved);
      sectionCache.set(`id:${resolved.sectionID}`, resolved);
      sectionCache.set(`${resolved.codePrefix}:${resolved.sectionNumber}`, resolved);
      return resolved;
    };
    const discover = async ({ question, limit }) => {
      const discovery = await jsonRequest(baseURL, "/research/evidence/discover", {
        method: "POST",
        token: account.backendSessionToken,
        body: { auth: { accountUserID: account.appUserID }, question, limit }
      });
      assert.equal(discovery.retrievalVersion, evidenceDiscoveryVersion);
      assert.equal(discovery.generatedAnswer, false);
      assert.equal(discovery.paidModelCall, false);
      return discovery;
    };
    return await evaluate({ discover, resolveSection });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(temporaryDirectory, { recursive: true, force: true });
    for (const [key, value] of previousEnvironment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
