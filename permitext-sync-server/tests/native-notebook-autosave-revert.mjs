// Host-only: execute the unchanged editor lifecycle methods with a controlled
// network adapter and a real temporary JSON draft file. No SwiftUI/device runtime.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const read = p => readFile(new URL(p, import.meta.url), 'utf8');
const editor = await read('../../NYC CC APP/permitext/Views/NotebookView.swift');
const models = await read('../../NYC CC APP/permitext/Models/ResearchNotebookModels.swift');
function block(source, marker, indent = '') {
 const start = source.indexOf(marker);
 assert.ok(start >= 0, `Missing production declaration ${marker}`);
 const end = source.indexOf(`\n${indent}}`, start);
 assert.ok(end > start);
 return source.slice(start, end + indent.length + 2);
}
const declarations = models.slice(models.indexOf('struct NotebookCard:')) + '\n' +
 ['NativeNotebookDraft', 'NativeNotebookSaveAttempt', 'NativeNotebookEditableContent', 'NativeNotebookEditObservation']
 .map(name => block(editor, `struct ${name}`)).join('\n');
const methods = ['private func scheduleAutosave()', 'private func saveNow()', 'private var currentDraft:',
 'private func cacheDraft()', 'private var editableContent:', 'private func editableContent(for card:',
 'private func normalizedTitle(', 'private func apply(_ card:', 'private func completeSave(']
 .map(marker => (marker === 'private func cacheDraft()' ? '    @discardableResult\n' : '') + block(editor, `    ${marker}`, '    ')).join('\n');
const fixture = await read('./fixtures/native-notebook-autosave-revert.swift');
const source = 'import Foundation\n' + declarations + '\n' + fixture.replace('// PRODUCTION_METHODS', methods);
const dir = await mkdtemp(join(tmpdir(), 'permitext-note-revert-'));
try {
 await writeFile(join(dir, 'verify.swift'), source);
 execFileSync('xcrun', ['swiftc', '-parse-as-library', join(dir, 'verify.swift'), '-o', join(dir, 'verify')], {stdio:'inherit'});
 execFileSync(join(dir, 'verify'), [join(dir, 'draft.json')], {stdio:'inherit'});
 const fixStart = source.indexOf('        if editableContent == lastSyncedContent {');
 const fixEnd = source.indexOf('        lastLocalEditAt = Date()', fixStart);
 assert.ok(fixStart > 0 && fixEnd > fixStart);
 const mutant = source.slice(0, fixStart) + '        guard editableContent != lastSyncedContent else { return }\n' + source.slice(fixEnd);
 await writeFile(join(dir, 'mutant.swift'), mutant);
 execFileSync('xcrun', ['swiftc', '-parse-as-library', join(dir, 'mutant.swift'), '-o', join(dir, 'mutant')], {stdio:'pipe'});
 assert.throws(() => execFileSync(join(dir, 'mutant'), [join(dir, 'mutant.json')], {stdio:'pipe'}),
  error => error.status === 1 && error.stderr.toString().includes('Reverting before debounce must clear Saving'));
 console.log('PASS: temporary compiled pre-fix mutant fails the status regression.');
} finally { await rm(dir, {recursive:true, force:true}); }
