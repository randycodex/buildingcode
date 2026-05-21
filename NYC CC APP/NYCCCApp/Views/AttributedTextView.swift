import SwiftUI
import UIKit

struct AttributedTextView: View {
    let attributedText: NSAttributedString
    var onOpenImage: ((UIImage) -> Void)? = nil
    private let textBlocks: [AttributedTextBlock]

    @State private var availableWidth: CGFloat = 0

    init(attributedText: NSAttributedString, onOpenImage: ((UIImage) -> Void)? = nil) {
        self.attributedText = attributedText
        self.onOpenImage = onOpenImage
        self.textBlocks = Self.blocks(for: attributedText)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(textBlocks) { block in
                switch block.kind {
                case .flow:
                    AttributedTextContainer(
                        attributedText: block.attributedText,
                        contentWidth: max(availableWidth, 1),
                        fillImagesToWidth: true,
                        onOpenImage: onOpenImage
                    )
                    .frame(maxWidth: .infinity, alignment: .leading)

                case .table:
                    ScrollView(.horizontal, showsIndicators: true) {
                        AttributedTextContainer(
                            attributedText: block.attributedText,
                            contentWidth: preferredTableWidth(for: block.attributedText, availableWidth: max(availableWidth, 1)),
                            fillImagesToWidth: false,
                            onOpenImage: onOpenImage
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
        rtfString(for: text)?.contains(#"\trowd"#) == true
    }

    private func preferredTableWidth(for text: NSAttributedString, availableWidth: CGFloat) -> CGFloat {
        let columnCount = max(maxTableColumnCount(in: text), 1)
        let estimatedWidth = CGFloat(columnCount) * 120
        return max(availableWidth, estimatedWidth)
    }

    private func maxTableColumnCount(in text: NSAttributedString) -> Int {
        guard let rtf = Self.rtfString(for: text) else { return 0 }

        let rows = rtf.components(separatedBy: #"\row"#)
        var maximum = 0

        for row in rows {
            let columnCount = row.components(separatedBy: #"\cellx"#).count - 1
            maximum = max(maximum, columnCount)
        }

        return maximum
    }

    private static func rtfString(for text: NSAttributedString) -> String? {
        let range = NSRange(location: 0, length: text.length)
        let data = try? text.data(
            from: range,
            documentAttributes: [.documentType: NSAttributedString.DocumentType.rtf]
        )
        guard let data else { return nil }
        return String(data: data, encoding: .utf8)
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

    func makeCoordinator() -> Coordinator {
        Coordinator(onOpenImage: onOpenImage)
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
        return textView
    }

    func updateUIView(_ uiView: RichTextView, context: Context) {
        context.coordinator.onOpenImage = onOpenImage
        uiView.attachmentTapHandler = { image in
            context.coordinator.onOpenImage?(image)
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

        init(onOpenImage: ((UIImage) -> Void)?) {
            self.onOpenImage = onOpenImage
        }
    }
}

private final class ReaderImageAttachment: NSTextAttachment {
    var sourceImage: UIImage?
}

private final class RichTextView: UITextView {
    var attachmentTapHandler: ((UIImage) -> Void)?

    override init(frame: CGRect, textContainer: NSTextContainer?) {
        super.init(frame: frame, textContainer: textContainer)
        addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(handleTap(_:))))
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(handleTap(_:))))
    }

    @objc private func handleTap(_ recognizer: UITapGestureRecognizer) {
        let point = recognizer.location(in: self)
        guard let image = imageAttachment(at: point) else { return }
        attachmentTapHandler?(image)
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
    @Environment(\.dismiss) private var dismiss
    @State private var zoomScale: CGFloat = 1
    @State private var lastZoomScale: CGFloat = 1
    @State private var contentOffset: CGSize = .zero
    @State private var lastContentOffset: CGSize = .zero

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
