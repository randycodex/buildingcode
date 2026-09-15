import SwiftUI
import UIKit

/// Observes a repeated Search-tab tap without replacing SwiftUI's navigation delegate.
struct TabBarReselectListener: UIViewControllerRepresentable {
    let onReselect: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onReselect: onReselect)
    }

    func makeUIViewController(context: Context) -> ListenerViewController {
        let controller = ListenerViewController()
        controller.coordinator = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: ListenerViewController, context: Context) {
        context.coordinator.onReselect = onReselect
        uiViewController.coordinator = context.coordinator
        uiViewController.attachIfNeeded()
    }

    static func dismantleUIViewController(_ controller: ListenerViewController, coordinator: Coordinator) {
        coordinator.detach()
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var onReselect: () -> Void
        private weak var tabBarController: UITabBarController?
        private weak var listenerViewController: UIViewController?
        private var selectionAtTouchDown: UIViewController?
        private lazy var tap = UITapGestureRecognizer(target: self, action: #selector(didTap))

        init(onReselect: @escaping () -> Void) {
            self.onReselect = onReselect
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
        }

        func detach() {
            tap.view?.removeGestureRecognizer(tap)
            tabBarController = nil
            listenerViewController = nil
            selectionAtTouchDown = nil
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            selectionAtTouchDown = tabBarController?.selectedViewController
            return true
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                               shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            true
        }

        @objc private func didTap() {
            guard let controller = tabBarController, let previous = selectionAtTouchDown else { return }
            selectionAtTouchDown = nil
            // UIKit handles the tap first. Only a tap that leaves Search selected
            // is a reselect; ordinary navigation remains entirely owned by SwiftUI.
            DispatchQueue.main.async { [weak self, weak controller, weak previous] in
                guard let self, let controller, let previous,
                      self.tabBarController === controller else { return }
                self.notifyReselection(in: controller, previouslySelected: previous)
            }
        }

        func notifyReselection(in controller: UITabBarController, previouslySelected: UIViewController) {
            guard controller === tabBarController,
                  controller.selectedViewController === previouslySelected,
                  let listenerViewController,
                  hosts(listenerViewController, in: previouslySelected) else { return }
            onReselect()
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
