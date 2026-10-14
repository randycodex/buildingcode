import SwiftUI
import UIKit

/// Keep all note controls in the same SwiftUI presentation hierarchy. WebKit's
/// keyboard can return before SwiftUI updates its automatic avoidance, so use
/// public keyboard frame notifications to reserve the occupied viewport area.
struct NotebookKeyboardToolbar<Bar: View>: ViewModifier {
    let isVisible: Bool
    @ViewBuilder let bar: () -> Bar
    @State private var keyboardFrame = CGRect.null

    func body(content: Content) -> some View {
        GeometryReader { geometry in
            let overlap = NotebookKeyboardGeometry.overlap(
                viewport: geometry.frame(in: .global), keyboard: keyboardFrame)
            content
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if isVisible {
                        VStack(spacing: 0) {
                            bar().fixedSize(horizontal: false, vertical: true)
                            Color.clear.frame(height: overlap).allowsHitTesting(false)
                        }
                    }
                }
        }
        // Ignore automatic keyboard avoidance exactly once. The outer
        // GeometryReader stays stable while only its content receives the inset.
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillChangeFrameNotification)) { notification in
            keyboardFrame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect ?? .null
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            keyboardFrame = .null
        }
    }
}

/// GeometryReader's global viewport already excludes the container safe area.
/// Only a docked keyboard occupying the bottom of that viewport adds an inset.
enum NotebookKeyboardGeometry {
    static func overlap(viewport: CGRect, keyboard: CGRect) -> CGFloat {
        guard !viewport.isEmpty, !viewport.isNull, !keyboard.isEmpty, !keyboard.isNull,
              keyboard.maxY >= viewport.maxY,
              keyboard.minX <= viewport.minX + 1,
              keyboard.maxX >= viewport.maxX - 1 else { return 0 }
        return max(0, viewport.maxY - max(viewport.minY, keyboard.minY))
    }
}
