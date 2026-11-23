import UIKit

struct NativeChapterSelectionAddress: Hashable, Comparable {
    let block: Int
    var row = 0
    var segment = 0

    static func < (lhs: Self, rhs: Self) -> Bool {
        (lhs.block, lhs.row, lhs.segment) < (rhs.block, rhs.row, rhs.segment)
    }
}

struct NativeChapterSelectionPosition: Comparable {
    let address: NativeChapterSelectionAddress
    let offset: Int

    static func < (lhs: Self, rhs: Self) -> Bool {
        if lhs.address == rhs.address { return lhs.offset < rhs.offset }
        return lhs.address < rhs.address
    }
}

struct NativeChapterSelectionRange: Equatable {
    let start: NativeChapterSelectionPosition
    let end: NativeChapterSelectionPosition

    init(_ first: NativeChapterSelectionPosition, _ second: NativeChapterSelectionPosition) {
        start = min(first, second)
        end = max(first, second)
    }

    func range(in address: NativeChapterSelectionAddress, length: Int) -> NSRange? {
        guard start.address...end.address ~= address else { return nil }
        let lower = address == start.address ? min(start.offset, length) : 0
        let upper = address == end.address ? min(end.offset, length) : length
        guard upper > lower else { return nil }
        return NSRange(location: lower, length: upper - lower)
    }
}

struct NativeChapterSelectedText {
    var text: String
    var citations: [ResearchSelectionRequest]
}

struct NativeChapterSelectionTarget: Equatable {
    let controller: NativeChapterSelectionController
    var address: NativeChapterSelectionAddress

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.controller === rhs.controller && lhs.address == rhs.address
    }

    func listText(row: Int, segment: Int = 0) -> Self {
        Self(controller: controller, address: .init(block: address.block, row: row, segment: segment))
    }
}

/// Tracks selection in document coordinates without publishing any drag state to SwiftUI.
/// Only mounted text views draw a highlight, and only the final selection resolves citations.
@MainActor
final class NativeChapterSelectionController: NSObject, UIGestureRecognizerDelegate, UIEditMenuInteractionDelegate {
    private struct MountedText {
        weak var view: RichTextView?
    }

    private weak var scrollView: UIScrollView?
    private weak var origin: RichTextView?
    private weak var nativeSelectionView: RichTextView?
    private var mountedText: [NativeChapterSelectionAddress: MountedText] = [:]
    private var initialPosition: NativeChapterSelectionPosition?
    private var initialWord: NSRange?
    private var initialTouch = CGPoint.zero
    private var fingerInWindow = CGPoint.zero
    private var selection: NativeChapterSelectionRange?
    private var highlighted: [NativeChapterSelectionAddress: MountedText] = [:]
    private var finalText: NativeChapterSelectedText?
    private var displayLink: CADisplayLink?
    private var isDragging = false
    private var menuID: UUID?

    var resolveText: ((NativeChapterSelectionRange) -> NativeChapterSelectedText)?
    var askAssistant: (([ResearchSelectionRequest]) -> Void)?

