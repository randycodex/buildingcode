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
            title: "Ask Assistant",
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
    var chapterSelectionTarget: NativeChapterSelectionTarget?
    let supportsInlineImages: Bool
    var definitionsAlreadyApplied = false
    @Environment(\.readerDefinitionContext) private var definitionContext
    @Environment(\.openURL) private var openExternalURL
    @State private var definitionPresentation: ReaderDefinitionPresentation?
    @State private var textPreparation = ReaderAttributedTextPreparationCache()
    private var textBlocks: [AttributedTextBlock] {
        textPreparation.blocks(for: attributedText, context: definitionsAlreadyApplied ? nil : definitionContext) { source, context in
            ReaderDefinitionStore.shared.matcher(for: context).decorating(source)
        }
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
        onResearchSelection: ((String) -> Void)? = nil,
        chapterSelectionTarget: NativeChapterSelectionTarget? = nil,
        supportsInlineImages: Bool = true, definitionsAlreadyApplied: Bool = false
    ) {
        self.attributedText = attributedText
        self.onOpenImage = onOpenImage
        self.onContentTap = onContentTap
        self.onSelectionChange = onSelectionChange
        self.onOpenLink = onOpenLink
        self.onResearchSelection = onResearchSelection
        self.chapterSelectionTarget = chapterSelectionTarget
        self.supportsInlineImages = supportsInlineImages
        self.definitionsAlreadyApplied = definitionsAlreadyApplied
    }

    var body: some View {
        Group {
            if supportsInlineImages {
                importedContent
            } else if let block = textBlocks.first {
                flowContent(block.attributedText, contentWidth: 0)
            }
        }
        .popover(item: $definitionPresentation) { presentation in
            ReaderDefinitionPopover(entries: presentation.entries) { definitionPresentation = nil }
        }
    }

    private var importedContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(textBlocks) { block in
                switch block.kind {
                case .flow:
                    flowContent(block.attributedText, contentWidth: max(availableWidth, 1))

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
        .onPreferenceChange(AttributedTextWidthPreferenceKey.self) { width in
            guard width > 0 else { return }
            availableWidth = width
        }
    }

    private func flowContent(_ text: NSAttributedString, contentWidth: CGFloat) -> some View {
        AttributedTextContainer(
            attributedText: text,
            contentWidth: contentWidth,
            fillImagesToWidth: true,
            onOpenImage: onOpenImage,
            onContentTap: onContentTap,
            onSelectionChange: onSelectionChange,
            onOpenLink: definitionContext == nil ? onOpenLink : openReaderLink,
            onResearchSelection: onResearchSelection,
            chapterSelectionTarget: chapterSelectionTarget,
            supportsInlineImages: supportsInlineImages
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func preferredTableWidth(for text: NSAttributedString, availableWidth: CGFloat) -> CGFloat {
        _ = text
        return availableWidth
    }
}

@MainActor
private final class ReaderAttributedTextPreparationCache {
    // One entry per mounted view, released with that view. Never retain an entire
    // oversized imported chapter, and never cache width-dependent UIKit layout.
    private let retainedLengthLimit = 128 * 1024
    private var source: NSAttributedString?
    private var context: ReaderDefinitionContext?
    private var prepared: [AttributedTextBlock]?

    func blocks(for original: NSAttributedString, context: ReaderDefinitionContext?,
                decorate: (NSAttributedString, ReaderDefinitionContext) -> NSAttributedString) -> [AttributedTextBlock] {
        if let source, self.context == context, source.isEqual(to: original), let prepared {
            return prepared
        }
        source = nil
        prepared = nil
        self.context = nil
        let snapshot = original.length <= retainedLengthLimit ? Self.snapshotForCaching(original) : nil
        let input = snapshot ?? original
        let decorated = context.map { decorate(input, $0) } ?? input
        // The former iOS paragraph splitter always returned a single flow block:
        // containsTable was unconditionally false because RTF imports do not
        // preserve NSTextTable here. Keep every attribute and UTF-16 code unit,
        // without repeatedly copying the accumulated text for each paragraph.
        let blocks = [AttributedTextBlock(id: 0, kind: .flow,
                                         attributedText: NSAttributedString(attributedString: decorated))]
        if let snapshot {
            source = snapshot
            self.context = context
            prepared = blocks
        }
        return blocks
    }

    private static func snapshotForCaching(_ original: NSAttributedString) -> NSAttributedString? {
        var cacheable = true
        original.enumerateAttributes(in: NSRange(location: 0, length: original.length)) { attributes, _, stop in
            for value in attributes.values {
                // Foundation can intern an equal attribute dictionary, so even
                // adding a copied style may retain its mutable original. Cache
                // only immutable attribute values; the string container itself
                // may be mutable because its characters/runs are snapshotted.
                switch value {
                case is NSMutableParagraphStyle, is NSMutableString:
                    cacheable = false
                case is UIFont, is UIColor, is NSNumber, is NSURL, is NSString, is NSParagraphStyle:
                    break
                default:
                    // Attachments, shadows and unfamiliar objects retain the
                    // uncached path; image fitting remains in UIKit.
                    cacheable = false
                }
                if !cacheable {
                    stop.pointee = true
                    break
                }
            }
        }
        return cacheable ? NSAttributedString(attributedString: original) : nil
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

extension NSAttributedString.Key {
    static let nativeReaderSavedForeground = NSAttributedString.Key("permitext.nativeReaderSavedForeground")
}

enum ReaderEnactedTextLinkStyle {
    // UIKit's uniform link color would override the saved portion of a link.
    // Apply the foreground to the text runs while preserving the actionable URL.
    static let textViewAttributes: [NSAttributedString.Key: Any] = [
        .underlineStyle: 0
    ]

    static func applying(to original: NSAttributedString) -> NSAttributedString {
        guard original.length > 0 else { return original }

        let fullRange = NSRange(location: 0, length: original.length)
        var linkedRanges: [NSRange] = []
        original.enumerateAttribute(.link, in: fullRange) { value, range, _ in
            if value != nil { linkedRanges.append(range) }
        }
        guard !linkedRanges.isEmpty else { return original }

        let result = NSMutableAttributedString(attributedString: original)
        for range in linkedRanges {
            result.removeAttribute(.underlineStyle, range: range)
            original.enumerateAttribute(.nativeReaderSavedForeground, in: range) { savedColor, subrange, _ in
                result.addAttribute(.foregroundColor, value: savedColor as? UIColor ?? UIColor.secondaryLabel, range: subrange)
            }
        }
        return result
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
    var chapterSelectionTarget: NativeChapterSelectionTarget? = nil
    var supportsInlineImages = true

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
        textView.linkTextAttributes = ReaderEnactedTextLinkStyle.textViewAttributes
        let coordinator = context.coordinator
        textView.delegate = coordinator
        textView.attachmentTapHandler = { [weak coordinator] image in
            coordinator?.onOpenImage?(image)
        }
        textView.contentTapHandler = { [weak coordinator] in
            coordinator?.onContentTap?()
        }
        textView.selectionChangeHandler = { [weak coordinator] hasSelection in
            coordinator?.onSelectionChange?(hasSelection)
        }
        textView.isAuxiliaryTapHandlingEnabled = onOpenImage != nil || onContentTap != nil
        textView.chapterSelectionTarget = chapterSelectionTarget
        return textView
    }

    func updateUIView(_ uiView: RichTextView, context: Context) {
        let coordinator = context.coordinator
        let researchAvailabilityChanged = (coordinator.onResearchSelection != nil) != (onResearchSelection != nil)
        coordinator.onOpenImage = onOpenImage
        coordinator.onContentTap = onContentTap
        coordinator.onSelectionChange = onSelectionChange
        coordinator.onOpenLink = onOpenLink
        coordinator.onResearchSelection = onResearchSelection
        uiView.isAuxiliaryTapHandlingEnabled = onOpenImage != nil || onContentTap != nil

        let sourceChanged = !coordinator.hasRendered(source: attributedText)
        if sourceChanged || researchAvailabilityChanged {
            updateAccessibility(for: uiView)
        }
        let contentSizeCategory = uiView.traitCollection.preferredContentSizeCategory
        if coordinator.requiresTextUpdate(
            sourceChanged: sourceChanged,
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
        uiView.chapterSelectionTarget = chapterSelectionTarget
    }

    static func dismantleUIView(_ uiView: RichTextView, coordinator: Coordinator) {
        uiView.chapterSelectionTarget = nil
    }

    private func updateAccessibility(for textView: RichTextView) {
        guard onResearchSelection != nil else {
            textView.accessibilityIdentifier = nil
            textView.accessibilityLabel = nil
            textView.accessibilityValue = nil
            return
        }

        textView.accessibilityIdentifier = ReaderSelectionMenuBuilder.selectableTextAccessibilityIdentifier
        textView.accessibilityLabel = attributedText.string.trimmingCharacters(in: .whitespacesAndNewlines)
        var savedValue: String?
        attributedText.enumerateAttribute(.nativeReaderSavedForeground, in: NSRange(location: 0, length: attributedText.length)) { color, _, stop in
            guard color is UIColor else { return }
            savedValue = "Saved text"
            stop.pointee = true
        }
        textView.accessibilityValue = savedValue
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: RichTextView, context: Context) -> CGSize? {
        let width = max(proposal.width ?? contentWidth, 1)
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
        // Native Reader images are separate blocks, so resizing text never
        // requires rebuilding its attributed string to fit inline images.
        guard supportsInlineImages else { return ReaderEnactedTextLinkStyle.applying(to: attributedText) }
        guard attributedText.length > 0 else { return attributedText }

        let fullRange = NSRange(location: 0, length: attributedText.length)
        var attachments: [(NSRange, NSTextAttachment)] = []

        attributedText.enumerateAttribute(.attachment, in: fullRange) { value, range, _ in
            guard let attachment = value as? NSTextAttachment else { return }
            attachments.append((range, attachment))
        }
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

        guard !replacements.isEmpty else { return ReaderEnactedTextLinkStyle.applying(to: attributedText) }
        let rendered = NSMutableAttributedString(attributedString: attributedText)
        for (range, replacement) in replacements.reversed() {
            rendered.replaceCharacters(in: range, with: replacement)
        }

        return ReaderEnactedTextLinkStyle.applying(to: rendered)
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

        func hasRendered(source: NSAttributedString) -> Bool {
            lastRenderedSource === source || lastRenderedSource?.isEqual(to: source) == true
        }

        func requiresTextUpdate(
            sourceChanged: Bool,
            contentWidth: CGFloat,
            fillImagesToWidth: Bool,
            contentSizeCategory: UIContentSizeCategory
        ) -> Bool {
            sourceChanged || lastRenderedContentWidth != contentWidth
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
            if let view = textView as? RichTextView {
                view.chapterSelectionTarget?.controller.nativeSelectionDidChange(in: view)
            }
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
            if let view = textView as? RichTextView, let target = view.chapterSelectionTarget {
                return target.controller.nativeSelectionMenu(for: target.documentRange(range), in: view,
                                                             selectedText: selectedText, suggestedActions: suggestedActions,
                                                             fallbackResearch: onResearchSelection)
            }
            return ReaderSelectionMenuBuilder.menu(
                selectedText: selectedText,
                suggestedActions: suggestedActions,
                onResearchSelection: onResearchSelection
            )
        }

        func textView(_ textView: UITextView, willPresentEditMenuWith animator: any UIEditMenuInteractionAnimating) {
            guard let view = textView as? RichTextView, let target = view.chapterSelectionTarget else { return }
            target.controller.nativeEditMenuWillAppear(in: view)
            animator.addCompletion { [weak view] in
                guard let view else { return }
                view.chapterSelectionTarget?.controller.nativeEditMenuDidAppear(in: view)
            }
        }

        func textView(_ textView: UITextView, willDismissEditMenuWith animator: any UIEditMenuInteractionAnimating) {
            guard let view = textView as? RichTextView, let controller = view.chapterSelectionTarget?.controller else { return }
            animator.addCompletion { [weak controller, weak view] in
                guard let view else { return }
                controller?.nativeEditMenuDidDismiss(in: view)
            }
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

final class RichTextView: UITextView {
    var attachmentTapHandler: ((UIImage) -> Void)?
    var contentTapHandler: (() -> Void)?
    var selectionChangeHandler: ((Bool) -> Void)?
    var chapterSelectionTarget: NativeChapterSelectionTarget? {
        didSet {
            guard chapterSelectionTarget != oldValue, window != nil else { return }
            if let oldValue { oldValue.controller.unregister(self, address: oldValue.address) }
            if let target = chapterSelectionTarget { target.controller.register(self, address: target.address) }
        }
    }
    private var chapterSelectionLayer: CAShapeLayer?
    private var chapterSelectionRange: NSRange?
    private var chapterSelectionSize = CGSize.zero

    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard let target = chapterSelectionTarget else { return }
        if window == nil {
            target.controller.unregister(self, address: target.address)
        } else {
            target.controller.register(self, address: target.address)
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        if chapterSelectionRange != nil && chapterSelectionSize != bounds.size { drawChapterSelection() }
        chapterSelectionTarget?.controller.layoutSelectionHandles(for: self)
    }

    override func resignFirstResponder() -> Bool {
        let resigned = super.resignFirstResponder()
        if resigned { chapterSelectionTarget?.controller.nativeSelectionDidEnd(in: self) }
        return resigned
    }

    func showChapterSelection(_ range: NSRange?) {
        guard chapterSelectionRange != range else { return }
        chapterSelectionRange = range
        drawChapterSelection()
    }

    var chapterHighlightBounds: CGRect? { chapterSelectionLayer?.path?.boundingBoxOfPath }

    func containsChapterSelection(at point: CGPoint) -> Bool {
        chapterSelectionLayer?.path?.contains(point) == true
    }

    private func drawChapterSelection() {
        chapterSelectionSize = bounds.size
        guard let range = chapterSelectionRange,
              let start = position(from: beginningOfDocument, offset: range.location),
              let end = position(from: start, offset: range.length), let selection = textRange(from: start, to: end) else {
            chapterSelectionLayer?.removeFromSuperlayer()
            chapterSelectionLayer = nil
            return
        }
        let path = UIBezierPath()
        for item in selectionRects(for: selection) where !item.rect.isEmpty && !item.rect.isNull {
            path.append(UIBezierPath(rect: item.rect))
        }
        let highlight = chapterSelectionLayer ?? CAShapeLayer()
        if chapterSelectionLayer == nil {
            layer.addSublayer(highlight)
            chapterSelectionLayer = highlight
        }
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        highlight.fillColor = tintColor.withAlphaComponent(0.28).cgColor
        highlight.path = path.cgPath
        CATransaction.commit()
    }
    var isAuxiliaryTapHandlingEnabled = false {
        didSet {
            guard isAuxiliaryTapHandlingEnabled != oldValue else { return }
            if isAuxiliaryTapHandlingEnabled && auxiliaryTapRecognizer.view == nil {
                addGestureRecognizer(auxiliaryTapRecognizer)
            }
            auxiliaryTapRecognizer.isEnabled = isAuxiliaryTapHandlingEnabled
        }
    }
    private var selectionObserver: NSObjectProtocol?
    private lazy var auxiliaryTapRecognizer = UITapGestureRecognizer(
        target: self,
        action: #selector(handleTap(_:))
    )

    override init(frame: CGRect, textContainer: NSTextContainer?) {
        super.init(frame: frame, textContainer: textContainer)
        selectionObserver = NotificationCenter.default.addObserver(
            forName: .nycccClearRichTextSelection,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self, self.selectedRange.length > 0 else { return }
            self.chapterSelectionTarget?.controller.clearNativeSelection(in: self)
            self.selectedRange = NSRange(location: 0, length: 0)
            self.selectionChangeHandler?(false)
        }
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        selectionObserver = NotificationCenter.default.addObserver(
            forName: .nycccClearRichTextSelection,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self, self.selectedRange.length > 0 else { return }
            self.chapterSelectionTarget?.controller.clearNativeSelection(in: self)
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
            chapterSelectionTarget?.controller.clearNativeSelection(in: self)
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
    let chapterID: Int64?
    let sectionNumber: String?

    init(versionFileName: String, codeSectionID: Int64, chapterNumber: String, chapterID: Int64? = nil, sectionNumber: String? = nil) {
        let components = versionFileName.components(separatedBy: "/")
        if let index = components.firstIndex(of: "new-york-city"), components.indices.contains(index + 1) {
            bundle = components[index + 1]
        } else {
            bundle = ""
        }
        self.codeSectionID = codeSectionID
        self.chapterNumber = chapterNumber
        self.chapterID = chapterID
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
    var applicableChapterIDs: [Int64]? = nil
    var applicableSections: [String]? = nil
    var applicableExactSections: [String]? = nil
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
    func applies(toChapterID chapterID: Int64?) -> Bool {
        guard let applicableChapterIDs else { return true }
        guard let chapterID, (-9_007_199_254_740_991...9_007_199_254_740_991).contains(chapterID) else { return false }
        return applicableChapterIDs.contains(chapterID)
    }

    func applies(toSection number: String?) -> Bool {
        guard applicableSections != nil || applicableExactSections != nil || excludedSections != nil || excludedExactSections != nil else { return true }
        guard let section = number?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(), !section.isEmpty else { return false }
        func matches(_ value: String) -> Bool {
            let scope = value.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            return !scope.isEmpty && (section == scope || section.hasPrefix(scope + "."))
        }
        let hasPositiveScope = applicableSections != nil || applicableExactSections != nil
        let positiveMatch = (applicableSections ?? []).contains(where: matches) ||
            (applicableExactSections ?? []).contains { $0.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() == section }
        return (!hasPositiveScope || positiveMatch) &&
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
        var chapterID: Int64? = nil
        let excludeWholeChapter: Bool?
        let entries: [ReaderDefinitionEntry]
    }
    let schemaVersion: Int
    let books: [Book]

    fileprivate func chapterCandidates(for context: ReaderDefinitionContext) -> [ReaderDefinitionEntry] {
        guard schemaVersion == 1, !context.bundle.isEmpty else { return [] }
        guard !books.contains(where: {
            $0.excludeWholeChapter != false && $0.bundle == context.bundle && $0.codeSectionID == context.codeSectionID &&
            $0.definitionChapter?.uppercased() == context.chapterNumber.uppercased() &&
            ($0.chapterID == nil || context.chapterID == nil || $0.chapterID == context.chapterID)
        }) else { return [] }
        let initial = String(context.chapterNumber.uppercased().prefix(1))
        return books.filter {
            $0.bundle == context.bundle && $0.codeSectionID == context.codeSectionID &&
            ($0.scope == "general" || $0.scope == initial || $0.scope == "appendix-\(initial)")
        }.flatMap(\.entries).filter {
            $0.applicability == "definition-chapter" &&
            ($0.applicableChapters == nil || $0.applicableChapters!.contains(context.chapterNumber.uppercased())) &&
            $0.applies(toChapterID: context.chapterID)
        }
    }

    func entries(for context: ReaderDefinitionContext, includeSectionScoped: Bool = false) -> [ReaderDefinitionEntry] {
        let candidates = chapterCandidates(for: context)
        return Self.uniqueEntries(in: includeSectionScoped ? candidates : candidates.filter { $0.applies(toSection: context.sectionNumber) })
    }

    fileprivate static func uniqueEntries(in selected: [ReaderDefinitionEntry]) -> [ReaderDefinitionEntry] {
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
    // These patterns and section-specific exclusions are immutable for a matcher.
    private static let termDefinitionExpression = try! NSRegularExpression(
        pattern: #"^(?:[^.!?\n]{1,120}\.\s*)?The term [“"][^”"]+[”"] (?:shall )?means?\b"#, options: [.caseInsensitive]
    )
    private static let definitionHeadingExpression = try! NSRegularExpression(
        pattern: #"\*{0,2}§\s*(?:\d{2}-)?[A-Z]?\d+(?:\.\d+)*\s+Definitions\."#, options: [.caseInsensitive]
    )

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
        }, uniquingKeysWith: { first, _ in first }).filter { !$0.value.isEmpty }
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
        let trimmed = original.string.trimmingCharacters(in: .whitespacesAndNewlines)
        if Self.termDefinitionExpression.firstMatch(in: trimmed, range: NSRange(location: 0, length: (trimmed as NSString).length)) != nil { return original }
        let fullRange = NSRange(location: 0, length: original.length)
        let candidates = expression.matches(in: original.string, range: fullRange)
        guard !candidates.isEmpty else { return original }
        let definitionRange = Self.definitionHeadingExpression.firstMatch(in: original.string, range: fullRange)?.range
        var result: NSMutableAttributedString?
        let text = original.string as NSString
        let excludedStarts = Dictionary(uniqueKeysWithValues: excludedContexts.map { id, rules in
            let starts = rules.flatMap { rule in
                rule.expression.matches(in: original.string, range: fullRange).compactMap { context -> Int? in
                    let terms = candidates.filter { candidate in
                        candidate.range.location >= context.range.location && NSMaxRange(candidate.range) <= NSMaxRange(context.range) &&
                        byLabel[Self.key(text.substring(with: candidate.range))]?.contains(where: { $0.id == id }) == true
                    }
                    return terms.indices.contains(rule.occurrence) ? terms[rule.occurrence].range.location : nil
                }
            }
            return (id, Set(starts))
        })
        for match in candidates {
            if let definitionRange, match.range.location >= definitionRange.location { continue }
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
            if result == nil { result = NSMutableAttributedString(attributedString: original) }
            result?.removeAttribute(.underlineStyle, range: match.range)
            result?.addAttribute(.link, value: url, range: match.range)
            result?.addAttribute(.foregroundColor, value: UIColor.secondaryLabel, range: match.range)
        }
        return result ?? original
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
    private struct ChapterKey: Hashable {
        let bundle: String
        let codeSectionID: Int64
        let chapterNumber: String
        let chapterID: Int64?

        init(_ context: ReaderDefinitionContext) {
            bundle = context.bundle
            codeSectionID = context.codeSectionID
            chapterNumber = context.chapterNumber
            chapterID = context.chapterID
        }
    }
    private enum SectionScope: Hashable {
        case unspecified, ordinary, subtree(String), exact(String)
    }
    private struct MatcherKey: Hashable {
        let chapter: ChapterKey
        let section: SectionScope
    }
    private var matchers: [MatcherKey: ReaderDefinitionMatcher] = [:]

    private struct ChapterSelection {
        let entries: [ReaderDefinitionEntry]
        let hasSectionScopes: Bool
        let exactSections: Set<String>
        let subtrees: Set<String>

        // Siblings share all inherited rules until a more-specific rule or an exact
        // exception applies. Missing section identity must still fail closed.
        func matcherScope(for sectionNumber: String?) -> SectionScope {
            guard let section = sectionNumber?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(),
                  !section.isEmpty else { return .unspecified }
            if exactSections.contains(section) { return .exact(section) }
            var prefix = section[...]
            while true {
                if subtrees.contains(String(prefix)) { return .subtree(String(prefix)) }
                guard let dot = prefix.lastIndex(of: ".") else { return .ordinary }
                prefix = prefix[..<dot]
            }
        }
    }
    private var chapters: [ChapterKey: ChapterSelection] = [:]
    private var chapterRecency: [ChapterKey] = []
    private let chapterCapacity = 12

    private init() {
        if let url = Bundle.main.url(forResource: "reader-definition-registry", withExtension: "json", subdirectory: "CodeContent"),
           let data = try? Data(contentsOf: url) {
            registry = try? JSONDecoder().decode(ReaderDefinitionRegistry.self, from: data)
        } else { registry = nil }
    }

    func hasSectionScopes(for context: ReaderDefinitionContext) -> Bool {
        chapterSelection(for: context).hasSectionScopes
    }

    func chapterEntries(for context: ReaderDefinitionContext) -> [ReaderDefinitionEntry] {
        chapterSelection(for: context).entries
    }

    private func chapterSelection(for context: ReaderDefinitionContext) -> ChapterSelection {
        let key = ChapterKey(context)
        if let selection = chapters[key] {
            if chapterRecency.last != key {
                chapterRecency.removeAll { $0 == key }
                chapterRecency.append(key)
            }
            return selection
        }
        let candidates = registry?.chapterCandidates(for: context) ?? []
        let scoped = candidates.filter {
            $0.applicableSections != nil || $0.applicableExactSections != nil ||
            $0.excludedSections != nil || $0.excludedExactSections != nil || $0.excludedOccurrences != nil
        }
        var exactSections = Set<String>()
        var subtrees = Set<String>()
        for entry in scoped {
            for scope in (entry.applicableExactSections ?? []) + (entry.excludedExactSections ?? []) {
                exactSections.insert(scope.trimmingCharacters(in: .whitespacesAndNewlines).uppercased())
            }
            for scope in (entry.applicableSections ?? []) + (entry.excludedSections ?? []) {
                subtrees.insert(scope.trimmingCharacters(in: .whitespacesAndNewlines).uppercased())
            }
            for rule in entry.excludedOccurrences ?? [] { subtrees.insert(rule.section.uppercased()) }
        }
        let selection = ChapterSelection(entries: ReaderDefinitionRegistry.uniqueEntries(in: candidates),
                                         hasSectionScopes: !scoped.isEmpty, exactSections: exactSections, subtrees: subtrees)
        if chapterRecency.count >= chapterCapacity {
            chapters.removeValue(forKey: chapterRecency.removeFirst())
        }
        chapters[key] = selection
        chapterRecency.append(key)
        return selection
    }

    func matcher(for context: ReaderDefinitionContext) -> ReaderDefinitionMatcher {
        let scope = chapterSelection(for: context).matcherScope(for: context.sectionNumber)
        let key = MatcherKey(chapter: ChapterKey(context), section: scope)
        if let matcher = matchers[key] { return matcher }
        let matcher = ReaderDefinitionMatcher(entries: registry?.entries(for: context) ?? [], sectionNumber: context.sectionNumber)
        if matchers.count >= 12, let oldest = matchers.keys.first { matchers.removeValue(forKey: oldest) }
        matchers[key] = matcher
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
        return (coordinator.requiresTextUpdate(sourceChanged: !coordinator.hasRendered(source: candidate), contentWidth: width,
                                              fillImagesToWidth: fillImages, contentSizeCategory: category),
                coordinator.cachedMeasuredSize(source: candidate, width: width,
                                               contentSizeCategory: category) != nil)
    }
}
#endif
