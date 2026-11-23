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

    private struct HandleAdjustment {
        let originalRange: NativeChapterSelectionRange
        let movesStart: Bool
        let fingerOffset: CGPoint
    }

    private weak var scrollView: UIScrollView?
    private weak var origin: RichTextView?
    private weak var nativeSelectionView: RichTextView?
    private weak var nativeHandleOrigin: RichTextView?
    private var nativeRange: NativeChapterSelectionRange?
    private var scrollObservation: NSKeyValueObservation?
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
    private var handleAdjustment: HandleAdjustment?
    private lazy var startHandle = makeHandle(movesStart: true)
    private lazy var endHandle = makeHandle(movesStart: false)

    var resolveText: ((NativeChapterSelectionRange) -> NativeChapterSelectedText)?
    var askAssistant: (([ResearchSelectionRequest]) -> Void)?
    var saveToEvidence: (([ResearchSelectionRequest]) -> Bool)?

    private lazy var press: UILongPressGestureRecognizer = {
        let gesture = UILongPressGestureRecognizer(target: self, action: #selector(handleDrag(_:)))
        gesture.minimumPressDuration = 0.35
        gesture.allowableMovement = 12
        gesture.allowedTouchTypes = [UITouch.TouchType.direct, .pencil].map { NSNumber(value: $0.rawValue) }
        gesture.cancelsTouchesInView = false
        gesture.delegate = self
        return gesture
    }()
    private lazy var pointerDrag: UIPanGestureRecognizer = {
        // Mirroring and external trackpads deliver pointer clicks as indirect
        // touches. A click-drag should start at mouse-down, with no touch hold.
        let gesture = UIPanGestureRecognizer(target: self, action: #selector(handleDrag(_:)))
        gesture.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.indirectPointer.rawValue)]
        gesture.allowedScrollTypesMask = []
        gesture.maximumNumberOfTouches = 1
        gesture.cancelsTouchesInView = false
        gesture.delegate = self
        return gesture
    }()
    private lazy var editMenu = UIEditMenuInteraction(delegate: self)
    private lazy var selectionTap: UITapGestureRecognizer = {
        let gesture = UITapGestureRecognizer(target: self, action: #selector(handleSelectionTap(_:)))
        gesture.cancelsTouchesInView = false
        gesture.delegate = self
        return gesture
    }()

    func attach(to scrollView: UIScrollView) {
        guard self.scrollView !== scrollView else { return }
        if let previous = self.scrollView {
            clear()
            startHandle.removeFromSuperview()
            endHandle.removeFromSuperview()
            previous.removeGestureRecognizer(press)
            previous.removeGestureRecognizer(pointerDrag)
            previous.removeGestureRecognizer(selectionTap)
            previous.removeInteraction(editMenu)
        }
        self.scrollView = scrollView
        scrollView.addGestureRecognizer(press)
        scrollView.addGestureRecognizer(pointerDrag)
        scrollView.addGestureRecognizer(selectionTap)
        scrollView.addInteraction(editMenu)
    }

    func register(_ view: RichTextView, address: NativeChapterSelectionAddress) {
        mountedText[address] = MountedText(view: view)
        if let selection { highlight(view, address: address, selection: selection) }
        layoutSelectionHandles(for: view)
    }

    func unregister(_ view: RichTextView, address: NativeChapterSelectionAddress) {
        let removed = mountedText[address]?.view === view
        if removed { mountedText.removeValue(forKey: address) }
        if highlighted[address]?.view === view { highlighted.removeValue(forKey: address) }
        view.showChapterSelection(nil)
        if nativeHandleOrigin === view {
            nativeSelectionDidEnd(in: view)
        } else if removed, let selection, address == selection.start.address || address == selection.end.address {
            layoutSelectionHandles()
        }
    }

    func clear() {
        dismissSelectionMenu()
        finishDrag()
        let nativeSelection = nativeHandleOrigin
        nativeHandleOrigin = nil
        nativeRange = nil
        nativeSelection?.selectedTextRange = nil
        clearHighlight()
    }

    func evidenceAction(in range: NSRange, at address: NativeChapterSelectionAddress) -> UIAction? {
        let selection = NativeChapterSelectionRange(
            .init(address: address, offset: range.location),
            .init(address: address, offset: NSMaxRange(range))
        )
        guard let passages = resolveText?(selection).citations else { return nil }
        return evidenceAction(for: passages)
    }

    private func evidenceAction(for passages: [ResearchSelectionRequest]) -> UIAction? {
        guard saveToEvidence != nil, !passages.isEmpty else { return nil }
        return UIAction(title: "Save to Evidence", image: UIImage(systemName: "bookmark")) { [weak self] _ in
            guard let self, self.saveToEvidence?(passages) == true else { return }
            self.clear()
        }
    }

    private func clearHighlight() {
        for entry in highlighted.values { entry.view?.showChapterSelection(nil) }
        highlighted.removeAll()
        selection = nil
        if nativeRange == nil { scrollObservation = nil }
        layoutSelectionHandles()
    }

    private func dismissSelectionMenu() {
        menuID = nil
        finalText = nil
        editMenu.dismissMenu()
    }

    private func finishDrag() {
        stopAutoscroll()
        nativeSelectionView?.isSelectable = true
        nativeSelectionView = nil
        handleAdjustment = nil
        isDragging = false
        initialPosition = nil
        initialWord = nil
        origin = nil
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        if gestureRecognizer === selectionTap { return adjustableRange != nil }
        if gestureRecognizer.view is NativeChapterSelectionHandle { return adjustableRange != nil }
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

    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        gestureRecognizer !== pointerDrag || gestureRecognizer.buttonMask.contains(.primary)
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                           shouldBeRequiredToFailBy other: UIGestureRecognizer) -> Bool {
        (gestureRecognizer === pointerDrag || gestureRecognizer.view is NativeChapterSelectionHandle)
            && other === scrollView?.panGestureRecognizer
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                           shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        if gestureRecognizer === selectionTap { return true }
        // The enclosing pan should win normal swipes. Let UIKit handle an ordinary
        // long press or a selection contained inside the original text view.
        guard let origin, let otherView = other.view else { return false }
        return otherView === origin || otherView.isDescendant(of: origin)
    }

    func nativeSelectionDidChange(in view: RichTextView) {
        guard !isDragging else { return }
        guard view.selectedRange.length > 0, let address = view.chapterSelectionTarget?.address else {
            nativeSelectionDidEnd(in: view)
            return
        }
        nativeHandleOrigin = view
        nativeRange = NativeChapterSelectionRange(
            .init(address: address, offset: view.selectedRange.location),
            .init(address: address, offset: NSMaxRange(view.selectedRange))
        )
        observeSelectionScrolling()
        if selection != nil {
            dismissSelectionMenu()
            clearHighlight()
        } else {
            layoutSelectionHandles()
        }
    }

    func nativeSelectionDidEnd(in view: RichTextView) {
        guard nativeHandleOrigin === view else { return }
        nativeHandleOrigin = nil
        let range = nativeRange
        nativeRange = nil
        // UIKit can dismiss its per-block selection before the scroll view delivers its first offset change.
        if let range { applySelection(range) }
    }

    func clearNativeSelection(in view: RichTextView) {
        if nativeHandleOrigin === view { clear() }
    }

    func nativeEditMenuDidAppear(in view: RichTextView) {
        guard selection == nil, !isDragging, let scrollView else { return }
        nativeSelectionDidChange(in: view)
        for handle in [startHandle, endHandle] where handle.superview === scrollView {
            scrollView.bringSubviewToFront(handle)
        }
    }

    private var adjustableRange: NativeChapterSelectionRange? {
        selection ?? nativeRange
    }

    private func observeSelectionScrolling() {
        guard scrollObservation == nil, let scrollView else { return }
        scrollObservation = scrollView.observe(\.contentOffset, options: [.old, .new]) { [weak self] _, change in
            guard change.oldValue != change.newValue else { return }
            MainActor.assumeIsolated { self?.selectionViewportDidScroll() }
        }
    }

    private func selectionViewportDidScroll() {
        guard !isDragging, let range = adjustableRange else { return }
        if menuID != nil { dismissSelectionMenu() }
        if let view = nativeHandleOrigin {
            beginChapterSelection(in: view)
            applySelection(range)
            finishDrag()
        } else {
            refreshHighlights(for: range)
        }
        layoutSelectionHandles()
    }

    @objc private func handleSelectionTap(_ gesture: UITapGestureRecognizer) {
        guard let scrollView, let window = scrollView.window else { return }
        let point = gesture.location(in: scrollView)
        if let selection, tapsChapterSelection(at: point, in: scrollView) {
            let location = gesture.location(in: window)
            // Let UIKit finish handling this tap before presenting an edit menu in response to it.
            DispatchQueue.main.async { [weak self] in
                guard let self, self.selection == selection, self.menuID == nil else { return }
                self.fingerInWindow = location
                self.presentSelectionMenu()
            }
            return
        }
        if let view = nativeHandleOrigin, let range = view.selectedTextRange {
            // UIKit still owns the local selection and its editing menu.
            let local = view.convert(point, from: scrollView)
            if view.selectionRects(for: range).contains(where: { $0.rect.contains(local) }) { return }
        }
        clear()
    }

    private func tapsChapterSelection(at point: CGPoint, in scrollView: UIScrollView) -> Bool {
        guard selection != nil else { return false }
        return (!startHandle.isHidden && startHandle.frame.contains(point))
            || (!endHandle.isHidden && endHandle.frame.contains(point))
            || highlighted.values.contains { entry in
                guard let view = entry.view else { return false }
                return view.containsChapterSelection(at: view.convert(point, from: scrollView))
            }
    }

    private func makeHandle(movesStart: Bool) -> NativeChapterSelectionHandle {
        let handle = NativeChapterSelectionHandle(movesStart: movesStart)
        let pan = UIPanGestureRecognizer(target: self, action: #selector(adjustHandle(_:)))
        pan.maximumNumberOfTouches = 1
        pan.delegate = self
        handle.addGestureRecognizer(pan)
        return handle
    }

    func layoutSelectionHandles(for view: RichTextView) {
        guard let range = adjustableRange, let address = view.chapterSelectionTarget?.address,
              address == range.start.address || address == range.end.address else { return }
        layoutSelectionHandles()
    }

    private func layoutSelectionHandles() {
        // Let a continuous hold-and-drag finish before installing overlays over UIKit's handles.
        guard let scrollView, let range = adjustableRange, initialPosition == nil else {
            startHandle.isHidden = true
            endHandle.isHidden = true
            return
        }
        layout(startHandle, at: range.start, in: scrollView)
        layout(endHandle, at: range.end, in: scrollView)
    }

    private func layout(_ handle: NativeChapterSelectionHandle, at endpoint: NativeChapterSelectionPosition,
                        in scrollView: UIScrollView) {
        guard let geometry = caretGeometry(at: endpoint, in: scrollView) else {
            handle.isHidden = handle !== activeHandle
            return
        }
        if handle.superview !== scrollView { scrollView.addSubview(handle) }
        handle.place(at: geometry.rect, color: geometry.color, drawsHandle: selection != nil)
        handle.isHidden = false
    }

    private func caretGeometry(at endpoint: NativeChapterSelectionPosition,
                               in scrollView: UIScrollView) -> (rect: CGRect, color: UIColor)? {
        guard let view = mountedText[endpoint.address]?.view, view.window === scrollView.window,
              view.convert(view.bounds, to: scrollView).intersects(scrollView.bounds),
              let position = view.position(from: view.beginningOfDocument, offset: endpoint.offset) else { return nil }
        let caret = view.convert(view.caretRect(for: position), to: scrollView)
        guard !caret.isNull, caret.height > 0, caret.midX.isFinite, caret.midY.isFinite,
              scrollView.bounds.minY...scrollView.bounds.maxY ~= caret.midY else { return nil }
        return (caret, view.tintColor)
    }

    private var activeHandle: NativeChapterSelectionHandle? {
        handleAdjustment.map { $0.movesStart ? startHandle : endHandle }
    }

    @objc private func adjustHandle(_ gesture: UIPanGestureRecognizer) {
        guard let scrollView, let window = scrollView.window,
              let handle = gesture.view as? NativeChapterSelectionHandle else { return }
        fingerInWindow = gesture.location(in: window)
        switch gesture.state {
        case .began:
            guard let range = adjustableRange else { return }
            // Preserve where the user grabbed the handle, relative to its text position.
            let touch = gesture.location(in: scrollView)
            let translation = gesture.translation(in: scrollView)
            let caret = handle.caretCenter
            handleAdjustment = HandleAdjustment(originalRange: range, movesStart: handle.movesStart,
                fingerOffset: CGPoint(x: touch.x - translation.x - caret.x, y: touch.y - translation.y - caret.y))
            dismissSelectionMenu()
            beginChapterSelection(in: nativeHandleOrigin)
            applySelection(range)
            updateDrag()
        case .changed:
            updateDrag()
        case .ended, .cancelled:
            guard let adjustment = handleAdjustment else { return }
            if gesture.state == .cancelled { applySelection(adjustment.originalRange) } else { extendSelection() }
            presentSelectionMenu()
            finishDrag()
            layoutSelectionHandles()
        default:
            break
        }
    }

    @objc private func handleDrag(_ gesture: UIGestureRecognizer) {
        guard let scrollView, let window = scrollView.window else { return }
        let isPointerDrag = gesture === pointerDrag
        fingerInWindow = gesture.location(in: window)
        switch gesture.state {
        case .began:
            guard let origin, let target = origin.chapterSelectionTarget else { return }
            if !isPointerDrag { initialTouch = gesture.location(in: origin) }
            guard let position = origin.closestPosition(to: initialTouch) else { return }
            let offset = origin.offset(from: origin.beginningOfDocument, to: position)
            initialWord = nil
            if !isPointerDrag {
                let word = origin.tokenizer.rangeEnclosingPosition(position, with: .word, inDirection: .storage(.forward))
                    ?? origin.tokenizer.rangeEnclosingPosition(position, with: .word, inDirection: .storage(.backward))
                if let word {
                    let location = origin.offset(from: origin.beginningOfDocument, to: word.start)
                    initialWord = NSRange(location: location, length: origin.offset(from: word.start, to: word.end))
                }
            }
            initialPosition = NativeChapterSelectionPosition(address: target.address, offset: offset)
            if selection != nil {
                dismissSelectionMenu()
                clearHighlight()
            }
            if isPointerDrag { extendSelection() }
        case .changed:
            updateDrag()
        case .ended:
            extendSelection()
            let crossedBlocks = isDragging
            if crossedBlocks { presentSelectionMenu() }
            finishDrag()
            layoutSelectionHandles()
        case .failed, .cancelled:
            let wasSelecting = isDragging
            finishDrag()
            if wasSelecting { clearHighlight() }
        default: break
        }
    }

    private func updateDrag() {
        extendSelection()
        if isDragging && edgeSpeed != 0 { startAutoscroll() } else { stopAutoscroll() }
    }

    private func presentSelectionMenu() {
        guard let scrollView, let window = scrollView.window, let selection,
              let content = resolveText?(selection), !content.text.isEmpty else {
            clearHighlight()
            return
        }
        finalText = content
        let id = UUID()
        menuID = id
        let point = scrollView.convert(fingerInWindow, from: window)
        editMenu.presentEditMenu(with: UIEditMenuConfiguration(identifier: id as NSUUID, sourcePoint: point))
    }

    private func beginChapterSelection(in view: RichTextView?) {
        isDragging = true
        nativeHandleOrigin = nil
        nativeRange = nil
        nativeSelectionView = view
        view?.isSelectable = false
        view?.resignFirstResponder()
        view?.interactions.compactMap { $0 as? UIEditMenuInteraction }.forEach { $0.dismissMenu() }
    }

    private func extendSelection() {
        guard let scrollView, let window = scrollView.window else { return }
        let finger = scrollView.convert(fingerInWindow, from: window)
        if let adjustment = handleAdjustment {
            let point = CGPoint(x: finger.x - adjustment.fingerOffset.x, y: finger.y - adjustment.fingerOffset.y)
            guard let endpoint = position(at: point) else { return }
            let fixed = adjustment.movesStart ? adjustment.originalRange.end : adjustment.originalRange.start
            guard adjustment.movesStart ? endpoint < fixed : endpoint > fixed else { return }
            applySelection(NativeChapterSelectionRange(fixed, endpoint))
            return
        }
        guard let initialPosition, let endpoint = position(at: finger) else { return }
        if !isDragging {
            // Do not replace the native menu until the user drags beyond the first text view.
            let movedToScrollEdge = origin.map {
                abs($0.convert(fingerInWindow, from: window).y - initialTouch.y) > 12 && edgeSpeed != 0
            } ?? false
            guard endpoint.address != initialPosition.address || movedToScrollEdge else { return }
            beginChapterSelection(in: origin)
        }
        let anchorOffset = initialWord.map { endpoint < initialPosition ? NSMaxRange($0) : $0.location }
            ?? initialPosition.offset
        let anchor = NativeChapterSelectionPosition(address: initialPosition.address, offset: anchorOffset)
        applySelection(NativeChapterSelectionRange(anchor, endpoint))
    }

    private func applySelection(_ range: NativeChapterSelectionRange) {
        guard selection != range else { return }
        selection = range
        observeSelectionScrolling()
        refreshHighlights(for: range)
        layoutSelectionHandles()
    }

    private func refreshHighlights(for range: NativeChapterSelectionRange) {
        for (address, entry) in mountedText {
            guard range.start.address...range.end.address ~= address || highlighted[address] != nil,
                  let view = entry.view else { continue }
            highlight(view, address: address, selection: range)
        }
    }

    private func position(at point: CGPoint) -> NativeChapterSelectionPosition? {
        guard let scrollView else { return nil }
        var nearest: (address: NativeChapterSelectionAddress, view: RichTextView, vertical: CGFloat, horizontal: CGFloat)?
        let viewport = scrollView.bounds
        for (address, entry) in mountedText {
            guard let view = entry.view, view.window === scrollView.window, !view.bounds.isEmpty else { continue }
            let bounds = view.convert(view.bounds, to: scrollView)
            guard bounds.intersects(viewport) else { continue }
            let vertical = max(bounds.minY - point.y, point.y - bounds.maxY, 0)
            let horizontal = max(bounds.minX - point.x, point.x - bounds.maxX, 0)
            if nearest.map({ (vertical, horizontal, address) < ($0.vertical, $0.horizontal, $0.address) }) ?? true {
                nearest = (address, view, vertical, horizontal)
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
        var actions: [UIMenuElement] = [copy]
        if let save = evidenceAction(for: finalText.citations) { actions.append(save) }
        return ReaderSelectionMenuBuilder.menu(selectedText: finalText.text, suggestedActions: actions) { [weak self] _ in
            let send = self?.askAssistant
            self?.clear()
            send?(finalText.citations)
        }
    }

    func editMenuInteraction(_ interaction: UIEditMenuInteraction,
                             targetRectFor configuration: UIEditMenuConfiguration) -> CGRect {
        guard let scrollView, let selection else { return .null }
        // Keep the menu outside the visible grabbers so either end can be picked up again.
        let rects = [selection.start, selection.end].compactMap { endpoint in
            caretGeometry(at: endpoint, in: scrollView)?.rect.insetBy(dx: -8, dy: -28)
        }
        return rects.reduce(.null) { $0.union($1) }
    }

    func editMenuInteraction(_ interaction: UIEditMenuInteraction, willDismissMenuFor configuration: UIEditMenuConfiguration,
                             animator: UIEditMenuInteractionAnimating) {
        guard let menuID, configuration.identifier as? NSUUID == menuID as NSUUID else { return }
        animator.addCompletion { [weak self] in
            guard let self, self.menuID == menuID else { return }
            self.menuID = nil
            self.finalText = nil
        }
    }
}

/// Sits over the system handle until the drag takes ownership of the chapter range.
/// The overlay has a touch target larger than the visible grabber.
private final class NativeChapterSelectionHandle: UIView {
    let movesStart: Bool
    private let grip = CAShapeLayer()
    private(set) var caretCenter = CGPoint.zero
    private var drawnStemHeight: CGFloat = 0

    init(movesStart: Bool) {
        self.movesStart = movesStart
        super.init(frame: .zero)
        backgroundColor = .clear
        layer.addSublayer(grip)
        isAccessibilityElement = true
        accessibilityLabel = movesStart ? "Start selection handle" : "End selection handle"
        accessibilityIdentifier = movesStart ? "reader-selection-start-handle" : "reader-selection-end-handle"
        accessibilityHint = "Drag to adjust the selected text."
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }

    func place(at caret: CGRect, color: UIColor, drawsHandle: Bool) {
        let stemWidth: CGFloat = 2.5
        let radius: CGFloat = 8
        let tip = CGPoint(x: caret.midX, y: movesStart ? caret.minY : caret.maxY)
        let dot = CGPoint(x: tip.x, y: tip.y + (movesStart ? -radius : radius))
        caretCenter = CGPoint(x: caret.midX, y: caret.midY)
        let touchSize: CGFloat = 44
        let newFrame = CGRect(x: dot.x - touchSize / 2, y: dot.y - touchSize / 2,
                             width: touchSize, height: touchSize)
        if frame != newFrame { frame = newFrame }
        let fillColor = color.resolvedColor(with: traitCollection).cgColor
        guard grip.isHidden == drawsHandle ||
            (drawsHandle && (drawnStemHeight != caret.height || grip.fillColor != fillColor)) else { return }
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        grip.isHidden = !drawsHandle
        if drawsHandle {
            let center = CGPoint(x: bounds.midX, y: bounds.midY)
            let stemY = movesStart ? center.y + radius : center.y - radius - caret.height
            let path = UIBezierPath(ovalIn: CGRect(x: center.x - radius, y: center.y - radius,
                                                  width: radius * 2, height: radius * 2))
            path.append(UIBezierPath(roundedRect: CGRect(x: center.x - stemWidth / 2, y: stemY,
                                                        width: stemWidth, height: caret.height),
                                     cornerRadius: stemWidth / 2))
            grip.path = path.cgPath
            grip.fillColor = fillColor
            drawnStemHeight = caret.height
        }
        CATransaction.commit()
    }
}
