// Host-only checks for the production exact-source routing policy.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/Views/NativeNotebookReferenceDestination.swift', import.meta.url), 'utf8');
const start = source.indexOf('enum NativeNotebookReferenceIdentity {');
const end = source.indexOf('\n}', start) + 2;
assert.ok(start >= 0 && end > start);
const checks = `
func check(_ value: Bool, _ message: String) { if !value { fatalError(message) } }
check(!NativeNotebookReferenceIdentity.acceptsCandidateMetadata(kind: "canonicalSection", referenceID: "123"), "Bare section IDs must not inherit the first current candidate's edition")
check(NativeNotebookReferenceIdentity.acceptsCandidateMetadata(kind: "canonicalSection", referenceID: "saved-row"), "Stable legacy bookmark identity may supply its source metadata")
check(NativeNotebookReferenceIdentity.acceptsCandidateMetadata(kind: "researchAnswer", referenceID: "123"), "Exact answer ID can supply its conversation locator")
check(NativeNotebookReferenceIdentity.acceptsCandidateMetadata(kind: "selectedPassage", referenceID: "evidence-id"), "Exact evidence IDs may supply their source")
check(!NativeNotebookReferenceIdentity.bookmarkMatches(referenceID: "123", canonicalEdition: nil, sectionID: "123", clientID: "saved-row", bookmarkEdition: "2022"), "Bare section ID must not borrow a bookmarked edition")
check(NativeNotebookReferenceIdentity.bookmarkMatches(referenceID: "saved-row", canonicalEdition: nil, sectionID: "123", clientID: "saved-row", bookmarkEdition: "2022"), "Legacy client identity must recover its exact source")
check(NativeNotebookReferenceIdentity.bookmarkMatches(referenceID: "123", canonicalEdition: "2022", sectionID: "123", clientID: "saved-row", bookmarkEdition: "2022"), "Explicit section and edition must match")
check(!NativeNotebookReferenceIdentity.bookmarkMatches(referenceID: "123", canonicalEdition: "2014", sectionID: "123", clientID: "saved-row", bookmarkEdition: "2022"), "Never substitute a different edition")
check(!NativeNotebookReferenceIdentity.bookmarkMatches(referenceID: "", canonicalEdition: nil, sectionID: "", clientID: "", bookmarkEdition: "2022"), "Empty identity must stay unresolved")
check(NativeNotebookReferenceIdentity.citationSectionID(explicit: nil, matchedSourceSectionIDs: ["123", "123"]) == "123", "Duplicate source records may establish one identity")
check(NativeNotebookReferenceIdentity.citationSectionID(explicit: nil, matchedSourceSectionIDs: ["123", "456"]) == nil, "Ambiguous evidence must stay unresolved")
check(NativeNotebookReferenceIdentity.citationSectionID(explicit: "456", matchedSourceSectionIDs: ["123", "456"]) == "456", "Explicit citation identity takes precedence")
check(NativeNotebookReferenceIdentity.citationSectionID(explicit: "", matchedSourceSectionIDs: []) == nil, "Missing citation locator must stay unresolved")
print("PASS: native notebook exact source identity, legacy bookmark lookup, edition isolation and ambiguous-citation rejection.")
`;
const dir = await mkdtemp(join(tmpdir(), 'permitext-note-reference-'));
try {
  await writeFile(join(dir, 'verify.swift'), 'import Foundation\n' + source.slice(start, end) + '\n' + checks);
  execFileSync('xcrun', ['swiftc', join(dir, 'verify.swift'), '-o', join(dir, 'verify')], {stdio: 'inherit'});
  execFileSync(join(dir, 'verify'), [], {stdio: 'inherit'});
} finally { await rm(dir, {recursive: true, force: true}); }
