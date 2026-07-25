import Foundation
import UIKit
import CoreText

/// Generates a multi-page PDF research packet from a set of bookmarked
/// sections. Pure value type — no SwiftUI, no view model coupling. The
/// caller hands in already-loaded bookmarks, a closure for fetching full
/// section bodies, and metadata; the builder writes to a temp file and
/// returns the URL.
///
/// Designed to be invoked from a Task.detached so the heavy text-layout
/// work (CTFramesetter + Core Text drawing) doesn't block the main
/// actor. Progress is reported via an async closure so the view model
/// can update an `@Published` state safely.
struct BookmarkExportBuilder {
    let bookmarks: [BookmarkedSection]
    /// codeSectionID → display name (e.g. "Building Code"). Used for the
    /// eyebrow label above each section. Passed in rather than looked up
    /// internally so the builder stays decoupled from the view model.
    let codeSectionNames: [Int64: String]
    let metadata: ExportMetadata
    /// Async loader for a section's full `officialText`. Falls back to
    /// the bookmark's stored `previewText` if the load returns nil/empty.
    let loadFullBody: (Int64) async -> String?
    /// Progress notifier — `(current, total)`. Invoked between sections.
    let onProgress: @Sendable (Int, Int) async -> Void

    struct ExportMetadata {
        let codeVersionLabel: String
        /// Optional filter context shown in the header — e.g. "Bronx R-2
        /// Passive House" when exporting a project folder.
        let exportContext: String?
        let exportDate: Date
    }

    enum BuildError: Error, LocalizedError {
        case empty
        case cancelled
        case ioFailed(String)

        var errorDescription: String? {
            switch self {
            case .empty: return "There are no bookmarks to export."
            case .cancelled: return "Export was cancelled."
            case .ioFailed(let msg): return msg
            }
        }
    }

    // MARK: - Page metrics (US Letter at 72dpi)

    private let pageSize = CGSize(width: 612, height: 792)
    private let pageMargin = UIEdgeInsets(top: 56, left: 56, bottom: 56, right: 56)
    private var pageContentRect: CGRect {
        CGRect(
            x: pageMargin.left,
            y: pageMargin.top,
            width: pageSize.width - pageMargin.left - pageMargin.right,
            height: pageSize.height - pageMargin.top - pageMargin.bottom
        )
    }

    // MARK: - Entry point

    func build() async throws -> URL {
        guard !bookmarks.isEmpty else { throw BuildError.empty }

        // Fetch all section bodies up front so the text-layout step is pure
        // CPU. Bodies are loaded on the actor that called us (which is
        // already detached) so we don't hop back to MainActor here.
        var bodies: [Int64: String] = [:]
        for (index, bookmark) in bookmarks.enumerated() {
            if Task.isCancelled { throw BuildError.cancelled }
            let body = await loadFullBody(bookmark.id) ?? bookmark.previewText
            bodies[bookmark.id] = body
            await onProgress(index + 1, bookmarks.count)
        }

        let document = composeDocument(bodies: bodies)

        let tempDir = FileManager.default.temporaryDirectory
        let dateStamp = filenameDateFormatter.string(from: metadata.exportDate)
        let url = tempDir.appendingPathComponent("NYC-CC-Saved-\(dateStamp).pdf")

        let renderer = UIGraphicsPDFRenderer(
            bounds: CGRect(origin: .zero, size: pageSize),
            format: pdfFormat()
        )

        do {
            try renderer.writePDF(to: url) { context in
                renderPages(document: document, into: context)
            }
        } catch {
            throw BuildError.ioFailed(error.localizedDescription)
        }

        return url
    }

    // MARK: - Document composition

