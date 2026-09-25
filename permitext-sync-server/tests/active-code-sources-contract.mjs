import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const model = fileURLToPath(new URL("../../NYC CC APP/permitext/Models/ActiveCodeSources.swift", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "permitext-active-sources-"));
try {
  const main = join(temporary, "main.swift");
  await writeFile(main, `import Foundation
func check(_ value: Bool, _ message: String) {
    precondition(value, message)
}
func rejects(_ data: Data) {
    do { _ = try ActiveCodeSources.decodePreference(data); fatalError("Invalid preference accepted") }
    catch {}
}
let a = ActiveCodeSourceIdentity(canonicalEdition: "2022", jurisdictionID: 1, codeID: 2, categoryID: 3)
let b = ActiveCodeSourceIdentity(canonicalEdition: "2014", jurisdictionID: 1, codeID: 2, categoryID: 3)
let c = ActiveCodeSourceIdentity(canonicalEdition: "2022", jurisdictionID: 2, codeID: 2, categoryID: 3)
let d = ActiveCodeSourceIdentity(canonicalEdition: "2022", jurisdictionID: 1, codeID: 3, categoryID: 3)
let e = ActiveCodeSourceIdentity(canonicalEdition: "2022", jurisdictionID: 1, codeID: 2, categoryID: 4)
let installed = [a, b, c, d, e]
check(Set(installed).count == 5, "Full source identity must avoid edition/jurisdiction/code/category collisions")
var preference = try ActiveCodeSources.decodePreference(nil)
check(preference.enabledSources(in: installed).count == 5, "No preference enables every installed source")
let original = try preference.scopeFingerprint(installed: installed)
let reordered = try preference.scopeFingerprint(installed: Array(installed.reversed()) + [a])
check(original == reordered, "Catalog order and duplicates must not affect scope")
preference.disable(a)
check(!preference.isEnabled(a) && preference.isEnabled(b), "Disabling an edition cannot disable another identity")
let changed = try preference.scopeFingerprint(installed: installed)
check(changed != original, "Active source changes must invalidate scope")
_ = preference.enabledSources(in: [b])
check(preference.disabledSources.contains(a), "Absent sources must not prune preferences")
check(!preference.enabledSources(in: installed).contains(a), "Reappearing source stays disabled")
let encoded = try JSONEncoder().encode(preference)
let restored = try ActiveCodeSources.decodePreference(encoded)
check(restored == preference, "Version1 preference round-trips")
check(try JSONSerialization.jsonObject(with: encoded) is [String: Any], "Preference is JSON")
for source in installed { preference.disable(source) }
check(preference.enabledSources(in: installed).isEmpty, "All-disabled is a valid preference")
check(try preference.scopeFingerprint(installed: installed) == "[]", "Empty scope is explicit")
preference.enable(a)
check(preference.enabledSources(in: installed) == [a], "Only explicit enable changes disabled state")
rejects(Data("{\\"version\\":2,\\"disabledSources\\":[]}".utf8))
rejects(Data("{\\"disabledSources\\":[]}".utf8))
rejects(Data("{\\"version\\":1,\\"disabledSources\\":[{}]}".utf8))
rejects(Data("corrupt".utf8))
check(try ActiveCodeSources.decodePreference(encoded) == restored, "Rejected input never overwrites prior preference")
let suiteName = "permitext-active-sources-test-" + UUID().uuidString
let defaults = UserDefaults(suiteName: suiteName)!
defer { defaults.removePersistentDomain(forName: suiteName) }
let store = ActiveCodeSourcePreferences(defaults: defaults)
check(try store.load(accountID: "a").enabledSources(in: installed).count == 5, "Missing account preference enables installed sources")
try store.update(accountID: "a") { $0.disable(a) }
let reconstructed = ActiveCodeSourcePreferences(defaults: UserDefaults(suiteName: suiteName)!)
check(try !reconstructed.load(accountID: "a").isEnabled(a), "Preference survives store reconstruction")
check(try reconstructed.load(accountID: "b").isEnabled(a), "Another account retains default")
try store.update(accountID: nil) { $0.disable(b) }
check(try store.load(accountID: "guest").isEnabled(b), "Guest is not the literal guest account")
try store.update(accountID: "guest") { $0.disable(c) }
check(try store.load(accountID: nil).isEnabled(c), "Guest and named account remain independent")
for accountID in ["", " a", "a ", "a/b", "a:b", "é", "e\\u{301}"] {
    check(try store.load(accountID: accountID).isEnabled(a), "Exact account IDs must not alias a")
    try store.update(accountID: accountID) { $0.disable(d) }
}
let absent = try store.load(accountID: "a")
_ = absent.enabledSources(in: [b])
check(try !store.load(accountID: "a").isEnabled(a), "Catalog absence cannot discard stored disabled source")
try store.update(accountID: "a") { $0.enable(a) }
check(try reconstructed.load(accountID: "a").isEnabled(a), "Explicit reenable persists")
let corruptedAccount = "corrupt"
let corruptedKey = "permitext.active-code-sources.v1.account." + Data(corruptedAccount.utf8).base64EncodedString()
for stored: Any in [Data("invalid".utf8), Data("{\\"version\\":999,\\"disabledSources\\":[]}".utf8), "not data"] {
    defaults.set(stored, forKey: corruptedKey)
    var invoked = false
    do {
        try store.update(accountID: corruptedAccount) { invoked = true; $0.disable(a) }
        fatalError("Corrupted preference overwritten")
    } catch {}
    check(!invoked, "Mutation must not run after decode failure")
    if let data = stored as? Data { check(defaults.data(forKey: corruptedKey) == data, "Corrupt bytes preserved") }
    else { check(defaults.string(forKey: corruptedKey) == "not data", "Wrong stored type preserved") }
}
let beforeMutation = defaults.persistentDomain(forName: suiteName)!
enum ExpectedMutationFailure: Error { case stop }
do { try store.update(accountID: "a") { $0.disable(a); throw ExpectedMutationFailure.stop } }
catch {}
check(NSDictionary(dictionary: defaults.persistentDomain(forName: suiteName)!).isEqual(to: beforeMutation), "Failed mutation must not persist")
print("Active source model passed: default, full identity, sorted scope, absent-source retention, version1 round-trip, all-disabled and corrupt/unknown rejection.")
`);
  const binary = join(temporary, "active-sources-test");
  execFileSync("swiftc", [model, main, "-o", binary], { stdio: "pipe" });
  const output = execFileSync(binary, [], { encoding: "utf8" });
  assert.match(output, /Active source model passed/);
  process.stdout.write(output);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
