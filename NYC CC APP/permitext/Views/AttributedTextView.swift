import SwiftUI
import UIKit
import os.signpost

extension Notification.Name {
    static let nycccClearRichTextSelection = Notification.Name("nycccClearRichTextSelection")
}

enum ReaderSelectionMenuBuilder {
    static let researchSystemImageName = "sparkle"
    static let selectableTextAccessibilityIdentifier = "native-reader-enacted-text"

    static func menu(
        selectedText: String,
        suggestedActions: [UIMenuElement],
        onResearchSelection: @escaping (String) -> Void
    ) -> UIMenu {
        let normalized = selectedText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return UIMenu(children: suggestedActions) }
        let research = UIAction(
            title: "Research",
            image: UIImage(systemName: researchSystemImageName)
        ) { _ in
            os_signpost(
                .event,
                log: AppSignpost.reader,
                name: "researchSelection",
                "characters=%{public}d",
                normalized.count
            )
            onResearchSelection(normalized)
        }
        return UIMenu(children: suggestedActions + [research])
    }
}

struct AttributedTextView: View {
    let attributedText: NSAttributedString
    var onOpenImage: ((UIImage) -> Void)? = nil
    var onContentTap: (() -> Void)? = nil
    var onSelectionChange: ((Bool) -> Void)? = nil
    var onOpenLink: ((URL) -> Void)? = nil
    var onResearchSelection: ((String) -> Void)? = nil
    @Environment(\.readerDefinitionContext) private var definitionContext
    @Environment(\.openURL) private var openExternalURL
    @State private var definitionPresentation: ReaderDefinitionPresentation?
    private var textBlocks: [AttributedTextBlock] {
        let value = definitionContext.map { ReaderDefinitionStore.shared.matcher(for: $0).decorating(attributedText) } ?? attributedText
        return Self.blocks(for: value)
    }

    private func openReaderLink(_ url: URL) {
        if url.scheme == "permitext-definition", let definitionContext {
            let entries = ReaderDefinitionStore.shared.matcher(for: definitionContext).definitions(for: url)
            if !entries.isEmpty { definitionPresentation = ReaderDefinitionPresentation(entries: entries) }
            return
        }
        if let onOpenLink { onOpenLink(url) } else { openExternalURL(url) }
    }

    @State private var availableWidth: CGFloat = 0

