import assert from "node:assert/strict";
import {
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  verify
} from "node:crypto";

export const zoningV11RunnerHandoffProtocol =
  "permitext-zoning-remediation-3-v11-runner-handoff-v1";
export const zoningV11RunnerPublicKeyDERBase64 =
  "MCowBQYDK2VwAyEAAWQvouHGsHbv/CzmCz1F8dc3EnZOtl2dKP6fGi8dE3M=";

const challengeMessageType = "permitext:v11-runner-handoff-challenge";
const responseMessageType = "permitext:v11-runner-handoff-response";

function assertHandoffPayload(payload) {
  assert.equal(payload?.protocol, zoningV11RunnerHandoffProtocol,
    "The v11 runner handoff used the wrong protocol.");
  assert.match(payload?.runID || "", /^[0-9a-f-]{36}$/i,
    "The v11 runner handoff used an invalid run ID.");
  assert.match(payload?.executionCommit || "", /^[0-9a-f]{40}$/i,
    "The v11 runner handoff used an invalid execution commit.");
  assert(Number.isInteger(payload?.parentPID) && payload.parentPID > 0,
    "The v11 runner handoff used an invalid parent PID.");
  assert(Number.isInteger(payload?.childPID) && payload.childPID > 0,
    "The v11 runner handoff used an invalid child PID.");
  assert.match(payload?.challenge || "", /^[A-Za-z0-9_-]{43}$/,
    "The v11 runner handoff used an invalid challenge.");
}

export function zoningV11RunnerHandoffPayload({
  runID,
  executionCommit,
  parentPID,
  childPID,
  challenge
}) {
  const payload = {
    protocol: zoningV11RunnerHandoffProtocol,
    runID,
    executionCommit,
    parentPID,
    childPID,
    challenge
  };
  assertHandoffPayload(payload);
  return payload;
}

function serializedPayload(payload) {
  assertHandoffPayload(payload);
  return Buffer.from(JSON.stringify(payload), "utf8");
}

export function zoningV11RunnerPrivateKey(privateKeyPEM) {
  const privateKey = createPrivateKey(privateKeyPEM);
  assert.equal(privateKey.asymmetricKeyType, "ed25519",
    "The v11 runner handoff key must be Ed25519.");
  const publicKeyDER = createPublicKey(privateKey).export({
    type: "spki",
    format: "der"
  });
  assert.equal(
    publicKeyDER.toString("base64"),
    zoningV11RunnerPublicKeyDERBase64,
    "The local v11 runner handoff key does not match the locked package public key."
  );
  return privateKey;
}

export function signZoningV11RunnerHandoff({ privateKey, payload }) {
  return sign(null, serializedPayload(payload), privateKey).toString("base64");
}

export function verifyZoningV11RunnerHandoff({
  payload,
  signature,
  publicKeyDERBase64 = zoningV11RunnerPublicKeyDERBase64
}) {
  assert.match(signature || "", /^[A-Za-z0-9+/]+={0,2}$/,
    "The v11 runner handoff signature is malformed.");
  const publicKey = createPublicKey({
    key: Buffer.from(publicKeyDERBase64, "base64"),
    type: "spki",
    format: "der"
  });
  assert.equal(publicKey.asymmetricKeyType, "ed25519",
    "The v11 runner handoff public key must be Ed25519.");
  assert(
    verify(
      null,
      serializedPayload(payload),
      publicKey,
      Buffer.from(signature, "base64")
    ),
    "The paid v11 child did not receive an authenticated runner handoff."
  );
}

export function respondToZoningV11RunnerChallenge({
  message,
  childPID,
  runID,
  executionCommit,
  privateKey
}) {
  assert.equal(message?.type, challengeMessageType,
    "The v11 child sent an unexpected runner handoff message.");
  assert.equal(message?.protocol, zoningV11RunnerHandoffProtocol,
    "The v11 child requested the wrong runner handoff protocol.");
  assert.equal(message?.runID, runID,
    "The v11 child requested a handoff for the wrong run ID.");
  assert.equal(message?.executionCommit, executionCommit,
    "The v11 child requested a handoff for the wrong execution commit.");
  assert.equal(message?.parentPID, process.pid,
    "The v11 child named the wrong runner PID.");
  assert.equal(message?.childPID, childPID,
    "The v11 child named the wrong child PID.");
  const payload = zoningV11RunnerHandoffPayload({
    runID,
    executionCommit,
    parentPID: process.pid,
    childPID,
    challenge: message.challenge
  });
  return {
    type: responseMessageType,
    protocol: zoningV11RunnerHandoffProtocol,
    runID,
    executionCommit,
    parentPID: process.pid,
    childPID,
    challenge: message.challenge,
    signature: signZoningV11RunnerHandoff({ privateKey, payload })
  };
}

export async function requireAuthenticatedZoningV11RunnerHandoff({
  runID,
  executionCommit,
  timeoutMilliseconds = 5_000,
  publicKeyDERBase64 = zoningV11RunnerPublicKeyDERBase64
}) {
  assert(
    typeof process.send === "function" && process.connected,
    "The paid v11 child requires an authenticated runner IPC handoff."
  );
  const challenge = randomBytes(32).toString("base64url");
  const payload = zoningV11RunnerHandoffPayload({
    runID,
    executionCommit,
    parentPID: process.ppid,
    childPID: process.pid,
    challenge
  });
  const response = await new Promise((resolve, reject) => {
    const cleanUp = () => {
      clearTimeout(timer);
      process.off("message", onMessage);
      process.off("disconnect", onDisconnect);
    };
    const onMessage = (message) => {
      if (message?.type !== responseMessageType) return;
      cleanUp();
      resolve(message);
    };
    const onDisconnect = () => {
      cleanUp();
      reject(new Error(
        "The paid v11 child lost its authenticated runner IPC handoff."
      ));
    };
    const timer = setTimeout(() => {
      cleanUp();
      reject(new Error(
        "The paid v11 child timed out waiting for its authenticated runner handoff."
      ));
    }, timeoutMilliseconds);
    timer.unref();
    process.on("message", onMessage);
    process.once("disconnect", onDisconnect);
    process.send({
      type: challengeMessageType,
      ...payload
    }, (error) => {
      if (!error) return;
      cleanUp();
      reject(error);
    });
  });
  assert.deepEqual(
    {
      protocol: response?.protocol,
      runID: response?.runID,
      executionCommit: response?.executionCommit,
      parentPID: response?.parentPID,
      childPID: response?.childPID,
      challenge: response?.challenge
    },
    payload,
    "The paid v11 child received a runner response for a different handoff."
  );
  verifyZoningV11RunnerHandoff({
    payload,
    signature: response?.signature,
    publicKeyDERBase64
  });
}
