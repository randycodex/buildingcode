// Compile the actual builder and pinned pre-change builder under Swift 6.
// AppKit provides real fonts/attributed strings. UIKit metrics are a counted,
// deterministic host adapter shared by both implementations: this proves exact
// construction parity and reuse, not device font rendering or frame timings.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const [source, models, baseline] = await Promise.all([
  readFile(new URL('../../NYC CC APP/permitext/Views/NativeChapterTextReaderView.swift', import.meta.url), 'utf8'),
  readFile(new URL('../../NYC CC APP/permitext/Data/NativeReaderDocumentStore.swift', import.meta.url), 'utf8'),
  readFile(new URL('./fixtures/native-reader-attributed-builder-7307dd52b.swift', import.meta.url), 'utf8')
]);
function between(text, start, end) {
  const a = text.indexOf(start), b = text.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return text.slice(a, b);
}
const builder = between(source, 'enum NativeReaderAttributedTextBuilder {', '\n// Avoid flashing');
const roles = between(source, 'enum NativeReaderTypographyRole:', '\nstruct NativeReaderAttributedTextPrefetchItem:');
const runs = between(models, 'enum NativeReaderRuntimeTextStyle:', '\nenum NativeReaderRuntimeListSegmentKind:');
const links = between(source, 'enum NativeReaderLinkResolver {', '    static func reference(for url:') + '}';
function host(text) {
  return text.replaceAll('UIFontMetrics', 'HostFontMetrics')
    .replaceAll('UIFont.TextStyle', 'HostTextStyle').replaceAll('UIFont', 'NSFont')
    .replaceAll('UIColor.label', 'NSColor.labelColor').replaceAll('UIColor.secondaryLabel', 'NSColor.secondaryLabelColor')
    .replaceAll('return .label', 'return .labelColor').replaceAll('return .secondaryLabel', 'return .secondaryLabelColor')
    .replaceAll('UIColor', 'NSColor').replaceAll('.traitBold', '.bold').replaceAll('.traitItalic', '.italic')
    .replaceAll('NSMutableAttributedString()', 'NSMutableAttributedString(string: "")')
    .replaceAll('theme.bodyFont.withSize(effectiveSize)', 'NSFont(descriptor: theme.bodyFont.fontDescriptor, size: effectiveSize)!')
    .replaceAll('.withSymbolicTraits(traits)', '.optionalTraits(traits)')
    .replaceAll('styledFont = NSFont(descriptor: descriptor, size: effectiveSize)', 'styledFont = NSFont(descriptor: descriptor, size: effectiveSize)!')
    .replaceAll('= NSMutableParagraphStyle()', '= HostParagraphStyles.make()')
    .replace('let paragraphStyle = mutableParagraphStyle.copy() as! NSParagraphStyle',
      'let paragraphStyle = mutableParagraphStyle.copy() as! NSParagraphStyle\n        precondition(!(paragraphStyle is NSMutableParagraphStyle), "Builder must supply an immutable shared paragraph style")');
}
const fixture = `import Foundation
import AppKit
enum HostTextStyle { case title1, title2, headline, subheadline, body, callout, footnote }
enum HostParagraphStyles {
    nonisolated(unsafe) static var calls = 0
    static func make() -> NSMutableParagraphStyle { calls += 1; return NSMutableParagraphStyle() }
}
struct HostFontMetrics {
    nonisolated(unsafe) static var calls = 0
    nonisolated(unsafe) static var scale: CGFloat = 1
    init(forTextStyle: HostTextStyle) {}
    func scaledFont(for font: NSFont) -> NSFont {
        Self.calls += 1
        return NSFont(descriptor: font.fontDescriptor, size: font.pointSize * Self.scale)!
    }
}
extension NSFontDescriptor {
    func optionalTraits(_ traits: SymbolicTraits) -> NSFontDescriptor? { withSymbolicTraits(traits) }
}
struct ReaderTheme {
    static let minimumFontSize: Double = 10
    var fontSize: Double = 17
    var lineSpacing: Double = 0
    var serif = true
    var bodyFont: NSFont { serif ? NSFont(name: "Times-Roman", size: fontSize)! : NSFont.systemFont(ofSize: fontSize) }
}
${runs}
${roles}
${links}
${host(baseline).replaceAll('NativeReaderAttributedTextBuilder', 'BaselineNativeReaderAttributedTextBuilder')}
${host(builder)}
func check(_ value: @autoclosure () -> Bool, _ message: String) {
    if !value() { FileHandle.standardError.write(Data((message + "\\n").utf8)); exit(1) }
}
@main struct Verify {
    static func main() {
        let styles: [NativeReaderRuntimeTextStyle] = [.bold, .italic, .underline, .strikethrough, .superscript, .subscript, .code, .small]
        let links: [String?] = [nil, "#403.1", "https://example.com/?a=1&amp;b=2", "hash: '#403.2'", " "]
        let combinations = (0..<256).map { mask in
            NativeReaderRuntimeTextRun(text: "Run \\(mask) café 🧱\\n", styles: styles.enumerated().compactMap { mask & (1 << $0.offset) == 0 ? nil : $0.element }, linkTarget: links[mask % links.count])
        }
        var comparisons = 0
        @discardableResult func compare(_ runs: [NativeReaderRuntimeTextRun], fallback: String = "Fallback café 🧱", theme: ReaderTheme = ReaderTheme(), role: NativeReaderTypographyRole = .body, color: NSColor = .systemOrange, highlights: [NSRange] = [], active: NSRange? = nil) -> (NSAttributedString, Int, Int) {
            HostFontMetrics.calls = 0
            HostParagraphStyles.calls = 0
            let old = BaselineNativeReaderAttributedTextBuilder.attributedText(runs: runs, fallbackText: fallback, theme: theme, role: role, accentColor: color, highlightRanges: highlights, activeHighlightRange: active)
            let before = HostFontMetrics.calls
            let paragraphsBefore = HostParagraphStyles.calls
            HostFontMetrics.calls = 0
            HostParagraphStyles.calls = 0
            let new = NativeReaderAttributedTextBuilder.attributedText(runs: runs, fallbackText: fallback, theme: theme, role: role, accentColor: color, highlightRanges: highlights, activeHighlightRange: active)
            let after = HostFontMetrics.calls
            check(HostParagraphStyles.calls == 1 && (paragraphsBefore == before),
                  "Candidate creates one paragraph style per build; baseline creates one per nonempty run")
            check(old.isEqual(to: new), "Exact font/link/paragraph/style/highlight parity failed")
            comparisons += 1
            return (new, before, after)
        }
        let (all, before, after) = compare(combinations, highlights: [NSRange(location: 0, length: 12), NSRange(location: 7, length: 9), NSRange(location: 100_000, length: 1)], active: NSRange(location: 13, length: 14))
        check(before == 256 && after == 8, "256 styled runs must construct only eight exact font variants")
        var paragraphs = Set<ObjectIdentifier>()
        all.enumerateAttribute(.paragraphStyle, in: NSRange(location: 0, length: all.length)) { value, _, _ in
            let paragraph = value as! NSParagraphStyle
            // AppKit may intern this attribute with an equal baseline value;
            // immutability is asserted at candidate copy creation above.
            paragraphs.insert(ObjectIdentifier(paragraph))
        }
        check(paragraphs.count == 1, "All runs share one immutable paragraph style")

        let roles: [NativeReaderTypographyRole] = [.majorHeading(level: 0), .majorHeading(level: 1), .majorHeading(level: 2), .majorHeading(level: 3), .majorHeading(level: 6), .heading(level: 1), .heading(level: 2), .heading(level: 3), .heading(level: 4), .body, .caption, .footnote, .note]
        let variants = [combinations[0], combinations[1], combinations[2], combinations[3], combinations[16], combinations[32], combinations[128], combinations[255], NativeReaderRuntimeTextRun(text: "", styles: [.bold], linkTarget: "#403")]
        for scale: CGFloat in [0.85, 1, 1.8] {
            HostFontMetrics.scale = scale
            for theme in [ReaderTheme(fontSize: 7, lineSpacing: -3), ReaderTheme(fontSize: 24, lineSpacing: 6, serif: false)] {
                for role in roles {
                    compare(variants, theme: theme, role: role, color: .systemBlue, highlights: [NSRange(location: 0, length: 4)], active: NSRange(location: 5, length: 6))
                }
            }
        }
        let single = [NativeReaderRuntimeTextRun(text: "Same text", styles: [.italic], linkTarget: nil)]
        HostFontMetrics.scale = 1
        let normal = compare(single).0
        HostFontMetrics.scale = 2
        let larger = compare(single).0
        check(!normal.isEqual(to: larger) && HostFontMetrics.calls == 1, "A later build must not reuse another scaling environment's font")
        compare([])
        let empty = compare([], fallback: "")
        check(empty.1 == 0 && empty.2 == 0 && empty.0.length == 0, "Empty text creates no fonts")
        compare([NativeReaderRuntimeTextRun(text: "", styles: [], linkTarget: nil)], fallback: "Must not replace an explicit empty run")
        let repeats = (0..<200).map { index in NativeReaderRuntimeTextRun(text: "text ", styles: index.isMultiple(of: 2) ? [.underline] : [.strikethrough, .code], linkTarget: links[index % links.count]) }
        let repeated = compare(repeats)
        check(repeated.1 == 200 && repeated.2 == 1, "Non-font style and link differences reuse one font while retaining distinct attributes")
        print("PASS: \\(comparisons) exact attributed-output comparisons across styles, roles, themes, scales, links, UTF16 and highlights; font constructions 256→8 / 200→1; immutable paragraph reuse")
    }
}
`;
const directory = await mkdtemp(join(tmpdir(), 'permitext-builder-reuse-'));
try {
  const path = join(directory, 'verify.swift'), binary = join(directory, 'verify');
  await writeFile(path, fixture);
  execFileSync('xcrun', ['swiftc', '-swift-version', '6', '-parse-as-library', path, '-o', binary], {stdio: 'inherit'});
  console.log(execFileSync(binary, [], {encoding: 'utf8', timeout: 30_000}).trim());
} finally { await rm(directory, {recursive: true, force: true}); }