    init(
        attributedText: NSAttributedString,
        onOpenImage: ((UIImage) -> Void)? = nil,
        onContentTap: (() -> Void)? = nil,
        onSelectionChange: ((Bool) -> Void)? = nil,
        onOpenLink: ((URL) -> Void)? = nil,
        onResearchSelection: ((String) -> Void)? = nil
    ) {
        self.attributedText = attributedText
        self.onOpenImage = onOpenImage
        self.onContentTap = onContentTap
        self.onSelectionChange = onSelectionChange
        self.onOpenLink = onOpenLink
        self.onResearchSelection = onResearchSelection
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(textBlocks) { block in
                switch block.kind {
                case .flow:
                    AttributedTextContainer(
                        attributedText: block.attributedText,
                        contentWidth: max(availableWidth, 1),
                        fillImagesToWidth: true,
                        onOpenImage: onOpenImage,
                        onContentTap: onContentTap,
                        onSelectionChange: onSelectionChange,
                        onOpenLink: definitionContext == nil ? onOpenLink : openReaderLink,
                        onResearchSelection: onResearchSelection
                    )
                    .frame(maxWidth: .infinity, alignment: .leading)

                case .table:
                    ScrollView(.horizontal, showsIndicators: true) {
                        AttributedTextContainer(
                            attributedText: block.attributedText,
                            contentWidth: preferredTableWidth(for: block.attributedText, availableWidth: max(availableWidth, 1)),
                            fillImagesToWidth: false,
                            onOpenImage: onOpenImage,
                            onContentTap: onContentTap,
                            onSelectionChange: onSelectionChange,
                            onOpenLink: definitionContext == nil ? onOpenLink : openReaderLink,
                            onResearchSelection: onResearchSelection
                        )
                        .frame(
                            width: preferredTableWidth(for: block.attributedText, availableWidth: max(availableWidth, 1)),
                            alignment: .leading
                        )
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            GeometryReader { proxy in
                Color.clear
                    .preference(key: AttributedTextWidthPreferenceKey.self, value: proxy.size.width)
            }
        }
        .popover(item: $definitionPresentation) { presentation in
            ReaderDefinitionPopover(entries: presentation.entries) { definitionPresentation = nil }
        }
        .onPreferenceChange(AttributedTextWidthPreferenceKey.self) { width in
            guard width > 0 else { return }
            availableWidth = width
        }
    }

    private static func blocks(for text: NSAttributedString) -> [AttributedTextBlock] {
        let nsText = text.string as NSString
        guard nsText.length > 0 else {
            return [AttributedTextBlock(id: 0, kind: .flow, attributedText: text)]
        }

        var blocks: [AttributedTextBlock] = []
        var location = 0

        while location < nsText.length {
            let paragraphRange = nsText.paragraphRange(for: NSRange(location: location, length: 0))
            let paragraphText = text.attributedSubstring(from: paragraphRange)
            let paragraphKind: AttributedTextBlock.Kind = containsTable(in: paragraphText) ? .table : .flow

            if let lastIndex = blocks.indices.last, blocks[lastIndex].kind == paragraphKind {
                let combined = NSMutableAttributedString(attributedString: blocks[lastIndex].attributedText)
                combined.append(paragraphText)
                blocks[lastIndex] = AttributedTextBlock(
                    id: blocks[lastIndex].id,
                    kind: paragraphKind,
                    attributedText: combined
                )
            } else {
                blocks.append(
                    AttributedTextBlock(
                        id: blocks.count,
                        kind: paragraphKind,
                        attributedText: paragraphText
                    )
                )
            }

            location = paragraphRange.upperBound
        }

        return blocks.isEmpty
            ? [AttributedTextBlock(id: 0, kind: .flow, attributedText: text)]
            : blocks
    }

    private static func containsTable(in text: NSAttributedString) -> Bool {
        // iOS's RTF importer does not preserve NSTextTable, so attributed text
        // produced from RTF/RTFD overrides never carries native table structure
        // on this platform. The previous implementation round-tripped the entire
        // attributed string through RTF data to look for `\trowd`, which was
        // expensive and effectively always returned false here. Treating tables
        // as flow content preserves observable behavior without the cost.
        _ = text
        return false
    }

    private func preferredTableWidth(for text: NSAttributedString, availableWidth: CGFloat) -> CGFloat {
        _ = text
        return availableWidth
    }
}

private struct AttributedTextBlock: Identifiable {
    enum Kind {
        case flow
        case table
    }

    let id: Int
    let kind: Kind
    let attributedText: NSAttributedString
}

private struct AttributedTextWidthPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

private struct AttributedTextContainer: UIViewRepresentable {
    let attributedText: NSAttributedString
    let contentWidth: CGFloat
    let fillImagesToWidth: Bool
    var onOpenImage: ((UIImage) -> Void)?
    var onContentTap: (() -> Void)?
    var onSelectionChange: ((Bool) -> Void)?
    var onOpenLink: ((URL) -> Void)?
    var onResearchSelection: ((String) -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(
            onOpenImage: onOpenImage,
            onContentTap: onContentTap,
            onSelectionChange: onSelectionChange,
            onOpenLink: onOpenLink,
            onResearchSelection: onResearchSelection
        )
    }

    func makeUIView(context: Context) -> RichTextView {
        let textView = RichTextView()
        textView.isEditable = false
        textView.isSelectable = true
        textView.isScrollEnabled = false
        textView.backgroundColor = .clear
        textView.textContainerInset = .zero
        textView.textContainer.lineFragmentPadding = 0
        textView.adjustsFontForContentSizeCategory = true
        updateAccessibility(for: textView)
        textView.delegate = context.coordinator
        textView.attachmentTapHandler = { image in
            context.coordinator.onOpenImage?(image)
        }
        textView.contentTapHandler = {
            context.coordinator.onContentTap?()
        }
        textView.selectionChangeHandler = { hasSelection in
            context.coordinator.onSelectionChange?(hasSelection)
        }
        textView.isAuxiliaryTapHandlingEnabled = onOpenImage != nil || onContentTap != nil
        return textView
    }

    func updateUIView(_ uiView: RichTextView, context: Context) {
        context.coordinator.onOpenImage = onOpenImage
        context.coordinator.onContentTap = onContentTap
        context.coordinator.onSelectionChange = onSelectionChange
        context.coordinator.onOpenLink = onOpenLink
        context.coordinator.onResearchSelection = onResearchSelection
        uiView.attachmentTapHandler = { image in
            context.coordinator.onOpenImage?(image)
        }
        uiView.contentTapHandler = {
            context.coordinator.onContentTap?()
        }
        uiView.selectionChangeHandler = { hasSelection in
            context.coordinator.onSelectionChange?(hasSelection)
        }
        uiView.isAuxiliaryTapHandlingEnabled = onOpenImage != nil || onContentTap != nil
        updateAccessibility(for: uiView)

        let contentSizeCategory = uiView.traitCollection.preferredContentSizeCategory
        if context.coordinator.requiresTextUpdate(
            source: attributedText,
            contentWidth: contentWidth,
            fillImagesToWidth: fillImagesToWidth,
            contentSizeCategory: contentSizeCategory
        ) {
            let renderedText = renderedAttributedText()
            if !uiView.attributedText.isEqual(to: renderedText) {
                uiView.attributedText = renderedText
            }
            context.coordinator.didUpdateText(
                source: attributedText,
                contentWidth: contentWidth,
                fillImagesToWidth: fillImagesToWidth,
                contentSizeCategory: contentSizeCategory
            )
        }
    }

    private func updateAccessibility(for textView: RichTextView) {
        guard onResearchSelection != nil else {
            textView.accessibilityIdentifier = nil
            textView.accessibilityLabel = nil
            return
        }

        textView.accessibilityIdentifier = ReaderSelectionMenuBuilder.selectableTextAccessibilityIdentifier
        textView.accessibilityLabel = attributedText.string.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: RichTextView, context: Context) -> CGSize? {
        let width = max(max(contentWidth, proposal.width ?? contentWidth), 1)
        let contentSizeCategory = uiView.traitCollection.preferredContentSizeCategory
        if let cachedSize = context.coordinator.cachedMeasuredSize(
            source: attributedText,
            width: width,
            contentSizeCategory: contentSizeCategory
        ) {
            return cachedSize
        }
        let fittingSize = CGSize(width: width, height: .greatestFiniteMagnitude)
        let measuredSize = uiView.sizeThatFits(fittingSize)
        let result = CGSize(width: width, height: ceil(measuredSize.height))
        context.coordinator.storeMeasuredSize(
            result,
            source: attributedText,
            width: width,
            contentSizeCategory: contentSizeCategory
        )
        return result
    }

    private func renderedAttributedText() -> NSAttributedString {
        guard attributedText.length > 0 else { return attributedText }

        let fullRange = NSRange(location: 0, length: attributedText.length)
        var attachments: [(NSRange, NSTextAttachment)] = []

        attributedText.enumerateAttribute(.attachment, in: fullRange) { value, range, _ in
            guard let attachment = value as? NSTextAttachment else { return }
            attachments.append((range, attachment))
        }
        guard !attachments.isEmpty else { return attributedText }

        let rendered = NSMutableAttributedString(attributedString: attributedText)
        var replacements: [(NSRange, NSAttributedString)] = []
        for (range, attachment) in attachments {
            guard let sourceImage = image(from: attachment) else { continue }

            let replacementAttachment = ReaderImageAttachment()
            replacementAttachment.sourceImage = sourceImage
            replacementAttachment.image = fittedImage(
                from: sourceImage,
                maxWidth: contentWidth,
                fillToWidth: fillImagesToWidth
            )
            replacementAttachment.bounds = fittedBounds(
                for: sourceImage.size,
                maxWidth: contentWidth,
                fillToWidth: fillImagesToWidth
            )

            let replacement = NSMutableAttributedString(attachment: replacementAttachment)
            let attributes = attributedText.attributes(at: range.location, effectiveRange: nil)
                .filter { $0.key != .attachment }
            replacement.addAttributes(attributes, range: NSRange(location: 0, length: replacement.length))
            replacements.append((range, replacement))
        }

        for (range, replacement) in replacements.reversed() {
            rendered.replaceCharacters(in: range, with: replacement)
        }

        return rendered
    }

    private func fittedImage(from image: UIImage, maxWidth: CGFloat, fillToWidth: Bool) -> UIImage {
        let targetBounds = fittedBounds(for: image.size, maxWidth: maxWidth, fillToWidth: fillToWidth)
        let targetSize = CGSize(width: max(targetBounds.width, 1), height: max(targetBounds.height, 1))
        let renderer = UIGraphicsImageRenderer(size: targetSize)

        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }
    }

    private func fittedBounds(for imageSize: CGSize, maxWidth: CGFloat, fillToWidth: Bool) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0 else {
            return CGRect(origin: .zero, size: CGSize(width: maxWidth, height: maxWidth * 0.6))
        }

        let widthLimit = max(maxWidth, 1)
        let targetWidth = fillToWidth ? min(widthLimit, imageSize.width) : min(widthLimit, imageSize.width)
        let scale = targetWidth / imageSize.width
        let targetHeight = max(1, imageSize.height * scale)

        return CGRect(origin: .zero, size: CGSize(width: targetWidth, height: targetHeight))
    }

