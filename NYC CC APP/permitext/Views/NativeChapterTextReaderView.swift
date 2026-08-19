import SwiftUI
import UIKit

struct NativeChapterTextReaderView: View {
    let chapter: CodeChapter
    let initialSectionNumber: String
    let initialAnchorID: String?
    let route: NativeReaderDocumentRoute
    var rememberedBlockID: Binding<String?> = .constant(nil)
    var rememberedAnchorID: Binding<String?> = .constant(nil)
    var onFallbackToHTML: ((String) -> Void)?

    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.openURL) private var openURL
    @State private var document: NativeReaderRuntimeDocument?
    @State private var displayBlocks: [NativeReaderDisplayBlock] = []
    @State private var visibleBlockID: String?
    @State private var pendingInitialBlockID: String?
    @State private var failureMessage: String?
    @State private var hasRequestedFallback = false

    private var accentColor: Color {
        Color(uiColor: library.accentColor(for: chapter.codeSectionID))
    }

    var body: some View {
        ScrollViewReader { proxy in
            Group {
                if let document {
                    reader(document: document, proxy: proxy)
                } else if let failureMessage {
                    failureView(message: failureMessage)
                } else {
                    ProgressView("Preparing native text…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .task(id: route.id) {
                await loadDocument()
            }
        }
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
    }

    private func reader(
        document: NativeReaderRuntimeDocument,
        proxy: ScrollViewProxy
    ) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(displayBlocks) { displayBlock in
                    NativeReaderTextBlockView(
                        block: displayBlock.block,
                        hierarchyIndentation: displayBlock.hierarchyIndentation,
                        usesCompactSpacing: displayBlock.usesCompactSpacing,
                        theme: library.readerTheme,
                        accentColor: library.accentColor(for: chapter.codeSectionID),
                        onOpenLink: { url in
                            handleLink(url, document: document, proxy: proxy)
                        }
                    )
                    .id(displayBlock.id)
                }
            }
            .padding(.horizontal, CodeScreenMetrics.readerHorizontalPadding)
            .padding(.top, CodeScreenMetrics.topTitlePadding)
            .padding(.bottom, 28)
            .scrollTargetLayout()
        }
        .scrollPosition(id: $visibleBlockID, anchor: .top)
        .onChange(of: visibleBlockID) { _, newValue in
            guard pendingInitialBlockID == nil else { return }
            persistLocation(blockID: newValue, document: document)
        }
        .task(id: pendingInitialBlockID) {
            await restoreInitialPosition(document: document, proxy: proxy)
        }
        .overlay(alignment: .top) {
            CodeTopContentFade(alwaysVisible: true)
        }
    }

    private func failureView(message: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Using HTML reader", systemImage: "arrow.uturn.backward.circle.fill")
                .font(.headline)
                .foregroundStyle(accentColor)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(24)
    }

    @MainActor
    private func loadDocument() async {
        document = nil
        displayBlocks = []
        pendingInitialBlockID = nil
        visibleBlockID = nil
        failureMessage = nil
        hasRequestedFallback = false

        do {
            let loaded = try await NativeReaderDocumentStore.shared.loadDocument(for: route)
            guard !Task.isCancelled else { return }
            let initialBlockID = NativeReaderLocationResolver.initialBlockID(
                in: loaded,
                rememberedBlockID: rememberedBlockID.wrappedValue,
                rememberedAnchorID: rememberedAnchorID.wrappedValue,
                initialAnchorID: initialAnchorID,
                initialSectionNumber: initialSectionNumber
            )
            displayBlocks = NativeReaderDisplayBlock.blocks(from: loaded.blocks)
            document = loaded
            persistLocation(blockID: initialBlockID, document: loaded)
            guard initialBlockID != loaded.blocks.first?.id else {
                return
            }
            pendingInitialBlockID = initialBlockID
        } catch {
            guard !Task.isCancelled else { return }
            let message = error.localizedDescription
            failureMessage = message
            guard !hasRequestedFallback else { return }
            hasRequestedFallback = true
            onFallbackToHTML?(message)
        }
    }

    @MainActor
    private func restoreInitialPosition(
        document: NativeReaderRuntimeDocument,
        proxy: ScrollViewProxy
    ) async {
        guard let targetBlockID = pendingInitialBlockID else { return }

        // The lazy stack is inserted only after the document finishes loading.
        // Give SwiftUI a layout pass before asking its proxy for an off-screen
        // target, then repeat once for slower physical-device layout.
        await Task.yield()
        try? await Task.sleep(for: .milliseconds(60))
        guard !Task.isCancelled, pendingInitialBlockID == targetBlockID else { return }
        visibleBlockID = targetBlockID
        proxy.scrollTo(targetBlockID, anchor: .top)

        try? await Task.sleep(for: .milliseconds(120))
        guard !Task.isCancelled, pendingInitialBlockID == targetBlockID else { return }
        proxy.scrollTo(targetBlockID, anchor: .top)
        pendingInitialBlockID = nil
        persistLocation(blockID: targetBlockID, document: document)
    }

    private func persistLocation(blockID: String?, document: NativeReaderRuntimeDocument) {
        guard let blockID,
              NativeReaderDisplayBlock.sourceBlockID(for: blockID, in: document) != nil
        else {
            return
        }
        if rememberedBlockID.wrappedValue != blockID {
            rememberedBlockID.wrappedValue = blockID
        }
        if let anchorID = NativeReaderLocationResolver.anchorID(for: blockID, in: document),
           rememberedAnchorID.wrappedValue != anchorID {
            rememberedAnchorID.wrappedValue = anchorID
        }
    }

    private func handleLink(
        _ url: URL,
        document: NativeReaderRuntimeDocument,
        proxy: ScrollViewProxy
    ) {
        if let fragment = url.fragment?.removingPercentEncoding,
           let blockID = NativeReaderLocationResolver.blockID(forAnchorID: fragment, in: document) {
            visibleBlockID = blockID
            persistLocation(blockID: blockID, document: document)
            withAnimation(.easeInOut(duration: 0.2)) {
                proxy.scrollTo(blockID, anchor: .top)
            }
            return
        }
        guard url.scheme != nil else { return }
        openURL(url)
    }
}

