import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const source = await readFile(join(root, 'NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift'), 'utf8');
function extract(signature) {
 const start=source.indexOf(signature); assert.ok(start>=0);
 const open=source.indexOf('{',start); let depth=1;
 for(let i=open+1;i<source.length;i++) { if(source[i]==='{') depth++; if(source[i]==='}'&&--depth===0) return source.slice(start,i+1); }
 throw Error(signature);
}
const temp=await mkdtemp(join(tmpdir(),'permitext-source-options-'));
try {
 await writeFile(join(temp,'main.swift'), `import Foundation
struct Version: Sendable { let fileName:String; let codeVersion:String; let contentKind:Kind }
enum Kind: Sendable { case authored, sqlite }
struct Category: Sendable { let id:Int64; let name:String }
enum NativeReaderEditionLabel { static func label(for version:String)->String { version } }
@MainActor final class Harness {
 var availableVersions:[Version]=[]
 var browseCategoryMetadata:[String:[Category]]=[:]
 nonisolated static func searchCategoryMetadata(version:Version) throws -> [Category] {
   if version.fileName == "failure" { throw CocoaError(.fileReadCorruptFile) }
   return [Category(id:4,name:"fresh")]
 }
 nonisolated static func activeSourceIdentity(version:Version, category:Category)->ActiveCodeSourceIdentity? {
  .init(canonicalEdition:version.codeVersion,jurisdictionID:1,codeID:1,categoryID:category.id)
 }
 static func displayName(forCodeSectionName value:String)->String { value }
 ${extract('    struct ActiveCodeSourceOption:')}
 ${extract('    func activeCodeSourceOptions()')}
}
@main struct Run {
 @MainActor static func main() async throws {
  let h=Harness()
  h.availableVersions=[.init(fileName:"2022",codeVersion:"2022",contentKind:.authored),.init(fileName:"1968",codeVersion:"admin",contentKind:.authored),.init(fileName:"legacy",codeVersion:"legacy",contentKind:.sqlite)]
  h.browseCategoryMetadata["2022"]=[.init(id:4,name:"cached fuel gas")]
  let options=try await h.activeCodeSourceOptions()
  precondition(options.count==2 && options[0].categoryLabel=="cached fuel gas")
  precondition(options[0].id != options[1].id && options[1].id.canonicalEdition=="admin")
  precondition(h.browseCategoryMetadata["1968"]?.first?.name=="fresh")
  h.availableVersions=[.init(fileName:"failure",codeVersion:"bad",contentKind:.authored)]
  do { _=try await h.activeCodeSourceOptions(); preconditionFailure("must expose corrupt metadata") } catch {}
  precondition(h.browseCategoryMetadata["failure"]==nil)
  h.availableVersions=[]
  let empty=try await h.activeCodeSourceOptions(); precondition(empty.isEmpty)
  print("Source options passed: exact category identity, cached metadata reuse, legacy exclusion, corrupt metadata rejection and empty catalog.")
 }
}
`);
 const binary=join(temp,'options');
 execFileSync('swiftc',['-parse-as-library',join(root,'NYC CC APP/permitext/Models/ActiveCodeSources.swift'),join(temp,'main.swift'),'-o',binary],{stdio:'inherit'});
 process.stdout.write(execFileSync(binary,[],{encoding:'utf8'}));
} finally { await rm(temp,{recursive:true,force:true}); }