    private func image(from attachment: NSTextAttachment) -> UIImage? {
        if let readerAttachment = attachment as? ReaderImageAttachment, let sourceImage = readerAttachment.sourceImage {
            return sourceImage
        }

        if let image = attachment.image {
            return image
        }

        if let data = attachment.fileWrapper?.regularFileContents {
            return UIImage(data: data)
        }

        if let data = attachment.contents {
            return UIImage(data: data)
        }

        return nil
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        var onOpenImage: ((UIImage) -> Void)?
        var onContentTap: (() -> Void)?
        var onSelectionChange: ((Bool) -> Void)?
        var onOpenLink: ((URL) -> Void)?
        var onResearchSelection: ((String) -> Void)?
        private var hadSelection = false
        private var lastRenderedSource: NSAttributedString?
        private var lastRenderedContentWidth: CGFloat?
        private var lastRenderedFillImagesToWidth: Bool?
        private var lastRenderedContentSizeCategory: UIContentSizeCategory?
        private var measuredSource: NSAttributedString?
        private var measuredWidth: CGFloat?
        private var measuredContentSizeCategory: UIContentSizeCategory?
        private var measuredSize: CGSize?

        init(
            onOpenImage: ((UIImage) -> Void)?,
            onContentTap: (() -> Void)?,
            onSelectionChange: ((Bool) -> Void)?,
            onOpenLink: ((URL) -> Void)?,
            onResearchSelection: ((String) -> Void)?
        ) {
            self.onOpenImage = onOpenImage
            self.onContentTap = onContentTap
            self.onSelectionChange = onSelectionChange
            self.onOpenLink = onOpenLink
            self.onResearchSelection = onResearchSelection
        }

        func requiresTextUpdate(
            source: NSAttributedString,
            contentWidth: CGFloat,
            fillImagesToWidth: Bool,
            contentSizeCategory: UIContentSizeCategory
        ) -> Bool {
            (lastRenderedSource !== source && lastRenderedSource?.isEqual(to: source) != true)
                || lastRenderedContentWidth != contentWidth
                || lastRenderedFillImagesToWidth != fillImagesToWidth
                || lastRenderedContentSizeCategory != contentSizeCategory
        }

        func didUpdateText(
            source: NSAttributedString,
            contentWidth: CGFloat,
            fillImagesToWidth: Bool,
            contentSizeCategory: UIContentSizeCategory
        ) {
            lastRenderedSource = source
            lastRenderedContentWidth = contentWidth
            lastRenderedFillImagesToWidth = fillImagesToWidth
            lastRenderedContentSizeCategory = contentSizeCategory
            measuredSource = nil
            measuredWidth = nil
            measuredContentSizeCategory = nil
            measuredSize = nil
        }

        func cachedMeasuredSize(
            source: NSAttributedString,
            width: CGFloat,
            contentSizeCategory: UIContentSizeCategory
        ) -> CGSize? {
            guard (measuredSource === source || measuredSource?.isEqual(to: source) == true),
                  measuredWidth == width,
                  measuredContentSizeCategory == contentSizeCategory else { return nil }
            return measuredSize
        }

        func storeMeasuredSize(
            _ size: CGSize,
            source: NSAttributedString,
            width: CGFloat,
            contentSizeCategory: UIContentSizeCategory
        ) {
            measuredSource = source
            measuredWidth = width
            measuredContentSizeCategory = contentSizeCategory
            measuredSize = size
        }

        func textViewDidChangeSelection(_ textView: UITextView) {
            let hasSelection = textView.selectedRange.length > 0
            if hasSelection, !hadSelection {
                os_signpost(
                    .event,
                    log: AppSignpost.reader,
                    name: "textSelection",
                    "characters=%{public}d",
                    textView.selectedRange.length
                )
            }
            hadSelection = hasSelection
            onSelectionChange?(hasSelection)
        }

        func textView(
            _ textView: UITextView,
            editMenuForTextIn range: NSRange,
            suggestedActions: [UIMenuElement]
        ) -> UIMenu? {
            guard let onResearchSelection,
                  let selectedRange = Range(range, in: textView.text),
                  !selectedRange.isEmpty else {
                return UIMenu(children: suggestedActions)
            }

            let selectedText = String(textView.text[selectedRange])
            return ReaderSelectionMenuBuilder.menu(
                selectedText: selectedText,
                suggestedActions: suggestedActions,
                onResearchSelection: onResearchSelection
            )
        }

        func textView(
            _ textView: UITextView,
            primaryActionFor textItem: UITextItem,
            defaultAction: UIAction
        ) -> UIAction? {
            guard case .link(let link) = textItem.content, let onOpenLink else { return defaultAction }
            return UIAction { _ in
                onOpenLink(link)
            }
        }
    }
}