    /// Builds the single big NSAttributedString that CTFramesetter pages
    /// through. Each section is prefixed with an inline header (code
    /// section, section number + title) and followed by tags/notes blocks
    /// and a divider, all using paragraph attributes that keep visual
    /// rhythm consistent.
    private func composeDocument(bodies: [Int64: String]) -> NSAttributedString {
        let result = NSMutableAttributedString()

        for (index, bookmark) in bookmarks.enumerated() {
            let sectionName = bookmark.codeSectionID
                .flatMap { codeSectionNames[$0] }
                ?? "Saved sections"

            // Code section eyebrow
            result.append(NSAttributedString(
                string: sectionName.uppercased() + "\n",
                attributes: eyebrowAttributes(for: bookmark, sectionName: sectionName)
            ))

            // Section heading: number + title
            let heading = bookmark.kind == .textBlock
                ? bookmark.displayTitle
                : "\(bookmark.sectionNumber)  \(bookmark.displayTitle)"
            result.append(NSAttributedString(
                string: heading + "\n",
                attributes: headingAttributes()
            ))

            // Chapter line (light grey caption)
            result.append(NSAttributedString(
                string: "Chapter \(bookmark.chapterNumber)\n\n",
                attributes: chapterCaptionAttributes()
            ))

            // Body
            let body = (bodies[bookmark.id] ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !body.isEmpty {
                result.append(NSAttributedString(
                    string: body + "\n",
                    attributes: bodyAttributes()
                ))
            }

            // Tags
            if !bookmark.tags.isEmpty {
                result.append(NSAttributedString(
                    string: "\nTags: " + bookmark.tags.joined(separator: " · ") + "\n",
                    attributes: tagsAttributes()
                ))
            }

            // Note
            if bookmark.hasNote && !bookmark.noteBody.isEmpty {
                result.append(NSAttributedString(
                    string: "\nNote\n",
                    attributes: noteLabelAttributes()
                ))
                result.append(NSAttributedString(
                    string: bookmark.noteBody + "\n",
                    attributes: noteBodyAttributes()
                ))
            }

            // Divider between sections (skip after the last)
            if index < bookmarks.count - 1 {
                result.append(NSAttributedString(
                    string: "\n────────\n\n",
                    attributes: dividerAttributes()
                ))
            }
        }

        return result
    }

    // MARK: - Page rendering

    private func renderPages(document: NSAttributedString, into context: UIGraphicsPDFRendererContext) {
        let framesetter = CTFramesetterCreateWithAttributedString(document)
        var currentRange = CFRange(location: 0, length: 0)
        let totalLength = document.length

        // Two-pass page count: first pass just to find the page total so
        // headers can show "Page N of M". This is cheap because we don't
        // draw — only measure visible-range advances.
        let totalPages = countPages(framesetter: framesetter, totalLength: totalLength)

        var pageNumber = 1
        while currentRange.location < totalLength {
            context.beginPage()
            drawPageHeader(in: context.cgContext, pageNumber: pageNumber, totalPages: totalPages)

            let path = CGPath(rect: pageContentRect, transform: nil)
            let frame = CTFramesetterCreateFrame(framesetter, currentRange, path, nil)

            // Flip the coordinate system so Core Text draws with origin at
            // top-left like UIKit expects. We restore it after each page.
            let cg = context.cgContext
            cg.saveGState()
            cg.translateBy(x: 0, y: pageSize.height)
            cg.scaleBy(x: 1, y: -1)
            CTFrameDraw(frame, cg)
            cg.restoreGState()

            let visible = CTFrameGetVisibleStringRange(frame)
            currentRange.location += visible.length
            pageNumber += 1
        }
    }

    private func countPages(framesetter: CTFramesetter, totalLength: Int) -> Int {
        var current = CFRange(location: 0, length: 0)
        var pages = 0
        while current.location < totalLength {
            pages += 1
            let path = CGPath(rect: pageContentRect, transform: nil)
            let frame = CTFramesetterCreateFrame(framesetter, current, path, nil)
            let visible = CTFrameGetVisibleStringRange(frame)
            guard visible.length > 0 else { break }     // safety against infinite loop
            current.location += visible.length
        }
        return max(pages, 1)
    }

    private func drawPageHeader(in context: CGContext, pageNumber: Int, totalPages: Int) {
        let headerY = pageMargin.top - 28
        let leftTitle = metadata.codeVersionLabel
        let rightTitle: String = {
            if let context = metadata.exportContext, !context.isEmpty {
                return "\(context) · Page \(pageNumber) of \(totalPages)"
            }
            return "Page \(pageNumber) of \(totalPages)"
        }()
        let dateLine = "Exported " + headerDateFormatter.string(from: metadata.exportDate)

        let attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 9, weight: .medium),
            .foregroundColor: UIColor(white: 0.4, alpha: 1.0)
        ]

        NSAttributedString(string: leftTitle, attributes: attrs).draw(
            at: CGPoint(x: pageMargin.left, y: headerY)
        )
        let rightString = NSAttributedString(string: rightTitle, attributes: attrs)
        let rightSize = rightString.size()
        rightString.draw(at: CGPoint(
            x: pageSize.width - pageMargin.right - rightSize.width,
            y: headerY
        ))

