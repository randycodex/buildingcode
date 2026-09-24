import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const model = fileURLToPath(new URL("../../NYC CC APP/permitext/Models/ActiveCodeSources.swift", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "permitext-navigation-access-"));
try {
  const main = join(temporary, "main.swift");
  await writeFile(main, `import Foundation
let a = ActiveCodeSourceIdentity(canonicalEdition: "2022", jurisdictionID: 1, codeID: 2, categoryID: 3)
let b = ActiveCodeSourceIdentity(canonicalEdition: "2014", jurisdictionID: 1, codeID: 2, categoryID: 3)
let c = ActiveCodeSourceIdentity(canonicalEdition: "2022", jurisdictionID: 1, codeID: 2, categoryID: 4)
let ta = ActiveCodeSourceNavigationTarget(sectionID: 50, source: a)
let tb = ActiveCodeSourceNavigationTarget(sectionID: 50, source: b)
let tc = ActiveCodeSourceNavigationTarget(sectionID: 50, source: c)
var preferences = ActiveCodeSources()
func resolve(_ candidates: [ActiveCodeSourceNavigationTarget], edition: String? = nil,
             hint: ActiveCodeSourceIdentity? = nil) -> ActiveCodeSourceNavigationAccess {
    .resolve(sectionID: 50, canonicalEdition: edition, sourceHint: hint,
             candidates: candidates, preferences: preferences)
}
precondition(resolve([ta]) == .allowed(ta))
precondition(resolve([ta, ta]) == .allowed(ta))
precondition(resolve([ta, tb]) == .unavailable(.ambiguousSource))
precondition(resolve([tb, ta]) == .unavailable(.ambiguousSource))
precondition(resolve([ta, tb], edition: "2014") == .allowed(tb))
precondition(resolve([ta], edition: "2014") == .unavailable(.sourceNotFound))
precondition(resolve([ta, tc], edition: "2022") == .unavailable(.ambiguousSource))
precondition(resolve([ta, tc], hint: c) == .allowed(tc))
precondition(resolve([ta], hint: c) == .unavailable(.sourceNotFound))
precondition(resolve([ta, tb], edition: "2022", hint: b) == .unavailable(.sourceNotFound))
precondition(resolve([.init(sectionID: 51, source: a)]) == .unavailable(.sourceNotFound))
preferences.disable(a)
let before = preferences
precondition(resolve([ta]) == .requiresEnable(ta))
precondition(resolve([ta, tb], edition: "2014") == .allowed(tb))
precondition(resolve([ta, tb]) == .unavailable(.ambiguousSource))
precondition(preferences == before) // A request never implicitly enables its source.
precondition(ActiveCodeSourceNavigationAccess.resolve(sectionID: 50, candidates: [ta], preferences: nil) == .unavailable(.preferencesUnavailable))
preferences.enable(a)
precondition(resolve([ta]) == .allowed(ta))
print("Exact-source navigation passed: metadata-only identity, ambiguous/missing fail closed, disabled requires explicit enable, no preference mutation.")
`);
  const binary = join(temporary, "navigation-access");
  execFileSync("swiftc", [model, main, "-o", binary], { stdio: "inherit" });
  process.stdout.write(execFileSync(binary, [], { encoding: "utf8" }));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