private final class ReaderImageAttachment: NSTextAttachment {
    var sourceImage: UIImage?
}

private final class RichTextView: UITextView {
    var attachmentTapHandler: ((UIImage) -> Void)?
    var contentTapHandler: (() -> Void)?
    var selectionChangeHandler: ((Bool) -> Void)?
    var isAuxiliaryTapHandlingEnabled: Bool {
        get { auxiliaryTapRecognizer.isEnabled }
        set { auxiliaryTapRecognizer.isEnabled = newValue }
    }
    private var selectionObserver: NSObjectProtocol?
    private lazy var auxiliaryTapRecognizer = UITapGestureRecognizer(
        target: self,
        action: #selector(handleTap(_:))
    )

    override init(frame: CGRect, textContainer: NSTextContainer?) {
        super.init(frame: frame, textContainer: textContainer)
        addGestureRecognizer(auxiliaryTapRecognizer)
        selectionObserver = NotificationCenter.default.addObserver(
            forName: .nycccClearRichTextSelection,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self, self.selectedRange.length > 0 else { return }
            self.selectedRange = NSRange(location: 0, length: 0)
            self.selectionChangeHandler?(false)
        }
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        addGestureRecognizer(auxiliaryTapRecognizer)
        selectionObserver = NotificationCenter.default.addObserver(
            forName: .nycccClearRichTextSelection,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self, self.selectedRange.length > 0 else { return }
            self.selectedRange = NSRange(location: 0, length: 0)
            self.selectionChangeHandler?(false)
        }
    }