struct NativeReaderDisplayBlock: Identifiable, Equatable {
    let id: String
    let sourceBlockID: String
    let block: NativeReaderRuntimeBlock
    let hierarchyIndentation: CGFloat
    let usesCompactSpacing: Bool

    static func blocks(from blocks: [NativeReaderRuntimeBlock]) -> [NativeReaderDisplayBlock] {
        var currentIndentation: CGFloat = 0
        return blocks.flatMap { block in
            if block.kind == .heading {
                currentIndentation = NativeReaderHeadingPresentation(block: block).indentation
            }
            let expandedBlocks = provisionDisplayBlocks(from: block)
            return expandedBlocks.map { expandedBlock in
                NativeReaderDisplayBlock(
                    id: expandedBlock.block.id,
                    sourceBlockID: block.id,
                    block: expandedBlock.block,
                    hierarchyIndentation: currentIndentation,
                    usesCompactSpacing: expandedBlock.usesCompactSpacing
                )
            }
        }
    }

    static func sourceBlockID(
        for displayBlockID: String,
        in document: NativeReaderRuntimeDocument
    ) -> String? {
        document.blocks.first(where: { block in
            displayBlockID == block.id || displayBlockID.hasPrefix(block.id + "::segment-")
        })?.id
    }

    private static func provisionDisplayBlocks(
        from block: NativeReaderRuntimeBlock
    ) -> [(block: NativeReaderRuntimeBlock, usesCompactSpacing: Bool)] {
        guard block.kind == .paragraph else {
            return [(block, false)]
        }

        let sourceRuns = block.runs.isEmpty
            ? [NativeReaderRuntimeTextRun(text: block.plainText, styles: [], linkTarget: nil)]
            : block.runs
        let lines = textLines(from: sourceRuns)
        guard lines.filter({ isProvisionLine(text(from: $0)) }).count >= 2 else {
            return [(block, false)]
        }

        var segments: [[NativeReaderRuntimeTextRun]] = []
        var currentSegment: [NativeReaderRuntimeTextRun] = []
        for line in lines {
            if isProvisionLine(text(from: line)), !currentSegment.isEmpty {
                segments.append(currentSegment)
                currentSegment = []
            }
            if !currentSegment.isEmpty {
                currentSegment.append(
                    NativeReaderRuntimeTextRun(text: "\n", styles: [], linkTarget: nil)
                )
            }
            currentSegment.append(contentsOf: line)
        }
        if !currentSegment.isEmpty {
            segments.append(currentSegment)
        }

        return segments.enumerated().map { index, runs in
            let displayID = index == 0 ? block.id : block.id + "::segment-" + String(index)
            return (
                NativeReaderRuntimeBlock(
                    id: displayID,
                    kind: block.kind,
                    sourceOrder: block.sourceOrder,
                    sectionID: block.sectionID,
                    anchorIDs: block.anchorIDs,
                    plainText: text(from: runs),
                    runs: runs,
                    headingLevel: block.headingLevel,
                    listItems: block.listItems
                ),
                true
            )
        }
    }

