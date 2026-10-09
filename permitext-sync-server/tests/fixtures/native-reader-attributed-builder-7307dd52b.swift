// Exact production builder at 7307dd52b, before per-build font/paragraph reuse.
enum NativeReaderAttributedTextBuilder {
    static func attributedText(
        runs: [NativeReaderRuntimeTextRun],
        fallbackText: String,
        theme: ReaderTheme,
        role: NativeReaderTypographyRole,
        accentColor: UIColor,
        highlightRanges: [NSRange] = [],
        activeHighlightRange: NSRange? = nil
    ) -> NSAttributedString {
        let effectiveRuns = runs.isEmpty
            ? [NativeReaderRuntimeTextRun(text: fallbackText, styles: [], linkTarget: nil)]
            : runs
        let result = NSMutableAttributedString()
        for run in effectiveRuns where !run.text.isEmpty {
            result.append(
                NSAttributedString(
                    string: run.text,
                    attributes: attributes(
                        for: run,
                        theme: theme,
                        role: role,
                        accentColor: accentColor
                    )
                )
            )
        }
        for range in highlightRanges where NSMaxRange(range) <= result.length {
            result.addAttribute(
                .underlineStyle,
                value: NSUnderlineStyle.single.rawValue,
                range: range
            )
        }
        if let activeHighlightRange,
           NSMaxRange(activeHighlightRange) <= result.length {
            result.addAttributes(
                [
                    .underlineColor: UIColor.label,
                    .underlineStyle: NSUnderlineStyle.single.rawValue,
                    .backgroundColor: accentColor.withAlphaComponent(0.20)
                ],
                range: activeHighlightRange
            )
        }
        return result
    }

    private static func attributes(
        for run: NativeReaderRuntimeTextRun,
        theme: ReaderTheme,
        role: NativeReaderTypographyRole,
        accentColor: UIColor
    ) -> [NSAttributedString.Key: Any] {
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = CGFloat(theme.lineSpacing)
        paragraphStyle.paragraphSpacing = 0
        paragraphStyle.lineBreakMode = .byWordWrapping

        var attributes: [NSAttributedString.Key: Any] = [
            .font: font(for: run.styles, theme: theme, role: role),
            .foregroundColor: foregroundColor(for: role, accentColor: accentColor),
            .paragraphStyle: paragraphStyle
        ]
        if run.styles.contains(.underline) {
            attributes[.underlineStyle] = NSUnderlineStyle.single.rawValue
        }
        if run.styles.contains(.strikethrough) {
            attributes[.strikethroughStyle] = NSUnderlineStyle.single.rawValue
        }
        if run.styles.contains(.superscript) {
            attributes[.baselineOffset] = 4
        } else if run.styles.contains(.subscript) {
            attributes[.baselineOffset] = -3
        }
        if let target = run.linkTarget,
           let linkURL = NativeReaderLinkResolver.linkURL(for: target) {
            attributes[.link] = linkURL
            attributes[.foregroundColor] = accentColor
            attributes[.underlineStyle] = NSUnderlineStyle.single.rawValue
        }
        return attributes
    }

    private static func font(
        for styles: [NativeReaderRuntimeTextStyle],
        theme: ReaderTheme,
        role: NativeReaderTypographyRole
    ) -> UIFont {
        let bodySize = max(CGFloat(theme.fontSize), CGFloat(ReaderTheme.minimumFontSize))
        let roleSize: CGFloat
        let textStyle: UIFont.TextStyle
        var wantsBold = styles.contains(.bold)

        switch role {
        case .majorHeading(let level), .heading(let level):
            switch level {
            case ...1:
                roleSize = max(bodySize * 1.65, bodySize + 7)
                textStyle = .title1
            case 2:
                roleSize = max(bodySize * 1.45, bodySize + 5)
                textStyle = .title2
            case 3:
                roleSize = max(bodySize * 1.25, bodySize + 3)
                textStyle = .headline
            default:
                roleSize = max(bodySize * 1.12, bodySize + 1)
                textStyle = .subheadline
            }
            wantsBold = true
        case .body:
            roleSize = bodySize
            textStyle = .body
        case .caption:
            roleSize = max(bodySize * 0.92, 10)
            textStyle = .callout
            wantsBold = true
        case .footnote, .note:
            roleSize = max(bodySize * 0.88, 10)
            textStyle = .footnote
        }

        let effectiveSize = (styles.contains(.small) || styles.contains(.superscript) || styles.contains(.subscript))
            ? roleSize * 0.84
            : roleSize
        let baseFont = theme.bodyFont.withSize(effectiveSize)

        var traits = baseFont.fontDescriptor.symbolicTraits
        if wantsBold { traits.insert(.traitBold) }
        if styles.contains(.italic) { traits.insert(.traitItalic) }
        let styledFont: UIFont
        if let descriptor = baseFont.fontDescriptor.withSymbolicTraits(traits) {
            styledFont = UIFont(descriptor: descriptor, size: effectiveSize)
        } else {
            styledFont = baseFont
        }
        return UIFontMetrics(forTextStyle: textStyle).scaledFont(for: styledFont)
    }

    private static func foregroundColor(
        for role: NativeReaderTypographyRole,
        accentColor: UIColor
    ) -> UIColor {
        switch role {
        case .majorHeading:
            return accentColor
        case .heading:
            return .label
        case .caption, .footnote, .note:
            return .secondaryLabel
        case .body:
            return .label
        }
    }
}
