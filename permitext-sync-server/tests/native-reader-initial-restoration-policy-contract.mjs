import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/Views/NativeChapterTextReaderView.swift', import.meta.url), 'utf8');
const start = source.indexOf('enum NativeReaderInitialRestorationPolicy {');
const end = source.indexOf('enum NativeReaderLocationResolver {', start);
assert.ok(start > 0 && end > start);
assert.equal((source.match(/NativeReaderInitialRestorationPolicy\.requiresRestoration\(/g) ?? []).length, 2,
 'Cached initialization and asynchronous loading must share the same policy');
const dir = await mkdtemp(join(tmpdir(), 'permitext-initial-restoration-'));
try {
 const path = join(dir, 'main.swift');
 await writeFile(path, `${source.slice(start,end)}
func requires(_ top: Bool, _ target: String?, _ first: String?, _ remembered: String?) -> Bool {
 NativeReaderInitialRestorationPolicy.requiresRestoration(opensAtChapterTop: top,
  targetBlockID: target, firstBlockID: first, rememberedViewportBlockID: remembered)
}
// Explicit top navigation ignores a saved offset even within the first block.
precondition(!requires(true, "first", "first", "first"))
precondition(!requires(true, "first", "first", "later"))
precondition(!requires(true, "first", "first", nil))
// Remembered first-block offsets remain restorable without an explicit top request.
precondition(requires(false, "first", "first", "first"))
precondition(!requires(false, "first", "first", nil))
precondition(!requires(false, "first", "first", "later"))
// Actual passage targets retain restoration, independent of remembered state.
precondition(requires(false, "later", "first", nil))
precondition(requires(false, "later", "first", "later"))
precondition(requires(false, "later", "first", "first"))
// Defensive mismatch: a non-top resolved target must still align.
precondition(requires(true, "later", "first", nil))
// Empty/unresolved documents must never wait for a nonexistent target.
precondition(!requires(false, nil, nil, nil))
precondition(!requires(true, nil, nil, "first"))
precondition(!requires(false, nil, "first", "first"))
print("PASS: explicit chapter top skips saved offsets; remembered and passage targets preserve restoration; nil targets never wait")
`);
 const binary = join(dir, 'verify');
 execFileSync('xcrun', ['swiftc', path, '-o', binary], {stdio:'pipe'});
 console.log(execFileSync(binary, [], {encoding:'utf8'}).trim());
} finally { await rm(dir, {recursive:true, force:true}); }
