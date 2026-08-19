import SwiftUI
import UIKit
import os.signpost

extension Notification.Name {
    static let nycccClearRichTextSelection = Notification.Name("nycccClearRichTextSelection")
}

enum ReaderSelectionMenuBuilder {
    static let researchSystemImageName = "sparkle"

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
    private let textBlocks: [AttributedTextBlock]

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
        self.textBlocks = Self.blocks(for: attributedText)
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
                        onOpenLink: onOpenLink,
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
                            onOpenLink: onOpenLink,
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

    private static func blocks(for text: NSAttributedString) -> [AttributedTextBlock] {
        let nsText = text.string as NSString
        guard nsText.length > 0 else {
            return [AttributedTextBlock(kind: .flow, attributedText: text)]
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
                blocks[lastIndex] = AttributedTextBlock(kind: paragraphKind, attributedText: combined)
            } else {
                blocks.append(AttributedTextBlock(kind: paragraphKind, attributedText: paragraphText))
            }

            location = paragraphRange.upperBound
        }

        return blocks.isEmpty ? [AttributedTextBlock(kind: .flow, attributedText: text)] : blocks
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

    let id = UUID()
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

        let renderedText = renderedAttributedText()
        if !uiView.attributedText.isEqual(to: renderedText) {
            uiView.attributedText = renderedText
        }
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: RichTextView, context: Context) -> CGSize? {
        let width = max(max(contentWidth, proposal.width ?? contentWidth), 1)
        let fittingSize = CGSize(width: width, height: .greatestFiniteMagnitude)
        let measuredSize = uiView.sizeThatFits(fittingSize)
        return CGSize(width: width, height: ceil(measuredSize.height))
    }

    private func renderedAttributedText() -> NSAttributedString {
        guard attributedText.length > 0 else { return attributedText }

        let rendered = NSMutableAttributedString(attributedString: attributedText)
        let fullRange = NSRange(location: 0, length: rendered.length)
        var replacements: [(NSRange, NSAttributedString)] = []

        rendered.enumerateAttribute(.attachment, in: fullRange) { value, range, _ in
            guard let attachment = value as? NSTextAttachment else { return }
            guard let sourceImage = image(from: attachment) else { return }

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
            let attributes = rendered.attributes(at: range.location, effectiveRange: nil)
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
    private var selectionObserver: NSObjectProtocol?

    override init(frame: CGRect, textContainer: NSTextContainer?) {
        super.init(frame: frame, textContainer: textContainer)
        addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(handleTap(_:))))
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
        addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(handleTap(_:))))
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
