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
