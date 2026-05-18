import AppKit
import Foundation

struct EditorDocument: Identifiable {
    enum Kind {
        case rich
        case html
    }

    let id: UUID
    var fileURL: URL
    var kind: Kind
    var attributedText: NSAttributedString
    var htmlContent: String
    var isLoaded: Bool
    var hasUnsavedChanges: Bool
    var lastReplacementCount: Int

    init(
        id: UUID = UUID(),
        fileURL: URL,
        kind: Kind = .rich,
        attributedText: NSAttributedString = NSAttributedString(string: ""),
        htmlContent: String = "",
        isLoaded: Bool = true,
        hasUnsavedChanges: Bool = false,
        lastReplacementCount: Int = 0
    ) {
        self.id = id
        self.fileURL = fileURL
        self.kind = kind
        self.attributedText = attributedText
        self.htmlContent = htmlContent
        self.isLoaded = isLoaded
        self.hasUnsavedChanges = hasUnsavedChanges
        self.lastReplacementCount = lastReplacementCount
    }

    var displayName: String {
        fileURL.lastPathComponent
    }

    /// Returns the document split into (prefix up to and including the opening <body ...> tag,
    /// body content, suffix from </body> onward). When the file has no <body> tag the entire
    /// string is treated as the body content and prefix/suffix are empty.
    func splitBody() -> (prefix: String, body: String, suffix: String) {
        Self.splitBody(in: htmlContent)
    }

    static func splitBody(in html: String) -> (prefix: String, body: String, suffix: String) {
        let openRegex = try! NSRegularExpression(pattern: #"<body\b[^>]*>"#, options: [.caseInsensitive])
        let closeRegex = try! NSRegularExpression(pattern: #"</body\s*>"#, options: [.caseInsensitive])
        let ns = html as NSString
        let fullRange = NSRange(location: 0, length: ns.length)
        guard let openMatch = openRegex.firstMatch(in: html, options: [], range: fullRange) else {
            return ("", html, "")
        }
        let bodyStart = openMatch.range.location + openMatch.range.length
        let searchRange = NSRange(location: bodyStart, length: ns.length - bodyStart)
        let closeMatch = closeRegex.firstMatch(in: html, options: [], range: searchRange)
        let bodyEnd: Int
        let suffixStart: Int
        if let closeMatch {
            bodyEnd = closeMatch.range.location
            suffixStart = closeMatch.range.location
        } else {
            bodyEnd = ns.length
            suffixStart = ns.length
        }
        let prefix = ns.substring(with: NSRange(location: 0, length: bodyStart))
        let body = ns.substring(with: NSRange(location: bodyStart, length: bodyEnd - bodyStart))
        let suffix = ns.substring(with: NSRange(location: suffixStart, length: ns.length - suffixStart))
        return (prefix, body, suffix)
    }

    /// Returns a new full-document HTML by replacing the current body content with `newBody`,
    /// preserving the document's prefix and suffix (doctype, <html>, <head>, attributes on <body>).
    func replacingBody(with newBody: String) -> String {
        let parts = splitBody()
        if parts.prefix.isEmpty && parts.suffix.isEmpty {
            return newBody
        }
        return parts.prefix + newBody + parts.suffix
    }
}