    private lazy var press: UILongPressGestureRecognizer = {
        let gesture = UILongPressGestureRecognizer(target: self, action: #selector(handlePress(_:)))
        gesture.minimumPressDuration = 0.35
        gesture.allowableMovement = 12
        gesture.cancelsTouchesInView = false
        gesture.delegate = self
        return gesture
    }()
    private lazy var editMenu = UIEditMenuInteraction(delegate: self)

    func attach(to scrollView: UIScrollView) {
        guard self.scrollView !== scrollView else { return }
        if let previous = self.scrollView {
            clear()
            previous.removeGestureRecognizer(press)
            previous.removeInteraction(editMenu)
        }
        self.scrollView = scrollView
        scrollView.addGestureRecognizer(press)
        scrollView.addInteraction(editMenu)
    }

    func register(_ view: RichTextView, address: NativeChapterSelectionAddress) {
        mountedText[address] = MountedText(view: view)
        if let selection { highlight(view, address: address, selection: selection) }
    }

    func unregister(_ view: RichTextView, address: NativeChapterSelectionAddress) {
        if mountedText[address]?.view === view { mountedText.removeValue(forKey: address) }
        if highlighted[address]?.view === view { highlighted.removeValue(forKey: address) }
        view.showChapterSelection(nil)
    }

    func clear() {
        menuID = nil
        editMenu.dismissMenu()
        finishDrag()
        clearHighlight()
    }

    private func clearHighlight() {
        for entry in highlighted.values { entry.view?.showChapterSelection(nil) }
        highlighted.removeAll()
        selection = nil
        finalText = nil
    }

    private func finishDrag() {
        stopAutoscroll()
        nativeSelectionView?.isSelectable = true
        nativeSelectionView = nil
        isDragging = false
        initialPosition = nil
        initialWord = nil
        origin = nil
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        var candidate = touch.view
        while let view = candidate, view !== scrollView {
            if let text = view as? RichTextView, text.chapterSelectionTarget?.controller === self {
                origin = text
                initialTouch = touch.location(in: text)
                return true
            }
            candidate = view.superview
        }
        return false
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                           shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        // The enclosing pan should win normal swipes. Let UIKit handle an ordinary
        // long press or a selection contained inside the original text view.
        guard let origin, let otherView = other.view else { return false }
        return otherView === origin || otherView.isDescendant(of: origin)
    }

    @objc private func handlePress(_ gesture: UILongPressGestureRecognizer) {
        guard let scrollView, let window = scrollView.window else { return }
        fingerInWindow = gesture.location(in: window)
        switch gesture.state {
        case .began:
            guard let origin, let target = origin.chapterSelectionTarget,
                  let position = origin.closestPosition(to: initialTouch) else { return }
            let offset = origin.offset(from: origin.beginningOfDocument, to: position)
            let word = origin.tokenizer.rangeEnclosingPosition(position, with: .word, inDirection: .storage(.forward))
                ?? origin.tokenizer.rangeEnclosingPosition(position, with: .word, inDirection: .storage(.backward))
            if let word {
                let location = origin.offset(from: origin.beginningOfDocument, to: word.start)
                initialWord = NSRange(location: location, length: origin.offset(from: word.start, to: word.end))
            }
            initialPosition = NativeChapterSelectionPosition(address: target.address, offset: offset)
            if selection != nil {
                menuID = nil
                editMenu.dismissMenu()
                clearHighlight()
            }
        case .changed:
            extendSelection()
            if isDragging && edgeSpeed != 0 { startAutoscroll() } else { stopAutoscroll() }
        case .ended:
            defer { finishDrag() }
            guard isDragging, let selection, let content = resolveText?(selection),
                  !content.text.isEmpty else {
                clearHighlight()
                return
            }
            finalText = content
            let id = UUID()
            menuID = id
            let point = scrollView.convert(fingerInWindow, from: window)
            editMenu.presentEditMenu(with: UIEditMenuConfiguration(identifier: id as NSUUID, sourcePoint: point))
        case .failed, .cancelled:
            finishDrag()
            clearHighlight()
        default: break
        }
    }

    private func extendSelection() {
        guard let initialPosition, let scrollView, let window = scrollView.window,
              let endpoint = position(at: scrollView.convert(fingerInWindow, from: window)) else { return }
        if !isDragging {
            // Do not replace the native menu until the user drags beyond the first text view.
            let movedToScrollEdge = origin.map {
                abs($0.convert(fingerInWindow, from: window).y - initialTouch.y) > 12 && edgeSpeed != 0
            } ?? false
            guard endpoint.address != initialPosition.address || movedToScrollEdge else { return }
            isDragging = true
            nativeSelectionView = origin
            origin?.isSelectable = false
            origin?.resignFirstResponder()
            origin?.interactions.compactMap { $0 as? UIEditMenuInteraction }.forEach { $0.dismissMenu() }
        }
        let anchorOffset = initialWord.map { endpoint < initialPosition ? NSMaxRange($0) : $0.location }
            ?? initialPosition.offset
        let anchor = NativeChapterSelectionPosition(address: initialPosition.address, offset: anchorOffset)
        let range = NativeChapterSelectionRange(anchor, endpoint)
        guard selection != range else { return }
        selection = range
        for (address, entry) in mountedText {
            if let view = entry.view { highlight(view, address: address, selection: range) }
        }
    }

    private func position(at point: CGPoint) -> NativeChapterSelectionPosition? {
        guard let scrollView else { return nil }
        var nearest: (address: NativeChapterSelectionAddress, view: RichTextView, distance: CGFloat)?
        let viewport = scrollView.bounds
        for (address, entry) in mountedText {
            guard let view = entry.view, view.window === scrollView.window, !view.bounds.isEmpty else { continue }
            let bounds = view.convert(view.bounds, to: scrollView)
            guard bounds.intersects(viewport) else { continue }
            let distance = max(bounds.minY - point.y, point.y - bounds.maxY, 0)
            if distance < (nearest?.distance ?? .infinity) {
                nearest = (address, view, distance)
            }
        }
        guard let nearest else { return nil }
        let local = nearest.view.convert(point, from: scrollView)
        guard let position = nearest.view.closestPosition(to: local) else { return nil }
        return NativeChapterSelectionPosition(address: nearest.address,
            offset: nearest.view.offset(from: nearest.view.beginningOfDocument, to: position))
    }

    private func highlight(_ view: RichTextView, address: NativeChapterSelectionAddress,
                           selection: NativeChapterSelectionRange) {
        let isVisible = scrollView.map { view.convert(view.bounds, to: $0).intersects($0.bounds) } ?? false
        let range = isVisible ? selection.range(in: address, length: view.attributedText?.length ?? 0) : nil
        guard range != nil || highlighted[address] != nil else { return }
        view.showChapterSelection(range)
        if range == nil {
            highlighted.removeValue(forKey: address)
        } else {
            highlighted[address] = MountedText(view: view)
        }
    }

    private var edgeSpeed: CGFloat {
        guard let scrollView, let window = scrollView.window else { return 0 }
        let y = scrollView.convert(fingerInWindow, from: window).y
        let inset = scrollView.adjustedContentInset
        let edge: CGFloat = 44
        let top = scrollView.bounds.minY + inset.top
        let bottom = scrollView.bounds.maxY - inset.bottom
        if y < top + edge { return -min((top + edge - y) / edge, 1) }
        if y > bottom - edge { return min((y - (bottom - edge)) / edge, 1) }
        return 0
    }

    private func startAutoscroll() {
        guard displayLink == nil else { return }
        let link = CADisplayLink(target: self, selector: #selector(autoscroll(_:)))
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    private func stopAutoscroll() {
        displayLink?.invalidate()
        displayLink = nil
    }

    @objc private func autoscroll(_ link: CADisplayLink) {
        guard let scrollView else { stopAutoscroll(); return }
        let inset = scrollView.adjustedContentInset
        let lower = -inset.top
        let upper = max(lower, scrollView.contentSize.height - scrollView.bounds.height + inset.bottom)
        let next = min(max(scrollView.contentOffset.y + edgeSpeed * 440 * link.duration, lower), upper)
        guard next != scrollView.contentOffset.y else { stopAutoscroll(); return }
        scrollView.contentOffset.y = next
        extendSelection()
    }

    func editMenuInteraction(_ interaction: UIEditMenuInteraction, menuFor configuration: UIEditMenuConfiguration,
                             suggestedActions: [UIMenuElement]) -> UIMenu? {
        guard let finalText, let menuID, configuration.identifier as? NSUUID == menuID as NSUUID else { return nil }
        let copy = UIAction(title: "Copy", image: UIImage(systemName: "doc.on.doc")) { [weak self] _ in
            UIPasteboard.general.string = finalText.text
            self?.clear()
        }
        guard !finalText.citations.isEmpty else { return UIMenu(children: [copy]) }
        return ReaderSelectionMenuBuilder.menu(selectedText: finalText.text, suggestedActions: [copy]) { [weak self] _ in
            let send = self?.askAssistant
            self?.clear()
            send?(finalText.citations)
        }
    }

    func editMenuInteraction(_ interaction: UIEditMenuInteraction, willDismissMenuFor configuration: UIEditMenuConfiguration,
                             animator: UIEditMenuInteractionAnimating) {
        guard let menuID, configuration.identifier as? NSUUID == menuID as NSUUID else { return }
        animator.addCompletion { [weak self] in
            guard let self, self.menuID == menuID else { return }
            self.menuID = nil
            self.clearHighlight()
        }
    }
}
