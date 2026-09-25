#!/usr/bin/env python3
"""Exercise the model's actual memory-warning routing without iOS/simulator."""
from pathlib import Path
import subprocess
import tempfile
root = Path(__file__).resolve().parents[2]
source = (root / 'NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift').read_text()
method = source.split('    func handleMemoryWarning() {', 1)[1].split('    private static func formattedTextCacheKey', 1)[0]
method = '    func handleMemoryWarning() {' + method
method = '\n'.join(line for line in method.splitlines() if 'os_signpost(' not in line)
harness = '''import Foundation
final class Store { var purges = 0; func purgeRecreatableCaches() { purges += 1 } }
final class Cache { var purges = 0; func removeAllObjects() { purges += 1 } }
final class Model {
 var authoredCodeStore: Store?
 var allEditionSearchStores: [String:Store] = [:]
 let sectionDetailCache = Cache(), formattedNSTextCache = Cache(), chapterBodyNSTextCache = Cache()
 var warmedChapterIDs: Set<Int> = [1,2]
 var suspended = 0
 var displayedContent = "preserve current passage"
 var savedEvidence = [1,2,3]
 func suspendReaderWarmups() { suspended += 1 }
METHOD
}
let model = Model(), current = Store(), historical = Store()
model.authoredCodeStore = current
model.allEditionSearchStores = ["current":current,"alias":current,"historical":historical]
model.handleMemoryWarning()
precondition(current.purges == 1 && historical.purges == 1)
precondition(model.suspended == 1 && model.warmedChapterIDs.isEmpty)
precondition(model.sectionDetailCache.purges == 1 && model.formattedNSTextCache.purges == 1 && model.chapterBodyNSTextCache.purges == 1)
precondition(model.authoredCodeStore === current && model.allEditionSearchStores.count == 3)
precondition(model.displayedContent == "preserve current passage" && model.savedEvidence == [1,2,3])
model.authoredCodeStore = nil
model.allEditionSearchStores = [:]
model.handleMemoryWarning()
precondition(current.purges == 1 && historical.purges == 1 && model.suspended == 2)
print("PASS: memory warning reaches all unique authored stores and retains current/durable state")
'''.replace('METHOD', method)
with tempfile.TemporaryDirectory(prefix='permitext-memory-purge-') as directory:
 path=Path(directory)/'main.swift'; binary=Path(directory)/'test'
 path.write_text(harness)
 subprocess.run(['swiftc',str(path),'-o',str(binary)],check=True,timeout=60)
 subprocess.run([str(binary)],check=True,timeout=30)
