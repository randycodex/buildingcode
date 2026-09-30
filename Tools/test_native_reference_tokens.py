#!/usr/bin/env python3
"""Run the native resolver's actual parser against prose and valid citations."""
from pathlib import Path
import subprocess
import tempfile
root = Path(__file__).resolve().parents[1]
source = (root / 'NYC CC APP/permitext/Data/CodeReferenceResolver.swift').read_text()
# Resolution is independent of token recognition; compile the production parser
# without database dependencies so false lookup candidates are observable.
start = source.index('    func resolveReferences(')
end = source.index('    private func parse(', start)
parser = (source[:start] + source[end:]).replace('private struct ParsedCodeReference', 'struct ParsedCodeReference').replace('private func parse(', 'func parse(')
checks = r'''
let resolver = CodeReferenceResolver()
func check(_ text: String, _ expected: [String]) {
    let actual = resolver.parse(in: text).map { $0.label }
    precondition(actual == expected, "\(text): \(actual) != \(expected)")
}
check("References to chapter or section numbers, or to provisions not specifically identified by number, shall be construed to refer to such chapter, section or provision of this code.", [])
check("See chapters elsewhere and appendix requirements.", [])
check("Chapter 12 and Chapter 123.", ["Chapter 12", "Chapter 123"])
check("Chapters 4, 5 and 6.", ["Chapter 4", "Chapter 5", "Chapter 6"])
check("Chapter O and Appendix A.", ["Chapter O", "Appendix A"])
check("Appendices A, B or C.", ["Appendix A", "Appendix B", "Appendix C"])
check("Sections 904.12.1 and 904.12.2.", ["Section 904.12.1", "Section 904.12.2"])
check("Chapter 12words and appendix ABC.", [])
print("Native reference token checks passed")
'''
with tempfile.TemporaryDirectory(prefix='permitext-reference-tokens-') as tmp:
    main = Path(tmp) / 'main.swift'
    main.write_text('enum CodeReferenceKind { case section, chapter, appendix }\n' + parser + checks)
    subprocess.run(['swiftc', str(main), '-o', str(Path(tmp) / 'check')], check=True)
    subprocess.run([str(Path(tmp) / 'check')], check=True)
