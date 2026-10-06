import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const button = await readFile(new URL('../../NYC CC APP/permitext/Views/ChapterReaderView.swift', import.meta.url), 'utf8');
const text = await readFile(new URL('../../NYC CC APP/permitext/Views/NativeChapterTextReaderView.swift', import.meta.url), 'utf8');
const a = button.indexOf('        Button {', button.indexOf('struct ReaderCurrentSectionBookmarkButton:'));
const b = button.indexOf('        } label:', a);
const c = text.indexOf('    private func savedText(');
const d = text.indexOf('    private var allowsDefinitionLinks:', c);
assert.ok(a > 0 && b > a && c > 0 && d > c);
const fixture = `import Foundation
extension NSAttributedString.Key {
 static let foregroundColor = Self("foregroundColor")
 static let backgroundColor = Self("backgroundColor")
 static let link = Self("link")
}
struct ReaderPassageSaveTarget { let sectionID: Int64; let codeVersion: String; let sessionID: UUID }
struct Version { let codeVersion = "2022" }
final class Library {
 var selectedVersion: Version? = Version()
 let privateSessionID = UUID()
 var saved = false
 var fail = false
 var toggleCount = 0
 func toggleBookmark(sectionID: Int64) -> Bool { toggleCount += 1; if !fail { saved.toggle() }; return saved }
 func saveSection(sectionID: Int64, toFolderIDs: [Int64], allowsUnassigned: Bool) -> Bool { if !fail { saved = true }; return saved }
}
final class ButtonFixture {
 let library = Library()
 let sectionID: Int64? = 1
 var isSaved: Bool { library.saved }
 var message: String?
 func showConfirmation(_ message: String, target: ReaderPassageSaveTarget) { self.message = message }
 func tap() {
 ${button.slice(a + '        Button {'.length, b)}
 }
}
let button = ButtonFixture()
button.tap()
precondition(button.library.saved && button.message == "Saved")
button.tap()
precondition(!button.library.saved && button.message == "Removed from Saved" && button.library.toggleCount == 1)
button.tap()
button.library.fail = true
button.tap()
precondition(button.library.saved && button.message == "Couldn’t remove")
struct Presentation {
 let isBookmarked: Bool
 let accentColor = "accent"
 ${text.slice(c, d).replace('private func savedText', 'func savedText')}
}
let source = NSMutableAttributedString(string: "normal linked highlighted", attributes: [.foregroundColor:"original"])
source.addAttribute(.link, value:"https://example.test", range:NSRange(location:7,length:6))
source.addAttribute(.backgroundColor, value:"search", range:NSRange(location:14,length:11))
let saved = Presentation(isBookmarked:true).savedText(source)
precondition(saved.string == source.string)
precondition(saved.attribute(.foregroundColor, at:0, effectiveRange:nil) as? String == "accent")
precondition(saved.attribute(.link, at:8, effectiveRange:nil) as? String == "https://example.test")
precondition(saved.attribute(.foregroundColor, at:16, effectiveRange:nil) as? String == "original")
precondition(source.attribute(.foregroundColor, at:0, effectiveRange:nil) as? String == "original")
precondition(Presentation(isBookmarked:false).savedText(source).isEqual(to:source))
print("PASS: save/remove button toggles immediately, removal failures retain saved state; saved color preserves source cache, text, links and search highlights")
`;
const directory = await mkdtemp(join(tmpdir(), 'permitext-bookmark-actions-'));
try {
 const file = join(directory, 'main.swift'), binary = join(directory, 'verify');
 await writeFile(file, fixture);
 execFileSync('xcrun', ['swiftc', file, '-o', binary], {stdio:'inherit'});
 execFileSync(binary, [], {stdio:'inherit'});
} finally { await rm(directory, {recursive:true, force:true}); }