        // Date line below left title
        NSAttributedString(string: dateLine, attributes: attrs).draw(
            at: CGPoint(x: pageMargin.left, y: headerY + 12)
        )

        // Thin rule
        context.setStrokeColor(UIColor(white: 0.7, alpha: 1.0).cgColor)
        context.setLineWidth(0.5)
        context.move(to: CGPoint(x: pageMargin.left, y: pageMargin.top - 2))
        context.addLine(to: CGPoint(x: pageSize.width - pageMargin.right, y: pageMargin.top - 2))
        context.strokePath()
    }

    // MARK: - PDF format

    private func pdfFormat() -> UIGraphicsPDFRendererFormat {
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = [
            kCGPDFContextTitle as String: "NYC Construction Codes — Saved Sections",
            kCGPDFContextAuthor as String: "NYC CC App",
            kCGPDFContextCreator as String: "NYC CC App"
        ]
        return format
    }

    // MARK: - Attributed-string styles

    private func eyebrowAttributes(
        for bookmark: BookmarkedSection,
        sectionName: String
    ) -> [NSAttributedString.Key: Any] {
        let paragraph = NSMutableParagraphStyle()
        paragraph.paragraphSpacingBefore = 12
        paragraph.paragraphSpacing = 4
        return [
            .font: UIFont.systemFont(ofSize: 9, weight: .bold),
            .foregroundColor: BookmarkExportColors.uiColor(forCodeSectionName: sectionName),
            .kern: 1.0,
            .paragraphStyle: paragraph
        ]
    }

    private func headingAttributes() -> [NSAttributedString.Key: Any] {
        let paragraph = NSMutableParagraphStyle()
        paragraph.paragraphSpacing = 2
        return [
            .font: UIFont.systemFont(ofSize: 14, weight: .semibold),
            .foregroundColor: UIColor.black,
            .paragraphStyle: paragraph
        ]
    }

    private func chapterCaptionAttributes() -> [NSAttributedString.Key: Any] {
        [
            .font: UIFont.systemFont(ofSize: 9, weight: .regular),
            .foregroundColor: UIColor(white: 0.45, alpha: 1)
        ]
    }

    private func bodyAttributes() -> [NSAttributedString.Key: Any] {
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = 3
        paragraph.paragraphSpacing = 6
        paragraph.alignment = .natural
        return [
            .font: UIFont.systemFont(ofSize: 11, weight: .regular),
            .foregroundColor: UIColor(white: 0.15, alpha: 1),
            .paragraphStyle: paragraph
        ]
    }

    private func tagsAttributes() -> [NSAttributedString.Key: Any] {
        [
            .font: UIFont.systemFont(ofSize: 9, weight: .medium),
            .foregroundColor: UIColor(white: 0.35, alpha: 1)
        ]
    }

    private func noteLabelAttributes() -> [NSAttributedString.Key: Any] {
        [
            .font: UIFont.systemFont(ofSize: 9, weight: .bold),
            .foregroundColor: UIColor(white: 0.3, alpha: 1),
            .kern: 0.8
        ]
    }

    private func noteBodyAttributes() -> [NSAttributedString.Key: Any] {
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = 2
        paragraph.paragraphSpacing = 6
        return [
            .font: UIFont.italicSystemFont(ofSize: 10.5),
            .foregroundColor: UIColor(white: 0.2, alpha: 1),
            .paragraphStyle: paragraph
        ]
    }

    private func dividerAttributes() -> [NSAttributedString.Key: Any] {
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        return [
            .font: UIFont.systemFont(ofSize: 9, weight: .regular),
            .foregroundColor: UIColor(white: 0.7, alpha: 1),
            .paragraphStyle: paragraph
        ]
    }

    // MARK: - Date formatters

    private var headerDateFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateStyle = .long
        f.timeStyle = .short
        return f
    }

    private var filenameDateFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }
}

/// Lookup table that mirrors CodeLibraryViewModel.accentColor(for:) — the
/// PDF builder is intentionally decoupled from the view model so it can
/// run on Task.detached without MainActor hops, so we duplicate the color
/// resolution here based on the code section *name* the bookmark already
/// carries.
enum BookmarkExportColors {
    static func uiColor(forCodeSectionName name: String) -> UIColor {
        let lowered = name.lowercased()
        if lowered.contains("building") { return UIColor(red: 0.85, green: 0.43, blue: 0.13, alpha: 1) }
        if lowered.contains("fuel gas")  { return UIColor(red: 0.81, green: 0.27, blue: 0.27, alpha: 1) }
        if lowered.contains("mechanical") { return UIColor(red: 0.27, green: 0.62, blue: 0.40, alpha: 1) }
        if lowered.contains("plumbing")   { return UIColor(red: 0.31, green: 0.49, blue: 0.83, alpha: 1) }
        if lowered.contains("administrative") || lowered.contains("general") {
            return UIColor(red: 0.46, green: 0.30, blue: 0.78, alpha: 1)
        }
        return UIColor.darkGray
    }
}

