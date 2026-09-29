// Verbatim production matcher from ac78d8287, retained only as the parity oracle.
final class ReaderDefinitionMatcher {
    let entries: [ReaderDefinitionEntry]
    private let expression: NSRegularExpression?
    private let byLabel: [String: [ReaderDefinitionEntry]]
    private let excludedContexts: [String: [(expression: NSRegularExpression, occurrence: Int)]]

    private static func key(_ value: String) -> String {
        value.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.joined(separator: " ").lowercased()
    }

    init(entries: [ReaderDefinitionEntry], sectionNumber: String? = nil) {
        self.entries = entries
        let section = sectionNumber?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() ?? ""
        excludedContexts = Dictionary(entries.filter { $0.excludedOccurrences != nil }.map { entry in
            let phrases = (entry.excludedOccurrences ?? []).filter {
                !section.isEmpty && (section == $0.section.uppercased() || section.hasPrefix($0.section.uppercased() + "."))
            }.flatMap(\.phrases)
            let expressions = phrases.compactMap { phrase -> (expression: NSRegularExpression, occurrence: Int)? in
                let escaped = phrase.text.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }
                    .map(NSRegularExpression.escapedPattern(for:)).joined(separator: "\\s+")
                guard phrase.occurrence >= 0, let expression = try? NSRegularExpression(pattern: "(?<![\\p{L}\\p{N}_])(?:\(escaped))(?![\\p{L}\\p{N}_])", options: [.caseInsensitive]) else { return nil }
                return (expression, phrase.occurrence)
            }
            return (entry.id, expressions)
        }, uniquingKeysWith: { first, _ in first })
        var labels: [String: [ReaderDefinitionEntry]] = [:]
        for entry in entries {
            for label in [entry.term] + entry.aliases {
                let key = Self.key(label)
                guard !key.isEmpty else { continue }
                if labels[key]?.contains(where: { $0.id == entry.id }) != true { labels[key, default: []].append(entry) }
            }
        }
        byLabel = labels
        let alternatives = labels.keys.sorted { $0.count > $1.count }.map {
            $0.components(separatedBy: " ").map(NSRegularExpression.escapedPattern(for:)).joined(separator: "\\s+")
        }.joined(separator: "|")
        expression = alternatives.isEmpty ? nil : try? NSRegularExpression(
            pattern: "(?<![\\p{L}\\p{N}_])(?:\(alternatives))(?![\\p{L}\\p{N}_])", options: [.caseInsensitive]
        )
    }

    func decorating(_ original: NSAttributedString) -> NSAttributedString {
        guard let expression else { return original }
        if original.string.trimmingCharacters(in: .whitespacesAndNewlines).range(of: #"^(?:[^.!?\n]{1,120}\.\s*)?The term [“"][^”"]+[”"] (?:shall )?means?\b"#, options: [.regularExpression, .caseInsensitive]) != nil { return original }
        let definitionRange = (original.string as NSString).range(of: #"\*{0,2}§\s*(?:\d{2}-)?[A-Z]?\d+(?:\.\d+)*\s+Definitions\."#, options: [.regularExpression, .caseInsensitive])
        let result = NSMutableAttributedString(attributedString: original)
        let text = original.string as NSString
        let candidates = expression.matches(in: original.string, range: NSRange(location: 0, length: original.length))
        let excludedStarts = Dictionary(entries.filter { excludedContexts[$0.id]?.isEmpty == false }.map { entry in
            let starts = (excludedContexts[entry.id] ?? []).flatMap { rule in
                rule.expression.matches(in: original.string, range: NSRange(location: 0, length: original.length)).compactMap { context -> Int? in
                    let terms = candidates.filter { candidate in
                        candidate.range.location >= context.range.location && NSMaxRange(candidate.range) <= NSMaxRange(context.range) &&
                        byLabel[Self.key(text.substring(with: candidate.range))]?.contains(where: { $0.id == entry.id }) == true
                    }
                    return terms.indices.contains(rule.occurrence) ? terms[rule.occurrence].range.location : nil
                }
            }
            return (entry.id, Set(starts))
        }, uniquingKeysWith: { first, _ in first })
        for match in candidates {
            if definitionRange.location != NSNotFound && match.range.location >= definitionRange.location { continue }
            var hasLink = false
            original.enumerateAttribute(.link, in: match.range) { value, _, stop in
                if value != nil { hasLink = true; stop.pointee = true }
            }
            guard !hasLink, let candidates = byLabel[Self.key(text.substring(with: match.range))] else { continue }
            var entirelyItalic: Bool?
            let definitions = candidates.filter { entry in
                guard !(excludedStarts[entry.id]?.contains(match.range.location) ?? false) else { return false }
                guard entry.requiresItalic == true else { return true }
                if entirelyItalic == nil {
                    var valid = true
                    original.enumerateAttribute(.font, in: match.range) { value, range, stop in
                        guard !text.substring(with: range).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
                        if (value as? UIFont)?.fontDescriptor.symbolicTraits.contains(.traitItalic) != true {
                            valid = false
                            stop.pointee = true
                        }
                    }
                    entirelyItalic = valid
                }
                return entirelyItalic == true
            }
            guard !definitions.isEmpty, let url = URL(string: "permitext-definition://entry/\(definitions.map(\.id).joined(separator: ","))") else { continue }
            result.removeAttribute(.underlineStyle, range: match.range)
            result.addAttribute(.link, value: url, range: match.range)
            result.addAttribute(.foregroundColor, value: UIColor.secondaryLabel, range: match.range)
        }
        return result
    }

    func definitions(for url: URL) -> [ReaderDefinitionEntry] {
        guard url.scheme == "permitext-definition", url.host == "entry" else { return [] }
        let identifiers = Set(url.lastPathComponent.split(separator: ",").map(String.init))
        return entries.filter { identifiers.contains($0.id) }
    }
}

