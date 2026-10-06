// Exercise the production gesture state on the host, without a Simulator runtime.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const view = await readFile(new URL('../../NYC CC APP/permitext/Views/AttributedTextView.swift', import.meta.url), 'utf8');
const start = view.indexOf('enum ReaderPassageSwipeEvent {');
const end = view.indexOf('extension Notification.Name {', start);
assert.ok(start >= 0 && end > start);

const fixture = String.raw`
func check(_ value: Bool, _ message: String) { if !value { fatalError(message) } }
var swipe = ReaderPassageSwipeState(revealWidth: 108)
check(swipe.offset == 0 && !swipe.isOpen, "Actions start closed")
swipe.apply(.began)
swipe.apply(.changed(translation: -30))
check(swipe.offset == -30 && !swipe.isOpen && swipe.isDragging, "Text must follow the finger before release; actions cannot run mid-drag")
swipe.apply(.changed(translation: -80))
check(swipe.offset == -80 && swipe.revealProgress > 0.7, "Continued movement must update the same drag, not accumulate deltas")
swipe.apply(.ended(translation: -80, velocity: 0))
check(swipe.offset == -108 && swipe.isOpen, "A deliberate swipe settles fully open")
swipe.apply(.began)
swipe.apply(.changed(translation: 20))
check(swipe.offset == -88 && !swipe.isOpen, "Swipe right must close from the existing open offset")
swipe.apply(.cancelled)
check(swipe.isOpen && swipe.offset == -108, "Cancellation restores the previous resting position")
swipe.apply(.began)
swipe.apply(.ended(translation: 80, velocity: 0))
check(swipe.offset == 0 && !swipe.isOpen, "A deliberate swipe right settles closed")
swipe.apply(.began)
swipe.apply(.ended(translation: -15, velocity: 0))
check(swipe.offset == 0, "A short accidental movement must settle closed")
swipe.apply(.began)
swipe.apply(.ended(translation: -15, velocity: -700))
check(swipe.isOpen, "A quick left flick should open despite a short travel distance")
swipe.apply(.began)
swipe.apply(.ended(translation: 15, velocity: 700))
check(swipe.offset == 0, "A quick right flick should close")
swipe.apply(.began)
swipe.apply(.changed(translation: -1000))
check(swipe.offset == -108 && swipe.revealProgress == 1, "Overswiping cannot move beyond the action tray")
swipe.apply(.changed(translation: 1000))
check(swipe.offset == 0 && swipe.revealProgress == 0, "Dragging right cannot move text beyond its original position")
swipe.open()
check(swipe.isOpen, "Accessibility action opens the same tray")
swipe.close()
check(swipe.offset == 0 && !swipe.isDragging, "Selection and disappearance reset the tray")
check(ReaderPassageSwipeState.canBegin(horizontalVelocity: -200, verticalVelocity: 20, hasSelection: false), "Horizontal swipes are recognized")
check(!ReaderPassageSwipeState.canBegin(horizontalVelocity: -20, verticalVelocity: 200, hasSelection: false), "Vertical scrolling must be left alone")
check(!ReaderPassageSwipeState.canBegin(horizontalVelocity: -100, verticalVelocity: 100, hasSelection: false), "Ambiguous diagonal scrolling must be left alone")
check(!ReaderPassageSwipeState.canBegin(horizontalVelocity: -200, verticalVelocity: 0, hasSelection: true), "Existing text selection must remain draggable")
print("PASS: continuous swipe tracking, settling and flicks, cancellation, bounded offsets, selection and vertical-scroll protection")
`;

const directory = await mkdtemp(join(tmpdir(), 'permitext-reader-swipe-'));
try {
  const source = join(directory, 'main.swift');
  const executable = join(directory, 'verify');
  await writeFile(source, `import Foundation\n${view.slice(start, end)}\n${fixture}`);
  execFileSync('xcrun', ['swiftc', source, '-o', executable], { stdio: 'inherit' });
  execFileSync(executable, [], { stdio: 'inherit' });
} finally { await rm(directory, { recursive: true, force: true }); }