/// Renders the shared immutable Report Manifest into a compact native iOS PDF.
/// The web client intentionally uses a richer layout; both renderers preserve
/// the same semantic items, classifications, report version, and content hash.
struct ProjectReportExportBuilder: Sendable {
    let manifest: ProjectReportManifest

    private let pageSize = CGSize(width: 612, height: 792)
    private let pageMargin = UIEdgeInsets(top: 58, left: 52, bottom: 56, right: 52)
    private var presentationAccent: UIColor {
        PlatformColor(hex: manifest.presentation?.branding.accentColorHex ?? "#a65318")
            ?? UIColor(red: 0.66, green: 0.31, blue: 0.08, alpha: 1)
    }
    private var reportCoverLabel: String {
        manifest.presentation?.template.coverLabel ?? "Permitext Project Report"
    }
    private var reportBrandName: String {
        manifest.presentation?.branding.displayName ?? "Permitext"
    }

    func build() throws -> URL {
        guard !manifest.items.isEmpty else {
            throw BookmarkExportBuilder.BuildError.empty
        }
        let document = composeDocument()
        let dateStamp = String(manifest.reportDate.prefix(10))
        let filename = sanitizedFilename(manifest.title)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(filename)-v\(manifest.reportVersion)-\(dateStamp).pdf")
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = [
            kCGPDFContextTitle as String: manifest.title,
            kCGPDFContextAuthor as String: manifest.author.displayName,
            kCGPDFContextCreator as String: "Permitext iOS \(manifest.generatorVersion)",
            kCGPDFContextSubject as String: "Immutable Permitext Project Report \(manifest.contentHash)"
        ]
        let renderer = UIGraphicsPDFRenderer(
            bounds: CGRect(origin: .zero, size: pageSize),
            format: format
        )
        do {
            try renderer.writePDF(to: url) { context in
                render(document: document, into: context)
            }
        } catch {
            throw BookmarkExportBuilder.BuildError.ioFailed(error.localizedDescription)
        }
        return url
    }

