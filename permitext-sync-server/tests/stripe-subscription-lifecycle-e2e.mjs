import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const webhookSecret = "whsec_permitext_no_charge_lifecycle";
const testPriceID = "price_test_permitext_pro_no_charge";
const subscriptionID = "sub_test_permitext_pro_no_charge";
const customerID = "cus_test_permitext_no_charge";
const invoiceID = "in_test_permitext_no_charge";
const checkoutSessionID = "cs_test_permitext_no_charge";

function stripeSignature(rawBody, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.equal(typeof address, "object");
  return address.port;
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "permitext-stripe-subscription-audit-"));
  const stripeRequests = [];
  let ownerUserID = null;
  let subscriptionStatus = "active";
  const stripeServer = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");
    stripeRequests.push({ method: request.method, url: request.url, body });
    response.setHeader("content-type", "application/json");
    if (request.method === "POST" && request.url === "/v1/checkout/sessions") {
      response.end(JSON.stringify({
        id: checkoutSessionID,
        livemode: false,
        url: `https://checkout.stripe.com/c/pay/${checkoutSessionID}`
      }));
      return;
    }
    if (request.method === "GET" && request.url === `/v1/invoices/${invoiceID}`) {
      response.end(JSON.stringify({ id: invoiceID, subscription: subscriptionID }));
      return;
    }
    if (request.method === "GET" && request.url === `/v1/subscriptions/${subscriptionID}`) {
      response.end(JSON.stringify({
        id: subscriptionID,
        status: subscriptionStatus,
        customer: customerID,
        metadata: { accountUserID: ownerUserID, permitextPackage: "pro" }
      }));
      return;
    }
    if (request.method === "DELETE" && request.url === `/v1/subscriptions/${subscriptionID}`) {
      subscriptionStatus = "canceled";
      response.end(JSON.stringify({ id: subscriptionID, status: "canceled" }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: { message: "Unhandled fake Stripe request." } }));
  });
  const stripePort = await listen(stripeServer);

  const appProbe = createServer();
  const appPort = await listen(appProbe);
  await new Promise((resolve, reject) => appProbe.close((error) => error ? reject(error) : resolve()));
  const baseURL = `http://127.0.0.1:${appPort}`;
  const serverOutput = [];
  const shimPath = fileURLToPath(new URL("./stripe-api-fetch-shim.mjs", import.meta.url));
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: "test",
      NODE_OPTIONS: `--import=${pathToFileURL(shimPath).href}`,
      PORT: String(appPort),
      VERCEL: "",
      VERCEL_ENV: "",
      DATABASE_URL: "",
      STORAGE_URL: "",
      POSTGRES_URL: "",
      NEON_DATABASE_URL: "",
      OPENAI_API_KEY: "",
      PERMITEXT_SYNC_DATA_PATH: join(tempDir, "sync-store.json"),
      PERMITEXT_PUBLIC_BASE_URL: baseURL,
      PERMITEXT_TEST_STRIPE_API_BASE_URL: `http://127.0.0.1:${stripePort}`,
      STRIPE_SECRET_KEY: "sk_test_permitext_no_charge_lifecycle",
      STRIPE_PRO_PRICE_ID: testPriceID,
      STRIPE_WEBHOOK_SECRET: webhookSecret
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => serverOutput.push(String(chunk)));
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
    return {
      response,
      text,
      json: text && response.headers.get("content-type")?.includes("application/json")
        ? JSON.parse(text)
        : null
    };
  }

  async function waitForServer() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (child.exitCode !== null) throw new Error(serverOutput.join(""));
      try {
        const health = await request("/health");
        if (health.response.ok) return;
      } catch {
        // Starting.
      }
      await sleep(100);
    }
    throw new Error(`Permitext server did not start.\n${serverOutput.join("")}`);
  }

  async function webhook(event, signature = null) {
    const rawBody = JSON.stringify(event);
    return request("/billing/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature || stripeSignature(rawBody)
      },
      rawBody
    });
  }

  async function signIn() {
    const result = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "stripe-subscription-lifecycle-owner",
          displayName: "Stripe Subscription Lifecycle Owner"
        }
      }
    });
    assert.equal(result.response.status, 200, result.text);
    return result.json;
  }

  try {
    await waitForServer();
    const initial = await signIn();
    ownerUserID = initial.account.appUserID;
    const token = initial.account.backendSessionToken;
    assert.equal(initial.entitlement, null);

    const checkout = await request("/billing/web/checkout", {
      method: "POST",
      token,
      body: { auth: { accountUserID: ownerUserID }, packageID: "pro" }
    });
    assert.equal(checkout.response.status, 200, checkout.text);
    assert.equal(checkout.json.checkoutSessionID, checkoutSessionID);
    const checkoutRequest = stripeRequests.find((entry) => entry.url === "/v1/checkout/sessions");
    assert(checkoutRequest);
    const checkoutBody = new URLSearchParams(checkoutRequest.body);
    assert.equal(checkoutBody.get("mode"), "subscription");
    assert.equal(checkoutBody.get("client_reference_id"), ownerUserID);
    assert.equal(checkoutBody.get("line_items[0][price]"), testPriceID);
    assert.equal(checkoutBody.get("metadata[permitextPackage]"), "pro");
    assert.equal((await signIn()).entitlement, null, "Checkout API response granted Pro before a signed event.");

    const baseCreated = Math.floor(Date.now() / 1000) - 120;
    const checkoutEvent = {
      id: "evt_test_checkout_paid",
      type: "checkout.session.completed",
      livemode: false,
      created: baseCreated,
      data: { object: {
        id: checkoutSessionID,
        mode: "subscription",
        payment_status: "paid",
        client_reference_id: ownerUserID,
        customer: customerID,
        subscription: subscriptionID,
        metadata: { accountUserID: ownerUserID, permitextPackage: "pro" }
      } }
    };
    const rejected = await webhook(checkoutEvent, "t=1,v1=bad");
    assert.equal(rejected.response.status, 400);
    assert.equal((await signIn()).entitlement, null, "Invalid webhook signature changed entitlement.");
    const checkoutFulfilled = await webhook(checkoutEvent);
    assert.equal(checkoutFulfilled.response.status, 200, checkoutFulfilled.text);
    assert.equal(checkoutFulfilled.json.changed, true);
    const afterCheckout = (await signIn()).entitlement;
    assert.equal(afterCheckout.plan, "pro");
    assert.equal(afterCheckout.provider.stripeSubscriptionID, subscriptionID);

    const duplicateCheckout = await webhook(checkoutEvent);
    assert.equal(duplicateCheckout.response.status, 200, duplicateCheckout.text);
    assert.equal(duplicateCheckout.json.changed, false);
    assert.equal((await signIn()).entitlement.provider.stripeSubscriptionID, subscriptionID);

    const renewalExpiration = baseCreated + 45 * 24 * 60 * 60;
    const renewal = await webhook({
      id: "evt_test_invoice_paid",
      type: "invoice.payment_succeeded",
      livemode: false,
      created: baseCreated + 10,
      data: { object: {
        id: "in_test_renewal",
        customer: customerID,
        subscription: subscriptionID,
        lines: { data: [{ period: { end: renewalExpiration }, subscription: subscriptionID }] }
      } }
    });
    assert.equal(renewal.response.status, 200, renewal.text);
    assert.equal((await signIn()).entitlement.expiresAt, new Date(renewalExpiration * 1000).toISOString());

    const scheduledCancellation = await webhook({
      id: "evt_test_cancel_at_period_end",
      type: "customer.subscription.updated",
      livemode: false,
      created: baseCreated + 20,
      data: { object: {
        id: subscriptionID,
        status: "active",
        cancel_at_period_end: true,
        current_period_end: renewalExpiration,
        customer: customerID,
        metadata: { accountUserID: ownerUserID, permitextPackage: "pro" }
      } }
    });
    assert.equal(scheduledCancellation.response.status, 200, scheduledCancellation.text);
    assert.equal((await signIn()).entitlement.plan, "pro", "Scheduled cancellation removed prepaid access early.");

    const beforeFailedInvoice = (await signIn()).entitlement;
    const failedInvoice = await webhook({
      id: "evt_test_invoice_failed",
      type: "invoice.payment_failed",
      livemode: false,
      created: baseCreated + 30,
      data: { object: { id: "in_test_failed", customer: customerID, subscription: subscriptionID } }
    });
    assert.equal(failedInvoice.response.status, 200, failedInvoice.text);
    assert.equal(failedInvoice.json.changed, false);
    assert.deepEqual((await signIn()).entitlement, beforeFailedInvoice);

    const partialRefund = await webhook({
      id: "evt_test_partial_refund",
      type: "charge.refunded",
      livemode: false,
      created: baseCreated + 40,
      data: { object: {
        id: "ch_test_subscription",
        invoice: invoiceID,
        amount: 2000,
        amount_refunded: 1000
      } }
    });
    assert.equal(partialRefund.response.status, 200, partialRefund.text);
    assert.equal(partialRefund.json.changed, false);
    assert.equal((await signIn()).entitlement.plan, "pro", "Partial refund revoked Pro automatically.");

    const fullRefund = await webhook({
      id: "evt_test_full_refund",
      type: "charge.refunded",
      livemode: false,
      created: baseCreated + 50,
      data: { object: {
        id: "ch_test_subscription",
        invoice: invoiceID,
        amount: 2000,
        amount_refunded: 2000
      } }
    });
    assert.equal(fullRefund.response.status, 200, fullRefund.text);
    assert.equal(fullRefund.json.changed, true);
    assert.equal((await signIn()).entitlement, null, "Full refund did not remove Pro.");
    assert(stripeRequests.some((entry) =>
      entry.method === "DELETE" && entry.url === `/v1/subscriptions/${subscriptionID}`
    ), "Full refund did not cancel the Stripe subscription.");

    const delayedActive = await webhook({
      id: "evt_test_delayed_active",
      type: "customer.subscription.updated",
      livemode: false,
      created: baseCreated + 25,
      data: { object: {
        id: subscriptionID,
        status: "active",
        current_period_end: renewalExpiration,
        customer: customerID,
        metadata: { accountUserID: ownerUserID, permitextPackage: "pro" }
      } }
    });
    assert.equal(delayedActive.response.status, 200, delayedActive.text);
    const delayedEventRegrantedPro = (await signIn()).entitlement?.plan === "pro";
    assert.equal(
      delayedEventRegrantedPro,
      false,
      "A delayed pre-refund Stripe event restored a terminal subscription."
    );

    const evidence = {
      environment: "local-provider-simulated-test-mode",
      checkoutCreatedWithoutCharge: true,
      unsignedOrInvalidWebhookRejected: true,
      paidCheckoutEventGrantedPro: true,
      duplicateCheckoutDidNotDuplicateOwnership: true,
      renewalExtendedExpiration: true,
      scheduledCancellationPreservedPrepaidAccess: true,
      failedInvoiceDidNotInventRenewal: true,
      partialRefundPreservedPro: true,
      fullRefundCanceledSubscriptionAndRemovedPro: true,
      delayedPreRefundEventRegrantedPro: delayedEventRegrantedPro,
      paidProviderCalls: 0,
      pass: true
    };
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit"), sleep(2_000)]);
    }
    await new Promise((resolve) => stripeServer.close(resolve));
    await rm(tempDir, { recursive: true, force: true });
  }
}

await main();
