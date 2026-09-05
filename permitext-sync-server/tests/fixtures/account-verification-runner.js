import * as verification from "/verification.js";
import { ClerkAPIResponseError } from "/sdk-errors.js";

const output = document.querySelector("#results");
const publishableKey = "pk_test_" + btoa("synthetic.clerk.accounts.dev$");
const account = { userID: "clerk:synthetic-user", authProvider: "clerk" };
function assert(value, message) { if (!value) throw new Error(message); }
function provider(onPrompt, { notifyStatus = true } = {}) {
  let fresh = false, deleted = 0;
  const listeners = new Map();
  const clerk = {
    loaded: true, status: "ready", isSignedIn: true,
    user: { id: "synthetic-user", deleteSelfEnabled: true, delete: async () => { deleted += 1; } },
    session: { id: "synthetic-session", checkAuthorization: () => fresh },
    client: { sessions: [] }, organization: null,
    __internal_updateProps() {},
    addListener(callback) { callback({ user: this.user, session: this.session, client: this.client, organization: null }); return () => {}; },
    on(event, callback, options) { listeners.set(callback, event); if (notifyStatus && options?.notify && event === "status") callback("ready"); },
    off(_event, callback) { listeners.delete(callback); },
    __internal_openReverification(options) {
      assert(options.level === "second_factor" || options.level === undefined, "Strict verification reaches the SDK modal callback");
      onPrompt({
        complete: () => { fresh = true; options.afterVerification(); },
        cancel: () => options.afterVerificationCancelled()
      });
    }
  };
  return { clerk, count: () => deleted, fresh: () => { fresh = true; } };
}
function run(clerk, operation) {
  return verification.runReverifiedClerkOperation({ clerk, publishableKey, operation });
}
async function rejected(promise, predicate) {
  try { await promise; } catch (error) { assert(predicate(error), error.message); return; }
  throw new Error("Expected operation to stop");
}
function prompt({ complete, cancel }) {
  const dialog = document.createElement("dialog");
  dialog.innerHTML = '<h2>Synthetic identity verification</h2><p>This tests the application’s verification handoff. No password or code is needed.</p><button data-confirm>Confirm synthetic verification</button><button data-cancel>Cancel</button>';
  document.body.append(dialog);
  const finish = (callback) => { dialog.close(); dialog.remove(); callback(); };
  dialog.querySelector("[data-confirm]").onclick = () => finish(complete);
  dialog.querySelector("[data-cancel]").onclick = () => finish(cancel);
  dialog.oncancel = (event) => { event.preventDefault(); finish(cancel); };
  dialog.showModal();
}

document.querySelector("#manual").onclick = async () => {
  const p = provider(prompt);
  const captured = verification.captureClerkDeletionIdentity(account, p.clerk);
  output.textContent = "Waiting for synthetic verification. No deletion has been requested.";
  try {
    await run(p.clerk, () => verification.clerkDeletionVerification(captured));
    output.textContent = "Verification completed. No deletion was requested.";
  } catch (error) { output.textContent = `Verification stopped: ${error.code || error.message}. No deletion was requested.`; }
};

document.querySelector("#run").onclick = async (event) => {
  event.target.disabled = true;
  const results = [];
  const check = async (name, operation) => {
    await operation(); results.push(`PASS ${name}`); output.textContent = results.join("\n");
  };
  try {
    await check("Built hook verifies before permitting deletion", async () => {
      let prompted = 0;
      const p = provider(({ complete }) => { prompted += 1; complete(); });
      const captured = verification.captureClerkDeletionIdentity(account, p.clerk);
      assert(await run(p.clerk, () => verification.clerkDeletionVerification(captured)) === true, "Verification completed");
      await run(p.clerk, () => verification.removeCapturedClerkIdentity(captured, () => {}));
      assert(prompted === 1 && p.count() === 1, "One prompt and one captured deletion");
    });
    await check("Real SDK cancellation rejects without deletion", async () => {
      const p = provider(({ cancel }) => cancel());
      const captured = verification.captureClerkDeletionIdentity(account, p.clerk);
      await rejected(run(p.clerk, () => verification.clerkDeletionVerification(captured)), (e) => e.code === "reverification_cancelled");
      assert(p.count() === 0, "No deletion");
    });
    await check("Identity switch during SDK callback stops the operation", async () => {
      const p = provider(({ complete }) => { p.clerk.user = { ...p.clerk.user, id: "other-user" }; complete(); });
      const captured = verification.captureClerkDeletionIdentity(account, p.clerk);
      await rejected(run(p.clerk, () => verification.clerkDeletionVerification(captured)), (e) => /identity changed/.test(e.message));
      assert(p.count() === 0, "Other user preserved");
    });
    await check("SDK recognizes real Clerk API error shape and retries cleanup only", async () => {
      let attempts = 0, prompts = 0;
      const p = provider(({ complete }) => { prompts += 1; complete(); });
      await run(p.clerk, async () => {
        if (++attempts === 1) throw new ClerkAPIResponseError("Verify", {
          data: [{ code: "session_reverification_required", message: "Verify" }], status: 403
        });
        return "deleted";
      });
      assert(attempts === 2 && prompts === 1, "Exactly one SDK retry");
    });
    await check("An incomplete verification hint is never treated as success", async () => {
      const p = provider(({ complete }) => complete());
      const captured = verification.captureClerkDeletionIdentity(account, p.clerk);
      p.clerk.session.checkAuthorization = () => false;
      await rejected(run(p.clerk, () => verification.clerkDeletionVerification(captured)), (e) => /did not finish/.test(e.message));
    });
    await check("Repeated mount and unmount leaves the shared sign-in instance intact", async () => {
      const p = provider(() => { throw new Error("Fresh session should not prompt"); }); p.fresh();
      const captured = verification.captureClerkDeletionIdentity(account, p.clerk);
      for (let i = 0; i < 3; i++) await run(p.clerk, () => verification.clerkDeletionVerification(captured));
      assert(p.clerk.user.id === "synthetic-user" && p.clerk.session.id === "synthetic-session", "Existing session remains");
    });
    await check("Already-loaded SDK needs no new ready-status event", async () => {
      const p = provider(({ complete }) => complete(), { notifyStatus: false });
      const captured = verification.captureClerkDeletionIdentity(account, p.clerk);
      assert(await run(p.clerk, () => verification.clerkDeletionVerification(captured)) === true, "Loaded session remains usable without another status event");
      assert(p.count() === 0, "Preflight itself never deletes the account");
    });
    output.textContent += `\n\n${results.length}/${results.length} integration checks passed. No provider API requests or real deletion.`;
  } catch (error) {
    output.textContent = results.join("\n") + `\nFAIL ${error.stack || error.message}`;
  } finally { event.target.disabled = false; }
};
