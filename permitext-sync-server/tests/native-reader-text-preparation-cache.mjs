import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const source=await readFile(new URL('../../NYC CC APP/permitext/Views/AttributedTextView.swift',import.meta.url),'utf8');
const context=source.slice(source.indexOf('struct ReaderDefinitionContext: Hashable'),source.indexOf('private struct ReaderDefinitionContextKey:'));
const models=source.slice(source.indexOf('struct ReaderDefinitionEntry:'),source.indexOf('final class ReaderDefinitionMatcher {'));
const matcher=source.slice(source.indexOf('final class ReaderDefinitionMatcher {'),source.indexOf('@MainActor\nfinal class ReaderDefinitionStore'));
const preparation=source.slice(source.indexOf('@MainActor\nprivate final class ReaderAttributedTextPreparationCache'),source.indexOf('private struct AttributedTextWidthPreferenceKey:')).replaceAll('private ', '');
const host=value=>value.replaceAll('UIFont','NSFont').replaceAll('UIColor','NSColor').replaceAll('.traitItalic','.italic').replaceAll('NSColor.secondaryLabel','NSColor.secondaryLabelColor');
// Verbatim production splitter before this optimization, pinned in this test so
// future commits do not change the reference implementation.
const previousSplitter="    static func blocks(for text: NSAttributedString) -> [AttributedTextBlock] {\n        let nsText = text.string as NSString\n        guard nsText.length > 0 else {\n            return [AttributedTextBlock(id: 0, kind: .flow, attributedText: text)]\n        }\n\n        var blocks: [AttributedTextBlock] = []\n        var location = 0\n\n        while location < nsText.length {\n            let paragraphRange = nsText.paragraphRange(for: NSRange(location: location, length: 0))\n            let paragraphText = text.attributedSubstring(from: paragraphRange)\n            let paragraphKind: AttributedTextBlock.Kind = containsTable(in: paragraphText) ? .table : .flow\n\n            if let lastIndex = blocks.indices.last, blocks[lastIndex].kind == paragraphKind {\n                let combined = NSMutableAttributedString(attributedString: blocks[lastIndex].attributedText)\n                combined.append(paragraphText)\n                blocks[lastIndex] = AttributedTextBlock(\n                    id: blocks[lastIndex].id,\n                    kind: paragraphKind,\n                    attributedText: combined\n                )\n            } else {\n                blocks.append(\n                    AttributedTextBlock(\n                        id: blocks.count,\n                        kind: paragraphKind,\n                        attributedText: paragraphText\n                    )\n                )\n            }\n\n            location = paragraphRange.upperBound\n        }\n\n        return blocks.isEmpty\n            ? [AttributedTextBlock(id: 0, kind: .flow, attributedText: text)]\n            : blocks\n    }\n\n    static func containsTable(in text: NSAttributedString) -> Bool {\n        // iOS's RTF importer does not preserve NSTextTable, so attributed text\n        // produced from RTF/RTFD overrides never carries native table structure\n        // on this platform. The previous implementation round-tripped the entire\n        // attributed string through RTF data to look for `\\trowd`, which was\n        // expensive and effectively always returned false here. Treating tables\n        // as flow content preserves observable behavior without the cost.\n        _ = text\n        return false\n    }\n\n";
assert.match(source,/@State private var textPreparation = ReaderAttributedTextPreparationCache\(\)/);
assert.match(source,/textPreparation.blocks\(for: attributedText, context: definitionContext\)/);
assert.doesNotMatch(preparation,/contentWidth|availableWidth|UIContentSizeCategory/,'Preparation cannot cache width-dependent layout');
assert.match(source,/lastRenderedContentWidth != contentWidth/);
assert.match(source,/measuredWidth == width/);
const registryPath=fileURLToPath(new URL('../../NYC CC APP/permitext/Resources/CodeContent/reader-definition-registry.json',import.meta.url));
const harness=String.raw`
func check(_ condition: @autoclosure () -> Bool, _ message: String = "", line: UInt = #line) {
 if !condition() { FileHandle.standardError.write(Data("Check failed at generated Swift line \(line): \(message)\n".utf8)); exit(1) }
}
@main struct Verify {
 @MainActor static func main() throws {
 let registry=try JSONDecoder().decode(ReaderDefinitionRegistry.self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1])))
 let regular=NSFont.systemFont(ofSize:14)
 let italic=NSFontManager.shared.convert(regular,toHaveTrait:.italicFontMask)
 func context(_ code:String,_ chapter:String,_ section:String)->ReaderDefinitionContext {
  let book=registry.books.first { $0.bundle=="2022-construction-codes" && $0.entries.contains { $0.source.code.uppercased()==code } }!
  return ReaderDefinitionContext(versionFileName:"new-york-city/2022-construction-codes/fixture",codeSectionID:book.codeSectionID,chapterNumber:chapter,chapterID:Int64(chapter),sectionNumber:section)
 }
 let contexts=[context("PLUMBING CODE","2","202"),context("MECHANICAL CODE","1","101"),context("BUILDING CODE","1","101")]
 var decorations=0,checks=0
 var matchers:[ReaderDefinitionContext:ReaderDefinitionMatcher]=[:]
 func matcher(_ context:ReaderDefinitionContext)->ReaderDefinitionMatcher {
  if let cached=matchers[context] { return cached }
  let matcher=ReaderDefinitionMatcher(entries:registry.entries(for:context),sectionNumber:context.sectionNumber)
  matchers[context]=matcher
  return matcher
 }
 func decorate(_ source:NSAttributedString,_ context:ReaderDefinitionContext)->NSAttributedString {
  decorations += 1
  return matcher(context).decorating(source)
 }
 func verify(_ cache:ReaderAttributedTextPreparationCache,_ text:NSAttributedString,_ context:ReaderDefinitionContext?)->[AttributedTextBlock] {
  let before=NSAttributedString(attributedString:text)
  let expected=LegacySplitter.blocks(for:context.map { matcher($0).decorating(text) } ?? text)
  let actual=cache.blocks(for:text,context:context,decorate:decorate)
  precondition(expected.count==actual.count && actual.count==1)
  for (old,new) in zip(expected,actual) {
   precondition(old.id==new.id && old.kind==new.kind && old.attributedText.isEqual(to:new.attributedText),"Exact attributed output differs")
   precondition(Array(old.attributedText.string.utf16)==Array(new.attributedText.string.utf16))
  }
  precondition(text.isEqual(to:before),"Preparation mutated the caller's input")
  checks += 1
  return actual
 }
 // Equivalent new inputs and repeated body/width updates reuse the same prepared
 // object. Width is consumed only by the unchanged UIViewRepresentable below it.
 let cache=ReaderAttributedTextPreparationCache()
 let paragraph=NSMutableParagraphStyle(); paragraph.lineSpacing=3
 let source=NSMutableAttributedString(string:"The building wall and plumbing fixture shall comply.\nMechanical equipment and ventilation.\r\n🧱 café cafe\u{301}.",attributes:[.font:italic,.paragraphStyle:paragraph.copy(),.foregroundColor:NSColor.red])
 let first=verify(cache,source,contexts[0]),beforeReuse=decorations
 for _ in 0..<50 {
  let output=verify(cache,source,contexts[0])
  precondition(output[0].attributedText===first[0].attributedText)
 }
 _=verify(cache,NSAttributedString(attributedString:source),contexts[0])
 precondition(decorations==beforeReuse,"Repeated preparation redecorated")
 // Replacing a style invalidates the full-attribute snapshot without changing
 // text; immutable styles retain the old value in the previous preparation.
 paragraph.lineSpacing=9
 source.addAttribute(.paragraphStyle,value:paragraph.copy(),range:NSRange(location:0,length:source.length))
 let changedStyle=verify(cache,source,contexts[0])
 precondition(decorations==beforeReuse+1,"Changed paragraph style must miss the cache")
 precondition((first[0].attributedText.attribute(.paragraphStyle,at:0,effectiveRange:nil) as! NSParagraphStyle).lineSpacing==3,"Original preparation retains its paragraph style snapshot")
 precondition((changedStyle[0].attributedText.attribute(.paragraphStyle,at:0,effectiveRange:nil) as! NSParagraphStyle).lineSpacing==9)
 source.addAttribute(.backgroundColor,value:NSColor.yellow,range:NSRange(location:0,length:4));_=verify(cache,source,contexts[0])
 source.addAttribute(.font,value:regular,range:NSRange(location:0,length:source.length));_=verify(cache,source,contexts[0])
 source.addAttribute(.link,value:URL(string:"https://example.test/source")!,range:NSRange(location:0,length:3));_=verify(cache,source,contexts[0])
 source.replaceCharacters(in:NSRange(location:0,length:3),with:"A revised");_=verify(cache,source,contexts[0])
 precondition(decorations==beforeReuse+5,"Full text/theme/highlight/link attributes must invalidate")
 // Exercise actual mutable objects, including Foundation's dictionary interning:
 // a shallow/copied attributed snapshot must never create a false cache hit.
 let mutableParagraph=NSMutableParagraphStyle();mutableParagraph.lineSpacing=123.456
 let mutableStyleText=NSAttributedString(string:"wall",attributes:[.paragraphStyle:mutableParagraph,.font:italic])
 let retainedMutableStyle=mutableStyleText.attribute(.paragraphStyle,at:0,effectiveRange:nil) as! NSMutableParagraphStyle
 _=verify(cache,mutableStyleText,contexts[0]);precondition(cache.source==nil && cache.prepared==nil)
 let beforeStyleMutation=decorations;retainedMutableStyle.lineSpacing=321.654
 _=verify(cache,mutableStyleText,contexts[0]);precondition(decorations==beforeStyleMutation+1 && cache.source==nil)
 let shadow=NSShadow();shadow.shadowBlurRadius=1
 let mutableLabel=NSMutableString(string:"first")
 let extra=NSMutableAttributedString(string:"wall",attributes:[.font:italic,.shadow:shadow,NSAttributedString.Key("fixture-label"):mutableLabel])
 _=verify(cache,extra,contexts[0]);let beforeMutable=decorations
 shadow.shadowBlurRadius=8;_=verify(cache,extra,contexts[0]);precondition(decorations==beforeMutable+1)
 mutableLabel.setString("changed");_=verify(cache,extra,contexts[0]);precondition(decorations==beforeMutable+2)
 // Context identity includes edition, code, chapter text/ID and section; no
 // definition choice can survive switching PC202, MC101 or BC101.
 let scopeText=NSAttributedString(string:"fixture building equipment wall",attributes:[.font:italic])
 for c in contexts { let before=decorations;_=verify(cache,scopeText,c);precondition(decorations==before+1) }
 let base=contexts[2]
 let variants=[
  ReaderDefinitionContext(versionFileName:"new-york-city/2014-construction-codes/fixture",codeSectionID:base.codeSectionID,chapterNumber:base.chapterNumber,chapterID:base.chapterID,sectionNumber:base.sectionNumber),
  ReaderDefinitionContext(versionFileName:"new-york-city/2022-construction-codes/fixture",codeSectionID:base.codeSectionID+1,chapterNumber:base.chapterNumber,chapterID:base.chapterID,sectionNumber:base.sectionNumber),
  ReaderDefinitionContext(versionFileName:"new-york-city/2022-construction-codes/fixture",codeSectionID:base.codeSectionID,chapterNumber:"2",chapterID:base.chapterID,sectionNumber:base.sectionNumber),
  ReaderDefinitionContext(versionFileName:"new-york-city/2022-construction-codes/fixture",codeSectionID:base.codeSectionID,chapterNumber:base.chapterNumber,chapterID:999,sectionNumber:base.sectionNumber),
  ReaderDefinitionContext(versionFileName:"new-york-city/2022-construction-codes/fixture",codeSectionID:base.codeSectionID,chapterNumber:base.chapterNumber,chapterID:base.chapterID,sectionNumber:"102")]
 for c in variants { _=verify(cache,scopeText,base);let before=decorations;_=verify(cache,scopeText,c);precondition(decorations==before+1) }
 let beforeNil=decorations;_=verify(cache,scopeText,nil);precondition(decorations==beforeNil)
 precondition(cache.context==nil && cache.prepared?.count==1)
 let beforeReturn=decorations;_=verify(cache,scopeText,base);precondition(decorations==beforeReturn+1,"Only one entry may be retained")
 // Do not retain mutable attachment/custom-object graphs or oversized imports.
 let attachment=NSTextAttachment()
 let attached=NSAttributedString(attachment:attachment)
 let custom=NSAttributedString(string:"wall",attributes:[NSAttributedString.Key("custom"):NSObject()])
 let customValue=NSAttributedString(string:"wall",attributes:[NSAttributedString.Key("custom-value"):NSValue(point:NSPoint(x:1,y:2))])
 let oversized=NSAttributedString(string:String(repeating:"x",count:128*1024+1))
 for value in [attached,custom,customValue,oversized] {
  let before=decorations;_=verify(cache,value,base);_=verify(cache,value,base)
  precondition(decorations==before+2 && cache.source==nil && cache.prepared==nil)
 }
 for phrase in ["","\n","\r\n","a\nb\n","a\r\nb\r\n","a\u{2028}b\u{2029}🧱","🧱 cafe\u{301}"] {
  let value=NSMutableAttributedString(string:phrase,attributes:[.font:italic,.foregroundColor:NSColor.red,.underlineStyle:1])
  if value.length>1 {value.addAttribute(.backgroundColor,value:NSColor.yellow,range:NSRange(location:1,length:1))}
  for c in contexts { _=verify(cache,value,c) }
 }
 // Concrete count and timing evidence using the actual matcher and old splitter.
 let timingContext=contexts[2],timingCache=ReaderAttributedTextPreparationCache()
 let text=NSAttributedString(string:String(repeating:"A building wall and equipment shall comply.\n",count:80),attributes:[.font:italic])
 _=verify(timingCache,text,timingContext)
 let before=decorations,iterations=150
 var checksum=0
 let oldStart=Date()
 for _ in 0..<iterations { checksum += LegacySplitter.blocks(for:matcher(timingContext).decorating(text))[0].attributedText.length }
 let oldTime=Date().timeIntervalSince(oldStart)*1000
 let newStart=Date()
 for _ in 0..<iterations { checksum += timingCache.blocks(for:text,context:timingContext,decorate:decorate)[0].attributedText.length }
 let newTime=Date().timeIntervalSince(newStart)*1000
 precondition(decorations==before)
 print("PASS: \(checks) actual attributed parity checks; 50 repeated updates require zero decoration; full mutable text/attribute/context invalidation, PC202/MC101/BC101, single-entry+length bounds, attachment/custom bypass")
 print("HOST ONLY: \(iterations) repeated preparations; baseline decoration+paragraph splitting=\(oldTime)ms cached=\(newTime)ms checksum=\(checksum)")
 }
}
`;
const dir=await mkdtemp(join(tmpdir(),'permitext-reader-preparation-'));
try {
 await writeFile(join(dir,'verify.swift'),`import Foundation\nimport AppKit\n${context}\n${models}\n${host(matcher)}\n${host(preparation)}\nenum LegacySplitter {\n${previousSplitter}\n}\n${harness.replaceAll('precondition(', 'check(')}`);
 execFileSync('xcrun',['swiftc','-swift-version','6','-strict-concurrency=complete','-O','-parse-as-library',join(dir,'verify.swift'),'-o',join(dir,'verify')],{stdio:'inherit'});
 execFileSync(join(dir,'verify'),[registryPath],{stdio:'inherit'});
} finally {await rm(dir,{recursive:true,force:true});}
