import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const releaseID = "monitoring-signal-e2e";
const gitCommit = "0123456789abcdef0123456789abcdef01234567";
const adminToken = "monitoring-signal-admin";
const stripeWebhookSecret = "whsec_monitoring_signal_no_charge";

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  assert(Number.isSafeInteger(port) && port > 0, "Could not allocate a local test port.");
  return port;
}

function parsedEvents(output) {
  return output.join("").split(/\r?\n/u).flatMap((line) => {
    try {
      const value = JSON.parse(line);
      return value && typeof value === "object" ? [value] : [];
    } catch {
      return [];
    }
  });
}

async function waitForEvent(child, output, predicate, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const event = parsedEvents(output).find(predicate);
    if (event) return event;
    if (child.exitCode !== null) {
      throw new Error(`${label}: server exited early.\n${output.join("")}`);
    }
    await sleep(25);
  }
  throw new Error(`${label}: event was not emitted.\n${output.join("")}`);
}

function serverEnvironment(port, dataPath) {
  return {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(port),
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_URL: "monitoring-signal-e2e.invalid",
    DATABASE_URL: "",
    PERMITEXT_SYNC_DATABASE_URL: "",
    STORAGE_URL: "",
    POSTGRES_URL: "",
    NEON_DATABASE_URL: "",
    BLOB_READ_WRITE_TOKEN: "",
    VERCEL_OIDC_TOKEN: "",
    BLOB_STORE_ID: "",
    OPENAI_API_KEY: "",
    PERMITEXT_MONITORING_PROVIDER: "",
    PERMITEXT_SYNC_DATA_PATH: dataPath,
    PERMITEXT_PUBLIC_BASE_URL: `http://127.0.0.1:${port}`,
    PERMITEXT_SYNC_ADMIN_TOKEN: adminToken,
    PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: adminToken,
    PERMITEXT_RELEASE_ID: releaseID,
    PERMITEXT_GIT_COMMIT: gitCommit,
    PERMITEXT_SLOW_REQUEST_MS: "20",
    PERMITEXT_TEST_RESEARCH_MOCK: "",
    PERMITEXT_RESEARCH_KILL_SWITCH: "",
    PERMITEXT_RESEARCH_MAX_REQUEST_USD: "",
    PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "",
    PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "",
    PERMITEXT_RESEARCH_DAILY_CAP_USD: "",
    PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "",
    PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "",
    PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "",
    PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "",
    PERMITEXT_RESEARCH_PRICING_VERSION: "",
    PERMITEXT_REQUIRE_LIVE_STRIPE: "",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: stripeWebhookSecret
  };
}

async function startServer(port, dataPath) {
  const output = [];
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: serverEnvironment(port, dataPath),
    stdio: ["ignore", "pipe", "pipe"]
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => output.push(String(chunk)));
  }
  const baseURL = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(output.join(""));
    try {
      const response = await fetch(`${baseURL}/health`);
      if (response.ok) return { child, output, baseURL };
    } catch {
      // Starting.
    }
    await sleep(50);
  }
  throw new Error(`Permitext monitoring test server did not start.\n${output.join("")}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await once(child, "exit");
}

async function jsonRequest(baseURL, path, { method = "GET", body, token, headers = {}, rawBody } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: rawBody ?? (body ? JSON.stringify(body) : undefined)
  });
  const text = await response.text();
  return {
    response,
    text,
    json: text && response.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(text)
      : null
  };
}

function delayedJSONRequest(baseURL, path, payload) {
  const rawBody = Buffer.from(JSON.stringify(payload));
  const splitAt = Math.min(12, rawBody.length - 1);
  return new Promise((resolve, reject) => {
    const request = httpRequest(`${baseURL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(rawBody.length),
        "x-vercel-id": "monitoring-signal::slow-client-report"
      }
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        statusCode: response.statusCode,
        body: Buffer.concat(chunks).toString("utf8")
      }));
    });
    request.once("error", reject);
    request.write(rawBody.subarray(0, splitAt));
    setTimeout(() => request.end(rawBody.subarray(splitAt)), 50);
  });
}