    deinit {
        if let selectionObserver {
            NotificationCenter.default.removeObserver(selectionObserver)
        }
    }

    @objc private func handleTap(_ recognizer: UITapGestureRecognizer) {
        if selectedRange.length > 0 {
            selectedRange = NSRange(location: 0, length: 0)
            selectionChangeHandler?(false)
            return
        }

        let point = recognizer.location(in: self)
        if let image = imageAttachment(at: point) {
            attachmentTapHandler?(image)
            return
        }

        contentTapHandler?()
    }

    private func imageAttachment(at point: CGPoint) -> UIImage? {
        guard let attributedText, attributedText.length > 0 else { return nil }

        let containerPoint = CGPoint(
            x: point.x - textContainerInset.left,
            y: point.y - textContainerInset.top
        )

        let fullRange = NSRange(location: 0, length: attributedText.length)
        var tappedImage: UIImage?

        attributedText.enumerateAttribute(.attachment, in: fullRange) { value, range, stop in
            guard let attachment = value as? NSTextAttachment else { return }
            guard let image = attachmentImage(from: attachment) else { return }

            let glyphRange = layoutManager.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
            let attachmentRect = layoutManager.boundingRect(forGlyphRange: glyphRange, in: textContainer)

            if attachmentRect.insetBy(dx: -8, dy: -8).contains(containerPoint) {
                tappedImage = image
                stop.pointee = true
            }
        }

        return tappedImage
    }

