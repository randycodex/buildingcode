import Foundation

struct HeadingPrefixResult<Value> {
    let value: Value
    let replacementCount: Int
}

enum HeadingPrefixTransformer {
    private struct Rule {
        let prefix: String
        let regularExpression: NSRegularExpression
    }

    private struct Insertion {
        let location: Int
        let prefix: String
    }

    private static let rules: [Rule] = [
        Rule(prefix: "#-", regularExpression: try! NSRegularExpression(pattern: #"(?i)^chapter\s+\d+[A-Z]?(?::)?\s+\S.*$"#)),
        Rule(prefix: "#--", regularExpression: try! NSRegularExpression(pattern: #"(?i)^section\s+(?:bc\s+)?\d+[A-Z]?(?::|\s+-)?\s+\S.*$"#)),
        Rule(prefix: "#--", regularExpression: try! NSRegularExpression(pattern: #"(?i)^section\s+bc\s+\d+[A-Z]?(?::|\s+-)?\s+\S.*$"#)),
        Rule(prefix: "#---", regularExpression: try! NSRegularExpression(pattern: #"^\d+\.\d+\s+\S.*$"#)),
        Rule(prefix: "#----", regularExpression: try! NSRegularExpression(pattern: #"^\d+\.\d+\.\d+\s+\S.*$"#)),
        Rule(prefix: "#-----", regularExpression: try! NSRegularExpression(pattern: #"^\d+\.\d+\.\d+\.\d+\s+\S.*$"#)),
        Rule(prefix: "#------", regularExpression: try! NSRegularExpression(pattern: #"^\d+\.\d+\.\d+\.\d+\.\d+\s+\S.*$"#)),
        Rule(prefix: "#-------", regularExpression: try! NSRegularExpression(pattern: #"^\d+\.\d+\.\d+\.\d+\.\d+\.\d+\s+\S.*$"#))
    ]

    static func transform(html: String) -> HeadingPrefixResult<String> {
        let pattern = "<(h[1-6])(\\s[^>]*)?>([\\s\\S]*?)</\\1>"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return HeadingPrefixResult(value: html, replacementCount: 0)
        }

        let nsHtml = html as NSString
        let fullRange = NSRange(location: 0, length: nsHtml.length)
        let matches = regex.matches(in: html, range: fullRange)

        let mutable = NSMutableString(string: html)
        var replacementCount = 0

        for match in matches.reversed() {
            let innerRange = match.range(at: 3)
            guard innerRange.location != NSNotFound, innerRange.length > 0 else {
                continue
            }

            let inner = nsHtml.substring(with: innerRange)
            let plain = plainText(fromHTMLFragment: inner)
            let trimmed = plain.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty, !trimmed.hasPrefix("#-"), let rulePrefix = prefix(for: trimmed) else {
                continue
            }

            mutable.insert("\(rulePrefix) ", at: innerRange.location)
            replacementCount += 1
        }

        return HeadingPrefixResult(value: mutable as String, replacementCount: replacementCount)
    }

    static func transform(text: String) -> HeadingPrefixResult<String> {
        let insertions = insertions(in: text as NSString)
        let mutableText = NSMutableString(string: text)

        for insertion in insertions.sorted(by: { $0.location > $1.location }) {
            mutableText.insert("\(insertion.prefix) ", at: insertion.location)
        }

        return HeadingPrefixResult(value: mutableText as String, replacementCount: insertions.count)
    }

    static func transform(attributedText: NSAttributedString) -> HeadingPrefixResult<NSAttributedString> {
        let sourceText = attributedText.string as NSString
        let insertions = insertions(in: sourceText)
        let mutableAttributedText = NSMutableAttributedString(attributedString: attributedText)

        for insertion in insertions.sorted(by: { $0.location > $1.location }) {
            let attributes: [NSAttributedString.Key: Any]
            if mutableAttributedText.length > insertion.location {
                attributes = mutableAttributedText.attributes(at: insertion.location, effectiveRange: nil)
            } else {
                attributes = [:]
            }

            let prefix = NSAttributedString(string: "\(insertion.prefix) ", attributes: attributes)
            mutableAttributedText.insert(prefix, at: insertion.location)
        }

        return HeadingPrefixResult(value: NSAttributedString(attributedString: mutableAttributedText), replacementCount: insertions.count)
    }

    private static func plainText(fromHTMLFragment fragment: String) -> String {
        let withoutTags = fragment.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        let decoded = withoutTags
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&#160;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")

        let normalizedWhitespace = decoded
            .replacingOccurrences(of: "\u{00A0}", with: " ")
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)

        return normalizedWhitespace.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func insertions(in text: NSString) -> [Insertion] {
        var matches: [Insertion] = []
        var location = 0

        while location < text.length {
            var paragraphStart = 0
            var paragraphEnd = 0
            var contentsEnd = 0
            text.getParagraphStart(&paragraphStart, end: &paragraphEnd, contentsEnd: &contentsEnd, for: NSRange(location: location, length: 0))

            let contentRange = NSRange(location: paragraphStart, length: contentsEnd - paragraphStart)
            if contentRange.length > 0 {
                let line = text.substring(with: contentRange)
                if let prefix = prefix(for: line) {
                    matches.append(Insertion(location: paragraphStart, prefix: prefix))
                }
            }

            location = paragraphEnd
        }

        return matches
    }

    private static func prefix(for line: String) -> String? {
        guard !line.isEmpty else {
            return nil
        }

        guard let firstCharacter = line.first, !firstCharacter.isWhitespace else {
            return nil
        }

        let trimmedLine = line
            .replacingOccurrences(of: "\u{00A0}", with: " ")
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedLine.isEmpty else {
            return nil
        }

        guard !trimmedLine.hasPrefix("#-") else {
            return nil
        }

        let lowercasedLine = trimmedLine.lowercased()
        if lowercasedLine.hasPrefix("section bc ") || lowercasedLine.hasPrefix("section ") {
            return "#--"
        }

        let fullRange = NSRange(location: 0, length: trimmedLine.utf16.count)
        return rules.first(where: { rule in
            rule.regularExpression.firstMatch(in: trimmedLine, options: [], range: fullRange) != nil
        })?.prefix
    }
}