    private static func textLines(
        from runs: [NativeReaderRuntimeTextRun]
    ) -> [[NativeReaderRuntimeTextRun]] {
        var lines: [[NativeReaderRuntimeTextRun]] = [[]]
        for run in runs {
            let fragments = run.text.split(separator: "\n", omittingEmptySubsequences: false)
            for (index, fragment) in fragments.enumerated() {
                if index > 0 {
                    lines.append([])
                }
                guard !fragment.isEmpty else { continue }
                lines[lines.count - 1].append(
                    NativeReaderRuntimeTextRun(
                        text: String(fragment),
                        styles: run.styles,
                        linkTarget: run.linkTarget
                    )
                )
            }
        }
        return lines.filter { !text(from: $0).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    private static func text(from runs: [NativeReaderRuntimeTextRun]) -> String {
        runs.map(\.text).joined()
    }

    private static func isProvisionLine(_ text: String) -> Bool {
        guard let token = text
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(whereSeparator: { $0.isWhitespace })
            .first
        else {
            return false
        }
        let number = token.trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
        let components = number.split(separator: ".")
        return components.count >= 2
            && components.first?.count == 3
            && components.allSatisfy { !$0.isEmpty && $0.allSatisfy(\.isNumber) }
    }
}

enum NativeReaderLocationResolver {
    static func initialBlockID(
        in document: NativeReaderRuntimeDocument,
        rememberedBlockID: String?,
        rememberedAnchorID: String?,
        initialAnchorID: String?,
        initialSectionNumber: String
    ) -> String? {
        if let rememberedBlockID,
           NativeReaderDisplayBlock.blocks(from: document.blocks)
               .contains(where: { $0.id == rememberedBlockID }) {
            return rememberedBlockID
        }
        for anchorID in [rememberedAnchorID, initialAnchorID].compactMap({ $0 }) {
            if let blockID = blockID(forAnchorID: anchorID, in: document) {
                return blockID
            }
        }

        let normalizedSection = normalizedSectionNumber(initialSectionNumber)
        if !normalizedSection.isEmpty,
           let heading = document.blocks.first(where: { block in
               guard block.kind == .heading else { return false }
               let normalizedHeading = normalizedSectionNumber(block.plainText)
               return normalizedHeading == normalizedSection
                   || normalizedHeading.hasPrefix(normalizedSection + " ")
                   || normalizedHeading.contains(" " + normalizedSection + " ")
           }) {
            return heading.id
        }
        return document.blocks.first?.id
    }

    static func blockID(
        forAnchorID anchorID: String,
        in document: NativeReaderRuntimeDocument
    ) -> String? {
        let normalizedAnchor = anchorID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedAnchor.isEmpty else { return nil }
        if let mapped = document.anchors.first(where: { $0.id == normalizedAnchor })?.blockID,
           document.blocks.contains(where: { $0.id == mapped }) {
            return mapped
        }
        return document.blocks.first(where: {
            $0.sectionID == normalizedAnchor || $0.anchorIDs.contains(normalizedAnchor)
        })?.id
    }

    static func anchorID(
        for blockID: String,
        in document: NativeReaderRuntimeDocument
    ) -> String? {
        let sourceBlockID = NativeReaderDisplayBlock.sourceBlockID(for: blockID, in: document)
        if let block = document.blocks.first(where: { $0.id == sourceBlockID }) {
            if let anchorID = block.anchorIDs.first {
                return anchorID
            }
            if let sectionID = block.sectionID {
                return sectionID
            }
        }
        return document.anchors.first(where: { $0.blockID == sourceBlockID })?.id
    }

    private static func normalizedSectionNumber(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .uppercased()
    }
}

private struct NativeReaderTextBlockView: View {
    let block: NativeReaderRuntimeBlock
    let hierarchyIndentation: CGFloat
    let usesCompactSpacing: Bool
    let theme: ReaderTheme
    let accentColor: UIColor
    let onOpenLink: (URL) -> Void

    var body: some View {
        Group {
            switch block.kind {
            case .heading:
                heading
            case .paragraph:
                selectableText(role: .body)
            case .orderedList, .unorderedList:
                NativeReaderListBlockView(
                    items: block.listItems,
                    ordered: block.kind == .orderedList,
                    theme: theme,
                    accentColor: accentColor,
                    onOpenLink: onOpenLink
                )
            case .caption:
                selectableText(role: .caption)
            case .footnote:
                selectableText(role: .footnote)
            case .sourceNote, .editorNote:
                selectableText(role: .note)
                    .padding(12)
                    .background(Color(uiColor: accentColor).opacity(0.09))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            case .divider:
                Divider()
            case .table, .image, .figure, .unsupportedHTML:
                EmptyView()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.leading, block.kind == .heading ? 0 : hierarchyIndentation)
        .padding(.bottom, bottomSpacing)
    }

    @ViewBuilder
    private var heading: some View {
        let presentation = NativeReaderHeadingPresentation(block: block)
        switch presentation.style {
        case .chapter:
            selectableText(role: .majorHeading(level: presentation.level))
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
        case .majorSection:
            selectableText(role: .majorHeading(level: presentation.level))
                .accessibilityAddTraits(.isHeader)
        case .provision:
            selectableText(role: .heading(level: presentation.level))
                .padding(.leading, 12)
                .overlay(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                        .fill(Color(uiColor: accentColor))
                        .frame(width: 3)
                }
                .padding(.leading, presentation.indentation)
                .accessibilityAddTraits(.isHeader)
        }
    }

    private func selectableText(role: NativeReaderTypographyRole) -> some View {
        AttributedTextView(
            attributedText: NativeReaderAttributedTextBuilder.attributedText(
                runs: block.runs,
                fallbackText: block.plainText,
                theme: theme,
                role: role,
                accentColor: accentColor
            ),
            onOpenLink: onOpenLink
        )
    }

    private var bottomSpacing: CGFloat {
        switch block.kind {
        case .heading:
            return NativeReaderHeadingPresentation(block: block).level <= 2 ? 14 : 8
        case .paragraph, .orderedList, .unorderedList:
            if usesCompactSpacing {
                return 3
            }
            return max(CGFloat(theme.paragraphSpacing), 8)
        case .sourceNote, .editorNote:
            return 14
        case .caption, .footnote:
            return 8
        case .divider:
            return 16
        case .table, .image, .figure, .unsupportedHTML:
            return 0
        }
    }
}

struct NativeReaderHeadingPresentation: Equatable {
    enum Style: Equatable {
        case chapter
        case majorSection
        case provision
    }

    let level: Int
    let style: Style

    init(level: Int, style: Style) {
        self.level = level
        self.style = style
    }

    init(block: NativeReaderRuntimeBlock) {
        let text = block.plainText.trimmingCharacters(in: .whitespacesAndNewlines)
        let uppercaseText = text.uppercased()
        let sourceLevel = min(max(block.headingLevel ?? 3, 1), 6)

        if sourceLevel == 1 || uppercaseText.hasPrefix("CHAPTER ") {
            level = 1
            style = .chapter
        } else if sourceLevel == 2
                    || uppercaseText.hasPrefix("SECTION ")
                    || uppercaseText.hasPrefix("ARTICLE ")
                    || uppercaseText.hasPrefix("PART ") {
            level = 2
            style = .majorSection
        } else {
            level = Self.provisionLevel(text: text, fallback: sourceLevel)
            style = .provision
        }
    }

    var indentation: CGFloat {
        CGFloat(max(level - 3, 0)) * 12
    }

    private static func provisionLevel(text: String, fallback: Int) -> Int {
        guard let token = text.split(whereSeparator: { $0.isWhitespace }).first else {
            return max(fallback, 3)
        }
        let number = token.trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
        let components = number.split(separator: ".")
        guard components.count >= 2,
              components.allSatisfy({ !$0.isEmpty && $0.allSatisfy(\.isNumber) })
        else {
            return max(fallback, 3)
        }
        return min(3 + max(components.count - 2, 0), 6)
    }
}

private struct NativeReaderListBlockView: View {
    let items: [NativeReaderRuntimeListItem]
    let ordered: Bool
    let theme: ReaderTheme
    let accentColor: UIColor
    let onOpenLink: (URL) -> Void

    private var rows: [NativeReaderListRow] {
        items.flatMap { NativeReaderListRow.flatten($0) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            ForEach(rows) { row in
                HStack(alignment: .top, spacing: 8) {
                    Text(marker(for: row))
                        .font(theme.swiftUIFont(emphasized: true))
                        .foregroundStyle(Color(uiColor: accentColor))
                        .frame(minWidth: 18, alignment: .trailing)
                    AttributedTextView(
                        attributedText: NativeReaderAttributedTextBuilder.attributedText(
                            runs: row.runs,
                            fallbackText: row.plainText,
                            theme: theme,
                            role: .body,
                            accentColor: accentColor
                        ),
                        onOpenLink: onOpenLink
                    )
                }
                .padding(.leading, CGFloat(max(row.depth, 0)) * 18)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func marker(for row: NativeReaderListRow) -> String {
        if ordered, let ordinal = row.ordinal {
            return "\(ordinal)."
        }
        return "•"
    }
}

private struct NativeReaderListRow: Identifiable {
    let id: String
    let depth: Int
    let ordinal: Int?
    let plainText: String
    let runs: [NativeReaderRuntimeTextRun]

    static func flatten(_ item: NativeReaderRuntimeListItem) -> [NativeReaderListRow] {
        [
            NativeReaderListRow(
                id: item.id,
                depth: item.depth,
                ordinal: item.ordinal,
                plainText: item.plainText,
                runs: item.runs
            )
        ] + item.children.flatMap(flatten)
    }
}

enum NativeReaderTypographyRole: Equatable {
    case majorHeading(level: Int)
    case heading(level: Int)
    case body
    case caption
    case footnote
    case note
}

enum NativeReaderAttributedTextBuilder {
    static func attributedText(
        runs: [NativeReaderRuntimeTextRun],
        fallbackText: String,
        theme: ReaderTheme,
        role: NativeReaderTypographyRole,
        accentColor: UIColor
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
           let linkURL = URL(string: target.trimmingCharacters(in: .whitespacesAndNewlines)) {
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
        let bodySize = max(CGFloat(theme.fontSize) * 1.16, 12)
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
        let baseFont: UIFont
        if styles.contains(.code) {
            baseFont = .monospacedSystemFont(ofSize: effectiveSize, weight: wantsBold ? .semibold : .regular)
        } else {
            baseFont = theme.bodyFont.withSize(effectiveSize)
        }

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