    private func attachmentImage(from attachment: NSTextAttachment) -> UIImage? {
        if let readerAttachment = attachment as? ReaderImageAttachment, let sourceImage = readerAttachment.sourceImage {
            return sourceImage
        }

        if let image = attachment.image {
            return image
        }

        if let data = attachment.fileWrapper?.regularFileContents {
            return UIImage(data: data)
        }

        if let data = attachment.contents {
            return UIImage(data: data)
        }

        return nil
    }
}

struct ZoomableImageViewer: View {
    let image: UIImage
    let accessibilityText: String?
    @Environment(\.dismiss) private var dismiss
    @State private var zoomScale: CGFloat = 1
    @State private var lastZoomScale: CGFloat = 1
    @State private var contentOffset: CGSize = .zero
    @State private var lastContentOffset: CGSize = .zero

    init(image: UIImage, accessibilityText: String? = nil) {
        self.image = image
        self.accessibilityText = accessibilityText
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()

            GeometryReader { proxy in
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .scaleEffect(zoomScale)
                    .offset(contentOffset)
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .gesture(dragGesture)
                    .simultaneousGesture(magnificationGesture)
                    .onTapGesture(count: 2) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            if zoomScale > 1.01 {
                                zoomScale = 1
                                lastZoomScale = 1
                                contentOffset = .zero
                                lastContentOffset = .zero
                            } else {
                                zoomScale = 2
                                lastZoomScale = 2
                            }
                        }
                    }
                    .accessibilityLabel(Text(accessibilityText ?? "Code image"))
            }

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(14)
                    .background(Color.black)
                    .clipShape(Circle())
            }
            .padding(.top, 18)
            .padding(.trailing, 18)
        }
    }

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                guard zoomScale > 1.01 else { return }
                contentOffset = CGSize(
                    width: lastContentOffset.width + value.translation.width,
                    height: lastContentOffset.height + value.translation.height
                )
            }
            .onEnded { _ in
                lastContentOffset = contentOffset
            }
    }

    private var magnificationGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                zoomScale = max(1, lastZoomScale * value)
                if zoomScale <= 1.01 {
                    contentOffset = .zero
                    lastContentOffset = .zero
                }
            }
            .onEnded { _ in
                lastZoomScale = zoomScale
                if zoomScale <= 1.01 {
                    zoomScale = 1
                    contentOffset = .zero
                    lastContentOffset = .zero
                }
            }
    }
}

// Shared with the web reader's generated definition registry. Source identity is
// explicit so a historical reader can never fall back to another edition.
struct ReaderDefinitionContext: Hashable {
    let bundle: String
    let codeSectionID: Int64
    let chapterNumber: String
    let sectionNumber: String?

    init(versionFileName: String, codeSectionID: Int64, chapterNumber: String, sectionNumber: String? = nil) {
        let components = versionFileName.components(separatedBy: "/")
        if let index = components.firstIndex(of: "new-york-city"), components.indices.contains(index + 1) {
            bundle = components[index + 1]
        } else {
            bundle = ""
        }
        self.codeSectionID = codeSectionID
        self.chapterNumber = chapterNumber
        self.sectionNumber = sectionNumber
    }
}

private struct ReaderDefinitionContextKey: EnvironmentKey {
    static let defaultValue: ReaderDefinitionContext? = nil
}
extension EnvironmentValues {
    var readerDefinitionContext: ReaderDefinitionContext? {
        get { self[ReaderDefinitionContextKey.self] }
        set { self[ReaderDefinitionContextKey.self] = newValue }
    }
}

