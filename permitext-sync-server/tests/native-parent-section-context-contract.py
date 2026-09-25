#!/usr/bin/env python3
"""Run production parent-context resolution against real authored chapter groups."""
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / 'NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city'
source = (ROOT / 'NYC CC APP/permitext/Data/AuthoredCodeStore.swift').read_text()
method = source[source.index('    private func parentSectionLabels('):source.index('    func sectionDetail(')]
method = method.replace('private func parentSectionLabels', 'func parentSectionLabels', 1)
fixtures = []

def fixture(edition, chapter, number, parents, section_id=None):
    data = json.loads((CORPUS / edition / 'prepared/chapters' / f'{chapter}.json').read_text())
    group = next(g for g in data['groups'] if any(
        s['sectionNumber'].strip('. ') == number and (section_id is None or s['id'] == section_id)
        for s in g['sections']))
    target = next(s for s in group['sections'] if s['sectionNumber'].strip('. ') == number
                  and (section_id is None or s['id'] == section_id))
    fixtures.append(dict(group=group, targetID=target['id'], parents=parents,
                         label=f'{edition}/{chapter}/{number}'))

fixture('2014-construction-codes', 40000009, '403.2.3.3', ['403.2', '403.2.3'])
fixture('2014-construction-codes', 40000009, '402.1', [])
fixture('2014-construction-codes', 40000110, 'G.2.4.1', ['G.2', 'G.2.4'])
fixture('2022-construction-codes', 16, '1.1', ['1607.6'], 3481)
fixture('2022-construction-codes', 16, '1.2', ['1607.6'])
fixture('2026-existing-building-code', 25000008, '803', [])
fixture('2026-existing-building-code', 25000025, 'D503', [])

swift = r'''
import Foundation
struct Section: Decodable { let id: Int64; let sectionNumber: String; let title: String }
struct Group: Decodable { let id: String; let headerLine: String; let headingLine: String?; let sections: [Section] }
struct Chapter { let id: Int64 }
struct IndexedSection { let chapter: Chapter; let group: Group; let section: Section }
// Isolate ancestry from title formatting. Returned labels expose exact numbers.
extension String { func displayTitle(for number: String) -> String { "" } }
struct Fixture: Decodable { let group: Group; let targetID: Int64; let parents: [String]; let label: String }
struct Harness { let groupsByChapterID: [Int64: [Group]]
''' + method + r'''
}
let fixtures = try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
for fixture in fixtures {
 let target = fixture.group.sections.first { $0.id == fixture.targetID }!
 let actual = Harness(groupsByChapterID: [1: [fixture.group]]).parentSectionLabels(
  for: IndexedSection(chapter: Chapter(id: 1), group: fixture.group, section: target))
 let expected = fixture.parents.map { $0 + " " }
 precondition(actual == expected, "\(fixture.label): expected \(expected), got \(actual)")
}
print("Production parent-context checks passed: \(fixtures.count)")
'''
with tempfile.TemporaryDirectory(prefix='permitext-parent-context-') as directory:
    temporary = Path(directory)
    (temporary / 'main.swift').write_text(swift)
    (temporary / 'fixtures.json').write_text(json.dumps(fixtures))
    subprocess.run(['swift', str(temporary / 'main.swift'), str(temporary / 'fixtures.json')], check=True)
