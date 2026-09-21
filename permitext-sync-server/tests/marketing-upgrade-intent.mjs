import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('const proUpgradeIntentKey'), app.indexOf('let resumingProSave'));
function browser(search = '', store = new Map()) {
  const opened = [];
  let account = null;
  let dialog = null;
  const context = vm.createContext({
    URL, URLSearchParams, Date,
    location: { search, href: `https://permitext.com/workspace${search}` },
    history: { replaceState(_state, _title, url) { context.cleanedURL = url; } },
    sessionStorage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
    activeAccount: () => account,
    document: { querySelector: () => dialog },
    toggleAccountDialog: options => opened.push(options)
  });
  vm.runInContext(source, context);
  return { context, opened, store, account: value => { account = value; }, dialog: value => { dialog = value; }, run: () => vm.runInContext('resumeProUpgradeIntent()', context) };
}
const plain = browser();
await plain.run();
assert.equal(plain.opened.length, 0, 'Normal workspace visits must not open checkout');
const guest = browser('?intent=upgrade-pro&other=keep');
await guest.run();
assert.equal(guest.opened.length, 1);
assert.equal(guest.context.cleanedURL, '/workspace?other=keep');
guest.dialog({ open: true });
await guest.run();
assert.equal(guest.opened.length, 1, 'Do not duplicate an open account dialog');
guest.account({ userID: 'new-account' });
guest.dialog({ open: false, remove() {} });
await guest.run();
assert.equal(guest.opened.length, 2, 'Resume after popup sign-in closes its dialog');
const returned = browser('', guest.store);
returned.account({ userID: 'new-account' });
await returned.run();
assert.equal(returned.opened.length, 1, 'Resume after full-page authentication redirect');
vm.runInContext('clearProUpgradeIntent()', returned.context);
await returned.run();
assert.equal(returned.opened.length, 1, 'Canceled intent stays canceled');
for (const intent of [
  { expiresAt: Date.now() - 1 },
  { expiresAt: Date.now() + 10000, accountID: 'another-account' }
]) {
  const invalid = browser('', new Map([['permitext.proUpgradeIntent.v1', JSON.stringify(intent)]]));
  invalid.account({ userID: 'current-account' });
  await invalid.run();
  assert.equal(invalid.opened.length, 0, 'Expired or wrong-account intent must not resume');
}
console.log('Marketing upgrade intent passed: guest, auth return, cancellation, expiry, account isolation, and duplicate-dialog handling.');

const checkoutSource = app.slice(app.indexOf('  checkoutButton.addEventListener("click", async () => {'), app.indexOf('  planSecondaryButton.addEventListener("click", async () => {'));
async function checkout({ pro = false, source = 'webSubscription', accepted = true, failure = false } = {}) {
  const calls = [];
  let handler;
  const ctx = vm.createContext({
    URL, upgrade: true, checkoutInFlight: false, settingsIdentity: {},
    isCurrentAccountRequest: () => true, requireCurrentAccountRequest() {},
    activeAccount: () => ({ userID: 'account-a', sessionToken: 'test-token' }),
    isProAccount: () => pro, currentEntitlement: () => ({ source }),
    checkoutButton: { disabled: false, addEventListener(_event, value) { handler = value; } },
    policyAcceptance: { checked: accepted, disabled: false },
    currentPolicyConfiguration: { policySetID: 'current' },
    loadCurrentPolicyConfiguration: async () => ({ configured: true, policySetID: 'current', versions: { terms: 'current' } }),
    loadReleaseIdentity: async () => ({ releaseID: 'test' }),
    applyPolicyConfiguration() {}, syncAccountState() {}, setStatus() {},
    clearProUpgradeIntent: () => calls.push('clear'),
    postJSON: async (path, body) => {
      calls.push({ path, body });
      if (failure) throw new Error('Offline');
      return { url: path.includes('portal') ? 'https://billing.stripe.com/test' : 'https://checkout.stripe.com/test' };
    },
    location: { origin: 'https://permitext.com' }, window: { location: { href: '' } }
  });
  vm.runInContext(checkoutSource, ctx);
  await Promise.all([handler(), handler()]);
  return { calls, ctx };
}
const free = await checkout();
assert.equal(free.calls.filter(x => x.path === '/billing/web/checkout').length, 1, 'Double click must create only one checkout');
assert.equal(free.calls[0].path, '/account/policy-acceptance');
assert.equal(free.calls[1].body.cancelURL, 'https://permitext.com/#plans');
assert.equal(free.ctx.window.location.href, 'https://checkout.stripe.com/test');
const missingConsent = await checkout({ accepted: false });
assert.equal(missingConsent.calls.length, 0, 'Never record acceptance or create checkout without consent');
const lifetime = await checkout({ pro: true, source: 'lifetimeGrant' });
assert.equal(lifetime.calls.length, 0, 'Lifetime accounts cannot be charged again');
const apple = await checkout({ pro: true, source: 'appleSubscription' });
assert.equal(apple.calls.length, 0);
assert.equal(apple.ctx.window.location.href, 'https://apps.apple.com/account/subscriptions');
const failed = await checkout({ failure: true });
assert.equal(failed.ctx.window.location.href, '');
assert.equal(failed.ctx.checkoutInFlight, false, 'Failed checkout can be retried');
console.log('Marketing checkout passed with mocked services: consent, Stripe redirect, cancellation URL, duplicate prevention, existing access, and failure recovery.');
