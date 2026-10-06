// Execute the production history ordering without requiring a Simulator runtime.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const models = await readFile(new URL('../../NYC CC APP/permitext/Models/CodeModels.swift', import.meta.url), 'utf8');
function declaration(start) {
  const a = models.indexOf(start), b = models.indexOf('\n}', a);
  assert.ok(a >= 0 && b > a);
  return models.slice(a, b + 2);
}
const fixture = String.raw`
func entry(_ id: Int64, _ code: String, _ version: String, _ time: TimeInterval) -> RecentlyViewedEntry {
    var value = RecentlyViewedEntry(sectionID: id, sectionNumber: "101.1", title: "Title",
        chapterTitle: "Chapter 1", codeSectionID: 1, codeSectionName: code,
        previewText: "Exact passage", viewedAt: Date(timeIntervalSince1970: time))
    value.sourceVersion = version
    return value
}
func check(_ value: Bool, _ message: String) { if !value { fatalError(message) } }
let oldBuilding = entry(7, "Building Code", "2014", 10)
let newBuilding = entry(7, "Building Code", "2022", 30)
let fuelGas = entry(8, "Fuel Gas Code", "2022", 40)
let secondBuilding = entry(9, "Building Code", "2022", 20)
let input = [oldBuilding, secondBuilding, fuelGas, newBuilding]
for mode in [RecentlyOpenedOrder.recent, .date] {
    check(mode.ordered(input) == [fuelGas, newBuilding, secondBuilding, oldBuilding], "Timeline must show latest opening first")
}
check(RecentlyOpenedOrder.code.ordered(input) == [oldBuilding, newBuilding, secondBuilding, fuelGas], "Code groups must stay contiguous with recent items first inside each edition")
check(RecentlyOpenedOrder.codeGroupID(oldBuilding) != RecentlyOpenedOrder.codeGroupID(newBuilding), "Code grouping must not merge editions with the same section ID")
for mode in RecentlyOpenedOrder.allCases {
    check(Set(mode.ordered(input)) == Set(input), "Changing grouping must preserve every exact passage and its source metadata")
    check(mode.ordered([]).isEmpty, "Empty history must remain empty")
}
let tieA = entry(12, "Building Code", "2022", 30), tieB = entry(11, "Building Code", "2022", 30)
check(RecentlyOpenedOrder.recent.ordered([tieA, tieB]) == RecentlyOpenedOrder.recent.ordered([tieB, tieA]), "Equal timestamps must keep stable ordering")
print("PASS: recent/date timeline, contiguous code and edition groups, exact passage retention, stable ties and empty history")
`;
const directory = await mkdtemp(join(tmpdir(), 'permitext-recently-opened-'));
try {
  const path = join(directory, 'main.swift');
  await writeFile(path, `import Foundation\n${declaration('enum RecentlyOpenedOrder:')}\n${declaration('struct RecentlyViewedEntry:')}\n${fixture}`);
  execFileSync('xcrun', ['swiftc', path, '-o', join(directory, 'verify')], { stdio: 'inherit' });
  execFileSync(join(directory, 'verify'), [], { stdio: 'inherit' });
} finally { await rm(directory, { recursive: true, force: true }); }
