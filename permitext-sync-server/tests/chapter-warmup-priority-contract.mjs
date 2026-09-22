import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift', import.meta.url), 'utf8');
const start = source.indexOf('    private func startupPriorityChapters(');
const end = source.indexOf('    private func warmChapterReaderEntry(', start);
assert.ok(start > 0 && end > start);
const method = source.slice(start, end).replace('private func', 'func');
const directory = await mkdtemp(join(tmpdir(), 'permitext-chapter-priority-'));
try {
 const path = join(directory, 'main.swift');
 await writeFile(path, `import Foundation
struct CodeChapter { let id: Int64 }
struct Section { let id: Int64 }
struct Recent { let sectionID: Int64; let sourceVersion: String?; let viewedAt: Date }
struct Version { let codeVersion: String }
struct Context { var lastOpenedChapterID: Int64? }
struct Continuity { var context = Context(); func load() -> Context { context } }
enum NativeReaderDocumentStore { static let preparedDocumentCountLimit = 4 }
enum UserContentSyncCodeVersion { static func server(_ v: String) -> String { v.lowercased() } }
struct Catalog { func sections(chapterID: Int64) -> [Section] { [Section(id: chapterID * 10)] } }
final class Harness {
 var continuityStore = Continuity()
 var recentlyViewedSections: [Recent] = []
 var authoredCodeStore: Catalog? = Catalog()
 var selectedVersion: Version? = Version(codeVersion: "2022")
${method}
}
let h = Harness()
let chapters = (1...8).map { CodeChapter(id: Int64($0)) }
func ids() -> [Int64] { h.startupPriorityChapters(from: chapters).map(\\.id) }
precondition(ids() == [1,2,3,4])
h.continuityStore.context.lastOpenedChapterID = 8
h.recentlyViewedSections = [
 Recent(sectionID: 60, sourceVersion: "2022", viewedAt: Date(timeIntervalSince1970: 1)),
 Recent(sectionID: 70, sourceVersion: "2022", viewedAt: Date(timeIntervalSince1970: 3)),
 Recent(sectionID: 50, sourceVersion: "2014", viewedAt: Date(timeIntervalSince1970: 4)),
 Recent(sectionID: 80, sourceVersion: "2022", viewedAt: Date(timeIntervalSince1970: 5)),
 Recent(sectionID: 40, sourceVersion: nil, viewedAt: Date(timeIntervalSince1970: 6))]
precondition(ids() == [8,7,6,1])
h.continuityStore.context.lastOpenedChapterID = 999
precondition(ids() == [8,7,6,1])
h.authoredCodeStore = nil
precondition(ids() == [1,2,3,4])
precondition(h.startupPriorityChapters(from: []).isEmpty)
print("PASS: recent priority, edition isolation, deduplication, capacity and missing history")
`);
 const binary = join(directory, 'verify');
 execFileSync('xcrun', ['swiftc', path, '-o', binary], {stdio:'pipe'});
 console.log(execFileSync(binary, [], {encoding:'utf8'}).trim());
} finally { await rm(directory, {recursive:true, force:true}); }
