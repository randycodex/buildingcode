import AppKit
import Foundation
import PDFKit

enum PDFTextExtractor {
    static func extractAttributedText(from url: URL) throws -> NSAttributedString {
        guard let document = PDFDocument(url: url) else {
            throw CocoaError(.fileReadCorruptFile)
        }

        let output = NSMutableAttributedString()

        for pageIndex in 0..<document.pageCount {
            guard let page = document.page(at: pageIndex) else {
                continue
            }

            let pageText = attributedText(for: page)
            guard pageText.length > 0 else {
                continue
            }

            if output.length > 0 {
                output.append(NSAttributedString(string: "\n\n"))
            }

            output.append(pageText)
        }

        return output
    }

    private static func attributedText(for page: PDFPage) -> NSAttributedString {
        guard
            let fullSelection = page.selection(for: NSRange(location: 0, length: page.numberOfCharacters))
        else {
            return NSAttributedString(string: "")
        }

        let lineSelections = fullSelection.selectionsByLine()
        guard !lineSelections.isEmpty else {
            return fallbackAttributedText(for: page)
        }

        let lines = extractedLines(from: lineSelections, on: page)
        if lines.isEmpty {
            return fallbackAttributedText(for: page)
        }

        let output = NSMutableAttributedString()
        var skippedTableBlock = false
        var previousLine: ExtractedLine?

        for line in lines {
            let trimmed = line.text.trimmingCharacters(in: .whitespacesAndNewlines)

            if trimmed.isEmpty {
                if output.length > 0, !output.string.hasSuffix("\n\n") {
                    output.append(NSAttributedString(string: "\n"))
                }
                skippedTableBlock = false
                continue
            }

            if isTableCaption(trimmed) || isLikelyTableRow(trimmed) {
                skippedTableBlock = true
                continue
            }

            if skippedTableBlock, !isNumberedListLine(trimmed) {
                continue
            }

            skippedTableBlock = false

            if let previousLine {
                output.append(NSAttributedString(string: separator(from: previousLine, to: line)))
            }

            output.append(indentationString(for: line, on: page))
            output.append(line.attributedText)
            previousLine = line
        }

        let result = NSMutableAttributedString(attributedString: output)
        while result.string.hasSuffix("\n") {
            result.deleteCharacters(in: NSRange(location: result.length - 1, length: 1))
        }

        return result
    }

    private static func fallbackAttributedText(for page: PDFPage) -> NSAttributedString {
        guard let rawText = page.attributedString ?? page.string.map(NSAttributedString.init(string:)) else {
            return NSAttributedString(string: "")
        }

        return rawText
    }

    private static func extractedLines(from selections: [PDFSelection], on page: PDFPage) -> [ExtractedLine] {
        selections.compactMap { selection in
            guard let attributedText = selection.attributedString else {
                return nil
            }

            let string = attributedText.string
                .replacingOccurrences(of: "\t", with: "    ")
                .trimmingCharacters(in: .newlines)

            guard !string.isEmpty else {
                return nil
            }

            let bounds = selection.bounds(for: page)
            return ExtractedLine(
                text: string,
                attributedText: NSAttributedString(
                    string: string,
                    attributes: normalizedAttributes(from: attributedText)
                ),
                bounds: bounds
            )
        }
        .sorted {
            if abs($0.bounds.minY - $1.bounds.minY) > 1 {
                return $0.bounds.minY > $1.bounds.minY
            }
            return $0.bounds.minX < $1.bounds.minX
        }
    }

    private static func normalizedAttributes(from attributedText: NSAttributedString) -> [NSAttributedString.Key: Any] {
        var attributes = attributedText.attributes(at: 0, effectiveRange: nil)
        if attributes[.font] == nil {
            attributes[.font] = NSFont.systemFont(ofSize: NSFont.systemFontSize)
        }

        let paragraphStyle = (attributes[.paragraphStyle] as? NSParagraphStyle)?.mutableCopy() as? NSMutableParagraphStyle
            ?? NSMutableParagraphStyle()
        paragraphStyle.lineBreakMode = .byWordWrapping
        attributes[.paragraphStyle] = paragraphStyle
        return attributes
    }

    private static func separator(from previous: ExtractedLine, to current: ExtractedLine) -> String {
        let previousMidY = previous.bounds.midY
        let currentMidY = current.bounds.midY
        let verticalGap = previousMidY - currentMidY
        let baselineHeight = max(previous.bounds.height, current.bounds.height, 1)

        if verticalGap > baselineHeight * 2.2 {
            return "\n\n"
        }

        return "\n"
    }

    private static func indentationString(for line: ExtractedLine, on page: PDFPage) -> NSAttributedString {
        let pageWidth = max(page.bounds(for: .cropBox).width, 1)
        let indentRatio = max(line.bounds.minX, 0) / pageWidth
        let spaceCount = Int((indentRatio * 24).rounded(.toNearestOrAwayFromZero))
        guard spaceCount > 0 else {
            return NSAttributedString(string: "")
        }

        let style = NSMutableParagraphStyle()
        style.lineBreakMode = .byWordWrapping
        return NSAttributedString(
            string: String(repeating: " ", count: spaceCount),
            attributes: [
                .font: NSFont.systemFont(ofSize: NSFont.systemFontSize),
                .paragraphStyle: style
            ]
        )
    }

    static func isTableCaption(_ line: String) -> Bool {
        let normalized = line.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        return normalized.hasPrefix("TABLE ") || normalized == "TABLE"
    }

    static func isNumberedListLine(_ line: String) -> Bool {
        let pattern = #"^\s*(?:\(?\d+\)|\d+\.|[A-Za-z]\.|\([A-Za-z]\))\s+\S+"#
        return line.range(of: pattern, options: .regularExpression) != nil
    }

    static func isLikelyTableRow(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return false
        }

        if trimmed.contains("\t") {
            return true
        }

        if trimmed.contains("  ") && !isNumberedListLine(trimmed) {
            return true
        }

        let pipeCount = trimmed.filter { $0 == "|" }.count
        if pipeCount >= 2 {
            return true
        }

        return false
    }
}

private struct ExtractedLine {
    let text: String
    let attributedText: NSAttributedString
    let bounds: CGRect
}