struct ReaderDefinitionEntry: Codable, Identifiable, Hashable {
    struct Source: Codable, Hashable {
        var term: String? = nil
        var publication: String? = nil
        let file: String
        let anchor: String
        let sectionNumber: String
        let chapter: String?
        let code: String
        let bundle: String
    }
    let id: String
    let term: String
    let aliases: [String]
    let text: String
    let resolution: String
    let applicability: String
    var requiresItalic: Bool? = nil
    var applicableChapters: [String]? = nil
    var applicableSections: [String]? = nil
    var excludedSections: [String]? = nil
    var excludedExactSections: [String]? = nil
    struct OccurrenceExclusion: Codable, Hashable, Sendable {
        struct Phrase: Codable, Hashable, Sendable {
            let text: String
            let occurrence: Int
        }
        let section: String
        let phrases: [Phrase]
    }
    var excludedOccurrences: [OccurrenceExclusion]? = nil
    let source: Source
}

extension ReaderDefinitionEntry {
    func applies(toSection number: String?) -> Bool {
        guard applicableSections != nil || excludedSections != nil || excludedExactSections != nil else { return true }
        guard let section = number?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(), !section.isEmpty else { return false }
        func matches(_ value: String) -> Bool {
            let scope = value.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            return !scope.isEmpty && (section == scope || section.hasPrefix(scope + "."))
        }
        return (applicableSections == nil || applicableSections!.contains(where: matches)) &&
            !(excludedSections ?? []).contains(where: matches) &&
            !(excludedExactSections ?? []).contains { value in
                section == value.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            }
    }
}

struct ReaderDefinitionRegistry: Decodable {
    struct Book: Decodable {
        let bundle: String
        let codeSectionID: Int64
        let scope: String
        let definitionChapter: String?
        let excludeWholeChapter: Bool?
        let entries: [ReaderDefinitionEntry]
    }
    let schemaVersion: Int
    let books: [Book]

    func entries(for context: ReaderDefinitionContext, includeSectionScoped: Bool = false) -> [ReaderDefinitionEntry] {
        guard schemaVersion == 1, !context.bundle.isEmpty else { return [] }
        guard !books.contains(where: {
            $0.excludeWholeChapter != false && $0.bundle == context.bundle && $0.codeSectionID == context.codeSectionID &&
            $0.definitionChapter?.uppercased() == context.chapterNumber.uppercased()
        }) else { return [] }
        let initial = String(context.chapterNumber.uppercased().prefix(1))
        let selected = books.filter {
            $0.bundle == context.bundle && $0.codeSectionID == context.codeSectionID &&
            ($0.scope == "general" || $0.scope == initial || $0.scope == "appendix-\(initial)")
        }.flatMap(\.entries).filter {
            $0.applicability == "definition-chapter" &&
            ($0.applicableChapters == nil || $0.applicableChapters!.contains(context.chapterNumber.uppercased())) &&
            (includeSectionScoped || $0.applies(toSection: context.sectionNumber))
        }
        struct Identity: Hashable {
            let term: String
            let text: String
            let aliases: [String]
            let source: ReaderDefinitionEntry.Source
        }
        var seen = Set<Identity>()
        return selected.filter {
            seen.insert(Identity(term: $0.term, text: $0.text, aliases: $0.aliases.sorted(), source: $0.source)).inserted
        }
    }
}

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
            result.addAttribute(.link, value: url, range: match.range)
            result.addAttribute(.underlineStyle, value: NSUnderlineStyle.single.rawValue | NSUnderlineStyle.patternDot.rawValue, range: match.range)
        }
        return result
    }

    func definitions(for url: URL) -> [ReaderDefinitionEntry] {
        guard url.scheme == "permitext-definition", url.host == "entry" else { return [] }
        let identifiers = Set(url.lastPathComponent.split(separator: ",").map(String.init))
        return entries.filter { identifiers.contains($0.id) }
    }
}

@MainActor
final class ReaderDefinitionStore {
    static let shared = ReaderDefinitionStore()
    private let registry: ReaderDefinitionRegistry?
    private var matchers: [ReaderDefinitionContext: ReaderDefinitionMatcher] = [:]

    private init() {
        if let url = Bundle.main.url(forResource: "reader-definition-registry", withExtension: "json", subdirectory: "CodeContent"),
           let data = try? Data(contentsOf: url) {
            registry = try? JSONDecoder().decode(ReaderDefinitionRegistry.self, from: data)
        } else { registry = nil }
    }

