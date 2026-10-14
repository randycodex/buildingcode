// Host-check the production keyboard intersection policy without an iOS runtime.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/Views/NotebookKeyboardToolbar.swift', import.meta.url), 'utf8');
const start = source.indexOf('enum NotebookKeyboardGeometry {');
const end = source.indexOf('\n}', start) + 2;
assert.ok(start >= 0 && end > start);
assert.doesNotMatch(source, /UIHostingController|UIViewControllerRepresentable|keyboardLayoutGuide/, 'Native presentation hierarchy must not be rehosted');
const checks = `
func check(_ actual: CGFloat, _ expected: CGFloat) { precondition(actual == expected, "Expected \\(expected), got \\(actual)") }
let viewport = CGRect(x: 0, y: 116, width: 402, height: 724)
check(NotebookKeyboardGeometry.overlap(viewport: viewport, keyboard: .null), 0)
check(NotebookKeyboardGeometry.overlap(viewport: viewport, keyboard: CGRect(x: 0, y: 548, width: 402, height: 326)), 292)
check(NotebookKeyboardGeometry.overlap(viewport: viewport, keyboard: CGRect(x: 0, y: 874, width: 402, height: 326)), 0)
check(NotebookKeyboardGeometry.overlap(viewport: viewport, keyboard: CGRect(x: 60, y: 500, width: 270, height: 300)), 0)
check(NotebookKeyboardGeometry.overlap(viewport: CGRect(x: 20, y: 116, width: 360, height: 724), keyboard: CGRect(x: 0, y: 548, width: 402, height: 326)), 292)
check(NotebookKeyboardGeometry.overlap(viewport: CGRect(x: 0, y: 116, width: 402, height: 384), keyboard: CGRect(x: 0, y: 548, width: 402, height: 326)), 0)
check(NotebookKeyboardGeometry.overlap(viewport: .zero, keyboard: .zero), 0)
print("PASS: viewport intersection for docked, hidden, floating and inset-width keyboard layouts.")
`;
const dir = await mkdtemp(join(tmpdir(), 'permitext-keyboard-geometry-'));
try {
  await writeFile(join(dir, 'verify.swift'), 'import Foundation\nimport CoreGraphics\n' + source.slice(start, end) + '\n' + checks);
  execFileSync('xcrun', ['swiftc', join(dir, 'verify.swift'), '-o', join(dir, 'verify')], {stdio: 'inherit'});
  execFileSync(join(dir, 'verify'), [], {stdio: 'inherit'});
} finally { await rm(dir, {recursive: true, force: true}); }
