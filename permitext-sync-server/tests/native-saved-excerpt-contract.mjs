import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const store=await readFile(new URL('../../NYC CC APP/permitext/Data/AuthoredCodeStore.swift',import.meta.url),'utf8');
const models=await readFile(new URL('../../NYC CC APP/permitext/Models/CodeModels.swift',import.meta.url),'utf8');
function functionSource(source,name) { const start=source.indexOf(`    ${name}`); const end=source.indexOf('\n    }',start); assert.ok(start>=0&&end>start); return source.slice(start,end+6); }
const saved=store.slice(store.indexOf('    func savedSections('),store.indexOf('    private func sectionLabel(',store.indexOf('    func savedSections(')));
const textHelper=functionSource(store,'private func searchOfficialText(');
const excerpt=functionSource(models,'func evidenceExcerpt(');
const display=functionSource(models,'func displayTitle(');
const dir=await mkdtemp(join(tmpdir(),'permitext-saved-excerpt-'));
await writeFile(join(dir,'main.swift'),`import Foundation
extension String {
${excerpt}
${display}
${functionSource(models, "var titleThroughFirstPeriod")}
}
struct Block { let id:String; let tableID:String?; let imageID:String?; let caption:String?; let plainText:String? }
struct Section { let id:Int64; let sectionNumber:String; let title:String; let kind:String; let contentBlocks:[Block] }
struct Chapter { let codeSectionID:Int64?; let chapterNumber:String; let title:String }
struct IndexedSection { let section:Section; let chapter:Chapter }
struct UserAnnotationEntry { let sectionID:Int64; let blockID:String; let tags:[String]; let noteBody:String }
struct BookmarkedSection:Equatable {
 let id:Int64
 var annotationBlockID:String = ""
 var annotationLabel:String = ""
 let codeVersion:String; let codeSectionID:Int64?; let codeSectionName:String
 let chapterNumber:String; let chapterTitle:String; let sectionNumber:String; let title:String
 let previewText:String; let kind:String; let isBookmarked:Bool; let noteBody:String; let tags:[String]; let bookmarkedAt:Date?
 var rowID:String { "\\(codeVersion):\\(id):\\(annotationBlockID)" }
}
final class TextStore { var values:[Int64:String]=[:]; func text(sectionID:Int64)->String? { values[sectionID] } }
final class Store {
 let searchTextStore=TextStore(); var fallbacks=0
 var sectionIndex:[Int64:IndexedSection]=[:]; var codeSectionNameByID:[Int64:String]=[1:"Building Code"]
 var canonical:[Int64:String]=[:]
 func officialText(for indexed:IndexedSection)->String { fallbacks += 1; return canonical[indexed.section.id]! }
 ${textHelper}
 ${saved}
}
let store=Store()
store.sectionIndex[1] = IndexedSection(section:Section(id:1,sectionNumber:"722.2.4",title:"Concrete columns",kind:"section",contentBlocks:[Block(id:"table-1",tableID:"table-1",imageID:nil,caption:"Fire resistance",plainText:nil)]),chapter:Chapter(codeSectionID:1,chapterNumber:"7",title:"Fire"))
store.canonical[1]="722.2.4 Concrete columns\\nFire resistance\\nWidth 8 10 12\\nRating 1 2 3 hours"
let annotation=UserAnnotationEntry(sectionID:1,blockID:"table-1",tags:["review"],noteBody:"Owner note")
func rows(_ version:String)->[BookmarkedSection] { store.savedSections(ids:[1],codeVersion:version,bookmarkedSectionIDs:[1],notesBySectionID:[1:"Section note"],tagsBySectionID:[1:["tag"]],annotationEntries:[annotation],bookmarkCreatedAtBySectionID:[1:Date(timeIntervalSince1970:123)]) }
for version in ["2014","2022"] {
 store.searchTextStore.values=[:]
 let reference=rows(version)
 precondition(store.fallbacks>0 && reference.count==2)
 store.searchTextStore.values=store.canonical; store.fallbacks=0
 let packed=rows(version)
 precondition(packed==reference && store.fallbacks==0)
 precondition(packed[1].annotationBlockID=="table-1" && packed[1].annotationLabel=="Fire resistance")
 precondition(packed[1].noteBody=="Owner note" && packed[1].tags==["review"])
}
print("Saved production rows: canonical pack and authoritative fallback identical across editions, table annotation, notes, tags, dates and citations")
`);
execFileSync('xcrun',['swiftc',join(dir,'main.swift'),'-o',join(dir,'verify')],{stdio:'inherit'});
execFileSync(join(dir,'verify'),[],{stdio:'inherit'});
