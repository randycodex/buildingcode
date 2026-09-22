import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const sourcePath = 'NYC CC APP/permitext/Data/AuthoredCodeStore.swift';
const source = await readFile(join(root, sourcePath), 'utf8');
// Fixed pre-PERF04 baseline; independent of Git history availability in CI.
const reference = await readFile(new URL('./fixtures/native-search-before-perf04.swift', import.meta.url), 'utf8');
function extract(text, signature) {
 const start = text.indexOf(signature); assert.ok(start >= 0, signature);
 const open = text.indexOf('{', start); let depth = 1;
 for (let end = open + 1; end < text.length; end++) {
  if (text[end] === '{') depth++;
  if (text[end] === '}' && --depth === 0) return text.slice(start, end + 1);
 }
 throw new Error(`Unclosed method ${signature}`);
}
// Braces in these functions are balanced even within Swift interpolation/regex.
assert.equal(extract(source, '    private func officialText('), extract(reference, '    private func officialText('), 'Canonical rich-reader resolver changed; review the reference oracle explicitly');
const withoutSignposts = text => text.split('\n').filter(line => !line.includes('OSSignpostID') && !line.includes('os_signpost(')).join('\n');
const baselineSearch = withoutSignposts(extract(reference, '    func search(')).replace('func search(', 'func referenceSearch(');
const currentSearch = withoutSignposts(extract(source, '    func search('));
const tokenize = extract(source, '    private static func tokenize(');
const snippet = extract(source, '    private static func snippet(');
const searchTextMethod = extract(source, '    private func searchOfficialText(');
const textStoreSource = await readFile(join(root, 'NYC CC APP/permitext/Data/SearchTextStore.swift'), 'utf8');
const titleExtension = extract(await readFile(join(root, 'NYC CC APP/permitext/Models/CodeModels.swift'), 'utf8'), '    var titleThroughFirstPeriod: String');
const dir = await mkdtemp(join(tmpdir(), 'permitext-search-parity-'));
let passed = false;
try {
 execFileSync('python3', [join(root, 'Tools/permitext_search_text_pack.py'), '--check'], {cwd: root, stdio: 'inherit', timeout: 600000});
 const fixturePath = process.env.PERMITEXT_SEARCH_REFERENCE_FIXTURE || join(dir, 'reference.json');
 // Recompute reference text from shipped source/prepared HTML, never from the new pack.
 if (!process.env.PERMITEXT_SEARCH_REFERENCE_FIXTURE) execFileSync('python3', ['-c', `
import importlib.util,json,pathlib,sys
root=pathlib.Path(sys.argv[1]); temporary=pathlib.Path(sys.argv[2])
spec=importlib.util.spec_from_file_location('pack',root/'Tools/permitext_search_text_pack.py')
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
helper=m.compile_helper(temporary)
editions=[]
base=root/'NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city'
for edition in sorted(base.iterdir()):
 if not (edition/'prepared/chapterCatalog.json').exists(): continue
 texts=m.resolve_edition(edition,helper)
 sections=[]
 for chapter in m.edition_input(edition)['chapters']:
  for section in chapter['sections']:
   sid=section['id']
   sections.append(dict(id=sid,sectionNumber=section['sectionNumber'],title=section['title'],kind=section['kind'],chapterNumber=chapter['chapterNumber'],codeSectionID=chapter.get('codeSectionID'),text=texts[str(sid)]))
 editions.append(dict(name=edition.name,path=str(edition),sections=sections))
pathlib.Path(sys.argv[3]).write_text(json.dumps(editions))
`, root, dir, fixturePath], {cwd: root, stdio: 'inherit', timeout: 600000});
 const swift = `import Foundation
func require(_ condition: @autoclosure () -> Bool, _ message: @autoclosure () -> String = "Parity assertion failed") {
 if !condition() {
  FileHandle.standardError.write(Data((message() + "\\n").utf8))
  exit(1)
 }
}
extension String { ${titleExtension} }
struct Section: Decodable { let id: Int64; let sectionNumber: String; let title: String; let kind: String; let chapterNumber: String; let codeSectionID: Int64?; let text: String }
struct Edition: Decodable { let name: String; let path: String; let sections: [Section] }
struct Chapter { let chapterNumber: String; let codeSectionID: Int64? }
struct IndexedSection { let section: Section; let chapter: Chapter }
struct SearchHit { let rank: Int; let indexed: IndexedSection }
struct CodeSearchResult: Equatable { let id: Int64; let codeSectionID: Int64?; let chapterNumber: String; let sectionNumber: String; let title: String; let snippet: String; let kind: String }
final class Harness: @unchecked Sendable {
 let sectionIndex: [Int64: IndexedSection]
 let tokens: [String: Set<Int64>]
 var scopedTokens: [Int64: [String: Set<Int64>]] = [:]
 let searchTextStore: SearchTextStore
 init(_ edition: Edition) throws {
  sectionIndex = Dictionary(uniqueKeysWithValues: edition.sections.map { ($0.id, IndexedSection(section: $0, chapter: Chapter(chapterNumber: $0.chapterNumber, codeSectionID: $0.codeSectionID))) })
  let url = URL(fileURLWithPath: edition.path).appendingPathComponent("prepared/searchIndex.json")
  let data = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
  tokens = (data["tokens"] as! [String: [Int64]]).mapValues { Set($0) }
  self.searchTextStore = SearchTextStore(preparedURL: URL(fileURLWithPath: edition.path).appendingPathComponent("prepared"))
 }
 func invertedIndex(for scope: Int64?) -> [String: Set<Int64>] {
  guard let scope else { return tokens }
  if let cached = scopedTokens[scope] { return cached }
  let index = tokens.mapValues { ids in Set(ids.filter { sectionIndex[$0]?.chapter.codeSectionID == scope }) }
  scopedTokens[scope] = index
  return index
 }
 func officialText(for indexed: IndexedSection) -> String { indexed.section.text }
 ${searchTextMethod}
 ${baselineSearch}
 ${currentSearch}
 ${tokenize}
 ${snippet}
}
@main struct Run {
 static func main() async throws {
  let editions = try JSONDecoder().decode([Edition].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
  require(editions.count == 6, "Expected six bundled editions")
  var checks = 0
  for edition in editions {
   let store = SearchTextStore(preparedURL: URL(fileURLWithPath: edition.path).appendingPathComponent("prepared"))
   require(store.revision != nil, "A validated compact pack must exist")
   for section in edition.sections { require(store.text(sectionID: section.id) == section.text, "Text mismatch: \\(edition.name)/\\(section.id)") }
   let harness = try Harness(edition)
   if edition.name == "2022-construction-codes" || edition.name == "2014-construction-codes" {
    require(!harness.referenceSearch(query: "concrete").isEmpty, "Primary edition must have concrete matches")
   }
   let queries = ["concrete", "CONCRETE", " concrete ", "reinforced concrete", "means of egress", "means  of\\negress", "1005.3.1", "1005", "28-202.3", "fire-resistance", "§ 28-202.3", "(concrete)", "café", "東京", "zzzxnomatchxyz", "", " ", "!"]
   let scopes: [Int64?] = [nil] + Set(edition.sections.compactMap { $0.codeSectionID }).sorted().map { Optional($0) } + [Int64.max]
   for query in queries {
    for scope in scopes {
     let expected = harness.referenceSearch(query: query, codeSectionID: scope, includeSnippets: true, resultLimit: nil)
     let actual = harness.search(query: query, codeSectionID: scope, includeSnippets: true, resultLimit: nil)
     if expected != actual {
      let mismatch = zip(expected, actual).first { $0.0 != $0.1 }
      FileHandle.standardError.write(Data("Expected \\(expected.count) results; actual \\(actual.count); first mismatch: \\(String(describing: mismatch))\\n".utf8))
     }
     require(expected == actual, "Search parity: \\(edition.name) \\(query) scope=\\(String(describing: scope))")
     checks += 1
    }
   }
   for limit: Int? in [nil, -1, 0, 1, 7, 200] {
    for snippets in [true, false] {
     require(harness.referenceSearch(query: "concrete", includeSnippets: snippets, resultLimit: limit) == harness.search(query: "concrete", includeSnippets: snippets, resultLimit: limit))
     checks += 1
    }
   }
   let cancelled = Task { () -> Bool in
    withUnsafeCurrentTask { $0?.cancel() }
    return harness.search(query: "concrete").isEmpty && harness.referenceSearch(query: "concrete").isEmpty
   }
   let cancellationPassed = await cancelled.value
   require(cancellationPassed, "Cancelled search must return no completed results")
   print("PASS: \\(edition.name), \\(edition.sections.count) canonical section texts and search parity")
  }
  print("PASS: \\(checks) ordered result/snippet parity checks; six cancellation cases")
 }
}
`;
 await writeFile(join(dir, 'check.swift'), swift + '\n' + textStoreSource);
 execFileSync('xcrun', ['swiftc', '-O', '-parse-as-library', join(dir, 'check.swift'), '-o', join(dir, 'check')], {stdio: 'pipe'});
 console.log(execFileSync(join(dir, 'check'), [fixturePath], {encoding: 'utf8', timeout: 600000}));
 passed = true;
} finally {
 if (passed) await rm(dir, {recursive: true, force: true});
 else console.error(`Preserved diagnostic source and reference fixture: ${dir}`);
}
