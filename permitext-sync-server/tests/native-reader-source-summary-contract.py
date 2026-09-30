#!/usr/bin/env python3
"""Execute the persisted Reader label identity guard without loading a corpus."""
from pathlib import Path
import subprocess
import tempfile
root = Path(__file__).resolve().parents[2]
source = (root / 'NYC CC APP/permitext/Models/BrowserContext.swift').read_text()
start = source.index('struct RememberedReaderSource:')
end = source.index('\nextension BrowserContextID {', start)
fixture = '''
let remembered = RememberedReaderSource(source: "Mechanical Code · 2022", versionFileName: "2022.json", codeSectionID: 3)
assert(remembered.matches(version: "2022.json", sectionID: 3))
assert(!remembered.matches(version: "2014.json", sectionID: 3))
assert(!remembered.matches(version: "2022.json", sectionID: 4))
assert(!remembered.matches(version: nil, sectionID: 3))
assert(!remembered.matches(version: "2022.json", sectionID: nil))
let decoded = try JSONDecoder().decode(RememberedReaderSource.self, from: JSONEncoder().encode(remembered))
assert(decoded == remembered)
assert(!RememberedReaderSource(source: "", versionFileName: "2022.json", codeSectionID: 3).matches(version: "2022.json", sectionID: 3))
let all = RememberedReaderSource(source: "All Sections · 2022", versionFileName: "2022.json", codeSectionID: nil)
assert(all.matches(version: "2022.json", sectionID: nil))
print("Reader source summary: 8 identity/round-trip checks passed")
'''
with tempfile.TemporaryDirectory() as directory:
    path = Path(directory) / 'main.swift'
    path.write_text('import Foundation\n' + source[start:end] + fixture)
    subprocess.run(['swift', str(path)], check=True)
