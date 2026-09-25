import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const source = await readFile(join(root, "NYC CC APP/permitext/Data/AuthoredCodeStore.swift"), "utf8");
const reference = await readFile(new URL("./fixtures/native-search-before-perf04.swift", import.meta.url), "utf8");
function extract(text, signature) {
  const start = text.indexOf(signature);
  assert.ok(start >= 0, signature);
  const open = text.indexOf("{", start);
  let depth = 1;
  for (let end = open + 1; end < text.length; end++) {
    if (text[end] === "{") depth++;
    if (text[end] === "}" && --depth === 0) return text.slice(start, end + 1);
  }
  throw new Error(`Unclosed method: ${signature}`);
}
const stripSignposts = text => text.split("\n").filter(line => !line.includes("OSSignpostID") && !line.includes("os_signpost(")).join("\n");
const title = extract(await readFile(join(root, "NYC CC APP/permitext/Models/CodeModels.swift"), "utf8"), "    var titleThroughFirstPeriod: String");
const temporary = await mkdtemp(join(tmpdir(), "permitext-active-search-"));
try {
  const swift = `import Foundation
extension String { ${title} }
struct Section { let id: Int64; let sectionNumber: String; let title: String; let kind = "section"; let text: String }
struct Chapter { let chapterNumber: String; let codeSectionID: Int64? }
struct IndexedSection { let section: Section; let chapter: Chapter }
struct SearchHit { let rank: Int; let indexed: IndexedSection }
struct CodeSearchResult: Equatable { let id: Int64; let codeSectionID: Int64?; let chapterNumber: String; let sectionNumber: String; let title: String; let snippet: String; let kind: String }
final class Harness: @unchecked Sendable {
 let sectionIndex: [Int64: IndexedSection]
 let tokens: [String: Set<Int64>]
 var reads: [Int64] = []
 init() {
  let rows: [(Int64, Int64, String, String, String)] = [
   (1, 10, "1.1", "Concrete walls", "Concrete walls must comply."),
   (2, 10, "1.2", "Concrete columns", "Concrete columns must comply."),
   (3, 20, "2.1", "Concrete floors", "Concrete floors must comply."),
   (4, 20, "2.2", "Materials", "Use concrete for this floor."),
   (5, 30, "3.1", "Concrete roof", "Concrete roof must comply."),
   (6, 20, "2.3", "Other material", "Concretely is not an exact word match.")
  ]
  sectionIndex = Dictionary(uniqueKeysWithValues: rows.map { id, category, number, title, body in
   (id, IndexedSection(section: Section(id: id, sectionNumber: number, title: title, text: body), chapter: Chapter(chapterNumber: String(number.prefix(1)), codeSectionID: category)))
  })
  var index: [String: Set<Int64>] = [:]
  for row in rows {
   for token in Self.tokenize(row.2 + " " + row.3 + " " + row.4) { index[token, default: []].insert(row.0) }
  }
  // A false-positive token candidate exercises exact verification, not just filtering.
  index["concrete", default: []].insert(6)
  tokens = index
 }
 func invertedIndex(for scope: Int64?) -> [String: Set<Int64>] {
  guard let scope else { return tokens }
  return tokens.mapValues { Set($0.filter { sectionIndex[$0]?.chapter.codeSectionID == scope }) }
 }
 func officialText(for indexed: IndexedSection) -> String { indexed.section.text }
 func searchOfficialText(for indexed: IndexedSection) -> String { reads.append(indexed.section.id); return indexed.section.text }
 ${stripSignposts(extract(reference, "    func search(")).replace("func search(", "func referenceSearch(")}
 ${stripSignposts(extract(source, "    func search("))}
 ${extract(source, "    private static func tokenize(")}
 ${extract(source, "    private static func snippet(")}
}
@main struct Run {
 static func main() {
  let h = Harness()
  for query in ["concrete", "concrete floors", "2.1", "missing", " "] {
   for snippets in [false, true] {
    let old = h.referenceSearch(query: query, includeSnippets: snippets, resultLimit: nil)
    precondition(h.search(query: query, includeSnippets: snippets, resultLimit: nil) == old)
    precondition(h.search(query: query, includeSnippets: snippets, resultLimit: nil, allowedCodeSectionIDs: [10, 20, 30]) == old)
   }
  }
  let baseline = h.referenceSearch(query: "concrete", resultLimit: nil)
  precondition(baseline.map(\\.id) == [1, 2, 3, 5, 4])
  h.reads = []
  let subset = h.search(query: "concrete", resultLimit: nil, allowedCodeSectionIDs: [20])
  precondition(subset == baseline.filter { $0.codeSectionID == 20 })
  precondition(Set(h.reads) == Set([3, 4, 6]))
  precondition(h.reads.count == 5) // Three verifications plus two snippets.
  precondition(!subset[0].snippet.isEmpty)
  h.reads = []
  precondition(h.search(query: "concrete", includeSnippets: false, resultLimit: 1, allowedCodeSectionIDs: [20]).map(\\.id) == [3])
  precondition(Set(h.reads) == Set([3, 4, 6]) && h.reads.count == 3)
  for allowed: Set<Int64> in [[], [999]] {
   h.reads = []
   precondition(h.search(query: "concrete", allowedCodeSectionIDs: allowed).isEmpty && h.reads.isEmpty)
  }
  h.reads = []
  precondition(h.search(query: "concrete", codeSectionID: 10, allowedCodeSectionIDs: [20]).isEmpty && h.reads.isEmpty)
  precondition(h.search(query: "concrete", codeSectionID: 20, resultLimit: nil, allowedCodeSectionIDs: [20]) == subset)
  h.reads = []
  precondition(h.search(query: "1.1", allowedCodeSectionIDs: [20]).isEmpty && h.reads.isEmpty)
  print("Native active-source Search passed: frozen baseline parity, ordered scope intersection, pre-decode exclusion, post-exclusion limit and snippets.")
 }
}
`;
  const main = join(temporary, "Harness.swift");
  const binary = join(temporary, "search-scope");
  await writeFile(main, swift);
  execFileSync("swiftc", ["-parse-as-library", main, "-o", binary], { stdio: "inherit" });
  process.stdout.write(execFileSync(binary, [], { encoding: "utf8" }));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
