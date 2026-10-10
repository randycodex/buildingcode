import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const directory = await mkdtemp(join(tmpdir(), "permitext-pro-restart-test-"));
const reservation = createServer();
await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;
const launcher = fileURLToPath(new URL("../scripts/start-local-pro-preview.mjs", import.meta.url));
let child;
let output;
let exited;
async function start(expectFailure = false) {
  output = "";
  child = spawn(process.execPath, [launcher, "--port", String(port), "--data-dir", directory], { stdio: ["ignore", "pipe", "pipe"] });
  exited = new Promise(resolve => child.once("close", (code, signal) => resolve({ code, signal })));
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error("Preview startup timed out")), 30000);
    const consume = chunk => {
      output += chunk.toString();
      if (!expectFailure && output.includes("POPULATED_FIXTURE_READY ")) { clearTimeout(deadline); resolve(); }
    };
    child.stdout.on("data", consume);
    child.stderr.on("data", consume);
    child.once("error", error => { clearTimeout(deadline); reject(error); });
    exited.then(({code}) => {
      clearTimeout(deadline);
      if (expectFailure && code !== 0) resolve();
      else reject(new Error(`Unexpected preview exit ${code}: ${output.slice(-2000)}`));
    });
  });
}
async function stop(signal = "SIGTERM") {
  child.kill(signal);
  await exited;
}
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
let userID, token;
async function post(path, body) {
  const response = await fetch(base + path, { method: "POST", headers: {
    "content-type": "application/json", authorization: `Bearer ${token}`
  }, body: JSON.stringify({auth: {accountUserID: userID}, ...body}), signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, path);
  return response.json();
}
async function imageHash(receipt) {
  const response = await fetch(base + "/notebook/assets/read", { method: "POST", headers: {
    "content-type": "application/json", authorization: `Bearer ${token}`
  }, body: JSON.stringify({ auth: { accountUserID: userID }, projectID: receipt.projectIDs[0], assetID: receipt.imageReceipts[0].assetID }), signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200);
  return hash(Buffer.from(await response.arrayBuffer()));
}
try {
  await start();
  const manifest = JSON.parse(await readFile(join(directory, "preview.json"), "utf8"));
  const initialStore = JSON.parse(await readFile(join(directory, "sync.json"), "utf8"));
  userID = `apple:${manifest.providerID}`;
  token = initialStore.sessions[userID];
  const {receipt} = manifest;
  const startURL = `${base}/fixture/start?key=${manifest.capability}`;
  const initial = await post("/sync/pull", {});
  const project = initial.mutations.find(item => item.project?.clientID === receipt.projectIDs[0]).project;
  const saved = initial.mutations.find(item => item.savedItem && !item.savedItem.deletedAt).savedItem;
  const updatedAt = new Date(Date.now() + 2000).toISOString();
  const pushed = await post("/sync/push", {batch: {user: {id: userID}, mutations: [
    {project: {...project, name: "Retained edited Project", updatedAt}},
    {savedItem: {...saved, deletedAt: updatedAt, updatedAt}}
  ]}});
  assert.deepEqual(pushed.rejectedMutationIDs, []);
  const note = (await post("/notebook/cards/get", {projectID: receipt.projectIDs[0], cardID: receipt.noteIDs[0]})).card;
  const editedNote = (await post("/notebook/cards/save", { projectID: receipt.projectIDs[0], cardID: note.id,
    expectedVersion: note.version, clientMutationID: "retained-preview-note", cardType: note.cardType,
    title: "Retained edited note", document: note.document })).card;
  const snapshot = await post("/sync/pull", {});
  const trash = await post("/content/trash", {action: "list"});
  const research = await post("/research/conversations/list", {});
  assert.ok(trash.entries.length > 0);
  assert.ok(snapshot.mutations.some(item => item.project?.name === "Retained edited Project"));
  assert.ok(snapshot.mutations.some(item => item.savedItem?.id === saved.id && item.savedItem.deletedAt));
  const imageBefore = await imageHash(receipt);
  assert.equal(imageBefore, receipt.imageReceipts[0].sha256);
  await stop();

  for (const signal of ["SIGKILL", "SIGTERM"]) {
    await start();
    assert.ok(output.includes("PERSISTENT_PREVIEW_RESUMED"));
    assert.ok(!output.includes("PERSISTENT_PREVIEW_CREATED"));
    const retained = JSON.parse(await readFile(join(directory, "sync.json"), "utf8"));
    assert.equal(retained.sessions[userID], token, "Browser session must stay valid across restart");
    assert.deepEqual(Object.keys(retained.users).sort(), Object.keys(initialStore.users).sort());
    const bootstrap = await fetch(startURL);
    assert.equal(bootstrap.status, 200);
    const encodedAccount = (await bootstrap.text()).match(/localStorage\.setItem\('permitext:webAccount:v1',(.+)\);location\.replace/)[1];
    const browserAccount = JSON.parse(JSON.parse(encodedAccount));
    assert.equal(browserAccount.userID, userID);
    assert.equal(browserAccount.sessionToken, token);
    const after = await post("/sync/pull", {});
    assert.deepEqual(after.mutations, snapshot.mutations, "Restart must not reseed or resurrect deleted saves");
    assert.deepEqual(after.entitlement, snapshot.entitlement, "Pro access must survive restart");
    assert.deepEqual((await post("/notebook/cards/get", {projectID: receipt.projectIDs[0], cardID: note.id})).card, editedNote);
    assert.deepEqual(await post("/content/trash", {action: "list"}), trash);
    assert.deepEqual(await post("/research/conversations/list", {}), research);
    assert.equal(await imageHash(receipt), imageBefore);
    await stop(signal);
  }

  const dataPath = join(directory, "sync.json");
  const beforeFailures = hash(await readFile(dataPath));
  const manifestPath = join(directory, "preview.json");
  await rename(manifestPath, manifestPath + ".retained");
  await start(true);
  assert.ok(output.includes("refusing to reset"));
  assert.equal(hash(await readFile(dataPath)), beforeFailures);
  await rename(manifestPath + ".retained", manifestPath);
  await rename(dataPath, dataPath + ".retained");
  await start(true);
  assert.ok(output.includes("refusing to replace"));
  assert.equal(hash(await readFile(dataPath + ".retained")), beforeFailures);
  await rename(dataPath + ".retained", dataPath);
  console.log("Persistent Pro preview: same account/session, edited Project/note, Research history, deleted saves, Trash and private images survive graceful and abrupt restarts; missing identity/data refuses reseeding.");
} finally {
  if (child && child.exitCode === null && child.signalCode === null) await stop("SIGKILL");
  await rm(directory, {recursive: true, force: true});
}