function stripeSignature(rawBody, timestamp = Math.floor(Date.now() / 1_000)) {
  const signature = createHmac("sha256", stripeWebhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function main() {
  const tempDirectory = await mkdtemp(join(tmpdir(), "permitext-monitoring-signals-"));
  let signalServer = null;
  let errorServer = null;
  try {
    const signalPort = await availablePort();
    signalServer = await startServer(signalPort, join(tempDirectory, "sync-store.json"));

    const clientPayload = {
      kind: "unhandledrejection",
      name: "TypeError",
      message: "Failure for person@example.com?token=secret-value Bearer abc.def.ghi sk_live_private",
      source: "https://permitext.invalid/app.js?token=source-secret",
      route: "/research?authorization=route-secret",
      line: 42,
      column: 8
    };
    const clientResponse = await delayedJSONRequest(
      signalServer.baseURL,
      "/client-errors/report",
      clientPayload
    );
    assert.equal(clientResponse.statusCode, 202, clientResponse.body);
    const clientEvent = await waitForEvent(
      signalServer.child,
      signalServer.output,
      (event) => event.event === "client_error",
      "client error"
    );
    assert.equal(clientEvent.releaseID, releaseID);
    assert.equal(clientEvent.source, "/app.js");
    assert.equal(clientEvent.route, "/research");
    assert.equal(clientEvent.fingerprint.length, 24);
    const clientEventText = JSON.stringify(clientEvent);
    for (const secret of [
      "person@example.com",
      "secret-value",
      "abc.def.ghi",
      "sk_live_private",
      "source-secret",
      "route-secret"
    ]) {
      assert.equal(clientEventText.includes(secret), false, `Client log retained ${secret}.`);
    }
    const slowEvent = await waitForEvent(
      signalServer.child,
      signalServer.output,
      (event) => event.event === "dynamic_route_observation" &&
        event.route === "client-errors" && event.requestID === "monitoring-signal::slow-client-report",
      "slow request"
    );
    assert.equal(slowEvent.severity, "warning");
    assert.equal(slowEvent.statusCode, 202);
    assert(slowEvent.durationMilliseconds >= 20);

    const failedInvoiceEvent = {
      id: "evt_monitoring_invoice_failed",
      type: "invoice.payment_failed",
      livemode: false,
      created: Math.floor(Date.now() / 1_000),
      data: { object: {
        id: "in_monitoring_failed",
        subscription: "sub_monitoring_no_charge"
      } }
    };
    const failedInvoiceBody = JSON.stringify(failedInvoiceEvent);
    const webhook = await jsonRequest(signalServer.baseURL, "/billing/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": stripeSignature(failedInvoiceBody)
      },
      rawBody: failedInvoiceBody
    });
    assert.equal(webhook.response.status, 200, webhook.text);
    const billingEvent = await waitForEvent(
      signalServer.child,
      signalServer.output,
      (event) => event.event === "stripe_invoice_payment_failed",
      "billing warning"
    );
    assert.equal(billingEvent.stripeEventID, failedInvoiceEvent.id);
    assert.equal(billingEvent.subscriptionID, "sub_monitoring_no_charge");

    const signIn = await jsonRequest(signalServer.baseURL, "/account/sign-in", {
      method: "POST",
      body: { credential: {
        provider: "web",
        providerUserID: "monitoring-signal-owner",
        displayName: "Monitoring Signal Owner"
      } }
    });
    assert.equal(signIn.response.status, 200, signIn.text);
    const userID = signIn.json.account.appUserID;
    const token = signIn.json.account.backendSessionToken;
    const grant = await jsonRequest(signalServer.baseURL, "/admin/lifetime-grants/grant", {
      method: "POST",
      token: adminToken,
      body: { userID }
    });
    assert.equal(grant.response.status, 200, grant.text);

    const search = await jsonRequest(signalServer.baseURL, "/code/search?q=101.1&code=BC&limit=20");
    assert.equal(search.response.status, 200, search.text);
    const sectionMatch = search.json.results.find((entry) =>
      entry.codePrefix === "BC" && entry.sectionNumber === "101.1"
    );
    assert(sectionMatch, "The monitoring rehearsal could not resolve BC 101.1.");
    const sectionResponse = await jsonRequest(
      signalServer.baseURL,
      `/code/sections/${encodeURIComponent(sectionMatch.id)}`
    );
    assert.equal(sectionResponse.response.status, 200, sectionResponse.text);
    const passage = (sectionResponse.json.section.blocks || [])
      .map((block) => String(block.plainText || "").trim())
      .find((text) => text.length >= 20);
    assert(passage, "BC 101.1 had no selectable enacted passage.");
    const conversation = await jsonRequest(signalServer.baseURL, "/research/conversations/create", {
      method: "POST",
      token,
      body: {
        auth: { accountUserID: userID },
        selections: [{
          sectionID: String(sectionResponse.json.section.sectionID || sectionMatch.id),
          selectedText: passage.slice(0, 1_200)
        }]
      }
    });
    assert.equal(conversation.response.status, 201, conversation.text);
    const guardrail = await jsonRequest(signalServer.baseURL, "/research/conversations/message", {
      method: "POST",
      token,
      body: {
        auth: { accountUserID: userID },
        conversationID: conversation.json.conversation.id,
        question: "Based only on this selected provision, what does it require?",
        requestID: "monitoring-spend-guardrail"
      }
    });
    assert.equal(guardrail.response.status, 503, guardrail.text);
    assert.equal(guardrail.json.code, "RESEARCH_SPEND_CAP");
    const guardrailEvent = await waitForEvent(
      signalServer.child,
      signalServer.output,
      (event) => event.event === "research_spend_guardrail_rejection",
      "Research spend guardrail"
    );
    assert.equal(guardrailEvent.code, "RESEARCH_SPEND_CAP");
    assert.equal(guardrailEvent.route, "research/conversations/message");
    assert.equal(guardrailEvent.releaseID, releaseID);
    assert.equal(guardrailEvent.user.length, 16);
    assert.equal(guardrailEvent.operation.length, 16);
    assert.equal(JSON.stringify(guardrailEvent).includes(userID), false);
    assert.equal(JSON.stringify(guardrailEvent).includes(conversation.json.conversation.id), false);

    await stopServer(signalServer.child);
    signalServer = null;

    const brokenStorePath = join(tempDirectory, "broken-store");
    await mkdir(brokenStorePath);
    const errorPort = await availablePort();
    errorServer = await startServer(errorPort, brokenStorePath);
    const failedRequest = await jsonRequest(errorServer.baseURL, "/account/sign-in", {
      method: "POST",
      body: { credential: {
        provider: "web",
        providerUserID: "monitoring-error-owner"
      } }
    });
    assert.equal(failedRequest.response.status, 500, failedRequest.text);
    assert.equal(failedRequest.json.error, "Internal server error.");
    const serverErrorEvent = await waitForEvent(
      errorServer.child,
      errorServer.output,
      (event) => event.event === "request_error" && event.route === "account",
      "server error"
    );
    assert.equal(serverErrorEvent.releaseID, releaseID);
    assert.equal(serverErrorEvent.method, "POST");
    assert.equal(serverErrorEvent.fingerprint.length, 24);
    const failedRouteEvent = await waitForEvent(
      errorServer.child,
      errorServer.output,
      (event) => event.event === "dynamic_route_observation" &&
        event.route === "account" && event.statusCode === 500,
      "5xx route"
    );
    assert.equal(failedRouteEvent.severity, "error");

    console.log(JSON.stringify({
      result: "permitext local monitoring signal rehearsal passed",
      signals: [
        "redacted_client_error",
        "custom_threshold_slow_request",
        "billing_lifecycle_warning",
        "research_spend_guardrail_rejection",
        "sanitized_server_error",
        "5xx_route_observation"
      ],
      paidProviderCalls: 0,
      productionWrites: 0,
      externalAlertsDelivered: 0
    }));
  } finally {
    if (signalServer) await stopServer(signalServer.child);
    if (errorServer) await stopServer(errorServer.child);
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

await main();