    private func composeDocument() -> NSAttributedString {
        let result = NSMutableAttributedString()
        append(
            "\(reportCoverLabel.uppercased())\n",
            to: result,
            font: .systemFont(ofSize: 10, weight: .bold),
            color: presentationAccent,
            spacingAfter: 8,
            kern: 1.1
        )
        if reportBrandName.lowercased() != reportCoverLabel.lowercased() {
            let brandLine = [
                reportBrandName,
                manifest.presentation?.branding.website
            ].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
            append(
                "\(brandLine)\n",
                to: result,
                font: .systemFont(ofSize: 9, weight: .semibold),
                color: UIColor(white: 0.35, alpha: 1),
                spacingAfter: 8
            )
        }
        append(
            "\(manifest.title)\n",
            to: result,
            font: .systemFont(ofSize: 26, weight: .bold),
            spacingAfter: 10
        )
        append(
            "\(manifest.project.name)\n",
            to: result,
            font: .systemFont(ofSize: 16, weight: .semibold),
            spacingAfter: 4
        )
        let reportMetadata = [
            manifest.project.address,
            formattedDate(manifest.reportDate),
            manifest.author.displayName,
            "Report version \(manifest.reportVersion)",
            manifest.codeEdition
        ].filter { !$0.isEmpty }.joined(separator: " · ")
        append(
            "\(reportMetadata)\n\n",
            to: result,
            font: .systemFont(ofSize: 9.5),
            color: UIColor(white: 0.35, alpha: 1),
            spacingAfter: 18
        )

        for item in manifest.items.sorted(by: { $0.order < $1.order }) {
            appendManifestItem(item, to: result)
        }

        append(
            "PROFESSIONAL-USE NOTICE\n",
            to: result,
            font: .systemFont(ofSize: 9, weight: .bold),
            color: UIColor(white: 0.3, alpha: 1),
            spacingBefore: 18,
            spacingAfter: 6,
            kern: 0.8
        )
        for disclaimer in manifest.disclaimers {
            append(
                "• \(disclaimer)\n",
                to: result,
                font: .systemFont(ofSize: 8.5),
                color: UIColor(white: 0.35, alpha: 1),
                spacingAfter: 4
            )
        }
        append(
            [
                manifest.presentation?.branding.footerText,
                "Manifest \(manifest.id)",
                "\(manifest.generatorVersion) · SHA-256 \(manifest.contentHash)"
            ].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: "\n"),
            to: result,
            font: .monospacedSystemFont(ofSize: 7, weight: .regular),
            color: UIColor(white: 0.5, alpha: 1),
            spacingBefore: 8
        )
        return result
    }

    private func appendManifestItem(
        _ item: ProjectReportManifestItem,
        to result: NSMutableAttributedString
    ) {
        if item.kind == "heading" {
            append(
                "\(item.text ?? "Report section")\n",
                to: result,
                font: .systemFont(ofSize: 17, weight: .bold),
                spacingBefore: 16,
                spacingAfter: 8
            )
            return
        }
        if item.kind == "paragraph" {
            append(
                "\(item.text ?? "")\n",
                to: result,
                font: .systemFont(ofSize: 10.5),
                spacingAfter: 8
            )
            return
        }
        if item.kind == "list" {
            for value in item.items ?? [] {
                append(
                    "• \(value)\n",
                    to: result,
                    font: .systemFont(ofSize: 10.5),
                    spacingAfter: 3
                )
            }
            return
        }

        append(
            "\(classificationLabel(item.sourceClassification).uppercased())\n",
            to: result,
            font: .systemFont(ofSize: 8, weight: .bold),
            color: classificationColor(item.sourceClassification),
            spacingBefore: 12,
            spacingAfter: 5,
            kern: 0.7
        )
        switch item.kind {
        case "evidence":
            let heading = [
                item.codeBook,
                item.sectionNumber,
                item.title
            ].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
            append(
                "\(heading)\n",
                to: result,
                font: .systemFont(ofSize: 13, weight: .semibold),
                spacingAfter: 5
            )
            append(
                "\(item.passageText ?? "")\n",
                to: result,
                font: .systemFont(ofSize: 10),
                color: UIColor(white: 0.18, alpha: 1),
                spacingAfter: 10,
                leftIndent: 12
            )
        case "notebookCard":
            append(
                "\(item.title ?? "Notebook card")\n",
                to: result,
                font: .systemFont(ofSize: 13, weight: .semibold),
                spacingAfter: 5
            )
            append(
                "\(item.plainText ?? "")\n",
                to: result,
                font: .systemFont(ofSize: 10.5),
                spacingAfter: 10
            )
        case "researchAnswer":
            append(
                "\(item.question ?? "Research question")\n",
                to: result,
                font: .systemFont(ofSize: 13, weight: .semibold),
                spacingAfter: 5
            )
            append(
                "Supported conclusion\n",
                to: result,
                font: .systemFont(ofSize: 9, weight: .bold),
                spacingAfter: 2
            )
            append(
                "\(item.conclusion ?? "")\n",
                to: result,
                font: .systemFont(ofSize: 10.5),
                spacingAfter: 6
            )
            if let explanation = item.explanation, !explanation.isEmpty {
                append(
                    "\(explanation)\n",
                    to: result,
                    font: .systemFont(ofSize: 10),
                    spacingAfter: 7
                )
            }
            appendBullets("Assumptions", values: item.assumptions, to: result)
            appendBullets("Missing Project facts", values: item.missingFacts, to: result)
            appendBullets("Limitations", values: item.limitations, to: result)
            appendBullets(
                "Additional evidence needed",
                values: item.additionalEvidenceNeeded,
                to: result
            )
            let citations = (item.citations ?? []).map { citation in
                ([citation.sectionID].compactMap { $0 } + (citation.sourceIDs ?? []))
                    .joined(separator: " · ")
            }
            appendBullets("Citations", values: citations, to: result)
        default:
            append(
                "\(item.title ?? "Project material")\n",
                to: result,
                font: .systemFont(ofSize: 13, weight: .semibold),
                spacingAfter: 4
            )
            append(
                "\((item.contentType ?? "Included Project material"))\n",
                to: result,
                font: .systemFont(ofSize: 10),
                spacingAfter: 10
            )
        }
    }

    private func appendBullets(
        _ heading: String,
        values: [String]?,
        to result: NSMutableAttributedString
    ) {
        let normalized = (values ?? []).filter { !$0.isEmpty }
        guard !normalized.isEmpty else { return }
        append(
            "\(heading)\n",
            to: result,
            font: .systemFont(ofSize: 8.5, weight: .bold),
            color: UIColor(white: 0.35, alpha: 1),
            spacingBefore: 4,
            spacingAfter: 2,
            kern: 0.4
        )
        for value in normalized {
            append(
                "• \(value)\n",
                to: result,
                font: .systemFont(ofSize: 9.5),
                spacingAfter: 2,
                leftIndent: 10
            )
        }
    }

    private func append(
        _ string: String,
        to result: NSMutableAttributedString,
        font: UIFont,
        color: UIColor = .black,
        spacingBefore: CGFloat = 0,
        spacingAfter: CGFloat = 0,
        kern: CGFloat = 0,
        leftIndent: CGFloat = 0
    ) {
        let paragraph = NSMutableParagraphStyle()
        paragraph.paragraphSpacingBefore = spacingBefore
        paragraph.paragraphSpacing = spacingAfter
        paragraph.lineSpacing = 2.5
        paragraph.firstLineHeadIndent = leftIndent
        paragraph.headIndent = leftIndent
        result.append(NSAttributedString(
            string: string,
            attributes: [
                .font: font,
                .foregroundColor: color,
                .kern: kern,
                .paragraphStyle: paragraph
            ]
        ))
    }

    private func render(
        document: NSAttributedString,
        into context: UIGraphicsPDFRendererContext
    ) {
        let framesetter = CTFramesetterCreateWithAttributedString(document)
        var location = 0
        let contentRect = CGRect(
            x: pageMargin.left,
            y: pageMargin.top,
            width: pageSize.width - pageMargin.left - pageMargin.right,
            height: pageSize.height - pageMargin.top - pageMargin.bottom
        )
        while location < document.length {
            context.beginPage()
            drawPageHeader(in: context.cgContext)
            let path = CGMutablePath()
            path.addRect(contentRect)
            let frame = CTFramesetterCreateFrame(
                framesetter,
                CFRange(location: location, length: 0),
                path,
                nil
            )
            context.cgContext.saveGState()
            context.cgContext.textMatrix = .identity
            context.cgContext.translateBy(x: 0, y: pageSize.height)
            context.cgContext.scaleBy(x: 1, y: -1)
            CTFrameDraw(frame, context.cgContext)
            context.cgContext.restoreGState()
            let visible = CTFrameGetVisibleStringRange(frame)
            guard visible.length > 0 else { break }
            location += visible.length
        }
    }

    private func drawPageHeader(in context: CGContext) {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 7.5, weight: .semibold),
            .foregroundColor: UIColor(white: 0.45, alpha: 1)
        ]
        NSAttributedString(
            string: "\(reportBrandName.uppercased()) · \(manifest.project.name) · REPORT V\(manifest.reportVersion)",
            attributes: attributes
        ).draw(at: CGPoint(x: pageMargin.left, y: 31))
        context.setStrokeColor(UIColor(white: 0.78, alpha: 1).cgColor)
        context.setLineWidth(0.5)
        context.move(to: CGPoint(x: pageMargin.left, y: 45))
        context.addLine(to: CGPoint(x: pageSize.width - pageMargin.right, y: 45))
        context.strokePath()
    }

    private func classificationLabel(_ value: String) -> String {
        switch value {
        case "published-code": return "Published code"
        case "user-authored": return "User-authored"
        case "ai-assisted": return "AI-assisted Research"
        case "project-material": return "Project material"
        default: return "Project content"
        }
    }

    private func classificationColor(_ value: String) -> UIColor {
        switch value {
        case "published-code":
            return UIColor(red: 0.66, green: 0.31, blue: 0.08, alpha: 1)
        case "ai-assisted":
            return UIColor(red: 0.28, green: 0.36, blue: 0.62, alpha: 1)
        case "user-authored":
            return UIColor(red: 0.42, green: 0.28, blue: 0.58, alpha: 1)
        default:
            return UIColor(white: 0.35, alpha: 1)
        }
    }

    private func formattedDate(_ value: String) -> String {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
        guard let date else { return String(value.prefix(10)) }
        return date.formatted(date: .long, time: .omitted)
    }

    private func sanitizedFilename(_ value: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        let normalized = value
            .replacingOccurrences(of: " ", with: "-")
            .unicodeScalars
            .map { allowed.contains($0) ? String($0) : "" }
            .joined()
        return normalized.isEmpty ? "Permitext-Project-Report" : String(normalized.prefix(80))
    }
}
