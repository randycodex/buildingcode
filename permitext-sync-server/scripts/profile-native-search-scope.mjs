// Host-only optimized Swift: actual extracted native matching/snippet functions.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const dir=await mkdtemp(join(tmpdir(),'permitext-scope-'));
function extract(text,signature){const start=text.indexOf(signature);assert.ok(start>=0,signature);let depth=1;const open=text.indexOf('{',start);for(let end=open+1;end<text.length;end++){if(text[end]==='{')depth++;if(text[end]==='}'&&--depth===0)return text.slice(start,end+1);}throw Error(signature);}
try {
 const source=await readFile(join(root,'NYC CC APP/permitext/Data/AuthoredCodeStore.swift'),'utf8');
 const parity=await readFile(new URL('../tests/native-search-corpus-parity-contract.mjs',import.meta.url),'utf8');
 const textStoreSource=await readFile(join(root,'NYC CC APP/permitext/Data/SearchTextStore.swift'),'utf8');
 const replacements={titleExtension:extract(await readFile(join(root,'NYC CC APP/permitext/Models/CodeModels.swift'),'utf8'),'    var titleThroughFirstPeriod: String'),searchTextMethod:extract(source,'    private func searchOfficialText('),baselineSearch:'',currentSearch:extract(source,'    func search(').split('\n').filter(l=>!l.includes('OSSignpostID')&&!l.includes('os_signpost(')).join('\n'),tokenize:extract(source,'    private static func tokenize('),snippet:extract(source,'    private static func snippet(')};
 let harness=parity.slice(parity.indexOf(' const swift = `')+' const swift = `'.length,parity.indexOf('@main struct Run'));
 harness=harness.replace(/\$\{(\w+)\}/g,(_,name)=>{assert.ok(name in replacements,name);return replacements[name];}).replaceAll('\\\\n','\\n');
 harness=harness.replace('func officialText(for indexed: IndexedSection) -> String { indexed.section.text }','func officialText(for indexed: IndexedSection) -> String { fatalError("Invalid prepared text pack: benchmark forbids fallback") }');
 const main=`
@main struct Run {
 static func main() throws {
  let start=ProcessInfo.processInfo.systemUptime
  let editions=try JSONDecoder().decode([Edition].self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1])))
  let harnesses=try editions.map { try Harness($0) }
  for h in harnesses { require(h.searchTextStore.revision != nil,"Invalid text pack") }
  let prepared=ProcessInfo.processInfo.systemUptime
  let first=harnesses.map { $0.search(query:"concrete",includeSnippets:true,resultLimit:nil) }
  let firstEnd=ProcessInfo.processInfo.systemUptime
  let repeated=harnesses.map { $0.search(query:"concrete",includeSnippets:true,resultLimit:nil) }
  let end=ProcessInfo.processInfo.systemUptime
  require(first == repeated,"Repeated results changed")
  let ids=Dictionary(uniqueKeysWithValues:zip(editions,first).map { ($0.0.name,$0.1.map(\\.id)) })
  let result:[String:Any]=["preparationMS":(prepared-start)*1000,"firstQueryMS":(firstEnd-prepared)*1000,"repeatedQueryMS":(end-firstEnd)*1000,"orderedIDs":ids]
  print(String(decoding:try JSONSerialization.data(withJSONObject:result,options:[.sortedKeys]),as:UTF8.self))
 }
}
`;
 await writeFile(join(dir,'benchmark.swift'),harness+main+'\n'+textStoreSource);
 execFileSync('xcrun',['swiftc','-O','-parse-as-library',join(dir,'benchmark.swift'),'-o',join(dir,'benchmark')],{timeout:120000,stdio:'pipe'});
 execFileSync('python3',['-c',`
import importlib.util,json,pathlib,sys
root=pathlib.Path(sys.argv[1]);spec=importlib.util.spec_from_file_location('pack',root/'Tools/permitext_search_text_pack.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
editions=[]
for edition in sorted((root/'NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city').iterdir()):
 if not (edition/'prepared/chapterCatalog.json').exists():continue
 sections=[]
 for chapter in m.edition_input(edition)['chapters']:
  for s in chapter['sections']:sections.append(dict(id=s['id'],sectionNumber=s['sectionNumber'],title=s['title'],kind=s['kind'],chapterNumber=chapter['chapterNumber'],codeSectionID=chapter.get('codeSectionID'),text=''))
 editions.append(dict(name=edition.name,path=str(edition),sections=sections))
pathlib.Path(sys.argv[2]).write_text(json.dumps(editions))
`,root,join(dir,'all.json')],{timeout:120000});
 const editions=JSON.parse(await readFile(join(dir,'all.json'),'utf8'));assert.equal(editions.length,6);
 await writeFile(join(dir,'primary.json'),JSON.stringify(editions.filter(e=>['2022-construction-codes','2014-construction-codes'].includes(e.name))));
 const runs=[];
 for(let sample=1;sample<=3;sample++) for(const scope of sample%2?['all','primary']:['primary','all']){
  const result=JSON.parse(execFileSync(join(dir,'benchmark'),[join(dir,scope+'.json')],{encoding:'utf8',timeout:120000}));runs.push({sample,scope,...result});
 }
 const oracle=runs.find(r=>r.scope==='all').orderedIDs;
 for(const run of runs)for(const [edition,ids] of Object.entries(run.orderedIDs))assert.deepEqual(ids,oracle[edition],edition+' ordered IDs differ');
 const output={schemaVersion:1,query:'concrete',samplesPerScope:3,optimization:'swiftc -O',scope:'Fresh host processes; actual extracted AuthoredCodeStore search/tokenize/snippet and full SearchTextStore. Harness prepares section metadata and token sets, not full AuthoredCodeStore initializer. No native UI, background warmup, persisted result cache or app timing. OS file cache not cleared.',orderedIDParity:true,runs};
 const outputPath=join(root,'docs/performance/PERF_17_HOST_SEARCH_SCOPE.json');await mkdir(join(root,'docs/performance'),{recursive:true});await writeFile(outputPath,JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify(runs.map(({orderedIDs,...r})=>({...r,counts:Object.fromEntries(Object.entries(orderedIDs).map(([k,v])=>[k,v.length]))})),null,2));
}finally{await rm(dir,{recursive:true,force:true});}
