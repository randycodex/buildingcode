import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const path='NYC CC APP/permitext/Views/AttributedTextView.swift';
const source=await readFile(join(root,path),'utf8');
// Pinned pre-optimization production implementation, not a second hand-written algorithm.
const baseline=await readFile(new URL('./fixtures/reader-definition-matcher-ac78d8287.swift',import.meta.url),'utf8');
const extract=s=>{ const start=s.indexOf('final class ReaderDefinitionMatcher {'); const end=s.indexOf('@MainActor\nfinal class ReaderDefinitionStore'); return s.slice(start,end<0?undefined:end); };
const models=source.slice(source.indexOf('struct ReaderDefinitionEntry:'),source.indexOf('final class ReaderDefinitionMatcher {'));
const context=source.slice(source.indexOf('struct ReaderDefinitionContext: Hashable'),source.indexOf('private struct ReaderDefinitionContextKey:'));
// AppKit supplies real Foundation attributed strings and font traits on this host.
// UIKit-specific font/color names only are mapped; production matching code stays intact.
const host=s=>s.replaceAll('UIFont','NSFont').replaceAll('.traitItalic','.italic').replaceAll('UIColor.secondaryLabel','NSColor.secondaryLabelColor');
const harness=String.raw`
@main struct Verify {
 static func main() throws {
 let regular=NSFont.systemFont(ofSize:14)
 let italic=NSFontManager.shared.convert(regular,toHaveTrait:.italicFontMask)
 let src=ReaderDefinitionEntry.Source(file:"fixture",anchor:"a",sectionNumber:"2",chapter:"2",code:"BUILDING CODE",bundle:"2022-construction-codes")
 func entry(_ id:String,_ term:String,_ aliases:[String]=[],_ requires:Bool?=nil,_ exclusions:[ReaderDefinitionEntry.OccurrenceExclusion]?=nil)->ReaderDefinitionEntry {
  ReaderDefinitionEntry(id:id,term:term,aliases:aliases,text:"Definition",resolution:"resolved",applicability:"definition-chapter",requiresItalic:requires,excludedOccurrences:exclusions,source:src)
 }
 let rule=ReaderDefinitionEntry.OccurrenceExclusion(section:"1602",phrases:[.init(text:"wall and wall",occurrence:1),.init(text:"wall",occurrence:-1),.init(text:"",occurrence:2)])
 let entries=[entry("wall","wall",["walls"]),entry("wall-italic","wall",[],true,[rule]),entry("concrete","concrete wall",["concrete walls"]),entry("emoji","🧱 wall"),entry("unicode","café",["cafe\u{301}","Straße","K","İ"]),entry("punct","a+b",["(wall)"]),entry("duplicate","wall",[],nil,[rule]),entry("duplicate","walls",[],nil,[])]
 var checked=0
 func compare(_ original:NSAttributedString,_ old:BaselineReaderDefinitionMatcher,_ new:ReaderDefinitionMatcher) {
  let a=old.decorating(original),b=new.decorating(original)
  precondition(a.isEqual(to:b),"Attributed parity failed: \(original.string)")
  checked += 1
 }
 let phrases=["", "Nothing matches xyz.","wall", "wall and wall", "CONCRETE\nWALL and walls", "🧱 wall café cafe\u{301} Straße STRASSE K K İ i", "a+b (wall) firewall wall_2 2wall wall2", "The term “wall” means wall.", " Intro. The term \"wall\" shall mean wall.", "wall § 28-1602 Definitions. wall", "§ A1602.1 Definitions. concrete wall", "wall\nThe term “wall” means wall.", "wall and **§ 1602 Definitions. wall", "The term \"wall\" meaning wall"]
 for section:String? in [nil,"1602","1602.1","16020"," 1602 "] {
  let old=BaselineReaderDefinitionMatcher(entries:entries,sectionNumber:section),new=ReaderDefinitionMatcher(entries:entries,sectionNumber:section)
  for phrase in phrases { for variant in 0..<6 {
   let text=NSMutableAttributedString(string:phrase,attributes:[.font:variant%2==0 ? regular:italic,.underlineStyle:1,.foregroundColor:NSColor.red])
   if text.length>1 {
    if variant==2 { text.addAttribute(.link,value:URL(string:"https://example.com")!,range:NSRange(location:1,length:1)) }
    if variant==3 { text.removeAttribute(.font,range:NSRange(location:0,length:1)) }
    if variant==4 { text.addAttribute(.font,value:italic,range:NSRange(location:0,length:text.length/2)) }
    if variant==5 { text.addAttribute(.link,value:URL(string:"permitext-definition://entry/existing")!,range:NSRange(location:0,length:text.length)) }
   }
   compare(text,old,new)
  }}
 }
 let registry=try JSONDecoder().decode(ReaderDefinitionRegistry.self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1])))
 for book in registry.books {
  let old=BaselineReaderDefinitionMatcher(entries:book.entries,sectionNumber:"1602.1"),new=ReaderDefinitionMatcher(entries:book.entries,sectionNumber:"1602.1")
  for entry in book.entries {
   let phrase="🧱 \(entry.term); \(entry.aliases.joined(separator:" and ")). \(entry.term.uppercased())"
   compare(NSAttributedString(string:phrase,attributes:[.font:italic]),old,new)
  }
 }
 let chapterTexts = try JSONDecoder().decode([String:[String]].self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[2])))
 let building=registry.books.first { $0.bundle=="2022-construction-codes" && $0.entries.contains { $0.source.code.uppercased()=="BUILDING CODE" } }!
 for chapter in ["16","33"] {
  let context=ReaderDefinitionContext(versionFileName:"new-york-city/2022-construction-codes/fixture",codeSectionID:building.codeSectionID,chapterNumber:chapter,chapterID:Int64(chapter),sectionNumber:nil)
  let selected=registry.entries(for:context)
  let old=BaselineReaderDefinitionMatcher(entries:selected),new=ReaderDefinitionMatcher(entries:selected)
  let blocks=chapterTexts[chapter]!.map { NSAttributedString(string:$0,attributes:[.font:italic]) }
  for block in blocks { compare(block,old,new) }
  var legacy:[Double]=[],candidate:[Double]=[]
  var checksum=0
  for run in 0..<6 {
   func measure(_ candidateRun:Bool)->Double {
    let start=Date()
    for block in blocks { checksum += (candidateRun ? new.decorating(block) : old.decorating(block)).length }
    return Date().timeIntervalSince(start)*1000
   }
   let first=measure(run%2==0),second=measure(run%2 != 0)
   if run>0 { candidate.append(run%2==0 ? first:second);legacy.append(run%2==0 ? second:first) }
  }
  print("HOST ONLY Chapter \(chapter): HTML text blocks=\(blocks.count) entries=\(selected.count), 5 alternating passes after warmup baselineMs=\(legacy) candidateMs=\(candidate) checksum=\(checksum)")
 }
 let empty=ReaderDefinitionMatcher(entries:[])
 let none=NSAttributedString(string:"zzzzzz",attributes:[.font:regular])
 precondition(empty.decorating(none)===none)
 let normal=ReaderDefinitionMatcher(entries:entries)
 precondition(normal.decorating(none)===none)
 let linked=NSAttributedString(string:"wall",attributes:[.link:URL(string:"https://example.com")!])
 precondition(normal.decorating(linked)===linked)
 print("PASS: \(checked) exact attributed-output comparisons, real registry aliases, Unicode/UTF16, suppression, links, fonts, occurrence exclusions and duplicate IDs; unchanged output reuses input")
 }
}
`;
assert.ok(extract(source).includes('func decorating'));
const dir=await mkdtemp(join(tmpdir(),'permitext-definition-decoration-'));
await writeFile(join(dir,'verify.swift'),`import Foundation\nimport AppKit\n${context}\n${models}\n${host(extract(baseline)).replaceAll('ReaderDefinitionMatcher','BaselineReaderDefinitionMatcher')}\n${host(extract(source))}\n${harness}`);
execFileSync('xcrun',['swiftc','-O','-parse-as-library',join(dir,'verify.swift'),'-o',join(dir,'verify')],{stdio:'inherit'});
const corpus=execFileSync('python3',['-c',String.raw`
import json,sys
from html.parser import HTMLParser
from pathlib import Path
class Blocks(HTMLParser):
 def __init__(self): super().__init__(); self.blocks=[]; self.parts=[]; self.hidden=0
 def flush(self):
  text=''.join(self.parts).strip(); self.parts=[]
  if text: self.blocks.append(text)
 def handle_starttag(self,tag,attrs):
  if tag in ('script','style'): self.hidden+=1
  if tag in ('div','p','li','tr','h1','h2','h3','h4','br'): self.flush()
 def handle_endtag(self,tag):
  if tag in ('script','style'): self.hidden=max(0,self.hidden-1)
  if tag in ('div','p','li','tr','h1','h2','h3','h4'): self.flush()
 def handle_data(self,data):
  if not self.hidden: self.parts.append(data)
result={}
for chapter in ('16','33'):
 p=Blocks(); p.feed((Path(sys.argv[1])/f'{chapter}.html').read_text());p.flush();result[chapter]=p.blocks
print(json.dumps(result))
`,join(root,'NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2022-construction-codes/code-sections/building-code/chapters')],{encoding:'utf8',maxBuffer:10*1024*1024});
await writeFile(join(dir,'corpus.json'),corpus);
execFileSync(join(dir,'verify'),[join(root,'NYC CC APP/permitext/Resources/CodeContent/reader-definition-registry.json'),join(dir,'corpus.json')],{stdio:'inherit'});
