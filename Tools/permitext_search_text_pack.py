#!/usr/bin/env python3
"""Generate/check immutable mapped search text using the app's exact Swift resolver.

--check verifies source revisions and output digests without compiling Swift.
--verify also regenerates every section and proves byte-for-byte reproducibility.
Run without either flag after changing authored content or text resolution helpers.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / 'NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city'
STORE = ROOT / 'NYC CC APP/permitext/Data/AuthoredCodeStore.swift'
MODELS = ROOT / 'NYC CC APP/permitext/Models/CodeModels.swift'
OUTPUT_NAMES = ('searchTextManifest.json', 'searchTextIndex.json', 'searchText.utf8')


def between(text, start, end):
    return text[text.index(start):text.index(end, text.index(start))]


def swift_source():
    source = STORE.read_text()
    models = MODELS.read_text()
    methods = between(source, '    private func resolvedOfficialText(', '    private func contentBlocksEnriched')
    methods += between(source, '    private func plainText(from contentBlocks:', '    private func previewText(')
    methods += between(source, '    private struct HTMLHeading {', '    private static func sortChapters(')
    blocks = between(models, 'enum CodeContentBlockKind:', 'struct CodeTableBlock:')
    title = between(models, '    func displayTitle(for sectionNumber:', '    var topLevelSectionIdentifier:')
    return '''import Foundation
''' + blocks + '''
struct Section: Decodable {
 let id: Int64
 let sectionNumber: String
 let title: String
 let officialText: String
 let contentBlocks: [CodeContentBlock]
 let synthesisEligible: Bool
}
struct InputChapter: Decodable {
 let chapterNumber: String
 let codeSectionName: String?
 let sections: [Section]
}
struct Input: Decodable { let editionPath: String; let chapters: [InputChapter] }
struct Prepared: Decodable {
 let schemaVersion: Int
 let sectionID: Int64
 let chapterNumber: String
 let officialText: String?
 let richTextOverrideData: Data?
 let previewText: String?
 let blocks: [CodeContentBlock]
}
extension String {
''' + title + '''
}
struct Resolver {
''' + methods + '''
 func resolve(_ input: Input) throws -> [String: String] {
  let root = URL(fileURLWithPath: input.editionPath)
  var output: [String: String] = [:]
  for chapter in input.chapters {
   var synthesized: [Int64: [CodeContentBlock]]? = nil
   for section in chapter.sections {
    let path = root.appendingPathComponent("prepared/sections/\\(section.id).json")
    let prepared = (try? Data(contentsOf: path)).flatMap { try? JSONDecoder().decode(Prepared.self, from: $0) }
    let validPrepared = prepared?.sectionID == section.id ? prepared : nil
    let direct = validPrepared?.officialText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let embedded = section.officialText.trimmingCharacters(in: .whitespacesAndNewlines)
    if !direct.isEmpty { output[String(section.id)] = direct; continue }
    if !embedded.isEmpty { output[String(section.id)] = embedded; continue }
    let blocks: [CodeContentBlock]
    if let preparedBlocks = validPrepared?.blocks, !preparedBlocks.isEmpty { blocks = preparedBlocks }
    else if !section.contentBlocks.isEmpty { blocks = section.contentBlocks }
    else {
     if synthesized == nil {
      synthesized = Self.extractHTMLContentBlocks(chapterNumber: chapter.chapterNumber,
       codeSectionName: chapter.codeSectionName,
       sections: chapter.sections.filter { $0.synthesisEligible },
       chaptersURL: root.appendingPathComponent("chapters"))
     }
     blocks = synthesized?[section.id] ?? []
    }
    output[String(section.id)] = resolvedOfficialText(preparedOfficialText: validPrepared?.officialText,
     fallbackOfficialText: section.officialText, contentBlocks: blocks,
     fallbackTitle: section.title.displayTitle(for: section.sectionNumber))
   }
  }
  return output
 }
}
let input = try JSONDecoder().decode(Input.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
let resolved = try Resolver().resolve(input)
let data = try JSONSerialization.data(withJSONObject: resolved, options: [.sortedKeys, .withoutEscapingSlashes])
try data.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
'''


def compile_helper(directory):
    directory = Path(directory)
    source = directory / 'SearchTextResolver.swift'
    binary = directory / 'SearchTextResolver'
    source.write_text(swift_source())
    subprocess.run(['xcrun', 'swiftc', '-O', str(source), '-o', str(binary)], check=True)
    return binary


def edition_input(edition):
    bundle = json.loads((edition / 'bundle.json').read_bytes())
    # Current six editions all load compact catalog metadata (empty embedded body).
    # Reject a schema change instead of silently changing authoritative text precedence.
    if bundle.get('sectionContentSchemaVersion') != 2 or bundle.get('chapterStructureSchemaVersion') != 2:
        raise ValueError(f'{edition.name}: unsupported body/catalog schema')
    catalog = json.loads((edition / 'prepared/chapterCatalog.json').read_bytes())
    compact_catalog = catalog.get('schemaVersion') == 1 and all(isinstance(row, list) for row in catalog['chapters'])
    groups = {row[0]: row[1] for row in catalog['chapters']} if compact_catalog else {}
    names = {row['id']: row['name'] for row in bundle['codeSections']}
    result = []
    seen = set()
    chapter_by_id = {}
    for chapter in bundle['chapters']:
        sections = []
        compact = chapter['id'] in groups
        if compact:
            chapter_groups = groups[chapter['id']]
        else:
            prepared_chapter = edition / 'prepared/chapters' / f"{chapter['id']}.json"
            if prepared_chapter.exists():
                decoded = json.loads(prepared_chapter.read_bytes())
                chapter_groups = decoded['groups'] if decoded.get('chapterID') == chapter['id'] else []
            else:
                chapter_groups = []
        for group in chapter_groups:
            for row in (group[5] if compact else group['sections']):
                section = (dict(id=row[0], sectionNumber=row[1], title=row[2], kind=row[3],
                                officialText='', contentBlocks=[]) if compact else dict(row))
                section.setdefault('officialText', '')
                section.setdefault('contentBlocks', [])
                section['kind'] = 'textBlock' if section.get('kind') == 'textBlock' else 'title'
                section['synthesisEligible'] = True
                sections.append(section)
                if section['id'] in seen:
                    raise ValueError(f"duplicate section ID {section['id']}")
                seen.add(section['id'])
        entry = dict(chapterID=chapter['id'], codeSectionID=chapter.get('codeSectionID'), chapterNumber=chapter['chapterNumber'],
                     codeSectionName=names.get(chapter.get('codeSectionID')), sections=sections)
        result.append(entry)
        chapter_by_id[chapter['id']] = entry
    flat = edition / 'prepared/sectionCatalog.json'
    if flat.exists():
        for section in json.loads(flat.read_bytes())['sections']:
            if section['id'] in seen or section['chapterID'] not in chapter_by_id:
                continue
            # Production flat-catalog recovery does not insert into synthesis list.
            chapter_by_id[section['chapterID']]['sections'].append(dict(
                id=section['id'], sectionNumber=section['sectionNumber'], title=section['title'],
                officialText='', contentBlocks=[], kind='title', synthesisEligible=False))
            seen.add(section['id'])
    return dict(editionPath=str(edition.resolve()), chapters=result)


def resolve_edition(edition, helper_binary):
    with tempfile.TemporaryDirectory(prefix='permitext-search-resolve-') as temporary:
        request = Path(temporary) / 'input.json'
        output = Path(temporary) / 'output.json'
        request.write_text(json.dumps(edition_input(edition), ensure_ascii=False))
        subprocess.run([str(helper_binary), str(request), str(output)], check=True)
        return json.loads(output.read_bytes())


def canonical_json(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def source_revision(edition):
    h = hashlib.sha256()
    # Generator algorithm and extracted production text helpers are revision inputs.
    for label, data in [('generator', Path(__file__).read_bytes()), ('swiftResolver', swift_source().encode())]:
        h.update(label.encode() + b'\0' + hashlib.sha256(data).digest())
    inputs = [edition / 'bundle.json']
    inputs.extend(path for path in (edition / 'prepared').rglob('*.json')
                  if path.name not in OUTPUT_NAMES and 'native-reader-v1' not in path.parts)
    inputs.extend((edition / 'chapters').rglob('*.html'))
    inputs.extend((edition / 'code-sections').rglob('*.html'))
    for path in sorted(set(inputs)):
        h.update(path.relative_to(edition).as_posix().encode() + b'\0')
        h.update(hashlib.sha256(path.read_bytes()).digest())
    return h.hexdigest()


def make_pack(edition, texts):
    blob = bytearray()
    offsets = {}
    for section_id in sorted(texts, key=int):
        data = texts[section_id].encode('utf-8')
        # Empty string is valid resolved text; runtime must preserve it, not fallback.
        offsets[section_id] = [len(blob), len(data)]
        blob.extend(data)
    index = canonical_json(dict(schemaVersion=1, sections=offsets))
    manifest = canonical_json(dict(schemaVersion=1, sourceRevision=source_revision(edition),
                                  textSHA256=digest(blob), indexSHA256=digest(index),
                                  sectionCount=len(offsets), textByteCount=len(blob)))
    return dict(zip(OUTPUT_NAMES, [manifest, index, bytes(blob)]))


def check_pack(edition):
    root = edition / 'prepared'
    manifest = json.loads((root / OUTPUT_NAMES[0]).read_bytes())
    index_bytes = (root / OUTPUT_NAMES[1]).read_bytes()
    blob = (root / OUTPUT_NAMES[2]).read_bytes()
    assert manifest['schemaVersion'] == 1
    assert manifest['sourceRevision'] == source_revision(edition), f'{edition.name}: stale source revision'
    assert manifest['textSHA256'] == digest(blob), f'{edition.name}: corrupt text blob'
    assert manifest['indexSHA256'] == digest(index_bytes), f'{edition.name}: corrupt index'
    assert manifest['textByteCount'] == len(blob)
    index = json.loads(index_bytes)
    assert index['schemaVersion'] == 1
    assert manifest['sectionCount'] == len(index['sections'])
    expected_ids = {str(s['id']) for c in edition_input(edition)['chapters'] for s in c['sections']}
    assert set(index['sections']) == expected_ids, f'{edition.name}: incomplete canonical section coverage'
    end = 0
    for section_id in sorted(index['sections'], key=int):
        offset, length = index['sections'][section_id]
        assert offset == end and length >= 0 and offset + length <= len(blob)
        blob[offset:offset+length].decode('utf-8')
        end = offset + length
    assert end == len(blob)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--check', action='store_true')
    group.add_argument('--verify', action='store_true')
    parser.add_argument('--edition', action='append', help='Optional edition directory name; defaults to all six')
    args = parser.parse_args()
    editions = sorted(e for e in CORPUS.iterdir() if (e / 'prepared/searchIndex.json').exists())
    if args.edition:
        editions = [e for e in editions if e.name in args.edition]
        if len(editions) != len(set(args.edition)):
            parser.error('Unknown edition')
    with tempfile.TemporaryDirectory(prefix='permitext-search-generator-') as temporary:
        binary = None if args.check else compile_helper(temporary)
        for edition in editions:
            if args.check or args.verify:
                manifest = check_pack(edition)
            if binary:
                generated = make_pack(edition, resolve_edition(edition, binary))
                for name, data in generated.items():
                    path = edition / 'prepared' / name
                    if args.verify:
                        assert path.read_bytes() == data, f'{edition.name}/{name}: nonreproducible'
                    else:
                        path.write_bytes(data)
                manifest = json.loads(generated[OUTPUT_NAMES[0]])
            print(f"{edition.name}: {manifest['sectionCount']} sections, {manifest['textByteCount']:,} UTF-8 bytes", flush=True)


if __name__ == '__main__':
    main()
