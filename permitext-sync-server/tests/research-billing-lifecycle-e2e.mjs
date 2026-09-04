import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { withFileStoreLock, writeJSONFileAtomically } from "../file-store-coordinator.mjs";
import {
  applyResearchConversationMessageCommit,
  applyResearchUsageReservation,
  researchRequestMessageIdentity,
  researchRequestQuestionFingerprint,
  researchRequestReservationID
} from "../app.mjs";

const adminToken = "research-billing-e2e-admin";
const stripeWebhookSecret = "whsec_research_billing_e2e";
const stripePackPriceID = "price_research_turns_25_e2e";

function stripeSignature(rawBody, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  assert(Number.isSafeInteger(port) && port > 0, "Could not allocate a local test port.");
  return port;
}

async function main() {
  const port = await availablePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const tempDir = await mkdtemp(join(tmpdir(), "permitext-research-billing-e2e-"));
  const dataPath = join(tempDir, "sync-store.json");
  const serverOutput = [];
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      VERCEL: "",
      VERCEL_ENV: "",
      DATABASE_URL: "",
      STORAGE_URL: "",
      POSTGRES_URL: "",
      NEON_DATABASE_URL: "",
      BLOB_READ_WRITE_TOKEN: "",
      VERCEL_OIDC_TOKEN: "",
      BLOB_STORE_ID: "",
      OPENAI_API_KEY: "",
      PERMITEXT_TEST_RESEARCH_MOCK: "",
      PERMITEXT_SYNC_DATA_PATH: dataPath,
      PERMITEXT_PUBLIC_BASE_URL: baseURL,
      PERMITEXT_SYNC_ADMIN_TOKEN: adminToken,
      PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: adminToken,
      PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT: "1",
      PERMITEXT_RESEARCH_PAID_TURNS_ENABLED: "1",
      PERMITEXT_RESEARCH_MAX_REQUEST_USD: "100",
      PERMITEXT_RESEARCH_USER_DAILY_CAP_USD: "100",
      PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD: "100",
      PERMITEXT_RESEARCH_DAILY_CAP_USD: "100",
      PERMITEXT_RESEARCH_MONTHLY_CAP_USD: "100",
      PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS: "1",
      PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS: "0.1",
      PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS: "1",
      PERMITEXT_RESEARCH_PRICING_VERSION: "research-billing-e2e",
      PERMITEXT_RESEARCH_FAST_MODEL: "",
      STRIPE_SECRET_KEY: "sk_test_research_billing_e2e",
      STRIPE_RESEARCH_TURNS_25_PRICE_ID: stripePackPriceID,
      STRIPE_RESEARCH_TURNS_100_PRICE_ID: "",
      STRIPE_WEBHOOK_SECRET: stripeWebhookSecret
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => {
      serverOutput.push(String(chunk));
      if (serverOutput.length > 100) serverOutput.shift();
    });
  }

  async function request(path, { method = "GET", body, token, headers = {}, rawBody } = {}) {
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
    const json = text && response.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(text)
      : null;
    const events = text.split("\n").filter(Boolean).flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
    return { response, text, json, events };
  }

  async function waitForServer() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (child.exitCode !== null) {
        throw new Error(`Test server exited early.\n${serverOutput.join("")}`);
      }
      try {
        const health = await request("/health");
        if (health.response.ok) return;
      } catch {
        // The server is still starting.
      }
      await sleep(100);
    }
    throw new Error(`Test server did not become ready.\n${serverOutput.join("")}`);
  }

  async function signIn(providerUserID) {
    const result = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID,
          displayName: `Research Billing ${providerUserID}`
        }
      }
    });
    assert.equal(result.response.status, 200, result.text);
    return {
      userID: result.json.account.appUserID,
      token: result.json.account.backendSessionToken
    };
  }

  async function usage(user) {
    const result = await request("/research/usage", {
      method: "POST",
      token: user.token,
      body: { auth: { accountUserID: user.userID } }
    });
    assert.equal(result.response.status, 200, result.text);
    return result.json.usage;
  }

  async function stripeWebhook(event) {
    const rawBody = JSON.stringify(event);
    return request("/billing/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": stripeSignature(rawBody, stripeWebhookSecret)
      },
      rawBody
    });
  }

  try {
    await waitForServer();
    const freeUser = await signIn("research-billing-free");
    const freeCheckout = await request("/billing/research/checkout", {
      method: "POST",
      token: freeUser.token,
      body: {
        auth: { accountUserID: freeUser.userID },
        packID: "research-turns-25"
      }
    });
    assert.equal(freeCheckout.response.status, 403);
    assert.equal(freeCheckout.json.code, "PRO_REQUIRED_FOR_RESEARCH");

    const owner = await signIn("research-billing-owner");
    const grant = await request("/admin/lifetime-grants/grant", {
      method: "POST",
      token: adminToken,
      body: { userID: owner.userID }
    });
    assert.equal(grant.response.status, 200, grant.text);

    const invalidReturn = await request("/billing/research/checkout", {
      method: "POST",
      token: owner.token,
      body: {
        auth: { accountUserID: owner.userID },
        packID: "research-turns-25",
        successURL: "https://example.invalid/checkout"
      }
    });
    assert.equal(invalidReturn.response.status, 400);
    assert.match(invalidReturn.json.error, /Permitext origin/);

    await withFileStoreLock(dataPath, async () => {
      const storeBeforeUsage = JSON.parse(await readFile(dataPath, "utf8"));
      storeBeforeUsage.researchUsageByUserID ||= {};
      storeBeforeUsage.researchUsageByUserID[owner.userID] = [{
        id: "included-turn-completed",
        model: "test-model",
        mode: "openai",
        fundingSource: "included",
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        createdAt: new Date().toISOString()
      }];
      await writeJSONFileAtomically(dataPath, storeBeforeUsage);
    });

    const exhaustedUsage = await usage(owner);
    assert.equal(exhaustedUsage.includedRemaining, 0);
    assert.equal(exhaustedUsage.purchasedRemaining, 0);
    assert.equal(exhaustedUsage.canResearch, false);
    assert.equal(exhaustedUsage.purchaseRequired, true);
    assert.deepEqual(
      exhaustedUsage.packs.map((pack) => [pack.id, pack.turns, pack.webAvailable]),
      [
        ["research-turns-25", 25, true],
        ["research-turns-100", 100, false]
      ]
    );

    const checkoutSessionID = "cs_research_billing_e2e_25";
    const paymentIntentID = "pi_research_billing_e2e_25";
    const checkoutEvent = {
      id: "evt_research_billing_checkout",
      type: "checkout.session.completed",
      livemode: false,
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: checkoutSessionID,
          mode: "payment",
          payment_status: "paid",
          customer: "cus_research_billing_e2e",
          payment_intent: paymentIntentID,
          client_reference_id: owner.userID,
          metadata: {
            accountUserID: owner.userID,
            purchaseKind: "research_credits",
            researchCreditPackID: "research-turns-25",
            researchCredits: "25"
          }
        }
      }
    };
    const fulfilled = await stripeWebhook(checkoutEvent);
    assert.equal(fulfilled.response.status, 200, fulfilled.text);
    assert.equal(fulfilled.json.changed, true);
    assert.equal((await usage(owner)).purchasedRemaining, 25);

    const duplicateFulfillment = await stripeWebhook(checkoutEvent);
    assert.equal(duplicateFulfillment.response.status, 200, duplicateFulfillment.text);
    assert.equal(duplicateFulfillment.json.changed, false);
    assert.equal((await usage(owner)).purchasedRemaining, 25);

    const otherUser = await signIn("research-billing-other-owner");
    const crossAccountReplay = structuredClone(checkoutEvent);
    crossAccountReplay.id = "evt_research_billing_cross_account";
    crossAccountReplay.data.object.client_reference_id = otherUser.userID;
    crossAccountReplay.data.object.metadata.accountUserID = otherUser.userID;
    const crossAccountResult = await stripeWebhook(crossAccountReplay);
    assert.equal(crossAccountResult.response.status, 200, crossAccountResult.text);
    assert.equal(crossAccountResult.json.changed, false);
    assert.equal((await usage(otherUser)).purchasedRemaining, 0);

    const conversationCreate = await request("/research/conversations/create", {
      method: "POST",
      token: owner.token,
      body: { auth: { accountUserID: owner.userID } }
    });
    assert.equal(conversationCreate.response.status, 201, conversationCreate.text);
    const failedRequestID = "research-billing-provider-failure";
    const failedQuestion = "What does the enacted code require?";
    const providerFailure = await request("/research/conversations/message", {
      method: "POST",
      token: owner.token,
      body: {
        auth: { accountUserID: owner.userID },
        conversationID: conversationCreate.json.conversation.id,
        question: failedQuestion,
        requestID: failedRequestID
      }
    });
    assert.equal(providerFailure.response.status, 503, providerFailure.text);
    assert.equal(providerFailure.json.code, "RESEARCH_NOT_CONFIGURED");
    assert.equal(
      (await usage(owner)).purchasedRemaining,
      25,
      "A provider/configuration failure consumed a purchased turn."
    );

    const successfulRequestID = "research-billing-successful-turn";
    const successfulQuestion = "Does the selected provision control?";
    const reservationID = researchRequestReservationID(
      owner.userID,
      conversationCreate.json.conversation.id,
      successfulRequestID
    );
    const committedAt = new Date().toISOString();
    let persistedStore;
    let committedConversation;
    await withFileStoreLock(dataPath, async () => {
      persistedStore = JSON.parse(await readFile(dataPath, "utf8"));
      const reservation = applyResearchUsageReservation(persistedStore, owner.userID, {
        id: reservationID,
        since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(),
        limit: 1,
        paidContinuationEnabled: true,
        maximumRequestUSD: 0.5,
        pricingVersion: "research-billing-e2e",
        requestFingerprint: researchRequestQuestionFingerprint(successfulQuestion),
        createdAt: committedAt
      });
      assert.equal(reservation.reserved, true);
      assert.equal(reservation.fundingSource, "purchased");
      const messageIdentity = researchRequestMessageIdentity(
        owner.userID,
        conversationCreate.json.conversation.id,
        successfulRequestID
      );
      const committedAnswer = {
        id: `${messageIdentity}:answer`,
        conversationID: conversationCreate.json.conversation.id,
        projectID: null,
        question: successfulQuestion,
        answer: { answerText: "The cited enacted provision controls." },
        evidence: [],
        createdAt: committedAt
      };
      committedConversation = {
        ...conversationCreate.json.conversation,
        messages: [
          ...(conversationCreate.json.conversation.messages || []),
          {
            id: `${messageIdentity}:question`,
            role: "user",
            question: successfulQuestion,
            researchRequestID: successfulRequestID,
            createdAt: committedAt
          },
          {
            id: committedAnswer.id,
            role: "assistant",
            researchRequestID: successfulRequestID,
            answer: committedAnswer.answer,
            createdAt: committedAt
          }
        ],
        updatedAt: committedAt
      };
      const commitPayload = {
        reservationID,
        usageEntry: {
          model: "test-provider",
          mode: "openai",
          inputTokens: 10,
          outputTokens: 10,
          totalTokens: 20,
          createdAt: committedAt
        },
        answer: committedAnswer,
        conversation: committedConversation,
        events: []
      };
      assert.equal(
        applyResearchConversationMessageCommit(
          persistedStore,
          owner.userID,
          commitPayload
        ).replayed,
        false
      );
      assert.equal(
        applyResearchConversationMessageCommit(
          persistedStore,
          owner.userID,
          commitPayload
        ).replayed,
        true
      );
      await writeJSONFileAtomically(dataPath, persistedStore);
    });
    assert.equal((await usage(owner)).purchasedRemaining, 24);
    assert.equal(
      persistedStore.researchCreditsByUserID[owner.userID]
        .filter((entry) => entry.id === `usage:${reservationID}`).length,
      1
    );

    const replay = await request("/research/conversations/message", {
      method: "POST",
      token: owner.token,
      body: {
        auth: { accountUserID: owner.userID },
        conversationID: committedConversation.id,
        question: successfulQuestion,
        requestID: successfulRequestID
      }
    });
    assert.equal(replay.response.status, 200, replay.text);
    assert.equal((await usage(owner)).purchasedRemaining, 24);

    const conflict = await request("/research/conversations/message", {
      method: "POST",
      token: owner.token,
      body: {
        auth: { accountUserID: owner.userID },
        conversationID: committedConversation.id,
        question: "A different question with the same request identifier.",
        requestID: successfulRequestID
      }
    });
    assert.equal(conflict.response.status, 409, conflict.text);
    assert.equal(conflict.json.code, "RESEARCH_REQUEST_ID_CONFLICT");
    assert.equal((await usage(owner)).purchasedRemaining, 24);

    const partialRefund = await stripeWebhook({
      id: "evt_research_billing_partial_refund",
      type: "charge.refunded",
      livemode: false,
      created: Math.floor(Date.now() / 1000) + 1,
      data: {
        object: {
          id: "ch_research_billing_e2e",
          payment_intent: paymentIntentID,
          amount: 1000,
          amount_refunded: 500
        }
      }
    });
    assert.equal(partialRefund.response.status, 200, partialRefund.text);
    assert.equal(partialRefund.json.changed, true);
    assert.equal((await usage(owner)).purchasedRemaining, 11);

    const duplicatePartialRefund = await stripeWebhook({
      id: "evt_research_billing_partial_refund",
      type: "charge.refunded",
      livemode: false,
      created: Math.floor(Date.now() / 1000) + 1,
      data: {
        object: {
          id: "ch_research_billing_e2e",
          payment_intent: paymentIntentID,
          amount: 1000,
          amount_refunded: 500
        }
      }
    });
    assert.equal(duplicatePartialRefund.response.status, 200, duplicatePartialRefund.text);
    assert.equal(duplicatePartialRefund.json.changed, false);
    assert.equal((await usage(owner)).purchasedRemaining, 11);

    const fullRefund = await stripeWebhook({
      id: "evt_research_billing_full_refund",
      type: "charge.refunded",
      livemode: false,
      created: Math.floor(Date.now() / 1000) + 2,
      data: {
        object: {
          id: "ch_research_billing_e2e",
          payment_intent: paymentIntentID,
          amount: 1000,
          amount_refunded: 1000
        }
      }
    });
    assert.equal(fullRefund.response.status, 200, fullRefund.text);
    assert.equal(fullRefund.json.changed, true);
    const fullyRefundedUsage = await usage(owner);
    assert.equal(fullyRefundedUsage.purchasedRemaining, 0);
    assert.equal(fullyRefundedUsage.canResearch, false);
    assert.equal(fullyRefundedUsage.purchaseRequired, true);

    console.log("Permitext Research billing lifecycle E2E passed; paid model calls: no.");
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit"), sleep(2_000)]);
    }
    await rm(tempDir, { recursive: true, force: true });
  }
}

await main();
