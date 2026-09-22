#!/usr/bin/env python3
"""Real corpus integrity plus revision/corruption tests for shipped search packs.
Full semantic regeneration: python3 Tools/permitext_search_text_pack.py --verify.
"""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('search_pack', ROOT / 'Tools/permitext_search_text_pack.py')
pack = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pack)


def fixture(root):
    (root / 'prepared/sections').mkdir(parents=True)
    (root / 'chapters').mkdir()
    (root / 'code-sections').mkdir()
    (root / 'bundle.json').write_text(json.dumps(dict(sectionContentSchemaVersion=2,
        chapterStructureSchemaVersion=2, codeSections=[dict(id=1, name='Building')],
        chapters=[dict(id=1, chapterNumber='1', codeSectionID=1)])))
    (root / 'prepared/chapterCatalog.json').write_text(json.dumps(dict(schemaVersion=1,
        chapters=[[1, [['group', 'SECTION1', None, None, None, [[1, '101.1', 'Scope.', 'title']]]]]])))
    (root / 'prepared/searchIndex.json').write_text('{"schemaVersion":1,"tokens":{"concrete":[1]}}')
    (root / 'prepared/sections/1.json').write_text('{"officialText":"concrete"}')
    (root / 'chapters/1.html').write_text('<h6>101.1 Scope.</h6><p>concrete</p>')


class SearchTextPackTests(unittest.TestCase):
    def test_all_six_real_editions_have_valid_complete_packs(self):
        editions = sorted(e for e in pack.CORPUS.iterdir() if (e / 'prepared/searchIndex.json').exists())
        self.assertEqual(len(editions), 6)
        total = 0
        for edition in editions:
            with self.subTest(edition=edition.name):
                total += pack.check_pack(edition)['sectionCount']
        self.assertGreater(total, 25000)

    def test_source_revision_is_path_independent_and_tracks_all_search_inputs(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            left, right = Path(a), Path(b)
            fixture(left)
            fixture(right)
            before = pack.source_revision(left)
            self.assertEqual(before, pack.source_revision(right))
            for name in ['bundle.json', 'prepared/chapterCatalog.json', 'prepared/searchIndex.json',
                         'prepared/sections/1.json', 'chapters/1.html']:
                path = right / name
                original = path.read_bytes()
                path.write_bytes(original + b' ')
                self.assertNotEqual(before, pack.source_revision(right), name)
                path.write_bytes(original)
            extra = right / 'prepared/sections/2.json'
            extra.write_text('{}')
            self.assertNotEqual(before, pack.source_revision(right))

    def test_deterministic_utf8_offsets_and_stale_or_corrupt_output_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fixture(root)
            expected = '§ concrete — café 🧱\n\nText'
            generated = pack.make_pack(root, {'1': expected})
            self.assertEqual(generated, pack.make_pack(root, {'1': expected}))
            for name, data in generated.items():
                (root / 'prepared' / name).write_bytes(data)
            pack.check_pack(root)
            index = json.loads(generated['searchTextIndex.json'])['sections']['1']
            self.assertEqual(generated['searchText.utf8'][index[0]:sum(index)].decode(), expected)
            for name in ('searchText.utf8', 'searchTextIndex.json'):
                path = root / 'prepared' / name
                path.write_bytes(generated[name] + b' ')
                with self.assertRaises(AssertionError):
                    pack.check_pack(root)
                path.write_bytes(generated[name])
            path = root / 'chapters/1.html'
            path.write_text(path.read_text() + '<p>Amended.</p>')
            with self.assertRaisesRegex(AssertionError, 'stale source revision'):
                pack.check_pack(root)


if __name__ == '__main__':
    unittest.main()
