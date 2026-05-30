import Foundation

private struct ParsedCodeReference: Hashable {
    let kind: CodeReferenceKind
    let token: String
    let label: String
}

final class CodeReferenceResolver {
    private let sectionPattern = try! NSRegularExpression(
        pattern: #"(?i)\bsections?\s+((?:[0-9]{3}\.[0-9A-Za-z.\-]+)(?:\s*(?:,|and|or)\s*(?:[0-9]{3}\.[0-9A-Za-z.\-]+))*)"#)
    private let chapterPattern = try! NSRegularExpression(
        pattern: #"(?i)\bchapters?\s+((?:[0-9]+|[A-Z])(?:\s*(?:,|and|or)\s*(?:[0-9]+|[A-Z]))*)"#)
    private let appendixPattern = try! NSRegularExpression(
        pattern: #"(?i)\bappend(?:ix|ices)\s+((?:[A-Z])(?:\s*(?:,|and|or)\s*(?:[A-Z]))*)"#)
    private let splitPattern = try! NSRegularExpression(pattern: #"\s*(?:,|and|or)\s*"#, options: [.caseInsensitive])

    func resolveReferences(in officialText: String, database: CodeReferenceLookup) -> [ResolvedCodeReference] {
        let parsedReferences = parse(in: officialText)
        var resolved: [ResolvedCodeReference] = []
        var seen = Set<String>()

        for reference in parsedReferences {
            switch reference.kind {
            case .section:
                guard let section = try? database.sectionSummary(sectionNumber: reference.token) else { continue }
                let item = ResolvedCodeReference(kind: .section, label: reference.label, destination: .section(section))
                if seen.insert(item.id).inserted {
                    resolved.append(item)
                }
            case .chapter:
                guard let chapter = try? database.chapter(chapterNumber: reference.token) else { continue }
                let item = ResolvedCodeReference(kind: .chapter, label: reference.label, destination: .chapter(chapter))
                if seen.insert(item.id).inserted {
                    resolved.append(item)
                }
            case .appendix:
                guard let chapter = try? database.appendix(letter: reference.token) else { continue }
                let item = ResolvedCodeReference(kind: .appendix, label: reference.label, destination: .chapter(chapter))
                if seen.insert(item.id).inserted {
                    resolved.append(item)
                }
            }
        }

        return resolved
    }

    private func parse(in text: String) -> [ParsedCodeReference] {
        var references: [ParsedCodeReference] = []
        references.append(contentsOf: matches(in: text, expression: sectionPattern, kind: .section, prefix: "Section"))
        references.append(contentsOf: matches(in: text, expression: chapterPattern, kind: .chapter, prefix: "Chapter"))
        references.append(contentsOf: matches(in: text, expression: appendixPattern, kind: .appendix, prefix: "Appendix"))
        return references
    }

    private func matches(
        in text: String,
        expression: NSRegularExpression,
        kind: CodeReferenceKind,
        prefix: String
    ) -> [ParsedCodeReference] {
        let range = NSRange(location: 0, length: text.utf16.count)
        return expression.matches(in: text, range: range).flatMap { match -> [ParsedCodeReference] in
            guard let tokenRange = Range(match.range(at: 1), in: text) else { return [] }
            let capture = String(text[tokenRange])
            return split(capture).map { token in
                ParsedCodeReference(kind: kind, token: token, label: "\(prefix) \(token)")
            }
        }
    }

    private func split(_ capture: String) -> [String] {
        let fullRange = NSRange(location: 0, length: capture.utf16.count)
        let mutable = NSMutableString(string: capture)
        splitPattern.replaceMatches(in: mutable, range: fullRange, withTemplate: "|")
        // Also trim trailing punctuation (period, comma, colon, semicolon) so
        // tokens like "904.12.2." resolve correctly. The regex capture group
        // greedily included the sentence-ending period, which previously
        // caused the last reference in a "Sections X and Y." list to fail
        // the section-index lookup.
        let trimChars = CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: ".,;:"))
        return String(mutable)
            .split(separator: "|")
            .map { $0.trimmingCharacters(in: trimChars).uppercased() }
            .filter { !$0.isEmpty }
    }
}
