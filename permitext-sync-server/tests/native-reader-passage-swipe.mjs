// A horizontal drag must never expose or trigger Reader passage actions.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const view = name => readFile(new URL(`../../NYC CC APP/permitext/Views/${name}.swift`, import.meta.url), 'utf8');
const [reader, text, selection] = await Promise.all([
    view('NativeChapterTextReaderView'), view('AttributedTextView'), view('NativeChapterSelection')
]);
assert.doesNotMatch(reader + text, /ReaderPassageSwipe|passagePanRecognizer|reader-passage-bookmark/);
assert.doesNotMatch(reader, /Image\(systemName: "bookmark.fill"\)/);
assert.match(selection, /UIAction\(title: "Save to Evidence"/);
assert.match(selection, /UIAction\(title: "Select Passage"/);
assert.match(text, /title: "Ask Assistant"/);
console.log('Reader exposes passage actions through text selection.');
