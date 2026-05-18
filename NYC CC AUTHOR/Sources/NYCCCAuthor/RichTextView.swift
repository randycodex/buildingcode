import AppKit
import SwiftUI

struct RichTextView: NSViewRepresentable {
    @Binding var attributedText: NSAttributedString

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSTextView.scrollableTextView()
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.autohidesScrollers = true
        scrollView.drawsBackground = true

        guard let textView = scrollView.documentView as? NSTextView else {
            return scrollView
        }

        textView.delegate = context.coordinator
        textView.isRichText = true
        textView.importsGraphics = true
        textView.allowsUndo = true
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.minSize = NSSize(width: 0, height: 0)
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.textContainerInset = NSSize(width: 18, height: 20)
        textView.textContainer?.containerSize = NSSize(width: 0, height: CGFloat.greatestFiniteMagnitude)
        textView.textContainer?.widthTracksTextView = true
        textView.textStorage?.setAttributedString(attributedText)

        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = scrollView.documentView as? NSTextView else {
            return
        }

        let currentText = textView.attributedString()
        guard !currentText.isEqual(to: attributedText) else {
            return
        }

        context.coordinator.isUpdatingFromModel = true
        textView.textStorage?.setAttributedString(attributedText)
        context.coordinator.isUpdatingFromModel = false
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: RichTextView
        var isUpdatingFromModel = false

        init(parent: RichTextView) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            guard !isUpdatingFromModel,
                  let textView = notification.object as? NSTextView else {
                return
            }

            parent.attributedText = NSAttributedString(attributedString: textView.attributedString())
        }
    }
}
