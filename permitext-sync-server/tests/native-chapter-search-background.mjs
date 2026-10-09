// Actual native chapter matching compared against the pre-change implementation.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/Views/NativeChapterTextReaderView.swift',import.meta.url),'utf8');
const baseline = await readFile(new URL('./fixtures/native-chapter-search-before-smooth.swift',import.meta.url),'utf8');
const current = source.slice(source.indexOf('enum NativeReaderSearchIndex {'),source.indexOf('\nenum NativeReaderReferenceKind:'));
const matchStart = source.indexOf('struct NativeReaderSearchMatch:');
const match = source.slice(matchStart,source.indexOf('\n}',matchStart)+2);
assert.ok(current.startsWith('enum '));
const updateStart = source.indexOf('    private func updateChapterSearch(');
assert.ok(updateStart >= 0);
const updateMethod = source.slice(updateStart, source.indexOf('\n    }', updateStart) + 6).replace('private func', 'func');
assert.match(source, /\.task\(id: "[^"\n]*route.id[^"\n]*searchQuery[^"\n]*isBrowserTabActive[^"\n]*"\) \{\s*await updateChapterSearch\(\)/, 'Visible Reader owns cancellable query work');
assert.match(source, /\.safeAreaInset\(edge: \.top, spacing: 0\) \{\s*if isSearchPresented \{\s*ChapterFindControls/, 'Find controls sit near passage header');
assert.doesNotMatch(source, /NativeReaderSearchSheet|presentedInSearchSheet/, 'Find must not depend on a covered Reader task');
const fixture = `import Foundation
struct NativeReaderRuntimeListItem: Sendable { var plainText: String; var children: [Self] = [] }
struct Cell: Sendable { var plainText: String }
struct Table: Sendable { var caption: String?; var cells: [Cell] = []; var footnotes: [String] = [] }
struct Media: Sendable { var accessibilityText: String?; var caption: String? }
struct NativeReaderRuntimeBlock: Sendable {
 enum Kind: Sendable { case paragraph, orderedList, unorderedList, table, image, figure }
 var kind: Kind = .paragraph; var plainText: String = ""; var listItems: [NativeReaderRuntimeListItem] = []
 var table: Table?; var media: [Media] = []; var caption: String?
}
struct NativeReaderDisplayBlock: Sendable { var id: String; var sourceBlockID: String; var block: NativeReaderRuntimeBlock }
${match}
${baseline}
${current}
@MainActor final class SearchHarness {
 struct Route { var id = "chapter-a" }
 var route = Route()
 var isBrowserTabActive = true
 var isSearchPresented = false
 var searchQuery = "concrete"
 var displayBlocks: [NativeReaderDisplayBlock]
 var searchMatches: [NativeReaderSearchMatch] = []
 var searchMatchesByBlock: [String: [NativeReaderSearchMatch]] = [:]
 var appliedSearchQuery: String?
 var appliedSearchRouteID: String?
 var isChapterSearchInProgress = false
 var activeSearchMatchID: String?
 init(_ blocks: [NativeReaderDisplayBlock]) { displayBlocks = blocks }
 ${updateMethod}
}
@main struct Main {
 @MainActor static func main() async {
  let texts = ["CONCRETE. Material definition.", "Concrete shall comply with this section.", "Concrete concrete CONCRETE", "Café entrances; CAFÉ accessible route.", "Egress 🚪 and façade: occupant load 100.1", "An accessible entrance needs sufficient clearance.", "🔎 prefix then CONCRETE.", "AIR-CONDITIONING. Equipment."]
  var blocks = texts.enumerated().map { NativeReaderDisplayBlock(id: "b\\($0.offset)", sourceBlockID: "s\\($0.offset)", block: .init(plainText: $0.element)) }
  blocks.append(.init(id: "list",sourceBlockID: "list",block: .init(kind: .orderedList,listItems: [.init(plainText: "Accessible route",children: [.init(plainText: "Concrete finish")])])))
  blocks.append(.init(id: "table",sourceBlockID: "table",block: .init(kind: .table,table: .init(caption: "Concrete table",cells: [.init(plainText: "Clearance 100.1")],footnotes: ["Accessible width"]))))
  blocks.append(.init(id: "image",sourceBlockID: "image",block: .init(kind: .image,media: [.init(accessibilityText: "Accessible diagram",caption: "Concrete assembly")])))
  blocks.append(.init(id: "b0",sourceBlockID: "duplicate",block: .init(plainText: "Concrete duplicate source ID behavior")))
  let queries = ["", " ", "concrete", "Concrete", "cafe", "façade", "🚪", "100.1", "accesible", "accessble entrnce", "clearance", "nonexistent", "air-conditioning", "concrete finish"]
  for query in queries {
   let expected = ReferenceNativeReaderSearchIndex.matches(query: query,in: blocks)
   let actual = NativeReaderSearchIndex.matches(query: query,in: blocks)
   precondition(actual == expected,"Exact order/range/snippet parity for \\(query)")
   let asyncResult = await NativeReaderSearchIndex.matchesAsync(query: query,in: blocks)
   precondition(asyncResult == expected,"Background result parity")
   let grouped = Dictionary(grouping: actual,by: \\.blockID)
   for block in blocks { precondition((grouped[block.id] ?? []) == actual.filter { $0.blockID == block.id }) }
  }
  let cancelled = Task {
   while !Task.isCancelled { await Task.yield() }
   return await NativeReaderSearchIndex.matchesAsync(query: "concrete",in: blocks)
  }
  cancelled.cancel()
  let cancelledResult = await cancelled.value
  precondition(cancelledResult.isEmpty,"Cancelled query must not publish matches")
  let expected = NativeReaderSearchIndex.matches(query: "concrete", in: blocks)
  let sheet = SearchHarness(blocks)
  sheet.isSearchPresented = true
  await sheet.updateChapterSearch()
  precondition(sheet.searchMatches == expected && !sheet.isChapterSearchInProgress, "Visible Reader publishes chapter-scoped matches")
  precondition(sheet.activeSearchMatchID == nil, "Typing must not claim a passage was visited before navigation")
  sheet.displayBlocks = []
  sheet.isSearchPresented = false
  await sheet.updateChapterSearch()
  precondition(sheet.searchMatches == expected, "Closing controls must not rescan completed query")
  sheet.searchQuery = " "
  await sheet.updateChapterSearch()
  precondition(sheet.searchMatches.isEmpty && sheet.searchMatchesByBlock.isEmpty && sheet.activeSearchMatchID == nil && !sheet.isChapterSearchInProgress, "Empty query resets all display state")

  let rapid = SearchHarness(blocks)
  await rapid.updateChapterSearch()
  rapid.searchQuery = "cafe"
  let abandoned = Task { await rapid.updateChapterSearch() }
  while !rapid.isChapterSearchInProgress { await Task.yield() }
  rapid.searchQuery = "concrete"
  abandoned.cancel(); await abandoned.value
  await rapid.updateChapterSearch()
  precondition(rapid.searchMatches == expected, "A to B to A must restore A after B cleared the applied cache")

  for changesRoute in [true, false] {
   let h = SearchHarness(blocks)
   let obsolete = Task { await h.updateChapterSearch() }
   while !h.isChapterSearchInProgress { await Task.yield() }
   if changesRoute { h.route.id = "chapter-b" } else { h.isBrowserTabActive = false }
   await obsolete.value
   precondition(h.searchMatches.isEmpty && h.appliedSearchQuery == nil, "Obsolete route/inactive tab must not publish")
   if !changesRoute {
    await h.updateChapterSearch()
    precondition(!h.isChapterSearchInProgress, "Inactive tab releases progress")
    h.isBrowserTabActive = true
   }
   await h.updateChapterSearch()
   precondition(h.searchMatches == expected && h.appliedSearchRouteID == h.route.id && !h.isChapterSearchInProgress)
  }
  print("PASS: frozen exact/fuzzy/Unicode/list/table/media/duplicate-ID parity, background matching and cancellation; actual update method covers inline ownership, first navigation, applied-cache reuse, empty reset, A-B-A, route and tab changes")
 }
}
`;
const dir = await mkdtemp(join(tmpdir(),'permitext-chapter-search-'));
try {
 await writeFile(join(dir,'verify.swift'),fixture);
 execFileSync('xcrun',['swiftc','-parse-as-library',join(dir,'verify.swift'),'-o',join(dir,'verify')],{stdio:'inherit'});
 execFileSync(join(dir,'verify'),[],{stdio:'inherit'});
} finally { await rm(dir,{recursive:true,force:true}); }
