import SwiftUI

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

struct FormattingRules {
    var headerPattern: String = #"(?im)^SECTION\s+(?:BC\s+)?[A-Z]?\d+.*$"#
    var sectionNumberPattern: String = #"(?m)^[A-Z]?\d{3,4}(?:\.\d+[A-Za-z0-9.\-()]*)*\.?.*$"#
    var exceptionPattern: String = #"(?im)^.*Exception.*$"#
    var shallPattern: String = #"\bshall\b"#
    var definedTermPattern: String = #"\b[A-Z][A-Z0-9\-]{2,}\b"#
}

final class FormattingEngine {
    let rules: FormattingRules
    private let headerExpression: NSRegularExpression?
    private let sectionNumberExpression: NSRegularExpression?
    private let exceptionExpression: NSRegularExpression?
    private let shallExpression: NSRegularExpression?
    private let definedTermExpression: NSRegularExpression?

    init(rules: FormattingRules = FormattingRules()) {
        self.rules = rules
        self.headerExpression = try? NSRegularExpression(pattern: rules.headerPattern)
        self.sectionNumberExpression = try? NSRegularExpression(pattern: rules.sectionNumberPattern)
        self.exceptionExpression = try? NSRegularExpression(pattern: rules.exceptionPattern)
        self.shallExpression = try? NSRegularExpression(pattern: rules.shallPattern)
        self.definedTermExpression = try? NSRegularExpression(pattern: rules.definedTermPattern)
    }

    func render(officialText: String, spans: [TextSpan], theme: ReaderTheme) -> AttributedString {
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = theme.lineSpacing
        paragraphStyle.paragraphSpacing = theme.paragraphSpacing

        let attributed = NSMutableAttributedString(
            string: officialText,
            attributes: [
                .font: theme.bodyFont,
                .foregroundColor: PlatformColor.labelCompatible,
                .paragraphStyle: paragraphStyle
            ]
        )

        applyRegex(headerExpression, to: attributed) {
            [
                .font: theme.boldFont,
                .foregroundColor: theme.accentColor
            ]
        }

        applyRegex(sectionNumberExpression, to: attributed) {
            [
                .font: theme.boldFont
            ]
        }

        applyRegex(exceptionExpression, to: attributed) {
            [
                .font: theme.italicFont
            ]
        }

        applyRegex(shallExpression, to: attributed) {
            [
                .backgroundColor: theme.highlightColor
            ]
        }

        applyRegex(definedTermExpression, to: attributed) {
            [
                .backgroundColor: theme.definedTermColor
            ]
        }

        applyManualSpans(spans, to: attributed, theme: theme)
        return AttributedString(attributed)
    }

    func renderRichTextOverride(_ data: Data, theme: ReaderTheme) -> AttributedString? {
        guard let attributed = decodeRichTextOverride(data) else {
            return nil
        }
        return AttributedString(preparedRichText(attributed, theme: theme))
    }

    private func applyRegex(
        _ expression: NSRegularExpression?,
        to attributed: NSMutableAttributedString,
        attributes: () -> [NSAttributedString.Key: Any]
    ) {
        guard let expression else { return }
        let fullRange = NSRange(location: 0, length: attributed.string.utf16.count)
        expression.enumerateMatches(in: attributed.string, range: fullRange) { match, _, _ in
            guard let match else { return }
            attributed.addAttributes(attributes(), range: match.range)
        }
    }

    private func applyManualSpans(_ spans: [TextSpan], to attributed: NSMutableAttributedString, theme: ReaderTheme) {
        let totalLength = attributed.string.utf16.count
        for span in spans {
            guard span.startIndex >= 0,
                  span.length > 0,
                  span.startIndex + span.length <= totalLength else {
                continue
            }

            let range = NSRange(location: span.startIndex, length: span.length)
            switch span.styleType.lowercased() {
            case "bold":
                attributed.addAttribute(.font, value: theme.boldFont, range: range)
            case "italic":
                attributed.addAttribute(.font, value: theme.italicFont, range: range)
            case "underline":
                attributed.addAttribute(.underlineStyle, value: NSUnderlineStyle.single.rawValue, range: range)
            case "highlight":
                attributed.addAttribute(.backgroundColor, value: theme.manualHighlightColor, range: range)
            case "accent":
                attributed.addAttribute(.foregroundColor, value: theme.accentColor, range: range)
            default:
                break
            }
        }
    }

    private func decodeRichTextOverride(_ data: Data) -> NSAttributedString? {
        let documentTypes: [NSAttributedString.DocumentType] = [.rtfd, .rtf]
        for documentType in documentTypes {
            let options: [NSAttributedString.DocumentReadingOptionKey: Any] = [
                .documentType: documentType
            ]
            if let attributed = try? NSAttributedString(data: data, options: options, documentAttributes: nil) {
                return attributed
            }
        }
        return nil
    }

    private func preparedRichText(_ source: NSAttributedString, theme: ReaderTheme) -> NSAttributedString {
        let mutable = NSMutableAttributedString(attributedString: source)
        let fullRange = NSRange(location: 0, length: mutable.length)
        guard fullRange.length > 0 else { return mutable }

        mutable.enumerateAttribute(.font, in: fullRange) { value, range, _ in
            guard value == nil else { return }
            mutable.addAttribute(.font, value: theme.bodyFont, range: range)
        }

        mutable.enumerateAttribute(.foregroundColor, in: fullRange) { value, range, _ in
            guard value == nil else { return }
            mutable.addAttribute(.foregroundColor, value: PlatformColor.labelCompatible, range: range)
        }

        return mutable
    }
}

private extension PlatformColor {
    static var labelCompatible: PlatformColor {
        #if canImport(UIKit)
        return .label
        #else
        return .labelColor
        #endif
    }
}