    func hasSectionScopes(for context: ReaderDefinitionContext) -> Bool {
        chapterEntries(for: context).contains { $0.applicableSections != nil || $0.excludedSections != nil || $0.excludedExactSections != nil || $0.excludedOccurrences != nil }
    }

    func chapterEntries(for context: ReaderDefinitionContext) -> [ReaderDefinitionEntry] {
        registry?.entries(for: context, includeSectionScoped: true) ?? []
    }

    func matcher(for context: ReaderDefinitionContext) -> ReaderDefinitionMatcher {
        if let matcher = matchers[context] { return matcher }
        let matcher = ReaderDefinitionMatcher(entries: registry?.entries(for: context) ?? [], sectionNumber: context.sectionNumber)
        if matchers.count >= 12, let oldest = matchers.keys.first { matchers.removeValue(forKey: oldest) }
        matchers[context] = matcher
        return matcher
    }
}

private struct ReaderDefinitionPresentation: Identifiable {
    let entries: [ReaderDefinitionEntry]
    var id: String { entries.map(\.id).joined(separator: ",") }
}

private struct ReaderDefinitionPopover: View {
    let entries: [ReaderDefinitionEntry]
    let onClose: () -> Void
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack { Spacer(); Button("Close", action: onClose).accessibilityLabel("Close definition") }
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(entries) { entry in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(entry.source.term ?? entry.term).font(.headline)
                            Text(entry.text).textSelection(.enabled)
                            Text(sourceLabel(entry)).font(.caption).foregroundStyle(.secondary)
                            if entry.resolution == "multiple-definitions" {
                                Text("This term refers to several definitions. Check each source for applicability.")
                                    .font(.caption).foregroundStyle(.secondary)
                            } else if entry.resolution == "unresolved-reference" || entry.resolution == "ambiguous-reference" {
                                Text("This entry refers to another section. Its definition still needs verification.")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }.frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        }
        .padding(18)
        .frame(idealWidth: 340,
               maxWidth: horizontalSizeClass == .compact ? .infinity : 380,
               maxHeight: horizontalSizeClass == .compact ? .infinity : 380)
        .presentationBackground(Color(uiColor: .systemBackground))
        // A text block can extend beyond the viewport. Compact popovers anchored
        // to that block can be clipped; a sheet does not depend on its geometry.
        .presentationCompactAdaptation(.sheet)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func sourceLabel(_ entry: ReaderDefinitionEntry) -> String {
        let editions = ["new-york-state-public-service-law": "New York State",
                        "2014-construction-codes": "2014 edition", "2022-construction-codes": "2022 edition",
                        "2025-specialty-codes": "2025 edition", "2026-enacted-administrative-code": "Enacted collection",
                        "2026-existing-building-code": "2026 enacted edition", "2026-zoning-resolution": "Zoning Resolution"]
        let citation = entry.source.sectionNumber.isEmpty ? "Chapter \(entry.source.chapter ?? "")" : "§ \(entry.source.sectionNumber)"
        return [entry.source.code, entry.source.publication, editions[entry.source.bundle] ?? entry.source.bundle, citation].compactMap { $0 }.joined(separator: " · ")
    }
}

#if DEBUG
extension AttributedTextView {
    /// Exercise the actual coordinator's cache invalidation without mounting UIKit.
    @MainActor
    static func debugCacheProbe(seed: NSAttributedString, candidate: NSAttributedString,
                                width: CGFloat = 320, category: UIContentSizeCategory = .large,
                                fillImages: Bool = false) -> (requiresUpdate: Bool, hasMeasurement: Bool) {
        let coordinator = AttributedTextContainer.Coordinator(onOpenImage: nil, onContentTap: nil,
            onSelectionChange: nil, onOpenLink: nil, onResearchSelection: nil)
        coordinator.didUpdateText(source: seed, contentWidth: 320, fillImagesToWidth: false,
                                  contentSizeCategory: .large)
        coordinator.storeMeasuredSize(CGSize(width: 320, height: 100), source: seed, width: 320,
                                      contentSizeCategory: .large)
        return (coordinator.requiresTextUpdate(source: candidate, contentWidth: width,
                                              fillImagesToWidth: fillImages, contentSizeCategory: category),
                coordinator.cachedMeasuredSize(source: candidate, width: width,
                                               contentSizeCategory: category) != nil)
    }
}
#endif
