import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { sign, X509Certificate } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";

const execFileAsync = promisify(execFile);
const bundleID = "com.randycodex.permitext";
const productID = "com.randycodex.permitext.pro.monthly";
const originalTransactionID = "2000000999000001";

function encodedPart(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function localAppleSigner(tempDir) {
  const rootKey = join(tempDir, "apple-test-root.key");
  const rootCertificate = join(tempDir, "apple-test-root.pem");
  const leafKey = join(tempDir, "apple-test-leaf.key");
  const leafRequest = join(tempDir, "apple-test-leaf.csr");
  const leafCertificate = join(tempDir, "apple-test-leaf.pem");
  const runOpenSSL = (...args) => execFileAsync("openssl", args, { cwd: tempDir });

  await runOpenSSL("ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", rootKey);
  await runOpenSSL(
    "req", "-x509", "-new", "-key", rootKey, "-sha256", "-days", "2",
    "-subj", "/CN=Apple Permitext Test Root/O=Permitext Tests", "-out", rootCertificate
  );
  await runOpenSSL("ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", leafKey);
  await runOpenSSL(
    "req", "-new", "-key", leafKey,
    "-subj", "/CN=Permitext App Store Test Signer/O=Permitext Tests", "-out", leafRequest
  );
  await runOpenSSL(
    "x509", "-req", "-in", leafRequest, "-CA", rootCertificate, "-CAkey", rootKey,
    "-CAcreateserial", "-out", leafCertificate, "-days", "2", "-sha256"
  );

  const [privateKey, leafPEM, rootPEM] = await Promise.all([
    readFile(leafKey, "utf8"),
    readFile(leafCertificate, "utf8"),
    readFile(rootCertificate, "utf8")
  ]);
  const x5c = [leafPEM, rootPEM].map(
    (certificate) => new X509Certificate(certificate).raw.toString("base64")
  );
  return (payload) => {
    const header = encodedPart({ alg: "ES256", x5c });
    const body = encodedPart(payload);
    const input = `${header}.${body}`;
    const signature = sign("sha256", Buffer.from(input), {
      key: privateKey,
      dsaEncoding: "ieee-p1363"
    });
    return `${input}.${signature.toString("base64url")}`;
  };
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
  const tempDir = await mkdtemp(join(tmpdir(), "permitext-apple-subscription-audit-"));
  const signApplePayload = await localAppleSigner(tempDir);
  const appProbe = createServer();
  const appPort = await listen(appProbe);
  await new Promise((resolve, reject) => appProbe.close((error) => error ? reject(error) : resolve()));
  const baseURL = `http://127.0.0.1:${appPort}`;
  const serverOutput = [];
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(appPort),
      VERCEL: "",
      VERCEL_ENV: "",
      DATABASE_URL: "",
      STORAGE_URL: "",
      POSTGRES_URL: "",
      NEON_DATABASE_URL: "",
      OPENAI_API_KEY: "",
      STRIPE_SECRET_KEY: "",
      PERMITEXT_SYNC_DATA_PATH: join(tempDir, "sync-store.json"),
      PERMITEXT_PUBLIC_BASE_URL: baseURL,
      PERMITEXT_REQUIRE_PRODUCTION_APPLE_TRANSACTIONS: "0",
      PERMITEXT_REQUIRE_APPLE_TRANSACTION_ROOT_PIN: "0",
      APPLE_APP_STORE_ROOT_SHA256_FINGERPRINTS: "",
      APPLE_BUNDLE_ID: bundleID,
      STOREKIT_PRO_PRODUCT_ID: productID
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => serverOutput.push(String(chunk)));
  }

  async function request(path, { method = "GET", body, token } = {}) {
    const response = await fetch(`${baseURL}${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
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

  async function signIn(providerUserID = "apple-subscription-lifecycle-owner") {
    const result = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID,
          displayName: "Apple Subscription Lifecycle Owner"
        }
      }
    });
    assert.equal(result.response.status, 200, result.text);
    return result.json;
  }

  const baseSignedDate = Date.now() - 10 * 60_000;
  const transaction = ({
    suffix,
    signedDate,
    expiresDate,
    revocationDate
  }) => ({
    transactionId: `2000000999${suffix}`,
    originalTransactionId: originalTransactionID,
    webOrderLineItemId: `2000000888${suffix}`,
    bundleId: bundleID,
    productId: productID,
    environment: "Sandbox",
    purchaseDate: signedDate - 1_000,
    signedDate,
    expiresDate,
    ...(revocationDate ? { revocationDate } : {})
  });

  async function notification({
    notificationType,
    subtype,
    suffix,
    signedDate,
    expiresDate,
    renewalInfo
  }) {
    const signedTransactionInfo = signApplePayload(transaction({ suffix, signedDate, expiresDate }));
    const data = {
      bundleId: bundleID,
      environment: "Sandbox",
      signedTransactionInfo,
      ...(renewalInfo ? { signedRenewalInfo: signApplePayload(renewalInfo) } : {})
    };
    const signedPayload = signApplePayload({
      notificationType,
      ...(subtype ? { subtype } : {}),
      notificationUUID: `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`,
      signedDate,
      version: "2.0",
      data
    });
    return request("/billing/apple/notifications", {
      method: "POST",
      body: { signedPayload }
    });
  }

  try {
    await waitForServer();
    const initial = await signIn();
    const userID = initial.account.appUserID;
    const token = initial.account.backendSessionToken;
    const initialExpiration = Date.now() + 60 * 60 * 1_000;
    const initialSignedTransactionInfo = signApplePayload(transaction({
      suffix: "001",
      signedDate: baseSignedDate,
      expiresDate: initialExpiration
    }));
    const verified = await request("/billing/apple/transactions/verify", {
      method: "POST",
      token,
      body: {
        auth: { accountUserID: userID },
        signedTransactionInfo: initialSignedTransactionInfo
      }
    });
    assert.equal(verified.response.status, 200, verified.text);
    assert.equal(verified.json.entitlement.plan, "pro");
    assert.equal(verified.json.entitlement.provider.appleOriginalTransactionID, originalTransactionID);

    const renewalExpiration = Date.now() + 2 * 60 * 60 * 1_000;
    const renewal = await notification({
      notificationType: "DID_RENEW",
      suffix: "010",
      signedDate: baseSignedDate + 10_000,
      expiresDate: renewalExpiration
    });
    assert.equal(renewal.response.status, 200, renewal.text);
    assert.equal(renewal.json.changed, true);
    assert.equal((await signIn()).entitlement.expiresAt, new Date(renewalExpiration).toISOString());

    const autoRenewDisabled = await notification({
      notificationType: "DID_CHANGE_RENEWAL_STATUS",
      subtype: "AUTO_RENEW_DISABLED",
      suffix: "020",
      signedDate: baseSignedDate + 20_000,
      expiresDate: renewalExpiration
    });
    assert.equal(autoRenewDisabled.response.status, 200, autoRenewDisabled.text);
    assert.equal(autoRenewDisabled.json.changed, false);
    assert.equal(autoRenewDisabled.json.recorded, true);
    assert.equal((await signIn()).entitlement.plan, "pro", "Turning off auto-renew removed prepaid access.");

    const delayedExpiration = await notification({
      notificationType: "EXPIRED",
      subtype: "VOLUNTARY",
      suffix: "015",
      signedDate: baseSignedDate + 15_000,
      expiresDate: baseSignedDate + 14_000
    });
    assert.equal(delayedExpiration.response.status, 200, delayedExpiration.text);
    assert.equal(delayedExpiration.json.changed, false);
    assert.equal(
      (await signIn()).entitlement.plan,
      "pro",
      "A delayed notification older than a recorded no-change event removed current access."
    );

    const failedWithoutGrace = await notification({
      notificationType: "DID_FAIL_TO_RENEW",
      suffix: "030",
      signedDate: baseSignedDate + 30_000,
      expiresDate: renewalExpiration
    });
    assert.equal(failedWithoutGrace.response.status, 200, failedWithoutGrace.text);
    assert.equal(failedWithoutGrace.json.action, "revoke");
    assert.equal(failedWithoutGrace.json.reason, "billing-retry-without-grace");
    assert.equal(
      (await signIn()).entitlement,
      null,
      "A failed renewal without grace preserved access from a stale future expiration."
    );

    const duplicateFailure = await notification({
      notificationType: "DID_FAIL_TO_RENEW",
      suffix: "030",
      signedDate: baseSignedDate + 30_000,
      expiresDate: renewalExpiration
    });
    assert.equal(duplicateFailure.response.status, 200, duplicateFailure.text);
    assert.equal(duplicateFailure.json.changed, false);

    const delayedRenewal = await notification({
      notificationType: "DID_RENEW",
      suffix: "025",
      signedDate: baseSignedDate + 25_000,
      expiresDate: renewalExpiration
    });
    assert.equal(delayedRenewal.response.status, 200, delayedRenewal.text);
    assert.equal(delayedRenewal.json.changed, false);
    assert.equal((await signIn()).entitlement, null, "A delayed renewal restored revoked access.");

    const recoveredExpiration = Date.now() + 5 * 60 * 1_000;
    const billingRecovery = await notification({
      notificationType: "DID_RENEW",
      subtype: "BILLING_RECOVERY",
      suffix: "040",
      signedDate: baseSignedDate + 40_000,
      expiresDate: recoveredExpiration
    });
    assert.equal(billingRecovery.response.status, 200, billingRecovery.text);
    assert.equal(billingRecovery.json.changed, true);
    assert.equal((await signIn()).entitlement.expiresAt, new Date(recoveredExpiration).toISOString());

    const graceExpiration = Date.now() + 30 * 60 * 1_000;
    const billingGrace = await notification({
      notificationType: "DID_FAIL_TO_RENEW",
      subtype: "GRACE_PERIOD",
      suffix: "050",
      signedDate: baseSignedDate + 50_000,
      expiresDate: Date.now() - 1_000,
      renewalInfo: { gracePeriodExpiresDate: graceExpiration }
    });
    assert.equal(billingGrace.response.status, 200, billingGrace.text);
    assert.equal(billingGrace.json.action, "grant");
    assert.equal(billingGrace.json.reason, "billing-grace-period");
    assert.equal((await signIn()).entitlement.expiresAt, new Date(graceExpiration).toISOString());

    const graceEnded = await notification({
      notificationType: "GRACE_PERIOD_EXPIRED",
      suffix: "060",
      signedDate: baseSignedDate + 60_000,
      expiresDate: Date.now() - 1_000
    });
    assert.equal(graceEnded.response.status, 200, graceEnded.text);
    assert.equal(graceEnded.json.action, "revoke");
    assert.equal((await signIn()).entitlement, null);

    const refundReversedExpiration = Date.now() + 4 * 60 * 60 * 1_000;
    const refundReversed = await notification({
      notificationType: "REFUND_REVERSED",
      suffix: "070",
      signedDate: baseSignedDate + 70_000,
      expiresDate: refundReversedExpiration
    });
    assert.equal(refundReversed.response.status, 200, refundReversed.text);
    assert.equal(refundReversed.json.action, "grant");
    assert.equal((await signIn()).entitlement.plan, "pro");

    const refund = await notification({
      notificationType: "REFUND",
      suffix: "080",
      signedDate: baseSignedDate + 80_000,
      expiresDate: refundReversedExpiration
    });
    assert.equal(refund.response.status, 200, refund.text);
    assert.equal(refund.json.action, "revoke");
    const postRefundAccount = await signIn();
    assert.equal(postRefundAccount.entitlement, null);

    const staleRelaunchVerification = await request("/billing/apple/transactions/verify", {
      method: "POST",
      token: postRefundAccount.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        signedTransactionInfo: initialSignedTransactionInfo
      }
    });
    assert.equal(staleRelaunchVerification.response.status, 200, staleRelaunchVerification.text);
    assert.equal(staleRelaunchVerification.json.transaction.active, false);
    assert.equal(staleRelaunchVerification.json.entitlement, null);
    const postStaleVerificationAccount = await signIn();
    assert.equal(
      postStaleVerificationAccount.entitlement,
      null,
      "A stale active transaction replay restored access after a newer refund notification."
    );

    const otherAccount = await signIn("apple-subscription-lifecycle-other");
    const mismatchedPostRefundVerification = await request(
      "/billing/apple/transactions/verify",
      {
        method: "POST",
        token: otherAccount.account.backendSessionToken,
        body: {
          auth: { accountUserID: otherAccount.account.appUserID },
          signedTransactionInfo: initialSignedTransactionInfo
        }
      }
    );
    assert.equal(mismatchedPostRefundVerification.response.status, 409);
    assert.equal(mismatchedPostRefundVerification.json.entitlement, undefined);

    const repurchaseExpiration = Date.now() + 6 * 60 * 60 * 1_000;
    const repurchase = await request("/billing/apple/transactions/verify", {
      method: "POST",
      token: postStaleVerificationAccount.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        signedTransactionInfo: signApplePayload(transaction({
          suffix: "090",
          signedDate: baseSignedDate + 90_000,
          expiresDate: repurchaseExpiration
        }))
      }
    });
    assert.equal(repurchase.response.status, 200, repurchase.text);
    assert.equal(repurchase.json.transaction.active, true);
    assert.equal((await signIn()).entitlement.plan, "pro");

    process.stdout.write(`${JSON.stringify({
      environment: "local-signed-apple-sandbox-simulation",
      signedTransactionClaimedOwnership: true,
      renewalExtendedExpiration: true,
      autoRenewDisablePreservedPrepaidAccess: true,
      noChangeNotificationAdvancedOrderingCursor: true,
      delayedOlderNotificationWasInert: true,
      failedRenewalWithoutGraceRevokedAccess: true,
      duplicateNotificationWasInert: true,
      billingRecoveryRestoredAccess: true,
      billingGraceUsedGraceExpiration: true,
      graceExpirationRevokedAccess: true,
      refundReversalRestoredAccess: true,
      refundRevokedAccess: true,
      staleVerificationAfterRefundWasInert: true,
      newerRepurchaseRestoredAccess: true,
      paidProviderCalls: 0,
      pass: true
    }, null, 2)}\n`);
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit"), sleep(2_000)]);
    }
    await rm(tempDir, { recursive: true, force: true });
  }
}

await main();
