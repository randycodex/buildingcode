import SwiftUI
import UIKit

/// Observes a repeated tab tap without replacing SwiftUI's navigation delegate.
struct TabBarReselectListener: UIViewControllerRepresentable {
    let selectedIconColor: UIColor?
    let onReselect: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(selectedIconColor: selectedIconColor, onReselect: onReselect)
    }

    func makeUIViewController(context: Context) -> ListenerViewController {
        let controller = ListenerViewController()
        controller.coordinator = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: ListenerViewController, context: Context) {
        context.coordinator.onReselect = onReselect
        context.coordinator.selectedIconColor = selectedIconColor
        uiViewController.coordinator = context.coordinator
        uiViewController.attachIfNeeded()
    }

    static func dismantleUIViewController(_ controller: ListenerViewController, coordinator: Coordinator) {
        coordinator.detach()
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var onReselect: () -> Void
        var selectedIconColor: UIColor?
        private weak var tabBarController: UITabBarController?
        private weak var listenerViewController: UIViewController?
        private var selectionAtTouchDown: UIViewController?
        private var actionAtTouchDown: (() -> Void)?
        private lazy var tap = UITapGestureRecognizer(target: self, action: #selector(didTap))

        init(selectedIconColor: UIColor? = nil, onReselect: @escaping () -> Void) {
            self.onReselect = onReselect
            self.selectedIconColor = selectedIconColor
            super.init()
            tap.cancelsTouchesInView = false
            tap.delaysTouchesBegan = false
            tap.delaysTouchesEnded = false
            tap.delegate = self
        }

        func attach(to controller: UITabBarController, listener: UIViewController) {
            if tabBarController !== controller {
                detach()
                tabBarController = controller
                controller.tabBar.addGestureRecognizer(tap)
            }
            listenerViewController = listener
            applySelectedIconColor(to: controller.tabBar)
        }

        private func applySelectedIconColor(to tabBar: UITabBar) {
            guard let selectedIconColor else { return }
            if tabBar.tintColor != selectedIconColor { tabBar.tintColor = selectedIconColor }

            // The app's explicit UITabBarAppearance colors take priority over
            // SwiftUI tint. Change the appearance of this project's bar only.
            func updated(_ appearance: UITabBarAppearance) -> UITabBarAppearance? {
                let layouts = [appearance.stackedLayoutAppearance, appearance.inlineLayoutAppearance,
                               appearance.compactInlineLayoutAppearance]
                guard layouts.contains(where: { $0.selected.iconColor != selectedIconColor }) else { return nil }
                for layout in layouts { layout.selected.iconColor = selectedIconColor }
                return appearance
            }

            if let standard = updated(tabBar.standardAppearance) { tabBar.standardAppearance = standard }
            if let edge = tabBar.scrollEdgeAppearance.flatMap(updated) { tabBar.scrollEdgeAppearance = edge }
        }

        func detach() {
            tap.view?.removeGestureRecognizer(tap)
            tabBarController = nil
            listenerViewController = nil
            selectionAtTouchDown = nil
            actionAtTouchDown = nil
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            selectionAtTouchDown = tabBarController?.selectedViewController
            // SwiftUI may pop a NavigationStack as part of UIKit's tab tap.
            // Retain the action for the screen where this touch began.
            actionAtTouchDown = onReselect
            return true
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                               shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            true
        }

        @objc private func didTap() {
            guard let controller = tabBarController, let previous = selectionAtTouchDown else { return }
            let action = actionAtTouchDown ?? onReselect
            selectionAtTouchDown = nil
            actionAtTouchDown = nil
            // UIKit handles the tap first. Only a tap that leaves the same tab selected
            // is a reselect; ordinary navigation remains entirely owned by SwiftUI.
            DispatchQueue.main.async { [weak self, weak controller, weak previous] in
                guard let self, let controller, let previous,
                      self.tabBarController === controller else { return }
                self.notifyReselection(in: controller, previouslySelected: previous, action: action)
            }
        }

        func notifyReselection(in controller: UITabBarController, previouslySelected: UIViewController,
                              action: (() -> Void)? = nil) {
            guard controller === tabBarController,
                  controller.selectedViewController === previouslySelected,
                  let listenerViewController,
                  hosts(listenerViewController, in: previouslySelected) else { return }
            (action ?? onReselect)()
        }

        private func hosts(_ listener: UIViewController, in root: UIViewController) -> Bool {
            if root === listener { return true }
            return root.children.contains { hosts(listener, in: $0) }
        }
    }

    final class ListenerViewController: UIViewController {
        weak var coordinator: Coordinator?

        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            attachIfNeeded()
        }

        func attachIfNeeded() {
            guard let coordinator, let tabBarController else { return }
            coordinator.attach(to: tabBarController, listener: self)
        }
    }
}
